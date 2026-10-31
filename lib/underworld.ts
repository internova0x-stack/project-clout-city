// The underworld, part 1 (owner, Oct 31: "The underworld"; "Invite only", "Bite but recover"; spec section 31).
// Pablo, an invented fixer, runs a back room behind Pablo's Luggage & Notary in Astoria (it has never sold a
// suitcase). He offers 3 jobs a day: knockoff sneakers, a "found" laptop, scalped tickets, a rigged hot-dog contest. Each is
// a You get / It costs card with hidden outcomes, like a career task. Jobs pay cash and Street Rep (which opens bigger jobs)
// and raise Heat: how close the 114½ Precinct is to you. Heat drops every New York day, faster on a day you lay low. A job
// can leave a trace that the precinct may find on a later day: a fine (the job's pay and some), up to 3 hours in holding,
// Street Rep down and a Lola's Blotter headline. Never your home, career or crew. A Whitlock & Hale retainer halves fines
// and takes an hour off holding. Street Rep helps a campaign's dark ops a little (lib/campaignEngine.ts resolveOp).
//
// Guardrails: no violence, drugs or weapons; only invented people, never a real player; real money never touches it; the
// police are played for laughs. Pure: every roll comes from an injected random source. The server (app/home/
// underworldActions.ts, a crypto random source, the service role) and the preview (lib/underworldSim.ts) run it; the job
// file holds the odds, so only they import lib/underworldContent.ts.

import { faceProblems, type CardFace } from "./cardFormat.ts";

export type Rng = () => number;

export const UNDERWORLD = {
  place: "pablos-luggage",
  /** Ranks (lib/ranks.ts): the back room opens from Rank 2. */
  minRank: 2,
  /** Pablo finds you: a Hustler (the meter at 30 or below) at once, anyone else after one shady Moral Choices option. */
  hustlerAt: 30,
  /** A Halo (70+) is welcome but watched: the first job pays this much. */
  haloAt: 70,
  haloFirstPay: 0.7,
  offersPerDay: 3,
  rep: { max: 100, bustLoss: 4, caughtLoss: 5 },
  /** Street Rep tiers: the jobs a tier opens carry its minRep. */
  tiers: [
    { at: 0, name: "Errand Kid", emoji: "🧃" },
    { at: 15, name: "Corner Regular", emoji: "🧍" },
    { at: 35, name: "Known Face", emoji: "😎" },
    { at: 60, name: "Pablo's Guy", emoji: "🤝" },
    { at: 90, name: "Street Legend", emoji: "👑" },
  ],
  heat: {
    max: 100,
    /** Per New York day: a day with a job, and a day you lay low. */
    decayWorked: 8,
    decayQuiet: 15,
    /** From here the precinct is watching: every job's odds drop. */
    watched: 50,
    /** Pablo turns you away from here until you cool off. */
    refuse: 80,
    bustAdd: 1.5,
    caughtAdd: 10,
  },
  trace: { decay: 0.85, drop: 0.1, maxDays: 14 },
  bust: { fineMax: 1500, fineBase: 150, payShare: 0.75, holdingMax: 3, onFail: 0.15, onFailTrace: 0.5, trace: 0.3, find: 0.5 },
  lawyer: { cost: 400, days: 7, fineCut: 0.5, holdingCut: 1 },
  /** Campaign Mode: Street Rep adds to a dark op's success, up to +10%. */
  campaign: { perRep: 0.001, max: 0.1, lineAt: 35 },
  receipts: 8,
} as const;

// ---------------------------------------------------------------------------------------------------------------
// Content (content/underworld/jobs.json)
// ---------------------------------------------------------------------------------------------------------------

export interface JobOption {
  id: string;
  label: string;
  get: string;
  cost: string;
  /** Hidden: pay range on success (C$), Street Rep, Heat, the trace's weight (0 to 1), the success odds (0 to 1). */
  pay: [number, number];
  rep: number;
  heat: number;
  trace: number;
  odds: number;
  energy: number;
  /** The private meter, toward Hustler (negative) or Halo. */
  integrity: number;
  mood?: number;
  /** What happened, by outcome. */
  win: string;
  fizzle: string;
}

