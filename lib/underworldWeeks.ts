// The underworld, part 2: weekly jobs for Pablo (owner, Oct 31: "Underworld, part 2"; spec section 31). The weekly
// routine drafts 2 to 5 new jobs into content/underworld-weeks/<Monday>.json. The game server stores each one; it goes
// live 24 hours later unless the owner vetoes or pauses it in Studio → Storylets → Pablo's jobs (automatic with a veto
// window, like storylets; it follows the 'storylets' autopilot switch). A live weekly job joins Pablo's pool; a vetoed
// one that already went live is never dealt again but still explains an old trace.
//
// Pure: the validator (scripts/validate-content.ts, lib/contentImport.ts, tests) and the Studio's types.

import { contentProblems, type Job, type UnderworldContent } from "./underworld.ts";

export const UNDERWORLD_WEEKS = {
  windowHours: 24,
  perWeek: { min: 2, max: 5 },
} as const;

export interface UnderworldWeek { week: string; jobs: Job[] }
export type UnderworldJobStatus = "scheduled" | "paused" | "vetoed" | "live";

/** One job in Studio → Storylets → Pablo's jobs (admin_underworld_jobs). */
export interface StudioUnderworldJob {
  id: string; week: string; job: Job; status: UnderworldJobStatus; live_at: string; arrived_at: string; decided_at: string | null;
}

/** What underworld_jobs_live() returns: every job that went live, `offer` while it's live now. */
export interface LiveUnderworldJob { job: Job; offer: boolean }

const isMonday = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && new Date(`${d}T12:00:00Z`).getUTCDay() === 1;

/** Checks a week file: a Monday and 2 to 5 jobs, each passing the job rules beside the jobs already in the game. */
export function validateUnderworldWeek(raw: unknown, base: UnderworldContent, others: readonly Job[] = []):
  { ok: true; week: UnderworldWeek } | { ok: false; problems: string[] } {
  const out: string[] = [];
  const w = raw as Partial<UnderworldWeek> | null;
  if (!w || typeof w !== "object") return { ok: false, problems: ["the file must be an object with week and jobs"] };
  if (typeof w.week !== "string" || !isMonday(w.week)) out.push("week must be a Monday (YYYY-MM-DD)");
  const jobs = Array.isArray(w.jobs) ? w.jobs : [];
  const { min, max } = UNDERWORLD_WEEKS.perWeek;
  if (jobs.length < min || jobs.length > max) out.push(`a week has ${min} to ${max} jobs (this one has ${jobs.length})`);
  const taken = new Set([...base.jobs, ...others].map((j) => j.id));
  for (const j of jobs) if (taken.has(j?.id)) out.push(`job ${j?.id}: that id is already in the game`);
  const ids = new Set(jobs.map((j) => j?.id));
  // The job rules, with this week's jobs beside the game's own (only this week's problems count).
  const all = contentProblems({ ...base, jobs: [...base.jobs, ...jobs] });
  out.push(...all.filter((p) => [...ids].some((id) => p.startsWith(`job ${id}:`) || p.startsWith(`job ${id} `))));
  return out.length ? { ok: false, problems: out } : { ok: true, week: { week: w.week!, jobs } };
}

/** Pablo's pool for today: the game's jobs plus the weekly jobs live now; the ones no longer offered stay findable. */
export function withWeekly(base: UnderworldContent, live: readonly LiveUnderworldJob[]): UnderworldContent {
  const ids = new Set(base.jobs.map((j) => j.id));
  const fresh = live.filter((l) => !ids.has(l.job.id));
  return { ...base, jobs: [...base.jobs, ...fresh.filter((l) => l.offer).map((l) => l.job)], archive: fresh.filter((l) => !l.offer).map((l) => l.job) };
}
