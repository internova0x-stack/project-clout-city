// Moral Choices in the preview (/preview/home?choice=...): the same rules as the server, in memory, with the real
// cards. Presets: now (every arrival, shift or gig brings a card, no daily limit), back (a consequence of an earlier
// choice has just landed), high and low (start at the Halo or the Hustler end, with a record), log (a few choices already made), jail (in
// holding at the 114½ Precinct), chain (a chain's follow-up card waiting).
// Consequences land 20 seconds after the choice instead of days later, so the whole loop fits in a minute.

import {
  CHOICES, applyIntegrity, bailCost, boundEffects, cardView, repBonus, mayOffer, pickCard, resolveChoice,
  type BlotterItem, type ChoiceAfter, type ChoiceMark, type ChoiceCard, type ChoiceEffects, type ChoiceLogEntry, type ChoicesApi, type ChoiceState,
} from "./choices";
import { CHOICE_CARDS as BASE_CARDS } from "./choicesContent";
import WEEK_SAMPLE from "../content/storylets/2026-11-02.json";
import CONDITION_SAMPLE from "../content/conditions/2026-11-02.json";
import type { ConditionNow } from "./cityConditions";
import type { Fact, FactKey, Memory } from "./memory";

// The preview plays the first weekly storylets (Content Engine step 3) as if they'd gone live.
const CHOICE_CARDS: ChoiceCard[] = [...BASE_CARDS, ...(WEEK_SAMPLE.cards as ChoiceCard[])];
import { EMPTY_MEMORY } from "./storylets";

export type ChoicePreset = "now" | "back" | "high" | "low" | "log" | "jail" | "chain" | "story";

/**
 * ?choice=story: a player with a history across the game (a Media job, a partner, a coworker they took credit from, a
 * club that banned them, a lotto win…), so storylets (Content Engine step 2) turn up, and every arrival brings one.
 */
export function storyMemory(): Memory {
  const now = new Date().toISOString();
  const f = (key: FactKey, subject = "", count = 1): Fact => ({ key, subject, value: {}, count, first: now, last: now, expires: null });
  return {
    snapshot: { ...EMPTY_MEMORY.snapshot, rank: 3, band: "hustler", meter: 24, job: { track: "media", level: 2, workMood: 55 }, partner: "preview-partner", crew: 2, businesses: ["hot-dog-cart"], campus: "st-johnsons" },
    facts: [
      f("career.hired", "media"), f("career.promoted", "media"), f("career.took_credit", "media:rival"), f("career.started_rumor", "media:rival"),
      f("dating.official", "preview-partner"), f("dating.date"), f("place.banned", "the-sticky-floor"), f("police.held"),
      f("gossip.found", "a", 6), f("story.predicted"), f("choice.made", "fake-hype:post"), f("choice.made", "found-wallet:keep"),
      f("money.lotto_win"), f("home.sublet_host"), f("campus.aced", "clout-theory"), f("business.bought", "hot-dog-cart"),
      f("career.helped", "media:friend"), f("nightlife.party", "first-party"), f("transit.showtime"), f("skill.level_up", "dance"), f("hunt.finished"),
    ],
  };
}

/** The sample week's conditions re-timed around now, and an HR crackdown that players set off. */
function previewConditions(): ConditionNow[] {
  const h = (n: number) => new Date(Date.now() + n * 3_600_000).toISOString();
  const [heat, fair, brown] = CONDITION_SAMPLE.conditions;
  const row = (c: typeof heat, from: number, to: number, now: boolean): ConditionNow =>
    ({ id: c.id, kind: c.kind, subject: "", emoji: c.emoji, title: c.title, blurb: c.blurb, startsAt: h(from), endsAt: h(to), now, source: "weekly" });
  return [
    row(heat, -5, 30, true), row(brown, -1, 4, true), row(fair, 20, 54, false),
    { id: "hr-crackdown-tech-preview", kind: "hr_crackdown", subject: "tech", emoji: "📋", title: "HR crackdown at Pivotly",
      blurb: "Too much credit-taking at Pivotly. HR is reading the Slack. Office sabotage there gets traced twice as often this week.",
      startsAt: h(-20), endsAt: h(148), now: true, source: "reaction" },
  ];
}

interface Opts {
  /** Where the preview's player is standing now. */
  where: () => { place: string | null; tags: string[] };
  /** Pays the preview city (cash, clout, mood, energy). */
  onEffects?: (e: ChoiceEffects) => void;
  today: () => string;
}