export interface Job {
  id: string;
  emoji: string;
  title: string;
  minRep: number;
  options: JobOption[];
  /** Caught on the spot. */
  bust: string;
  /** A trace found on a later day ("Remember the…?"). */
  caught: string;
  /** Lola's Blotter, with {name}. */
  headline: string;
}

export interface UnderworldContent {
  jobs: Job[];
  pablo: { intro: string[]; greet: Record<string, string[]>; halo: string; refuse: string; holding: string; lawyer: string };
}

/** The job file's problems (validate:content and tests/underworld.test.ts run it). */
export function contentProblems(c: UnderworldContent): string[] {
  const out: string[] = [];
  const ids = new Set<string>();
  const banned = /\b(gun|knife|shoot|stab|drug|cocaine|weed|heroin|pills|kill|murder|assault|punch)\w*/i;
  for (const j of c.jobs) {
    const at = `job ${j.id}`;
    if (!/^[a-z0-9-]{2,60}$/.test(j.id) || ids.has(j.id)) out.push(`${at}: missing or repeated id`);
    ids.add(j.id);
    out.push(...faceProblems(at, j as unknown as CardFace & { options: Record<string, unknown>[] }, { allowRiskFields: true }));
    if (!(j.minRep >= 0 && j.minRep <= 90)) out.push(`${at}: minRep 0 to 90`);
    for (const t of [j.bust, j.caught, j.headline]) if (!t || t.length > 260) out.push(`${at}: bust, caught and headline are 1 to 260 characters`);
    if (!j.headline.includes("{name}")) out.push(`${at}: the headline names {name}`);
    if (banned.test(JSON.stringify(j))) out.push(`${at}: no violence, drugs or weapons`);
    for (const o of j.options) {
      const ot = `${at} option ${o.id}`;
      const [lo, hi] = o.pay ?? [];
      if (!(lo >= 0 && hi >= lo && hi <= 2500)) out.push(`${ot}: pay is [min, max] within C$0 to 2,500`);
      if (!(o.odds > 0 && o.odds <= 1)) out.push(`${ot}: odds 0 to 1`);
      if (!(o.trace >= 0 && o.trace <= 1)) out.push(`${ot}: trace 0 to 1`);
      if (!(o.rep >= 0 && o.rep <= 12)) out.push(`${ot}: rep 0 to 12`);
      if (!(o.heat >= 0 && o.heat <= 25)) out.push(`${ot}: heat 0 to 25`);
      if (!(o.energy >= 0 && o.energy <= 30)) out.push(`${ot}: energy 0 to 30`);
      if (!(Math.abs(o.integrity) <= 8)) out.push(`${ot}: integrity within ±8`);
      if (o.mood !== undefined && Math.abs(o.mood) > 10) out.push(`${ot}: mood within ±10`);
      if (!o.win || !o.fizzle || o.win.length > 260 || o.fizzle.length > 260) out.push(`${ot}: win and fizzle are 1 to 260 characters`);
    }
  }
  for (const t of UNDERWORLD.tiers.slice(0, 4)) {
    if (c.jobs.filter((j) => j.minRep <= t.at).length < UNDERWORLD.offersPerDay) out.push(`tier ${t.name}: needs ${UNDERWORLD.offersPerDay} jobs open`);
  }
  for (const t of UNDERWORLD.tiers) if (!c.pablo.greet[t.name]?.length) out.push(`pablo.greet: a line for ${t.name}`);
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------------------------------------------

export interface Trace { id: string; job: string; weight: number; day: string; pay: number }
export interface Landed { id: string; emoji: string; text: string; fine: number; holding: number; day: string; seen?: boolean }

export interface UnderworldState {
  v: 1;
  invitedOn: string;
  rep: number;
  heat: number;
  /** The last New York day Heat and traces were brought up to. */
  day: string;
  offers: { day: string; ids: string[]; done: string[] };
  traces: Trace[];
  landed: Landed[];
  jobsDone: number;
  busts: number;
  earned: number;
  lawyerUntil: string | null;
  /** Days with a job (the last few), for "lay low". */
  worked: string[];
  receipts: string[];
  /** Pablo's intro was shown. */
  met: boolean;
}

/** What the server reads (underworld_context, migration 0148). */
export interface UnderworldCtx {
  rank: number;
  integrity: number | null;
  /** Took a Moral Choices option that moved the meter toward Hustler. */
  shady: boolean;
  atPlace: string | null;
  energy: number;
  bank: number;
  holding: boolean;
  /** A Whitlock & Hale employee is their own lawyer. */
  lawJob: boolean;
}

export class UnderworldError extends Error {
  code: string;
  constructor(code: string) { super(code); this.code = code; }
}

const ERRORS: Record<string, string> = {
  locked: "Pablo doesn't know you. Yet.",
  not_here: "Pablo only talks business in the back room. Go to Pablo's Luggage & Notary.",
  done: "You did that one already. Pablo has new work tomorrow.",
  no_offer: "That job's gone. Pablo moved on.",
  too_hot: "Pablo won't look at you. You're too hot. Lay low for a day or two.",
  no_energy: "You're too tired for this. Get some rest.",
  in_holding: "You're in holding at the 114½. Pablo doesn't do jail visits.",
  cant_afford: "Not enough in the bank for that.",
  has_lawyer: "Whitlock & Hale already has you on retainer.",
  conflict: "Something changed. Try again.",
  rate_limited: "Slow down a little.",
  unknown: "Pablo's phone cut out. Try again.",
};
export const underworldError = (code: string) => ERRORS[code] ?? ERRORS.unknown;

export const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000);

