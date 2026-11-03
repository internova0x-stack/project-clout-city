// NPC favors and friendships (owner, Nov 3: "Talking to NPCs should bring up the opportunity to take actions to help the
// NPC"; "go with your recommendation"). Pure, so the server, the preview and the tests share it. Mirrors game_settings
// 'npc_bonds' (migration 0159; tests/npcBonds.test.ts keeps them equal).
//   * A favor is a Moral Choices card with `where.after: ["talk"]` and a `who` (content/choices/favors.json): the regular
//     brings it up when the player talks to them, at most 2 a New York day and once every 3 days per regular.
//   * Every card with a `who` moves the friendship: an outcome toward Halo is a favor done (+1), toward Hustler is taking
//     advantage (−2; at Family it burns the friendship for 30 days), neither is a pass.
//   * Levels by favors done: Friendly 2, Friend 5 (a weekly "on the house" at their place), Family 10 (a big favor back once
//     a month: C$300, or Sgt. Bev gets you out of holding).

import type { ChoiceCard } from "./choices.ts";

export const NPC_BONDS = {
  levels: { friendly: 2, friend: 5, family: 10 },
  favorsPerDay: 2,
  askEveryDays: 3,
  exploitCost: 2,
  burnDays: 30,
  perk: { energy: 10, mood: 8 },
  bigEveryDays: 30,
  big: { cash: 300, holding: ["sgt-bev"] },
} as const;

export type BondLevel = "stranger" | "friendly" | "friend" | "family";

export function bondLevel(favors: number): BondLevel {
  const l = NPC_BONDS.levels;
  return favors >= l.family ? "family" : favors >= l.friend ? "friend" : favors >= l.friendly ? "friendly" : "stranger";
}

export const LEVEL_NAME: Record<BondLevel, string> = { stranger: "Stranger", friendly: "Friendly", friend: "Friend", family: "Family" };

/** Favors to the next level (null at Family). */
export function toNext(favors: number): { level: BondLevel; need: number } | null {
  const l = NPC_BONDS.levels;
  if (favors < l.friendly) return { level: "friendly", need: l.friendly - favors };
  if (favors < l.friend) return { level: "friend", need: l.friend - favors };
  if (favors < l.family) return { level: "family", need: l.family - favors };
  return null;
}

/** What a choice did to the friendship, from the outcome's nudge to the meter. */
export function bondKind(integrity: number | undefined): "help" | "exploit" | "pass" {
  return (integrity ?? 0) > 0 ? "help" : (integrity ?? 0) < 0 ? "exploit" : "pass";
}

/** The big favor a Family regular does once a month. */
export function bigFavorOf(npc: string): { kind: "cash"; cash: number } | { kind: "holding" } {
  return (NPC_BONDS.big.holding as readonly string[]).includes(npc) ? { kind: "holding" } : { kind: "cash", cash: NPC_BONDS.big.cash };
}

/** One regular's friendship as npc_bonds_state() returns it. */
export interface Bond {
  npc: string;
  favors: number;
  level: BondLevel;
  /** Burned: they won't ask (or do favors back) until then. */
  burnedUntil: string | null;
  /** Friend+: today's "on the house" is ready (once a New York week). */
  perkReady: boolean;
  /** Family: the monthly big favor is ready. */
  bigReady: boolean;
}

/** What the regular says when they have a favor to ask (the chip under their line). */
export interface FavorPeek { npc: string; emoji: string; title: string }

/** The favor a regular would ask today: the same one all day (seeded by day and regular), not seen in 30 days. */
export function pickFavor(cards: readonly ChoiceCard[], npc: string, ctx: {
  today: string; integrity: number; rank: number; history: { id: string; day: string }[];
}): ChoiceCard | null {
  const since = new Date(Date.parse(`${ctx.today}T12:00:00Z`) - 30 * 86_400_000).toISOString().slice(0, 10);
  const seen = new Set(ctx.history.filter((h) => h.day >= since).map((h) => h.id));
  const pool = cards.filter((c) => c.who === npc && c.where?.after?.includes("talk") && !c.chainOnly && !seen.has(c.id)
    && (c.needs?.integrityMin == null || ctx.integrity >= c.needs.integrityMin)
    && (c.needs?.integrityMax == null || ctx.integrity <= c.needs.integrityMax)
    && (c.needs?.rank == null || ctx.rank >= c.needs.rank));
  if (!pool.length) return null;
  let h = 0;
  for (const ch of `${ctx.today}:${npc}`) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return pool[h % pool.length];
}
