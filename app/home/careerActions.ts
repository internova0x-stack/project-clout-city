"use server";

import { randomInt, randomUUID } from "node:crypto";
import {
  CareerError, careerError, careerView, hire, leaveTransition, office, quit, stickItOut, refresh, startDay, answerTask, trackCards, CAREER, trackById,
  type Answer, type OfficeAction, type Target, type CareerCtx, type CareerResult, type CareerScreen, type CareerState, type Effects, type Payout, type TrackId, type WorkStyle,
} from "@/lib/careers";
import { CAREER_CONTENT as content } from "@/lib/careersContent";
import { nyDay } from "@/lib/campaign";
import { OFFICE_FACT, type FactKey } from "@/lib/memory";
import { conditionOn, type ConditionNow } from "@/lib/cityConditions";
import { unlockedCards } from "@/lib/cardFormat";
import { memoryOf } from "@/lib/memoryServer";
import type { AspirationId, AspirationState } from "@/lib/aspirations";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { companyOf, companyView, type CompanyState, type CompanyView } from "@/lib/companies";
import { companiesNow, companyAdd, companyNow } from "@/lib/companyServer";
import { CAMPAIGN_CONTENT } from "@/lib/campaignContent";
import { getServerSupabase } from "@/lib/supabase/server";

// Careers (spec section 30; migration 0135). The rules run here with a crypto random source: the browser sends a choice
// and gets back the player's view, never a task's outcomes. The job lives in public.careers, which only the service role
// can touch; career_save stores it against its version, applies the workday's Energy and Mood and pays once
// (ledger 'career_pay', 'career_promo', 'career_screen').

type Admin = NonNullable<ReturnType<typeof getAdminSupabase>>;
type Job = { id: string; status: CareerState["status"] | "abandoned"; version: number; state: CareerState };
type Context = CareerCtx & { bank: number; job: Job | null; aspirationState?: AspirationState | null; companyState?: CompanyState | null };
type Out = CareerResult<CareerScreen>;

const rng = () => randomInt(0, 2 ** 32) / 2 ** 32;

async function who(): Promise<{ id: string; admin: Admin } | { error: string }> {
  const supabase = await getServerSupabase();
  const admin = getAdminSupabase();
  if (!supabase || !admin) return { error: "Accounts aren't switched on yet." };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in first." };
  return { id: user.id, admin };
}

async function load(id: string, admin: Admin): Promise<Context | { error: string }> {
  const { data, error } = await admin.rpc("career_context", { p_player: id });
  if (error) {
    if (/career_context/.test(error.message)) return { error: "Run migration 0135 to open Careers." };
    console.error("career_context failed", error);
    return { error: careerError("unknown") };
  }
  if (!data) return { error: "Create your character first." };
  const ctx = data as Context;
  // Aspirations (migration 0143): the pick and the degree give a level's head start each (null before the migration).
  const asp = await admin.rpc("aspiration_of", { p_player: id });
  if (!asp.error && asp.data) {
    ctx.aspirationState = asp.data as AspirationState;
    ctx.aspiration = ctx.aspirationState.aspiration;
    ctx.degree = ctx.aspirationState.degree;
  }
  // Part 3: businesses owned, for the quit card's "Quit to run your business".
  const biz = await admin.from("player_businesses").select("business_id", { count: "exact", head: true }).eq("player_id", id);
  ctx.businesses = biz.count ?? 0;
  // A running campaign is a full-time job (owner, Nov 4): the career job goes on leave while it runs.
  const camp = await admin.from("campaigns").select("candidate").eq("player_id", id).eq("status", "running").maybeSingle();
  const cand = camp.data ? CAMPAIGN_CONTENT.candidates.find((c) => c.id === (camp.data as { candidate: string }).candidate) : null;
  ctx.onLeave = cand ? { candidate: cand.short } : null;
  // Company health (migration 0161): the employer's week, shared city-wide (nothing before the migration).
  const track = ctx.job?.status === "employed" ? ctx.job.state.track : null;
  const def = track ? companyOf(track) : undefined;
  ctx.companyState = def ? await companyNow(admin, def.track) : null;
  if (def && ctx.companyState) ctx.company = { health: ctx.companyState.health, target: ctx.companyState.target, unit: def.unit, boss: def.boss, decimals: def.decimals };
  return ctx;
}

