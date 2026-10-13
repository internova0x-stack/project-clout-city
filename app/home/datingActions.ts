"use server";

import { datingError, type CrushStatus, type DateCandidate, type DatingInbox, type DatingResult } from "@/lib/dating";
import { getServerSupabase } from "@/lib/supabase/server";

// Server actions behind crushes and date nights. Each calls one SQL function
// (supabase/migrations/0011), which checks connections, blocks and limits.

async function call<T>(fn: string, args: Record<string, unknown> = {}, map: (d: unknown) => T = (d) => d as T): Promise<DatingResult<T>> {
  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, error: "Accounts aren't switched on yet." };
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return { ok: false, error: datingError(error.message) };
  return { ok: true, data: map(data) };
}

export async function datingInbox() {
  return call<DatingInbox>("dating_inbox");
}
export async function crushStatus(playerId: string) {
  return call<CrushStatus>("crush_status", { p_player: playerId });
}
export async function crushToggle(playerId: string, on: boolean) {
  return call<CrushStatus>("crush_toggle", { p_player: playerId, p_on: on });
}
export async function matchSeen(playerId: string) {
  return call("match_seen", { p_player: playerId }, () => null);
}
export async function dateCandidates() {
  return call<DateCandidate[]>("date_candidates");
}
export async function dateInvite(withId: string, kind: "place" | "event", target: string) {
  return call("date_invite", { p_with: withId, p_kind: kind, p_target: target }, () => null);
}
export async function dateRespond(dateId: number, yes: boolean) {
  return call("date_respond", { p_date: dateId, p_yes: yes }, () => null);
}
export async function dateCancel(dateId: number) {
  return call("date_cancel", { p_date: dateId }, () => null);
}
