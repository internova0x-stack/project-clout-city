// Your Scene's screen data (lib/scene.ts rules): what the server (app/home/sceneActions.ts) and the preview's memory
// (lib/sceneSim.ts) send the game. Pure.

import { PLACES } from "./city.ts";
import { characterById } from "./characters.ts";
import type { Memory } from "./memory.ts";
import {
  SCENE, SCORES, canSneak, costFor, cutOf, fits, forYou, hypeOpen, needsOk, needsText, nextSlotRank, payout, publicistCost, slotsFor, statusOf,
  teaCash, titleFor, whyText, HOST_KNOWS, daysFor, daysText, isoDay, onDay, TREND, mondayOf, plaqueOf, residencyPay, trendingFor, RESIDENCY, type Area, type DealWay, type Hater, type MoveStatus, type SceneCtx, type SceneMove, type SceneRow, type ScoreId,
} from "./scene.ts";

/** What scene_context (migration 0171) returns. */
export interface SceneRaw {
  at: string | null;
  rank: number;
  netWorth: number;
  bank: number;
  energy: number;
  holding: boolean;
  today: string;
  boroughs: string[];
  skills: Record<string, number>;
  moves: SceneRow[];
  rested: string[];
  bounced: string[];
  scores: Partial<Record<ScoreId, number>>;
  collected: number;
  /** Step 2 (migration 0172): regulars at Friendly or better, whether this week's vouch is free, the crew's moves. */
  vouchers?: string[];
  vouchFree?: boolean;
  crew?: { id: string; owner: string; move: string; place: string; hypes: number; need: number; readyAt: string }[];
  /** Step 3 (migration 0173): how often each move was collected, and the residency. */
  counts?: Record<string, number>;
  residency?: { move: string; until: string; paidToday: boolean } | null;
}

/** A plaque earned, or the next one. */
export interface PlaqueLine { move: string; title: string; emoji: string; count: number; have: string | null; next: { at: number; name: string } | null }

/** A hater on a move, as the screen shows it. */
export interface HaterCard { id: string; emoji: string; quote: string; line: string; who?: Host; cut: number }
/** A crew member's move that wants your hype. */
export interface CrewCard { id: string; owner: string; title: string; emoji: string; placeName: string; hypes: number; need: number; readyAt: string }

export interface Host { id: string; name: string; portrait?: string }

/** A running move in a slot. */
export interface MoveCard {
  id: string;
  move: string;
  slot: number;
  title: string;
  emoji: string;
  place: string;
  placeName: string;
  host?: Host;
  status: MoveStatus;
  entry: "invited" | "sneak";
  hypes: number;
  need: number;
  startedAt: string;
  readyAt: string;
  staleAt: string;
  /** When the next hype opens (while building and one is wanted). */
  hypeAt: string | null;
  /** What collecting pays: on time (with the hypes done by then), and once stale. */
  pay: { clout: number; points: number };
  stalePay: { clout: number; points: number };
  /** Step 2: a hater that has landed, and how it was dealt with. */
  hater: HaterCard | null;
  dealt: DealWay | null;
  /** Step 3: trending pays more; how often you've collected it and the next plaque. */
  boost: number;
  count: number;
  nextPlaque: { at: number; name: string } | null;
  score: ScoreId;
}

/** A move the player could start: in For you today or at the place they're in. */
export interface Offer {
  move: string;
  title: string;
  emoji: string;
  area: Area;
  why: string;
  line: string;
  places: { id: string; name: string }[];
  hours: number;
  cost: number;
  energy: number;
  clout: number;
  score: ScoreId;
  host?: Host;
  /** "Rank 4" when the player is short of it: they can only try to get in. */
  short: string | null;
  running: boolean;
  bounced: boolean;
  /** Step 3: trending this week (pays ×1.5), and the host's line once they know you. */
  trending: boolean;
  knows: string | null;
  /** The cast's week: "Sun & Wed" for a hosted move (null when it's on every day); this week's own moves. */
  days: string | null;
  weekly: boolean;
}

/** This week on the scene: who hosts what, on which days. */
export interface CastDay { day: number; label: string; today: boolean; items: { move: string; title: string; emoji: string; host?: Host }[] }

export interface ScoreView { id: ScoreId; label: string; emoji: string; points: number; title: string; next: number | null; nextTitle: string | null }

