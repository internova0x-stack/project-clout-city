"use server";

import { randomInt, randomUUID } from "node:crypto";
import {
  ACTIVITIES, RaceError, nextMonday, raceView, refresh, setBudget, setSlot, startRace, choose, reply,
  type Activity, type Crown, type Payout, type RaceState, type Slot,
} from "@/lib/schoolRace";
import { RACE_CONTENT as content } from "@/lib/schoolContent";
import { schoolError, schoolPortrait, type DeclareBlock, type SchoolBudget, type SchoolResult, type SchoolRival, type SchoolScreen } from "@/lib/schoolApi";
import { modelSex } from "@/lib/avatarCatalog";
import type { Look } from "@/lib/look";
import { nyDay } from "@/lib/campaign";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { getServerSupabase } from "@/lib/supabase/server";

// The Homecoming race (docs/SCHOOL-RACE.md; migration 0162). The rules run here with a crypto random source, like Careers and
// Campaign Mode: the browser sends a choice and gets back the player's view (raceView), never a card's odds, the hidden
// traces or the Dean's heat. The race lives in public.school_races, which only the service role can touch; school_save
// stores it against its version and pays once per (kind, ref): ledger 'school_*', Mood and the private meter.

type Admin = NonNullable<ReturnType<typeof getAdminSupabase>>;
type Race = { id: string; status: "running" | "over"; crown: Crown; version: number; state: RaceState };
type Context = {
  campus: string | null; body: string | null; bank: number; energy: number; oldEnough: boolean;
  campaign: boolean; job: boolean; dating: boolean; latest: Race | null;
};
type Out = SchoolResult<SchoolScreen>;

const rng = () => randomInt(0, 2 ** 32) / 2 ** 32;
const BUDGET_KEYS = ["party", "look", "merch", "tutor", "squad"] as const;

async function who(): Promise<{ id: string; admin: Admin } | { error: string }> {
  const supabase = await getServerSupabase();
  const admin = getAdminSupabase();
  if (!supabase || !admin) return { error: "Accounts aren't switched on yet." };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in first." };
  return { id: user.id, admin };
}

async function load(id: string, admin: Admin): Promise<Context | { error: string }> {
  const { data, error } = await admin.rpc("school_context", { p_player: id });
  if (error) {
    if (/school_context/.test(error.message)) return { error: "Run migration 0162 to open the Homecoming race." };
    console.error("school_context failed", error);
    return { error: schoolError("unknown") };
  }
  if (!data) return { error: "Create your character first." };
  return data as Context;
}

/** The crown follows the character creator's body (female → queen, male → king); a race keeps the one it was declared for. */
const crownOf = (ctx: Context): Crown => ctx.latest?.status === "running" ? ctx.latest.crown
  : modelSex({ body: (ctx.body ?? "") as Look["body"] }) === "f" ? "queen" : "king";

function blockOf(ctx: Context): DeclareBlock {
  if (!ctx.campus) return "not_enrolled";
  if (ctx.latest?.status === "running") return "running";
  if (ctx.campaign) return "campaign_running";
  if (!ctx.oldEnough) return "too_new";
  return null;
}

function rivalFor(ctx: Context, crown: Crown): SchoolRival | null {
  const id = ctx.latest?.status === "running" ? ctx.latest.state.rival : null;
  const r = (id ? content.rivals.find((x) => x.id === id) : undefined)
    ?? content.rivals.find((x) => x.crown === crown && x.campus === ctx.campus)
    ?? content.rivals.find((x) => x.crown === crown);
  return r ? { id: r.id, name: r.name, role: r.role, vibe: r.vibe, entrance: r.entrance, portrait: schoolPortrait(r.id) } : null;
}

const canOf = (ctx: Context) => ({ club: !!ctx.campus, date: ctx.dating, work: ctx.job });

function screen(ctx: Context, today: string, receipt?: string): SchoolScreen {
  const crown = crownOf(ctx);
  const block = blockOf(ctx);
  return {
    campus: ctx.campus,
    crown,
    rival: rivalFor(ctx, crown),
    canDeclare: block === null,
    block,
    blockText: block ? schoolError(block) : null,
    startsOn: nextMonday(today),
    bank: ctx.bank,
    can: canOf(ctx),
    view: ctx.latest ? raceView(content, ctx.latest.state, today) : null,
    receipt,
  };
}

const codeOf = (message: string) => /^(conflict|rate_limited|not_enrolled|too_new|campaign_running|running)/.exec(message)?.[1];

async function save(admin: Admin, player: string, ctx: Context, state: RaceState, payouts: Payout[]): Promise<string | null> {
  const race = ctx.latest!;
  const status = state.phase === "over" ? "over" : "running";
  const { data, error } = await admin.rpc("school_save", {
    p_player: player, p_id: race.id, p_version: race.version, p_state: state, p_status: status, p_payouts: payouts,
  });
  if (error) {
    const code = codeOf(error.message);
    if (!code) console.error("school_save failed", error);
    return schoolError(code ?? "unknown");
  }
  race.version = data as number;
  race.state = state;
  race.status = status;
  return null;
}

