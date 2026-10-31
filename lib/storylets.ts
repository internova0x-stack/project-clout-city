// The Content Engine, step 2: storylets (docs/CONTENT-ENGINE.md section 5). A storylet is a Moral Choices card with
// three additions: `when` (conditions over the player's memory, migration 0138), `slots` (names filled in from that
// memory: "the coworker you crossed", "the club you're banned from") and outcomes that `sets` new facts, so stories
// branch by themselves. Cards with conditions from two or more systems (a job and a relationship, a ban and an exam) are
// the combinations nobody writes by hand: unseen, they come first.
//
// Pure, like lib/choices.ts: the server (app/home/choiceActions.ts) and the preview (lib/choicesSim.ts) run it.

import { TRACKS } from "./careers.ts";
import { PLACES } from "./city.ts";
import { FACTS, type FactKey, type Fact, type Memory, type Snapshot } from "./memory.ts";
import { CONDITION_KINDS } from "./cityConditions.ts";

/** A fact the player has (any subject unless one is given; `subjectStarts` matches a prefix, e.g. "found-wallet:"). */
export interface HasCond { has: FactKey; subject?: string; subjectStarts?: string; withinDays?: number; minCount?: number }
/** Something true about the player now (player_snapshot). */
export interface SnapCond { snap: SnapPath; is?: string | number | boolean; min?: number; max?: number; exists?: boolean }
export type Cond = HasCond | SnapCond;
export interface When { all?: Cond[]; any?: Cond[]; none?: Cond[] }

export const SNAP_PATHS = [
  "band", "meter", "rank", "clout", "bank", "home", "at", "job", "job.track", "job.level", "job.workMood",
  "businesses", "partner", "campus", "campaign", "marks", "crew", "conditions",
] as const;
export type SnapPath = (typeof SNAP_PATHS)[number];

/** How a slot reads its value from memory and how it shows it. */
export interface SlotDef {
  /** The latest fact with this key (optionally a subject prefix) gives the subject… */
  fact?: FactKey;
  subjectStarts?: string;
  /** …or the snapshot gives it. */
  snap?: SnapPath;
  /** How to show it: a coworker's name ("tech:rival" → Brent), a place's name, an employer, a boss's first name, or as is. */
  show: "coworker" | "place" | "employer" | "boss" | "raw";
}

const DAY = 86_400_000;
const daysAgo = (iso: string, today: string) => Math.floor((Date.parse(`${today}T12:00:00Z`) - Date.parse(iso)) / DAY);

function snapValue(s: Snapshot, path: SnapPath): unknown {
  if (path.startsWith("job.")) return s.job ? (s.job as Record<string, unknown>)[path.slice(4)] : null;
  return (s as unknown as Record<string, unknown>)[path];
}

function matches(f: Fact, c: HasCond, today: string): boolean {
  if (f.key !== c.has) return false;
  if (c.subject !== undefined && f.subject !== c.subject) return false;
  if (c.subjectStarts !== undefined && !f.subject.startsWith(c.subjectStarts)) return false;
  if (c.withinDays !== undefined && daysAgo(f.last, today) > c.withinDays) return false;
  return true;
}

export function condOk(c: Cond, m: Memory, today: string): boolean {
  if ("has" in c) {
    const rows = m.facts.filter((f) => matches(f, c, today));
    return rows.reduce((n, f) => n + f.count, 0) >= (c.minCount ?? 1);
  }
  const v = snapValue(m.snapshot, c.snap);
  const present = Array.isArray(v) ? v.length > 0 : v !== null && v !== undefined && v !== false && v !== "";
  if (c.exists !== undefined && present !== c.exists) return false;
  if (c.is !== undefined) {
    if (Array.isArray(v) ? !v.includes(c.is as never) : v !== c.is) return false;
  }
  if (c.min !== undefined && !(typeof v === "number" && v >= c.min) && !(Array.isArray(v) && v.length >= c.min)) return false;
  if (c.max !== undefined && !(typeof v === "number" && v <= c.max)) return false;
  return c.exists !== undefined || c.is !== undefined || c.min !== undefined || c.max !== undefined ? true : present;
}

export function whenOk(w: When | undefined, m: Memory | null, today: string): boolean {
  if (!w) return true;
  if (!m) return false;
  if (w.all && !w.all.every((c) => condOk(c, m, today))) return false;
  if (w.any && !w.any.some((c) => condOk(c, m, today))) return false;
  if (w.none && w.none.some((c) => condOk(c, m, today))) return false;
  return true;
}

/** The systems a storylet's conditions draw on (a fact's namespace; the snapshot's area): two or more is a combination. */
export function systemsOf(w: When | undefined): Set<string> {
  const out = new Set<string>();
  for (const c of [...(w?.all ?? []), ...(w?.any ?? []), ...(w?.none ?? [])]) {
    if ("has" in c) out.add(c.has.split(".")[0]);
    else out.add(c.snap.startsWith("job") ? "career" : c.snap === "partner" ? "dating" : c.snap === "band" || c.snap === "meter" ? "choice" : c.snap === "conditions" ? "city" : c.snap);
  }
  return out;
}

/** What a slot shows for a subject or snapshot value. */
function show(kind: SlotDef["show"], raw: string): string {
  if (kind === "place") return PLACES.find((p) => p.id === raw)?.name ?? raw;
  if (kind === "employer" || kind === "boss" || kind === "coworker") {
    const [track, who] = raw.split(":");
    const t = TRACKS.find((x) => x.id === track);
    if (!t) return raw;
    if (kind === "employer") return t.employer;
    if (kind === "boss" || who === "manager") return t.manager.name.split(" ")[0];
    return who === "friend" ? t.friend.name : t.rival.name;
  }
  return raw;
}

