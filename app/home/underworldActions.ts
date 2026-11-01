"use server";

import { randomInt } from "node:crypto";
import {
  UnderworldError, doJob, invited, markSeen, newState, refresh, retainLawyer, sitTable, underworldError, view,
  type Change, type UnderworldContent, type UnderworldCtx, type UnderworldResult, type UnderworldScreen, type UnderworldState,
} from "@/lib/underworld";
import { UNDERWORLD_CONTENT } from "@/lib/underworldContent";
import { withWeekly, type LiveUnderworldJob } from "@/lib/underworldWeeks";
import { nyDay } from "@/lib/campaign";
import { MARKETPLACE, hireError, marketError, type UnderworldHires, type UnderworldRunner } from "@/lib/marketplace";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { getServerSupabase } from "@/lib/supabase/server";

// The underworld (spec section 31; migration 0148). The rules run here with a crypto random source: the browser sends a
// job and an option and gets back the player's view, never the odds, the traces or what's coming. The state lives in
// public.underworld, which only the service role can touch; underworld_save stores it against its version, applies a
// job's Energy, Mood and the meter, pays once (ledger 'underworld_pay', 'underworld_fine', 'underworld_lawyer'), puts a
// caught player in holding and posts the Blotter headline.

type Admin = NonNullable<ReturnType<typeof getAdminSupabase>>;
type Ctx = UnderworldCtx & { row: { version: number; state: UnderworldState } | null };
type Out = UnderworldResult<UnderworldScreen>;

const rng = () => randomInt(0, 2 ** 32) / 2 ** 32;

// Part 2 (migration 0150): the weekly jobs that went live join Pablo's pool, read at most every 5 minutes.
let weekly: { at: number; live: LiveUnderworldJob[] } = { at: 0, live: [] };
async function contentFor(admin: Admin): Promise<UnderworldContent> {
  if (Date.now() - weekly.at > 5 * 60_000) {
    const { data, error } = await admin.rpc("underworld_jobs_live");
    weekly = { at: Date.now(), live: error ? weekly.live : ((data ?? []) as LiveUnderworldJob[]) };
  }
  return withWeekly(UNDERWORLD_CONTENT, weekly.live);
}

async function who(): Promise<{ id: string; admin: Admin } | { error: string }> {
  const supabase = await getServerSupabase();
  const admin = getAdminSupabase();
  if (!supabase || !admin) return { error: "Accounts aren't switched on yet." };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in first." };
  return { id: user.id, admin };
}

async function load(id: string, admin: Admin): Promise<Ctx | { error: string }> {
  const { data, error } = await admin.rpc("underworld_context", { p_player: id });
  if (error) {
    if (/underworld_context/.test(error.message)) return { error: "Run migration 0148 to open Pablo's back room." };
    console.error("underworld_context failed", error);
    return { error: underworldError("unknown") };
  }
  if (!data) return { error: "Create your character first." };
  return data as Ctx;
}

const codeOf = (message: string) => /^(conflict|rate_limited|in_holding|no_energy)/.exec(message)?.[1];

async function save(admin: Admin, player: string, ctx: Ctx, state: UnderworldState, c: Change): Promise<string | null> {
  const { data, error } = await admin.rpc("underworld_save", {
    p_player: player, p_version: ctx.row?.version ?? 0, p_state: state, p_energy: c.energy, p_mood: c.mood, p_integrity: c.integrity,
    p_payouts: c.payouts, p_holding: c.holding, p_headline: c.headline,
  });
  if (error) {
    const code = codeOf(error.message);
    if (!code) console.error("underworld_save failed", error);
    return underworldError(code ?? "unknown");
  }
  ctx.row = { version: data as number, state };
  ctx.energy = Math.max(0, ctx.energy + c.energy);
  for (const p of c.payouts) ctx.bank = Math.max(0, ctx.bank + p.amount);
  if (c.holding) { ctx.holding = true; ctx.atPlace = "precinct-114-half"; }
  return null;
}

