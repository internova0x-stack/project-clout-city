// Daily tasks 2.0 (docs/08-new-features-spec.md section 19; owner, Oct 18): the goal ladder the game suggests,
// streaks of full task days, and guest-list passes. Pure data and helpers, safe to import anywhere.
// The server (migration 0073: goal_current, goal_settle, ensure_daily, streak_tick, use_guest_pass, goals_state)
// is authoritative; game_settings 'goals' holds these numbers and tests/goals.test.ts keeps them equal.

/** What finishes a goal. The server (goal_list, migration 0074) reads these from game_settings 'goals'. */
export type GoalCheck =
  | { type: "purchase" }
  | { type: "shift" }
  | { type: "full_day" }
  | { type: "gig" }
  | { type: "crew"; count: number }
  | { type: "save"; cash: number }
  | { type: "skill"; level: number }
  | { type: "gig_tier"; tier: "pro" | "big" }
  | { type: "business"; id: string }
  | { type: "home"; home: string }
  | { type: "car" }
  | { type: "house"; sku: string }
  | { type: "door"; place: string }
  | { type: "vip"; level: "medium" }
  | { type: "public" }
  /** C3: different New York days with something done at a place (Sal remembers your order after 3). */
  | { type: "regular"; place: string; days: number }
  /** C3: living without a roommate (a home without `roommate`, or a house). */
  | { type: "solo" };

/**
 * One goal on the ladder (owner, Oct 18: a long ladder, most of it behind clout). `unlock` is the clout at which the
 * game starts suggesting it (the rank thresholds, lib/ranks.ts); a goal finished earlier still counts and pays.
 * `lean` picks its two daily tasks: "cash" for a shift and somewhere to spend, "boost" for Confidence and clout;
 * `tags` are the places that fit it best.
 */
export interface GoalDef { id: string; unlock: number; reward: number; lean: "cash" | "boost"; tags: string[]; check: GoalCheck }

