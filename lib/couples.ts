// Relationships (migration 0118, owner Oct 26): a match becomes a couple after three date nights. What the game
// sees of it: couple_state() and the calls around it. Safe to import anywhere.

/** Mirrors game_settings 'couples' (checked by tests/couples.test.ts against the migration). */
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
} as const;

export interface CouplePerson { id: string; name: string; style: string; look?: unknown }

/** Why "Make it official?" isn't open yet (null: it is). */
export type CoupleBlock = "blocked" | "not_matched" | "already_dating" | "they_are_dating" | "more_dates" | "too_new" | "cooling_off" | null;

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

/** Something waiting: an ask to answer, an unseen gift or the breakup card (the home card and the Phone badge). */
export function coupleAlerts(s: CoupleState | null): number {
  if (!s) return 0;
  return s.asks.filter((a) => !a.mine).length + s.gifts.received.length + (s.ended ? 1 : 0);
}