function companyFor(ctx: Context): CompanyView | null {
  const def = ctx.companyState ? companyOf(ctx.companyState.track) : undefined;
  return def && ctx.companyState ? companyView(def, ctx.companyState, Date.now()) : null;
}

function screen(ctx: Context, today: string, receipt?: string): CareerScreen {
  return {
    tracks: trackCards(ctx, today),
    canConnect: ctx.crew > 0 || ctx.clout >= CAREER.connectionClout,
    job: ctx.job ? careerView(content, ctx.job.state, today, ctx) : null,
    energy: ctx.energy,
    atPlace: ctx.atPlace,
    receipt,
    aspiration: ctx.aspirationState ?? null,
    businesses: ctx.businesses ?? 0,
    company: companyFor(ctx),
    companyMine: ctx.job && ctx.companyState && ctx.job.state.coPart?.week === ctx.companyState.week ? ctx.job.state.coPart.units : 0,
  };
}

const codeOf = (message: string) => /^(conflict|rate_limited|worked_today|shifted_today|no_energy|employed|too_soon)/.exec(message)?.[1];

async function save(admin: Admin, player: string, ctx: Context, state: CareerState, o: { workday?: string; effects?: Effects; payouts?: Payout[] }): Promise<string | null> {
  const job = ctx.job!;
  const { data, error } = await admin.rpc("career_save", {
    p_player: player, p_id: job.id, p_version: job.version, p_state: state, p_level: state.level, p_status: state.status,
    p_workday: o.workday ?? null, p_energy: o.effects?.energy ?? 0, p_mood: o.effects?.mood ?? 0, p_payouts: o.payouts ?? [],
  });
  if (error) {
    const code = codeOf(error.message);
    if (!code) console.error("career_save failed", error);
    return careerError(code ?? "unknown");
  }
  job.version = data as number;
  job.state = state;
  job.status = state.status;
  ctx.energy = Math.max(0, Math.min(100, ctx.energy + (o.effects?.energy ?? 0)));
  return null;
}

/** Loads the job, brings it to today (reviews, payday), runs one change and saves it. */
type Change = { workday?: string; effects?: Effects; payouts?: Payout[]; receipt?: string; integrity?: number; headline?: string | null; facts?: { key: FactKey; subject: string }[] };

/** Player memory (migration 0138): what this player did, for content to react to. Never blocks the action. */
async function remember(admin: Admin, player: string, facts: { key: FactKey; subject: string }[]) {
  for (const f of facts) {
    const { error } = await admin.rpc("fact_note", { p_player: player, p_key: f.key, p_subject: f.subject });
    if (error && !/fact_note/.test(error.message)) console.error("fact_note failed", error);
  }
}

