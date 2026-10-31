// Careers in the preview (/preview/home?career=...): the same rules as the server, in memory, with the real task file.
// Presets: new (no job, every track open), apply (the Careers list with the skills to apply anywhere), work (hired at
// Grind & Gossip, standing there, today's workday not started), day (mid-workday), review (a review with a promotion
// just landed), warning (a warning on the last review), fired (just fired). "Next day" comes 4 seconds after a workday
// ends, and a review every 3 preview days, so the loop can be walked in a minute.

import {
  CareerError, addDays, answerTask, careerError, careerView, hire, office, quit, stickItOut, refresh, startDay, trackCards,
  type CareerApi, type CareerCtx, type CareerResult, type CareerScreen, type CareerState,
} from "./careers";
import { CAREER_CONTENT as content } from "./careersContent";
import { changeOn, type AspirationState } from "./aspirations";

export function createCareerSim(preset: string | null, opts: { clout: number; energy: number; atPlace: () => string | null; onBank?: (delta: number) => void; onEnergy?: (delta: number) => void }): CareerApi {
  const rng = Math.random;
  let day = "2026-11-02";
  let energy = Math.max(60, opts.energy);
  const skills = preset === "new" ? { gossip: 2 } : { charisma: 4, cooking: 3, smarts: 4, hustle: 3, gossip: 4, photography: 3 };
  let state: CareerState | null = null;
  // Aspirations (migration 0143): ?career=welcome opens with no pick (the welcome screen); every other preset has one.
  let asp: AspirationState = preset === "welcome" || preset === "new"
    ? { aspiration: null, chosenAt: null, degree: false, exams: 1 }
    : { aspiration: preset === "cityhall" ? "public" : "hustler", chosenAt: "2026-10-30", degree: false, exams: 1 };
  // Like career_context's past jobs: the one that ended, so reapplying waits.
  const past = (): CareerCtx["past"] => (state && state.status !== "employed"
    ? { [state.track]: { best: state.level, fired: state.status === "fired" ? 1 : 0, lastStatus: state.status, lastEnded: state.endedOn } } : {});
  const ctx = (): CareerCtx => ({ clout: Math.max(opts.clout, 600), crew: 2, energy, atPlace: preset === "cityhall" ? "city-hall-annex" : ["work", "day", "office", "grudge", "boss", "quit"].includes(preset ?? "") ? "grind-and-gossip" : opts.atPlace(), shiftsToday: 0, skills, past: past(), aspiration: asp.aspiration, degree: asp.degree, businesses: 1 });
  let timer: ReturnType<typeof setTimeout> | null = null;

  if (preset && !["new", "apply", "welcome"].includes(preset)) {
    // ?career=cityhall: a Public Servant at the Mayor's office, clocked in.
    state = hire(`preview-${Date.now()}`, preset === "cityhall" ? "cityhall" : "hospitality", ctx(), "honest", day);
    if (preset === "day" || preset === "office" || preset === "grudge" || preset === "boss" || preset === "quit" || preset === "cityhall") startDay(content, state, "steady", ctx(), day, rng);
    // ?career=office: clocked in with a joint project on; ?career=grudge: Kendall holds a grudge that strikes today.
    if (preset === "office") { state.workMood = 72; state.team = { with: "friend", due: state.nextReview }; }
    if (preset === "grudge") { state.workMood = 34; state.trust.rival = 20; state.grudges = [{ who: "rival", level: 2, due: day }]; }
    // ?career=boss: the big boss likes you and you're performing: Push the boss out is open. ?career=quit: work mood 22, the quit card.
    if (preset === "boss") { state.bigBoss = 72; state.performance = 78; state.mentored = 2; }
    if (preset === "quit") { state.workMood = 22; }
    if (preset === "review" || preset === "warning" || preset === "fired") {
      state.performance = preset === "review" ? 82 : 30;
      state.trust.manager = preset === "review" ? 70 : 40;
      if (preset === "review") state.reviewsAtLevel = 1;
      if (preset === "fired") state.warnings = 1;
      state.worked = preset === "review" ? ["a", "b", "c", "d", "e"] : ["a"];
      refresh(state, state.nextReview, ctx(), rng);
      day = state.periodStart;
    }
  }

  const screen = (receipt?: string): CareerResult<CareerScreen> => ({
    ok: true,
    data: { tracks: trackCards(ctx(), day), canConnect: true, job: state ? careerView(content, state, day, ctx()) : null, energy, atPlace: ctx().atPlace, receipt, aspiration: asp, businesses: 1 },
  });
  const pay = (ps: { currency: string; amount: number }[]) => { for (const p of ps) if (p.currency === "cash") opts.onBank?.(p.amount); };
  const nextDay = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      day = addDays(day, 1);
      // A review every 3 preview days, so payday comes quickly.
      if (state && state.status === "employed" && state.worked.length >= 3) state.nextReview = day;
      if (state) pay(refresh(state, day, ctx(), rng).payouts);
      energy = Math.min(100, energy + 40);
    }, 4000);
  };
  const act = (fn: (s: CareerState) => { effects?: { energy?: number }; payouts?: { currency: string; amount: number }[]; receipt?: string } | void): CareerResult<CareerScreen> => {
    if (!state || state.status !== "employed") return { ok: false, error: careerError("not_employed") };
    try {
      pay(refresh(state, day, ctx(), rng).payouts);
      const r = fn(state) || {};
      if (r.effects?.energy) { energy = Math.max(0, Math.min(100, energy + r.effects.energy)); opts.onEnergy?.(r.effects.energy); }
      pay(r.payouts ?? []);
      if (state.today?.done) nextDay();
      return screen(r.receipt);
    } catch (e) {
      if (e instanceof CareerError) return { ok: false, error: careerError(e.code) };
      throw e;
    }
  };

  return {
    aspire: async (id) => {
      if (asp.aspiration && asp.aspiration !== id && changeOn(asp.chosenAt, day)) return { ok: false, error: "You can pick a new aspiration 30 days after the last one." };
      asp = { ...asp, aspiration: id, chosenAt: asp.aspiration === id ? asp.chosenAt : day };
      return screen();
    },
    screen: async () => { if (state) pay(refresh(state, day, ctx(), rng).payouts); return screen(); },
    apply: async (track, answer) => {
      if (state?.status === "employed") return { ok: false, error: careerError("employed") };
      try {
        state = hire(`preview-${Date.now()}`, track, ctx(), answer, day);
        return screen("You're hired! First day whenever you're ready.");
      } catch (e) {
        if (e instanceof CareerError) return { ok: false, error: careerError(e.code) };
        throw e;
      }
    },
    start: async (style) => act((s) => startDay(content, s, style, ctx(), day, rng)),
    task: async (i, o) => act((s) => answerTask(content, s, i, o, ctx(), rng)),
    office: async (a, w) => act((s) => office(s, a, w, ctx(), day, rng)),
    quit: async (reason) => act((s) => quit(s, day, { reason, businesses: 1 })),
    stick: async () => act((s) => stickItOut(s, day)),
  };
}

export const CAREER_PRESETS = ["welcome", "new", "apply", "work", "day", "office", "grudge", "boss", "quit", "cityhall", "review", "warning", "fired"] as const;
