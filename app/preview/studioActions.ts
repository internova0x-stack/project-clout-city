"use server";

import { previewOnly } from "./guard";

import { loadArcs } from "@/lib/storyContent";
import { lastDay, storyDay, type Arc, type Status } from "@/lib/stories";
import { applyBeatText, parseArcs, weekdayOf, type BeatText, type Review, type StudioArc, type StudioResult } from "@/lib/studio";
import { validateArcs } from "@/lib/storyValidation";

// Development previews only: the Story Studio on an in-memory copy of content/stories,
// following the same rules as the admin_* SQL functions. Refused in production builds.

interface Row { arc: Arc; position: number | null; status: Status; review: Review; note: string | null; reviewedAt: string | null; startAt: string | null; updatedAt: string }
let rows: Row[] | null = null;
const VOTES: Record<string, number> = { P1: 1100, P2: 2400, P3: 1860 };

const nyToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
// The pilot (Sarah Bird and its side stories) starts approved; newer story files wait for review, as the game's
// loader leaves them (C6, migration 0098).
const pilot = (arc: Arc) => arc.id === "sarah-bird" || arc.parent_arc_id === "sarah-bird";
const store = () => (rows ??= loadArcs().map((arc) => ({ arc, position: null, status: arc.status, review: (pilot(arc) ? "approved" : "draft") as Review, note: null, reviewedAt: null, startAt: null, updatedAt: new Date().toISOString() })));
const startOf = (r: Row) => (r.arc.type === "side" ? store().find((p) => p.arc.id === r.arc.parent_arc_id)?.startAt ?? null : r.startAt);
const fail = (error: string, problems?: string[]): StudioResult => ({ ok: false, error, problems });

function list(message?: string): StudioResult {
  if (process.env.NODE_ENV === "production") return fail("Previews are off in production.");
  const today = nyToday();
  const arcs: StudioArc[] = store().map((r) => {
    const start = startOf(r);
    const live = r.status === "active" && r.review === "approved" && start ? storyDay(r.arc, today, start) : null;
    return {
      id: r.arc.id, title: r.arc.title, type: r.arc.type, tier: r.arc.tier, sku: r.arc.sku ?? null, parent: r.arc.parent_arc_id ?? null,
      status: r.status, review: r.review, reviewNote: r.note, reviewedAt: r.reviewedAt, startAt: start, day: live, lastDay: lastDay(r.arc),
      updatedAt: r.updatedAt, startWeekday: r.arc.start_weekday ?? null, position: r.position,
      beats: r.arc.beats.map((b) => ({ id: b.id, day: b.day, headline: b.news[0]?.headline ?? "", status: b.status ?? "active", prediction: b.prediction?.id ?? null })),
      votes: Object.fromEntries(r.arc.beats.filter((b) => b.prediction && live && live >= b.day).map((b) => [b.prediction!.id, VOTES[b.prediction!.id] ?? 0])),
    };
  });
  // Like admin_story_list (migration 0071): the Studio's order first, then mains before sides, then by id.
  const pos = (a: StudioArc) => a.position ?? Number.MAX_SAFE_INTEGER;
  return { ok: true, arcs: arcs.sort((a, b) => pos(a) - pos(b) || (a.type === b.type ? a.id.localeCompare(b.id) : a.type === "main" ? -1 : 1)), message };
}
const isLive = (r: Row) => list().ok && (list() as { arcs: StudioArc[] }).arcs.find((a) => a.id === r.arc.id)?.day != null;
const find = (id: string) => store().find((r) => r.arc.id === id);

