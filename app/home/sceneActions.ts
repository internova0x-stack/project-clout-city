"use server";

import { randomInt } from "node:crypto";
import { SNEAK, bribeOf, canSneak, costFor, fits, needsOk, sneakOdds, type SneakWay } from "@/lib/scene";
import { SCENE_MOVES, sceneMove } from "@/lib/sceneContent";
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
  return { ok: true, data: sceneView(SCENE_MOVES, r, memory, w.id, Date.now()) };
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
  const d = data as { bounced: boolean; banHours?: number };
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
