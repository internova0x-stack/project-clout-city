// Moral Choices (owner, Oct 29: "the central theme of the game"; spec section 29). Situation cards appear where the
// player is: a one-line situation and 2 to 4 choices, each previewing what you get, what it costs and the risk. The
// city keeps score on a private two-ended meter, 😇 Halo ↔ 💸 Hustler (owner, Oct 30: "Integrity" steered everyone to
// the good choice; neither end is losing, and each pays off its own way). Code and database still say `integrity`
// (0 = full Hustler, 100 = full Halo, starts at 50 in the middle), the way crew is still `clique`. Some choices come
// back days later.
//
// Pure rules, no imports beyond types, so the server (app/home/choiceActions.ts, crypto random source), the preview's
// in-memory city (lib/choicesSim.ts) and the tests share them. The card files (content/choices/*.json) hold the hidden
// outcomes and their odds, so only the server and the preview import lib/choicesContent.ts: players get `cardView`.

export type ChoiceArea = "life" | "gigs" | "work" | "school" | "business" | "home" | "nightlife" | "transit" | "dating" | "money";
export type Risk = "low" | "medium" | "high";
/** What a player was just doing, so a card can feel like it happened because of it. */
/** "travel" is a subway ride, "ride" a cab or rideshare. */
export type ChoiceAfter = "arrive" | "shift" | "gig" | "eat" | "visit" | "hangout" | "travel" | "ride";

export interface ChoiceEffects {
  cash?: number;
  clout?: number;
  mood?: number;
  energy?: number;
  /** The rep meter: positive moves toward 😇 Halo, negative toward 💸 Hustler (same rate both ways). */
  integrity?: number;
}

/** A consequence that lands later, naming the earlier choice in its text. */
export interface ChoiceLater {
  /** New York days from the choice: the first and last day it may land. */
  afterDays: [number, number];
  /** How likely it is to happen at all (0 to 1). */
  chance: number;
  emoji?: string;
  text: string;
  effects: ChoiceEffects;
}

export interface ChoiceOutcome {
  /** Relative weight among the option's outcomes. */
  weight: number;
  /** The receipt: one or two lines saying what happened and why. */
  text: string;
  effects: ChoiceEffects;
  later?: ChoiceLater;
}

export interface ChoiceOption {
  id: string;
  label: string;
  /** The preview: "You get", "It costs", and the risk with one short reason. */
  get: string;
  cost: string;
  risk: Risk;
  riskWhy: string;
  /** Shows "this may come back later". Required when any outcome has a `later`. */
  comesBack?: boolean;
  outcomes: ChoiceOutcome[];
}

export interface ChoiceCard {
  /** Unique per variant, e.g. "found-wallet-subway". */
  id: string;
  /** The base dilemma it's a variant of, e.g. "found-wallet" (a cooldown keeps one base to once a week). */
  base: string;
  area: ChoiceArea;
  emoji: string;
  /** The one-line situation, readable in under five seconds. */
  title: string;
  /** A regular in content/culture/npcs.json who is part of the scene. */
  who?: string;
  where: { places?: string[]; tags?: string[]; after?: ChoiceAfter[] };
  /** `roommate`: the player shares a home with one (C3), for cards about them. */
  needs?: { integrityMin?: number; integrityMax?: number; rank?: number; student?: boolean; business?: boolean; roommate?: boolean };
  options: ChoiceOption[];
}

/** What the browser sees of a card: never an outcome, a weight or what comes back. */
export interface ChoiceCardView {
  log: number;
  id: string;
  area: ChoiceArea;
  emoji: string;
  title: string;
  who: string | null;
  place: string | null;
  options: { id: string; label: string; get: string; cost: string; risk: Risk; riskWhy: string; comesBack: boolean }[];
}

export const CHOICES = {
  /** The middle: nobody starts as a Halo or a Hustler. */
  integrityStart: 50,
  /** The two ends regulars react to and offers look for: Halo from 70, Hustler at 30 or below. */
  high: 70,
  low: 30,
  /** What each end pays: Halos get more clout from choices that move them toward Halo, Hustlers more cash from the others. */
  haloClout: 1.25,
  hustlerCash: 1.25,
  /**
   * Each end is lucky at its own game (owner, Oct 30, "option 2"): a Hustler's angles come back to bite half as often and
   * a Halo's 1.5 times as often; a Halo's good deeds come back as a reward 1.5 times as often and a Hustler's half as often.
   */
  ownGame: 1.5,
  offGame: 0.5,
  /** At most this many cards a New York day (spec 3.2: 1 to 2). */
  perDay: 2,
  /** A variant never comes back within 30 days; its base dilemma not within 7. */
  cooldownDays: 30,
  baseCooldownDays: 7,
  /** Not two in a row: at least this long between cards. */
  gapMinutes: 90,
  /** The chance a card turns up when one is allowed. */
  chance: 0.4,
  /** Effects are capped so no card can swing the economy (checked by validateCards and again by the database). */
  caps: { cash: 1500, clout: 150, mood: 30, energy: 40, integrity: 20 },
} as const;

