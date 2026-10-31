// The underworld in the preview (/preview/home?underworld=...): the same rules as the server, in memory, with the real job
// file. Presets: locked (no invitation yet), new (invited, Pablo's intro), jobs (Corner Regular, in the back room, today's
// three jobs), pro (Pablo's Guy: the big jobs), hot (Heat 85: Pablo turns you away), caught (an old job came back: a fine
// and a Blotter line), lawyer (Whitlock & Hale on retainer). A New York day passes 4 seconds after the day's jobs are done.

import {
  UnderworldError, addDays, doJob, markSeen, newState, refresh, retainLawyer, sitTable, underworldError, view,
  type Change, type UnderworldApi, type UnderworldCtx, type UnderworldResult, type UnderworldScreen, type UnderworldState,
} from "./underworld";
import { UNDERWORLD_CONTENT } from "./underworldContent";
import { withWeekly } from "./underworldWeeks";
import WEEK from "../content/underworld-weeks/2026-11-02.json";

export const UNDERWORLD_PRESETS = ["locked", "new", "jobs", "pro", "hot", "caught", "lawyer", "crew", "table", "weekly"] as const;

// Part 2: the preview plays the first weekly file as live (?underworld=weekly deals its jobs first).
const content = withWeekly(UNDERWORLD_CONTENT, (WEEK.jobs as unknown as Parameters<typeof withWeekly>[1][number]["job"][]).map((job) => ({ job, offer: true })));

export function createUnderworldSim(preset: string | null, opts: { atPlace: () => string | null; bank: () => number; onBank?: (delta: number) => void; onEnergy?: (delta: number) => void }): UnderworldApi {
  const rng = Math.random;
  let day = "2026-11-02";
  let energy = 90;
  let holding = false;
  const there = preset && !["locked", "new"].includes(preset);
  const ctx = (): UnderworldCtx => ({
    rank: 2, integrity: preset === "table" ? 22 : 40, shady: preset !== "locked", atPlace: there ? "pablos-luggage" : opts.atPlace(), energy, bank: opts.bank(), holding, lawJob: false,
  });
  let state: UnderworldState | null = null;
  if (preset && preset !== "locked") {
    state = newState(day);
    state.met = preset !== "new";
    if (preset === "jobs" || preset === "caught" || preset === "lawyer") { state.rep = 22; state.heat = 18; state.jobsDone = 6; state.earned = 1340; }
    if (preset === "pro") { state.rep = 66; state.heat = 30; state.jobsDone = 31; state.earned = 14200; state.busts = 3; }
    if (preset === "hot") { state.rep = 40; state.heat = 85; state.jobsDone = 14; state.earned = 5100; state.busts = 2; }
    if (preset === "lawyer") state.lawyerUntil = addDays(day, 6);
    // ?underworld=crew: Tito at 85 (he'll take the fall this week), Gigi at 62 (her jobs pay more), Auntie Bee new.
    if (preset === "crew" || preset === "table") { state.rep = 38; state.heat = 22; state.jobsDone = 19; state.earned = 6300; state.crew = { tito: 85, gigi: 62, "auntie-bee": 30 }; }
    if (preset === "caught") {
      state.heat = 55;
      state.day = addDays(day, -1);
      state.traces = [{ id: `${addDays(day, -2)}:found-laptop`, job: "found-laptop", weight: 0.5, day: addDays(day, -2), pay: 180 }];
      // The roll that finds it.
      const found = refresh(content, state, day, ctx(), () => 0);
      pay(found);
    }
    refresh(content, state, day, ctx(), rng);
    if (preset === "weekly") state.offers = { day, ids: (WEEK.jobs as { id: string }[]).map((j) => j.id), done: [] };
  }
  function pay(c: Change) {
    for (const p of c.payouts) opts.onBank?.(p.amount);
    if (c.energy) { energy = Math.max(0, energy + c.energy); opts.onEnergy?.(c.energy); }
    if (c.holding) holding = true;
  }
  let timer: ReturnType<typeof setTimeout> | null = null;
  const nextDay = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      day = addDays(day, 1);
      energy = Math.min(100, energy + 40);
      holding = false;
      if (state) pay(refresh(content, state, day, ctx(), rng));
    }, 4000);
  };
  const screen = (extra: Partial<UnderworldScreen> = {}): UnderworldResult<UnderworldScreen> => ({ ok: true, data: { view: view(content, state, day, ctx()), ...extra } });
  const act = (fn: (s: UnderworldState) => Change & { receipt?: string; outcome?: UnderworldScreen["outcome"] }): UnderworldResult<UnderworldScreen> => {
    if (!state) return { ok: false, error: underworldError("locked") };
    try {
      pay(refresh(content, state, day, ctx(), rng));
      const r = fn(state);
      pay(r);
      if (state.offers.done.length >= state.offers.ids.length) nextDay();
      return screen({ receipt: r.receipt, outcome: r.outcome });
    } catch (e) {
      if (e instanceof UnderworldError) return { ok: false, error: underworldError(e.code) };
      throw e;
    }
  };
  return {
    screen: async () => { if (state) pay(refresh(content, state, day, ctx(), rng)); return screen(); },
    job: async (job, option) => act((s) => doJob(content, s, job, option, day, ctx(), rng)),
    lawyer: async () => act((s) => retainLawyer(s, day, ctx())),
    table: async () => act((s) => sitTable(content, s, day, ctx(), rng)),
    seen: async () => act((s) => ({ payouts: [], holding: 0, headline: null, energy: 0, mood: 0, integrity: 0, changed: markSeen(s) })),
  };
}
