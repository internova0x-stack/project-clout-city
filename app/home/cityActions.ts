"use server";

import type { ItemOptions } from "@/lib/couture";
import type { Fit } from "@/lib/styles";
import { cityError, type CityResult, type Gain, type TripInfo, type VipEntry } from "@/lib/cityState";
import { loadCityState } from "@/lib/cityServer";
import type { LottoCard } from "@/lib/lotto";
import { getServerSupabase } from "@/lib/supabase/server";

// Server actions behind every city screen. Each calls one security-definer SQL
// function (which checks and applies the rules), then returns the fresh state.

async function run(fn: string, args: Record<string, unknown>, toGain?: (data: unknown) => Gain | undefined, toCard?: (data: unknown) => LottoCard): Promise<CityResult> {
  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, error: "Accounts aren't switched on yet." };
  let gain: Gain | undefined;
  let card: LottoCard | undefined;
  if (fn) {
    const { data, error } = await supabase.rpc(fn, args);
    if (error) {
      if (!/^[a-z_]+(:|$)/.test(error.message)) console.error(`${fn} failed`, error);
      return { ok: false, error: cityError(error.message) };
    }
    gain = toGain?.(data);
    card = toCard?.(data);
  }
  const state = await loadCityState(supabase);
  if (!state) return { ok: false, error: "The city isn't open on this server yet." };
  return { ok: true, state, gain, card };
}

const asGain = (d: unknown) => d as Gain;

export async function refreshCity() {
  return run("", {});
}
export async function doCityAction(placeId: string, actionId: string) {
  return run("do_action", { p_place: placeId, p_action: actionId }, asGain);
}
export async function attendExclusiveEvent(eventId: string) {
  return run("attend_exclusive_event", { p_event: eventId }, asGain);
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
// Skill perks (migration 0092).
export async function takeSkillGig(perkId: string) {
  return run("skill_gig_take", { p_perk: perkId });
}
export async function collectSkillGig(perkId: string) {
  return run("skill_gig_collect", { p_perk: perkId }, (d) => ({ cash: Number(d) }));
}
export async function acceptSkillInvite(perkId: string) {
  return run("skill_invite_accept", { p_perk: perkId }, (d) => ({ clout: Number(d) }));
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
export async function setItemOptions(itemId: number, options: ItemOptions) {
  return run("set_item_options", { p_item: itemId, p_options: options });
}
export async function travel(placeId: string, mode: string) {
  let trip: TripInfo | undefined;
  const r = await run("travel", { p_place: placeId, p_mode: mode }, (d) => {
    const x = d as { cash?: number; energy?: number; seconds?: number; line?: string | null; delay?: number; showtime?: boolean };
    // C4 (migration 0095): the server's own trip length (a line's delay included) and any showtime dancers.
    if (typeof x.seconds === "number") trip = { seconds: x.seconds, line: x.line ?? null, delay: x.delay ?? 0, showtime: !!x.showtime };
    return { cash: x.cash ?? 0, energy: x.energy ?? 0 } as Gain;
  });
  return r.ok ? { ...r, trip } : r;
}
export async function buyTransitPass(pass: string) {
  return run("buy_transit_pass", { p_pass: pass }, (d) => ({ cash: (d as { cash?: number }).cash ?? 0 }) as Gain);
}
export async function calendarAttend(eventId: string) {
  return run("calendar_attend", { p_event: eventId }, (d) => {
    const r = d as { clout?: number; mood?: number; cash?: number };
    return { clout: r.clout ?? 0, mood: r.mood ?? 0, cash: r.cash ?? 0 } as Gain;
  });
}
export async function buyGift() {
  return run("buy_gift", {}, (d) => ({ cash: (d as { cash?: number }).cash ?? 0 }) as Gain);
}
export async function watchShowtime() {
  return run("showtime_watch", {}, (d) => ({ clout: (d as { clout?: number }).clout ?? 0 }) as Gain);
}
export async function skipTrip() {
  return run("skip_trip", {}, (d) => ({ cash: (d as { cash?: number }).cash ?? 0 }) as Gain);
}
/** `fit` (migration 0109) switches the starter clothes; left out, the starter clothes stay as they are. */
export async function saveLook(itemIds: number[], covering: string, fit?: Fit | null) {
  return fit === undefined
    ? run("save_look", { p_items: itemIds, p_covering: covering })
    : run("save_look", { p_items: itemIds, p_covering: covering, p_fit: fit });
}
export async function rest(kind: "nap" | "sit") {
  return run("rest", { p_kind: kind }, (d) => {
    const r = d as { energy?: number; mood?: number };
    return { energy: r.energy ?? 0, mood: r.mood ?? 0 } as Gain;
  });
}
export async function barDrink(placeId: string) {
  return run("bar_drink", { p_place: placeId }, (d) => {
    const r = d as { cash?: number; energy?: number };
    return { cash: r.cash ?? 0, energy: r.energy ?? 0 } as Gain;
  });
}
export async function buyGroceries(placeId: string, bundleId: string) {
  return run("buy_groceries", { p_place: placeId, p_bundle: bundleId }, (d) => ({ cash: (d as { cash?: number }).cash ?? 0 }));
}
export async function cook() {
  return run("cook", {}, (d) => { const r = d as { energy?: number; taskCash?: number }; return r.taskCash ? { energy: r.energy ?? 0, cash: r.taskCash } : { energy: r.energy ?? 0 }; });
}
// v0.10 Lucky Star Lotto (migration 0032). The browser names a game; the server sets the price,
// checks the limits, draws the prize and, when the card is scratched, reveals and pays it.
const asCard = (d: unknown) => {
  const r = d as { id: number; game: string; prize?: number };
  return { id: Number(r.id), game: r.game, prize: r.prize };
};
export async function buyLottoCard(placeId: string, gameId: string, free: boolean) {
  return run("buy_lotto_card", { p_place: placeId, p_game: gameId, p_free: free }, undefined, asCard);
}
export async function scratchLottoCard(cardId: number) {
  return run("scratch_lotto_card", { p_card: cardId }, undefined, asCard);
}
export async function payBill(billId: number) {
  return run("pay_bill", { p_bill: billId });
}
// #19 clubs (migration 0046): the VIP door (the cover only when the player says pay) and the VIP bar.
export async function enterVip(placeId: string, pay: boolean): Promise<CityResult> {
  let vip: VipEntry | undefined;
  const r = await run("enter_vip", { p_place: placeId, p_pay: pay }, (d) => {
    vip = d as VipEntry;
    return { cash: (d as { cash?: number }).cash ?? 0 };
  });
  return r.ok ? { ...r, vip } : r;
}
export async function vipSeen(placeId: string) {
  return run("vip_seen", { p_place: placeId }, asGain);
}
export async function moveHome(homeId: string) {
  return run("move_home", { p_home: homeId }, (d) => ({ cash: (d as { cash?: number }).cash ?? 0 }));
}
export async function saveHomeLayout(layout: { id: string; x: number; z: number; rot: number }[]) {
  return run("save_home_layout", { p_layout: layout });
}
export async function setClockOffset(hours: number) {
  // 0049: staging only (the database also wants a Studio admin).
  if (process.env.VERCEL_ENV === "production") return { ok: false as const, error: "Not on the live site." };
  return run("dev_set_clock_offset", { p_hours: hours });
}