export interface ChoiceContext {
  place: string | null;
  tags: string[];
  after: ChoiceAfter;
  integrity: number;
  rank: number;
  student: boolean;
  business: boolean;
  roommate: boolean;
  /** Every card shown in the last 30 days: variant, base and the New York day. */
  history: { id: string; base: string; day: string }[];
  today: string;
}

export type Rng = () => number;

const dayNum = (d: string) => Math.floor(Date.parse(`${d}T12:00:00Z`) / 86_400_000);
export const daysBetween = (a: string, b: string) => dayNum(b) - dayNum(a);
export function addDays(d: string, n: number): string {
  return new Date((dayNum(d) + n) * 86_400_000).toISOString().slice(0, 10);
}

/** The meter after a change, the same rate both ways, always 0 (full Hustler) to 100 (full Halo). */
export function applyIntegrity(now: number, delta: number | undefined): number {
  if (!delta) return now;
  return Math.max(0, Math.min(100, now + delta));
}

/** "high" is the Halo end, "low" the Hustler end. */
export type IntegrityBand = "high" | "middle" | "low";
export const integrityBand = (n: number): IntegrityBand => (n >= CHOICES.high ? "high" : n <= CHOICES.low ? "low" : "middle");

/** Where you stand, in a few words; neither end is the bad one. */
export function integrityWord(n: number): string {
  if (n >= 85) return "Certified Halo";
  if (n >= CHOICES.high) return "Halo";
  if (n >= 56) return "Leaning Halo";
  if (n > 44) return "Right down the middle";
  if (n > CHOICES.low) return "Leaning Hustler";
  if (n > 15) return "Hustler";
  return "Certified Hustler";
}

/** Each end's payoff: a Halo's Halo-ward choices pay more clout, a Hustler's Hustler-ward choices more cash. */
export function repBonus(e: ChoiceEffects, now: number): ChoiceEffects {
  const band = integrityBand(now);
  if (band === "high" && (e.integrity ?? 0) > 0 && (e.clout ?? 0) > 0) return { ...e, clout: Math.round(e.clout! * CHOICES.haloClout) };
  if (band === "low" && (e.integrity ?? 0) < 0 && (e.cash ?? 0) > 0) return { ...e, cash: Math.round(e.cash! * CHOICES.hustlerCash) };
  return e;
}

/** Whether a card fits here and now, and how well (0: no). A named place beats a tag, a tag beats anywhere. */
export function fit(card: ChoiceCard, ctx: ChoiceContext): number {
  const n = card.needs ?? {};
  if (n.integrityMin !== undefined && ctx.integrity < n.integrityMin) return 0;
  if (n.integrityMax !== undefined && ctx.integrity > n.integrityMax) return 0;
  if (n.rank !== undefined && ctx.rank < n.rank) return 0;
  if (n.student && !ctx.student) return 0;
  if (n.business && !ctx.business) return 0;
  if (n.roommate && !ctx.roommate) return 0;
  const w = card.where;
  if (w.after && !w.after.includes(ctx.after)) return 0;
  let score = 1;
  if (w.places || w.tags) {
    const atPlace = !!ctx.place && !!w.places?.includes(ctx.place);
    const tagged = !!w.tags?.some((t) => ctx.tags.includes(t));
    if (!atPlace && !tagged) return 0;
    score = atPlace ? 4 : 2;
  }
  for (const h of ctx.history) {
    if (h.id === card.id && daysBetween(h.day, ctx.today) < CHOICES.cooldownDays) return 0;
    if (h.base === card.base && daysBetween(h.day, ctx.today) < CHOICES.baseCooldownDays) return 0;
  }
  return score;
}

/** One card for this moment, weighted by how well it fits, or null. */
export function pickCard(cards: readonly ChoiceCard[], ctx: ChoiceContext, rng: Rng): ChoiceCard | null {
  const pool = cards.map((c) => ({ c, w: fit(c, ctx) })).filter((x) => x.w > 0);
  const total = pool.reduce((s, x) => s + x.w, 0);
  if (!total) return null;
  let r = rng() * total;
  for (const x of pool) if ((r -= x.w) < 0) return x.c;
  return pool[pool.length - 1].c;
}