/** The ladder as the database has it (game_settings 'goals'; tests/goals.test.ts keeps the two equal). */
const LADDER: GoalDef[] = [
  // 🍜 Ramen Noodle Era
  // C3 (owner, Oct 20): the two Astoria goals open the ladder; becoming a regular brings players back on days 2 and 3.
  { id: "regular", unlock: 0, reward: 25, lean: "cash", tags: ["bodega"], check: { type: "regular", place: "ditmars-deli", days: 3 } },
  { id: "first_purchase", unlock: 0, reward: 25, lean: "cash", tags: ["boutique", "shopping"], check: { type: "purchase" } },
  { id: "first_shift", unlock: 0, reward: 25, lean: "cash", tags: [], check: { type: "shift" } },
  { id: "full_day", unlock: 0, reward: 50, lean: "boost", tags: [], check: { type: "full_day" } },
  { id: "first_gig", unlock: 0, reward: 50, lean: "boost", tags: ["gym", "campus", "club", "monument"], check: { type: "gig" } },
  { id: "own_place", unlock: 0, reward: 75, lean: "cash", tags: [], check: { type: "solo" } },
  // 🎓 Student Loan Survivor
  { id: "first_crew", unlock: 100, reward: 75, lean: "boost", tags: ["club", "nightlife"], check: { type: "crew", count: 1 } },
  { id: "save_15k", unlock: 100, reward: 75, lean: "cash", tags: [], check: { type: "save", cash: 15000 } },
  { id: "skill_3", unlock: 100, reward: 75, lean: "boost", tags: ["gym", "campus"], check: { type: "skill", level: 3 } },
  // 💼 Side Hustler
  { id: "pro_gigs", unlock: 500, reward: 150, lean: "boost", tags: ["gym", "campus", "club", "monument"], check: { type: "gig_tier", tier: "pro" } },
  { id: "first_business", unlock: 500, reward: 150, lean: "cash", tags: [], check: { type: "business", id: "hot-dog-cart" } },
  { id: "move_up", unlock: 500, reward: 150, lean: "cash", tags: [], check: { type: "home", home: "jackson_heights_1br" } },
  // 💬 Group Chat Famous
  { id: "first_car", unlock: 1000, reward: 200, lean: "cash", tags: ["dealership", "cars"], check: { type: "car" } },
  { id: "move_sunnyside", unlock: 1000, reward: 200, lean: "cash", tags: [], check: { type: "home", home: "sunnyside_gardens" } },
  { id: "skill_5", unlock: 1000, reward: 200, lean: "boost", tags: ["gym", "campus"], check: { type: "skill", level: 5 } },
  // 📋 On the List
  { id: "big_gigs", unlock: 2000, reward: 300, lean: "boost", tags: ["gym", "campus", "club", "monument"], check: { type: "gig_tier", tier: "big" } },
  { id: "ultraviolet", unlock: 2000, reward: 300, lean: "boost", tags: ["club", "nightlife"], check: { type: "door", place: "ultraviolet-society" } },
  { id: "bodega", unlock: 2000, reward: 300, lean: "cash", tags: [], check: { type: "business", id: "bodega" } },
  // 📸 Local Celebrity
  { id: "vip_floor", unlock: 5000, reward: 500, lean: "boost", tags: ["club", "nightlife"], check: { type: "vip", level: "medium" } },
  { id: "move_highrise", unlock: 5000, reward: 500, lean: "cash", tags: [], check: { type: "home", home: "lic_highrise" } },
  // 🍼 Nepo Baby Energy
  { id: "own_home", unlock: 15000, reward: 1500, lean: "cash", tags: ["furniture", "home"], check: { type: "house", sku: "house-astoria-townhouse" } },
  { id: "laundromat", unlock: 15000, reward: 750, lean: "cash", tags: [], check: { type: "business", id: "laundromat" } },
  // 💸 New Money Rich
  { id: "penthouse", unlock: 50000, reward: 2500, lean: "cash", tags: ["furniture", "home"], check: { type: "house", sku: "house-lic-penthouse" } },
  { id: "cafe", unlock: 50000, reward: 2500, lean: "cash", tags: [], check: { type: "business", id: "cafe" } },
  // 🛥️ Self-Made Billionaire*
  { id: "duplex", unlock: 150000, reward: 5000, lean: "cash", tags: ["furniture", "home"], check: { type: "house", sku: "house-hunters-point-duplex" } },
  { id: "taco_trucks", unlock: 150000, reward: 5000, lean: "cash", tags: [], check: { type: "business", id: "taco-trucks" } },
  // ✨ God Status
  { id: "go_public", unlock: 500000, reward: 10000, lean: "boost", tags: [], check: { type: "public" } },
];

export type GoalId = string;

/**
 * "next_chapter": what the game suggests once every unlocked goal is done, reaching the clout that unlocks the
 * next chapter. It pays nothing itself; the chapter's goals do.
 */
export const NEXT_CHAPTER = "next_chapter";

/** One part of a goal's progress, in the goal's own terms ("C$1,240 of C$14,000", "380 of 500 clout"). */
export interface GoalPart { have: number; need: number; unit: "cash" | "clout" | "confidence" | "count" }

/** What goals_state() returns. */
export interface GoalsState {
  goal: { id: GoalId; parts: GoalPart[]; target?: string | null } | null;
  done: GoalId[];
  streak: {
    current: number;
    best: number;
    lastDay: string | null;
    /** All five tasks done today. */
    today: boolean;
    frozenThisWeek: boolean;
    next: { day: number; reward: StreakReward };
    /** 0074, the Streaks section: the run's first day (null with no live streak). */
    startedOn?: string | null;
    /** The full days (New York dates, YYYY-MM-DD) of the last five weeks. */
    days?: string[];
    /** The rewards this run has paid. */
    rewards?: { day: number; reward: StreakReward; sku: string | null }[];
  };
  passes: { held: number; tonight: { place: string } | null };
}

export type StreakReward = "clout" | "collectible" | "pass";

export type GoalsResult<T> = { ok: true; data: T } | { ok: false; error: string };

/** The goal screens' server calls (app/home/goalsActions.ts; the preview's lib/goalsSim.ts). */
export interface GoalsApi {
  state(): Promise<GoalsResult<GoalsState>>;
  usePass(place: string): Promise<GoalsResult<GoalsState>>;
}

