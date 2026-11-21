"use server";

import { randomInt } from "node:crypto";
import { CHARACTERS } from "@/lib/characters";
import { PLACES } from "@/lib/city";
import { memoryOf } from "@/lib/memoryServer";
import { SURPRISE, surpriseFor, surpriseOptions, type Surprise, type WeekRecap } from "@/lib/rewards";
import { fits, needsOk, onDay } from "@/lib/scene";
import { SCENE_MOVES } from "@/lib/sceneContent";
import { openPlace, type SceneRaw } from "@/lib/sceneView";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { getServerSupabase } from "@/lib/supabase/server";

// Credit for small progress and surprises (migration 0177, lib/rewards.ts). Halfway goals and the recap are the player's
// own calls; a surprise is rolled here with a crypto random source and paid by surprise_give (service role).

const rng = () => randomInt(0, 2 ** 32) / 2 ** 32;
const NIGHTLIFE = ["club", "lounge", "nightlife", "rooftop", "bar"];

/** Goals that just reached halfway (each pays a quarter of its reward early, once). */
export async function goalsHalfway(): Promise<{ id: string; clout: number }[]> {
  const supabase = await getServerSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("goals_halfway");
  if (error) {
    if (!/goals_halfway/.test(error.message)) console.error("goals_halfway failed", error);
    return [];
  }
  return (data ?? []) as { id: string; clout: number }[];
}

/** Last New York week (Monday to Sunday), or null when nothing happened. */
export async function weekRecap(): Promise<WeekRecap | null> {
  const supabase = await getServerSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("week_recap");
  if (error) {
    if (!/week_recap/.test(error.message)) console.error("week_recap failed", error);
    return null;
  }
  return (data ?? null) as WeekRecap | null;
}

/** Today's surprise, rolled once a New York day (about half of days get one). Null when today has none or was rolled. */
export async function surpriseCheck(): Promise<Surprise | null> {
  const supabase = await getServerSupabase();
  const admin = getAdminSupabase();
  if (!supabase || !admin) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: today, error: e0 } = await admin.rpc("surprise_today", { p_player: user.id });
  if (e0 || today) return null;
  const { data: ctx, error: e1 } = await admin.rpc("scene_context", { p_player: user.id });
  if (e1 || !ctx) return null;
  const r = ctx as SceneRaw;
  if (r.holding) return null;
  let pick: Surprise | null = null;
  if (rng() < SURPRISE.chance) {
    const place = PLACES.find((p) => p.id === r.at);
    const atNightlife = !!place?.tags?.some((t) => NIGHTLIFE.includes(t));
    // A celebrity's invite: a move they host today that the player could start (not running, not resting).
    const memory = await memoryOf(admin, user.id);
    const sc = { rank: r.rank, netWorth: r.netWorth, memory, today: r.today, open: openPlace(r.boroughs) };
    const busy = new Set([...r.moves.map((m) => m.move), ...r.rested]);
    const hosted = SCENE_MOVES.filter((m) => m.host && !busy.has(m.id) && onDay(m, r.today) && fits(m, sc) && needsOk(m, sc) && m.places.some(sc.open));
    const m = hosted.length ? hosted[randomInt(0, hosted.length)] : null;
    const host = m ? CHARACTERS.find((c) => c.id === m.host) : null;
    const where = m ? m.places.find(sc.open) ?? m.places[0] : null;
    const invite = m && host && where
      ? { move: m.id, title: m.title, place: where, placeName: PLACES.find((p) => p.id === where)?.name ?? where, host: host.name, face: host.portrait ?? null }
      : null;
    const kinds = surpriseOptions({ rank: r.rank, atNightlife, invite });
    pick = surpriseFor(kinds[randomInt(0, kinds.length)], r.rank, invite);
  }
  const { data: given, error: e2 } = await admin.rpc("surprise_give", {
    p_player: user.id, p_kind: pick?.kind ?? "none", p_cash: pick?.cash ?? 0, p_clout: pick?.clout ?? 0,
    p_energy: pick?.energy ?? 0, p_mood: pick?.mood ?? 0, p_payload: pick?.invite ? { move: pick.invite.move } : {},
  });
  if (e2) {
    if (!/surprise_/.test(e2.message)) console.error("surprise_give failed", e2);
    return null;
  }
  return given ? pick : null;
}
