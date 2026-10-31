"use server";

import { randomInt, randomUUID } from "node:crypto";
import {
  CAMPAIGN, campaignError, campaignHome, nyDay,
  type CampaignResult, type CampaignScreen, type CampaignState, type CandidateId, type Channel, type DebateStyle, type Payout, type SlotAction,
} from "@/lib/campaign";
import { CAMPAIGN_CONTENT as content } from "@/lib/campaignContent";
import {
  CampaignError, campaignView, candidateCards, choose, debateRound, dilemma, endWeek, refresh, reply, setBudget, setSlot, startCampaign,
} from "@/lib/campaignEngine";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { getServerSupabase } from "@/lib/supabase/server";
import { unlockedCards } from "@/lib/cardFormat";
import { integrityBand } from "@/lib/choices";
import { memoryOf } from "@/lib/memoryServer";

// Campaign Mode (docs/CAMPAIGN-MODE.md; migration 0127). The rules run here, on the server, with a crypto random
// source: the browser sends a choice and gets back the player's view, never a roll or the hidden odds. The campaign's
// state lives in public.campaigns, which only the service role can touch; campaign_save stores it against its version
// and pays what the week earned into the main game once (ledger 'campaign_*').

type Context = {
  rank: number; clout: number; bank: number; home: string | null; crew: number; lastStart: string | null; won: CandidateId[];
  latest: { id: string; status: "running" | "over"; version: number; state: CampaignState; endedAt: string | null } | null;
};

const rng = () => randomInt(0, 2 ** 32) / 2 ** 32;
type Out = CampaignResult<CampaignScreen>;

async function who(): Promise<{ id: string; admin: NonNullable<ReturnType<typeof getAdminSupabase>> } | { error: string }> {
  const supabase = await getServerSupabase();
  const admin = getAdminSupabase();
  if (!supabase || !admin) return { error: "Accounts aren't switched on yet." };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in first." };
  return { id: user.id, admin };
}

function screen(ctx: Context, today: string, extra: Partial<CampaignScreen> = {}): CampaignScreen {
  const latest = ctx.latest;
  const running = latest?.status === "running";
  const next = ctx.lastStart ? new Date(new Date(ctx.lastStart).getTime() + CAMPAIGN.restartDays * 86400000) : null;
  const cleared = !next || next.getTime() <= Date.now();
  return {
    unlocked: ctx.rank >= CAMPAIGN.unlockRank,
    rank: ctx.rank,
    clout: ctx.clout,
    canStart: ctx.rank >= CAMPAIGN.unlockRank && !running && cleared,
    nextStartOn: cleared || !next ? null : nyDay(next),
    bank: ctx.bank,
    candidates: candidateCards(content),
    wonBefore: ctx.won,
    view: latest ? campaignView(content, latest.state, today) : null,
    ...extra,
  };
}

async function load(id: string, admin: NonNullable<ReturnType<typeof getAdminSupabase>>): Promise<Context | { error: string }> {
  const { data, error } = await admin.rpc("campaign_context", { p_player: id });
  if (error) {
    if (/campaign_context/.test(error.message)) return { error: "Run migration 0127 to open Campaign Mode." };
    console.error("campaign_context failed", error);
    return { error: campaignError("unknown") };
  }
  if (!data) return { error: "Create your character first." };
  return data as Context;
}

async function save(admin: NonNullable<ReturnType<typeof getAdminSupabase>>, player: string, ctx: Context, state: CampaignState, payouts: Payout[]): Promise<string | null> {
  const latest = ctx.latest!;
  const { data, error } = await admin.rpc("campaign_save", {
    p_player: player, p_id: latest.id, p_version: latest.version, p_state: state, p_week: state.week,
    p_status: state.phase === "over" ? "over" : "running", p_ending: state.ending, p_debate_won: state.debate?.won ?? null, p_payouts: payouts,
  });
  if (error) {
    if (/conflict/.test(error.message)) return campaignError("conflict");
    if (/rate_limited/.test(error.message)) return "Slow down, boss. The campaign needs a breather.";
    console.error("campaign_save failed", error);
    return campaignError("unknown");
  }
  latest.version = data as number;
  latest.state = state;
  if (state.phase === "over") latest.status = "over";
  return null;
}

