// City News (v0.6, docs/08-new-features-spec.md section 3): light gossip about the invented
// cast, Lola's weekly dating column and the Monday hunt announcement. A week is written as one
// file in content/news/, uploaded and approved in the Story Studio, and published day by day.
// News never changes prices or places (only stories do). Dependency-free so tests can import it.

import { CELEBRITIES, MAYOR_MAMA_MANDEE, OFFICIALS, REGULARS, WANNABES } from "./cast.ts";
import { CITY_ECONOMY } from "./city.ts";

/** C4 (owner, Oct 20): "transit" is the Metro Rail Authority's service updates (delays, reroutes, weekend changes, fares). */
export type NewsKind = "city" | "column" | "hunt" | "transit";

/**
 * C4: a transit update's line and, for a delay, the extra seconds it adds to that line's subway trips from `from`
 * (New York time, "HH:MM") for `hours` on its day (migration 0095). Without `delay` it's news only.
 */
export interface TransitInfo { line: string; from: string; hours: number; delay?: number }

/** One published item, as players get it from news_feed(). */
export interface NewsItem {
  id: string;
  kind: NewsKind;
  headline: string;
  body: string;
  cast: string[];
  /** Publish day, YYYY-MM-DD (New York). */
  day: string;
  transit?: TransitInfo;
}

/** The week file the Studio uploads. Days are Mon to Sun of `week` (a Monday). */
export interface NewsWeekFile {
  week: string;
  items: ({ id: string; kind: NewsKind; day: "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun"; headline: string; body: string; cast?: string[] } & Partial<TransitInfo>)[];
}

export const NEWS_KIND_LABEL: Record<NewsKind, string> = { city: "City news", column: "💌 Ask Lola", hunt: "🗺️ Treasure hunt", transit: "🚇 Metro Rail Authority" };
/** C4: the lines a transit update can name (lib/city.ts travel.subway.lines). */
export const TRANSIT_LINES = [...new Set(Object.values(CITY_ECONOMY.travel.subway.lines))];
const minutesOf = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const CAST_IDS = new Set([...CELEBRITIES, ...WANNABES, ...REGULARS, ...OFFICIALS].map((c) => c.id));
/** The Mayor is a weekly regular in City News from this week on (owner, Oct 22). */
export const MAYOR_WEEKLY_FROM = "2026-10-26";

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Checks a week file and turns it into dated items. Every rule the Studio enforces is here. */
export function validateNewsWeek(raw: unknown): { ok: true; items: NewsItem[] } | { ok: false; problems: string[] } {
  const problems: string[] = [];
  const f = raw as Partial<NewsWeekFile> | null;
  if (!f || typeof f !== "object") return { ok: false, problems: ["That isn't a news week file."] };
  const week = typeof f.week === "string" ? f.week : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(week) || new Date(`${week}T12:00:00Z`).getUTCDay() !== 1) problems.push(`week: "${week}" must be a Monday (YYYY-MM-DD)`);
  if (!Array.isArray(f.items) || f.items.length === 0) problems.push("items: add at least one item");
  const seen = new Set<string>();
  const items: NewsItem[] = [];
  for (const [i, it] of (Array.isArray(f.items) ? f.items : []).entries()) {
    const at = `item ${i + 1}${it?.id ? ` (${it.id})` : ""}`;
    if (!it || typeof it !== "object") { problems.push(`${at}: not an item`); continue; }
    if (!/^[a-z0-9-]{3,60}$/.test(it.id ?? "")) problems.push(`${at}: id must be 3 to 60 lowercase letters, numbers and dashes`);
    if (seen.has(it.id)) problems.push(`${at}: duplicate id`);
    seen.add(it.id);
    if (!["city", "column", "hunt", "transit"].includes(it.kind)) problems.push(`${at}: kind must be city, column, hunt or transit`);
    // C4: a transit update names its line and window; a delay is 10 to 30 seconds. Other kinds carry none of it.
    let transit: TransitInfo | undefined;
    if (it.kind === "transit") {
      if (!TRANSIT_LINES.includes(it.line ?? "")) problems.push(`${at}: line must be one of ${TRANSIT_LINES.join(", ")}`);
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(it.from ?? "")) problems.push(`${at}: from must be a New York time, "HH:MM"`);
      else if (!(Number.isInteger(it.hours) && it.hours! >= 1 && it.hours! <= 6 && minutesOf(it.from!) + it.hours! * 60 <= 24 * 60)) problems.push(`${at}: hours must be 1 to 6 and end by midnight`);
      if (it.delay !== undefined && !(Number.isInteger(it.delay) && it.delay >= 10 && it.delay <= 30)) problems.push(`${at}: delay must be 10 to 30 seconds`);
      transit = { line: it.line!, from: it.from!, hours: it.hours!, ...(it.delay !== undefined ? { delay: it.delay } : {}) };
    } else if (it.line !== undefined || it.delay !== undefined || it.from !== undefined || it.hours !== undefined) {
      problems.push(`${at}: line, from, hours and delay are for transit updates only`);
    }
    if (!DAYS.includes(it.day)) problems.push(`${at}: day must be one of ${DAYS.join(", ")}`);
    if (typeof it.headline !== "string" || it.headline.trim().length < 8 || it.headline.length > 110) problems.push(`${at}: headline must be 8 to 110 characters`);
    if (typeof it.body !== "string" || it.body.trim().length < 20 || it.body.length > 600) problems.push(`${at}: body must be 20 to 600 characters`);
    for (const c of it.cast ?? []) if (!CAST_IDS.has(c)) problems.push(`${at}: "${c}" isn't in the cast (docs/CAST.md)`);
    if (it.kind === "hunt" && it.day !== "Mon") problems.push(`${at}: hunt announcements run on Mondays`);
    if (problems.length === 0) items.push({ id: it.id, kind: it.kind, headline: it.headline.trim(), body: it.body.trim(), cast: it.cast ?? [], day: addDays(week, DAYS.indexOf(it.day)), ...(transit ? { transit } : {}) });
  }
  if (items.filter((x) => x.kind === "column").length > 1) problems.push("Lola's column runs once a week");
  if (items.length && week >= MAYOR_WEEKLY_FROM && !items.some((x) => x.kind === "city" && x.cast.includes(MAYOR_MAMA_MANDEE.id))) {
    problems.push(`${MAYOR_MAMA_MANDEE.name} is in the news every week: add a city item with "${MAYOR_MAMA_MANDEE.id}" in its cast`);
  }
  return problems.length ? { ok: false, problems } : { ok: true, items };
}