export function tierOf(rep: number) {
  let t: (typeof UNDERWORLD.tiers)[number] = UNDERWORLD.tiers[0];
  for (const x of UNDERWORLD.tiers) if (rep >= x.at) t = x;
  return t;
}
export function nextTier(rep: number) {
  return UNDERWORLD.tiers.find((t) => t.at > rep) ?? null;
}

/** Pablo finds you: Rank 2, then a Hustler at once or anyone after one shady choice. */
export function invited(ctx: UnderworldCtx): boolean {
  if (ctx.rank < UNDERWORLD.minRank) return false;
  return ctx.shady || (ctx.integrity !== null && ctx.integrity <= UNDERWORLD.hustlerAt);
}

export function newState(today: string): UnderworldState {
  return { v: 1, invitedOn: today, rep: 0, heat: 0, day: today, offers: { day: "", ids: [], done: [] }, traces: [], landed: [], jobsDone: 0, busts: 0, earned: 0, lawyerUntil: null, worked: [], receipts: [], met: false };
}

export interface Payout { currency: "cash"; amount: number; kind: "underworld_pay" | "underworld_fine" | "underworld_lawyer"; ref: string }
export interface Change { payouts: Payout[]; holding: number; headline: string | null; energy: number; mood: number; integrity: number; changed: boolean }
const none = (): Change => ({ payouts: [], holding: 0, headline: null, energy: 0, mood: 0, integrity: 0, changed: false });

const lawyerOn = (s: UnderworldState, ctx: UnderworldCtx, day: string) => ctx.lawJob || (!!s.lawyerUntil && s.lawyerUntil >= day);

function caughtCost(s: UnderworldState, ctx: UnderworldCtx, day: string, pay: number, weight: number) {
  const law = lawyerOn(s, ctx, day);
  let fine = Math.min(UNDERWORLD.bust.fineMax, Math.round(pay * UNDERWORLD.bust.payShare + UNDERWORLD.bust.fineBase * (1 + weight)));
  let holding = weight >= 0.6 ? 3 : weight >= 0.4 ? 2 : weight >= 0.25 ? 1 : 0;
  if (law) { fine = Math.round(fine * UNDERWORLD.lawyer.fineCut); holding = Math.max(0, holding - UNDERWORLD.lawyer.holdingCut); }
  return { fine: Math.round(fine / 10) * 10, holding: Math.min(UNDERWORLD.bust.holdingMax, holding), law };
}

/**
 * Brings the state up to today: each New York day since the last one cools Heat (faster on a day without a job), rolls
 * every trace for discovery (Heat ÷ 100 × weight × half) and fades the rest; then deals today's offers. At most one trace lands a
 * day, and at most one holding per refresh.
 */
