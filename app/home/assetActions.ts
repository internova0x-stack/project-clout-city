"use server";

import { assetError, type AssetKind, type AssetResult, type AssetSale, type AssetSalesState } from "@/lib/assetSales";
import type { GiftCandidate } from "@/lib/playerEconomy";
import { getServerSupabase } from "@/lib/supabase/server";

// The Player Economy, Phase 3 (migration 0153): business and property sales. The browser names an asset, a friend and a
// price; the server appraises, checks the band, the limits and the cooling-off, and moves every C$ and every key.

async function call<T>(fn: string, args: Record<string, unknown> = {}): Promise<AssetResult<T>> {
  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, error: "Accounts aren't switched on yet." };
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return { ok: false, error: assetError(error.message), off: /phase_off|does not exist|schema cache/i.test(error.message) };
  return { ok: true, data: data as T };
}

export async function assetSalesState() {
  return call<AssetSalesState>("asset_sales_state");
}
export async function assetBuyers() {
  return call<GiftCandidate[]>("asset_buyers");
}
export async function assetOffer(kind: AssetKind, id: string, buyer: string, price: number) {
  return call<AssetSale>("asset_sale_offer", { p_kind: kind, p_id: id, p_buyer: buyer, p_price: Math.round(price) });
}
export async function assetAnswer(id: number, accept: boolean) {
  return call<AssetSale>("asset_sale_answer", { p_id: id, p_accept: accept });
}
export async function assetCancel(id: number) {
  return call<AssetSale>("asset_sale_cancel", { p_id: id });
}
