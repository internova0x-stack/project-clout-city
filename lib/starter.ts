// Starter Week (owner, Oct 26: new players "don't know what to do"): ten small missions, one at a time, each teaching one
// part of the game by doing it, with a small reward. Shown as a pill under "Invite your Crew" until all ten are done or
// seven days pass. Safe to import anywhere.

export type StarterGo =
  | { kind: "place"; place: string }
  | { kind: "app"; app: "gigs" | "tea" | "messages" }
  | { kind: "shop"; category: "home" }
  | { kind: "panel"; panel: "look" | "bills" | "events" };

export interface StarterMission {
  id: string;
  emoji: string;
  title: string;
  /** What it teaches, in a line. */
  why: string;
  reward: { cash?: number; clout?: number };
  go: StarterGo;
}

export const STARTER_MISSIONS: StarterMission[] = [
  { id: "breakfast", emoji: "🥯", title: "Order from Sal without making eye contact", why: "Eye contact is for tourists. Food brings your Energy back.", reward: { cash: 25 }, go: { kind: "place", place: "ditmars-deli" } },
  { id: "park", emoji: "🐕", title: "Console a billionaire's depressed dog in Astoria Park", why: "Sir Barksley's owner moved to Miami \"for tax reasons\". Tap a place on the map to go there.", reward: { cash: 500 }, go: { kind: "place", place: "hell-gate-park" } },
  { id: "gig", emoji: "💼", title: "Take a gig from a \"serial entrepreneur\"", why: "Four companies, no office, one vape. Gigs pay the rent.", reward: { clout: 15 }, go: { kind: "app", app: "gigs" } },
  { id: "collect", emoji: "💵", title: "Get paid before he \"circles back\"", why: "Come back when the timer's done. Invoice with confidence.", reward: { cash: 50 }, go: { kind: "app", app: "gigs" } },
  { id: "look", emoji: "🕶️", title: "Change your look so your ex's cousin won't recognize you", why: "Fits are clout. Disguises are a bonus.", reward: { clout: 10 }, go: { kind: "panel", panel: "look" } },
  { id: "furniture", emoji: "🛋️", title: "Buy furniture a stranger online called \"a vibe\"", why: "Then place it at home. A better crib, a better Crib Rating.", reward: { cash: 75 }, go: { kind: "shop", category: "home" } },
  { id: "message", emoji: "💬", title: "Slide into a stranger's DMs with no plan", why: "Message another player. Everyone else is winging it too.", reward: { clout: 15 }, go: { kind: "app", app: "messages" } },
  { id: "gossip", emoji: "🍵", title: "Overhear something you'll swear you weren't listening to", why: "Lola's Tea pays for what you dig up.", reward: { clout: 20 }, go: { kind: "app", app: "tea" } },
  { id: "rent", emoji: "🧾", title: "Pay rent and pretend it doesn't hurt", why: "Your landlord is saving up for a second boat. Late rent costs Mood, then your home.", reward: { clout: 20 }, go: { kind: "panel", panel: "bills" } },
  { id: "event", emoji: "🥂", title: "Walk into an event like you're on the list", why: "Confidence is a guest list. Nights out are where clout lives.", reward: { clout: 25 }, go: { kind: "panel", panel: "events" } },
];

/** Finishing all ten: a badge, cash and a piece of furniture. */
export const STARTER_FINISH = { badge: "starter-week", name: "Fresh Off the 7 Train", cash: 500, furniture: "Welcome-home rug" } as const;
export const STARTER_DAYS = 7;

export function rewardLine(r: StarterMission["reward"]): string {
  return [r.cash ? `+C$${r.cash}` : null, r.clout ? `+${r.clout} 🔥` : null].filter(Boolean).join(" · ");
}

/** starter_state() (migration 0122): marks come from what the game already writes; `paid` lists the missions paid by this
    call (the toasts), `finished` is true once, on the call that paid the finish. Null for players from before it. */
export interface StarterState {
  done: string[];
  startedAt: string;
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

/** The first mission in the list that isn't done (missions can be done in any order; the pill shows this one). */
export function nextMission(done: readonly string[]): StarterMission | null {
  return STARTER_MISSIONS.find((m) => !done.includes(m.id)) ?? null;
}

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