/** Loads the running campaign, brings it to today, runs one change and saves it. */
async function act(change: (state: CampaignState, today: string) => { payouts?: Payout[]; receipt?: string; round?: CampaignScreen["round"] }): Promise<Out> {
  const w = await who();
  if ("error" in w) return { ok: false, error: w.error };
  const ctx = await load(w.id, w.admin);
  if ("error" in ctx) return { ok: false, error: ctx.error };
  if (ctx.latest?.status !== "running") return { ok: false, error: campaignError("no_campaign") };
  const today = nyDay();
  const state = structuredClone(ctx.latest.state);
  refresh(state, today);
  let r: ReturnType<typeof change>;
  try {
    r = change(state, today);
  } catch (e) {
    if (e instanceof CampaignError) return { ok: false, error: campaignError(e.code) };
    throw e;
  }
  const err = await save(w.admin, w.id, ctx, state, r.payouts ?? []);
  if (err) return { ok: false, error: err };
  // Option C (migration 0142): the week's nudge to the manager's own meter, once per (campaign, week).
  for (const n of state.rep ?? []) {
    const { error } = await w.admin.rpc("campaign_rep", { p_player: w.id, p_campaign: state.id, p_week: n.week, p_delta: n.delta });
    if (error && !/campaign_rep/.test(error.message)) console.error("campaign_rep failed", error);
  }
  if (r.payouts?.some((p) => p.currency === "cash")) {
    const fresh = await load(w.id, w.admin);
    if (!("error" in fresh)) ctx.bank = fresh.bank;
  }
  return { ok: true, data: screen(ctx, today, { receipt: r.receipt, round: r.round }) };
}

export async function campaignScreen(): Promise<Out> {
  const w = await who();
  if ("error" in w) return { ok: false, error: w.error };
  const ctx = await load(w.id, w.admin);
  if ("error" in ctx) return { ok: false, error: ctx.error };
  const today = nyDay();
  if (ctx.latest?.status === "running") {
    const state = structuredClone(ctx.latest.state);
    if (refresh(state, today)) {
      const err = await save(w.admin, w.id, ctx, state, []);
      if (err) return { ok: false, error: err };
    }
  }
  return { ok: true, data: screen(ctx, today) };
}

/** Option C: the manager's own Halo ↔ Hustler band, once their meter has been revealed (null before). */
async function managerBand(admin: NonNullable<ReturnType<typeof getAdminSupabase>>, player: string): Promise<"high" | "middle" | "low" | null> {
  const { data, error } = await admin.from("reputation").select("integrity, revealed_at").eq("player_id", player).maybeSingle();
  if (error || !data?.revealed_at) return null;
  return integrityBand(data.integrity as number);
}

export async function campaignStart(candidate: CandidateId, seed: number): Promise<Out> {
  const w = await who();
  if ("error" in w) return { ok: false, error: w.error };
  const ctx = await load(w.id, w.admin);
  if ("error" in ctx) return { ok: false, error: ctx.error };
  if (!content.candidates.some((c) => c.id === candidate)) return { ok: false, error: campaignError("unknown") };
  const s = Math.max(0, Math.min(CAMPAIGN.seedMax, Math.round(seed || 0)));
  const id = randomUUID();
  let state: CampaignState;
  try {
    state = startCampaign(content, { id, candidate, clout: ctx.clout, crew: ctx.crew, home: campaignHome(ctx.home), seed: s, wonBefore: ctx.won.includes(candidate), band: await managerBand(w.admin, w.id) }, rng);
  } catch (e) {
    if (e instanceof CampaignError) return { ok: false, error: campaignError(e.code) };
    throw e;
  }
  const { error } = await w.admin.rpc("campaign_begin", { p_player: w.id, p_id: id, p_candidate: candidate, p_state: state, p_seed: s });
  if (error) {
    const code = /^(locked|running|too_soon|bad_seed|no_bank)/.exec(error.message)?.[1];
    if (!code) console.error("campaign_begin failed", error);
    return { ok: false, error: code ? campaignError(code) : campaignError("unknown") };
  }
  return campaignScreen();
}

export async function campaignBudget(budget: Record<Channel, number>): Promise<Out> {
  return act((s) => { setBudget(s, budget); return {}; });
}
export async function campaignSlot(index: number, action: SlotAction | null): Promise<Out> {
  return act((s) => { setSlot(content, s, index, action); return {}; });
}
export async function campaignReply(message: string, option: string): Promise<Out> {
  return act((s) => ({ receipt: reply(content, s, message, option, rng) }));
}
export async function campaignDilemma(id: "skim" | "charity", choice: string): Promise<Out> {
  return act((s) => dilemma(content, s, id, choice));
}
export async function campaignDebate(style: DebateStyle): Promise<Out> {
  return act((s) => { const r = debateRound(content, s, style, rng); return { round: { delta: r.delta, line: r.line } }; });
}
export async function campaignEndWeek(): Promise<Out> {
  // Content Engine step 7: situations from the manager's own past (a firing, a cheating scandal…) if their memory fits.
  const admin = getAdminSupabase();
  const w = await getServerSupabase().then(async (sb) => (sb ? (await sb.auth.getUser()).data.user : null));
  const memory = admin && w ? await memoryOf(admin, w.id) : null;
  const unlocked = Object.keys(unlockedCards(content.situations, memory, new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" })));
  return act((s, today) => endWeek(content, s, today, rng, { unlocked }));
}
export async function campaignChoose(situation: string, choice: string): Promise<Out> {
  return act((s, today) => choose(content, s, situation, choice, today, rng));
}
