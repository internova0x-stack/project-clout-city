"use server";

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { previewOnly } from "./guard";
import type { ChoiceCard } from "@/lib/choices";
import type { StoryletAction, StudioStorylet, StudioStorylets } from "@/lib/storyletWeeks";

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
