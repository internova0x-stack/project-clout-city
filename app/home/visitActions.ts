"use server";

import { visitError, type VisitHome, type VisitKind, type VisitMessage, type VisitResult, type VisitRoom, type VisitState } from "@/lib/visits";
import { getServerSupabase } from "@/lib/supabase/server";

// Server actions behind having people over (supabase/migrations/0121). Each calls one SQL function, which checks who
// can be invited, the home's size, the day's limits, the window and blocks.

async function call<T>(fn: string, args: Record<string, unknown> = {}): Promise<VisitResult<T>> {
  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, error: "Accounts aren't switched on yet." };
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return { ok: false, error: visitError(error.message) };
  return { ok: true, data: data as T };
}

export async function visitState() { return call<VisitState>("visit_state"); }
export async function visitHost(kind: VisitKind, guests: string[], startsAt: string | null) {
  return call<VisitState>("visit_host", { p_kind: kind, p_guests: guests, p_starts_at: startsAt });
}
export async function visitEnd() { return call<VisitState>("visit_end"); }
export async function visitSendHome(playerId: string) { return call<VisitState>("visit_send_home", { p_player: playerId }); }
export async function visitAnswer(visitId: number, yes: boolean) { return call<VisitState>("visit_answer", { p_visit: visitId, p_yes: yes }); }
export async function visitArrive(visitId: number) { return call<VisitRoom>("visit_arrive", { p_visit: visitId }); }
export async function visitLeave(visitId: number) { return call<VisitState>("visit_leave", { p_visit: visitId }); }
export async function visitRoom(visitId: number, after: number) { return call<VisitRoom>("visit_room", { p_visit: visitId, p_after: after }); }
export async function visitHome(visitId: number) { return call<VisitHome>("visit_home", { p_visit: visitId }); }
export async function visitSay(visitId: number, body: string) { return call<VisitMessage>("visit_say", { p_visit: visitId, p_body: body }); }