export interface SceneView {
  at: string | null;
  rank: number;
  slots: number;
  nextSlotRank: number | null;
  moves: MoveCard[];
  forYou: Offer[];
  here: Offer[];
  scores: ScoreView[];
  collected: number;
  /** The clock the view was made at, and how fast it runs (1 in the game; the preview runs hours in seconds). The screen
   *  counts down from these: its now = now + (Date.now() − when it arrived) × speed. */
  now: number;
  speed: number;
  /** Dealing with a hater: the regular who'd vouch this week (null when none or used), the publicist's price, the tea's pay. */
  deal: { vouch: Host | null; publicist: number; tea: number };
  crew: CrewCard[];
  /** Step 3: plaques earned or in reach, the residency running (or the moves that can take one). */
  plaques: PlaqueLine[];
  residency: { move: string; title: string; emoji: string; places: { id: string; name: string }[]; until: string; paidToday: boolean; pay: number } | null;
  residencyOffers: { move: string; title: string; emoji: string; places: { id: string; name: string }[]; pay: number }[];
  castWeek: CastDay[];
}

const placeName = (id: string) => PLACES.find((p) => p.id === id)?.name ?? id;
const hostOf = (id?: string): Host | undefined => {
  if (!id) return undefined;
  const c = characterById(id);
  return c ? { id, name: c.name, portrait: c.portrait } : undefined;
};

export type SceneR<T> = { ok: true; data: T } | { ok: false; error: string };
export interface StartResult { bounced: boolean; banHours: number; view: SceneView }
export interface CollectResult {
  clout: number; points: number; score: ScoreId; stale: boolean; move: string; view: SceneView;
  /** Step 3: trending's boost, how often collected now, and a plaque earned with it. */
  boost?: number; count?: number; plaque?: { at: number; clout: number } | null;
}
/** What the game calls (app/home/sceneActions.ts in the game, lib/sceneSim.ts in the preview). */
export interface SceneApi {
  state(): Promise<SceneR<SceneView>>;
  deal(id: string, way: DealWay): Promise<SceneR<SceneView>>;
  residencyTake(move: string): Promise<SceneR<SceneView>>;
  residencyCheckin(): Promise<SceneR<{ clout: number; view: SceneView }>>;
  crewHype(id: string): Promise<SceneR<SceneView>>;
  start(move: string, way?: "confidence" | "namedrop" | "bribe"): Promise<SceneR<StartResult>>;
  hype(id: string): Promise<SceneR<SceneView>>;
  collect(id: string): Promise<SceneR<CollectResult>>;
}

export function openPlace(boroughs: string[]): (id: string) => boolean {
  const open = new Set(boroughs);
  return (id) => {
    const p = PLACES.find((x) => x.id === id);
    return !!p && !p.story && open.has(p.borough ?? "queens");
  };
}

