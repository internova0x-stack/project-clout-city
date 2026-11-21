"use server";

import { randomInt } from "node:crypto";
import { DEAL, SNEAK, TREND, bribeOf, canSneak, costFor, fits, haterAt, haterChance, hatersFor, mondayOf, needsOk, publicistCost, sneakOdds, teaCash, trendingFor, type DealWay, type SneakWay } from "@/lib/scene";
import { SCENE_HATERS, SCENE_HOST_LINES, SCENE_MOVES, sceneMove } from "@/lib/sceneContent";
import { openPlace, sceneView, type CollectResult, type SceneRaw, type SceneView, type StartResult } from "@/lib/sceneView";
import { memoryOf } from "@/lib/memoryServer";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { getServerSupabase } from "@/lib/supabase/server";

// Your Scene (migration 0171; lib/scene.ts). The server reads the player's standing (scene_context) and memory (who a
// move is for), rolls a sneak attempt with a crypto random source, and calls the service-role functions, which check the
// place, hours, slots, rank, Energy and bank again and pay.

type Admin = NonNullable<ReturnType<typeof getAdminSupabase>>;
type R<T> = { ok: true; data: T } | { ok: false; error: string };

const rng = () => randomInt(0, 2 ** 32) / 2 ** 32;

const ERRORS: Record<string, string> = {
  rate_limited: "Slow down a little.",
  no_player: "Create your character first.",
  bad_move: "That move isn't on any more.",
  not_here: "You have to be there to do that.",
  closed_now: "Closed right now. Come back when it opens.",
  in_holding: "You're in holding. The scene can wait.",
  banned_here: "You're banned from here for now.",
  not_yet: "You're not on the list for that one yet.",
  no_slot: "Every slot is busy. Collect a move first.",
  running: "You've already got that one going.",
  bounced_today: "They know your face tonight. Try again tomorrow.",
  no_energy: "Not enough Energy. Rest first.",
  cant_afford: "Not enough in the bank.",
  bad_entry: "Something went wrong. Try again.",
  no_move: "That move's gone.",
  no_hype: "Nothing to hype right now.",
  too_soon: "You just hyped it. Give it an hour.",
  not_ready: "It's not ready yet.",
  no_hater: "Nobody's coming for that one.",
  dealt: "You already dealt with that.",
  no_vouch: "No regular can vouch for you this week.",
  no_plaque: "Collect it ten times first.",
  has_residency: "You've already got a residency going.",
  no_residency: "No residency right now.",
  done: "Already checked in today.",
  not_crew: "Only your crew can hype that.",
  hyped: "You already hyped that one.",
};
const codeOf = (m: string) => /^([a-z_]+)/.exec(m)?.[1] ?? "unknown";
const err = (e: { message: string }, fn: string): string => {
  const code = codeOf(e.message);
  if (/scene_/.test(e.message) && /does not exist/.test(e.message)) return "Run migration 0171 to open Your Scene.";
  if (!ERRORS[code]) console.error(`${fn} failed`, e);
  return ERRORS[code] ?? "Something went wrong. Try again.";
};

async function who(): Promise<{ id: string; admin: Admin } | { error: string }> {
  const supabase = await getServerSupabase();
  const admin = getAdminSupabase();
  if (!supabase || !admin) return { error: "Accounts aren't switched on yet." };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in first." };
  return { id: user.id, admin };
}

async function raw(w: { id: string; admin: Admin }): Promise<SceneRaw | { error: string }> {
  const { data, error } = await w.admin.rpc("scene_context", { p_player: w.id });
  if (error) return { error: err(error, "scene_context") };
  if (!data) return { error: ERRORS.no_player };
  return data as SceneRaw;
}

async function view(w: { id: string; admin: Admin }): Promise<R<SceneView>> {
  const [r, memory] = await Promise.all([raw(w), memoryOf(w.admin, w.id)]);
  if ("error" in r) return { ok: false, error: r.error };
  return { ok: true, data: sceneView(SCENE_MOVES, SCENE_HATERS, r, memory, w.id, Date.now(), 1, SCENE_HOST_LINES) };
}

export async function sceneState(): Promise<R<SceneView>> {
  const w = await who();
  if ("error" in w) return { ok: false, error: w.error };
  return view(w);
}

