// Borough gates (owner, Oct 17): Queens is open from day one; the others open for everyone, one at a time and
// in order (Manhattan last), the moment enough people are out at once. Each borough has its own target
// (migration 0069). The server decides (borough_state()); this file only holds the shape, the
// targets shown before the server answers, and the copy. Safe to import anywhere.

import type { BoroughId } from "./map/boroughs";

/** One locked (or newly opened) borough as the server reports it. */
export interface BoroughGate {
  id: BoroughId;
  open: boolean;
  /** Players out at once that open it, the moment they are. */
  target: number;
  /** Players out right now (checked in within the last couple of minutes). */
  online: number;
  /** Today's peak so far. */
  peakToday: number;
  /** Next in line: the borough before it has opened. */
  counting?: boolean;
}

/** Each borough's rule, shown before the server has answered (mirrors borough_gates, migration 0069). */
export const GATE_RULES: Record<Exclude<BoroughId, "queens">, { target: number }> = {
  brooklyn: { target: 100 },
  bronx: { target: 250 },
  staten_island: { target: 500 },
  manhattan: { target: 1000 },
};

/** A borough's rule: the server's when it has answered, else the table above (none for Queens). */
export function ruleFor(id: BoroughId, gates?: readonly BoroughGate[] | null): { target: number } | null {
  return gates?.find((g) => g.id === id) ?? (id === "queens" ? null : GATE_RULES[id]);
}

/** "Opens the moment 100 people are out at once." */
export function gateRule(g: Pick<BoroughGate, "target">): string {
  return `Opens the moment ${g.target.toLocaleString("en-US")} people are out at once.`;
}

/** "37 of 100 out right now · today's peak 64" */
export function gateProgress(g: BoroughGate): string {
  return `${g.online.toLocaleString("en-US")} of ${g.target.toLocaleString("en-US")} out right now · today's peak ${g.peakToday.toLocaleString("en-US")}`;
}

/** The boroughs open to everyone: Queens plus every gate that has opened. */
export function openBoroughs(gates: readonly BoroughGate[] | null | undefined): Set<BoroughId> {
  return new Set<BoroughId>(["queens", ...(gates ?? []).filter((g) => g.open).map((g) => g.id)]);
}
