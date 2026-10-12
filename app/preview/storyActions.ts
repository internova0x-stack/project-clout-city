"use server";

import { loadArcs } from "@/lib/storyContent";
import { buildFeed, castVote, claimRewards, emptyStoryState, type PlayerStoryState, type VoteCounts } from "@/lib/storyFeedBuild";
import type { StoryResult } from "@/lib/storyFeed";
import type { CheckoutResult, StoreProduct } from "@/lib/store";
import { addDaysISO, predictionWindow } from "@/lib/stories";

// Development previews only: the story world in memory on the dev server, so the
// News app can be tried without a database. Refused in production builds.

const store: { starts: Record<string, string | null>; st: PlayerStoryState; offset: number } = {
  starts: { "sarah-bird": null },
  st: emptyStoryState(),
  offset: 0,
};

// Simulated Queens, for live poll results (roughly the brief's expected poll shape).
const CROWD: VoteCounts = {
  P1: { confront: 412, apologize: 268, "meet-jett": 190, "take-back": 230 },
  P2: { jett: 1240, loretta: 610, theo: 330, "pastor-vale": 220 },
  P3: { "jetts-car": 520, "lorettas-handbag": 470, "radiant-harbor": 260, "east-river": 610 },
};

const nowMs = () => Date.now() + store.offset * 1000;
const nyDate = (ms: number) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date(ms));

function result(extra: { clout?: number; message?: string } = {}): StoryResult {
  if (process.env.NODE_ENV === "production") return { ok: false, error: "Previews are off in production." };
  const arcs = loadArcs();
  const clout = claimRewards(arcs, store.starts, nowMs(), store.st) + (extra.clout ?? 0);
  return { ok: true, feed: buildFeed(arcs, store.starts, nowMs(), store.st, CROWD), clout: clout || undefined, message: extra.message };
}
const fail = (error: string): StoryResult => ({ ok: false, error });

export async function previewStoryRefresh(offsetSeconds = 0) {
  store.offset = offsetSeconds;
  return result();
}
export async function previewStoryVote(pid: string, option: string) {
  const e = castVote(loadArcs(), store.starts, nowMs(), store.st, pid, option);
  return e ? fail(e) : result();
}
export async function previewStoryShadow(pid: string, option: string) {
  if (store.st.votes[pid]) return fail("You already voted on this one, so the archive guess is off.");
  store.st.shadow[pid] = option;
  const arc = loadArcs().find((a) => a.beats.some((b) => b.prediction?.id === pid))!;
  const p = arc.beats.find((b) => b.prediction?.id === pid)!.prediction!;
  if (option === p.correct && arc.shadow_badge && !store.st.badges.some((b) => b.id === arc.shadow_badge)) {
    store.st.badges.push({ id: arc.shadow_badge, arc: arc.id, earnedAt: new Date(nowMs()).toISOString() });
  }
  return result();
}
export async function previewStorySeen(beatId: string) {
  if (!store.st.seen.includes(beatId)) store.st.seen.push(beatId);
  return result();
}
/** Completes a story task by id (share, evidence) or by what was done (place action, event). */
export async function previewStoryTask(taskId: string, by?: { place?: string; action?: string; event?: string }) {
  const feed = result();
  if (!feed.ok) return feed;
  const task = feed.feed.tasks.find((t) => (by ? (by.event ? t.do.event === by.event : t.do.place === by.place && t.do.action === by.action) : t.id === taskId));
  if (!task || task.done) return by ? feed : fail("That story task has moved on. Stories wait for no one.");
  store.st.tasksDone.push(task.id);
  return result({ clout: task.clout, message: `Story task done: ${task.label}` });
}
export async function previewStoryDevStart(day: number | null) {
  store.starts["sarah-bird"] = day === null ? null : addDaysISO(nyDate(nowMs()), -(day - 1));
  if (day === null) store.st = emptyStoryState();
  return result();
}
export async function previewStoryEntitle(sku: string, on: boolean) {
  store.st.skus = on ? [...new Set([...store.st.skus, sku])] : store.st.skus.filter((s) => s !== sku);
  return result();
}
/** Hours until a story day's time from the current game clock (to drive the city clock offset). */
export async function previewStoryHoursTo(day: number, time = "12:00") {
  const start = store.starts["sarah-bird"];
  if (!start) return 0;
  const arc = loadArcs().find((a) => a.id === "sarah-bird")!;
  const ms = predictionWindow(arc, { day } as never, { closes_at: { day, time } } as never, start).closes - 59_999;
  return (ms - Date.now()) / 3_600_000;
}

// ---- Payments, simulated: no Stripe. "Checkout" returns straight to the game, and a
// pretend webhook unlocks the side story a few seconds later, like the real one.
const pending = new Set<string>();
export async function previewStoreCatalog(): Promise<StoreProduct[] | null> {
  if (process.env.NODE_ENV === "production") return null;
  return loadArcs()
    .filter((a) => a.type === "side" && a.sku)
    .map((a) => ({
      sku: a.sku!, type: "side_arc" as const, name: a.title, priceCents: 299, currency: "usd", parent: a.parent_arc_id ?? null,
      owned: store.st.skus.includes(a.sku!), pending: pending.has(a.sku!),
    }));
}
export async function previewCheckout(sku: string, returnTo: string): Promise<CheckoutResult> {
  if (process.env.NODE_ENV === "production") return { ok: false, error: "Previews are off in production." };
  pending.add(sku);
  setTimeout(() => {
    pending.delete(sku);
    if (!store.st.skus.includes(sku)) store.st.skus.push(sku);
  }, 4000);
  const url = new URL(returnTo, "http://preview.local");
  url.searchParams.set("purchase", "success");
  url.searchParams.set("sku", sku);
  return { ok: true, url: `${url.pathname}${url.search}` };
}
