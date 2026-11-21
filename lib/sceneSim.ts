// Your Scene in the preview (/preview/home): migration 0171 in memory, on a fast clock (an hour passes in 30 seconds), with
// the simulated city's bank, Energy and clout. ?scene=new|busy|student|rich sets who the player is and what's running.
import { DEAL, SNEAK, bribeOf, canSneak, costFor, cutOf, fits, haterAt, haterChance, hatersFor, hypeOpen, hypesFor, needsOk, payout, publicistCost, slotsFor, sneakOdds, staleAfterH, teaCash, CREW_HYPE_CLOUT, SCENE, type SceneRow, type ScoreId } from "./scene.ts";
import { SCENE_HATERS, SCENE_HOST_LINES, SCENE_MOVES } from "./sceneContent.ts";
import { PLAQUES, RESIDENCY, TREND, daysFor, daysText, mondayOf, onDay, residencyPay, trendingFor, type SceneMove } from "./scene.ts";
// The preview plays the latest weekly moves file as this week (migration 0174 stores them in the game).
import WEEK_FILE from "../content/scene-weeks/2026-11-23.json";
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
  const thisWeek = mondayOf(new Date().toISOString().slice(0, 10));
  const catalog: SceneMove[] = [...SCENE_MOVES, ...(WEEK_FILE as unknown as { moves: SceneMove[] }).moves.map((m) => ({ ...m, week: thisWeek }))];
  const moveOf = (id: string) => catalog.find((m) => m.id === id);
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
  // The crew's moves that want a hype (step 2): two friends with something building.
  const crew = [
    { id: "crew-1", owner: "Mia", move: "night-out", place: "velvet-static", hypes: 0, need: 2, readyAt: iso(vnow() + 5 * H) },
    { id: "crew-2", owner: "Dev", move: "panel-speak", place: "triborough-works", hypes: 1, need: 2, readyAt: iso(vnow() + 3 * H) },
  ];
  let vouchFree = true;
  // Step 3: how often each move was collected (the rich player is near plaques and has a residency to take).
  const counts: Record<string, number> = rich ? { "brunch-be-seen": 9, "night-out": 12, "panel-speak": 4, "crab-breakfast": 3 } : preset === "busy" ? { "brunch-be-seen": 9 } : {};
  let residency: { move: string; until: number; paid: string | null } | null = null;
  const rank = () => (rich ? 6 : Math.max(rankFor(city.peek().clout, city.peek().cash).level, preset === "student" ? 2 : 1));
  const worth = () => (rich ? 2_400_000 : city.peek().cash);
  const add = (move: string, place: string, startedH: number, hypes: number) => {
    const m = moveOf(move)!;
    const st = vnow() - startedH * H;
    rows.push({ id: `sim-${++n}`, move, place, slot: rows.length + 1, startedAt: iso(st), readyAt: iso(st + m.hours * H),
      staleAt: iso(st + (m.hours + staleAfterH(m.hours)) * H), hypes: Array.from({ length: hypes }, (_, i) => iso(st + (i + 1) * 1.2 * H)), need: hypesFor(m.hours), entry: "invited" });
  };
  if (preset === "busy" || preset === "student" || rich) {
    add("brunch-be-seen", "grind-and-gossip", 2.1, 0);
    add(rich ? "rooftop-dinner" : "night-out", rich ? "ditmars-heights-rooftop" : "velvet-static", 3, 1);
    // Step 2: a hater has landed on the second move (a celebrity's shade for the rich, a petty rumour otherwise).
    const r2 = rows[1];
    r2.hater = rich ? "nassim-buyout" : "reservation"; r2.haterAt = iso(vnow() - 0.5 * H); r2.cut = rich ? 0.4 : 0.25;
    if (rich) collected.push({ move: "panel-speak", at: vnow() - 30 * H, score: "status", points: 160 }, { move: "night-out", at: vnow() - 50 * H, score: "nightlife", points: 120 });
  }
  const raw = (): SceneRaw => {
    const now = vnow();
    const scores: Partial<Record<ScoreId, number>> = {};
    for (const c of collected) scores[c.score] = (scores[c.score] ?? 0) + c.points;
    return {
      at: city.here(), rank: rank(), netWorth: worth(), bank: city.peek().cash, energy: 100, holding: false, today: new Date().toISOString().slice(0, 10),
      boroughs: ["queens"], skills: {}, moves: rows.slice(), rested: collected.filter((c) => now - c.at < SCENE.restDays * 24 * H).map((c) => c.move),
      bounced: [...bounced], scores, collected: collected.length, vouchers: ["sal"], vouchFree, crew: crew.slice(), counts: { ...counts },
      residency: residency ? { move: residency.move, until: iso(residency.until), paidToday: residency.paid === new Date().toISOString().slice(0, 10) } : null,
    };
  };
  const view = () => sceneView(catalog, SCENE_HATERS, raw(), memory, "preview", vnow(), SIM_SPEED, SCENE_HOST_LINES);
  const fail = (error: string) => ({ ok: false as const, error });
  return {
    async state() { return { ok: true, data: view() }; },
    async start(move, way) {
      const m = moveOf(move);
      const at = city.here();
      if (!m) return fail("That move isn't on any more.");
      if (!at || !m.places.includes(at)) return fail("You have to be there to do that.");
      const ctx = { rank: rank(), netWorth: worth(), memory, today: raw().today, open: openPlace(["queens"]) };
      if (!fits(m, ctx)) return fail("That one isn't for you right now.");
      if (!onDay(m, ctx.today)) { const d = daysFor(m, mondayOf(ctx.today)); return fail(`Not today. ${m.title} is on ${d ? daysText(d) : "another day"}.`); }
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
      const entry = needsOk(m, ctx) ? "invited" as const : "sneak" as const;
      const row: SceneRow = { id: `sim-${++n}`, move, place: at, slot: free, startedAt: iso(st), readyAt: iso(st + m.hours * H), staleAt: iso(st + (m.hours + staleAfterH(m.hours)) * H),
        hypes: [], need: hypesFor(m.hours), entry };
      if (Math.random() < haterChance(rank(), entry)) {
        const pool = hatersFor(SCENE_HATERS, rank());
        const h = pool[Math.floor(Math.random() * pool.length)];
        if (h) { row.hater = h.id; row.haterAt = iso(haterAt(st, st + m.hours * H, Math.random())); row.cut = h.cut; }
      }
      if (trendingFor(catalog, mondayOf(raw().today)).includes(move)) row.boost = TREND.boost;
      rows.push(row);
      rows.sort((a, b) => a.slot - b.slot);
      return { ok: true, data: { bounced: false, banHours: 0, view: view() } };
    },
    async deal(id, way) {
      const r = rows.find((x) => x.id === id);
      if (!r || !r.hater || !r.haterAt || vnow() < Date.parse(r.haterAt)) return fail("Nobody's coming for that one.");
      if (r.dealt) return fail("You already dealt with that.");
      if (way === "vouch") { if (!vouchFree) return fail("No regular can vouch for you this week."); vouchFree = false; }
      if (way === "publicist") { const c = publicistCost(rank()); if (city.peek().cash < c) return fail("Not enough in the bank."); city.choicePay({ cash: -c }); }
      if (way === "spill") city.choicePay({ cash: teaCash(rank()) });
      if (!DEAL.some((d) => d.id === way)) return fail("Something went wrong. Try again.");
      r.dealt = way;
      return { ok: true, data: view() };
    },
    async crewHype(id) {
      const i = crew.findIndex((c) => c.id === id);
      if (i < 0) return fail("You already hyped that one.");
      crew.splice(i, 1);
      city.huntReward(0, CREW_HYPE_CLOUT);
      return { ok: true, data: view() };
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
      const m = moveOf(r.move)!;
      const stale = vnow() >= Date.parse(r.staleAt);
      const base = payout(m.clout, r.need, r.hypes.length, stale, cutOf(r, vnow()));
      const p = { clout: Math.round(base.clout * (r.boost ?? 1)), points: Math.round(Math.round(base.clout * (r.boost ?? 1)) * SCENE.pointsPer) };
      counts[r.move] = (counts[r.move] ?? 0) + 1;
      const plaque = PLAQUES.find((x) => x.at === counts[r.move]) ?? null;
      rows.splice(i, 1);
      collected.push({ move: r.move, at: vnow(), score: m.score, points: p.points });
      city.huntReward(0, p.clout + (plaque?.clout ?? 0));
      return { ok: true, data: { clout: p.clout, points: p.points, score: m.score, stale, move: r.move, boost: r.boost ?? 1, count: counts[r.move],
        plaque: plaque ? { at: plaque.at, clout: plaque.clout } : null, view: view() } };
    },
    async residencyTake(move) {
      const m = moveOf(move);
      if (!m || (counts[move] ?? 0) < RESIDENCY.needs) return fail("Collect it ten times first.");
      if (residency && residency.until > vnow()) return fail("You've already got a residency going.");
      if (!m.places.includes(city.here() ?? "")) return fail("You have to be there to do that.");
      residency = { move, until: vnow() + RESIDENCY.days * 24 * H, paid: null };
      return { ok: true, data: view() };
    },
    async residencyCheckin() {
      if (!residency || residency.until <= vnow()) return fail("No residency right now.");
      const m = moveOf(residency.move)!;
      if (!m.places.includes(city.here() ?? "")) return fail("You have to be there to do that.");
      const today = new Date().toISOString().slice(0, 10);
      if (residency.paid === today) return fail("Already checked in today.");
      residency.paid = today;
      const c = residencyPay(m);
      city.huntReward(0, c);
      return { ok: true, data: { clout: c, view: view() } };
    },
  };
}
