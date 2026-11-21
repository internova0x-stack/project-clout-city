// Your Scene's weekly moves (migration 0174; owner, Nov 21: "Do the scenes update daily?"). The weekly routine writes
// content/scene-weeks/<Monday>.json: 6 to 10 new moves tied to that week's news, story and cast (docs/WEEKLY-CONTENT.md).
// The game stores each new one scheduled, live 24 hours later unless vetoed in Studio → Storylets → Scene moves, and gone
// again after its week (a week's moves run Monday to Sunday). A move already stored keeps the Studio's decision.
// Pure: validate:content, the content sync (lib/contentImport.ts) and tests run it.

import { moveProblems, type SceneMove } from "./scene.ts";

export interface SceneWeek { week: string; moves: SceneMove[] }
export type SceneMoveStatus = "scheduled" | "paused" | "vetoed" | "live";
/** The Studio's row for one weekly move. */
export interface StudioSceneMove { id: string; week: string; move: SceneMove; status: SceneMoveStatus; live_at: string; arrived_at: string; decided_at: string | null }
/** What scene_weeks_live() returns: every weekly move that went live, `offer` while players can start it. */
export interface LiveSceneMove { move: SceneMove; offer: boolean }

const isMonday = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && new Date(`${d}T12:00:00Z`).getUTCDay() === 1;

/** A week file: a Monday, 6 to 10 moves passing the move rules, ids new beside the game's and earlier weeks', `days` valid. */
export function validateSceneWeek(raw: unknown, ctx: { base: readonly SceneMove[]; others?: readonly SceneMove[]; places: Set<string>; characters: Set<string> }):
  { ok: true; week: SceneWeek } | { ok: false; problems: string[] } {
  const problems: string[] = [];
  const w = raw as Partial<SceneWeek> | null;
  if (!w || typeof w !== "object") return { ok: false, problems: ["not an object"] };
  if (typeof w.week !== "string" || !isMonday(w.week)) problems.push("week must be a Monday (YYYY-MM-DD)");
  const moves = Array.isArray(w.moves) ? w.moves : [];
  if (moves.length < 6 || moves.length > 10) problems.push("a week has 6 to 10 moves");
  const taken = new Set([...ctx.base, ...(ctx.others ?? [])].map((m) => m.id));
  for (const m of moves) {
    if (taken.has(m.id)) problems.push(`scene move ${m.id}: id already used`);
    if (m.days && (!Array.isArray(m.days) || !m.days.length || m.days.some((d) => !Number.isInteger(d) || d < 1 || d > 7))) problems.push(`scene move ${m.id}: days are ISO weekdays 1 to 7`);
    if (m.week !== undefined && m.week !== w.week) problems.push(`scene move ${m.id}: week must match the file`);
  }
  problems.push(...moveProblems(moves as SceneMove[], ctx.places, ctx.characters));
  if (problems.length) return { ok: false, problems };
  return { ok: true, week: { week: w.week!, moves: (moves as SceneMove[]).map((m) => ({ ...m, week: w.week! })) } };
}
