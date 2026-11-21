// Fame perks and rewards that grow with you (owner, Nov 21: "build 1 and 2", after the reward-system review).
//
// 1. Fame perks: each rank adds something that feels like status, not just cash (FAME_PERKS). They're paid by a ledger
//    trigger (migration 0175, fame_on_ledger), so no payment code changes: the first event ticket of the week comes back
//    (Rank 2), the first meal of the day is on the house (Rank 3), one celebrity-hosted Scene move a day is free (Rank 4),
//    Lola writes a Spotlight about you at every rank from 5 (a players trigger), a Gala gift's clout is matched (Rank 7),
//    Scene moves pay 10% more with the paparazzi following (Rank 8), you can throw your own night (Rank 9, a Scene move)
//    and the Mayor names a day after you (Rank 10).
// 2. Rewards that grow with you: everyday rewards (daily tasks, the all-five bonus, visits, events, place activities) get
//    a bonus of 20% a rank above the first, up to ×2.8 at Rank 10 (ledger 'fame_scale', once per payment).
//
// Pure: GameShell, the perks sheet, tests and the migration's settings (fameSettings) share it.

import { RANKS } from "./ranks.ts";

export const FAME = {
  /** Everyday rewards: +20% a rank above the first, at most ×2.8. */
  perRank: 0.2,
  cap: 2.8,
  /** The ledger kinds that grow with rank (positive amounts only). */
  scaleKinds: ["daily_task", "daily_bonus", "visit", "event", "place_life"],
  /** Rank 8: Scene moves pay this much more. */
  paparazzi: 0.1,
} as const;

export const rewardMult = (rank: number) => Math.min(FAME.cap, 1 + FAME.perRank * Math.max(0, rank - 1));

export type PerkId = "ticket" | "comp" | "invite" | "spotlight" | "vip-medium" | "vip-all" | "match" | "paparazzi" | "own-night" | "day";

export interface FamePerk { rank: number; id: PerkId; emoji: string; title: string; line: string }

export const FAME_PERKS: FamePerk[] = [
  { rank: 2, id: "ticket", emoji: "🎟️", title: "A free event ticket every week", line: "Your first event ticket each week is on the house. The door staff are starting to recognise you." },
  { rank: 3, id: "comp", emoji: "🍳", title: "Your first meal of the day is comped", line: "Somewhere in Queens, a waiter tears up your bill. Every day." },
  { rank: 4, id: "invite", emoji: "💌", title: "Celebrities invite you", line: "One celebrity-hosted Scene move a day is free. They want you there." },
  { rank: 5, id: "spotlight", emoji: "📸", title: "Lola writes you up", line: "A Spotlight in the News, and another at every rank from here." },
  { rank: 6, id: "vip-medium", emoji: "🥂", title: "VIP on the house at the medium clubs", line: "Velvet rope? What velvet rope." },
  { rank: 7, id: "vip-all", emoji: "🍾", title: "Every VIP rope opens", line: "Nobody's sure whose kid you are. Nobody asks." },
  { rank: 7, id: "match", emoji: "🎗️", title: "Your charity gifts are matched", line: "Give at the Gala and the city matches your clout. Generous, visibly." },
  { rank: 8, id: "paparazzi", emoji: "📷", title: "The paparazzi follow you", line: "Every Scene move pays 10% more. Wear sunglasses. Act annoyed." },
  { rank: 9, id: "own-night", emoji: "🪩", title: "Throw your own night", line: "A Scene move that's yours alone: your name on the club's door for a night." },
  { rank: 10, id: "day", emoji: "🗽", title: "The Mayor names a day after you", line: "Mayor Papa-Dani declares it. The city speaks your name in hushed tones." },
];

/** Lola's Spotlight when a player reaches each rank from 5 ({name} is the player). No straight apostrophes (the SQL). */
export const SPOTLIGHT: Record<number, string> = {
  5: "📸 Lola’s Spotlight: {name} is officially On the List. The bouncers nod now. Sources say they practised nodding back.",
  6: "📸 Lola’s Spotlight: {name} is a Local Celebrity. Recognised at the grocery store; pretended not to be. Badly.",
  7: "📸 Lola’s Spotlight: {name} has Nepo Baby Energy now. Every VIP rope opens. Nobody’s sure whose kid they are.",
  8: "📸 Lola’s Spotlight: {name} is New Money Rich. The paparazzi have their schedule. Everything they own is still in the box.",
  9: "📸 Lola’s Spotlight: {name} made Self-Made Billionaire*. Terms and conditions apply. They’re throwing their own night.",
  10: "🗽 Mayor Papa-Dani declares today {name} Day. God Status. The city speaks their name in hushed tones.",
};

export function perksAt(rank: number): { have: FamePerk[]; next: FamePerk[] } {
  return { have: FAME_PERKS.filter((p) => p.rank <= rank), next: FAME_PERKS.filter((p) => p.rank > rank) };
}
export const rankName = (rank: number) => RANKS[Math.max(0, Math.min(RANKS.length, rank) - 1)]?.title ?? "";

/** game_settings 'fame' (migration 0175): what the ledger trigger needs. `hosted`: the Scene moves the cast hosts. */
export function fameSettings(hosted: string[]) {
  return {
    perRank: FAME.perRank, cap: FAME.cap, scaleKinds: [...FAME.scaleKinds], paparazzi: FAME.paparazzi,
    perks: { ticket: 2, comp: 3, invite: 4, spotlight: 5, match: 7, paparazzi: 8 },
    spotlight: SPOTLIGHT, hosted: [...hosted].sort(),
  };
}
