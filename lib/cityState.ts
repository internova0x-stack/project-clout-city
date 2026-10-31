// The player's slice of the city (v0.3): today's tasks, gig offers, bills, owned
// items and what they've already done today, plus the rules the UI uses to
// explain why an action is unavailable. The server (supabase/migrations/0004)
// enforces every rule; these helpers only mirror them for display.
// Dependency-free so tests can import it.

import { CITY_ECONOMY, CLUB_EVENTS, itemBySku, placeById, type ClubEvent, type PlaceAction, type ShopItem } from "./city.ts";
import { leadAction } from "./gossip.ts";
import { LOOK_LABEL } from "./style.ts";
import { PERK_ERRORS, SKILLS, type SkillId } from "./skills.ts";
import { ECONOMY, formatCash } from "./economy.ts";
import type { Fit } from "./styles.ts";
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
  /** #19 (migration 0045): moved to a dearer home at least once (the early goal); missing until it runs. */
  moved_up?: boolean;
  /** C4 (migration 0095): when the player's OMG Card runs out (subway rides are free until then); missing before it runs. */
  transit_pass_until?: string | null;
  /** Living together (migration 0149): my part of the weekly rent (0 in a partner's house); null or missing when I live alone. */
  rent_part?: number | null;
}

/** C4: what the server says about a trip it just started: its real length (a delay included) and any showtime. */
export interface TripInfo { seconds: number; line: string | null; delay: number; showtime: boolean }

/** Migration 0100: "Wear a full <line> look to <place>", done only while that look is worn. */
export type StyleTaskKind = `style:${string}`;

export interface DailyTask {
  id: number;
  slot: number;
  /**
   * "gossip" (v0.11, migration 0036): action_id is "gossip-regular" (talk to the regular), "gossip-overheard"
   * (Listen in) or, #19, "gossip-restroom" (Listen in downstairs in a club's restroom).
   */
  kind: "visit" | "eat" | "shift" | "hangout" | "event" | "gossip" | "cook" | "class" | StyleTaskKind;
  place_id: string;
  action_id: string;
  reward: number;
  done_at: string | null;
  /** Migration 0063: the skill this task levels up (one task a day), or null. Cooking tasks are at "home". */
  skill?: SkillId | null;
  /** Migration 0073: the goal this task was picked for (lib/goals.ts), or null. */
  goal?: string | null;
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
  /** Clout Couture's choices (migration 0103): the crown or a tiara, the suit's cloth, lining and monogram. */
  options?: import("./couture.ts").ItemOptions;
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
  /** C2: different New York days the player has done something at a place (Sal remembers your order after 3). */
  regularDays?: Record<string, number>;
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
  /** Skill perks (migration 0092): levels, this week's skill gigs and accepted invites. Missing until 0092 runs. */
  perks?: import("./skills.ts").PerksState;
  /** C5 (migration 0096): calendar events this player went to, and gift boxes held. Missing until 0096 runs. */
  calendar?: import("./calendar.ts").CalendarState;
  /** The Shop Manager (migration 0099): what's on sale, with pictures; undefined before 0099 (the Shop uses the code's list). */
  catalog?: import("./shopCatalog.ts").CatalogItem[];
  /** Migration 0100: pieces worn per style line, full looks, today's venue boost. Missing until 0100 runs. */
  style?: StyleState;
}

/** style_state() (migration 0100). */
export interface StyleState { counts: Record<string, number>; full: string[]; boost: { line: string; place: string } | null }

/** What changed after an action, for the reward toast. */
export interface Gain {
  cash?: number;
  clout?: number;
  energy?: number;
  mood?: number;
  confidence?: number;
  taskCash?: number;
}

/** #19 clubs (migration 0046): the VIP door. `needsCover`: what it costs today (nothing paid yet). */
export interface VipEntry { access?: "free" | "paid" | "pass" | "skill"; needsCover?: number }

