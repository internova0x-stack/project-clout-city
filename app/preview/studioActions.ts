"use server";

import { loadArcs } from "@/lib/storyContent";
import { lastDay, storyDay, type Arc, type Status } from "@/lib/stories";
import { parseArcs, weekdayOf, type Review, type StudioArc, type StudioResult } from "@/lib/studio";
import { validateArcs } from "@/lib/storyValidation";

// Development previews only: the Story Studio on an in-memory copy of content/stories,
// following the same rules as the admin_* SQL functions. Refused in production builds.

interface Row { arc: Arc; status: Status; review: Review; note: string | null; reviewedAt: string | null; startAt: string | null; updatedAt: string }
let rows: Row[] | null = null;
const VOTES: Record<string, number> = { P1: 1100, P2: 2400, P3: 1860 };

const nyToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
const store = () => (rows ??= loadArcs().map((arc) => ({ arc, status: arc.status, review: "approved" as Review, note: null, reviewedAt: null, startAt: null, updatedAt: new Date().toISOString() })));
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
      updatedAt: r.updatedAt, startWeekday: r.arc.start_weekday ?? null,
      beats: r.arc.beats.map((b) => ({ id: b.id, day: b.day, headline: b.news[0]?.headline ?? "", status: b.status ?? "active", prediction: b.prediction?.id ?? null })),
      votes: Object.fromEntries(r.arc.beats.filter((b) => b.prediction && live && live >= b.day).map((b) => [b.prediction!.id, VOTES[b.prediction!.id] ?? 0])),
    };
  });
  return { ok: true, arcs: arcs.sort((a, b) => (a.type === b.type ? a.id.localeCompare(b.id) : a.type === "main" ? -1 : 1)), message };
}
const isLive = (r: Row) => list().ok && (list() as { arcs: StudioArc[] }).arcs.find((a) => a.id === r.arc.id)?.day != null;
const find = (id: string) => store().find((r) => r.arc.id === id);

export async function previewStudioList() {
  return list();
}
export async function previewStudioUpload(json: string) {
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
    else store().push({ arc, status: arc.status ?? "active", review: "draft", note: null, reviewedAt: null, startAt: null, updatedAt: new Date().toISOString() });
  }
  return list(`Saved ${parsed.arcs.map((a) => a.title || a.id).join(", ")}. New or changed stories wait for approval.`);
}
export async function previewStudioReview(id: string, decision: Review, note: string) {
  const r = find(id);
  if (!r) return fail("That story doesn't exist.");
  Object.assign(r, { review: decision, note: note.trim() || null, reviewedAt: new Date().toISOString(), startAt: decision === "approved" ? r.startAt : null });
  return list(decision === "approved" ? "Approved. It can be scheduled now." : decision === "declined" ? "Declined. The note is saved with it." : "Back to draft.");
}
export async function previewStudioSchedule(id: string, start: string | null) {
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
export async function previewStudioStatus(id: string, status: Status) {
  const r = find(id);
  if (!r) return fail("That story doesn't exist.");
  r.status = status;
  return list(status === "active" ? "Resumed." : status === "paused" ? "Paused. Players stop seeing it until it resumes." : "Retired.");
}
export async function previewStudioBeatStatus(id: string, beat: string, status: Status) {
  const b = find(id)?.arc.beats.find((x) => x.id === beat);
  if (!b) return fail("That beat doesn't exist.");
  b.status = status;
  return list(`Beat ${beat} is ${status}.`);
}
export async function previewStudioContent(id: string): Promise<{ ok: true; arcs: Arc[] } | { ok: false; error: string }> {
  if (process.env.NODE_ENV === "production") return { ok: false, error: "Previews are off in production." };
  const rs = store().filter((r) => r.arc.id === id || r.arc.parent_arc_id === id);
  return { ok: true, arcs: rs.map((r) => ({ ...r.arc, status: r.status })) };
}
/** Puts a story on a given story day today (preview only; the real Studio schedules forward from today). */
export async function previewStudioSetDay(id: string, day: number) {
  const r = find(id);
  if (!r) return fail("That story doesn't exist.");
  const d = new Date(`${nyToday()}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - (day - 1));
  r.startAt = d.toISOString().slice(0, 10);
  return list();
}
