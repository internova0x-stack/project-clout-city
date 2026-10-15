// v0.12 businesses (owner, Oct 15; docs/08 section 15): what a business pays, what it's worth and what's
// in its till. The numbers live in CITY_ECONOMY.businesses (the database reads the same seed); the
// server decides every purchase and payout (migration 0048), and these functions only display them.
// Dependency-free apart from the city catalog, so tests can import it.

import { CITY_ECONOMY } from "./city.ts";

export type BusinessDef = (typeof CITY_ECONOMY.businesses.list)[number];
export const BUSINESSES: readonly BusinessDef[] = CITY_ECONOMY.businesses.list;
const B = CITY_ECONOMY.businesses;

/** A business the player owns (business_state()). */
export interface OwnedBusiness {
  id: string;
  /** Upgrades bought, 0 to 3. */
  level: number;
  /** The startup after going public. */
  public: boolean;
  /** When the till was last emptied (ISO). */
  collectedAt: string;
}

export interface BusinessState {
  owned: OwnedBusiness[];
  /** The server's clock (ISO), so tills count from the same time as the server. */
  now: string;
  /** The highest rank reached (players.best_rank), for "Best: …" on the profile. */
  bestRank?: number;
}

export interface BusinessApi {
  state(): Promise<BusinessResult<BusinessState>>;
  buy(id: string): Promise<BusinessResult<{ cash: number }>>;
  upgrade(id: string): Promise<BusinessResult<{ cash: number; level: number }>>;
  /** Empties every till; what each paid. */
  collect(): Promise<BusinessResult<{ cash: number; paid: { id: string; cash: number }[] }>>;
  goPublic(): Promise<BusinessResult<{ cash: number }>>;
}
export type BusinessResult<T> = { ok: true; data: T } | { ok: false; error: string };

export function businessById(id: string): BusinessDef | undefined {
  return BUSINESSES.find((b) => b.id === id);
}

/** ×1.0 with no clout up to ×2.0 at 150,000: fame brings customers. */
export function hype(clout: number): number {
  return 1 + (B.hype.max - 1) * Math.min(1, Math.max(0, clout) / B.hype.clout);
}

export function payPerDay(b: BusinessDef, level: number): number {
  return Math.round(b.payPerDay * (1 + B.upgrade.pay * level));
}

export function upgradeCost(b: BusinessDef): number {
  return Math.round(b.price * B.upgrade.cost);
}

/** What a business is worth (counted in net worth). */
export function businessValue(b: BusinessDef, level: number, isPublic: boolean, clout: number): number {
  return Math.round(b.price * (1 + B.upgrade.value * level) * hype(clout) * (isPublic ? B.goPublic.times : 1));
}

/** Everything the player's businesses are worth. */
export function businessesValue(owned: OwnedBusiness[], clout: number): number {
  return owned.reduce((a, o) => {
    const b = businessById(o.id);
    return b ? a + businessValue(b, o.level, o.public, clout) : a;
  }, 0);
}

/** Cash in the till now: pay by the hour since the last collection, up to tillDays. */
export function tillNow(b: BusinessDef, level: number, collectedAt: string, now: string | number): number {
  const hours = Math.max(0, (new Date(now).getTime() - new Date(collectedAt).getTime()) / 3_600_000);
  return Math.floor(payPerDay(b, level) * Math.min(hours, B.tillDays * 24) / 24);
}

export function tillFull(collectedAt: string, now: string | number): boolean {
  return new Date(now).getTime() - new Date(collectedAt).getTime() >= B.tillDays * 86_400_000;
}

/** The next business to buy (they unlock in order), or null when you own them all. */
export function nextBusiness(owned: OwnedBusiness[]): BusinessDef | null {
  return BUSINESSES.find((b) => !owned.some((o) => o.id === b.id)) ?? null;
}

/** The startup can go public once it's fully upgraded and you have the clout. */
export function canGoPublic(owned: OwnedBusiness[], clout: number): boolean {
  const last = BUSINESSES[BUSINESSES.length - 1];
  const o = owned.find((x) => x.id === last.id);
  return !!o && !o.public && o.level >= 3 && clout >= B.goPublic.clout;
}

/** Player-facing text for the server's refusals (migration 0048). */
export function businessError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("business_locked")) return "Buy the one before it first. Empires go in order.";
  if (m.includes("cant_afford")) return "Not enough cash yet. Collect your tills or take a gig.";
  if (m.includes("already_owned")) return "You already own that one.";
  if (m.includes("max_level")) return "Fully upgraded. It can't get any fancier.";
  if (m.includes("not_owned")) return "You don't own that business.";
  if (m.includes("need_clout")) return `Investors want a famous founder: ${B.goPublic.clout.toLocaleString("en-US")} clout to go public.`;
  if (m.includes("already_public")) return "Already public. The bell only rings once.";
  if (m.includes("not_ready")) return "Upgrade the startup all the way before going public.";
  if (m.includes("unknown_business")) return "That business isn't for sale.";
  return "The deal fell through. Try again.";
}

export { money } from "./ranks.ts";
