// Creators and their links (spec section 21, step 1; migration 0087). Rules the Studio and the /c/<slug>
// route share with the server: slugs, codes, where a link lands, and the welcome gift's Shop items.

import { SHOP_ITEMS, type ShopItem } from "./city.ts";

export type Lands = "home" | "signup" | "news" | "shop" | "vip";
export const LANDS: { id: Lands; label: string }[] = [
  { id: "home", label: "The city (home)" },
  { id: "signup", label: "Sign-up, open" },
  { id: "news", label: "News: today's story" },
  { id: "shop", label: "The Shop" },
  { id: "vip", label: "VIP plans" },
];
export const landsLabel = (l: Lands) => LANDS.find((x) => x.id === l)?.label ?? l;

/** 12 or 24 months from a player's sign-up, or null for life (owner, Oct 18). */
export type Length = 12 | 24 | null;
export const LENGTHS: { months: Length; label: string }[] = [
  { months: 12, label: "12 months" },
  { months: 24, label: "24 months" },
  { months: null, label: "For life" },
];
export const lengthLabel = (m: Length) => (m === null ? "For life" : `${m} months`);

/** The rate presets: 20% for new creators, 30% for high performers; any rate from 0 to 50 by hand. */
export const RATE = { base: 20, high: 30, max: 50 } as const;
export const GIFT_DEFAULT = 500;
export const GIFT_MAX = 2000;

export interface CreatorLink {
  id: number;
  slug: string;
  label: string;
  lands: Lands;
  campaign: string | null;
  videoUrl: string | null;
  status: "active" | "retired";
  createdAt: string;
  clicks: number;
  signups: number;
  /** Migration 0088: players from this link who paid, and what they paid, in the period. */
  payers?: number;
  revenueCents?: number;
}
/** A creator's commission by state today (held inside the 45 days, payable, paid) and earned in the period. */
export interface Owed { heldCents: number; payableCents: number; paidCents: number; periodCents: number; periodNetCents: number }
export interface Creator {
  id: string;
  name: string;
  handle: string | null;
  email: string | null;
  code: string;
  rate: number;
  months: Length;
  giftCash: number;
  giftItem: string | null;
  status: "active" | "paused";
  termsAt: string | null;
  note: string | null;
  createdAt: string;
  clicks: number;
  signups: number;
  byCode: number;
  signupsAll: number;
  links: CreatorLink[];
  /** Migration 0088. */
  payers?: number;
  revenueCents?: number;
  /** Share of their players' payments refunded in the period (a flag above 20%). */
  refundRate?: number;
  owed?: Owed;
}

export interface DayPoint { date: string; clicks: number; signups: number; revenueCents: number; commissionCents?: number }
/** The Affiliates Overview (migration 0088). */
export interface AffiliatesOverview {
  days: number;
  today: string;
  totals: { clicks: number; signups: number; payers: number; revenueCents: number; netCents: number; commissionCents: number; heldCents: number; payableCents: number; paidCents: number };
  daily: DayPoint[];
  topCreators: { id: string; name: string; signups: number; revenueCents: number }[];
  topLinks: { id: number; slug: string; creator: string; clicks: number; signups: number }[];
}
export type CommissionState = "held" | "payable" | "paid";
/** One affiliate's page (migration 0088). The player list is admin-only. */
export interface CreatorPage {
  days: number;
  today: string;
  creator: { id: string; name: string; handle: string | null; code: string; rate: number; months: Length; status: "active" | "paused" };
  owed: Owed;
  funnel: { clicks: number; signups: number; movedIn: number; payers: number; vip: number };
  daily: DayPoint[];
  products: { sku: string; name: string; type: string | null; count: number; revenueCents: number }[];
  retention: Record<"d1" | "d7" | "d30", { cohort: number; returned: number }>;
  commissions: {
    id: number; kind: "sale" | "renewal" | "reversal"; sku: string | null; name: string | null; player: string | null; at: string;
    grossCents: number; feeCents: number; taxCents: number; netCents: number; feeEstimated: boolean; rate: number;
    commissionCents: number; payableOn: string; state: CommissionState;
  }[];
  players: { id: string; name: string; joinedAt: string; how: "link" | "code"; link: string | null; spendCents: number; commissionCents: number; lastSeen: string | null; until: string | null }[];
}

