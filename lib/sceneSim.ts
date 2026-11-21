// Your Scene in the preview (/preview/home): migration 0171 in memory, on a fast clock (an hour passes in 30 seconds), with
// the simulated city's bank, Energy and clout. ?scene=new|busy|student|rich sets who the player is and what's running.
import { SNEAK, bribeOf, canSneak, costFor, fits, hypeOpen, hypesFor, needsOk, payout, slotsFor, sneakOdds, staleAfterH, SCENE, type SceneRow, type ScoreId } from "./scene.ts";
import { SCENE_MOVES, sceneMove } from "./sceneContent.ts";
import { openPlace, sceneView, type SceneApi, type SceneRaw } from "./sceneView.ts";
import { rankFor } from "./ranks.ts";
import type { Memory } from "./memory.ts";

export const SIM_SPEED = 120;
const H = 3_600_000;

interface SimCity { here(): string | null; peek(): { cash: number; clout: number }; choicePay(e: { cash?: number; clout?: number; energy?: number }): void; huntReward(cash: number, clout: number): void }

const snapshot = (s: Partial<Memory["snapshot"]>): Memory => ({
  snapshot: { rank: 1, clout: 0, bank: 2000, meter: 50, band: "middle", home: "astoria_studio", at: null, job: null, businesses: [], partner: null,
    campus: null, campaign: null, marks: [], crew: 0, skills: {}, conditions: [], ...s }, facts: [],
});

export function createSceneSim(city: SimCity, preset: string | null): SceneApi {
  const t0 = Date.now();
  const vnow = () => t0 + (Date.now() - t0) * SIM_SPEED;
  const iso = (t: number) => new Date(t).toISOString();
  const rich = preset === "rich";
  const memory = preset === "student" ? snapshot({ partner: "p-jaylen", campus: "st-johnsons", conditions: ["heatwave"] })
    : rich ? snapshot({ businesses: ["cafe"], job: { track: "tech", level: 4, workMood: 70 }, band: "halo" })
    : snapshot({});
  const rows: SceneRow[] = [];
  const collected: { move: string; at: number; score: ScoreId; points: number }[] = [];
  const bounced = new Set<string>();
  let n = 0;
  const rank = () => (rich ? 6 : Math.max(rankFor(city.peek().clout, city.peek().cash).level, preset === "student" ? 2 : 1));
  const worth = () => (rich ? 2_400_000 : city.peek().cash);
  const add = (move: string, place: string, startedH: number, hypes: number) => {
    const m = sceneMove(move)!;
    const st = vnow() - startedH * H;
    rows.push({ id: `sim-${++n}`, move, place, slot: rows.length + 1, startedAt: iso(st), readyAt: iso(st + m.hours * H),
      staleAt: iso(st + (m.hours + staleAfterH(m.hours)) * H), hypes: Array.from({ length: hypes }, (_, i) => iso(st + (i + 1) * 1.2 * H)), need: hypesFor(m.hours), entry: "invited" });
  };
  if (preset === "busy" || preset === "student" || rich) {
    add("brunch-be-seen", "grind-and-gossip", 2.1, 0);
    add(rich ? "rooftop-dinner" : "night-out", rich ? "ditmars-heights-rooftop" : "velvet-static", 3, 1);
    if (rich) collected.push({ move: "panel-speak", at: vnow() - 30 * H, score: "status", points: 160 }, { move: "night-out", at: vnow() - 50 * H, score: "nightlife", points: 120 });
  }
  const raw = (): SceneRaw => {
    const now = vnow();
    const scores: Partial<Record<ScoreId, number>> = {};
    for (const c of collected) scores[c.score] = (scores[c.score] ?? 0) + c.points;
    return {
      at: city.here(), rank: rank(), netWorth: worth(), bank: city.peek().cash, energy: 100, holding: false, today: new Date().toISOString().slice(0, 10),
      boroughs: ["queens"], skills: {}, moves: rows.slice(), rested: collected.filter((c) => now - c.at < SCENE.restDays * 24 * H).map((c) => c.move),
      bounced: [...bounced], scores, collected: collected.length,
    };
  };
  const view = () => sceneView(SCENE_MOVES, raw(), memory, "preview", vnow(), SIM_SPEED);
  const fail = (error: string) => ({ ok: false as const, error });
  return {
    async state() { return { ok: true, data: view() }; },
    async start(move, way) {
      const m = sceneMove(move);
      const at = city.here();
      if (!m) return fail("That move isn't on any more.");
      if (!at || !m.places.includes(at)) return fail("You have to be there to do that.");
      const ctx = { rank: rank(), netWorth: worth(), memory, today: raw().today, open: openPlace(["queens"]) };
      if (!fits(m, ctx)) return fail("That one isn't for you right now.");
      if (rows.some((r) => r.move === move)) return fail("You've already got that one going.");
      if (bounced.has(move)) return fail("They know your face tonight. Try again tomorrow.");
      const free = Array.from({ length: slotsFor(rank()) }, (_, i) => i + 1).find((s) => !rows.some((r) => r.slot === s));
      if (!free) return fail("Every slot is busy. Collect a move first.");
      let cost = costFor(m, rank());
      if (!needsOk(m, ctx)) {
        const s = SNEAK.find((x) => x.id === way);
        if (!s || !canSneak(m, ctx)) return fail("You're not on the list for that one yet.");
        const extra = s.extra ? bribeOf(cost) : 0;
        if (Math.random() >= sneakOdds(s, {})) {
          bounced.add(move);
          city.choicePay({ cash: -extra, energy: -m.energy });
          return { ok: true, data: { bounced: true, banHours: s.banHours, view: view() } };
        }
        cost = m.cost + extra;
      }
      if (city.peek().cash < cost) return fail("Not enough in the bank.");
      city.choicePay({ cash: -cost, energy: -m.energy });
      const st = vnow();
      rows.push({ id: `sim-${++n}`, move, place: at, slot: free, startedAt: iso(st), readyAt: iso(st + m.hours * H), staleAt: iso(st + (m.hours + staleAfterH(m.hours)) * H),
        hypes: [], need: hypesFor(m.hours), entry: needsOk(m, ctx) ? "invited" : "sneak" });
      rows.sort((a, b) => a.slot - b.slot);
      return { ok: true, data: { bounced: false, banHours: 0, view: view() } };
    },
    async hype(id) {
      const r = rows.find((x) => x.id === id);
      if (!r) return fail("That move's gone.");
      if (city.here() !== r.place) return fail("You have to be there to do that.");
      if (!hypeOpen(r, vnow())) return fail("You just hyped it. Give it an hour.");
      r.hypes.push(iso(vnow()));
      return { ok: true, data: view() };
    },
    async collect(id) {
      const i = rows.findIndex((x) => x.id === id);
      const r = rows[i];
      if (!r) return fail("That move's gone.");
      if (vnow() < Date.parse(r.readyAt)) return fail("It's not ready yet.");
      const m = sceneMove(r.move)!;
      const stale = vnow() >= Date.parse(r.staleAt);
      const p = payout(m.clout, r.need, r.hypes.length, stale);
      rows.splice(i, 1);
      collected.push({ move: r.move, at: vnow(), score: m.score, points: p.points });
      city.huntReward(0, p.clout);
      return { ok: true, data: { clout: p.clout, points: p.points, score: m.score, stale, move: r.move, view: view() } };
    },
  };
}