/** The numbers (the database's game_settings 'goals' row is the truth). */
export const GOALS = {
  ladder: LADDER,
  /** Daily tasks picked to move the active goal forward (of the five). */
  goalTasksPerDay: 2,
  streak: {
    /** Missed days forgiven per New York week (a freeze). */
    freezesPerWeek: 1,
    /** Day 3 of a streak pays this much clout. */
    day3Clout: 50,
    /** Every this many days: a collectible (odd multiples) or a guest-list pass (even multiples). */
    every: 7,
    /** The task-only collectibles, in the order they're given. The Shop never sells them. */
    collectibles: ["home-neon-five-sign", "home-trophy-shelf", "home-employee-frame", "home-streak-lava-lamp"],
    /** Clout instead, when every collectible is already owned or a pass is already held. */
    fallbackClout: 100,
  },
};

export const goalById = (id: string) => LADDER.find((g) => g.id === id);

/** The ladder's chapters: one per unlock level, named after the rank that opens it (lib/ranks.ts). */
export function chapters(): { unlock: number; goals: GoalDef[] }[] {
  const out: { unlock: number; goals: GoalDef[] }[] = [];
  for (const g of LADDER) {
    const last = out[out.length - 1];
    if (last && last.unlock === g.unlock) last.goals.push(g);
    else out.push({ unlock: g.unlock, goals: [g] });
  }
  return out;
}

/** The clout that opens the next chapter after `clout`, or null at the top. */
export function nextUnlock(clout: number): number | null {
  return LADDER.find((g) => g.unlock > clout)?.unlock ?? null;
}

/**
 * Player-facing words for each goal (owner, Oct 18: Clout City's voice). Satirical, they/them, no real brands.
 * `toward` tags the goal's daily tasks.
 */
export const GOAL_COPY: Record<string, { emoji: string; title: string; line: string; toward: string }> = {
  regular: { emoji: "🥪", title: "Become a regular", line: "Three different days at Sal's and he starts your order before you ask. That's love in Queens.", toward: "Toward being a regular" },
  own_place: { emoji: "🔑", title: "Get your own place", line: "Nobody moves to New York to keep a roommate forever. Get your own keys.", toward: "Toward your own keys" },
  first_purchase: { emoji: "🛍️", title: "Make your first purchase", line: "Buy literally anything. Retail therapy is still therapy.", toward: "Toward your first haul" },
  first_shift: { emoji: "⏱️", title: "Work your first shift", line: "Clock in. Smile at a customer. Die a little inside. Get paid.", toward: "Toward your first paycheck" },
  full_day: { emoji: "✅", title: "Clear all five daily tasks", line: "Every errand, one day. Your mom would be so proud.", toward: "Toward a perfect day" },
  first_gig: { emoji: "💼", title: "Collect your first gig payout", line: "A gig pays more than a shift and asks fewer questions.", toward: "Toward your first gig" },
  first_crew: { emoji: "👯", title: "Bring a friend into your crew", line: "Being famous alone is just being weird in public.", toward: "Toward a crew" },
  save_15k: { emoji: "🏦", title: "Save C$15,000", line: "An emergency fund. For emergencies like brunch.", toward: "Toward your savings" },
  skill_3: { emoji: "⭐", title: "Get any skill to level 3", line: "Get good at one thing. Anything. We're not picky.", toward: "Toward level 3" },
  pro_gigs: { emoji: "📈", title: "Unlock pro gigs", line: "500 clout and 50 Confidence. Clients start texting back. Some of them.", toward: "Toward pro gigs" },
  first_business: { emoji: "🌭", title: "Buy the hot dog cart", line: "Your first business. \"CEO\" is now technically in your bio.", toward: "Toward your first business" },
  move_up: { emoji: "🔑", title: "Move to Jackson Heights", line: "A real bedroom. With a door. That closes.", toward: "Toward the new place" },
  first_car: { emoji: "🚗", title: "Get your first car", line: "Pre-loved. Heavily. It still gets you to the club.", toward: "Toward your car" },
  move_sunnyside: { emoji: "🌿", title: "Move to Sunnyside Gardens", line: "A garden shared with forty neighbors and one territorial cat.", toward: "Toward Sunnyside" },
  skill_5: { emoji: "🌟", title: "Get any skill to level 5", line: "Halfway to master. Fully a show-off.", toward: "Toward level 5" },
  big_gigs: { emoji: "🔥", title: "Unlock big gigs", line: "2,000 clout and 80 Confidence. Strangers are starting to care. Act surprised.", toward: "Toward big gigs" },
  ultraviolet: { emoji: "🪩", title: "Get past the Ultraviolet Society door", line: "The bouncer nods at you now. Don't make it weird.", toward: "Toward the velvet rope" },
  bodega: { emoji: "🐈", title: "Own a bodega", line: "The cat comes with it. The cat is the real owner.", toward: "Toward your bodega" },
  vip_floor: { emoji: "🥂", title: "Go up to a VIP floor", line: "Upstairs, where the drinks have names. Pretend you've been here before.", toward: "Toward the VIP floor" },
  move_highrise: { emoji: "🌆", title: "Move into the LIC high-rise", line: "Rooftop pool, skyline view, rent that should be illegal.", toward: "Toward the high-rise" },
  own_home: { emoji: "🏡", title: "Own a home", line: "No more rent. Your landlord will miss you. Financially.", toward: "Toward a home of your own" },
  laundromat: { emoji: "🧺", title: "Own a laundromat", line: "Passive income, active lint.", toward: "Toward the laundromat" },
  penthouse: { emoji: "🏙️", title: "Buy the LIC penthouse", line: "Floor-to-ceiling windows, so the city can watch you thrive.", toward: "Toward the penthouse" },
  cafe: { emoji: "☕", title: "Own a café", line: "Oat milk is now a revenue stream.", toward: "Toward your café" },
  duplex: { emoji: "🌇", title: "Buy the Hunters Point duplex", line: "A hot tub with a view of everyone who doubted you.", toward: "Toward the duplex" },
  taco_trucks: { emoji: "🌮", title: "Own a fleet of taco trucks", line: "An empire. On wheels. With salsa.", toward: "Toward the fleet" },
  go_public: { emoji: "🚀", title: "Take the startup public", line: "Ring the bell. Nobody knows what the company does. Valuation: huge.", toward: "Toward the bell" },
  [NEXT_CHAPTER]: { emoji: "🔓", title: "Unlock the next chapter", line: "Everything on your level is done. More clout opens more goals.", toward: "Toward the next chapter" },
};

