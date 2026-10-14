// The player's slice of the city (v0.3): today's tasks, gig offers, bills, owned
// items and what they've already done today, plus the rules the UI uses to
// explain why an action is unavailable. The server (supabase/migrations/0004)
// enforces every rule; these helpers only mirror them for display.
// Dependency-free so tests can import it.

import { CITY_ECONOMY, CLUB_EVENTS, itemBySku, type ClubEvent, type PlaceAction, type ShopItem } from "./city.ts";
import { ECONOMY } from "./economy.ts";
import { lottoError, type LottoCard, type LottoState } from "./lotto.ts";

export interface CityPlayer {
  id: string;
  bank_cash: number;
  clout: number;
  energy: number;
  mood: number;
  confidence: number;
  home_id: string | null;
  next_rent_due: string | null;
  /** When the next phone and car bills are issued (sync_player); missing in older rows. */
  next_phone_due?: string | null;
  next_car_due?: string | null;
  house_sku: string | null;
  car_sku: string | null;
  car_mode: "owned" | "rented" | null;
  purchases_count: number;
  /** v0.8 (migration 0025): where the player is, a place id; null (or missing) is home. */
  at_place?: string | null;
  /** v0.8 (migration 0027): meals in the fridge; missing until the migration runs. */
  fridge_meals?: number;
}

export interface DailyTask {
  id: number;
  slot: number;
  /** "gossip" (v0.11, migration 0036): action_id is "gossip-regular" (talk to the regular) or "gossip-overheard" (Listen in). */
  kind: "visit" | "eat" | "shift" | "hangout" | "event" | "gossip";
  place_id: string;
  action_id: string;
  reward: number;
  done_at: string | null;
}

export interface GigOffer {
  id: number;
  ny_date: string;
  tier: "side" | "pro" | "big";
  title: string;
  pay: number;
  energy: number;
  wait_minutes: number;
  confidence_req: number;
  accepted_at: string | null;
  ready_at: string | null;
  collected_at: string | null;
}

export interface Bill {
  id: number;
  kind: "rent" | "phone" | "car_rental" | "car_insurance";
  amount: number;
  due_date: string;
  status: "due" | "paid" | "forgiven";
  paid_at: string | null;
}

export interface PlayerItem {
  id: number;
  sku: string;
  category: ShopItem["category"];
  value: number;
  acquired: "bought" | "earned" | "collector";
  equipped: boolean;
}

export interface CityState {
  player: CityPlayer;
  /** New York date (YYYY-MM-DD) on the game clock. */
  today: string;
  tasks: DailyTask[];
  gigs: GigOffer[];
  bills: Bill[];
  items: PlayerItem[];
  /** Uses per place today. */
  visitsToday: Record<string, number>;
  /** v0.9 (migration 0031): activities used today, "place:action". Mood and Confidence come once a day
      per activity; missing before the migration, when they came once a day per place. */
  actionsToday?: string[];
  attendedToday: string[];
  /** Staging time travel: added to the real clock everywhere. */
  clockOffsetSeconds: number;
  devTools: boolean;
  /** Saved furniture positions at home (lib/rooms.ts LayoutEntry[]), or null for the default. */
  homeLayout: unknown;
  /** Studio-approved lines for the regulars live today (migration 0016): regular id → lines. */
  npcLines?: Record<string, string[]>;
  /** v0.8 rest at home (migration 0026): naps and sits used today. Missing until 0026 runs. */
  restToday?: { nap: number; sit: number };
  /** v0.10 Lucky Star Lotto (migration 0032): today's cards and the week's jackpot. Missing until 0032 runs. */
  lotto?: LottoState;
}

/** What changed after an action, for the reward toast. */
export interface Gain {
  cash?: number;
  clout?: number;
  energy?: number;
  mood?: number;
  confidence?: number;
  taskCash?: number;
}

export type CityResult = { ok: true; state: CityState; gain?: Gain; card?: LottoCard } | { ok: false; error: string };