export function sceneView(moves: SceneMove[], haters: Hater[], raw: SceneRaw, memory: Memory | null, player: string, now: number, speed = 1,
  hostLines: Record<string, string> = {}): SceneView {
  const byId = new Map(moves.map((m) => [m.id, m]));
  const counts = raw.counts ?? {};
  const trending = new Set(trendingFor(moves, mondayOf(raw.today)));
  // A host knows you after a few of their moves.
  const hosted: Record<string, number> = {};
  for (const m of moves) if (m.host) hosted[m.host] = (hosted[m.host] ?? 0) + (counts[m.id] ?? 0);
  const haterOf = (r: SceneRow): HaterCard | null => {
    const h = r.hater && r.haterAt && now >= Date.parse(r.haterAt) ? haters.find((x) => x.id === r.hater) : undefined;
    return h ? { id: h.id, emoji: h.emoji, quote: h.quote, line: h.line, who: hostOf(h.who), cut: r.cut ?? h.cut } : null;
  };
  const open = openPlace(raw.boroughs);
  const ctx: SceneCtx = { rank: raw.rank, netWorth: raw.netWorth, memory, today: raw.today, open };
  const running = new Set(raw.moves.map((r) => r.move));
  const bounced = new Set(raw.bounced);

  const cards: MoveCard[] = raw.moves.flatMap((r) => {
    const m = byId.get(r.move);
    if (!m) return [];
    const status = statusOf(r, now);
    const last = r.hypes.length ? Date.parse(r.hypes[r.hypes.length - 1]) : Date.parse(r.startedAt);
    const hypeAt = r.hypes.length < r.need && now < Date.parse(r.readyAt) && !hypeOpen(r, now)
      ? new Date(last + SCENE.hypeGapMin * 60_000).toISOString() : null;
    return [{
      id: r.id, move: r.move, slot: r.slot, title: m.title, emoji: m.emoji, place: r.place, placeName: placeName(r.place), host: hostOf(m.host),
      status, entry: r.entry ?? "invited", hypes: r.hypes.length, need: r.need,
      startedAt: r.startedAt, readyAt: r.readyAt, staleAt: r.staleAt, hypeAt,
      pay: payout(m.clout, r.need, status === "ready" || status === "stale" ? r.hypes.length : r.need, false, cutOf(r, now)),
      stalePay: payout(m.clout, r.need, r.hypes.length, true, cutOf(r, now)), score: m.score,
      hater: haterOf(r), dealt: r.dealt ?? null,
      boost: r.boost ?? 1, count: counts[r.move] ?? 0, nextPlaque: ((p) => (p ? { at: p.at, name: p.name } : null))(plaqueOf(counts[r.move] ?? 0).next),
    }];
  });

  const offer = (m: SceneMove): Offer => ({
    move: m.id, title: m.title, emoji: m.emoji, area: m.area, why: whyText(m, ctx), line: m.line,
    places: m.places.filter(open).map((id) => ({ id, name: placeName(id) })),
    hours: m.hours, cost: costFor(m, raw.rank), energy: m.energy, clout: m.clout, score: m.score, host: hostOf(m.host),
    short: needsOk(m, ctx) ? null : needsText(m), running: running.has(m.id), bounced: bounced.has(m.id),
    trending: trending.has(m.id), knows: m.host && (hosted[m.host] ?? 0) >= HOST_KNOWS ? hostLines[m.host] ?? null : null,
    days: ((d) => (d ? daysText(d) : null))(daysFor(m, mondayOf(raw.today))), weekly: !!m.week,
  });

  const picks = forYou(moves, ctx, player, { active: running, rested: new Set(raw.rested) }).map(offer);
  const here = raw.at && open(raw.at)
    ? moves.filter((m) => m.places.includes(raw.at!) && fits(m, ctx) && onDay(m, raw.today) && (needsOk(m, ctx) || canSneak(m, ctx))).map(offer)
      .sort((a, b) => Number(!!a.short) - Number(!!b.short) || a.hours - b.hours)
    : [];

  const scores = SCORES.map((s) => {
    const pts = raw.scores[s.id] ?? 0;
    const t = titleFor(pts);
    return { id: s.id, label: s.label, emoji: s.emoji, points: pts, title: t.title(s.id), next: t.next, nextTitle: t.next !== null ? s.titles[t.tier + 1] : null };
  });

  return { at: raw.at, rank: raw.rank, slots: slotsFor(raw.rank), nextSlotRank: nextSlotRank(raw.rank), moves: cards, forYou: picks, here, scores, collected: raw.collected, now, speed,
    deal: { vouch: raw.vouchFree && raw.vouchers?.length ? hostOf(raw.vouchers[0]) ?? null : null, publicist: publicistCost(raw.rank), tea: teaCash(raw.rank) },
    plaques: Object.entries(counts).flatMap(([id, n]) => {
      const m = byId.get(id);
      if (!m) return [];
      const p = plaqueOf(n);
      return [{ move: id, title: m.title, emoji: m.emoji, count: n, have: p.have?.name ?? null, next: p.next ? { at: p.next.at, name: p.next.name } : null }];
    }).sort((a, b) => b.count - a.count).slice(0, 6),
    residency: ((r) => {
      const m = r && byId.get(r.move);
      return r && m ? { move: m.id, title: m.title, emoji: m.emoji, places: m.places.filter(open).map((id) => ({ id, name: placeName(id) })), until: r.until, paidToday: r.paidToday, pay: residencyPay(m) } : null;
    })(raw.residency && Date.parse(raw.residency.until) > now ? raw.residency : null),
    residencyOffers: raw.residency && Date.parse(raw.residency.until) > now ? [] : Object.entries(counts).flatMap(([id, n]) => {
      const m = byId.get(id);
      return m && n >= RESIDENCY.needs ? [{ move: id, title: m.title, emoji: m.emoji, places: m.places.filter(open).map((pid) => ({ id: pid, name: placeName(pid) })), pay: residencyPay(m) }] : [];
    }),
    castWeek: ((monday) => {
      const today = isoDay(raw.today);
      const days: CastDay[] = [1, 2, 3, 4, 5, 6, 7].map((d) => ({ day: d, label: ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][d], today: d === today, items: [] }));
      for (const m of moves) {
        const ds = m.host || m.week ? daysFor(m, monday) : null;
        if (!ds || !m.places.some(open)) continue;
        for (const d of ds) days[d - 1].items.push({ move: m.id, title: m.title, emoji: m.emoji, host: hostOf(m.host) });
      }
      return days;
    })(mondayOf(raw.today)),
    crew: (raw.crew ?? []).flatMap((c) => {
      const m = byId.get(c.move);
      return m ? [{ id: c.id, owner: c.owner, title: m.title, emoji: m.emoji, placeName: placeName(c.place), hypes: c.hypes, need: c.need, readyAt: c.readyAt }] : [];
    }),
  };
}
