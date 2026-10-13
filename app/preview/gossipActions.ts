"use server";

// Development previews only: the first gossip week from content/gossip/, moved to the current week,
// with progress in memory on the dev server (so unfound pieces never reach the browser, as in the
// game). The preview trusts the place it's told (the city sim keeps the location in the browser).
import FILE from "@/content/gossip/2026-10-19.json";
import { CITY_ECONOMY, PLACES } from "@/lib/city";
import { regularAt } from "@/lib/cast";
import { cityMinutes } from "@/lib/cityClock";
import { GAME_CONFIG } from "@/lib/config";
import { inWindow, type GossipFind, type GossipResult, type GossipState, type GossipWeek } from "@/lib/gossip";

const off = () => process.env.NODE_ENV === "production";
const thisMonday = () => {
  const d = new Date(new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" }) + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
};
const week = (): GossipWeek => ({ ...(FILE as unknown as GossipWeek), week: thisMonday() });
const addDays = (iso: string, n: number) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

const mem = { found: new Map<string, "overheard" | "regular" | "crew">(), shared: new Set<string>(), cards: new Map<string, string>(), preset: "" };
const key = (s: string, n: number) => `${s}:${n}`;

/** ?gossip=new (nothing found), some (two stories started), almost (one piece short), done (one finished). */
export async function previewGossipReset(preset = "some") {
  if (off() || mem.preset === preset) return;
  mem.preset = preset;
  mem.found.clear(); mem.shared.clear(); mem.cards.clear();
  const [a, b] = week().stories;
  if (preset === "some" || preset === "almost" || preset === "done") {
    mem.found.set(key(a.id, 0), "regular"); mem.found.set(key(a.id, 2), "overheard");
    [0, 1, 2, 3].forEach((n) => mem.found.set(key(b.id, n), n === 2 ? "crew" : "overheard"));
    mem.shared.add(key(a.id, 2));
  }
  if (preset === "almost" || preset === "done") [1, 3].forEach((n) => mem.found.set(key(a.id, n), "overheard"));
  if (preset === "done") { mem.found.set(key(a.id, 4), "overheard"); finish(a.id); }
}

function finish(storyId: string): boolean {
  const s = week().stories.find((x) => x.id === storyId);
  if (!s || mem.cards.has(storyId) || !s.pieces.every((_, n) => mem.found.has(key(storyId, n)))) return false;
  mem.cards.set(storyId, new Date().toISOString());
  return true;
}

export async function previewGossipState(): Promise<GossipState | null> {
  if (off()) return null;
  const w = week();
  return {
    stories: w.stories.map((s) => ({
      id: s.id, week: w.week, endsOn: addDays(w.week, CITY_ECONOMY.gossip.liveDays - 1), title: s.title, topic: s.topic, emoji: s.emoji, teaser: s.teaser,
      done: mem.cards.has(s.id),
      pieces: s.pieces.map((p, n) => {
        const via = mem.found.get(key(s.id, n));
        if (via) return { n, found: true as const, text: p.text, place: p.place, source: p.source, via, shared: mem.shared.has(key(s.id, n)) };
        const pl = PLACES.find((x) => x.id === p.place);
        return { n, found: false as const, source: p.source, hours: p.hours ?? null, place: n === 0 ? p.place : null, kind: pl?.tags[0] ?? null, area: pl?.neighborhood ?? null };
      }),
    })),
    cards: w.stories.filter((s) => mem.cards.has(s.id)).map((s) => ({
      storyId: s.id, week: w.week, title: s.title, emoji: s.emoji, topic: s.topic, headline: s.tea.headline, body: s.tea.body, earnedAt: mem.cards.get(s.id)!,
    })),
  };
}

export async function previewGossipFind(placeId: string, via: "overheard" | "regular"): Promise<GossipResult<GossipFind>> {
  if (off()) return { ok: false, error: "Previews are off in production." };
  if (via === "regular" && !regularAt(placeId)) return { ok: true, data: { found: [], later: null, finished: [] } };
  const hour = Math.floor(cityMinutes(Date.now(), GAME_CONFIG.cityClock) / 60);
  const out: GossipFind = { found: [], later: null, finished: [] };
  for (const s of week().stories) {
    s.pieces.forEach((p, n) => {
      if (p.place !== placeId || p.source !== via || mem.found.has(key(s.id, n))) return;
      if (!inWindow(p.hours, hour)) { out.later ??= p.hours ?? null; return; }
      mem.found.set(key(s.id, n), via);
      out.found.push({ story: s.id, title: s.title, piece: n, text: p.text, count: s.pieces.filter((_, i) => mem.found.has(key(s.id, i))).length });
    });
  }
  for (const id of new Set(out.found.map((f) => f.story))) if (finish(id)) out.finished.push(id);
  return { ok: true, data: out };
}

export async function previewGossipShare(storyId: string, piece: number): Promise<GossipResult<number>> {
  if (off()) return { ok: false, error: "Previews are off in production." };
  if (!mem.found.has(key(storyId, piece))) return { ok: false, error: "You can only share what you've heard." };
  if (mem.shared.has(key(storyId, piece))) return { ok: false, error: "Already shared with your crew. They know." };
  mem.shared.add(key(storyId, piece));
  return { ok: true, data: 3 };
}