/** Everything the city screens can ask the server to do. */
export interface CityApi {
  refresh(): Promise<CityResult>;
  doAction(placeId: string, actionId: string): Promise<CityResult>;
  attendEvent(eventId: string): Promise<CityResult>;
  acceptGig(offerId: number): Promise<CityResult>;
  collectGig(offerId: number): Promise<CityResult>;
  buyItem(sku: string, mode: "buy" | "rent"): Promise<CityResult>;
  sellItem(itemId: number): Promise<CityResult>;
  equipItem(itemId: number, on: boolean): Promise<CityResult>;
  /** v0.8 travel (migration 0025): go to a place (or "home") by walk, subway, taxi or car. */
  travel?(placeId: string, mode: import("./travel.ts").TravelMode): Promise<CityResult>;
  /** v0.7 Your Look (migration 0021): the worn clothes (one per slot) and the free headwear, saved at once. */
  saveLook?(itemIds: number[], covering: string): Promise<CityResult>;
  /** v0.8 rest at home (migration 0026): a nap or a sit, capped per day. */
  rest?(kind: RestKind): Promise<CityResult>;
  /** v0.8 a drink at a club or lounge bar (migration 0026): Energy for cash, no clout. */
  barDrink?(placeId: string): Promise<CityResult>;
  /** v0.8 groceries (migration 0027): a bundle at the supermarket you're at, into the fridge. */
  buyGroceries?(placeId: string, bundleId: string): Promise<CityResult>;
  /** v0.8 cook a meal at home from the fridge. */
  cook?(): Promise<CityResult>;
  /** v0.10 Lucky Star Lotto (migration 0032): buy a card (the server draws its prize), then scratch it
      (the server reveals and pays it). The answer's `card` carries the id, then the prize. */
  buyLottoCard?(placeId: string, gameId: string, free: boolean): Promise<CityResult>;
  scratchLottoCard?(cardId: number): Promise<CityResult>;
  payBill(billId: number): Promise<CityResult>;
  setClockOffset(hours: number): Promise<CityResult>;
  saveHomeLayout(layout: { id: string; x: number; z: number; rot: number }[]): Promise<CityResult>;
  /** v0.5: an exclusive event the player has a ticket for (Mood and Confidence; clout came with the ticket). */
  attendExclusiveEvent?(eventId: string): Promise<CityResult>;
}

// ---------------------------------------------------------------------------
// Error codes raised by the SQL functions, in the game's voice.
// ---------------------------------------------------------------------------
const ERRORS: Record<string, string> = {
  one_per_slot: "One top, one bottom, one pair of shoes. You're not a closet.",
  bad_covering: "That hat isn't in the city yet.",
  no_energy: "Not enough Energy. Eat something, or sleep it off until tomorrow.",
  cant_afford: "Your card got declined. Loudly.",
  doors_closed: "Doors aren't open yet. The bouncer is pretending not to see you.",
  already_attended: "You already went tonight. Twice would be desperate.",
  gig_active: "Finish your current gig first.",
  needs_confidence: "This client wants more Confidence than you've got right now.",
  needs_clout: "This client googled you. Come back with more clout.",
  not_here: "You're not there yet. Go there first.",
  too_far_to_walk: "That's too far to walk. Your shoes have filed a complaint.",
  not_home: "Go home first. Your bed and your kitchen are both there.",
  rested_out: "You've rested enough for today. The couch needs a break from you.",
  bad_rest: "That isn't a way to rest.",
  fridge_full: "Your fridge is full. Eat something first, or play fridge Tetris.",
  fridge_empty: "The fridge is empty. The light still works, though.",
  unknown_bundle: "That isn't on the shelves.",
  full_energy: "You're already at full Energy. Save it for later.",
  no_car: "You don't have a car. The Shop has some, and so does the subway.",
  unknown_place: "That place isn't on the map.",
  gig_expired: "That offer expired at midnight.",
  not_ready: "Not done yet. Good work takes time; so does mediocre work.",
  already_owned: "You already own that. Calm down.",
  already_own_house: "You already own a house. One mortgage-free life at a time.",
  already_own_car: "You already own a car. Parking one is hard enough.",
  already_renting: "You're already renting a car.",
  not_rentable: "That can't be rented.",
  not_wearable: "You can't wear that. You could try, but no.",
  real_money_only: "That piece is real cash only.",
  not_sellable: "Collector pieces can't be sold.",
  not_on_list: "You're not on the list. The door person checked twice.",
  dev_tools_off: "Time travel is switched off here.",
  bad_layout: "That arrangement didn't save. Try again.",
  unknown_action: "That isn't something you can do here.",
  event_cancelled: "That one's cancelled. The whole city's talking about why.",
  unknown_item: "That isn't in stock.",
};

export function cityError(message: string | undefined): string {
  // Story closures carry their reason (World State): "place_closed: Crime scene. Pier closed."
  const story = message?.match(/place_(?:closed|restricted): (.+)/);
  if (story) return story[1].trim();
  const lotto = lottoError(message);
  if (lotto) return lotto;
  if (message) for (const code of Object.keys(ERRORS)) if (message.includes(code)) return ERRORS[code];
  return "The city glitched. Try again.";
}

