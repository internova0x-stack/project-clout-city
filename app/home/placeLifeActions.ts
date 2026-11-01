"use server";

import { randomInt } from "node:crypto";
import { LifeError, todaysPick, type TodayPick, claimStamp, doActivity, doMoment, lifeError, lifeView, momentFor, momentView, type LifeDone, type LifeResult, type LifeScene, type LifeView, type MomentView } from "@/lib/placeLife";
import { LIFE_CONTENT } from "@/lib/placeLifeContent";
import { cityMinutes } from "@/lib/cityClock";
import { GAME_CONFIG } from "@/lib/config";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { getServerSupabase } from "@/lib/supabase/server";

// Living places (migration 0157; lib/placeLife.ts). The rules run here with a crypto random source: the browser names an
// activity, a moment or a stamp and an option, and gets back what happened and the place's view, never the odds.
// place_life_save pays once (ledger 'place_life') and checks the caps, the place, holding and Energy again.

type Admin = NonNullable<ReturnType<typeof getAdminSupabase>>;
type R<T> = { ok: true; data: T } | { ok: false; error: string };
interface Ctx { at: string | null; energy: number; holding: boolean; today: string; refs: string[]; momentsToday: number; regularDays: Record<string, number> }

const rng = () => randomInt(0, 2 ** 32) / 2 ** 32;
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

async function who(): Promise<{ id: string; admin: Admin; user: NonNullable<Awaited<ReturnType<typeof getServerSupabase>>> } | { error: string }> {
  const supabase = await getServerSupabase();
  const admin = getAdminSupabase();
  if (!supabase || !admin) return { error: "Accounts aren't switched on yet." };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in first." };
  return { id: user.id, admin, user: supabase };
}