export type CityResult = { ok: true; state: CityState; gain?: Gain; card?: LottoCard; vip?: VipEntry; trip?: TripInfo } | { ok: false; error: string };

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
  /** Clout Couture (migration 0103): a piece's choices (crown or tiara; the suit's cloth, lining and monogram). */
  setItemOptions?(itemId: number, options: import("./couture.ts").ItemOptions): Promise<CityResult>;
  /** v0.8 travel (migration 0025): go to a place (or "home") by walk, subway, taxi or car. */
  travel?(placeId: string, mode: import("./travel.ts").TravelMode): Promise<CityResult>;
  /** C4 (migration 0095): buy a 7- or 30-day OMG Card; watch the showtime dancers on this ride. */
  buyTransitPass?(pass: string): Promise<CityResult>;
  /** C5 (migration 0096): go to a calendar event; buy a gift box for a name-day party. */
  calendarAttend?(eventId: string): Promise<CityResult>;
  buyGift?(): Promise<CityResult>;
  watchShowtime?(): Promise<CityResult>;
  /** #13 (migration 0040): end the current trip now, for virtual cash by seconds left. */
  skipTrip?(): Promise<CityResult>;
  /** v0.7 Your Look (migration 0021): the worn clothes (one per slot) and the free headwear, saved at once. */
  /** `fit` switches the starter clothes (migration 0109); left out, they stay as they are. */
  saveLook?(itemIds: number[], covering: string, fit?: Fit | null): Promise<CityResult>;
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
  /** #19 clubs (migration 0046): up to a club's VIP floor. Without `pay` it only says what the cover is. */
  enterVip?(placeId: string, pay: boolean): Promise<CityResult>;
  /** #19 clubs: "Get seen in VIP", once a day per club, twice the main floor's clout. */
  vipSeen?(placeId: string): Promise<CityResult>;
  /** #19 moving up (migration 0045): move into another rental from the Apartments app. */
  moveHome?(homeId: string): Promise<CityResult>;
  /** v0.5: an exclusive event the player has a ticket for (Mood and Confidence; clout came with the ticket). */
  attendExclusiveEvent?(eventId: string): Promise<CityResult>;
  /** Skill perks (migration 0092): take a skill gig (once a week), collect it, or accept an invite (once). */
  takeSkillGig?(perkId: string): Promise<CityResult>;
  collectSkillGig?(perkId: string): Promise<CityResult>;
  acceptSkillInvite?(perkId: string): Promise<CityResult>;
}

// ---------------------------------------------------------------------------
/** v0.11 (migration 0039): the shift cap's message, shared with the preview simulator. */
export const SHIFT_LIMIT = `That's ${CITY_ECONOMY.shiftsPerDay} shifts today, the most a body can take. Try a gig on the board, or come back tomorrow.`;

/** #19 (migration 0045): moving needs the home's clout. Shared with the preview simulator. */
export const HOME_NEEDS_CLOUT = "The landlord googled you. Come back with more clout.";

/** #19 clubs (migration 0046): the exclusive club's door rule and the VIP floor. Shared with the preview simulator. */
export const DOOR_CLOUT = "The bouncer looks you up, looks you over, and looks away. Come back with more clout.";
export const VIP_LOCKED = "VIP is upstairs, behind a rope and a person who takes the rope very seriously.";
export const VIP_ALREADY = "You've been seen in VIP tonight. Being seen twice is just loitering.";

/** #19: the clout the bouncer wants, and the VIP terms, for a club. */
export function clubDoor(place: { club?: { vip?: "medium" | "exclusive"; doorClout?: number } }) {
  const vip = place.club?.vip ? CITY_ECONOMY.clubs.vip[place.club.vip] : null;
  return { doorClout: place.club?.doorClout ?? 0, vip };
}

/** Daily tasks 2.0 (migration 0073): streak rewards can't be bought or sold. Shared with the preview simulator. */
export const REWARD_ONLY = "Not for sale. This one is earned with a streak of full task days.";
export const REWARD_KEEP = "Streak rewards are yours for keeps. No resale, no regrets.";

/** #9 (migration 0043): a fantasy outfit above the player's clout. Shared with the preview simulator. */
export const OUTFIT_NEEDS_CLOUT = "The fitting room won't even let you in yet. Earn more clout first.";

