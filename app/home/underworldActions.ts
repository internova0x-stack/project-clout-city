"use server";

import { randomInt } from "node:crypto";
import {
  UnderworldError, doJob, invited, markSeen, newState, refresh, retainLawyer, underworldError, view,
  type Change, type UnderworldCtx, type UnderworldResult, type UnderworldScreen, type UnderworldState,
} from "@/lib/underworld";
import { UNDERWORLD_CONTENT as content } from "@/lib/underworldContent";
import { nyDay } from "@/lib/campaign";
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
async function act(change: ((s: UnderworldState, ctx: Ctx, today: string) => Change & { receipt?: string; outcome?: UnderworldScreen["outcome"] }) | null): Promise<Out> {
  const w = await who();
  if ("error" in w) return { ok: false, error: w.error };
  const ctx = await load(w.id, w.admin);
  if ("error" in ctx) return { ok: false, error: ctx.error };
  const today = nyDay();
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
    c = change(state, ctx, today);
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
  return act((s, ctx, today) => doJob(content, s, job, option, today, ctx, rng));
}

export async function underworldLawyer(): Promise<Out> {
  return act((s, ctx, today) => retainLawyer(s, today, ctx));
}

export async function underworldSeen(): Promise<Out> {
  return act((s) => ({ payouts: [], holding: 0, headline: null, energy: 0, mood: 0, integrity: 0, changed: markSeen(s) }));
}