/** Whether a card may turn up now: the day's limit, the gap since the last one, and nothing already waiting. */
export function mayOffer(o: { shownToday: number; lastShownAt: string | null; open: boolean; now: Date }): boolean {
  if (o.open || o.shownToday >= CHOICES.perDay) return false;
  if (o.lastShownAt && o.now.getTime() - Date.parse(o.lastShownAt) < CHOICES.gapMinutes * 60_000) return false;
  return true;
}

export function cardView(card: ChoiceCard, log: number, place: string | null): ChoiceCardView {
  return {
    log, id: card.id, area: card.area, emoji: card.emoji, title: card.title, who: card.who ?? null, place,
    options: card.options.map((o) => ({
      id: o.id, label: o.label, get: o.get, cost: o.cost, risk: o.risk, riskWhy: o.riskWhy, comesBack: !!o.comesBack || o.outcomes.some((x) => x.later),
    })),
  };
}

export interface ChoiceResolution {
  option: ChoiceOption;
  outcome: number;
  text: string;
  effects: ChoiceEffects;
  /** A consequence that will land, already rolled: the day and what it does. */
  later: { due: string; emoji: string; text: string; effects: ChoiceEffects } | null;
}

/** Whether a later consequence helps (+1) or hurts (−1) the player: cash, clout, mood and energy together. */
const laterSign = (e: ChoiceEffects) => Math.sign((e.cash ?? 0) / 10 + (e.clout ?? 0) + (e.mood ?? 0) + (e.energy ?? 0));

/**
 * How much more (or less) likely an outcome's consequence is for this player: each end is lucky at its own game. An
 * option moving toward Hustler that can come back to bite is half as likely to for a Hustler and 1.5× for a Halo; one
 * moving toward Halo that can come back as a reward is 1.5× for a Halo and half for a Hustler. The middle plays the card's odds.
 */
export function laterOdds(out: ChoiceOutcome, integrity: number): number {
  const band = integrityBand(integrity);
  if (!out.later || band === "middle") return 1;
  const toward = Math.sign(out.effects.integrity ?? 0); // +1 toward Halo, −1 toward Hustler
  const sign = laterSign(out.later.effects);
  if (!toward || !sign) return 1;
  // A Hustler's angle that bites, or a Halo's good deed that pays: the player's own game.
  const own = (band === "low" && toward < 0 && sign < 0) || (band === "high" && toward > 0 && sign > 0);
  const off = (band === "high" && toward < 0 && sign < 0) || (band === "low" && toward > 0 && sign > 0);
  if (own) return toward < 0 ? CHOICES.offGame : CHOICES.ownGame; // own game: angles bite less, good deeds pay more
  if (off) return toward < 0 ? CHOICES.ownGame : CHOICES.offGame; // off game: a Halo's slip bites more, a Hustler's good deed pays less
  return 1;
}

/**
 * Rolls the chosen option's outcome (and whether its consequence comes back) with the injected random source. `integrity`
 * (the player's place on the meter) tilts the odds of what comes back (laterOdds), both which outcome and whether it lands.
 */
export function resolveChoice(card: ChoiceCard, optionId: string, today: string, rng: Rng, integrity: number = CHOICES.integrityStart): ChoiceResolution {
  const option = card.options.find((o) => o.id === optionId);
  if (!option) throw new Error("unknown_option");
  const weights = option.outcomes.map((o) => o.weight * laterOdds(o, integrity));
  const total = weights.reduce((s, w) => s + w, 0);
  let r = rng() * total;
  let i = 0;
  for (; i < option.outcomes.length - 1; i++) if ((r -= weights[i]) < 0) break;
  const out = option.outcomes[i];
  let later: ChoiceResolution["later"] = null;
  if (out.later && rng() < Math.min(1, out.later.chance * laterOdds(out, integrity))) {
    const [a, b] = out.later.afterDays;
    later = { due: addDays(today, a + Math.floor(rng() * (b - a + 1))), emoji: out.later.emoji ?? card.emoji, text: out.later.text, effects: out.later.effects };
  }
  return { option, outcome: i, text: out.text, effects: out.effects, later };
}

/** Caps a set of effects to what the database will accept, and never takes more cash than the bank holds. */
export function boundEffects(e: ChoiceEffects, bank: number): ChoiceEffects {
  const cap = (v: number | undefined, m: number) => (v === undefined ? undefined : Math.max(-m, Math.min(m, Math.round(v))));
  const c = CHOICES.caps;
  const cash = cap(e.cash, c.cash);
  return {
    cash: cash !== undefined && cash < 0 ? Math.max(cash, -Math.max(0, bank)) : cash,
    clout: cap(e.clout, c.clout), mood: cap(e.mood, c.mood), energy: cap(e.energy, c.energy), integrity: cap(e.integrity, c.integrity),
  };
}

