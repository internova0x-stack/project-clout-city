"use server";

import { partyRoomError, type PartyMessage, type PartyRoomResult, type PartyRoomState } from "@/lib/partyRoom";
import { getServerSupabase } from "@/lib/supabase/server";

// Server actions behind the party room (v0.11, supabase/migrations/0038): check in and read the room,
// say something in the event chat, report a message. Each calls one SQL function, which checks the
// ticket, the doors, the venue, the word filter and blocks.

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<PartyRoomResult<T>> {
  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, error: "Accounts aren't switched on yet." };
  const { data, error } = await supabase.rpc(fn, args);
  return error ? { ok: false, error: partyRoomError(error.message) } : { ok: true, data: data as T };
}

export async function partyRoomState(eventId: string, after: number) {
  return rpc<PartyRoomState>("party_room", { p_event: eventId, p_after: after });
}
export async function partyRoomSay(eventId: string, body: string) {
  return rpc<PartyMessage>("party_say", { p_event: eventId, p_body: body });
}
export async function partyRoomReport(messageId: number, reason: "harassment" | "spam" | "inappropriate" | "other") {
  return rpc<null>("party_report", { p_message: messageId, p_reason: reason, p_note: "" });
}
