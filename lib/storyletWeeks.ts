// The Content Engine, step 3: weekly storylets (docs/CONTENT-ENGINE.md sections 6 and 8; migration 0139). The weekly
// routine drafts a batch of storylet cards into content/storylets/<Monday>.json, written in families so the batch varies
// the kind of situation, not just the names. The game server stores each new card; it goes live 24 hours later unless
// the owner vetoes or pauses it in Studio → Storylets (automatic with a veto window, owner Oct 31).
//
// Pure: the validator (scripts/validate-content.ts, lib/contentImport.ts, the Studio) and the Studio's view helpers.

import { validateCards, type ChoiceCard } from "./choices.ts";
import { fillText, longestShow, type Cond, type SlotDef, type When } from "./storylets.ts";
import { FACTS } from "./memory.ts";

export const FAMILIES = ["favor", "temptation", "betrayal", "windfall", "loyalty"] as const;
export type StoryletFamily = (typeof FAMILIES)[number];

export const FAMILY_LABEL: Record<StoryletFamily, { emoji: string; title: string }> = {
  favor: { emoji: "🤝", title: "A favor" },
  temptation: { emoji: "😈", title: "A temptation" },
  betrayal: { emoji: "🗡️", title: "A betrayal" },
  windfall: { emoji: "💸", title: "A windfall" },
  loyalty: { emoji: "🫡", title: "A test of loyalty" },
};

export const STORYLET_WEEKS = {
  /** Owner, Oct 31: generated content goes live 24 hours after it arrives unless vetoed (game_settings 'storylets'). */
  windowHours: 24,
  /** About 10 a week (docs/CONTENT-ENGINE.md section 6). */
  perWeek: { min: 6, max: 14 },
  /** The batch varies the kind of situation. */
  familiesMin: 4,
} as const;

export interface StoryletWeek { week: string; cards: ChoiceCard[] }
export type StoryletStatus = "scheduled" | "paused" | "vetoed" | "live";
export type StoryletAction = "veto" | "pause" | "restore" | "now";

/** One card in Studio → Storylets (admin_storylets). */
export interface StudioStorylet {
  id: string; week: string; family: StoryletFamily; card: ChoiceCard; status: StoryletStatus;
  live_at: string; arrived_at: string; decided_at: string | null;
}
export interface StudioStorylets { window_hours: number; autopilot: boolean; cards: StudioStorylet[] }

const isMonday = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && new Date(`${d}T12:00:00Z`).getUTCDay() === 1;

/**
 * Checks a week file: a Monday, 6 to 14 cards from at least four families, each one a storylet (it reacts to memory),
 * every card passing Moral Choices' rules alongside the cards already in the game (ids unique, chains resolve).
 */
export function validateStoryletWeek(
  raw: unknown,
  ctx: { others: readonly ChoiceCard[]; known: { places: string[]; tags: string[]; npcs: string[] } },
): { ok: true; week: StoryletWeek } | { ok: false; problems: string[] } {
  const out: string[] = [];
  const w = raw as Partial<StoryletWeek> | null;
  if (!w || typeof w !== "object") return { ok: false, problems: ["the file must be an object with week and cards"] };
  if (typeof w.week !== "string" || !isMonday(w.week)) out.push("week must be a Monday (YYYY-MM-DD)");
  const cards = Array.isArray(w.cards) ? w.cards : [];
  const { min, max } = STORYLET_WEEKS.perWeek;
  if (cards.length < min || cards.length > max) out.push(`a week has ${min} to ${max} cards (this one has ${cards.length})`);
  const families = new Set<string>();
  for (const c of cards) {
    const at = `card ${c?.id ?? "?"}`;
    if (!c?.family || !(FAMILIES as readonly string[]).includes(c.family)) out.push(`${at}: family must be one of ${FAMILIES.join(", ")}`);
    else families.add(c.family);
    if (!c?.chainOnly && !c?.when?.all?.length && !c?.when?.any?.length) out.push(`${at}: a weekly storylet reacts to memory: give it "when"`);
  }
  if (cards.length && families.size < STORYLET_WEEKS.familiesMin) out.push(`use at least ${STORYLET_WEEKS.familiesMin} families (this week has ${families.size})`);
  const mine = new Set(cards.map((c) => c?.id));
  // Each card is checked with the game's own; a clash with an existing id is this week's problem.
  const problems = validateCards([...ctx.others, ...cards], ctx.known);
  for (const p of problems) {
    const id = p.match(/^card ([a-z0-9-]+)/)?.[1];
    if (!id || mine.has(id)) out.push(p);
  }
  // A week can't reuse an id already in content/choices/ (validateCards reports the repeat on the later card).
  for (const c of cards) if (ctx.others.some((o) => o.id === c.id) && !out.some((p) => p.startsWith(`card ${c.id}: repeated`))) out.push(`card ${c.id}: repeated id`);
  return out.length ? { ok: false, problems: out } : { ok: true, week: { week: w.week as string, cards } };
}

// ---- The Studio's view: sample fills and plain-language conditions ----

const SAMPLE: Record<SlotDef["show"], string> = { coworker: "Brent", place: "The Sticky Floor", employer: "Pivotly", boss: "Dana", raw: "something" };

/** A card's text with sample names filled in (the longest possible names are checked by the validator). */
export function sampleFill(text: string, slots: Record<string, SlotDef> | undefined, longest = false): string {
  const vals = Object.fromEntries(Object.entries(slots ?? {}).map(([k, s]) => [k, longest ? longestShow(s.show) : SAMPLE[s.show]]));
  return fillText(text, { name: "Kai", ...vals });
}

const factMeans = (k: string) => (FACTS as Record<string, { means: string }>)[k]?.means ?? k;
function condLine(c: Cond): string {
  if ("has" in c) {
    const bits = [factMeans(c.has)];
    if (c.minCount && c.minCount > 1) bits.push(`${c.minCount}+ times`);
    if (c.withinDays !== undefined) bits.push(`in the last ${c.withinDays} days`);
    if (c.subject) bits.push(`(${c.subject})`);
    if (c.subjectStarts) bits.push(`(${c.subjectStarts}…)`);
    return bits.join(" ");
  }
  const v = c.is !== undefined ? ` is ${String(c.is)}` : c.min !== undefined ? ` ≥ ${c.min}` : c.max !== undefined ? ` ≤ ${c.max}` : c.exists === false ? " none" : "";
  return `${c.snap}${v || " (has one)"}`;
}

/** Who sees a card, in plain words: "Needs: … · Any of: … · Not if: …". */
export function whenLines(w: When | undefined): string[] {
  if (!w) return [];
  const out: string[] = [];
  if (w.all?.length) out.push(`Needs: ${w.all.map(condLine).join("; ")}`);
  if (w.any?.length) out.push(`Any of: ${w.any.map(condLine).join("; ")}`);
  if (w.none?.length) out.push(`Not if: ${w.none.map(condLine).join("; ")}`);
  return out;
}

/** "Goes live in 17 h" / "Live" / "Vetoed" for the Studio. */
export function storyletWhen(s: Pick<StudioStorylet, "status" | "live_at">, now = Date.now()): string {
  if (s.status === "live") return "Live";
  if (s.status === "vetoed") return "Vetoed";
  if (s.status === "paused") return "Paused: waits for you";
  const h = Math.max(0, (Date.parse(s.live_at) - now) / 3_600_000);
  return h < 1 ? `Goes live in ${Math.max(1, Math.round(h * 60))} min` : `Goes live in ${Math.round(h)} h`;
}
