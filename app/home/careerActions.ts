"use server";

import { randomInt, randomUUID } from "node:crypto";
import {
  CareerError, careerError, careerView, hire, office, quit, refresh, startDay, answerTask, trackCards, CAREER, trackById,
  type Answer, type OfficeAction, type Who, type CareerCtx, type CareerResult, type CareerScreen, type CareerState, type Effects, type Payout, type TrackId, type WorkStyle,
} from "@/lib/careers";
import { CAREER_CONTENT as content } from "@/lib/careersContent";
import { nyDay } from "@/lib/campaign";
import { OFFICE_FACT, type FactKey } from "@/lib/memory";
import { conditionOn, type ConditionNow } from "@/lib/cityConditions";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { getServerSupabase } from "@/lib/supabase/server";

// Careers (spec section 30; migration 0135). The rules run here with a crypto random source: the browser sends a choice
// and gets back the player's view, never a task's outcomes. The job lives in public.careers, which only the service role
// can touch; career_save stores it against its version, applies the workday's Energy and Mood and pays once
// (ledger 'career_pay', 'career_promo', 'career_screen').

type Admin = NonNullable<ReturnType<typeof getAdminSupabase>>;
type Job = { id: string; status: CareerState["status"] | "abandoned"; version: number; state: CareerState };
type Context = CareerCtx & { bank: number; job: Job | null };
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
  return data as Context;
}

function screen(ctx: Context, today: string, receipt?: string): CareerScreen {
  return {
    tracks: trackCards(ctx, today),
    canConnect: ctx.crew > 0 || ctx.clout >= CAREER.connectionClout,
    job: ctx.job ? careerView(content, ctx.job.state, today, ctx) : null,
    energy: ctx.energy,
    atPlace: ctx.atPlace,
    receipt,
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
  const caught = refresh(state, today, ctx, rng);
  let r: ReturnType<typeof change> = {};
  try {
    if (state.status === "employed") r = change(state, ctx, today);
  } catch (e) {
    if (e instanceof CareerError) return { ok: false, error: careerError(e.code) };
    throw e;
  }
  const err = await save(w.admin, w.id, ctx, state, { ...r, payouts: [...caught.payouts, ...(r.payouts ?? [])] });
  if (err) return { ok: false, error: err };
  // Part 2 (migration 0136): an office move nudges the private meter, and a rumor can make Lola's Blotter.
  if (r.integrity || r.headline) {
    const { error } = await w.admin.rpc("career_office", { p_player: w.id, p_id: ctx.job!.id, p_integrity: r.integrity ?? 0, p_headline: r.headline ?? null });
    if (error && !/career_office/.test(error.message)) console.error("career_office failed", error);
  }
  if (r.facts?.length) await remember(w.admin, w.id, r.facts);
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
    const r = refresh(state, today, ctx, rng);
    if (r.changed) {
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
  return act((s, ctx, today) => ({ ...startDay(content, s, style, ctx, today, rng), workday: today }));
}

export async function careerTask(index: number, option: string): Promise<Out> {
  return act((s, ctx) => answerTask(content, s, index, option, ctx, rng));
}

export async function careerOffice(action: OfficeAction, who: Who): Promise<Out> {
  // Migration 0140: an HR crackdown week at this employer (a city storylet) traces sabotage twice as often.
  const conditions = await cityConditions();
  return act((s, ctx, today) => {
    const exposedBefore = s.exposed ?? 0;
    const r = office(s, action, who, ctx, today, rng, { crackdown: conditionOn(conditions, "hr_crackdown", s.track) });
    const subject = `${s.track}:${who}`;
    const facts: Change["facts"] = [{ key: OFFICE_FACT[action], subject }];
    if ((s.exposed ?? 0) > exposedBefore) facts.push({ key: "career.caught_sabotage", subject });
    return { ...r, facts };
  });
}

export async function careerQuit(): Promise<Out> {
  return act((s, _ctx, today) => { quit(s, today); return { receipt: "You quit. The city is full of jobs. Probably." }; });
}
