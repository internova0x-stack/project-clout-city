"use server";

import { partyError, type PartyInbox, type PartyMention, type PartyResult } from "@/lib/party";
import { getServerSupabase } from "@/lib/supabase/server";

// Server actions behind party keepsakes (supabase/migrations/0029): plus-ones, "Spotted at"
// mentions and the gossip opt-out. Each calls one SQL function, which checks the rules.

async function rpc(fn: string, args: Record<string, unknown> = {}): Promise<{ data: unknown; error: string | null }> {
  const supabase = await getServerSupabase();
  if (!supabase) return { data: null, error: "Accounts aren't switched on yet." };
  const { data, error } = await supabase.rpc(fn, args);
  return { data, error: error ? partyError(error.message) : null };
}

/** Null until migration 0029 runs, which keeps plus-ones and mentions hidden. */
export async function partyInbox(): Promise<PartyInbox | null> {
  const { data, error } = await rpc("party_inbox");
  return error || !data ? null : (data as PartyInbox);
}
export async function partyMentions(): Promise<PartyMention[] | null> {
  const { data, error } = await rpc("party_mentions");
  return error ? null : ((data ?? []) as PartyMention[]);
}
async function done(fn: string, args: Record<string, unknown>): Promise<PartyResult> {
  const { error } = await rpc(fn, args);
  return error ? { ok: false, error } : { ok: true };
}
export async function partyInvite(eventId: string, guestId: string) {
  return done("party_invite", { p_event: eventId, p_guest: guestId });
}
export async function partyRespond(eventId: string, yes: boolean) {
  return done("party_respond", { p_event: eventId, p_yes: yes });
}
export async function setNewsOptOut(out: boolean) {
  return done("set_news_opt_out", { p_out: out });
}
