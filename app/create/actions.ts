"use server";

import { cookies } from "next/headers";
import { GAME_CONFIG } from "@/lib/config";
import { normalizeInviteCode } from "@/lib/invite";
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
  const ageConfirmed = meta.age_confirmed === true || input.ageConfirmed === true;
  if (!ageConfirmed) return { ok: false, error: "Clout City is 18+. Confirm your age to continue.", field: "age" };

  const cookieStore = await cookies();
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
    if (error.message.includes("name_taken") || error.code === "23505") {
      return { ok: false, error: "That name's taken. Somebody got there first.", field: "name" };
    }
    console.error("create_player failed", error);
    return { ok: false, error: "The city glitched. Try again in a second." };
  }

  cookieStore.delete(GAME_CONFIG.invite.cookieName);
  return { ok: true };
}
