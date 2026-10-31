"use server";

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { previewOnly } from "./guard";
import type { ChoiceCard } from "@/lib/choices";
import type { StoryletAction, StudioStorylet, StudioStorylets } from "@/lib/storyletWeeks";
import type { CityCondition, ReactionRule, StudioCondition } from "@/lib/cityConditions";
import { learnWeights, studioRows, type CardStats, type StudioLearning } from "@/lib/cardLearning";
import { CHOICE_CARDS } from "@/lib/choicesContent";
import type { StudioUnderworldJob } from "@/lib/underworldWeeks";
import type { Job } from "@/lib/underworld";

// Development previews only: Studio → Storylets in memory (migration 0139), from the repo's content/storylets files.
// Every card arrived 6 hours ago, so its window has 18 hours left.

let cards: StudioStorylet[] | null = null;

async function load(): Promise<StudioStorylet[]> {
  if (cards) return cards;
  const dir = path.join(process.cwd(), "content", "storylets");
  const files = (await readdir(dir).catch(() => [] as string[])).filter((f) => f.endsWith(".json")).sort().reverse();
  const arrived = new Date(Date.now() - 6 * 3_600_000).toISOString();
  const liveAt = new Date(Date.now() + 18 * 3_600_000).toISOString();
  cards = [];
  for (const f of files) {
    const w = JSON.parse(await readFile(path.join(dir, f), "utf8")) as { week: string; cards: ChoiceCard[] };
    for (const c of w.cards) cards.push({ id: c.id, week: w.week, family: c.family!, card: c, status: "scheduled", live_at: liveAt, arrived_at: arrived, decided_at: null });
  }
  return cards;
}

const view = (cs: StudioStorylet[]): StudioStorylets => ({ window_hours: 24, autopilot: true, cards: cs.map((c) => ({ ...c })) });

export async function previewStorylets() {
  previewOnly();
  return { ok: true as const, data: view(await load()) };
}

export async function previewStoryletSet(id: string, action: StoryletAction) {
  previewOnly();
  const cs = await load();
  const c = cs.find((x) => x.id === id);
  if (!c) return { ok: false as const, error: "That storylet isn't here any more." };
  c.decided_at = new Date().toISOString();
  if (action === "veto") c.status = "vetoed";
  else if (action === "pause") c.status = "paused";
  else if (action === "restore") c.status = Date.parse(c.live_at) <= Date.now() ? "live" : "scheduled";
  else { c.status = "live"; c.live_at = new Date().toISOString(); }
  return { ok: true as const, data: view(cs) };
}

// Content Engine step 4: the week's city conditions (arrived 6 hours ago) and one city storylet that fired.
let conds: StudioCondition[] | null = null;
async function loadConds(): Promise<StudioCondition[]> {
  if (conds) return conds;
  const root = path.join(process.cwd(), "content");
  const files = (await readdir(path.join(root, "conditions")).catch(() => [] as string[])).filter((f) => f.endsWith(".json")).sort().reverse();
  const liveAt = new Date(Date.now() + 18 * 3_600_000).toISOString();
  conds = [];
  for (const f of files) {
    const w = JSON.parse(await readFile(path.join(root, "conditions", f), "utf8")) as { week: string; conditions: CityCondition[] };
    for (const c of w.conditions) conds.push({ id: c.id, kind: c.kind, subject: c.subject ?? "", emoji: c.emoji, title: c.title, blurb: c.blurb, effects: c.effects,
      starts_at: c.startsAt, ends_at: c.endsAt, week: w.week, source: "weekly", rule: null, status: "scheduled", live_at: liveAt, on: false, decided_at: null });
  }
  const rules = JSON.parse(await readFile(path.join(root, "city", "reactions.json"), "utf8")) as ReactionRule[];
  const r = rules[0];
  if (r) conds.unshift({ id: `${r.id}-preview`, kind: r.condition.kind, subject: r.condition.subject ?? "", emoji: r.condition.emoji, title: r.condition.title,
    blurb: r.condition.blurb, effects: r.condition.effects, starts_at: new Date(Date.now() - 20 * 3_600_000).toISOString(),
    ends_at: new Date(Date.now() + (r.condition.hours - 20) * 3_600_000).toISOString(), week: null, source: "reaction", rule: r.id,
    status: "live", live_at: new Date(Date.now() - 20 * 3_600_000).toISOString(), on: true, decided_at: null });
  return conds;
}

export async function previewConditions() {
  previewOnly();
  return { ok: true as const, data: (await loadConds()).map((c) => ({ ...c })) };
}

