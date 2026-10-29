"use server";

import { randomInt } from "node:crypto";
import {
  CHOICES, boundEffects, cardView, choiceError, mayOffer, pickCard, resolveChoice,
  type ChoiceAfter, type ChoiceCard, type ChoiceCardView, type ChoiceEffects, type ChoiceLogEntry, type ChoiceMade, type ChoiceResult, type ChoiceState,
} from "@/lib/choices";
import { CHOICE_CARDS } from "@/lib/choicesContent";
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

const card = (id: string): ChoiceCard | undefined => CHOICE_CARDS.find((c) => c.id === id);
const err = (e: { message: string } | null) => {
  const code = e?.message.match(/[a-z_]+/)?.[0];
  return choiceError(code && code in { not_open: 1, rate_limited: 1 } ? code : undefined);
};

async function context(admin: Admin, id: string): Promise<Context | { error: string }> {
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

export async function choiceState(): Promise<ChoiceResult<ChoiceState>> {
  const w = await who();
  if ("error" in w) return { ok: false, error: w.error };
  const ctx = await context(w.admin, w.id);
  if ("error" in ctx) return { ok: false, error: ctx.error };
  const [landed, hist] = await Promise.all([
    w.admin.rpc("choice_land", { p_player: w.id }),
    w.admin.rpc("choice_history", { p_player: w.id }),
  ]);
  if (landed.error || hist.error) return { ok: false, error: choiceError(undefined) };
  const h = hist.data as { integrity: number | null; log: Parameters<typeof entry>[0][] };
  const o = ctx.open ? card(ctx.open.card) : undefined;
  return {
    ok: true,
    data: {
      integrity: h.integrity,
      open: o && ctx.open ? cardView(o, ctx.open.log, ctx.open.place) : null,
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
    return { ok: true, data: o ? cardView(o, ctx.open.log, ctx.open.place) : null };
  }
  if (!mayOffer({ shownToday: ctx.shownToday, lastShownAt: ctx.lastShownAt, open: false, now: new Date() }) || rng() >= CHOICES.chance) {
    return { ok: true, data: null };
  }
  const place = ctx.atPlace ? placeById(ctx.atPlace) : undefined;
  const pick = pickCard(CHOICE_CARDS, {
    place: place?.id ?? null, tags: place?.tags ?? [], after, integrity: ctx.integrity, rank: ctx.rank,
    student: ctx.student, business: ctx.business, roommate: !!ECONOMY.homes.find((x) => x.id === ctx.home)?.roommate, history: ctx.history, today: ctx.today,
  }, rng);
  if (!pick) return { ok: true, data: null };
  const { data, error } = await w.admin.rpc("choice_open", { p_player: w.id, p_card: pick.id, p_base: pick.base, p_area: pick.area, p_place: place?.id ?? null });
  if (error) {
    if (/already_open|enough_today/.test(error.message)) return { ok: true, data: null };
    return { ok: false, error: err(error) };
  }
  return { ok: true, data: cardView(pick, data as number, place?.id ?? null) };
}

export async function choiceChoose(log: number, option: string): Promise<ChoiceResult<ChoiceMade>> {
  const w = await who();
  if ("error" in w) return { ok: false, error: w.error };
  const ctx = await context(w.admin, w.id);
  if ("error" in ctx) return { ok: false, error: ctx.error };
  if (!ctx.open || ctx.open.log !== log) return { ok: false, error: choiceError("not_open") };
  const c = card(ctx.open.card);
  if (!c || !c.options.some((o) => o.id === option)) return { ok: false, error: choiceError("unknown_option") };
  const r = resolveChoice(c, option, ctx.today, rng);
  const effects = boundEffects(r.effects, ctx.bank);
  const { data, error } = await w.admin.rpc("choice_settle", {
    p_player: w.id, p_log: log, p_option: option, p_outcome: r.outcome, p_receipt: r.text,
    p_effects: Object.fromEntries(Object.entries(effects).filter(([, v]) => v)),
    p_later: r.later ? { due: r.later.due, emoji: r.later.emoji, text: r.later.text, effects: boundEffects(r.later.effects, Number.MAX_SAFE_INTEGER) } : null,
  });
  if (error) {
    console.error("choice_settle failed", error);
    return { ok: false, error: err(error) };
  }
  const d = data as { integrity: number; first: boolean; applied: ChoiceEffects };
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