/** The receipt's line of numbers: "+C$300 · 💸 +6 Hustler · +5 Mood". */
export function effectLine(e: ChoiceEffects): string {
  const parts: string[] = [];
  const sign = (n: number) => (n > 0 ? "+" : "−");
  if (e.cash) parts.push(`${sign(e.cash)}C$${Math.abs(e.cash).toLocaleString("en-US")}`);
  if (e.clout) parts.push(`${sign(e.clout)}${Math.abs(e.clout)} 🔥`);
  if (e.integrity) parts.push(e.integrity > 0 ? `😇 +${e.integrity} Halo` : `💸 +${-e.integrity} Hustler`);
  if (e.mood) parts.push(`${sign(e.mood)}${Math.abs(e.mood)} Mood`);
  if (e.energy) parts.push(`${sign(e.energy)}${Math.abs(e.energy)} Energy`);
  return parts.join(" · ");
}

// ---------------------------------------------------------------------------
// What the client works with (server actions or the preview's memory)
// ---------------------------------------------------------------------------

export interface ChoiceLogEntry {
  id: number;
  day: string;
  emoji: string;
  title: string;
  choice: string;
  receipt: string;
  effects: ChoiceEffects;
  /** A consequence of an earlier choice landing: names that choice. */
  cameBack?: boolean;
}

export interface ChoiceState {
  /** null until the first choice: the meter appears then (spec 2, gradual reveal). */
  integrity: number | null;
  /** A card waiting for an answer today, if any. */
  open: ChoiceCardView | null;
  /** Consequences that landed since the player last looked (each is shown once, then lives in the log). */
  landed: ChoiceLogEntry[];
  log: ChoiceLogEntry[];
}

export interface ChoiceMade {
  receipt: string;
  effects: ChoiceEffects;
  integrity: number;
  /** True on the player's very first choice: the Halo ↔ Hustler reveal. */
  first: boolean;
}

export type ChoiceResult<T> = { ok: true; data: T } | { ok: false; error: string };

export interface ChoicesApi {
  state: () => Promise<ChoiceResult<ChoiceState>>;
  /** Asks for a card after something happened (arriving somewhere, a shift, a gig); the server decides. */
  offer: (after: ChoiceAfter) => Promise<ChoiceResult<ChoiceCardView | null>>;
  choose: (log: number, option: string) => Promise<ChoiceResult<ChoiceMade>>;
  /** Not now: the card goes away for today and counts as shown. */
  skip: (log: number) => Promise<ChoiceResult<null>>;
  seen: (ids: number[]) => Promise<ChoiceResult<null>>;
}

export const CHOICE_ERRORS: Record<string, string> = {
  not_open: "That moment has passed.",
  unknown_option: "That choice isn't on the card.",
  rate_limited: "Slow down. Big decisions deserve a breath.",
  unknown: "Something went wrong. Try again in a moment.",
};
export const choiceError = (code: string | undefined) => CHOICE_ERRORS[code ?? ""] ?? CHOICE_ERRORS.unknown;

// ---------------------------------------------------------------------------
// Checking the card files (tests and validate:content)
// ---------------------------------------------------------------------------

const AREAS: ChoiceArea[] = ["life", "gigs", "work", "school", "business", "home", "nightlife", "transit", "dating", "money"];
const AFTERS: ChoiceAfter[] = ["arrive", "shift", "gig", "eat", "visit", "hangout", "travel", "ride"];

function checkEffects(e: ChoiceEffects, where: string, out: string[]) {
  for (const [k, v] of Object.entries(e)) {
    const cap = (CHOICES.caps as Record<string, number>)[k];
    if (cap === undefined) out.push(`${where}: unknown effect "${k}"`);
    else if (typeof v !== "number" || !Number.isInteger(v) || Math.abs(v) > cap) out.push(`${where}: ${k} must be a whole number within ±${cap}`);
  }
}