/** Starts a move where the player is: invited when they have the rank or money, else `way` tries to get them in. */
export async function sceneStart(move: string, way?: SneakWay["id"]): Promise<R<StartResult>> {
  const w = await who();
  if ("error" in w) return { ok: false, error: w.error };
  const m = sceneMove(move);
  if (!m) return { ok: false, error: ERRORS.bad_move };
  const [r, memory] = await Promise.all([raw(w), memoryOf(w.admin, w.id)]);
  if ("error" in r) return { ok: false, error: r.error };
  const ctx = { rank: r.rank, netWorth: r.netWorth, memory, today: r.today, open: openPlace(r.boroughs) };
  if (!fits(m, ctx)) return { ok: false, error: "That one isn't for you right now." };
  let args = { p_entry: "invited", p_bounced: false, p_extra: 0, p_integrity: 0, p_ban_hours: 0 };
  if (!needsOk(m, ctx)) {
    const s = SNEAK.find((x) => x.id === way);
    if (!s || !canSneak(m, ctx)) return { ok: false, error: ERRORS.not_yet };
    const bounced = rng() >= sneakOdds(s, r.skills);
    args = {
      p_entry: "sneak", p_bounced: bounced, p_extra: s.extra ? bribeOf(costFor(m, r.rank)) : 0,
      p_integrity: s.integrity, p_ban_hours: bounced ? s.banHours : 0,
    };
  }
  const { data, error } = await w.admin.rpc("scene_start", { p_player: w.id, p_move: move, ...args });
  if (error) return { ok: false, error: err(error, "scene_start") };
  const v = await view(w);
  if (!v.ok) return v;
  const d = data as { bounced: boolean; banHours?: number; id?: string };
  // Step 3 (migration 0173): trending moves pay 1.5×.
  if (!d.bounced && d.id && trendingFor(SCENE_MOVES, mondayOf(r.today)).includes(move)) {
    const { error: e3 } = await w.admin.rpc("scene_set_boost", { p_player: w.id, p_id: d.id, p_boost: TREND.boost });
    if (e3 && !/scene_set_boost/.test(e3.message)) console.error("scene_set_boost failed", e3);
  }
  // Step 2 (migration 0172): fame draws haters. The server decides whether one comes, who, and when it lands.
  if (!d.bounced && d.id && rng() < haterChance(r.rank, args.p_entry as "invited" | "sneak")) {
    const pool = hatersFor(SCENE_HATERS, r.rank);
    const h = pool[randomInt(0, pool.length)];
    const start = Date.now(), ready = start + m.hours * 3_600_000;
    if (h) {
      const { error: e2 } = await w.admin.rpc("scene_set_hater", { p_player: w.id, p_id: d.id, p_hater: h.id, p_at: new Date(haterAt(start, ready, rng())).toISOString(), p_cut: h.cut });
      if (e2 && !/scene_set_hater/.test(e2.message)) console.error("scene_set_hater failed", e2);
    }
  }
  return { ok: true, data: { bounced: d.bounced, banHours: d.banHours ?? 0, view: v.data } };
}

export async function sceneHype(id: string): Promise<R<SceneView>> {
  const w = await who();
  if ("error" in w) return { ok: false, error: w.error };
  const { error } = await w.admin.rpc("scene_hype", { p_player: w.id, p_id: id });
  if (error) return { ok: false, error: err(error, "scene_hype") };
  return view(w);
}

export async function sceneCollect(id: string): Promise<R<CollectResult>> {
  const w = await who();
  if ("error" in w) return { ok: false, error: w.error };
  const { data, error } = await w.admin.rpc("scene_collect", { p_player: w.id, p_id: id });
  if (error) return { ok: false, error: err(error, "scene_collect") };
  const v = await view(w);
  if (!v.ok) return v;
  return { ok: true, data: { ...(data as Omit<CollectResult, "view">), view: v.data } };
}

/** Deals with a hater: the server sets the price or pay from the rank and checks the regular who vouches. */
export async function sceneDeal(id: string, way: DealWay): Promise<R<SceneView>> {
  const w = await who();
  if ("error" in w) return { ok: false, error: w.error };
  const d = DEAL.find((x) => x.id === way);
  if (!d) return { ok: false, error: ERRORS.bad_entry };
  const r = await raw(w);
  if ("error" in r) return { ok: false, error: r.error };
  const npc = way === "vouch" ? r.vouchers?.[0] ?? null : null;
  if (way === "vouch" && (!npc || !r.vouchFree)) return { ok: false, error: ERRORS.no_vouch };
  const cash = way === "publicist" ? -publicistCost(r.rank) : way === "spill" ? teaCash(r.rank) : 0;
  const { error } = await w.admin.rpc("scene_deal", { p_player: w.id, p_id: id, p_way: way, p_npc: npc, p_cash: cash, p_integrity: d.integrity });
  if (error) return { ok: false, error: err(error, "scene_deal") };
  return view(w);
}

/** Hypes a crew member's (or partner's) move from anywhere. */
export async function sceneCrewHype(id: string): Promise<R<SceneView>> {
  const w = await who();
  if ("error" in w) return { ok: false, error: w.error };
  const { error } = await w.admin.rpc("scene_crew_hype", { p_player: w.id, p_id: id });
  if (error) return { ok: false, error: err(error, "scene_crew_hype") };
  return view(w);
}

/** Takes a week's residency for a move with its first plaque (migration 0173). */
export async function sceneResidencyTake(move: string): Promise<R<SceneView>> {
  const w = await who();
  if ("error" in w) return { ok: false, error: w.error };
  const { error } = await w.admin.rpc("scene_residency_take", { p_player: w.id, p_move: move });
  if (error) return { ok: false, error: err(error, "scene_residency_take") };
  return view(w);
}

/** Today's residency check-in. */
export async function sceneResidencyCheckin(): Promise<R<{ clout: number; view: SceneView }>> {
  const w = await who();
  if ("error" in w) return { ok: false, error: w.error };
  const { data, error } = await w.admin.rpc("scene_residency_checkin", { p_player: w.id });
  if (error) return { ok: false, error: err(error, "scene_residency_checkin") };
  const v = await view(w);
  if (!v.ok) return v;
  return { ok: true, data: { clout: (data as { clout: number }).clout, view: v.data } };
}