async function act(change: (state: CareerState, ctx: Context, today: string) => Change): Promise<Out> {
  const w = await who();
  if ("error" in w) return { ok: false, error: w.error };
  const ctx = await load(w.id, w.admin);
  if ("error" in ctx) return { ok: false, error: ctx.error };
  if (ctx.job?.status !== "employed") return { ok: false, error: careerError("not_employed") };
  const today = nyDay();
  const state = structuredClone(ctx.job.state);
  const liferBefore = !!state.lifer;
  const dayDoneBefore = !!(state.today?.day === today && state.today.done);
  leaveTransition(state, ctx.onLeave, today);
  const caught = refresh(state, today, ctx, rng);
  let r: ReturnType<typeof change> = {};
  try {
    if (state.status === "employed") r = change(state, ctx, today);
  } catch (e) {
    if (e instanceof CareerError) return { ok: false, error: careerError(e.code) };
    throw e;
  }
  // Company health: a workday that just ended adds its part to the boss's target (written after the save, so it counts once).
  const closed = !dayDoneBefore && state.today?.day === today && state.today.done && !!state.today.gain && !!ctx.companyState;
  if (closed && ctx.companyState) {
    const add = state.today!.gain! * ctx.companyState.target;
    state.coPart = { week: ctx.companyState.week, units: (state.coPart?.week === ctx.companyState.week ? state.coPart.units : 0) + add };
  }
  const err = await save(w.admin, w.id, ctx, state, { ...r, payouts: [...caught.payouts, ...(r.payouts ?? [])] });
  if (err) return { ok: false, error: err };
  if (closed && ctx.companyState) {
    await companyAdd(w.admin, ctx.companyState, state.today!.gain!);
    ctx.companyState = { ...ctx.companyState, contrib: ctx.companyState.contrib + state.today!.gain! * ctx.companyState.target };
  }
  // Part 2 (migration 0136): an office move nudges the private meter, and a rumor can make Lola's Blotter.
  if (r.integrity || r.headline) {
    const { error } = await w.admin.rpc("career_office", { p_player: w.id, p_id: ctx.job!.id, p_integrity: r.integrity ?? 0, p_headline: r.headline ?? null });
    if (error && !/career_office/.test(error.message)) console.error("career_office failed", error);
  }
  // Careers part 3: a work friend for life is remembered beyond this job (storylets, the friend's lines).
  const facts = [...(r.facts ?? []), ...(!liferBefore && state.lifer ? [{ key: "career.friend_for_life" as FactKey, subject: `${state.track}:friend` }] : [])];
  if (facts.length) await remember(w.admin, w.id, facts);
  return { ok: true, data: screen(ctx, today, r.receipt) };
}

export async function careerScreen(): Promise<Out> {
  const w = await who();
  if ("error" in w) return { ok: false, error: w.error };
  const ctx = await load(w.id, w.admin);
  if ("error" in ctx) return { ok: false, error: ctx.error };
  const today = nyDay();
  if (ctx.job?.status === "employed") {
    const state = structuredClone(ctx.job.state);
    const moved = leaveTransition(state, ctx.onLeave, today);
    const r = refresh(state, today, ctx, rng);
    if (r.changed || moved) {
      const err = await save(w.admin, w.id, ctx, state, { payouts: r.payouts });
      if (err) return { ok: false, error: err };
    }
  }
  return { ok: true, data: screen(ctx, today) };
}

export async function careerApply(track: TrackId, answer: Answer): Promise<Out> {
  const w = await who();
  if ("error" in w) return { ok: false, error: w.error };
  const ctx = await load(w.id, w.admin);
  if ("error" in ctx) return { ok: false, error: ctx.error };
  if (!trackById(track) || !["honest", "polish", "connection"].includes(answer)) return { ok: false, error: careerError("unknown") };
  if (ctx.job?.status === "employed") return { ok: false, error: careerError("employed") };
  if (ctx.onLeave) return { ok: false, error: careerError("campaign_running") };
  const today = nyDay();
  const id = randomUUID();
  let state: CareerState;
  try {
    state = hire(id, track, ctx, answer, today);
  } catch (e) {
    if (e instanceof CareerError) return { ok: false, error: careerError(e.code) };
    throw e;
  }
  const { error } = await w.admin.rpc("career_hire", { p_player: w.id, p_id: id, p_track: track, p_level: state.level, p_state: state });
  if (error) {
    const code = codeOf(error.message);
    if (!code) console.error("career_hire failed", error);
    return { ok: false, error: careerError(code ?? "unknown") };
  }
  ctx.job = { id, status: "employed", version: 1, state };
  if (answer === "polish") await remember(w.admin, w.id, [{ key: "career.lied_interview", subject: track }]);
  return { ok: true, data: screen(ctx, today, `You're hired! First day whenever you're ready.`) };
}