export function refresh(content: UnderworldContent, s: UnderworldState, today: string, ctx: UnderworldCtx, rng: Rng): Change {
  const out = none();
  const steps = Math.min(30, Math.max(0, daysBetween(s.day, today)));
  for (let i = 1; i <= steps; i++) {
    const day = addDays(s.day, i);
    const prev = addDays(day, -1);
    s.heat = clamp(s.heat - (s.worked.includes(prev) ? UNDERWORLD.heat.decayWorked : UNDERWORLD.heat.decayQuiet));
    let found = false;
    const keep: Trace[] = [];
    for (const t of s.traces) {
      if (!found && rng() < (s.heat / 100) * t.weight * UNDERWORLD.bust.find) {
        found = true;
        const job = content.jobs.find((j) => j.id === t.job);
        const { fine, holding, law } = caughtCost(s, ctx, day, t.pay, t.weight);
        const hold = out.holding ? 0 : holding;
        s.rep = clamp(s.rep - UNDERWORLD.rep.caughtLoss);
        s.heat = clamp(s.heat + UNDERWORLD.heat.caughtAdd);
        s.busts += 1;
        if (fine > 0) out.payouts.push({ currency: "cash", amount: -fine, kind: "underworld_fine", ref: `trace:${t.id}` });
        out.holding = Math.max(out.holding, hold);
        out.headline = job?.headline ?? null;
        const extra = [fine ? `a C$${fine.toLocaleString("en-US")} fine` : "", hold ? `${hold} hour${hold > 1 ? "s" : ""} in holding` : ""].filter(Boolean).join(" and ");
        s.landed.unshift({ id: t.id, emoji: "🚨", text: `${job?.caught ?? "The precinct caught up with an old job."}${extra ? ` It cost you ${extra}.` : ""}${law ? " Whitlock & Hale got it knocked down." : ""}`, fine, holding: hold, day });
        continue;
      }
      const weight = t.weight * UNDERWORLD.trace.decay;
      if (weight >= UNDERWORLD.trace.drop && daysBetween(t.day, day) < UNDERWORLD.trace.maxDays) keep.push({ ...t, weight: Math.round(weight * 1000) / 1000 });
    }
    s.traces = keep;
  }
  if (steps > 0) { s.day = today; out.changed = true; }
  s.landed = s.landed.slice(0, 10);
  s.worked = s.worked.filter((d) => daysBetween(d, today) <= 7);
  if (s.offers.day !== today) {
    s.offers = { day: today, ids: deal(content, s, rng), done: [] };
    out.changed = true;
  }
  return out;
}

/** Today's 3 jobs from what Street Rep opens, the bigger ones first in the draw, never yesterday's three again if avoidable. */
function deal(content: UnderworldContent, s: UnderworldState, rng: Rng): string[] {
  const open = content.jobs.filter((j) => j.minRep <= s.rep);
  const fresh = open.filter((j) => !s.offers.ids.includes(j.id));
  const pool = (fresh.length >= UNDERWORLD.offersPerDay ? fresh : open).slice();
  const picked: string[] = [];
  // The best open tier's jobs weigh double, so a new tier shows up.
  const top = Math.max(...pool.map((j) => j.minRep));
  while (picked.length < UNDERWORLD.offersPerDay && pool.length) {
    const weights = pool.map((j) => (j.minRep === top ? 2 : 1));
    let r = rng() * weights.reduce((a, b) => a + b, 0);
    let i = 0;
    while (i < pool.length - 1 && (r -= weights[i]) > 0) i++;
    picked.push(pool[i].id);
    pool.splice(i, 1);
  }
  return picked;
}

/** The odds once Heat is in: from Watched, every point takes half a percent off. */
export function liveOdds(o: JobOption, heat: number): number {
  return clamp(o.odds - Math.max(0, heat - UNDERWORLD.heat.watched) / 200, 0.05, 0.98);
}

