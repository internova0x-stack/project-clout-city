// Starter Week (owner, Oct 26: new players "don't know what to do"): small missions, each teaching one part of the game by
// doing it, with a small reward. Shown as a pill under "Invite your Crew" until all are done or the week runs out.
// By the day (migration 0163, owner Nov 5): missions open a few a New York day (day 1 = the day it started) through rent
// day, day 8; one done early still counts and pays. Safe to import anywhere.

export type StarterGo =
  | { kind: "place"; place: string }
  | { kind: "app"; app: "gigs" | "tea" | "messages" }
  | { kind: "shop"; category: "home" }
  | { kind: "panel"; panel: "look" | "bills" | "events" | "visits" }
  | { kind: "careers" }
  | { kind: "map" };

export interface StarterMission {
  id: string;
  emoji: string;
  title: string;
  /** What it teaches, in a line. */
  why: string;
  reward: { cash?: number; clout?: number };
  /** The Starter Week day it opens on (1 = the first day; 8 = rent day). */
  day: number;
  go: StarterGo;
}

export const STARTER_MISSIONS: StarterMission[] = [
  { id: "breakfast", day: 1, emoji: "🥯", title: "Order from Sal without making eye contact", why: "Eye contact is for tourists. Food brings your Energy back.", reward: { cash: 25 }, go: { kind: "place", place: "ditmars-deli" } },
  { id: "park", day: 1, emoji: "🐕", title: "Console a billionaire's depressed dog in Astoria Park", why: "Sir Barksley's owner moved to Miami \"for tax reasons\". Tap a place on the map to go there.", reward: { cash: 150 }, go: { kind: "place", place: "hell-gate-park" } },
  { id: "gig", day: 1, emoji: "💼", title: "Take a gig from a \"serial entrepreneur\"", why: "Four companies, no office, one vape. Gigs pay the rent.", reward: { clout: 15 }, go: { kind: "app", app: "gigs" } },
  { id: "collect", day: 1, emoji: "💵", title: "Get paid before he \"circles back\"", why: "Come back when the timer's done. Invoice with confidence.", reward: { cash: 50 }, go: { kind: "app", app: "gigs" } },
  { id: "look", day: 2, emoji: "🕶️", title: "Change your look so your ex's cousin won't recognize you", why: "Fits are clout. Disguises are a bonus.", reward: { clout: 10 }, go: { kind: "panel", panel: "look" } },
  { id: "furniture", day: 2, emoji: "🛋️", title: "Buy furniture a stranger online called \"a vibe\"", why: "Then place it at home. A better crib, a better Crib Rating.", reward: { cash: 75 }, go: { kind: "shop", category: "home" } },
  { id: "gossip", day: 3, emoji: "🍵", title: "Overhear something you'll swear you weren't listening to", why: "Lola's Tea pays for what you dig up.", reward: { clout: 20 }, go: { kind: "app", app: "tea" } },
  { id: "message", day: 3, emoji: "💬", title: "Slide into a stranger's DMs with no plan", why: "Message another player. Everyone else is winging it too.", reward: { clout: 15 }, go: { kind: "app", app: "messages" } },
  { id: "event", day: 4, emoji: "🥂", title: "Walk into an event like you're on the list", why: "Confidence is a guest list. Nights out are where clout lives.", reward: { clout: 25 }, go: { kind: "panel", panel: "events" } },
  { id: "work", day: 5, emoji: "🪪", title: "Clock in at a real job, with a lanyard and everything", why: "Careers pay every week and climb a ladder. Pick one in the Careers app.", reward: { clout: 20 }, go: { kind: "careers" } },
  { id: "choice", day: 6, emoji: "⚖️", title: "Make a choice your mother wouldn't approve of. Or would", why: "Go places and things come up. What you pick comes back later.", reward: { clout: 20 }, go: { kind: "map" } },
  { id: "host", day: 7, emoji: "🏠", title: "Have people over and pretend the place is always this clean", why: "Guests pay clout. A better Crib Rating pays more.", reward: { clout: 25 }, go: { kind: "panel", panel: "visits" } },
  { id: "rent", day: 8, emoji: "🧾", title: "Pay rent and pretend it doesn't hurt", why: "Your landlord is saving up for a second boat. Late rent costs Mood, then your home.", reward: { clout: 20 }, go: { kind: "panel", panel: "bills" } },
];

