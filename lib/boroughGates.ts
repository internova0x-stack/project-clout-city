// Borough gates (owner, Oct 17): Queens is open from day one; the others open for everyone, one at a time and
// in order (Manhattan last), once enough people are out at once on enough different days. Each borough has
// its own target (migration 0069). The server decides (borough_state()); this file only holds the shape, the
// targets shown before the server answers, and the copy. Safe to import anywhere.

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
  /** Its days are being counted now (the borough before it has opened). */
  counting?: boolean;
}

/** Each borough's rule, shown before the server has answered (mirrors borough_gates, migration 0069). */
export const GATE_RULES: Record<Exclude<BoroughId, "queens">, { target: number; daysNeeded: number }> = {
  brooklyn: { target: 100, daysNeeded: 3 },
  bronx: { target: 250, daysNeeded: 3 },
  staten_island: { target: 500, daysNeeded: 3 },
  manhattan: { target: 1000, daysNeeded: 3 },
};

/** A borough's rule: the server's when it has answered, else the table above (none for Queens). */
export function ruleFor(id: BoroughId, gates?: readonly BoroughGate[] | null): { target: number; daysNeeded: number } | null {
  return gates?.find((g) => g.id === id) ?? (id === "queens" ? null : GATE_RULES[id]);
}

/** "Opens when 100 people are out at once, on 3 different days." */
export function gateRule(g: Pick<BoroughGate, "target" | "daysNeeded">): string {
  return `Opens when ${g.target.toLocaleString("en-US")} people are out at once, on ${g.daysNeeded} different days.`;
}

/** "37 out right now · today's peak 64 · 1 of 3 days" */
export function gateProgress(g: BoroughGate): string {
  return `${g.online} out right now · today's peak ${g.peakToday} · ${Math.min(g.daysHit, g.daysNeeded)} of ${g.daysNeeded} days`;
}

/** The boroughs open to everyone: Queens plus every gate that has opened. */
export function openBoroughs(gates: readonly BoroughGate[] | null | undefined): Set<BoroughId> {
  return new Set<BoroughId>(["queens", ...(gates ?? []).filter((g) => g.open).map((g) => g.id)]);
}