/** Every rule a card file must meet. Returns the problems (empty: all good). */
export function validateCards(cards: readonly ChoiceCard[], known: { places: string[]; tags: string[]; npcs: string[] }): string[] {
  const out: string[] = [];
  const ids = new Set<string>();
  const bases = new Map<string, number>();
  for (const c of cards) {
    const at = `card ${c.id}`;
    if (!/^[a-z0-9-]+$/.test(c.id ?? "")) out.push(`${at}: id must be lowercase-with-dashes`);
    if (ids.has(c.id)) out.push(`${at}: repeated id`);
    ids.add(c.id);
    if (!/^[a-z0-9-]+$/.test(c.base ?? "")) out.push(`${at}: base must be lowercase-with-dashes`);
    bases.set(c.base, (bases.get(c.base) ?? 0) + 1);
    if (!AREAS.includes(c.area)) out.push(`${at}: unknown area "${c.area}"`);
    if (!c.emoji) out.push(`${at}: needs an emoji`);
    if (!c.title || c.title.length > 110) out.push(`${at}: title must be 1 to 110 characters`);
    if (c.who && !known.npcs.includes(c.who)) out.push(`${at}: unknown regular "${c.who}"`);
    for (const p of c.where?.places ?? []) if (!known.places.includes(p)) out.push(`${at}: unknown place "${p}"`);
    for (const t of c.where?.tags ?? []) if (!known.tags.includes(t)) out.push(`${at}: unknown tag "${t}"`);
    for (const a of c.where?.after ?? []) if (!AFTERS.includes(a)) out.push(`${at}: unknown after "${a}"`);
    if (!Array.isArray(c.options) || c.options.length < 2 || c.options.length > 4) { out.push(`${at}: needs 2 to 4 options`); continue; }
    const optIds = new Set<string>();
    let sawLoss = false;
    let sawGain = false;
    for (const o of c.options) {
      const ot = `${at} option ${o.id}`;
      if (!o.id || optIds.has(o.id)) out.push(`${ot}: missing or repeated id`);
      optIds.add(o.id);
      if (!o.label || o.label.length > 40) out.push(`${ot}: label must be 1 to 40 characters`);
      if (!o.get || o.get.length > 60) out.push(`${ot}: "get" must be 1 to 60 characters`);
      if (!o.cost || o.cost.length > 60) out.push(`${ot}: "cost" must be 1 to 60 characters`);
      if (!["low", "medium", "high"].includes(o.risk)) out.push(`${ot}: risk must be low, medium or high`);
      if (!o.riskWhy || o.riskWhy.length > 60) out.push(`${ot}: riskWhy must be 1 to 60 characters`);
      if (!Array.isArray(o.outcomes) || !o.outcomes.length) { out.push(`${ot}: needs at least one outcome`); continue; }
      const laterAny = o.outcomes.some((x) => x.later);
      if (laterAny && !o.comesBack) out.push(`${ot}: an outcome comes back later, so mark comesBack`);
      o.outcomes.forEach((x, i) => {
        const xt = `${ot} outcome ${i + 1}`;
        if (!(x.weight > 0)) out.push(`${xt}: weight must be above 0`);
        if (!x.text || x.text.length > 240) out.push(`${xt}: text must be 1 to 240 characters`);
        checkEffects(x.effects ?? {}, xt, out);
        if ((x.effects?.integrity ?? 0) < 0) sawLoss = true;
        if ((x.effects?.integrity ?? 0) > 0) sawGain = true;
        if (x.later) {
          const l = x.later;
          if (!Array.isArray(l.afterDays) || l.afterDays.length !== 2 || l.afterDays[0] < 1 || l.afterDays[1] < l.afterDays[0] || l.afterDays[1] > 14) {
            out.push(`${xt}: later.afterDays must be [first, last] within 1 to 14 days`);
          }
          if (!(l.chance > 0 && l.chance <= 1)) out.push(`${xt}: later.chance must be above 0 and at most 1`);
          if (!l.text || l.text.length > 240) out.push(`${xt}: later.text must be 1 to 240 characters`);
          checkEffects(l.effects ?? {}, `${xt} later`, out);
        }
      });
    }
    // Spec 3.4: a real tradeoff. Some option must move toward Hustler and some must not.
    if (!sawLoss) out.push(`${at}: no option moves toward Hustler, so there's no dilemma`);
    if (!sawGain && c.options.every((o) => o.outcomes.every((x) => (x.effects?.integrity ?? 0) < 0))) out.push(`${at}: every option moves toward Hustler`);
    // Owner, Oct 30: cards say what a choice really costs, never judge it ("costs Integrity").
    const words = JSON.stringify([c.title, c.options.map((o) => [o.label, o.get, o.cost, o.riskWhy, o.outcomes.map((x) => [x.text, x.later?.text])])]);
    if (/integrity|\bhalo\b|\bhustler\b/i.test(words)) out.push(`${at}: name the real cost, not the meter (no "Integrity", "Halo" or "Hustler" in the text)`);
  }
  return out;
}
