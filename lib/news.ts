// City News (v0.6, docs/08-new-features-spec.md section 3): light gossip about the invented
// cast, Lola's weekly dating column and the Monday hunt announcement. A week is written as one
// file in content/news/, uploaded and approved in the Story Studio, and published day by day.
// News never changes prices or places (only stories do). Dependency-free so tests can import it.

import { CELEBRITIES, REGULARS, WANNABES } from "./cast.ts";

export type NewsKind = "city" | "column" | "hunt";

/** One published item, as players get it from news_feed(). */
export interface NewsItem {
  id: string;
  kind: NewsKind;
  headline: string;
  body: string;
  cast: string[];
  /** Publish day, YYYY-MM-DD (New York). */
  day: string;
}

/** The week file the Studio uploads. Days are Mon to Sun of `week` (a Monday). */
export interface NewsWeekFile {
  week: string;
  items: { id: string; kind: NewsKind; day: "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun"; headline: string; body: string; cast?: string[] }[];
}

export const NEWS_KIND_LABEL: Record<NewsKind, string> = { city: "City news", column: "💌 Ask Lola", hunt: "🗺️ Treasure hunt" };
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const CAST_IDS = new Set([...CELEBRITIES, ...WANNABES, ...REGULARS].map((c) => c.id));

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
    if (!["city", "column", "hunt"].includes(it.kind)) problems.push(`${at}: kind must be city, column or hunt`);
    if (!DAYS.includes(it.day)) problems.push(`${at}: day must be one of ${DAYS.join(", ")}`);
    if (typeof it.headline !== "string" || it.headline.trim().length < 8 || it.headline.length > 110) problems.push(`${at}: headline must be 8 to 110 characters`);
    if (typeof it.body !== "string" || it.body.trim().length < 20 || it.body.length > 600) problems.push(`${at}: body must be 20 to 600 characters`);
    for (const c of it.cast ?? []) if (!CAST_IDS.has(c)) problems.push(`${at}: "${c}" isn't in the cast (docs/CAST.md)`);
    if (it.kind === "hunt" && it.day !== "Mon") problems.push(`${at}: hunt announcements run on Mondays`);
    if (problems.length === 0) items.push({ id: it.id, kind: it.kind, headline: it.headline.trim(), body: it.body.trim(), cast: it.cast ?? [], day: addDays(week, DAYS.indexOf(it.day)) });
  }
  if (items.filter((x) => x.kind === "column").length > 1) problems.push("Lola's column runs once a week");
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