// ---------------------------------------------------------------------------
// Display rules
// ---------------------------------------------------------------------------
export type Availability = { ok: true; note?: string } | { ok: false; reason: string };

/** Mood and Confidence already collected today: per activity (0031), or per place before it. */
export function boostUsed(placeId: string, actionId: string, s: CityState): boolean {
  return s.actionsToday ? s.actionsToday.includes(`${placeId}:${actionId}`) : (s.visitsToday[placeId] ?? 0) > 0;
}

/** Mirrors do_action: Energy first (meals always work), then cash. Repeat visits are allowed but pay no clout. */
export function actionAvailability(placeId: string, action: PlaceAction, s: CityState): Availability {
  if (action.kind === "gigs") return { ok: true };
  if (action.energy > 0 && s.player.energy < action.energy) return { ok: false, reason: "Not enough Energy" };
  if ((action.price ?? 0) > s.player.bank_cash) return { ok: false, reason: "Not enough cash" };
  const usedToday = (s.visitsToday[placeId] ?? 0) > 0;
  if (usedToday && (action.kind === "visit" || action.kind === "eat")) return { ok: true, note: "Clout again tomorrow" };
  if (boostUsed(placeId, action.id, s) && (action.mood || action.confidence)) return { ok: true, note: "Mood boost again tomorrow" };
  return { ok: true };
}

export function eventAvailability(ev: ClubEvent, open: boolean, s: CityState): Availability {
  if (s.attendedToday.includes(ev.id)) return { ok: false, reason: "You went today. Back tomorrow." };
  if (!open) return { ok: false, reason: "Doors closed" };
  if (s.player.energy < CITY_ECONOMY.energy.eventCost) return { ok: false, reason: "Not enough Energy" };
  if (s.player.bank_cash < ev.entry) return { ok: false, reason: "Not enough cash" };
  return { ok: true };
}

export type RestKind = "nap" | "sit";

/** Mirrors rest(): home only, capped per New York day. */
export function restAvailability(kind: RestKind, s: CityState): Availability & { used: number; perDay: number } {
  const r = CITY_ECONOMY.rest[kind];
  const used = s.restToday?.[kind] ?? 0;
  const base = { used, perDay: r.perDay };
  if ((s.player.at_place ?? null) !== null) return { ok: false, reason: "Go home first", ...base };
  if (used >= r.perDay) return { ok: false, reason: "Rested out for today. Back tomorrow.", ...base };
  return { ok: true, ...base };
}

/** Places with a bar that sells drinks (clubs and the lounge). */
export const hasBar = (tags: string[]) => tags.some((t) => (CITY_ECONOMY.barDrink.tags as readonly string[]).includes(t));

export function barDrinkAvailability(s: CityState): Availability {
  if (s.player.energy >= 100) return { ok: false, reason: "You're already at full Energy" };
  if (s.player.bank_cash < CITY_ECONOMY.barDrink.price) return { ok: false, reason: "Not enough cash" };
  return { ok: true };
}

export type GroceryBundle = (typeof CITY_ECONOMY.groceries.bundles)[number];

/** Supermarkets sell grocery bundles. */
export const isSupermarket = (tags: string[]) => tags.some((t) => (CITY_ECONOMY.groceries.tags as readonly string[]).includes(t));

/** Mirrors buy_groceries: the bundle has to fit in the fridge, then cash. */
export function groceryAvailability(b: GroceryBundle, s: CityState): Availability {
  const room = CITY_ECONOMY.groceries.fridgeMax - (s.player.fridge_meals ?? 0);
  if (b.meals > room) return { ok: false, reason: room ? `Your fridge only has room for ${room} more` : "Your fridge is full" };
  if (s.player.bank_cash < b.price) return { ok: false, reason: "Not enough cash" };
  return { ok: true };
}

/** Mirrors cook(): home only, a meal in the fridge, and room for Energy. */
export function cookAvailability(s: CityState): Availability {
  if ((s.player.at_place ?? null) !== null) return { ok: false, reason: "Go home first" };
  if (!s.player.fridge_meals) return { ok: false, reason: "The fridge is empty" };
  if (s.player.energy >= 100) return { ok: false, reason: "You're already at full Energy" };
  return { ok: true };
}

/** Clout a gig tier needs (v0.7): pro gigs 500, big breaks 2,000 (CITY_ECONOMY.gigs). */
export const gigCloutReq = (tier: GigOffer["tier"]) => CITY_ECONOMY.gigs[tier].clout;

