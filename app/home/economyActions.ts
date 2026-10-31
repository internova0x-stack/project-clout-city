"use server";

import {
  economyError, type EconomyResult, type EconomyRow, type EconomyState, type GiftCandidate, type GiftInbox,
} from "@/lib/playerEconomy";
import { getServerSupabase } from "@/lib/supabase/server";

// The Player Economy (migration 0151): gifts, the weekly limits and Trades & gifts. The browser names a friend and a Shop
// item; the server checks who may send what and sets every price, cap and fee.

async function call<T>(fn: string, args: Record<string, unknown> = {}): Promise<EconomyResult<T>> {
  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, error: "Accounts aren't switched on yet." };
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return { ok: false, error: economyError(error.message) };
  return { ok: true, data: data as T };
}

export async function economyState() {
  return call<EconomyState>("economy_state");
}
export async function economySetOpen(open: boolean) {
  return call<EconomyState>("economy_set_open", { p_open: open });
}
export async function economyHistory() {
  return call<EconomyRow[]>("economy_history", { p_limit: 50 });
}
export async function giftCandidates() {
  return call<GiftCandidate[]>("gift_candidates");
}
export async function giftInbox() {
  return call<GiftInbox>("gift_inbox");
}
export async function giftSend(to: string, sku: string, message: string) {
  return call<{ id: number; cash: number }>("gift_send", { p_to: to, p_sku: sku, p_message: message.slice(0, 140) });
}
export async function giftAnswer(id: number, accept: boolean) {
  return call<{ status: string; back?: "item" | "cash" }>("gift_answer", { p_id: id, p_accept: accept });
}
