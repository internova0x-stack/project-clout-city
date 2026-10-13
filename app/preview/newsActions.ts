"use server";

// Development previews only: City News from the first week file in content/news/, moved to
// the current week so the feed, ticker and home card look live. Nothing is saved.
import WEEK from "@/content/news/2026-10-12.json";
import { validateNewsWeek, type NewsItem } from "@/lib/news";

export async function previewNews(): Promise<NewsItem[]> {
  if (process.env.NODE_ENV === "production") return [];
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  const r = validateNewsWeek({ ...WEEK, week: d.toISOString().slice(0, 10) });
  return r.ok ? r.items : [];
}
