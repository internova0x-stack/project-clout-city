"use server";

import type { PlaceCounts, Presence } from "@/lib/meet";
import { chatError, type ChatMessage, type ChatResult, type ChatStatus, type ChatSummary, type ChatThread, type PlayerCard, type ReportReason } from "@/lib/chat";
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
  return call("chat_send", { p_to: to, p_body: body }, (d) => {
    const left = (d as { left: number | null }).left;
    return { left: left === null || left === undefined ? null : Number(left) };
  });
}
// Meeting players (migration 0047).
export async function chatReact(to: string, emoji: string) {
  return call<ChatMessage>("react_to", { p_to: to, p_emoji: emoji }, (d) => ({ ...(d as ChatMessage), mine: true }));
}
export async function chatSetMessagesFrom(who: "anyone" | "crew") {
  return call<"anyone" | "crew">("set_messages_from", { p_who: who });
}
export async function placePresence(placeId: string, floor: number) {
  return call<Presence>("place_presence", { p_place: placeId, p_floor: floor });
}
export async function placeCounts() {
  return call<PlaceCounts>("place_counts");
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

/** Insights (migration 0053): about once a minute while the game is open and visible. Never fails the game. */
export async function sessionPing() {
  const supabase = await getServerSupabase();
  if (!supabase) return;
  await supabase.rpc("session_ping").then(() => undefined, () => undefined);
}