export async function previewConditionSet(id: string, action: StoryletAction) {
  previewOnly();
  const cs = await loadConds();
  const c = cs.find((x) => x.id === id);
  if (!c) return { ok: false as const, error: "That condition isn't here any more." };
  c.decided_at = new Date().toISOString();
  if (action === "veto") { c.status = "vetoed"; c.on = false; }
  else if (action === "pause") { c.status = "paused"; c.on = false; }
  else {
    c.status = action === "now" || Date.parse(c.live_at) <= Date.now() ? "live" : "scheduled";
    if (action === "now") c.live_at = new Date().toISOString();
    c.on = c.status === "live" && Date.parse(c.starts_at) <= Date.now() && Date.parse(c.ends_at) > Date.now();
  }
  return { ok: true as const, data: cs.map((x) => ({ ...x })) };
}

// Content Engine step 6: four weeks of made-up results for the game's cards (some loved, some closed by everyone),
// weighted by the real rules, and the owner's overrides in memory.
let learn: { stats: CardStats[]; weights: { card: string; weight: number; retired: boolean; set_by: "auto" | "admin" }[] } | null = null;
function loadLearn() {
  if (learn) return learn;
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const stats: CardStats[] = CHOICE_CARDS.filter((c) => !c.chainOnly).slice(0, 60).map((c, i) => {
    const shown = 20 + Math.floor(rnd() * 140);
    const engage = i % 11 === 3 ? 0.12 : 0.35 + rnd() * 0.55;
    const chosen = Math.round(shown * engage);
    const skipped = Math.round((shown - chosen) * 0.8);
    const options = Object.fromEntries(c.options.map((o, k) => [o.id, Math.round(chosen * (k === 0 ? 0.3 + rnd() * 0.6 : rnd() * 0.4))]));
    return { card: c.id, base: c.base, shown, chosen, skipped, expired: shown - chosen - skipped, options };
  });
  const auto = learnWeights(stats, Object.fromEntries(CHOICE_CARDS.map((c) => [c.id, c.options.length])));
  learn = { stats, weights: auto.map((w) => ({ card: w.card, weight: w.weight, retired: w.retired, set_by: "auto" as const })) };
  return learn;
}
const titles = () => Object.fromEntries(CHOICE_CARDS.map((c) => [c.id, { title: c.title, emoji: c.emoji, options: c.options.length, slots: c.slots }]));
const learnView = (): StudioLearning => { const l = loadLearn(); return { rows: studioRows(l.stats, l.weights, titles()), lastRun: new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" }) }; };

export async function previewLearning() {
  previewOnly();
  return { ok: true as const, data: learnView() };
}

export async function previewLearningSet(card: string, set: { weight: number; retired: boolean } | "auto") {
  previewOnly();
  const l = loadLearn();
  const w = l.weights.find((x) => x.card === card);
  if (set === "auto") { if (w) w.set_by = "auto"; }
  else if (w) Object.assign(w, { weight: set.weight, retired: set.retired, set_by: "admin" });
  else l.weights.push({ card, weight: set.weight, retired: set.retired, set_by: "admin" });
  return { ok: true as const, data: learnView() };
}

// The underworld, part 2 (migration 0150): Studio → Storylets → Pablo's jobs, from content/underworld-weeks (arrived 6 hours
// ago, like the storylets).
let uwJobs: StudioUnderworldJob[] | null = null;
async function loadUw(): Promise<StudioUnderworldJob[]> {
  if (uwJobs) return uwJobs;
  const dir = path.join(process.cwd(), "content", "underworld-weeks");
  const files = (await readdir(dir).catch(() => [] as string[])).filter((f) => f.endsWith(".json")).sort().reverse();
  const out: StudioUnderworldJob[] = [];
  const arrived = new Date(Date.now() - 6 * 3_600_000).toISOString();
  const live = new Date(Date.now() + 18 * 3_600_000).toISOString();
  for (const f of files) {
    const w = JSON.parse(await readFile(path.join(dir, f), "utf8")) as { week: string; jobs: Job[] };
    for (const job of w.jobs) out.push({ id: job.id, week: w.week, job, status: "scheduled", live_at: live, arrived_at: arrived, decided_at: null });
  }
  uwJobs = out;
  return out;
}

export async function previewUnderworldJobs() {
  previewOnly();
  return { ok: true as const, data: (await loadUw()).map((j) => ({ ...j })) };
}

export async function previewUnderworldJobSet(id: string, action: StoryletAction) {
  previewOnly();
  const js = await loadUw();
  const j = js.find((x) => x.id === id);
  if (!j) return { ok: false as const, error: "That job isn't here any more." };
  j.decided_at = new Date().toISOString();
  if (action === "veto") j.status = "vetoed";
  else if (action === "pause") j.status = "paused";
  else {
    if (action === "now") j.live_at = new Date().toISOString();
    j.status = Date.parse(j.live_at) <= Date.now() ? "live" : "scheduled";
  }
  return { ok: true as const, data: js.map((x) => ({ ...x })) };
}