/** Loads the state (made on the invitation's first visit), brings it to today, runs one change and saves it. */
async function act(change: ((s: UnderworldState, ctx: Ctx, today: string, content: UnderworldContent) => Change & { receipt?: string; outcome?: UnderworldScreen["outcome"] }) | null): Promise<Out> {
  const w = await who();
  if ("error" in w) return { ok: false, error: w.error };
  const ctx = await load(w.id, w.admin);
  if ("error" in ctx) return { ok: false, error: ctx.error };
  const today = nyDay();
  const content = await contentFor(w.admin);
  if (!ctx.row && !invited(ctx)) {
    if (change) return { ok: false, error: underworldError("locked") };
    return { ok: true, data: { view: view(content, null, today, ctx) } };
  }
  const state = structuredClone(ctx.row?.state ?? newState(today));
  const r = refresh(content, state, today, ctx, rng);
  if (r.changed || !ctx.row) {
    const err = await save(w.admin, w.id, ctx, state, r);
    if (err) return { ok: false, error: err };
  }
  if (!change) return { ok: true, data: { view: view(content, state, today, ctx) } };
  let c: ReturnType<NonNullable<typeof change>>;
  try {
    c = change(state, ctx, today, content);
  } catch (e) {
    if (e instanceof UnderworldError) return { ok: false, error: underworldError(e.code) };
    throw e;
  }
  if (c.changed) {
    const err = await save(w.admin, w.id, ctx, state, c);
    if (err) return { ok: false, error: err };
  }
  return { ok: true, data: { view: view(content, state, today, ctx), receipt: c.receipt, outcome: c.outcome } };
}

export async function underworldScreen(): Promise<Out> {
  return act(null);
}

export async function underworldJob(job: string, option: string): Promise<Out> {
  if (typeof job !== "string" || typeof option !== "string") return { ok: false, error: underworldError("no_offer") };
  return act((s, ctx, today, content) => doJob(content, s, job, option, today, ctx, rng));
}

export async function underworldLawyer(): Promise<Out> {
  return act((s, ctx, today) => retainLawyer(s, today, ctx));
}

export async function underworldTable(): Promise<Out> {
  return act((s, ctx, today, content) => sitTable(content, s, today, ctx, rng));
}

export async function underworldSeen(): Promise<Out> {
  return act((s) => ({ payouts: [], holding: 0, headline: null, energy: 0, mood: 0, integrity: 0, changed: markSeen(s) }));
}

// ---------------------------------------------------------------------------------------------------------------
// Migration 0152: underworld jobs between players (runners; NPC targets only). The poster hands one of today's offers to
// an invited friend for a cut the database holds in escrow; the runner does it here through doJob's hire mode (their own
// Heat, Energy, fines and holding); then underworld_hire_settle pays the cut minus the fee, gives Pablo's take to the poster
// and adds the poster's Heat. A runner's state remembers each hire it ran, so a settle that failed is paid on the next look.
// ---------------------------------------------------------------------------------------------------------------
const hireMessage = (message: string) => hireError(message) ?? marketError(message);

export async function underworldRunners(): Promise<UnderworldResult<UnderworldRunner[]>> {
  const w = await who();
  if ("error" in w) return { ok: false, error: w.error };
  const { data, error } = await w.admin.rpc("underworld_runners", { p_player: w.id });
  if (error) return { ok: false, error: hireMessage(error.message) };
  return { ok: true, data: (data ?? []) as UnderworldRunner[] };
}