// Error codes raised by the SQL functions, in the game's voice.
// ---------------------------------------------------------------------------
const ERRORS: Record<string, string> = {
  one_per_slot: "One top, one bottom, one pair of shoes. You're not a closet.",
  bad_covering: "That hat isn't in the city yet.",
  bad_fit: "That isn't one of your starter pieces.",
  // Saving starter clothes before migration 0109 (the RPC names the missing parameter).
  p_fit: "Switching starter clothes isn't on yet. Run migration 0109.",
  no_energy: "Not enough Energy. Eat something, or sleep it off until tomorrow.",
  shift_limit: SHIFT_LIMIT,
  cant_afford: "Your card got declined. Loudly.",
  door_clout: DOOR_CLOUT,
  vip_locked: VIP_LOCKED,
  no_vip: "This club doesn't have a VIP floor. Everyone here is equally important.",
  outfit_needs_clout: OUTFIT_NEEDS_CLOUT,
  home_needs_clout: HOME_NEEDS_CLOUT,
  own_house: "You own a house. Landlords are a thing of your past.",
  already_home: "You already live there. Unpack first.",
  rent_due: "Pay this week's rent before you move. Landlords talk.",
  // Daily tasks 2.0 (migration 0073): streak rewards and guest-list passes.
  reward_only: REWARD_ONLY,
  reward_unsellable: REWARD_KEEP,
  // The Player Economy (migration 0151): a gift can't go straight back to the game at 60%.
  no_resale: "Gifts stay with you for 14 days. No selling back, no regifting. It's the thought that counts.",
  no_pass: "No guest-list pass on you. Keep the streak going: day 14 brings one.",
  pass_used_tonight: "You're already on a guest list tonight. One velvet rope at a time.",
  pass_not_needed: "You can already get in there. Save the pass for a door that says no.",
  not_a_club: "Guest-list passes work at clubs. Nobody keeps a list at the deli.",
  borough_locked: "That borough isn't open yet. It opens once the city fills up, guest list or not.",
  // v0.15 Campus (migration 0072).
  dorm_students_only: "Dorms are for students. Enroll at that campus first: the RA checks.",
  not_enrolled: "Enroll here first. The registrar has a form. Of course it does.",
  transfer_wait: "Transfer paperwork takes a week. The registrar is on lunch.",
  already_enrolled: "You already go here. Your student ID agrees.",
  pick_courses: "Pick exactly three different courses.",
  unknown_course: "That course isn't in the catalog. Nice try, though.",
  schedule_locked: "You've already been to class this week. Your schedule is set until Monday.",
  not_your_course: "You're not taking that course this week.",
  already_in_class: "You already went to that class today. Overachiever.",
  exams_closed: "Exams open Friday. Until then, it's just vibes and attendance.",
  exam_taken: "You already took that exam. No retakes, no matter how nicely you ask.",
  bad_answers: "Answer all five questions first.",
  doors_closed: "Doors aren't open yet. The bouncer is pretending not to see you.",
  not_tonight: "No party tonight. Greek Row parties are Tuesday, Thursday, Friday and Saturday.",
  bad_subscription: "Your browser sent a strange subscription. Try turning notifications on again.",
  bad_category: "That notification setting doesn't exist.",
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
  bad_option: "That isn't one of the choices.",
  bad_monogram: "Up to three letters, A to Z.",
  monogram_not_allowed: "The tailor won't stitch that. Pick other initials.",
  no_options: "That piece has no choices to make.",
  already_renting: "You're already renting a car.",
  not_rentable: "That can't be rented.",
  not_wearable: "You can't wear that. You could try, but no.",
  real_money_only: "That piece is real cash only.",
  not_sellable: "Collector pieces can't be sold.",
  not_on_list: "You're not on the list. The door person checked twice.",
  dev_tools_off: "Time travel is switched off here.",
  still_travelling: "You're still on your way. Hang tight, or skip the rest of the ride.",
  closed_now: "Closed right now. The card says when they open.",
  // Moral Choices' lasting effects (migration 0132).
  banned_here: "You're banned here for now. They remember your face.",
  in_holding: "You're on the bench at the 114½ Precinct. Wait it out, or pay bail.",
  gigs_locked: "The gig board has you on a time-out. Check back in a day or two.",
  unknown_pass: "That pass isn't sold here.",
  no_showtime: "The dancers already got off. Showtime waits for no one.",
  unknown_event: "That isn't on the calendar.",
  not_now: "That's not happening right now. Check the date and time on the card.",
  already_went: "You already went. They're still talking about it.",
  no_gifts_here: "Gift boxes are at Sal's and Schlep & Schmear.",
  gifts_full: "You already have your hands full of gift boxes.",
  // The Shop Manager (migration 0099).
  not_for_sale: "That one isn't on sale right now.",
  not_wearable_yet: "That piece is coming soon to your wardrobe.",
  // Living together (migration 0149): couple pieces.
  couples_only: "That one's for couples. Make it official first, then come back and nest.",
  bad_layout: "That arrangement didn't save. Try again.",
  unknown_action: "That isn't something you can do here.",
  event_cancelled: "That one's cancelled. The whole city's talking about why.",
  unknown_item: "That isn't in stock.",
  no_player: "You've been signed out. Close the game, open it again and sign back in.",
};