export function createChoicesSim(preset: string | null, opts: Opts): ChoicesApi {
  const rng = Math.random;
  const story = preset === "story";
  const always = preset === "now" || story;
  // ?choice=city (and story): the first week's city conditions as if they were on (a heatwave and a brownout now, the
  // street fair tomorrow) and a city storylet that fired, plus wins in the Blotter (Content Engine step 4).
  const city = preset === "city" || story;
  const conditions: ConditionNow[] = city ? previewConditions() : [];
  // The player's memory (migration 0138): storylets read it and their choices write to it.
  const memory: Memory = story ? storyMemory() : structuredClone(EMPTY_MEMORY);
  memory.snapshot.conditions = [...new Set(conditions.filter((c) => c.now).map((c) => c.kind))];
  const remember = (sets: { fact: FactKey; subject: string }[]) => {
    const now = new Date().toISOString();
    for (const x of sets) {
      const have = memory.facts.find((f) => f.key === x.fact && f.subject === x.subject);
      if (have) { have.count += 1; have.last = now; } else memory.facts.unshift({ key: x.fact, subject: x.subject, value: {}, count: 1, first: now, last: now, expires: null });
    }
  };
  // In ?choice=story, offer storylets first (the cards that read memory).
  const pool = () => (story ? CHOICE_CARDS.filter((c) => c.when) : CHOICE_CARDS);
  let integrity: number = preset === "low" ? 18 : preset === "high" ? 86 : CHOICES.integrityStart;
  let revealed = !!preset && preset !== "now";
  let open: { log: number; card: ChoiceCard; place: string | null; intro?: string } | null = null;
  // Migration 0132's stakes in memory: lasting effects, chain cards waiting, Lola's Blotter.
  const marks: ChoiceMark[] = [];
  const chains: { at: number; card: string; intro: string }[] = [];
  const blotter: BlotterItem[] = city ? [
    { id: -1, kind: "city", at: new Date().toISOString(), text: "📋 Triborough Works HR has sent a company-wide email titled 'Let's Talk About Credit.' It is 3,000 words long. Sabotage at Pivotly gets traced twice as often this week." },
    { id: -2, kind: "win", at: new Date().toISOString(), text: "🏆 @marisol.q just managed a campaign all the way to City Hall. Staffers are already asking for selfies." },
    { id: -3, kind: "win", at: new Date().toISOString(), text: "🔔 @dev_from_ditmars took a business public. The bell was rung. The bell was a cowbell." },
  ] : [];
  const mark = (e: ChoiceEffects, place: string | null) => {
    const now = Date.now();
    if (e.ban) marks.push({ kind: "ban", place: e.ban.place === "here" ? place : e.ban.place, until: new Date(now + e.ban.days * 86_400_000).toISOString() });
    if (e.gigLock) marks.push({ kind: "gig_lock", place: null, until: new Date(now + e.gigLock * 86_400_000).toISOString() });
    if (e.holding) marks.push({ kind: "holding", place: "precinct-114-half", until: new Date(now + e.holding * 3_600_000).toISOString() });
  };
  const live = () => marks.filter((m) => Date.parse(m.until) > Date.now());
  let nextId = 1;
  const log: ChoiceLogEntry[] = [];
  const landed: ChoiceLogEntry[] = [];
  const history: { id: string; base: string; day: string }[] = [];
  const shown: { day: string; at: number }[] = [];
  const pending: { at: number; entry: ChoiceLogEntry; effects: ChoiceEffects; headline?: string }[] = [];

  const settle = (c: ChoiceCard, option: string, day: string, past = false, place: string | null = null) => {
    const r = resolveChoice(c, option, day, rng, integrity, memory);
    remember(r.sets);
    const e = boundEffects(repBonus(r.effects, integrity), Number.MAX_SAFE_INTEGER);
    const before = integrity;
    integrity = applyIntegrity(integrity, e.integrity);
    const applied = { ...e, integrity: integrity - before || undefined };
    if (!past) { opts.onEffects?.(applied); mark(applied, place); }
    const id = nextId++;
    log.unshift({ id, day, emoji: c.emoji, title: c.title, choice: r.option.label, receipt: r.text, effects: applied });
    history.push({ id: c.id, base: c.base, day });
    if (r.later?.card) {
      chains.push({ at: past ? 0 : Date.now() + 20_000, card: r.later.card, intro: r.later.text });
      if (r.later.headline) blotter.unshift({ id: nextId++, text: r.later.headline.replace("{name}", "@you"), at: new Date().toISOString() });
    } else if (r.later) {
      const entry = { id: -id, day, emoji: r.later.emoji, title: c.title, choice: r.option.label, receipt: r.later.text, effects: r.later.effects, cameBack: true };
      pending.push({ at: past ? 0 : Date.now() + 20_000, entry, effects: r.later.effects, headline: r.later.headline });
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
    const card = pickCard(pool(), { ...w, after: "arrive", integrity, rank: 3, student: true, business: true, roommate: true, history: [], today: opts.today(), memory }, rng)
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
      mark(applied, opts.where().place);
      if (p.headline) blotter.unshift({ id: nextId++, text: p.headline.replace("{name}", "@you"), at: new Date().toISOString() });
      const entry = { ...p.entry, effects: applied };
      log.unshift(entry);
      landed.push(entry);
    }
  };

  // ?choice=jail starts in holding; ?choice=chain has a chain's follow-up waiting.
  if (preset === "jail") {
    marks.push({ kind: "holding", place: "precinct-114-half", until: new Date(Date.now() + 2 * 3_600_000 - 60_000).toISOString() });
    // A headline for News → City's Lola's Blotter, as if this stay had made the news.
    const l = CHOICE_CARDS.flatMap((c) => c.options.flatMap((o) => o.outcomes.map((x) => x.later))).find((x) => x?.headline && x.effects.holding);
    if (l?.headline) blotter.unshift({ id: nextId++, text: l.headline.replace("{name}", "@you"), at: new Date().toISOString() });
  }
  if (preset === "chain") {
    const c = CHOICE_CARDS.find((x) => x.chainOnly);
    if (c) chains.push({ at: 0, card: c.id, intro: "Remember that choice you made last week? It remembers you." });
  }
  /** A chain's follow-up opens as soon as nothing else is waiting. */
  const chainCard = () => {
    const due = chains.find((x) => x.at <= Date.now());
    if (!due || open) return;
    const c = CHOICE_CARDS.find((x) => x.id === due.card);
    chains.splice(chains.indexOf(due), 1);
    if (c) open = { log: nextId++, card: c, place: opts.where().place, intro: due.intro };
  };
  const view = () => (open ? { ...cardView(open.card, open.log, open.place, memory), intro: open.intro ?? null } : null);

  const ok = <T,>(data: T) => Promise.resolve({ ok: true as const, data });

  return {
    state: () => {
      land();
      chainCard();
      const s: ChoiceState = {
        marks: live(),
        integrity: revealed ? integrity : null,
        open: view(),
        landed: [...landed],
        log: [...log],
      };
      return ok(s);
    },
    offer: (after: ChoiceAfter) => {
      land();
      chainCard();
      if (open) return ok(view());
      const today = opts.today();
      const todays = shown.filter((s) => s.day === today);
      const last = shown.length ? new Date(shown[shown.length - 1].at).toISOString() : null;
      if (!always && (!mayOffer({ shownToday: todays.length, lastShownAt: last, open: false, now: new Date(Date.now() + (CHOICES.gapMinutes - 2) * 60_000) }) || rng() >= CHOICES.chance)) {
        return ok(null);
      }
      const where = opts.where();
      const card = pickCard(pool(), {
        memory,
        ...where, after, integrity, rank: 3, student: true, business: true, roommate: true, history: always ? [] : history, today,
      }, rng);
      if (!card) return ok(null);
      open = { log: nextId++, card, place: where.place };
      shown.push({ day: today, at: Date.now() });
      return ok(cardView(card, open.log, open.place, memory));
    },
    choose: (logId: number, option: string) => {
      if (!open || open.log !== logId) return Promise.resolve({ ok: false as const, error: "That moment has passed." });
      const c = open.card;
      const place = open.place;
      open = null;
      const first = !revealed;
      revealed = true;
      const r = settle(c, option, opts.today(), false, place);
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
    bail: () => {
      const h = live().find((m) => m.kind === "holding");
      if (!h) return Promise.resolve({ ok: false as const, error: "You're already free to go. Sgt. Bev waves." });
      const cost = bailCost(h.until);
      opts.onEffects?.({ cash: -cost });
      h.until = new Date().toISOString();
      return ok({ cost });
    },
    blotter: () => ok([...blotter]),
    conditions: () => ok(conditions),
  };
}
