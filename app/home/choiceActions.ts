"use server";

import { randomInt } from "node:crypto";
import {
  CHOICES, boundEffects, cardView, repBonus, choiceError, mayOffer, pickCard, resolveChoice,
  type BlotterItem, type ChoiceAfter, type ChoiceCard, type ChoiceCardView, type ChoiceMark, type ChoiceEffects, type ChoiceLogEntry, type ChoiceMade, type ChoiceResult, type ChoiceState,
} from "@/lib/choices";
import { CHOICE_CARDS } from "@/lib/choicesContent";
import type { Memory } from "@/lib/memory";
import { conditionsInForce, type ConditionNow } from "@/lib/cityConditions";
import { placeById } from "@/lib/city";
import { ECONOMY } from "@/lib/economy";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { getServerSupabase } from "@/lib/supabase/server";

// Moral Choices (spec section 29; migration 0131). The rules run here with a crypto random source: the server picks
// the card for where the player really is (players.at_place), rolls the outcome and what comes back later, and the
// database pays it once. The browser sends a choice and gets the receipt, never an outcome, a weight or a later.

const rng = () => randomInt(0, 2 ** 32) / 2 ** 32;
type Admin = NonNullable<ReturnType<typeof getAdminSupabase>>;

interface Context {
  today: string; atPlace: string | null; integrity: number; revealed: boolean; rank: number; bank: number;
  student: boolean; business: boolean; home: string | null; shownToday: number; lastShownAt: string | null;
  open: { log: number; card: string; place: string | null } | null;
  history: { id: string; base: string; day: string }[];
}

async function who(): Promise<{ id: string; admin: Admin } | { error: string }> {
  const supabase = await getServerSupabase();
  const admin = getAdminSupabase();
  if (!supabase || !admin) return { error: "Accounts aren't switched on yet." };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in first." };
  return { id: user.id, admin };
}

// Content Engine step 3 (migration 0139): the weekly storylets that have gone live (read every 5 minutes per server).
// A vetoed or paused card is no longer offered, but an open card or a player's history still finds it.
let weekly: { cards: ChoiceCard[]; offer: ChoiceCard[]; at: number } = { cards: [], offer: [], at: 0 };
async function loadWeekly(admin: Admin) {
  if (Date.now() - weekly.at < 5 * 60_000) return;
  const { data, error } = await admin.rpc("storylets_live");
  // Before migration 0139 the function is missing: no weekly cards (check again in 5 minutes).
  const rows = error || !Array.isArray(data) ? [] : (data as { card: ChoiceCard; offer: boolean }[]);
  weekly = { cards: rows.map((r) => r.card), offer: rows.filter((r) => r.offer).map((r) => r.card), at: Date.now() };
}
const card = (id: string): ChoiceCard | undefined => CHOICE_CARDS.find((c) => c.id === id) ?? weekly.cards.find((c) => c.id === id);
const err = (e: { message: string } | null) => {
  const code = e?.message.match(/[a-z_]+/)?.[0];
  return choiceError(code && code in { not_open: 1, rate_limited: 1 } ? code : undefined);
};

async function context(admin: Admin, id: string): Promise<Context | { error: string }> {
  await loadWeekly(admin);
  const { data, error } = await admin.rpc("choice_context", { p_player: id });
  if (error) {
    if (/choice_context/.test(error.message)) return { error: "Run migration 0131 to switch on Moral Choices." };
    console.error("choice_context failed", error);
    return { error: choiceError(undefined) };
  }
  if (!data) return { error: "Create your character first." };
  return data as Context;
}

function entry(row: { id: number; kind: string; card: string; option: string | null; receipt: string | null; emoji?: string; effects: ChoiceEffects | null; day: string }): ChoiceLogEntry {
  const c = card(row.card);
  const opt = c?.options.find((o) => o.id === row.option);
  return {
    id: row.id, day: row.day, emoji: row.emoji ?? c?.emoji ?? "🤔", title: c?.title ?? "A choice you made",
    choice: opt?.label ?? "", receipt: row.receipt ?? "", effects: row.effects ?? {}, cameBack: row.kind === "later" || undefined,
  };
}

/** A ban's "here" is the place the card happened (or wherever the player is); without one, the ban is dropped. */
function resolveHere(e: ChoiceEffects, place: string | null): ChoiceEffects {
  if (!e.ban || e.ban.place !== "here") return e;
  return place ? { ...e, ban: { ...e.ban, place } } : { ...e, ban: undefined };
}