/** Does a job: the hidden outcome (a clean win, a win that leaves a trace, a fizzle, or busted on the spot). */
export function doJob(content: UnderworldContent, s: UnderworldState, jobId: string, optionId: string, today: string, ctx: UnderworldCtx, rng: Rng): Change & { receipt: string; outcome: "win" | "trace" | "fizzle" | "bust" } {
  if (ctx.holding) throw new UnderworldError("in_holding");
  if (ctx.atPlace !== UNDERWORLD.place) throw new UnderworldError("not_here");
  if (s.heat >= UNDERWORLD.heat.refuse) throw new UnderworldError("too_hot");
  if (!s.offers.ids.includes(jobId) || s.offers.day !== today) throw new UnderworldError("no_offer");
  if (s.offers.done.includes(jobId)) throw new UnderworldError("done");
  const job = content.jobs.find((j) => j.id === jobId);
  const o = job?.options.find((x) => x.id === optionId);
  if (!job || !o) throw new UnderworldError("no_offer");
  if (ctx.energy < o.energy) throw new UnderworldError("no_energy");

  const out = { ...none(), changed: true, energy: -o.energy, mood: o.mood ?? 0, integrity: o.integrity };
  s.offers.done.push(jobId);
  if (!s.worked.includes(today)) s.worked.push(today);
  const odds = liveOdds(o, s.heat);
  const roll = rng();
  const tid = `${today}:${jobId}`;
  let outcome: "win" | "trace" | "fizzle" | "bust";
  let receipt: string;
  if (roll < odds) {
    const halo = s.jobsDone === 0 && ctx.integrity !== null && ctx.integrity >= UNDERWORLD.haloAt;
    let pay = Math.round((o.pay[0] + rng() * (o.pay[1] - o.pay[0])) * (halo ? UNDERWORLD.haloFirstPay : 1) / 10) * 10;
    pay = Math.max(0, pay);
    s.rep = clamp(s.rep + o.rep);
    s.heat = clamp(s.heat + o.heat);
    s.earned += pay;
    if (pay > 0) out.payouts.push({ currency: "cash", amount: pay, kind: "underworld_pay", ref: tid });
    // A trace is likelier the hotter you are.
    const traced = o.trace > 0 && rng() < UNDERWORLD.bust.trace + s.heat / 250;
    if (traced) s.traces.push({ id: tid, job: jobId, weight: o.trace, day: today, pay });
    outcome = traced ? "trace" : "win";
    receipt = `${o.win}${pay ? ` +C$${pay.toLocaleString("en-US")}.` : ""}${halo ? ` ${content.pablo.halo}` : ""}`;
  } else if (rng() < UNDERWORLD.bust.onFail + o.trace * UNDERWORLD.bust.onFailTrace + s.heat / 250) {
    const { fine, holding, law } = caughtCost(s, ctx, today, 0, o.trace);
    s.rep = clamp(s.rep - UNDERWORLD.rep.bustLoss);
    s.heat = clamp(s.heat + Math.round(o.heat * UNDERWORLD.heat.bustAdd));
    s.busts += 1;
    if (fine > 0) out.payouts.push({ currency: "cash", amount: -fine, kind: "underworld_fine", ref: tid });
    out.holding = holding;
    out.headline = job.headline;
    outcome = "bust";
    const extra = [fine ? `a C$${fine.toLocaleString("en-US")} fine` : "", holding ? `${holding} hour${holding > 1 ? "s" : ""} in holding` : ""].filter(Boolean).join(" and ");
    receipt = `${job.bust}${extra ? ` It cost you ${extra}.` : ""}${law ? " Whitlock & Hale got it knocked down." : ""}`;
  } else {
    s.heat = clamp(s.heat + Math.round(o.heat / 2));
    outcome = "fizzle";
    receipt = o.fizzle;
  }
  s.jobsDone += 1;
  s.receipts = [`${job.emoji} ${receipt}`, ...s.receipts].slice(0, UNDERWORLD.receipts);
  return { ...out, receipt, outcome };
}

/** Whitlock & Hale on retainer for a week. */
export function retainLawyer(s: UnderworldState, today: string, ctx: UnderworldCtx): Change {
  if (lawyerOn(s, ctx, today)) throw new UnderworldError("has_lawyer");
  if (ctx.bank < UNDERWORLD.lawyer.cost) throw new UnderworldError("cant_afford");
  s.lawyerUntil = addDays(today, UNDERWORLD.lawyer.days - 1);
  return { ...none(), changed: true, payouts: [{ currency: "cash", amount: -UNDERWORLD.lawyer.cost, kind: "underworld_lawyer", ref: `lawyer:${today}` }] };
}

/** Marks Pablo's intro and every landed trace seen. */
export function markSeen(s: UnderworldState): boolean {
  const changed = !s.met || s.landed.some((l) => !l.seen);
  s.met = true;
  for (const l of s.landed) l.seen = true;
  return changed;
}

