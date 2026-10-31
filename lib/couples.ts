// Relationships (migration 0118, owner Oct 26): a match becomes a couple after three date nights. What the game
// sees of it: couple_state() and the calls around it. Living together (migration 0149, owner Oct 31): an official couple
// moves into one home and splits the rent. Safe to import anywhere.

/** Mirrors game_settings 'couples' (checked by tests/couples.test.ts against the latest migration that sets it). */
export const COUPLES = {
  datesToOfficial: 3,
  minAccountDays: 7,
  cooloffDays: 14,
  askDays: 7,
  dateMood: 15,
  dateClout: 35,
  streakMessages: 5,
  streakRewards: [
    { day: 3, clout: 30 },
    { day: 7, clout: 75, badge: "couple-7" },
    { day: 14, clout: 150, badge: "couple-14" },
    { day: 30, clout: 300, badge: "couple-30" },
  ],
  giftMood: 10,
  giftClout: 10,
  weekClout: 15,
  monthClout: 50,
  // Living together (migration 0149): official this many days first; an invitation lapses after moveInAskDays.
  moveInDays: 7,
  moveInAskDays: 7,
  // The mover pays floor(rent × rentShare), the host the rest.
  rentShare: 0.5,
  // "Home together": both tap it on the same New York day.
  homeMood: 8,
  homeClout: 5,
} as const;

/**
 * Couple Shop pieces (content/shop/couple.json, catalog extra.couplesOnly): only someone who's dating can buy one
 * (the database says 'couples_only'). Checked against the file by tests/couples.test.ts.
 */
export const COUPLE_ITEMS: ReadonlySet<string> = new Set([
  "couple-truce-loveseat", "couple-compromise-bed", "couple-mug-shelf", "couple-custody-monstera", "couple-argument-rug", "couple-hammock-chair",
]);

export interface CouplePerson { id: string; name: string; style: string; look?: unknown }

/** Why "Make it official?" isn't open yet (null: it is). */
export type CoupleBlock = "blocked" | "not_matched" | "already_dating" | "they_are_dating" | "more_dates" | "too_new" | "cooling_off" | null;

/** Why "Move in together" isn't open for me as the host (null: it is). */
export type CohabitBlock = "not_dating" | "already_together" | "too_soon" | "no_player" | "they_own_house" | "home_too_small"
  | "sublet_live" | "sublet_listed" | "rent_due" | null;

/** Living together, as "Us" shows it (couple_state().home, migration 0149). */
export interface CohabitState {
  live: {
    id: number; role: "host" | "mover"; since: string; days: number; homeId: string; houseSku: string | null;
    /** My next rent bill while together (0 in an owned house), and the home's whole rent. */
    myRent: number | null; fullRent: number | null;
    homeToday: boolean; homeOther: boolean;
  } | null;
  blockedBy: CohabitBlock;
  asks: { id: number; mine: boolean; homeId: string }[];
  /** The note when the other one ended it by moving (a breakup has its own), once. */
  ended: { id: number; role: "host" | "mover"; reason: "moved_out" | "moved" | "restart"; name: string } | null;
  rules: { moveInDays: number; homeMood: number; homeClout: number; rentShare: number };
}

/** Where the mover lives: the host's home, layout and furniture (cohabit_home). */
export interface CohabitHome {
  id: number; host: string; hostName: string; homeId: string; houseSku: string | null; layout: unknown;
  items: { id: number; sku: string }[];
}

export interface CoupleState {
  partner: CouplePerson | null;
  relId: number | null;
  since: string | null;
  days: number | null;
  streak: number;
  todayDone: boolean;
  nextReward: { day: number; clout: number; badge?: string } | null;
  /** "💞 Dating" on my own card (null when single). */
  shown: boolean | null;
  gifts: { boxes: number; sentToday: boolean; received: { id: number; from: string; day: string }[] };
  /** Rewards this read just paid (streak days, anniversaries). */
  paid: ({ kind: "streak"; day: number; clout: number } | { kind: "week" | "month"; n: number; clout: number })[];
  /** The gentle card after the other one ended it (or blocked), once. */
  ended: { id: number; reason: "breakup" | "blocked"; name: string } | null;
  matches: (CouplePerson & { dates: number; blockedBy: CoupleBlock })[];
  asks: { id: number; mine: boolean; with: CouplePerson }[];
  /** Living together (migration 0149; missing before it runs). */
  home?: CohabitState;
  rules: { datesToOfficial: number; streakMessages: number; giftMood: number; giftClout: number };
}

export type CoupleResult<T> = { ok: true; data: T } | { ok: false; error: string };

