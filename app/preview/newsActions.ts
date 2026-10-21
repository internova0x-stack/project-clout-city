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
  if (!r.ok) return [];
  // C4: a Metro Rail Authority delay on the 7, live from the top of this hour for three hours, and a weekend change.
  const hour = Math.min(20, Number(new Date().toLocaleString("en-US", { timeZone: "America/New_York", hour: "2-digit", hourCycle: "h23" })));
  const from = `${String(hour).padStart(2, "0")}:00`;
  return [
    ...r.items,
    { id: "preview-7-delay", kind: "transit", day: today, cast: [], headline: "7 train delays: a signal problem at Queensboro Plaza", body: "Expect delays on the 7 in both directions while crews fix a signal. The MRA thanks you for your patience, which it has never once deserved.", transit: { line: "7", from, hours: 3, delay: 25 } },
    { id: "preview-nw-weekend", kind: "transit", day: today, cast: [], headline: "N/W weekend: trains run local, all of them, forever", body: "This weekend the N and W make every stop between Astoria and the city. Bring a snack and a podcast with many episodes.", transit: { line: "N/W", from: "00:00", hours: 6 } },
  ];
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