/** Campaign Mode: the dark-op bonus Street Rep is worth. */
export const campaignOpBonus = (rep: number) => Math.min(UNDERWORLD.campaign.max, Math.max(0, rep) * UNDERWORLD.campaign.perRep);

// ---------------------------------------------------------------------------------------------------------------
// The player's view (never the odds, the traces or what's coming)
// ---------------------------------------------------------------------------------------------------------------

export interface OfferView { id: string; emoji: string; title: string; done: boolean; options: { id: string; label: string; get: string; cost: string; energy: number }[] }

export interface UnderworldView {
  invited: boolean;
  /** Before the invite: how to get it, in Pablo's world's words. */
  hint: string | null;
  rep: number;
  tier: { name: string; emoji: string };
  next: { name: string; at: number } | null;
  heat: number;
  heatBand: "cool" | "warm" | "watched" | "glowing";
  offers: OfferView[];
  here: boolean;
  holding: boolean;
  tooHot: boolean;
  lawyer: { on: boolean; until: string | null; cost: number; free: boolean };
  landed: Landed[];
  receipts: string[];
  greet: string;
  intro: string[] | null;
  stats: { jobs: number; busts: number; earned: number };
}

export const heatBand = (h: number): UnderworldView["heatBand"] => (h >= UNDERWORLD.heat.refuse ? "glowing" : h >= UNDERWORLD.heat.watched ? "watched" : h >= 20 ? "warm" : "cool");

export function view(content: UnderworldContent, s: UnderworldState | null, today: string, ctx: UnderworldCtx): UnderworldView {
  const inv = !!s || invited(ctx);
  const st = s ?? newState(today);
  const t = tierOf(st.rep);
  const n = nextTier(st.rep);
  const greets = content.pablo.greet[t.name] ?? [""];
  return {
    invited: inv,
    hint: inv ? null : ctx.rank < UNDERWORLD.minRank
      ? "The man behind the luggage counter looks right through you. Come back when people know your name (Rank 2)."
      : "\"We're closed,\" says the man behind the counter. The sign says open. Maybe he only opens for people who've bent a rule or two.",
    rep: st.rep,
    tier: { name: t.name, emoji: t.emoji },
    next: n ? { name: n.name, at: n.at } : null,
    heat: st.heat,
    heatBand: heatBand(st.heat),
    offers: (st.offers.day === today ? st.offers.ids : []).map((id) => content.jobs.find((j) => j.id === id)).filter((j): j is Job => !!j).map((j) => ({
      id: j.id, emoji: j.emoji, title: j.title, done: st.offers.done.includes(j.id),
      options: j.options.map((o) => ({ id: o.id, label: o.label, get: o.get, cost: o.cost, energy: o.energy })),
    })),
    here: ctx.atPlace === UNDERWORLD.place,
    holding: ctx.holding,
    tooHot: st.heat >= UNDERWORLD.heat.refuse,
    lawyer: { on: lawyerOn(st, ctx, today), until: ctx.lawJob ? null : st.lawyerUntil && st.lawyerUntil >= today ? st.lawyerUntil : null, cost: UNDERWORLD.lawyer.cost, free: ctx.lawJob },
    landed: st.landed.filter((l) => !l.seen),
    receipts: st.receipts,
    greet: st.heat >= UNDERWORLD.heat.refuse ? content.pablo.refuse : ctx.holding ? content.pablo.holding : greets[daysBetween("2026-01-01", today) % greets.length] ?? "",
    intro: inv && !st.met ? content.pablo.intro : null,
    stats: { jobs: st.jobsDone, busts: st.busts, earned: st.earned },
  };
}

export type UnderworldResult<T> = { ok: true; data: T } | { ok: false; error: string };
export interface UnderworldScreen { view: UnderworldView; receipt?: string; outcome?: "win" | "trace" | "fizzle" | "bust" }

/** What GameShell calls: the server's actions, or the preview's memory. */
export interface UnderworldApi {
  screen(): Promise<UnderworldResult<UnderworldScreen>>;
  job(job: string, option: string): Promise<UnderworldResult<UnderworldScreen>>;
  lawyer(): Promise<UnderworldResult<UnderworldScreen>>;
  seen(): Promise<UnderworldResult<UnderworldScreen>>;
}