export function gigAvailability(g: GigOffer, s: CityState): Availability {
  const clout = gigCloutReq(g.tier);
  if (s.player.clout < clout) return { ok: false, reason: `Needs ${clout.toLocaleString()} clout (you have ${s.player.clout.toLocaleString()})` };
  if (s.player.confidence < g.confidence_req) return { ok: false, reason: `Needs Confidence ${g.confidence_req} (you have ${s.player.confidence})` };
  if (activeGig(s)) return { ok: false, reason: "Finish your current gig first" };
  if (s.player.energy < g.energy) return { ok: false, reason: "Not enough Energy" };
  return { ok: true };
}

export function activeGig(s: CityState): GigOffer | undefined {
  return s.gigs.find((g) => g.accepted_at && !g.collected_at);
}

export function gigReady(g: GigOffer, nowMs: number): boolean {
  return !!g.ready_at && new Date(g.ready_at).getTime() <= nowMs;
}

export interface UpcomingBill { kind: Bill["kind"]; amount: number; due_date: string }

/** The next bill of each kind that isn't issued yet, with its amount and date (#22), soonest first. */
export function upcomingBills(s: CityState): UpcomingBill[] {
  const p = s.player;
  const out: UpcomingBill[] = [];
  const rent = ECONOMY.homes.find((h) => h.id === p.home_id)?.rent;
  if (!p.house_sku && p.next_rent_due && rent) out.push({ kind: "rent", amount: rent, due_date: p.next_rent_due });
  if (p.next_phone_due) out.push({ kind: "phone", amount: CITY_ECONOMY.bills.phone, due_date: p.next_phone_due });
  const car = p.car_sku ? itemBySku(p.car_sku) : undefined;
  if (car && p.next_car_due) {
    out.push(p.car_mode === "rented"
      ? { kind: "car_rental", amount: car.rentPerWeek ?? 0, due_date: p.next_car_due }
      : { kind: "car_insurance", amount: Math.ceil(car.price * CITY_ECONOMY.bills.carInsuranceRate), due_date: p.next_car_due });
  }
  return out.sort((a, b) => a.due_date.localeCompare(b.due_date));
}

/** Days between bills ("7 days" in config since v0.8; "1 month" reads as 30). */
export function billPeriodDays(): number {
  const [n, unit] = CITY_ECONOMY.bills.every.split(" ");
  return Number(n) * (unit.startsWith("month") ? 30 : unit.startsWith("week") ? 7 : 1);
}

/** How far through its billing period a coming bill is, 0 (just paid) to 1 (due today). */
export function billProgress(b: UpcomingBill, today: string): number {
  const period = b.kind === "car_rental" ? CITY_ECONOMY.bills.carRentalDays : billPeriodDays();
  const left = daysBetween(today, b.due_date);
  return Math.min(1, Math.max(0, 1 - left / period));
}

export function dueBills(s: CityState): Bill[] {
  return s.bills.filter((b) => b.status === "due").sort((a, b) => a.due_date.localeCompare(b.due_date));
}

/** Days between two YYYY-MM-DD dates (b - a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

export function billStatusLine(bill: Bill, today: string): string {
  const late = daysBetween(bill.due_date, today);
  const { graceDays, evictAfterDays } = CITY_ECONOMY.bills;
  if (late < 0) return `Due in ${-late} day${late === -1 ? "" : "s"}`;
  if (late === 0) return "Due today";
  if (bill.kind !== "rent") return `${late} day${late === 1 ? "" : "s"} late`;
  if (late <= graceDays) return `${late} day${late === 1 ? "" : "s"} late. Grace period: ${graceDays - late + 1} left before Mood drops.`;
  return `${late} days late. Mood is dropping; you move out in ${Math.max(0, evictAfterDays - late)} day${evictAfterDays - late === 1 ? "" : "s"}.`;
}

export function netWorth(s: CityState): number {
  return s.player.bank_cash + s.items.reduce((a, i) => a + i.value, 0);
}

export function ownedSkus(s: CityState): Set<string> {
  return new Set(s.items.map((i) => i.sku));
}

export function equippedItems(s: CityState): ShopItem[] {
  return s.items.filter((i) => i.equipped).map((i) => itemBySku(i.sku)).filter((i): i is ShopItem => !!i);
}

export function tasksDone(s: CityState): number {
  return s.tasks.filter((t) => t.done_at).length;
}

export function eventById(id: string): ClubEvent | undefined {
  return CLUB_EVENTS.find((e) => e.id === id);
}
