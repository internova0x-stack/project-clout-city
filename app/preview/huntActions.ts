"use server";

// Development previews only: this week's treasure hunt from the first file in content/hunts/,
// moved to the current week and run with the same engine as the database (lib/hunts.ts). It
// runs here on the server so answers never reach the browser. Nothing is saved.
import FILE from "@/content/hunts/2026-10-19.json";
import { CITY_ECONOMY } from "@/lib/city";
import { huntAnswer, huntCard, huntTalk, huntView, validateHunt, type HuntCard, type HuntFile, type HuntProgress, type HuntResult, type HuntState } from "@/lib/hunts";
import type { Admin, ContentDraft, HuntAdmin } from "@/lib/studio";
import { readContentDrafts } from "@/lib/contentDrafts";
import type { StyleId } from "@/lib/styles";

const off = () => process.env.NODE_ENV === "production";
const OFF: HuntResult = { ok: false, error: "Previews are off in production." };

function thisMonday(): string {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

const hunt = (): HuntFile => ({ ...(FILE as unknown as HuntFile), week: thisMonday() });
let prog: HuntProgress | null = null;
let cards: HuntCard[] = [];

const state = (): HuntState => ({ hunt: huntView(hunt(), prog, Date.now()), cards, completed: cards.length });

/**
 * Sets the preview's starting point: "new" (not joined), "joined", "question" (an open question
 * at step 2), "wrong" (a wrong answer, waiting), "finale" (at the last step) or "done" (found, with three older cards: badge).
 */
export async function previewHuntSetup(mode: string, style: StyleId): Promise<HuntResult> {
  if (off()) return OFF;
  const h = hunt();
  const base: HuntProgress = { style, step: 0, talked: false, wrongAt: null, completedAt: null };
  cards = [];
  prog = mode === "new" ? null
    : mode === "question" ? { ...base, step: 1, talked: true }
    : mode === "wrong" ? { ...base, step: 1, talked: true, wrongAt: new Date().toISOString() }
    : mode === "finale" ? { ...base, step: h.places.length - 1 }
    : mode === "done" ? { ...base, step: h.places.length, completedAt: new Date().toISOString() }
    : base;
  if (mode === "done") {
    const old = (n: number, treasure: string, emoji: string): HuntCard => ({
      huntId: `old-${n}`, week: h.week, theme: "An earlier hunt", treasure, emoji, lore: "From an earlier week (sample).", earnedAt: new Date(Date.now() - n * 7 * 86_400_000).toISOString(),
    });
    cards = [huntCard(h, style, new Date().toISOString()), old(1, "The Brass Subway Token", "🪙"), old(2, "The Velvet Rope", "🎗️"), old(3, "The Last Slice", "🍕")];
  }
  return { ok: true, state: state() };
}

export async function previewHuntState(): Promise<HuntResult> {
  return off() ? OFF : { ok: true, state: state() };
}

export async function previewHuntJoin(style: StyleId): Promise<HuntResult> {
  if (off()) return OFF;
  prog ??= { style, step: 0, talked: false, wrongAt: null, completedAt: null };
  return { ok: true, state: state() };
}

/** `visited`: the preview city's own record of a visit there today. */
export async function previewHuntTalk(placeId: string, visited: boolean): Promise<HuntResult> {
  if (off()) return OFF;
  if (!prog) return { ok: false, code: "not_here", error: "They don't have anything for your hunt." };
  const r = huntTalk(hunt(), prog, placeId, visited);
  if (!r.ok) return { ok: false, code: r.code, error: r.code === "visit_first" ? "Stop in first, then ask." : "They don't have anything for your hunt." };
  prog = r.prog;
  return { ok: true, state: state(), line: { say: r.say, question: r.question } };
}

export async function previewHuntAnswer(choice: number): Promise<HuntResult> {
  if (off()) return OFF;
  if (!prog) return { ok: false, code: "not_here", error: "They don't have anything for your hunt." };
  const h = hunt();
  const r = huntAnswer(h, prog, choice, Date.now());
  if (!r.ok) return { ok: false, code: r.code, error: r.code === "wait" ? "Not yet. Give it ten minutes and try again." : "They don't have anything for your hunt." };
  prog = r.prog;
  let reward: { cash: number; clout: number; badge: boolean } | undefined;
  if (r.finished) {
    cards = [huntCard(h, prog.style, new Date().toISOString()), ...cards.filter((c) => c.huntId !== h.id)];
    reward = { cash: CITY_ECONOMY.hunt.cash, clout: CITY_ECONOMY.hunt.clout, badge: cards.length === CITY_ECONOMY.hunt.badgeAfter };
  }
  return { ok: true, state: state(), correct: r.correct, line: r.then ? { say: r.then } : undefined, reward };
}

// ---- The Studio's Hunts tab in preview (in memory) ----
let admin: HuntAdmin[] | null = null;
function seed(): HuntAdmin[] {
  admin ??= [{ id: hunt().id, week: hunt().week, status: "review", data: hunt(), joined: 412, completed: 96, atStep: [40, 118, 61, 52, 45] }];
  return admin;
}
export async function previewHuntList(): Promise<Admin<HuntAdmin[]>> {
  if (off()) return { ok: false, error: "Previews are off in production." };
  return { ok: true, data: [...seed()].sort((a, b) => b.week.localeCompare(a.week)) };
}
export async function previewHuntUpload(json: string): Promise<Admin<null> & { problems?: string[] }> {
  if (off()) return { ok: false, error: "Previews are off in production." };
  let raw: unknown;
  try { raw = JSON.parse(json); } catch { return { ok: false, error: "That isn't valid JSON." }; }
  const r = validateHunt(raw);
  if (!r.ok) return { ok: false, error: "The hunt didn't pass its checks.", problems: r.problems };
  const list = seed();
  // Like migration 0019: a new hunt replaces an unused one for the same week.
  const other = list.find((x) => x.week === r.hunt.week && x.id !== r.hunt.id);
  if (other?.joined) return { ok: false, error: "Players have already joined this week's hunt, so it can't be replaced. Pause it, or use next week." };
  if (other) list.splice(list.indexOf(other), 1);
  const i = list.findIndex((x) => x.id === r.hunt.id);
  const row: HuntAdmin = { id: r.hunt.id, week: r.hunt.week, status: "review", data: r.hunt, joined: 0, completed: 0, atStep: r.hunt.places.map(() => 0) };
  if (i >= 0) list[i] = { ...row, joined: list[i].joined, completed: list[i].completed, atStep: list[i].atStep }; else list.push(row);
  return { ok: true, data: null };
}
export async function previewHuntStatus(id: string, status: HuntAdmin["status"], note?: string): Promise<Admin<null>> {
  if (off()) return { ok: false, error: "Previews are off in production." };
  const row = seed().find((x) => x.id === id);
  if (!row) return { ok: false, error: "That hunt is gone." };
  row.status = status;
  row.note = status === "review" ? note?.trim() || null : status === "approved" ? null : row.note;
  return { ok: true, data: null };
}

/** The Studio calendar's week files (the real ones from content/; nothing is saved). */
export async function previewDrafts(): Promise<Admin<ContentDraft[]>> {
  if (off()) return { ok: false, error: "Previews are off in production." };
  return { ok: true, data: await readContentDrafts() };
}