/** Refreshes the bank after anything that paid or spent cash. */
async function freshBank(admin: Admin, player: string, ctx: Context, payouts: Payout[]) {
  if (!payouts.some((p) => p.currency === "cash")) return;
  const { data } = await admin.from("players").select("bank_cash").eq("id", player).maybeSingle();
  if (data) ctx.bank = (data as { bank_cash: number }).bank_cash;
}

/** Loads the running race, brings it to today (the days' slots, Friday verdicts, Homecoming), runs one change and saves it. */
async function act(change: (state: RaceState, ctx: Context, today: string) => { payouts?: Payout[]; receipt?: string }): Promise<Out> {
  const w = await who();
  if ("error" in w) return { ok: false, error: w.error };
  const ctx = await load(w.id, w.admin);
  if ("error" in ctx) return { ok: false, error: ctx.error };
  if (ctx.latest?.status !== "running") return { ok: false, error: schoolError("no_race") };
  const today = nyDay();
  const state = structuredClone(ctx.latest.state);
  const caught = refresh(content, state, today, rng);
  let r: ReturnType<typeof change>;
  try {
    r = state.phase === "running" ? change(state, ctx, today) : {};
  } catch (e) {
    if (e instanceof RaceError) return { ok: false, error: schoolError(e.code) };
    throw e;
  }
  const payouts = [...caught.payouts, ...(r.payouts ?? [])];
  const err = await save(w.admin, w.id, ctx, state, payouts);
  if (err) return { ok: false, error: err };
  await freshBank(w.admin, w.id, ctx, payouts);
  return { ok: true, data: screen(ctx, today, r.receipt) };
}

export async function schoolScreen(): Promise<Out> {
  const w = await who();
  if ("error" in w) return { ok: false, error: w.error };
  const ctx = await load(w.id, w.admin);
  if ("error" in ctx) return { ok: false, error: ctx.error };
  const today = nyDay();
  if (ctx.latest?.status === "running") {
    const state = structuredClone(ctx.latest.state);
    const r = refresh(content, state, today, rng);
    if (r.changed) {
      const err = await save(w.admin, w.id, ctx, state, r.payouts);
      if (err) return { ok: false, error: err };
      await freshBank(w.admin, w.id, ctx, r.payouts);
    }
  }
  return { ok: true, data: screen(ctx, today) };
}

export async function schoolDeclare(): Promise<Out> {
  const w = await who();
  if ("error" in w) return { ok: false, error: w.error };
  const ctx = await load(w.id, w.admin);
  if ("error" in ctx) return { ok: false, error: ctx.error };
  const block = blockOf(ctx);
  if (block) return { ok: false, error: schoolError(block) };
  const today = nyDay();
  const crown = crownOf(ctx);
  const id = randomUUID();
  let state: RaceState;
  try {
    state = startRace(content, { id, campus: ctx.campus!, crown, startOn: nextMonday(today), job: ctx.job, dating: ctx.dating });
  } catch (e) {
    if (e instanceof RaceError) return { ok: false, error: schoolError(e.code) };
    throw e;
  }
  const { error } = await w.admin.rpc("school_begin", { p_player: w.id, p_id: id, p_campus: ctx.campus, p_crown: crown, p_state: state });
  if (error) {
    const code = codeOf(error.message);
    if (!code) console.error("school_begin failed", error);
    return { ok: false, error: schoolError(code ?? "unknown") };
  }
  // The first refresh brings week 1's mail (and anything due today); schoolScreen saves it.
  return schoolScreen();
}

export async function schoolSlot(day: number, slot: Slot, activity: Activity): Promise<Out> {
  if (!Number.isInteger(day) || day < 0 || day > 6 || (slot !== 0 && slot !== 1) || !ACTIVITIES.some((a) => a.id === activity)) {
    return { ok: false, error: schoolError("unknown") };
  }
  return act((s, ctx, today) => { setSlot(s, today, day, slot, activity, canOf(ctx)); return {}; });
}

export async function schoolBudget(b: SchoolBudget): Promise<Out> {
  const clean: SchoolBudget = {};
  for (const k of BUDGET_KEYS) if (b && typeof b[k] === "number") clean[k] = b[k];
  return act((s, ctx) => {
    setBudget(s, clean);
    const total = BUDGET_KEYS.reduce((a, k) => a + s.budget[k], 0);
    if (total > ctx.bank) throw new RaceError("no_cash");
    return {};
  });
}

export async function schoolChoose(card: string, option: string): Promise<Out> {
  if (typeof card !== "string" || typeof option !== "string") return { ok: false, error: schoolError("unknown") };
  return act((s) => choose(content, s, card, option, rng));
}

export async function schoolReply(msg: string, option: string): Promise<Out> {
  if (typeof msg !== "string" || typeof option !== "string") return { ok: false, error: schoolError("unknown") };
  return act((s) => {
    const payouts = reply(content, s, msg, option, rng);
    const receipt = content.inbox.find((m) => m.id === msg)?.options.find((o) => o.id === option)?.receipt;
    return { payouts, receipt };
  });
}
