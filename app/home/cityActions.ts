"use server";

import { cityError, type CityResult, type Gain } from "@/lib/cityState";
import { loadCityState } from "@/lib/cityServer";
import { getServerSupabase } from "@/lib/supabase/server";

// Server actions behind every city screen. Each calls one security-definer SQL
// function (which checks and applies the rules), then returns the fresh state.

async function run(fn: string, args: Record<string, unknown>, toGain?: (data: unknown) => Gain | undefined): Promise<CityResult> {
  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, error: "Accounts aren't switched on yet." };
  let gain: Gain | undefined;
  if (fn) {
    const { data, error } = await supabase.rpc(fn, args);
    if (error) {
      if (!/^[a-z_]+$/.test(error.message)) console.error(`${fn} failed`, error);
      return { ok: false, error: cityError(error.message) };
    }
    gain = toGain?.(data);
  }
  const state = await loadCityState(supabase);
  if (!state) return { ok: false, error: "The city isn't open on this server yet." };
  return { ok: true, state, gain };
}

const asGain = (d: unknown) => d as Gain;

export async function refreshCity() {
  return run("", {});
}
export async function doCityAction(placeId: string, actionId: string) {
  return run("do_action", { p_place: placeId, p_action: actionId }, asGain);
}
export async function attendClubEvent(eventId: string) {
  return run("attend_event", { p_event: eventId }, asGain);
}
export async function acceptGig(offerId: number) {
  return run("accept_gig", { p_offer: offerId });
}
export async function collectGig(offerId: number) {
  return run("collect_gig", { p_offer: offerId }, (d) => ({ cash: Number(d) }));
}
export async function buyItem(sku: string, mode: "buy" | "rent") {
  return run("buy_item", { p_sku: sku, p_mode: mode }, asGain);
}
export async function sellItem(itemId: number) {
  return run("sell_item", { p_item: itemId }, (d) => ({ cash: Number(d) }));
}
export async function equipItem(itemId: number, on: boolean) {
  return run("equip_item", { p_item: itemId, p_on: on });
}
export async function payBill(billId: number) {
  return run("pay_bill", { p_bill: billId });
}
export async function saveHomeLayout(layout: { id: string; x: number; z: number; rot: number }[]) {
  return run("save_home_layout", { p_layout: layout });
}
export async function setClockOffset(hours: number) {
  return run("dev_set_clock_offset", { p_hours: hours });
}