export async function underworldHires(): Promise<UnderworldResult<UnderworldHires>> {
  const w = await who();
  if ("error" in w) return { ok: false, error: w.error };
  const { data, error } = await w.admin.rpc("underworld_hire_list", { p_player: w.id });
  if (error) return { ok: false, error: /underworld_hire_list/.test(error.message) ? "Runners open with migration 0152." : hireMessage(error.message) };
  const content = await contentFor(w.admin);
  const withOptions = (l: UnderworldHires): UnderworldHires => ({
    ...l,
    received: l.received.map((h) => ({ ...h, options: content.jobs.find((j) => j.id === h.job)?.options.map((o) => ({ id: o.id, label: o.label, get: o.get, cost: o.cost, energy: o.energy })) ?? [] })),
  });
  const list = withOptions(data as UnderworldHires);
  // A hire this runner already ran but that wasn't paid (the settle failed): pay it now, once.
  const waiting = list.received.filter((h) => h.status === "offered");
  if (waiting.length) {
    const ctx = await load(w.id, w.admin);
    const ran = "error" in ctx ? [] : ctx.row?.state.hires ?? [];
    let again = false;
    for (const h of waiting) {
      const r = ran.find((x) => x.id === h.id);
      if (!r) continue;
      const { error: e } = await w.admin.rpc("underworld_hire_settle", { p_id: h.id, p_runner: w.id, p_outcome: r.outcome, p_pay: r.pay });
      if (!e) again = true;
    }
    if (again) {
      const { data: d2 } = await w.admin.rpc("underworld_hire_list", { p_player: w.id });
      if (d2) return { ok: true, data: withOptions(d2 as UnderworldHires) };
    }
  }
  return { ok: true, data: list };
}

export async function underworldHire(job: string, runner: string, cut: number): Promise<UnderworldResult<{ id: number; cash: number }>> {
  if (typeof job !== "string" || typeof runner !== "string" || !Number.isInteger(cut)) return { ok: false, error: underworldError("no_offer") };
  const w = await who();
  if ("error" in w) return { ok: false, error: w.error };
  const content = await contentFor(w.admin);
  const j = content.jobs.find((x) => x.id === job);
  if (!j) return { ok: false, error: underworldError("no_offer") };
  const { data, error } = await w.admin.rpc("underworld_hire_post", { p_poster: w.id, p_runner: runner, p_job: job, p_title: j.title, p_emoji: j.emoji, p_cut: cut });
  if (error) return { ok: false, error: hireMessage(error.message) };
  return { ok: true, data: data as { id: number; cash: number } };
}

export async function underworldRunHire(id: number, option: string): Promise<Out> {
  if (!Number.isInteger(id) || typeof option !== "string") return { ok: false, error: underworldError("no_offer") };
  const w = await who();
  if ("error" in w) return { ok: false, error: w.error };
  const { data: h, error } = await w.admin.rpc("underworld_hire_get", { p_runner: w.id, p_id: id });
  if (error) return { ok: false, error: hireMessage(error.message) };
  if (!h) return { ok: false, error: hireError("hire_gone")! };
  const hire = h as { id: number; job: string; title: string; cut: number; posterName: string | null };
  const ran: { outcome?: "win" | "trace" | "fizzle" | "bust"; pay: number } = { pay: 0 };
  const r = await act((s, ctx, today, content) => {
    const x = doJob(content, s, hire.job, option, today, ctx, rng, { id: hire.id, heat: MARKETPLACE.hire.runnerHeat });
    ran.outcome = x.outcome;
    ran.pay = x.hirePay ?? 0;
    return x;
  });
  if (!r.ok || !ran.outcome) return r;
  const { data: paid, error: e } = await w.admin.rpc("underworld_hire_settle", { p_id: hire.id, p_runner: w.id, p_outcome: ran.outcome, p_pay: ran.pay });
  if (e) console.error("underworld_hire_settle failed", e);
  const cut = (paid as { cut?: number } | null)?.cut ?? 0;
  const boss = hire.posterName ? `@${hire.posterName}` : "your boss";
  const tail = e ? " The cut is on its way." : cut > 0 ? ` Your cut: C$${cut.toLocaleString("en-US")} after the city fee, from ${boss}.` : "";
  return { ok: true, data: { ...r.data, receipt: `${r.data.receipt ?? ""}${tail}` } };
}

export async function underworldDeclineHire(id: number): Promise<UnderworldResult<unknown>> {
  if (!Number.isInteger(id)) return { ok: false, error: hireError("hire_gone")! };
  const w = await who();
  if ("error" in w) return { ok: false, error: w.error };
  const { error } = await w.admin.rpc("underworld_hire_decline", { p_runner: w.id, p_id: id });
  if (error) return { ok: false, error: hireMessage(error.message) };
  return { ok: true, data: null };
}