export interface CoupleApi {
  state(): Promise<CoupleResult<CoupleState>>;
  ask(playerId: string): Promise<CoupleResult<CoupleState>>;
  answer(askId: number, yes: boolean): Promise<CoupleResult<CoupleState>>;
  end(): Promise<CoupleResult<CoupleState>>;
  show(on: boolean): Promise<CoupleResult<CoupleState>>;
  gift(): Promise<CoupleResult<CoupleState>>;
  seen(): Promise<CoupleResult<null>>;
  /** Living together (migration 0149): absent before it runs. */
  moveIn?: {
    ask(): Promise<CoupleResult<CoupleState>>;
    cancel(): Promise<CoupleResult<CoupleState>>;
    answer(askId: number, yes: boolean): Promise<CoupleResult<CoupleState>>;
    leave(): Promise<CoupleResult<CoupleState>>;
    hang(): Promise<CoupleResult<CoupleState>>;
    home(): Promise<CoupleResult<CohabitHome | null>>;
  };
}

const ERRORS: Record<string, string> = {
  more_dates: `Three date nights first. Then you can make it official.`,
  not_matched: "Official is for matches: you both have to crush on each other.",
  already_dating: "You're already dating someone.",
  they_are_dating: "They're already dating someone.",
  too_new: `You both need to have been in the city at least ${COUPLES.minAccountDays} days.`,
  cooling_off: `You two broke up recently. Give it ${COUPLES.cooloffDays} days.`,
  blocked: "That's not happening.",
  ask_exists: "There's already an ask waiting between you two.",
  ask_answered: "That one's already been answered.",
  ask_expired: "That ask expired. Ask again if you still mean it.",
  unknown_ask: "That ask isn't around anymore.",
  not_dating: "You're not dating anyone right now.",
  no_gift_box: "No gift box on you. Grab one at Sal's or Schlep & Schmear.",
  gift_today: "One gift a day. Keep a little mystery.",
  in_relationship: "You're dating someone. No new crushes.",
  // Living together (migration 0149).
  already_together: "You two already live together. One lease of love at a time.",
  too_soon: `Moving in comes after ${COUPLES.moveInDays} days official. Even the moving van needs a week's notice.`,
  they_own_house: "They own a house. Ask them to invite you instead.",
  home_too_small: "Your place doesn't fit two. Not a dorm, not the room share: Priya would have notes.",
  sublet_live: "Finish the sublet first. One extra person in the apartment at a time.",
  sublet_listed: "Take your sublet listing down first.",
  rent_due: "Pay the rent that's due first, both of you. Landlords love a clean ledger.",
  home_changed: "Their home changed since they asked. Ask again from the new place.",
  not_living_together: "You don't live together right now.",
  rate_limited: "Slow down. Moving is stressful enough.",
  no_player: "Finish moving in first.",
};

export function coupleError(message: string | undefined): string {
  if (message) for (const code of Object.keys(ERRORS)) if (message.includes(code)) return ERRORS[code];
  return "Cupid tripped over a cable. Try again.";
}

/** The line under a match on the "Make it official?" list. */
export function officialLine(m: { dates: number; blockedBy: CoupleBlock }, need: number = COUPLES.datesToOfficial): string {
  switch (m.blockedBy) {
    case null: return "Three dates in. You could make it official.";
    case "more_dates": return `${Math.min(m.dates, need)} of ${need} date nights together`;
    case "they_are_dating": return "They're seeing someone.";
    case "too_new": return `Official opens once you've both been here ${COUPLES.minAccountDays} days.`;
    case "cooling_off": return "Cooling off after the breakup.";
    default: return "Not available.";
  }
}

/** Couple badges (player_badges 'couple-7' etc.): emoji and name, or null for other ids. */
export function coupleBadge(id: string): { emoji: string; name: string } | null {
  const days = { "couple-7": 7, "couple-14": 14, "couple-30": 30 }[id];
  return days ? { emoji: "💞", name: `${days}-day couple streak` } : null;
}

/** Something waiting: an ask to answer, an unseen gift, the breakup card or a move-in ask (the home card and the Phone badge). */
export function coupleAlerts(s: CoupleState | null): number {
  if (!s) return 0;
  return s.asks.filter((a) => !a.mine).length + s.gifts.received.length + (s.ended ? 1 : 0)
    + (s.home?.asks.filter((a) => !a.mine).length ?? 0) + (s.home?.ended ? 1 : 0);
}

/** The line under "Move in together" when it isn't open yet (null: it is, or there's nothing to say). */
export function moveInLine(b: CohabitBlock): string | null {
  if (b === null || b === "not_dating" || b === "already_together") return null;
  return ERRORS[b] ?? "Not right now.";
}

/** Each partner's part of a weekly rent: the mover floor(rent × share), the host the rest (the database's split). */
export function rentParts(rent: number, share: number = COUPLES.rentShare): { mover: number; host: number } {
  const mover = Math.floor(rent * share);
  return { mover, host: rent - mover };
}