/** Finishing them all: a badge, cash and a piece of furniture. */
export const STARTER_FINISH = { badge: "starter-week", name: "Fresh Off the 7 Train", cash: 1000, furniture: "Welcome-home rug" } as const;
/** New York days it runs: day 1 to rent day (the first rent bill appears a week after moving in). */
export const STARTER_DAYS = 8;

export function rewardLine(r: StarterMission["reward"]): string {
  return [r.cash ? `+C$${r.cash}` : null, r.clout ? `+${r.clout} 🔥` : null].filter(Boolean).join(" · ");
}

/** starter_state() (migration 0122): marks come from what the game already writes; `paid` lists the missions paid by this
    call (the toasts), `finished` is true once, on the call that paid the finish. Null for players from before it. */
export interface StarterState {
  done: string[];
  startedAt: string;
  /** Today's Starter Week day (1 = the day it started; absent before migration 0163, read as the last day). */
  day?: number;
  daysLeft: number;
  active: boolean;
  paid: { id: string; cash: number; clout: number }[];
  finished: boolean;
}
export type StarterResult<T> = { ok: true; data: T } | { ok: false; error: string };
export interface StarterApi {
  state(): Promise<StarterResult<StarterState | null>>;
  hide(): Promise<StarterResult<null>>;
}

/** Today's Starter Week day; before migration 0163 every mission counts as open. */
export const starterDay = (s: Pick<StarterState, "day"> | null | undefined) => s?.day ?? STARTER_DAYS;

/** The first open mission that isn't done (open: its day has come). Missions can be done in any order; the pill shows this one. */
export function nextMission(done: readonly string[], day: number = STARTER_DAYS): StarterMission | null {
  return STARTER_MISSIONS.find((m) => m.day <= day && !done.includes(m.id)) ?? null;
}

/** The next day that opens something not done yet, and how many it opens (for "Tomorrow: 2 more"). */
export function nextDay(done: readonly string[], day: number): { day: number; count: number } | null {
  const later = STARTER_MISSIONS.filter((m) => m.day > day && !done.includes(m.id));
  if (!later.length) return null;
  const d = Math.min(...later.map((m) => m.day));
  return { day: d, count: later.filter((m) => m.day === d).length };
}

/** A day's label: "Day 3", the last one "Rent day". */
export const dayLabel = (d: number) => (d >= STARTER_DAYS ? "Rent day" : `Day ${d}`);

/** Rank 2's new apps (Businesses, Jobs, Campaign) wait until this Starter Week day (owner, Nov 5: one thing at a time). */
export const STARTER_UNLOCK_DAY = 3;

/** The toast for a paid mission, and for finishing. */
export function starterToast(id: string): string {
  const m = STARTER_MISSIONS.find((x) => x.id === id);
  return m ? `⭐ Starter Week: ${m.title} ${rewardLine(m.reward)}` : "⭐ Starter Week";
}
export const STARTER_FINISH_TOAST = `🏅 Starter Week done: “${STARTER_FINISH.name}”, +C$${STARTER_FINISH.cash} and a ${STARTER_FINISH.furniture.toLowerCase()}`;

/** Apps locked until a rank (owner, Oct 26: Businesses and Jobs at Rank 2; everything else open from day one). */
export const APP_UNLOCKS: Record<string, { rank: number; label: string }> = {
  businesses: { rank: 2, label: "Rank 2" },
  jobs: { rank: 2, label: "Rank 2" },
  // Campaign Mode (owner, Oct 29): the app opens the election teaser until then.
  campaign: { rank: 2, label: "Rank 2" },
};