/** The player's memory (migration 0138): storylets read it; without the migration, only cards that don't need it show. */
async function memoryOf(admin: Admin, id: string): Promise<Memory | null> {
  const [{ data, error }, cond] = await Promise.all([admin.rpc("player_memory", { p_player: id }), admin.rpc("city_conditions_now")]);
  if (error || !data) return null;
  const m = data as Memory;
  // Migration 0140: the city's conditions in force (a heatwave, a crackdown) join the snapshot for storylets.
  return { ...m, snapshot: { ...m.snapshot, conditions: !cond.error && Array.isArray(cond.data) ? conditionsInForce(cond.data as ConditionNow[]) : [] } };
}

/** Storylets: what a choice wrote to memory (never blocks the choice). */
async function remember(admin: Admin, id: string, sets: { fact: string; subject: string }[]) {
  for (const f of sets) {
    const { error } = await admin.rpc("fact_note", { p_player: id, p_key: f.fact, p_subject: f.subject });
    if (error && !/fact_note/.test(error.message)) console.error("fact_note failed", error);
  }
}

type Status = { chainDue: string | null; marks: ChoiceMark[] };

/** Migration 0132: lasting effects and the chain card due (empty before it has run). */
async function status(admin: Admin, id: string): Promise<Status> {
  const { data, error } = await admin.rpc("choice_status", { p_player: id });
  return error || !data ? { chainDue: null, marks: [] } : (data as Status);
}

/** A chain's follow-up card is due: it opens now, past the daily limit, with what came back as its intro. */
async function openChain(admin: Admin, id: string, ctx: Context, st: Status): Promise<ChoiceCardView | null> {
  if (!st.chainDue || ctx.open) return null;
  const c = card(st.chainDue);
  const { data, error } = await admin.rpc("choice_chain_open", { p_player: id, p_base: c?.base ?? st.chainDue, p_area: c?.area ?? "life", p_place: ctx.atPlace });
  if (error || !data || !c) return null;
  const d = data as { log: number; text: string };
  return { ...cardView(c, d.log, ctx.atPlace, c.slots ? await memoryOf(admin, id) : null), intro: d.text };
}

export async function choiceState(): Promise<ChoiceResult<ChoiceState>> {
  const w = await who();
  if ("error" in w) return { ok: false, error: w.error };
  const ctx = await context(w.admin, w.id);
  if ("error" in ctx) return { ok: false, error: ctx.error };
  const [landed, hist, st] = await Promise.all([
    w.admin.rpc("choice_land", { p_player: w.id }),
    w.admin.rpc("choice_history", { p_player: w.id }),
    status(w.admin, w.id),
  ]);
  if (landed.error || hist.error) return { ok: false, error: choiceError(undefined) };
  const h = hist.data as { integrity: number | null; log: Parameters<typeof entry>[0][] };
  const o = ctx.open ? card(ctx.open.card) : undefined;
  const chain = await openChain(w.admin, w.id, ctx, st);
  const mem = o?.slots ? await memoryOf(w.admin, w.id) : null;
  return {
    ok: true,
    data: {
      marks: st.marks,
      integrity: h.integrity,
      open: chain ?? (o && ctx.open ? cardView(o, ctx.open.log, ctx.open.place, mem) : null),
      landed: (landed.data as { id: number; card: string; option: string; emoji: string; text: string; effects: ChoiceEffects; day: string }[])
        .map((x) => ({ ...entry({ id: x.id, kind: "later", card: x.card, option: x.option, receipt: x.text, emoji: x.emoji, effects: x.effects, day: x.day }) })),
      log: h.log.map(entry),
    },
  };
}

export async function choiceOffer(after: ChoiceAfter): Promise<ChoiceResult<ChoiceCardView | null>> {
  const w = await who();
  if ("error" in w) return { ok: false, error: w.error };
  const ctx = await context(w.admin, w.id);
  if ("error" in ctx) return { ok: false, error: ctx.error };
  if (ctx.open) {
    const o = card(ctx.open.card);
    return { ok: true, data: o ? cardView(o, ctx.open.log, ctx.open.place, o.slots ? await memoryOf(w.admin, w.id) : null) : null };
  }
  const chain = await openChain(w.admin, w.id, ctx, await status(w.admin, w.id));
  if (chain) return { ok: true, data: chain };
  if (!mayOffer({ shownToday: ctx.shownToday, lastShownAt: ctx.lastShownAt, open: false, now: new Date() }) || rng() >= CHOICES.chance) {
    return { ok: true, data: null };
  }
  const place = ctx.atPlace ? placeById(ctx.atPlace) : undefined;
  const memory = await memoryOf(w.admin, w.id);
  const pick = pickCard([...CHOICE_CARDS, ...weekly.offer], {
    memory,
    place: place?.id ?? null, tags: place?.tags ?? [], after, integrity: ctx.integrity, rank: ctx.rank,
    student: ctx.student, business: ctx.business, roommate: !!ECONOMY.homes.find((x) => x.id === ctx.home)?.roommate, history: ctx.history, today: ctx.today,
  }, rng);
  if (!pick) return { ok: true, data: null };
  const { data, error } = await w.admin.rpc("choice_open", { p_player: w.id, p_card: pick.id, p_base: pick.base, p_area: pick.area, p_place: place?.id ?? null });
  if (error) {
    if (/already_open|enough_today/.test(error.message)) return { ok: true, data: null };
    return { ok: false, error: err(error) };
  }
  return { ok: true, data: cardView(pick, data as number, place?.id ?? null, memory) };
}