/** Newest first; this week's items are "today", older ones the archive. */
export function splitNews(items: NewsItem[], today: string): { recent: NewsItem[]; archive: NewsItem[] } {
  const cutoff = addDays(today, -6);
  const sorted = [...items].filter((i) => i.day <= today).sort((a, b) => b.day.localeCompare(a.day) || a.id.localeCompare(b.id));
  return { recent: sorted.filter((i) => i.day >= cutoff), archive: sorted.filter((i) => i.day < cutoff) };
}

/** What the regulars repeat: the latest city news, as gossip. */
export function newsGossip(items: NewsItem[], today: string, max = 2): string[] {
  return splitNews(items, today).recent.filter((i) => i.kind === "city").slice(0, max).map((i) => `Did you hear? ${i.headline}.`);
}

/** New York's date (YYYY-MM-DD) and minutes past midnight at `nowMs`. */
export function nyClock(nowMs: number): { day: string; minutes: number } {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(nowMs)).map((p) => [p.type, p.value]));
  return { day: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

/** C4: is this transit update running now (its day, within its window)? */
export function transitLive(item: Pick<NewsItem, "day" | "transit">, nowMs: number): boolean {
  if (!item.transit) return false;
  const { day, minutes } = nyClock(nowMs);
  const from = minutesOf(item.transit.from);
  return item.day === day && minutes >= from && minutes < from + item.transit.hours * 60;
}

/** C4: the delays running now, by line: the longest one's seconds and the item that posted it (the server adds the same). */
export function activeDelays(items: NewsItem[], nowMs: number): Record<string, { seconds: number; item: NewsItem }> {
  const out: Record<string, { seconds: number; item: NewsItem }> = {};
  for (const i of items) {
    if (i.kind !== "transit" || !i.transit?.delay || !transitLive(i, nowMs)) continue;
    if (!out[i.transit.line] || out[i.transit.line].seconds < i.transit.delay) out[i.transit.line] = { seconds: i.transit.delay, item: i };
  }
  return out;
}

/** "until 11 AM": when a transit update ends. */
export function transitUntil(t: TransitInfo): string {
  const end = minutesOf(t.from) + t.hours * 60;
  const h = Math.floor(end / 60) % 24;
  const m = end % 60;
  return `until ${h % 12 === 0 ? 12 : h % 12}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h < 12 ? "AM" : "PM"}`;
}
