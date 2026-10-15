"use server";

import { previewOnly } from "./guard";

// Development previews only: City News from the first week file in content/news/, moved to
// the current week so the feed, ticker and home card look live. Nothing is saved.
import WEEK from "@/content/news/2026-10-12.json";
import { validateNewsWeek, type NewsItem } from "@/lib/news";

export async function previewNews(): Promise<NewsItem[]> {
  previewOnly();
  if (process.env.NODE_ENV === "production") return [];
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  const r = validateNewsWeek({ ...WEEK, week: d.toISOString().slice(0, 10) });
  return r.ok ? r.items : [];
}

// ---- The Studio's News tab in preview (in memory, nothing is saved) ----
import type { Admin, NewsAdminItem } from "@/lib/studio";

let admin: NewsAdminItem[] | null = null;
const off = () => process.env.NODE_ENV === "production";
async function seed() {
  if (!admin) admin = (await previewNews()).map((i, n) => ({ ...i, status: n < 3 ? "approved" : "review" }));
  return admin;
}
export async function previewNewsList(): Promise<Admin<NewsAdminItem[]>> {
  previewOnly();
  if (off()) return { ok: false, error: "Previews are off in production." };
  return { ok: true, data: [...(await seed())].sort((a, b) => b.day.localeCompare(a.day) || a.id.localeCompare(b.id)) };
}
export async function previewNewsUpload(json: string): Promise<Admin<number> & { problems?: string[] }> {
  previewOnly();
  if (off()) return { ok: false, error: "Previews are off in production." };
  let raw: unknown;
  try { raw = JSON.parse(json); } catch { return { ok: false, error: "That isn't valid JSON." }; }
  const r = validateNewsWeek(raw);
  if (!r.ok) return { ok: false, error: "The week didn't pass its checks.", problems: r.problems };
  const list = await seed();
  for (const it of r.items) {
    const i = list.findIndex((x) => x.id === it.id);
    const row: NewsAdminItem = { ...it, status: "review" };
    if (i >= 0) list[i] = row; else list.push(row);
  }
  return { ok: true, data: r.items.length };
}
export async function previewNewsStatus(id: string, status: NewsAdminItem["status"]): Promise<Admin<null>> {
  previewOnly();
  if (off()) return { ok: false, error: "Previews are off in production." };
  admin = (await seed()).map((x) => (x.id === id ? { ...x, status } : x));
  return { ok: true, data: null };
}
export async function previewNewsReschedule(id: string, day: string): Promise<Admin<null>> {
  previewOnly();
  if (off()) return { ok: false, error: "Previews are off in production." };
  admin = (await seed()).map((x) => (x.id === id ? { ...x, day } : x));
  return { ok: true, data: null };
}