/** The city's conditions now (migration 0140; empty before it has run). */
async function cityConditions(): Promise<ConditionNow[]> {
  const admin = getAdminSupabase();
  if (!admin) return [];
  const { data, error } = await admin.rpc("city_conditions_now");
  return error || !Array.isArray(data) ? [] : (data as ConditionNow[]);
}

export async function careerStart(style: WorkStyle): Promise<Out> {
  if (!["hustle", "steady", "coast"].includes(style)) return { ok: false, error: careerError("unknown") };
  // Content Engine step 7: gated tasks the player's memory unlocks (a feud, a ban, a source…), with names filled in.
  const admin = getAdminSupabase();
  const w = await who();
  // No workday from the bench (owner, Nov 3), not even with "work from anywhere".
  if (!("error" in w)) {
    const { data: held } = await w.admin.rpc("choice_marked", { p_player: w.id, p_kind: "holding" });
    if (held === true) return { ok: false, error: careerError("in_holding") };
  }
  const memory = admin && !("error" in w) ? await memoryOf(admin, w.id) : null;
  const unlocked = unlockedCards(content.tasks, memory, nyDay());
  return act((s, ctx, today) => ({ ...startDay(content, s, style, { ...ctx, unlocked }, today, rng), workday: today }));
}

export async function careerTask(index: number, option: string): Promise<Out> {
  return act((s, ctx) => answerTask(content, s, index, option, ctx, rng));
}

const OFFICE_ACTIONS: OfficeAction[] = ["help", "share", "team", "credit", "report", "rumor", "cover", "back", "mentor", "undermine", "overhead", "pushout"];

export async function careerOffice(action: OfficeAction, who: Target): Promise<Out> {
  if (!OFFICE_ACTIONS.includes(action) || !["manager", "friend", "rival", "hire"].includes(who)) return { ok: false, error: careerError("bad_target") };
  // Migration 0140: an HR crackdown week at this employer (a city storylet) traces sabotage twice as often.
  const conditions = await cityConditions();
  return act((s, ctx, today) => {
    const exposedBefore = s.exposed ?? 0;
    const r = office(s, action, who, ctx, today, rng, { crackdown: conditionOn(conditions, "hr_crackdown", s.track) });
    const subject = `${s.track}:${who}`;
    const facts: Change["facts"] = [{ key: OFFICE_FACT[action], subject }];
    if ((s.exposed ?? 0) > exposedBefore) facts.push({ key: "career.caught_sabotage", subject });
    if (r.pushedOut) facts.push({ key: "career.pushed_out_boss", subject: s.track });
    return { ...r, facts };
  });
}

export async function careerQuit(reason?: "business"): Promise<Out> {
  return act((s, ctx, today) => {
    const r = quit(s, today, { reason: reason === "business" ? "business" : undefined, businesses: ctx.businesses });
    return { ...r, facts: reason === "business" ? [{ key: "career.quit_for_business", subject: s.track }] : [] };
  });
}

/** The quit card's "Stick it out". */
export async function careerStick(): Promise<Out> {
  return act((s, _ctx, today) => stickItOut(s, today));
}

/** Aspirations (migration 0143): picks the player's life path; a new pick at most every 30 days. */
export async function careerAspire(id: AspirationId): Promise<Out> {
  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, error: "Accounts aren't switched on yet." };
  const { error } = await supabase.rpc("aspiration_set", { p_aspiration: id });
  if (error) {
    if (/too_soon/.test(error.message)) return { ok: false, error: "You can pick a new aspiration 30 days after the last one." };
    if (/aspiration_set/.test(error.message)) return { ok: false, error: "Run migration 0143 to switch on aspirations." };
    console.error("aspiration_set failed", error);
    return { ok: false, error: careerError("unknown") };
  }
  return careerScreen();
}

/** News → City's Business pages (migration 0161): every company's health and this week's target. Anyone signed in. */
export async function careerCompanies(): Promise<CareerResult<CompanyView[]>> {
  const w = await who();
  if ("error" in w) return { ok: false, error: w.error };
  return { ok: true, data: await companiesNow(w.admin) };
}