async function context(w: { id: string; admin: Admin; user: NonNullable<Awaited<ReturnType<typeof getServerSupabase>>> }): Promise<{ ctx: Ctx; scene: LifeScene; done: LifeDone } | { error: string }> {
  const [c, conds] = await Promise.all([
    w.admin.rpc("place_life_context", { p_player: w.id }),
    w.user.rpc("city_conditions_now"),
  ]);
  if (c.error) {
    if (/place_life_context/.test(c.error.message)) return { error: "Run migration 0157 to open Living places." };
    console.error("place_life_context failed", c.error);
    return { error: lifeError("unknown") };
  }
  if (!c.data) return { error: "Create your character first." };
  const ctx = c.data as Ctx;
  const now = new Date();
  const scene: LifeScene = {
    minute: cityMinutes(now.getTime(), GAME_CONFIG.cityClock),
    weekday: WEEKDAYS.indexOf(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short" }).format(now)) + 1,
    conditions: ((conds.data ?? []) as { kind: string; now: boolean }[]).filter((x) => x.now).map((x) => x.kind),
  };
  return { ctx, scene, done: { refs: new Set(ctx.refs), momentsToday: ctx.momentsToday } };
}

const codeOf = (m: string) => /^(rate_limited|not_here|in_holding|closed_now|no_energy|done|moments_out|no_player|bad_effects)/.exec(m)?.[1];
const SAVE_ERRORS: Record<string, string> = {
  rate_limited: "Slow down a little.", closed_now: "Closed right now. Come back when it opens.", in_holding: "You're in holding. Activities can wait.", done: "Done that already.",
  bad_effects: "Something went wrong. Try again.", no_player: "Create your character first.",
};

async function save(w: { id: string; admin: Admin }, kind: "activity" | "moment" | "stamp", place: string | null, r: LifeResult): Promise<string | null> {
  const { error } = await w.admin.rpc("place_life_save", {
    p_player: w.id, p_kind: kind, p_place: place, p_ref: r.ref, p_cash: r.cash, p_clout: r.clout, p_mood: r.mood, p_energy: r.energy,
  });
  if (!error) return null;
  const code = codeOf(error.message);
  if (!code) console.error("place_life_save failed", error);
  return SAVE_ERRORS[code ?? ""] ?? lifeError(code ?? "unknown");
}

const fail = (e: unknown): { ok: false; error: string } => {
  if (e instanceof LifeError) return { ok: false, error: lifeError(e.code) };
  throw e;
};

export async function lifePlace(place: string): Promise<R<LifeView>> {
  const w = await who();
  if ("error" in w) return { ok: false, error: w.error };
  const c = await context(w);
  if ("error" in c) return { ok: false, error: c.error };
  return { ok: true, data: lifeView(LIFE_CONTENT, place, c.scene, c.done, c.ctx.regularDays[place] ?? 0) };
}

export async function lifeActivity(id: string, option: string): Promise<R<{ result: LifeResult; view: LifeView }>> {
  if (typeof id !== "string" || typeof option !== "string") return { ok: false, error: lifeError("unknown") };
  const w = await who();
  if ("error" in w) return { ok: false, error: w.error };
  const c = await context(w);
  if ("error" in c) return { ok: false, error: c.error };
  if (c.ctx.holding) return { ok: false, error: SAVE_ERRORS.in_holding };
  const skill = async (s: string) => ((await w.admin.rpc("skill_now", { p_player: w.id, p_skill: s })).data as number | null) ?? 0;
  const a = LIFE_CONTENT.activities.find((x) => x.id === id);
  const opt = a?.options.find((o) => o.id === option);
  const level = opt?.skill ? await skill(opt.skill) : 0;
  let r: LifeResult;
  try {
    r = doActivity(LIFE_CONTENT, id, option, { at: c.ctx.at, scene: c.scene, done: c.done, energy: c.ctx.energy, skill: () => level }, rng);
  } catch (e) { return fail(e); }
  const err = await save(w, "activity", a!.place, r);
  if (err) return { ok: false, error: err };
  c.done.refs.add(r.ref);
  return { ok: true, data: { result: r, view: lifeView(LIFE_CONTENT, a!.place, c.scene, c.done, c.ctx.regularDays[a!.place] ?? 0) } };
}

export async function lifeMoment(crowdType: string): Promise<R<MomentView | null>> {
  if (typeof crowdType !== "string") return { ok: true, data: null };
  const w = await who();
  if ("error" in w) return { ok: false, error: w.error };
  const c = await context(w);
  if ("error" in c) return { ok: true, data: null };
  const m = momentFor(LIFE_CONTENT, crowdType, c.done, rng);
  return { ok: true, data: m ? momentView(m) : null };
}

export async function lifePlayMoment(id: string, option: string): Promise<R<LifeResult>> {
  if (typeof id !== "string" || typeof option !== "string") return { ok: false, error: lifeError("unknown") };
  const w = await who();
  if ("error" in w) return { ok: false, error: w.error };
  const c = await context(w);
  if ("error" in c) return { ok: false, error: c.error };
  const m = LIFE_CONTENT.moments.find((x) => x.id === id);
  const opt = m?.options.find((o) => o.id === option);
  const level = opt?.skill ? (((await w.admin.rpc("skill_now", { p_player: w.id, p_skill: opt.skill })).data as number | null) ?? 0) : 0;
  let r: LifeResult;
  try { r = doMoment(LIFE_CONTENT, id, option, c.done, () => level, rng); } catch (e) { return fail(e); }
  const err = await save(w, "moment", c.ctx.at, r);
  if (err) return { ok: false, error: err };
  return { ok: true, data: r };
}

export async function lifeStamp(place: string, days: number): Promise<R<{ result: LifeResult; view: LifeView }>> {
  if (typeof place !== "string" || !Number.isInteger(days)) return { ok: false, error: lifeError("unknown") };
  const w = await who();
  if ("error" in w) return { ok: false, error: w.error };
  const c = await context(w);
  if ("error" in c) return { ok: false, error: c.error };
  const visited = c.ctx.regularDays[place] ?? 0;
  let r: LifeResult;
  try { r = claimStamp(LIFE_CONTENT, place, days, visited, c.done); } catch (e) { return fail(e); }
  const err = await save(w, "stamp", place, r);
  if (err) return { ok: false, error: err };
  c.done.refs.add(r.ref);
  return { ok: true, data: { result: r, view: lifeView(LIFE_CONTENT, place, c.scene, c.done, visited) } };
}

export async function lifeToday(): Promise<R<TodayPick | null>> {
  const w = await who();
  if ("error" in w) return { ok: false, error: w.error };
  const c = await context(w);
  if ("error" in c) return { ok: false, error: c.error };
  const day = Date.parse(`${c.ctx.today}T12:00:00Z`) / 86_400_000;
  return { ok: true, data: todaysPick(LIFE_CONTENT, c.scene, c.done, c.ctx.regularDays, Math.floor(day)) };
}
