"use server";

import {
  marketError, type ClosetItem, type MarketPerson, type MarketResult, type MarketState, type MarketTrade,
} from "@/lib/marketplace";
import { getServerSupabase } from "@/lib/supabase/server";

// The Player Economy, Phase 2 (migration 0152): the Market's listings and the trade window. The browser names items, a
// price and a person; the server checks the band, the escrow, the weekly limits and the holds, and moves everything.

async function call<T>(fn: string, args: Record<string, unknown> = {}): Promise<MarketResult<T>> {
  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, error: "Accounts aren't switched on yet." };
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return { ok: false, error: /function .* does not exist|schema cache/i.test(error.message) ? "The Market opens with migration 0152." : marketError(error.message) };
  return { ok: true, data: data as T };
}

const ids = (xs: unknown) => (Array.isArray(xs) ? xs.filter((x) => Number.isInteger(x)).slice(0, 8) : []) as number[];
const cs = (n: unknown) => (typeof n === "number" && Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0);

export async function marketState() {
  return call<MarketState>("market_state");
}
export async function marketPeople() {
  return call<MarketPerson[]>("market_people");
}
export async function marketCloset(player: string) {
  return call<ClosetItem[]>("market_closet", { p_player: player });
}
export async function marketList(item: number, price: number) {
  return call<{ id: number; fee: number }>("market_list", { p_item: item, p_price: cs(price) });
}
export async function marketCancel(id: number) {
  return call<unknown>("market_cancel", { p_id: id });
}
export async function marketBuy(id: number, sure: boolean) {
  return call<{ id: number; cash: number }>("market_buy", { p_id: id, p_sure: !!sure });
}
export async function tradeOffer(to: string, mine: number[], theirs: number[], cashMine: number, cashTheirs: number) {
  return call<MarketTrade>("trade_offer", { p_to: to, p_mine: ids(mine), p_theirs: ids(theirs), p_cash_mine: cs(cashMine), p_cash_theirs: cs(cashTheirs) });
}
export async function tradeEdit(id: number, version: number, mine: number[], theirs: number[], cashMine: number, cashTheirs: number) {
  return call<MarketTrade>("trade_edit", { p_id: id, p_version: version, p_mine: ids(mine), p_theirs: ids(theirs), p_cash_mine: cs(cashMine), p_cash_theirs: cs(cashTheirs) });
}
export async function tradeConfirm(id: number, version: number, sure: boolean) {
  return call<MarketTrade>("trade_confirm", { p_id: id, p_version: version, p_sure: !!sure });
}
export async function tradeCancel(id: number) {
  return call<MarketTrade>("trade_cancel", { p_id: id });
}
export async function marketSetOpen(open: boolean) {
  return call<unknown>("economy_set_open", { p_open: !!open });
}