/** Fills a card's slots from memory: the shown text and the raw subject (for `sets`), or null when one can't be filled. */
export function fillSlots(slots: Record<string, SlotDef> | undefined, m: Memory | null): { text: Record<string, string>; raw: Record<string, string> } | null {
  const text: Record<string, string> = {};
  const raw: Record<string, string> = {};
  for (const [name, s] of Object.entries(slots ?? {})) {
    let v: string | null = null;
    if (s.fact) {
      const f = m?.facts.filter((x) => x.key === s.fact && (!s.subjectStarts || x.subject.startsWith(s.subjectStarts)))
        .sort((a, b) => b.last.localeCompare(a.last))[0];
      v = f?.subject || null;
    } else if (s.snap && m) {
      const x = snapValue(m.snapshot, s.snap);
      v = Array.isArray(x) ? (x[0] as string) ?? null : x === null || x === undefined ? null : String(x);
    }
    if (!v) return null;
    raw[name] = v;
    text[name] = show(s.show, v);
  }
  return { text, raw };
}

export const fillText = (t: string, vals: Record<string, string>) => t.replace(/\{([a-z_]+)\}/g, (all, k: string) => vals[k] ?? all);

/** The longest a slot can read (for checking text lengths with the worst case filled in). */
export function longestShow(kind: SlotDef["show"]): string {
  const pick = (xs: string[]) => xs.reduce((a, b) => (b.length > a.length ? b : a), "");
  if (kind === "place") return pick(PLACES.map((p) => p.name));
  if (kind === "employer") return pick(TRACKS.map((t) => t.employer));
  if (kind === "boss") return pick(TRACKS.map((t) => t.manager.name.split(" ")[0]));
  if (kind === "coworker") return pick(TRACKS.flatMap((t) => [t.friend.name, t.rival.name]));
  return "x".repeat(16);
}

/** A storylet's own rules (lib/choices.ts validateCards runs them on every card that has them). */
export function storyletProblems(at: string, card: { title: string; when?: When; slots?: Record<string, SlotDef>; options: { label: string; get: string; cost: string; outcomes: { text: string; sets?: { fact: string; subject?: string }[]; later?: { text: string } }[] }[] }): string[] {
  const out: string[] = [];
  const facts = new Set(Object.keys(FACTS));
  for (const c of [...(card.when?.all ?? []), ...(card.when?.any ?? []), ...(card.when?.none ?? [])]) {
    if ("has" in c) { if (!facts.has(c.has)) out.push(`${at}: unknown fact "${c.has}" (lib/memory.ts)`); }
    else if (!(SNAP_PATHS as readonly string[]).includes(c.snap)) out.push(`${at}: unknown snapshot "${c.snap}"`);
    else if (c.snap === "conditions" && (typeof c.is !== "string" || !(c.is in CONDITION_KINDS))) out.push(`${at}: "conditions" needs is: a condition kind (lib/cityConditions.ts)`);
  }
  const slots = card.slots ?? {};
  for (const [n, s] of Object.entries(slots)) {
    if (!/^[a-z_]+$/.test(n)) out.push(`${at}: slot names are lowercase_with_underscores`);
    if (!!s.fact === !!s.snap) out.push(`${at}: slot ${n} needs a fact or a snapshot, not both`);
    if (s.fact && !facts.has(s.fact)) out.push(`${at}: slot ${n}: unknown fact "${s.fact}"`);
    // A slot's fact must be one the card requires, so it can always be filled.
    if (s.fact && !(card.when?.all ?? []).some((c) => "has" in c && c.has === s.fact)) out.push(`${at}: slot ${n} reads "${s.fact}", which "when.all" must require`);
    const snap = s.snap;
    if (snap && !(card.when?.all ?? []).some((c) => "snap" in c && (c.snap === snap || snap.startsWith(`${c.snap}.`)))) out.push(`${at}: slot ${n} reads "${snap}", which "when.all" must require`);
  }
  const worst = Object.fromEntries(Object.entries(slots).map(([n, s]) => [n, longestShow(s.show)]));
  const texts: { t: string; max: number; what: string }[] = [{ t: card.title, max: 110, what: "title" }];
  for (const o of card.options) {
    texts.push({ t: o.label, max: 40, what: "label" }, { t: o.get, max: 60, what: "get" }, { t: o.cost, max: 60, what: "cost" });
    for (const x of o.outcomes) {
      texts.push({ t: x.text, max: 240, what: "outcome" });
      if (x.later) texts.push({ t: x.later.text, max: 240, what: "later" });
      for (const s of x.sets ?? []) {
        if (!facts.has(s.fact)) out.push(`${at}: sets unknown fact "${s.fact}"`);
        for (const m of (s.subject ?? "").matchAll(/\{([a-z_]+)\}/g)) if (!(m[1] in slots)) out.push(`${at}: sets uses unknown slot {${m[1]}}`);
      }
    }
  }
  for (const { t, max, what } of texts) {
    for (const m of t.matchAll(/\{([a-z_]+)\}/g)) if (m[1] !== "name" && !(m[1] in slots)) out.push(`${at}: ${what} uses unknown slot {${m[1]}}`);
    if (fillText(t, worst).length > max) out.push(`${at}: ${what} is over ${max} characters with the longest names filled in`);
  }
  return out;
}

/** An empty memory: what a brand-new player (or a preview without memory) has. */
export const EMPTY_MEMORY: Memory = {
  snapshot: { rank: 1, clout: 0, bank: 0, meter: 50, band: "middle", home: null, at: null, job: null, businesses: [], partner: null, campus: null, campaign: null, marks: [], crew: 0, skills: {}, conditions: [] },
  facts: [],
};