/** Commission on one payment, as the database works it out: rate × (price − Stripe's fee − tax), never below zero. */
export function commissionOn(grossCents: number, feeCents: number, taxCents: number, rate: number): { net: number; commission: number } {
  const net = Math.max(0, grossCents - feeCents - taxCents);
  return { net, commission: Math.round((net * rate) / 100) };
}
/** Refunds above this share of a creator's players' payments get a flag in the Studio. */
export const REFUND_FLAG = 20;
/** Days a commission is held before it can be paid, and the smallest payout. */
export const HOLD_DAYS = 45;
export const PAYOUT_MIN_CENTS = 5000;
export interface Affiliates { days: number; creators: Creator[] }

/** What the Studio sends to save a creator (the id is missing for a new one). */
export interface CreatorInput {
  id?: string;
  name: string;
  handle: string;
  email: string;
  code: string;
  rate: number;
  months: Length;
  giftCash: number;
  giftItem: string | null;
  status: "active" | "paused";
  termsAt: string;
  note: string;
}
export interface LinkInput {
  id?: number;
  creatorId: string;
  slug: string;
  label: string;
  lands: Lands;
  campaign: string;
  videoUrl: string;
}

/** A creator code as typed: letters and digits only, upper case. Null when it can't be one (3 to 16). */
export function normalizeCreatorCode(raw: string | null | undefined): string | null {
  const code = (raw ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return /^[A-Z0-9]{3,16}$/.test(code) ? code : null;
}

/** A link's slug as typed: lower case, spaces become hyphens. */
export function cleanSlug(raw: string): string {
  return raw.trim().toLowerCase().replace(/[\s_]+/g, "-").replace(/[^a-z0-9-]/g, "");
}

/** Why a slug can't be used, or null. Same rule as the database (2 to 40, a-z 0-9 and single hyphens inside). */
export function slugProblem(slug: string): string | null {
  if (slug.length < 2) return "At least 2 characters.";
  if (slug.length > 40) return "40 characters at most.";
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(slug)) return "Letters, numbers and hyphens; no hyphen at either end.";
  if (slug.includes("--")) return "One hyphen at a time.";
  return null;
}

export const creatorUrl = (origin: string, slug: string) => `${origin.replace(/\/+$/, "")}/c/${slug}`;

/** Where a link sends someone: guests to the city's front door (sign-up open for 'signup'), players to that screen. */
export function landingPath(lands: Lands, signedIn: boolean): string {
  if (!signedIn) return lands === "signup" ? "/?signup=1" : "/";
  return lands === "home" || lands === "signup" ? "/home" : `/home?open=${lands}`;
}

/** Shop items a creator can give as the welcome gift: fashion, sold for C$, never collector or reward-only pieces. */
export function giftItems(): ShopItem[] {
  return SHOP_ITEMS.filter((i) => i.category === "fashion" && !i.collector && !i.reward && i.price > 0);
}

/** Sign-ups per click, as a percent with one decimal, or null with no clicks. */
export function conversion(signups: number, clicks: number): number | null {
  return clicks > 0 ? Math.round((signups / clicks) * 1000) / 10 : null;
}

/** The creator page (/creator, migration 0089): a creator's own numbers. Counts only, never who their players are. */
export interface CreatorMe {
  name: string;
  handle: string | null;
  code: string;
  rate: number;
  months: Length;
  status: "active" | "paused";
  termsAt: string | null;
  giftCash: number;
  giftItem: string | null;
  owed: Owed;
  nextPayout: string;
  totals: { clicks: number; signups: number; payers: number; earnedCents: number };
  links: { slug: string; label: string; lands: Lands; status: "active" | "retired"; clicks: number; signups: number; payers: number; earnedCents: number }[];
  byCode: { signups: number; payers: number; earnedCents: number };
  daily: DayPoint[];
  byMonth: { month: string; earnedCents: number; payments: number }[];
  payouts: { period: string; totalCents: number; paidAt: string; method: string }[];
}

/** "Nov 1, if you have $50 payable by then" — or how far there is to go. */
export function payoutLine(payableCents: number, nextPayout: string, fmt: (c: number) => string): string {
  const when = new Date(`${nextPayout}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" });
  return payableCents >= PAYOUT_MIN_CENTS
    ? `${fmt(payableCents)} goes out on ${when}.`
    : `Payouts go out at the start of each month once you have ${fmt(PAYOUT_MIN_CENTS)} payable. ${fmt(PAYOUT_MIN_CENTS - Math.max(0, payableCents))} to go.`;
}