export function cityError(message: string | undefined): string {
  // Story closures carry their reason (World State): "place_closed: Crime scene. Pier closed."
  const story = message?.match(/place_(?:closed|restricted): (.+)/);
  if (story) return story[1].trim();
  const lotto = lottoError(message);
  if (lotto) return lotto;
  if (message) for (const code of ["unknown_perk", "skill_locked", "gig_done_week"]) if (message.includes(code)) return PERK_ERRORS[code];
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
  // Living together (migration 0149): my part of it.
  const rent = p.rent_part ?? ECONOMY.homes.find((h) => h.id === p.home_id)?.rent;
  if (!p.house_sku && p.next_rent_due && rent) out.push({ kind: "rent", amount: rent, due_date: p.next_rent_due });
  if (p.next_phone_due) out.push({ kind: "phone", amount: CITY_ECONOMY.bills.phone, due_date: p.next_phone_due });
  // A catalog car (Clout Couture's Veloce) is insured like the priciest C$ car (migration 0102 sets its price).
  const listed = p.car_sku ? s.catalog?.find((c) => c.sku === p.car_sku) : undefined;
  const car = p.car_sku ? itemBySku(p.car_sku) ?? (listed ? { price: listed.price, rentPerWeek: 0 } : undefined) : undefined;
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

/** When a bill comes due: midnight New York time at the start of its due date. */
export function billDueAtMs(dueDate: string): number {
  const utcMidnight = Date.parse(`${dueDate}T00:00:00Z`);
  // New York's offset that day (-4 or -5 hours), from how the same instant reads there.
  const ny = new Date(new Date(utcMidnight).toLocaleString("en-US", { timeZone: "America/New_York" })).getTime();
  const local = new Date(new Date(utcMidnight).toLocaleString("en-US", { timeZone: "UTC" })).getTime();
  return utcMidnight + (local - ny);
}

export type BillUrgency = "calm" | "soon" | "urgent";

/**
 * The live countdown to a coming bill (owner, Oct 15: "a bar counting down to the deadline"):
 * how long is left, the share of its week left (the bar drains to empty at the deadline), and how
 * urgent it is (under 3 days: soon; under a day: urgent).
 */
export function billCountdown(b: UpcomingBill, nowMs: number): { msLeft: number; left: number; label: string; urgency: BillUrgency } {
  const periodDays = b.kind === "car_rental" ? CITY_ECONOMY.bills.carRentalDays : billPeriodDays();
  const msLeft = Math.max(0, billDueAtMs(b.due_date) - nowMs);
  const left = Math.min(1, msLeft / (periodDays * 86_400_000));
  const h = Math.floor(msLeft / 3_600_000);
  const m = Math.floor((msLeft % 3_600_000) / 60_000);
  const label = msLeft <= 0 ? "Due now" : h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h left` : h >= 1 ? `${h}h ${m}m left` : `${Math.max(1, m)}m left`;
  return { msLeft, left, label, urgency: h < 24 ? "urgent" : h < 72 ? "soon" : "calm" };
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

/**
 * The rent alarm (owner, Oct 22: "no sense of emergency to get gigs to make rent"): late bills, or rent and other bills
 * due in the next few days with too little in the bank. Shown as a card on the home screen and a red bank pill; the
 * same rule sends the 'rent_short' push (migration 0112). Null when there's nothing to worry about.
 */
export interface RentAlert {
  level: "evict" | "late" | "short";
  title: string;
  line: string;
  owed: number;
  short: number;
  /** Enough in the bank to pay what's late now. */
  canPay: boolean;
}
export const RENT_ALERT_DAYS = 3;
export function rentAlert(s: CityState): RentAlert | null {
  const cash = Math.max(0, s.player.bank_cash);
  const { graceDays, evictAfterDays } = CITY_ECONOMY.bills;
  // Bills already issued: an alarm when they're late, or when the bank can't cover them (due today and affordable is
  // just the Bills badge).
  const issued = dueBills(s);
  const issuedOwed = issued.reduce((a, b) => a + b.amount, 0);
  const late = issued.some((b) => b.due_date < s.today) || issuedOwed > cash ? issued : [];
  if (late.length) {
    const owed = late.reduce((a, b) => a + b.amount, 0);
    const rent = late.find((b) => b.kind === "rent");
    const lateDays = rent ? daysBetween(rent.due_date, s.today) : 0;
    const left = Math.max(0, evictAfterDays - lateDays);
    const evict = !!rent && lateDays > graceDays;
    const short = Math.max(0, owed - cash);
    return {
      level: evict ? "evict" : "late", owed, short, canPay: short === 0,
      title: evict ? `🚪 Pay rent or move out in ${left} day${left === 1 ? "" : "s"}` : `🧾 ${formatCash(owed)} in bills to pay`,
      line: short === 0 ? (evict ? "Mood is dropping every day it's late. Pay it in Bills." : "Pay it in Bills before your Mood starts dropping.")
        : `You have ${formatCash(cash)}: ${formatCash(short)} short. Pick up a gig, fast.`,
    };
  }
  const soon = upcomingBills(s).filter((b) => { const d = daysBetween(s.today, b.due_date); return d >= 0 && d <= RENT_ALERT_DAYS; });
  const rent = soon.find((b) => b.kind === "rent");
  const owed = soon.reduce((a, b) => a + b.amount, 0);
  if (!rent || owed <= cash) return null;
  const d = daysBetween(s.today, rent.due_date);
  return {
    level: "short", owed, short: owed - cash, canPay: false,
    title: `💸 Rent's due ${d === 0 ? "today" : d === 1 ? "tomorrow" : `in ${d} days`}`,
    line: `${formatCash(owed)} due, ${formatCash(cash)} in the bank. You're ${formatCash(owed - cash)} short: grab a gig.`,
  };
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

// Owner, Oct 18: task copy in Clout City's voice. The title still says what to do and where; a line under it jokes.
const TASK_VERB: Record<Exclude<DailyTask["kind"], StyleTaskKind>, string> = { visit: "Be seen at", eat: "Grab a bite at", shift: "Clock in at", hangout: "Kick it at", event: "Pull up to", gossip: "Eavesdrop at", cook: "Cook something at", class: "Go to class at" };

/** The joke under each task, a few per kind; the task's id picks one, so it stays put all day. */
const TASK_QUIPS: Record<Exclude<DailyTask["kind"], StyleTaskKind> | "skill" | "style", readonly string[]> = {
  style: ["Dress for the place you want.", "The outfit does the talking. You just walk in.", "Matching the venue is a love language."],
  visit: ["If nobody saw you there, did you even go?", "Stand near the good lighting.", "Look busy. Look famous. Ideally both."],
  eat: ["Calories don't count if you post them.", "Eat like nobody's watching. Someone is.", "Fuel for the grind. And the gossip."],
  shift: ["Smile at customers. Die a little inside. Get paid.", "Rent is due, babe. Rent is always due.", "Honest work. Gross, but honest."],
  hangout: ["Doing nothing, but on purpose.", "Touch grass. Influencers swear by it.", "Hang out like your schedule isn't empty."],
  event: ["Arrive late. Leave later.", "Dress like the photographer is waiting.", "The dance floor misses you. Allegedly."],
  gossip: ["Ears open, mouth shut. For now.", "Somebody knows something. Go be nosy.", "The tea is hot and you're thirsty."],
  cook: ["Gordon would yell. Your stomach won't.", "The smoke alarm is part of the recipe.", "Home-cooked. Technically."],
  class: ["Attendance is half the grade. The other half is vibes.", "Sit in the back. Look engaged. Nod occasionally.", "Your professor noticed you were gone. Barely."],
  skill: ["Your skills are rusting. Literally, we checked.", "Practice now, show off later.", "Get good. Then get annoying about it."],
};
const DONE_LINES = ["Done. Lola noticed. 💅", "Paid. Treat yourself (responsibly).", "Ticked. Main character behavior."] as const;

/** The task's joke ("Calories don't count if you post them."), the same all day. */
export function taskQuip(t: Pick<DailyTask, "id" | "kind" | "skill" | "action_id">): string {
  const quips = t.kind === "gossip" && t.action_id === "gossip-restroom" ? ["Best acoustics in the club. Go wash your hands."]
    : t.kind === "gossip" && t.action_id === "gossip-regular" ? ["They know things. They always know things.", "Bring snacks. Leave with secrets."]
    : TASK_QUIPS[t.kind.startsWith("style:") ? "style" : t.skill && t.kind !== "cook" ? "skill" : t.kind as Exclude<DailyTask["kind"], StyleTaskKind>];
  return quips[Math.abs(t.id) % quips.length];
}

/** What a finished task says, the same all day. */
export const taskDoneLine = (t: Pick<DailyTask, "id">) => DONE_LINES[Math.abs(t.id) % DONE_LINES.length];

/** "Eat at Ditmars Deli & Dreams", "Go to Neon Nights", "Talk to Sal at …": a daily task's title. */
/**
 * What a daily task pays, as a reward ("+C$40"), never a price. Owner, Oct 14: gossip tasks (talking
 * to someone, listening in) pay clout, not cash (migration 0042).
 */
export function taskRewardLine(t: Pick<DailyTask, "kind" | "reward">): string {
  return t.kind === "gossip" ? `+${CITY_ECONOMY.gossip.taskClout} clout` : `+${formatCashPlain(t.reward)}`;
}
const formatCashPlain = (n: number) => `C$${n.toLocaleString("en-US")}`;

export function taskTitle(t: Pick<DailyTask, "kind" | "place_id" | "action_id" | "skill">): string {
  // C3: an action can carry its own task title ("Get a BEC at Sal's").
  const own = placeById(t.place_id)?.actions.find((a) => a.id === t.action_id)?.task;
  if (own) return own;
  // Migration 0063 (owner, Oct 16), owner Oct 18: the skill shows as a tag under the title, so the title is the doing.
  if (t.skill) {
    if (t.kind === "cook") return "Cook something at home";
    const place = placeById(t.place_id);
    const label = place?.actions.find((a) => a.id === t.action_id)?.label;
    return label ? `${label} at ${place?.name ?? "a place"}` : `${TASK_VERB[t.kind as Exclude<DailyTask["kind"], StyleTaskKind>]} ${place?.name ?? "a place"}`;
  }
  if (t.kind === "event") return `${TASK_VERB.event} ${eventById(t.action_id)?.name ?? "a club event"}`;
  // Migration 0100: a style task.
  if (t.kind.startsWith("style:")) return `Wear a full ${LOOK_LABEL[t.kind.slice(6)] ?? "matching"} look to ${placeById(t.place_id)?.name ?? "a place"}`;
  // v0.11 gossip tasks (migration 0036): the next stop on the player's gossip trail.
  if (t.kind === "gossip") return leadAction({ place: t.place_id, source: t.action_id === "gossip-regular" ? "regular" : t.action_id === "gossip-restroom" ? "restroom" : "overheard", hours: null });
  return `${TASK_VERB[t.kind as Exclude<DailyTask["kind"], StyleTaskKind>]} ${placeById(t.place_id)?.name ?? "a place"}`;
}

/** v0.11 (spec section 11): today's daily tasks at a place, for its checkboxes. */
export const tasksAt = (state: CityState | null, placeId: string): DailyTask[] => (state?.tasks ?? []).filter((t) => t.place_id === placeId);
