"use server";

import { gossipError, type GossipFind, type GossipVia, type GossipResult, type GossipState } from "@/lib/gossip";
import { getServerSupabase } from "@/lib/supabase/server";

// Server actions behind neighborhood gossip (supabase/migrations/0035). Each calls one SQL function,
// which checks the rules; players only ever receive the pieces they've found.

export async function gossipState(): Promise<GossipState | null> {
  const supabase = await getServerSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("gossip_state");
  return error || !data ? null : (data as GossipState);
}
export async function gossipFind(placeId: string, via: GossipVia): Promise<GossipResult<GossipFind>> {
  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, error: "Accounts aren't switched on yet." };
  const { data, error } = await supabase.rpc("gossip_find", { p_place: placeId, p_via: via });
  return error ? { ok: false, error: gossipError(error.message) } : { ok: true, data: data as GossipFind };
}
export async function gossipShare(storyId: string, piece: number): Promise<GossipResult<number>> {
  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, error: "Accounts aren't switched on yet." };
  const { data, error } = await supabase.rpc("gossip_share", { p_story: storyId, p_piece: piece });
  return error ? { ok: false, error: gossipError(error.message) } : { ok: true, data: Number(data) };
}
