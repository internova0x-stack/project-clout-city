// The Homecoming race in the preview (/preview/home?school=...): the same engine as the server (lib/schoolRace.ts), in memory,
// with the real content. Presets:
//   intro       enrolled at St. Johnsons, no race yet, standing on the Quad: Meet the rival
//   declare     the same, for Crown HQ's Declare screen (?open=crown)
//   plan        week 2, Tuesday: the planner
//   clash       week 2, Thursday: the Theta Mu rager waits on the Moral Choices card
//   verdict     week 2, Saturday: Friday's verdict is in (the results card, once per device)
//   crown       Homecoming is over: Homecoming night and the result
//   hq          week 2, Tuesday, with mail answered and a budget planned
//   ineligible  not enrolled: the Declare screen says why
// A preview day passes every 20 seconds of play (on the next read), so the loop can be walked in a few minutes.
// `crown` follows the preview player's look (modelSex); `&crown=king|queen` overrides it.

import { RACE_CONTENT as content } from "./schoolContent";
import {
  RaceError, addDays, choose, nextMonday, raceView, refresh, reply, setBudget, setSlot, startRace,
  type Crown, type Payout, type RaceState,
} from "./schoolRace";
import { schoolError, schoolPortrait, type SchoolApi, type SchoolResult, type SchoolScreen } from "./schoolApi";

export const SCHOOL_PRESETS = ["intro", "declare", "plan", "clash", "verdict", "crown", "hq", "ineligible"] as const;

const CAMPUS = "st-johnsons";
/** The semester's Monday in the preview; presets fake "today" from it. */
const START = "2026-11-02";
const TODAY_OF: Record<string, number> = { plan: 8, hq: 8, clash: 10, verdict: 12, crown: 27 };
const DAY_MS = 20_000;

export function createSchoolSim(preset: string | null, opts: { crown: Crown; bank: () => number; onPay?: (p: { cash?: number; clout?: number; mood?: number }) => void }): SchoolApi {
  const rng = Math.random;
  const enrolled = preset !== "ineligible";
  let state: RaceState | null = null;
  let today = preset && TODAY_OF[preset] !== undefined ? addDays(START, TODAY_OF[preset]) : addDays(START, -2);
  let lastTick = Date.now();
  let spent = 0;

  const pay = (ps: Payout[]) => {
    for (const p of ps) {
      if (p.currency === "cash") { spent -= p.amount; opts.onPay?.({ cash: p.amount }); }
      else if (p.currency === "clout") opts.onPay?.({ clout: p.amount });
      else if (p.currency === "mood") opts.onPay?.({ mood: p.amount });
    }
  };

  if (preset && TODAY_OF[preset] !== undefined) {
    const s = startRace(content, { id: `preview-${preset}`, campus: CAMPUS, crown: opts.crown, startOn: START, job: true, dating: false });
    // A good-ish first week, so the presets don't open on a nobody.
    s.plan = [["class", "club"], ["class", "hang"], ["class", "study"], ["class", "party"], ["class", "sleep"], ["work", "party"], ["sleep", "study"]];
    if (preset === "crown") { s.rep = 70; s.standing = { greek: 0, theater: 2, finance: 1, athletes: -1, influencers: 2 }; }
    refresh(content, s, today, rng);
    if (preset === "hq") {
      s.budget = { party: 300, look: 150, merch: 100, tutor: 0, squad: 200 };
      const m = s.inbox.find((x) => x.id === "m-dee");
      if (m) { const msg = content.inbox.find((x) => x.id === m.id)!; reply(content, s, m.id, msg.options[0].id, rng); }
    }
    state = s;
  }

  const tick = () => {
    if (!state || state.phase !== "running") return;
    if (Date.now() - lastTick < DAY_MS) return;
    lastTick = Date.now();
    today = addDays(today, 1);
    pay(refresh(content, state, today, rng).payouts);
  };

  const screen = (receipt?: string): SchoolResult<SchoolScreen> => {
    const running = state?.phase === "running";
    const block = !enrolled ? "not_enrolled" : running ? "running" : null;
    const crown = state?.crown ?? opts.crown;
    const rival = content.rivals.find((r) => r.id === state?.rival) ?? content.rivals.find((r) => r.crown === crown && r.campus === CAMPUS) ?? null;
    return {
      ok: true,
      data: {
        campus: enrolled ? CAMPUS : null, crown,
        rival: rival ? { id: rival.id, name: rival.name, role: rival.role, vibe: rival.vibe, entrance: rival.entrance, portrait: schoolPortrait(rival.id) } : null,
        canDeclare: !block, block, blockText: block ? schoolError(block) : null,
        startsOn: nextMonday(today), bank: Math.max(0, opts.bank() - spent),
        can: { club: true, date: false, work: true },
        view: state ? raceView(content, state, today) : null,
        receipt,
      },
    };
  };
  const act = (fn: (s: RaceState) => string | void): Promise<SchoolResult<SchoolScreen>> => {
    if (!state) return Promise.resolve({ ok: false, error: schoolError("no_race") });
    try {
      const receipt = fn(state);
      pay(refresh(content, state, today, rng).payouts);
      return Promise.resolve(screen(receipt || undefined));
    } catch (e) {
      if (e instanceof RaceError) return Promise.resolve({ ok: false, error: schoolError(e.code) });
      throw e;
    }
  };

  return {
    screen: async () => { tick(); if (state) pay(refresh(content, state, today, rng).payouts); return screen(); },
    declare: async () => {
      if (!enrolled) return { ok: false, error: schoolError("not_enrolled") };
      if (state?.phase === "running") return { ok: false, error: schoolError("running") };
      // The race starts the next Monday; the preview starts it at once (today is that Monday) so the planner opens.
      today = nextMonday(today);
      lastTick = Date.now();
      state = startRace(content, { id: `preview-${Date.now()}`, campus: CAMPUS, crown: opts.crown, startOn: today, job: true, dating: false });
      pay(refresh(content, state, today, rng).payouts);
      return screen("You're on the ballot. Homecoming in 4 weeks.");
    },
    slot: (day, slot, a) => act((s) => { setSlot(s, today, day, slot, a, screen().ok ? { club: true, date: false, work: true } : { club: false, date: false, work: false }); }),
    budget: (b) => act((s) => {
      const next = { ...s.budget, ...b };
      const total = Object.values(next).reduce((x, y) => x + (y ?? 0), 0);
      if (total > Math.max(0, opts.bank() - spent)) throw new RaceError("no_cash");
      setBudget(s, b);
    }),
    choose: (card, option) => act((s) => { const r = choose(content, s, card, option, rng); pay(r.payouts); return r.receipt.split("{Rival}").join(rivalFirst(s)).split("{rival}").join(rivalFirst(s)); }),
    reply: (msg, option) => act((s) => { pay(reply(content, s, msg, option, rng)); }),
  };
}

function rivalFirst(s: RaceState): string {
  return (content.rivals.find((r) => r.id === s.rival)?.name ?? "").split(" ")[0];
}
