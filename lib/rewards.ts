// Credit for small progress and surprises (owner, Nov 21: "build 5 and 6", after the reward-system review; migration
// 0177; docs/FAME.md).
//
// 5. Small progress: a goal half done pays a quarter of its reward early (goals_halfway; only goals with a real amount to
//    reach, not yes/no ones), and every Monday the game shows last week's recap as a results card (week_recap: clout
//    gained, C$ earned, Known for points by score, full days, the best moment).
// 6. Surprises: now and then (at most one a New York day, about half of days) something good happens unasked: Lola sends a
//    freebie, a fan asks for a selfie, a stranger buys your drink, or a celebrity texts you an invite to their Scene move
//    (free when you start it today). The server rolls with a crypto random source (app/home/rewardActions.ts).
// Pure: the server, the preview and tests share it.

import type { ScoreId } from "./scene.ts";

export const HALFWAY = { at: 0.5, share: 0.25 } as const;

/** How far a goal's parts are (0 to 1); null for a yes/no goal (every part needs 1). */
export function goalShare(parts: { have: number; need: number }[]): number | null {
  if (!parts.length || parts.every((p) => p.need <= 1)) return null;
  return parts.reduce((n, p) => n + Math.min(1, p.need > 0 ? p.have / p.need : 1), 0) / parts.length;
}
export const halfwayPay = (reward: number) => Math.max(1, Math.floor(reward * HALFWAY.share));

export type SurpriseKind = "freebie" | "selfie" | "drink" | "invite";

export const SURPRISE = {
  /** The chance of a surprise on a New York day (rolled once, the first time the game asks that day). */
  chance: 0.5,
  freebieCash: (rank: number) => 50 + 25 * rank,
  selfieClout: (rank: number) => 10 * rank,
  drink: { energy: 15, mood: 5 },
} as const;

/** A surprise as the game shows it. */
export interface Surprise {
  kind: SurpriseKind;
  emoji: string;
  from: string;
  /** A cast member's portrait, or Lola's. */
  face: string | null;
  title: string;
  line: string;
  cash: number;
  clout: number;
  energy: number;
  mood: number;
  /** An invite: the Scene move and where to start it (free today). */
  invite?: { move: string; title: string; place: string; placeName: string } | null;
}

const LOLA_FACE = "/cast/lola-lowdown.webp";

/** Which surprises fit the player now: a drink only at a bar or club, a selfie from Rank 3, an invite when a celebrity hosts today. */
export function surpriseOptions(c: { rank: number; atNightlife: boolean; invite: Surprise["invite"] & { host: string; face: string | null } | null }): SurpriseKind[] {
  const out: SurpriseKind[] = ["freebie"];
  if (c.rank >= 3) out.push("selfie");
  if (c.atNightlife) out.push("drink");
  if (c.rank >= 2 && c.invite) out.push("invite", "invite");
  return out;
}

/** The surprise for a kind, with its reward for the player's rank. */
export function surpriseFor(kind: SurpriseKind, rank: number, invite?: (Surprise["invite"] & { host: string; face: string | null }) | null): Surprise {
  switch (kind) {
    case "freebie":
      return { kind, emoji: "🎁", from: "Lola", face: LOLA_FACE, title: "Lola sent you something", line: "“Found this in my bag. It’s yours. Don’t ask.”",
        cash: SURPRISE.freebieCash(rank), clout: 0, energy: 0, mood: 0 };
    case "selfie":
      return { kind, emoji: "🤳", from: "A fan", face: null, title: "A fan asked for a selfie", line: "You acted surprised. You were not surprised.",
        cash: 0, clout: SURPRISE.selfieClout(rank), energy: 0, mood: 0 };
    case "drink":
      return { kind, emoji: "🍹", from: "A stranger", face: null, title: "A stranger bought your drink", line: "“You’re that person from the thing!” You are.",
        cash: 0, clout: 0, energy: SURPRISE.drink.energy, mood: SURPRISE.drink.mood };
    case "invite":
      return { kind, emoji: "💌", from: invite?.host ?? "A celebrity", face: invite?.face ?? null,
        title: `${invite?.host ?? "Someone famous"} texted you`, line: `“Come to ${invite?.title ?? "my thing"} today. On me.” Start it at ${invite?.placeName ?? "the venue"} today and it’s free.`,
        cash: 0, clout: 0, energy: 0, mood: 0, invite: invite ? { move: invite.move, title: invite.title, place: invite.place, placeName: invite.placeName } : null };
  }
}

/** What week_recap() returns (last New York week, Monday to Sunday). */
export interface WeekRecap {
  week: string;
  clout: number;
  cash: number;
  fullDays: number;
  moves: number;
  plaques: number;
  scores: Partial<Record<ScoreId, number>>;
  best: { kind: string; clout: number } | null;
}

/** A ledger kind as a moment ("A promotion"). */
export const MOMENT: Record<string, string> = {
  scene: "A Scene move", scene_plaque: "A plaque", goal: "A goal", career_promo: "A promotion", career_screen: "Your face on screen",
  campaign_reward: "The campaign trail", campaign_poll: "Your poll numbers", hunt: "The treasure hunt", party: "A party",
  event: "A night out", date_night: "A date", couple_anniv: "An anniversary", visit_host: "Having people over", skill: "A new skill level",
  gala: "The Charity Gala", guide_chapter: "A Guide chapter", streak: "Your streak", home_score: "Your Crib Rating", surprise: "A surprise",
};
export const momentText = (kind: string) => MOMENT[kind] ?? "Something you did";
