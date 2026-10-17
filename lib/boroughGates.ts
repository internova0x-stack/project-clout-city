// Borough gates (owner, Oct 17): Queens is open from day one; the next borough opens for everyone once
// enough people are out at once, on enough different days. The server decides (borough_state()); this
// file only holds the shape and the copy. Safe to import anywhere.

import type { BoroughId } from "./map/boroughs";

/** One locked (or newly opened) borough as the server reports it. */
export interface BoroughGate {
  id: BoroughId;
  open: boolean;
  /** Players out at once needed on a day for it to count. */
  target: number;
  /** Days that have to reach the target. */
  daysNeeded: number;
  /** Days that have reached it so far. */
  daysHit: number;
  /** Players out right now (checked in within the last couple of minutes). */
  online: number;
  /** Today's peak so far. */
  peakToday: number;
}

/** The rule, shown before the server has answered. */
export const GATE_RULE = { target: 100, days: 3 } as const;

/** "Opens when 100 people are out at once, on 3 different days." */
export function gateRule(g: Pick<BoroughGate, "target" | "daysNeeded">): string {
  return `Opens when ${g.target} people are out at once, on ${g.daysNeeded} different days.`;
}

/** "37 out right now · today's peak 64 · 1 of 3 days" */
export function gateProgress(g: BoroughGate): string {
  return `${g.online} out right now · today's peak ${g.peakToday} · ${Math.min(g.daysHit, g.daysNeeded)} of ${g.daysNeeded} days`;
}

/** The boroughs open to everyone: Queens plus every gate that has opened. */
export function openBoroughs(gates: readonly BoroughGate[] | null | undefined): Set<BoroughId> {
  return new Set<BoroughId>(["queens", ...(gates ?? []).filter((g) => g.open).map((g) => g.id)]);
}