export async function choiceChoose(log: number, option: string): Promise<ChoiceResult<ChoiceMade>> {
  const w = await who();
  if ("error" in w) return { ok: false, error: w.error };
  const ctx = await context(w.admin, w.id);
  if ("error" in ctx) return { ok: false, error: ctx.error };
  if (!ctx.open || ctx.open.log !== log) return { ok: false, error: choiceError("not_open") };
  const c = card(ctx.open.card);
  if (!c || !c.options.some((o) => o.id === option)) return { ok: false, error: choiceError("unknown_option") };
  const memory = c.slots || c.options.some((o) => o.outcomes.some((x) => x.sets)) ? await memoryOf(w.admin, w.id) : null;
  const r = resolveChoice(c, option, ctx.today, rng, ctx.integrity, memory);
  // Each end of the meter pays its own way (repBonus): more clout for a Halo, more cash for a Hustler.
  const where = ctx.open.place ?? ctx.atPlace;
  const clean = (e: ChoiceEffects) => Object.fromEntries(Object.entries(e).filter(([, v]) => v));
  const effects = boundEffects(resolveHere(repBonus(r.effects, ctx.integrity), where), ctx.bank);
  const { data, error } = await w.admin.rpc("choice_settle", {
    p_player: w.id, p_log: log, p_option: option, p_outcome: r.outcome, p_receipt: r.text,
    p_effects: clean(effects),
    p_later: r.later ? {
      due: r.later.due, emoji: r.later.emoji, text: r.later.text,
      effects: clean(boundEffects(resolveHere(r.later.effects, where), Number.MAX_SAFE_INTEGER)),
      card: r.later.card ?? null, headline: r.later.headline ?? null,
    } : null,
  });
  if (error) {
    console.error("choice_settle failed", error);
    return { ok: false, error: err(error) };
  }
  const d = data as { integrity: number; first: boolean; applied: ChoiceEffects };
  if (r.sets.length) await remember(w.admin, w.id, r.sets);
  return { ok: true, data: { receipt: r.text, effects: d.applied, integrity: d.integrity, first: d.first } };
}

export async function choiceSkip(log: number): Promise<ChoiceResult<null>> {
  const w = await who();
  if ("error" in w) return { ok: false, error: w.error };
  const { error } = await w.admin.rpc("choice_skip", { p_player: w.id, p_log: log });
  return error ? { ok: false, error: err(error) } : { ok: true, data: null };
}

export async function choiceSeen(ids: number[]): Promise<ChoiceResult<null>> {
  const w = await who();
  if ("error" in w) return { ok: false, error: w.error };
  const { error } = await w.admin.rpc("choice_seen", { p_player: w.id, p_ids: ids.filter((n) => Number.isInteger(n)).slice(0, 50) });
  return error ? { ok: false, error: err(error) } : { ok: true, data: null };
}

export async function choiceBail(): Promise<ChoiceResult<{ cost: number }>> {
  const w = await who();
  if ("error" in w) return { ok: false, error: w.error };
  const { data, error } = await w.admin.rpc("choice_bail", { p_player: w.id });
  if (error) {
    const code = error.message.match(/not_held|cant_afford/)?.[0];
    return { ok: false, error: choiceError(code) };
  }
  return { ok: true, data: { cost: data as number } };
}

export async function choiceBlotter(): Promise<ChoiceResult<BlotterItem[]>> {
  const supabase = await getServerSupabase();
  if (!supabase) return { ok: true, data: [] };
  const { data, error } = await supabase.rpc("choice_blotter");
  return error ? { ok: true, data: [] } : { ok: true, data: (data ?? []) as BlotterItem[] };
}

/** The city's conditions now and in the next 48 hours (migration 0140; none before it has run). */
export async function choiceConditions(): Promise<ChoiceResult<ConditionNow[]>> {
  const supabase = await getServerSupabase();
  if (!supabase) return { ok: true, data: [] };
  const { data, error } = await supabase.rpc("city_conditions_now");
  return error || !Array.isArray(data) ? { ok: true, data: [] } : { ok: true, data: data as ConditionNow[] };
}
