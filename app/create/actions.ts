"use server";

import { cookies } from "next/headers";
import { GAME_CONFIG } from "@/lib/config";
import { normalizeInviteCode } from "@/lib/invite";
import { normalizeCreatorCode } from "@/lib/creators";
import { isValidLook, normalizeLook, lookChoices } from "@/lib/look";
import { isStyleId } from "@/lib/styles";
import { getServerSupabase } from "@/lib/supabase/server";
import { cleanName, nameError } from "@/lib/validation";

export type CreateResult = { ok: true } | { ok: false; error: string; field?: "name" | "age" };

export async function createPlayer(input: {
  name: string;
  style: string;
  look: unknown;
  ageConfirmed?: boolean;
}): Promise<CreateResult> {
  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, error: "Accounts aren't switched on yet." };

  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return { ok: false, error: "Your sign-in expired. Tap the link in your email again." };

  const problem = nameError(input.name);
  if (problem) return { ok: false, error: problem, field: "name" };
  if (!isStyleId(input.style)) return { ok: false, error: "Pick a starting style." };
  if (!isValidLook(input.look, input.style)) return { ok: false, error: "Something's off with your look. Try picking again." };

  const meta = user.user_metadata ?? {};
  const cookieStore = await cookies();
  const ageConfirmed =
    meta.age_confirmed === true || input.ageConfirmed === true || cookieStore.get(GAME_CONFIG.ageCookieName)?.value === "1";
  if (!ageConfirmed) return { ok: false, error: "Clout City is 18+. Confirm your age to continue.", field: "age" };

  const invite =
    normalizeInviteCode(typeof meta.invite_code === "string" ? meta.invite_code : null) ??
    normalizeInviteCode(cookieStore.get(GAME_CONFIG.invite.cookieName)?.value);

  const { error } = await supabase.rpc("create_player", {
    p_display_name: cleanName(input.name),
    p_starting_style: input.style,
    p_look: lookChoices(normalizeLook(input.look, input.style)),
    p_invite_code: invite,
    p_age_confirmed: true,
  });

  if (error) {
    if (error.message.includes("name_format")) {
      return { ok: false, error: "Letters, numbers, _ and . only, 3 to 20 of them.", field: "name" };
    }
    if (error.message.includes("name_taken") || error.code === "23505") {
      return { ok: false, error: "That username's taken. Somebody got there first.", field: "name" };
    }
    console.error("create_player failed", error);
    return { ok: false, error: "The city glitched. Try again in a second." };
  }

  cookieStore.delete(GAME_CONFIG.invite.cookieName);

  // Creators (spec section 21, migration 0087): the link followed on this device or kept on the account, or the
  // typed code. The server decides whether it counts and pays the welcome gift once; sign-up never fails over it.
  const slug = (typeof meta.creator_link === "string" ? meta.creator_link : null) ?? cookieStore.get(GAME_CONFIG.creator.cookieName)?.value ?? null;
  const creatorCode = normalizeCreatorCode(typeof meta.creator_code === "string" ? meta.creator_code : null) ??
    normalizeCreatorCode(cookieStore.get(GAME_CONFIG.creator.codeCookieName)?.value);
  if (slug || creatorCode) {
    const { error: creatorError } = await supabase.rpc("creator_attach", { p_slug: slug, p_code: creatorCode });
    if (creatorError && !/does not exist|schema cache/i.test(creatorError.message)) console.error("creator_attach failed", creatorError);
    cookieStore.delete(GAME_CONFIG.creator.cookieName);
    cookieStore.delete(GAME_CONFIG.creator.codeCookieName);
  }
  return { ok: true };
}

type StepResult = { ok: true } | { ok: false; error: string };

const STEP_ERRORS: Record<string, string> = {
  pick_two: "Pick exactly two. Commitment issues are a trait, but not one of these.",
  unknown_trait: "That trait isn't on the menu.",
  traits_first: "Pick your traits first.",
  lottery_first: "Roll the dice first.",
  cant_afford: "That place would leave you too broke for this month. Pick another.",
  unknown_home: "That apartment just got rented. Pick another.",
};

async function callStep(fn: string, args?: Record<string, unknown>): Promise<{ data: unknown; error: string | null }> {
  const supabase = await getServerSupabase();
  if (!supabase) return { data: null, error: "Accounts aren't switched on yet." };
  const { data, error } = await supabase.rpc(fn, args);
  if (!error) return { data, error: null };
  const key = Object.keys(STEP_ERRORS).find((k) => error.message.includes(k));
  if (!key) console.error(`${fn} failed`, error);
  return { data: null, error: key ? STEP_ERRORS[key] : "The city glitched. Try again in a second." };
}

export async function saveTraits(traits: string[]): Promise<StepResult> {
  const { error } = await callStep("set_traits", { p_traits: traits });
  return error ? { ok: false, error } : { ok: true };
}

export async function rollBirthLottery(): Promise<{ ok: true; cash: number } | { ok: false; error: string }> {
  const { data, error } = await callStep("roll_birth_lottery");
  return error ? { ok: false, error } : { ok: true, cash: Number(data) };
}

export async function moveIn(homeId: string): Promise<StepResult> {
  const { error } = await callStep("move_in", { p_home: homeId });
  return error ? { ok: false, error } : { ok: true };
}

/** Start over (migration 0114): the welcome screen's button. The server checks the 30 days and resets the run. */
export async function restartPlayer(): Promise<StepResult> {
  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, error: "Accounts aren't switched on yet." };
  const { error } = await supabase.rpc("restart_player");
  if (!error) return { ok: true };
  if (error.message.includes("restart_too_soon")) return { ok: false, error: `You can only start over once every ${GAME_CONFIG.restartDays} days.` };
  if (error.message.includes("banned")) return { ok: false, error: "This account can't start over." };
  console.error("restart_player failed", error);
  return { ok: false, error: "The city glitched. Try again in a second." };
}

/** The creator's look step after starting over: a new style and look, same username. */
export async function restartLook(input: { name: string; style: string; look: unknown; ageConfirmed?: boolean }): Promise<CreateResult> {
  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, error: "Accounts aren't switched on yet." };
  if (!isStyleId(input.style)) return { ok: false, error: "Pick a starting style." };
  if (!isValidLook(input.look, input.style)) return { ok: false, error: "Something's off with your look. Try picking again." };
  const { error } = await supabase.rpc("restart_look", { p_style: input.style, p_look: lookChoices(normalizeLook(input.look, input.style)) });
  if (error) {
    console.error("restart_look failed", error);
    return { ok: false, error: "The city glitched. Try again in a second." };
  }
  return { ok: true };
}