export async function previewStudioList() {
  previewOnly();
  return list();
}
export async function previewStudioUpload(json: string) {
  previewOnly();
  const parsed = parseArcs(json);
  if ("error" in parsed) return fail(parsed.error);
  const ids = new Set(parsed.arcs.map((a) => a.id));
  const problems = validateArcs([...store().filter((r) => !ids.has(r.arc.id)).map((r) => r.arc), ...parsed.arcs]).filter((p) => !p.includes(":") || ids.has(p.split(":")[0]));
  if (problems.length) return fail(`The file has ${problems.length} problem${problems.length === 1 ? "" : "s"}. Nothing was saved.`, problems);
  for (const arc of parsed.arcs) {
    const r = find(arc.id);
    if (r && isLive(r)) return fail(`${arc.id}: That story is live. Pause or retire it instead of changing it mid-run.`);
    const same = r && JSON.stringify(r.arc) === JSON.stringify(arc);
    if (r) Object.assign(r, { arc, review: same ? r.review : "draft", updatedAt: new Date().toISOString() });
    else store().push({ arc, position: null, status: arc.status ?? "active", review: "draft", note: null, reviewedAt: null, startAt: null, updatedAt: new Date().toISOString() });
  }
  return list(`Saved ${parsed.arcs.map((a) => a.title || a.id).join(", ")}. New or changed stories wait for approval.`);
}
export async function previewStudioReview(id: string, decision: Review, note: string) {
  previewOnly();
  const r = find(id);
  if (!r) return fail("That story doesn't exist.");
  if (decision !== "approved" && isLive(r)) return fail("That story is live. Pause or retire it instead of changing it mid-run.");
  Object.assign(r, { review: decision, note: note.trim() || null, reviewedAt: new Date().toISOString(), startAt: decision === "approved" ? r.startAt : null });
  // A main story's side stories waiting for review are approved with it (owner, Oct 22), as in the game's Studio.
  const sides = decision === "approved" ? store().filter((x) => x.arc.parent_arc_id === id && x.review === "draft") : [];
  for (const x of sides) Object.assign(x, { review: "approved", reviewedAt: new Date().toISOString() });
  return list(decision === "approved"
    ? sides.length ? `Approved with its ${sides.length} side stor${sides.length === 1 ? "y" : "ies"}. They go out together once it has a Day 1.` : "Approved. It can be scheduled now."
    : decision === "declined" ? "Declined. The note is saved with it." : "Back to draft.");
}
export async function previewStudioSchedule(id: string, start: string | null) {
  previewOnly();
  const r = find(id);
  if (!r) return fail("That story doesn't exist.");
  if (r.arc.type !== "main") return fail("Side stories run with their main story; schedule the main story.");
  if (start) {
    if (r.review !== "approved") return fail("Approve the story before scheduling it.");
    if (start < nyToday()) return fail("Day 1 can't be in the past.");
    if (r.arc.start_weekday && weekdayOf(start) !== r.arc.start_weekday) return fail("That's the wrong weekday for this story's start.");
  } else if (isLive(r)) return fail("That story is live. Pause or retire it instead of changing it mid-run.");
  r.startAt = start;
  return list(start ? `Scheduled: Day 1 is ${start}.` : "Unscheduled.");
}
export async function previewStudioGoLive(id: string) {
  previewOnly();
  const r = find(id);
  if (!r) return fail("That story doesn't exist.");
  if (r.arc.type !== "main") return fail("Side stories run with their main story; schedule the main story.");
  if (isLive(r)) return fail("That story is live. Pause or retire it instead of changing it mid-run.");
  Object.assign(r, { review: "approved", reviewedAt: r.reviewedAt ?? new Date().toISOString(), status: "active", startAt: nyToday() });
  for (const x of store()) if (x.arc.parent_arc_id === id && x.review === "draft") Object.assign(x, { review: "approved", reviewedAt: new Date().toISOString() });
  return list("Live. Today is Day 1: players see it on their next refresh.");
}
export async function previewStudioStatus(id: string, status: Status) {
  previewOnly();
  const r = find(id);
  if (!r) return fail("That story doesn't exist.");
  r.status = status;
  return list(status === "active" ? "Resumed." : status === "paused" ? "Paused. Players stop seeing it until it resumes." : "Retired.");
}
export async function previewStudioBeatStatus(id: string, beat: string, status: Status) {
  previewOnly();
  const b = find(id)?.arc.beats.find((x) => x.id === beat);
  if (!b) return fail("That beat doesn't exist.");
  b.status = status;
  return list(`Beat ${beat} is ${status}.`);
}
export async function previewStudioContent(id: string): Promise<{ ok: true; arcs: Arc[] } | { ok: false; error: string }> {
  previewOnly();
  if (process.env.NODE_ENV === "production") return { ok: false, error: "Previews are off in production." };
  const rs = store().filter((r) => r.arc.id === id || r.arc.parent_arc_id === id);
  return { ok: true, arcs: rs.map((r) => ({ ...r.arc, status: r.status })) };
}
/** Puts a story on a given story day today (preview only; the real Studio schedules forward from today). */
export async function previewStudioSetDay(id: string, day: number) {
  previewOnly();
  const r = find(id);
  if (!r) return fail("That story doesn't exist.");
  const d = new Date(`${nyToday()}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - (day - 1));
  r.startAt = d.toISOString().slice(0, 10);
  return list();
}
export async function previewStudioReorder(ids: string[]) {
  previewOnly();
  ids.forEach((id, i) => { const r = find(id); if (r) r.position = i + 1; });
  return list("Order saved.");
}
export async function previewStudioBeatEdit(id: string, beatId: string, text: BeatText) {
  previewOnly();
  const r = find(id);
  const beat = r?.arc.beats.find((b) => b.id === beatId);
  if (!r || !beat) return fail("That beat doesn't exist.");
  const e = applyBeatText(beat, text);
  if (!e.ok) return fail(e.error);
  const edited = { ...r.arc, beats: r.arc.beats.map((b) => (b.id === beatId ? e.beat : b)) };
  const problems = validateArcs(store().map((x) => (x === r ? edited : x.arc))).filter((p) => p.startsWith(`${id}:`) || !p.includes(":"));
  if (problems.length) return fail(`The edit has ${problems.length} problem${problems.length === 1 ? "" : "s"}. Nothing was saved.`, problems);
  r.arc = edited;
  r.updatedAt = new Date().toISOString();
  return list(`Saved beat ${beatId}.`);
}
