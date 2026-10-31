"use server";

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { previewOnly } from "./guard";
import type { ChoiceCard } from "@/lib/choices";
import type { StoryletAction, StudioStorylet, StudioStorylets } from "@/lib/storyletWeeks";
import type { CityCondition, ReactionRule, StudioCondition } from "@/lib/cityConditions";

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
