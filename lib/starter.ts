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
  { id: "breakfast", emoji: "🥯", title: "Eat breakfast at Sal's Deli", why: "Food brings your Energy back.", reward: { cash: 25 }, go: { kind: "place", place: "ditmars-deli" } },
  { id: "park", emoji: "🗺️", title: "Walk to Astoria Park", why: "Tap a place on the map to go there.", reward: { clout: 10 }, go: { kind: "place", place: "hell-gate-park" } },
  { id: "gig", emoji: "💼", title: "Take your first gig", why: "Gigs pay the rent.", reward: { clout: 15 }, go: { kind: "app", app: "gigs" } },
  { id: "collect", emoji: "💵", title: "Collect your gig pay", why: "Come back when the timer's done.", reward: { cash: 50 }, go: { kind: "app", app: "gigs" } },
  { id: "look", emoji: "👕", title: "Change your look", why: "Fits are clout.", reward: { clout: 10 }, go: { kind: "panel", panel: "look" } },
  { id: "furniture", emoji: "🛋️", title: "Buy furniture and place it at home", why: "A better home, a better Crib Rating.", reward: { cash: 75 }, go: { kind: "shop", category: "home" } },
  { id: "message", emoji: "💬", title: "Message another player", why: "The city is other people.", reward: { clout: 15 }, go: { kind: "app", app: "messages" } },
  { id: "gossip", emoji: "🍵", title: "Find a piece of gossip", why: "Lola's Tea pays for what you dig up.", reward: { clout: 20 }, go: { kind: "app", app: "tea" } },
  { id: "rent", emoji: "🧾", title: "Pay your rent", why: "Late rent costs Mood, then your home.", reward: { clout: 20 }, go: { kind: "panel", panel: "bills" } },
  { id: "event", emoji: "🥂", title: "Go to an event", why: "Nights out are where clout lives.", reward: { clout: 25 }, go: { kind: "panel", panel: "events" } },
];

/** Finishing all ten: a badge, cash and a piece of furniture. */
export const STARTER_FINISH = { badge: "starter-week", name: "Fresh Off the 7 Train", cash: 500, furniture: "Welcome-home rug" } as const;
export const STARTER_DAYS = 7;

export function rewardLine(r: StarterMission["reward"]): string {
  return [r.cash ? `+C$${r.cash}` : null, r.clout ? `+${r.clout} 🔥` : null].filter(Boolean).join(" · ");
}

/** Apps locked until a rank (owner, Oct 26: Businesses and Jobs at Rank 2; everything else open from day one). */
export const APP_UNLOCKS: Record<string, { rank: number; label: string }> = {
  businesses: { rank: 2, label: "Rank 2" },
  jobs: { rank: 2, label: "Rank 2" },
};
