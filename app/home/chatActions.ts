"use server";

import { chatError, type ChatResult, type ChatStatus, type ChatSummary, type ChatThread, type PlayerCard, type ReportReason } from "@/lib/chat";
import { getServerSupabase } from "@/lib/supabase/server";

// Server actions behind the Messages app and player cards. Each calls one SQL
// function (supabase/migrations/0010), which checks limits, blocks and the filter.

async function call<T>(fn: string, args: Record<string, unknown> = {}, map: (d: unknown) => T = (d) => d as T): Promise<ChatResult<T>> {
  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, error: "Accounts aren't switched on yet." };
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return { ok: false, error: chatError(error.message) };
  return { ok: true, data: map(data) };
}

export async function chatList() {
  return call<ChatSummary[]>("chat_list");
}
export async function chatThread(withId: string) {
  return call<ChatThread>("chat_thread", { p_with: withId });
}
export async function chatSend(to: string, body: string) {
  return call("chat_send", { p_to: to, p_body: body }, (d) => ({ left: Number((d as { left: number }).left) }));
}
export async function chatStatus() {
  return call<ChatStatus>("chat_status");
}
export async function chatBlock(playerId: string, on: boolean) {
  return call("chat_block", { p_player: playerId, p_on: on }, () => null);
}
export async function chatReport(playerId: string, messageId: number | null, reason: ReportReason, note: string) {
  return call("chat_report", { p_player: playerId, p_message: messageId, p_reason: reason, p_note: note }, () => null);
}
export async function playerCard(playerId: string) {
  return call<PlayerCard | null>("player_card", { p_player: playerId });
}

/** Analytics for the success metrics (one per player per day per name). Never fails the game. */
export async function track(name: "session" | "invite_shared" | "beat_shared" | "postcard_shared" | "crush_invite_shared") {
  const supabase = await getServerSupabase();
  if (!supabase) return;
  await supabase.rpc("track", { p_name: name });
}
