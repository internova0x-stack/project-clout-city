// Moral Choices in the preview (/preview/home?choice=...): the same rules as the server, in memory, with the real
// cards. Presets: now (every arrival, shift or gig brings a card, no daily limit), back (a consequence of an earlier
// choice has just landed), high and low (start at the Halo or the Hustler end, with a record), log (a few choices already made).
// Consequences land 20 seconds after the choice instead of days later, so the whole loop fits in a minute.

import {
  CHOICES, applyIntegrity, boundEffects, cardView, repBonus, mayOffer, pickCard, resolveChoice,
  type ChoiceAfter, type ChoiceCard, type ChoiceEffects, type ChoiceLogEntry, type ChoicesApi, type ChoiceState,
} from "./choices";
import { CHOICE_CARDS } from "./choicesContent";

export type ChoicePreset = "now" | "back" | "high" | "low" | "log";

interface Opts {
  /** Where the preview's player is standing now. */
  where: () => { place: string | null; tags: string[] };
  /** Pays the preview city (cash, clout, mood, energy). */
  onEffects?: (e: ChoiceEffects) => void;
  today: () => string;
}

export function createChoicesSim(preset: string | null, opts: Opts): ChoicesApi {
  const rng = Math.random;
  const always = preset === "now";
  let integrity: number = preset === "low" ? 18 : preset === "high" ? 86 : CHOICES.integrityStart;
  let revealed = !!preset && preset !== "now";
  let open: { log: number; card: ChoiceCard; place: string | null } | null = null;
  let nextId = 1;
  const log: ChoiceLogEntry[] = [];
  const landed: ChoiceLogEntry[] = [];
  const history: { id: string; base: string; day: string }[] = [];
  const shown: { day: string; at: number }[] = [];
  const pending: { at: number; entry: ChoiceLogEntry; effects: ChoiceEffects }[] = [];

  const settle = (c: ChoiceCard, option: string, day: string, past = false) => {
    const r = resolveChoice(c, option, day, rng, integrity);
    const e = boundEffects(repBonus(r.effects, integrity), Number.MAX_SAFE_INTEGER);
    const before = integrity;
    integrity = applyIntegrity(integrity, e.integrity);
    const applied = { ...e, integrity: integrity - before || undefined };
    if (!past) opts.onEffects?.(applied);
    const id = nextId++;
    log.unshift({ id, day, emoji: c.emoji, title: c.title, choice: r.option.label, receipt: r.text, effects: applied });
    history.push({ id: c.id, base: c.base, day });
    if (r.later) {
      const entry = { id: -id, day, emoji: r.later.emoji, title: c.title, choice: r.option.label, receipt: r.later.text, effects: r.later.effects, cameBack: true };
      pending.push({ at: past ? 0 : Date.now() + 20_000, entry, effects: r.later.effects });
    }
    return { text: r.text, applied };
  };

  // Presets with a past: a few choices already made (the first option of three cards, the last of two).
  if (preset === "log" || preset === "back" || preset === "high" || preset === "low") {
    const picks = CHOICE_CARDS.filter((c) => !c.needs).slice(0, 5);
    picks.forEach((c, i) => settle(c, c.options[i % 2 ? c.options.length - 1 : 0].id, opts.today(), true));
    if (preset === "low") integrity = 18;
    if (preset === "high") integrity = 86;
  }
  // ?choice=now: a card is already waiting where the player stands.
  if (always) {
    const w = opts.where();
    const card = pickCard(CHOICE_CARDS, { ...w, after: "arrive", integrity, rank: 3, student: true, business: true, roommate: true, history: [], today: opts.today() }, rng)
      ?? pickCard(CHOICE_CARDS.filter((c) => !c.where.places && !c.where.tags), { ...w, after: "arrive", integrity, rank: 3, student: true, business: true, roommate: true, history: [], today: opts.today() }, rng);
    if (card) { open = { log: nextId++, card, place: w.place }; shown.push({ day: opts.today(), at: Date.now() }); }
  }
  if (preset === "back") {
    const c = CHOICE_CARDS.find((x) => x.options.some((o) => o.outcomes.some((y) => y.later)))!;
    const o = c.options.find((x) => x.outcomes.some((y) => y.later))!;
    const l = o.outcomes.find((y) => y.later)!.later!;
    pending.push({ at: 0, entry: { id: -999, day: opts.today(), emoji: l.emoji ?? c.emoji, title: c.title, choice: o.label, receipt: l.text, effects: l.effects, cameBack: true }, effects: l.effects });
  }

  const land = () => {
    const now = Date.now();
    for (const p of pending.filter((x) => x.at <= now)) {
      pending.splice(pending.indexOf(p), 1);
      const before = integrity;
      integrity = applyIntegrity(integrity, p.effects.integrity);
      const applied = { ...p.effects, integrity: integrity - before || undefined };
      opts.onEffects?.(applied);
      const entry = { ...p.entry, effects: applied };
      log.unshift(entry);
      landed.push(entry);
    }
  };

  const ok = <T,>(data: T) => Promise.resolve({ ok: true as const, data });

  return {
    state: () => {
      land();
      const s: ChoiceState = {
        integrity: revealed ? integrity : null,
        open: open ? cardView(open.card, open.log, open.place) : null,
        landed: [...landed],
        log: [...log],
      };
      return ok(s);
    },
    offer: (after: ChoiceAfter) => {
      land();
      if (open) return ok(cardView(open.card, open.log, open.place));
      const today = opts.today();
      const todays = shown.filter((s) => s.day === today);
      const last = shown.length ? new Date(shown[shown.length - 1].at).toISOString() : null;
      if (!always && (!mayOffer({ shownToday: todays.length, lastShownAt: last, open: false, now: new Date(Date.now() + (CHOICES.gapMinutes - 2) * 60_000) }) || rng() >= CHOICES.chance)) {
        return ok(null);
      }
      const where = opts.where();
      const card = pickCard(CHOICE_CARDS, {
        ...where, after, integrity, rank: 3, student: true, business: true, roommate: true, history: always ? [] : history, today,
      }, rng);
      if (!card) return ok(null);
      open = { log: nextId++, card, place: where.place };
      shown.push({ day: today, at: Date.now() });
      return ok(cardView(card, open.log, open.place));
    },
    choose: (logId: number, option: string) => {
      if (!open || open.log !== logId) return Promise.resolve({ ok: false as const, error: "That moment has passed." });
      const c = open.card;
      open = null;
      const first = !revealed;
      revealed = true;
      const r = settle(c, option, opts.today());
      return ok({ receipt: r.text, effects: r.applied, integrity, first });
    },
    skip: (logId: number) => {
      if (open?.log === logId) open = null;
      return ok(null);
    },
    seen: (ids: number[]) => {
      for (const id of ids) { const i = landed.findIndex((x) => x.id === id); if (i >= 0) landed.splice(i, 1); }
      return ok(null);
    },
  };
}