/** The day of the next streak reward after `current`, and what it is (mirrors the server's streak_tick). */
export function nextStreakReward(current: number, s = GOALS.streak): { day: number; reward: StreakReward } {
  if (current < 3) return { day: 3, reward: "clout" };
  const day = (Math.floor(current / s.every) + 1) * s.every;
  return { day, reward: streakRewardOn(day, s) ?? "clout" };
}

/** What reaching day `n` of a streak pays, if anything. */
export function streakRewardOn(n: number, s = GOALS.streak): StreakReward | null {
  if (n === 3) return "clout";
  if (n > 0 && n % s.every === 0) return (n / s.every) % 2 === 1 ? "collectible" : "pass";
  return null;
}

/** How far along a goal is, 0 to 1: the average of its parts, each capped at full. */
export function goalProgress(parts: readonly GoalPart[]): number {
  if (!parts.length) return 0;
  return parts.reduce((sum, p) => sum + (p.need <= 0 ? 1 : Math.min(1, Math.max(0, p.have) / p.need)), 0) / parts.length;
}

/** One part in words: "C$1,240 of C$14,000", "380 of 500 clout", "0 of 1". */
export function partLine(p: GoalPart): string {
  const n = (x: number) => Math.round(x).toLocaleString("en-US");
  switch (p.unit) {
    case "cash": return `C$${n(p.have)} of C$${n(p.need)}`;
    case "clout": return `${n(p.have)} of ${n(p.need)} clout`;
    case "confidence": return `${n(p.have)} of ${n(p.need)} Confidence`;
    default: return `${n(p.have)} of ${n(p.need)}`;
  }
}

/** The streak's milestones from day 3 up to `upTo` (day 3, then every 7 days), with what each pays. */
export function streakMilestones(upTo: number, s = GOALS.streak): { day: number; reward: StreakReward }[] {
  const out: { day: number; reward: StreakReward }[] = [{ day: 3, reward: "clout" }];
  for (let d = s.every; d <= upTo; d += s.every) out.push({ day: d, reward: streakRewardOn(d, s)! });
  return out;
}

/** A New York date (YYYY-MM-DD) plus n days. */
export function addDay(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
