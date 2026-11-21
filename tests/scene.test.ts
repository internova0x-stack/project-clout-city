import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PLACES } from "../lib/city.ts";
import { CHARACTERS } from "../lib/characters.ts";
import type { Memory } from "../lib/memory.ts";
import {
  SCENE, forYou, hypeOpen, moveProblems, needsOk, nextSlotRank, payout, sceneSettings, slotsFor, statusOf, titleFor,
  type SceneCtx, type SceneMove, type SceneRow,
} from "../lib/scene.ts";

const MOVES = (JSON.parse(readFileSync(new URL("../content/scene/moves.json", import.meta.url), "utf8")) as { moves: SceneMove[] }).moves;
const placeIds = new Set(PLACES.map((p) => p.id));
const storyOnly = new Set(PLACES.filter((p) => p.story).map((p) => p.id));
const queens = new Set(PLACES.filter((p) => !p.borough || p.borough === "queens").map((p) => p.id));

test("scene moves: the content is valid", () => {
  assert.deepEqual(moveProblems(MOVES, placeIds, new Set(CHARACTERS.map((c) => c.id))), []);
});

test("scene moves: never at a story-only place, and every move except the car auction can happen in Queens", () => {
  for (const m of MOVES) {
    for (const p of m.places) assert.ok(!storyOnly.has(p), `${m.id} at story place ${p}`);
    if (m.id !== "car-auction") assert.ok(m.places.some((p) => queens.has(p)), `${m.id} has no Queens place`);
  }
});

test("scene: slots grow with rank", () => {
  assert.equal(slotsFor(1), 2);
  assert.equal(slotsFor(3), 3);
  assert.equal(slotsFor(6), 4);
  assert.equal(slotsFor(10), 5);
  assert.equal(nextSlotRank(1), 3);
  assert.equal(nextSlotRank(7), null);
});

test("scene: payout takes a quarter per missed hype and pays a quarter when stale", () => {
  assert.deepEqual(payout(100, 2, 2, false), { clout: 100, points: 20 });
  assert.deepEqual(payout(100, 2, 1, false), { clout: 75, points: 15 });
  assert.deepEqual(payout(100, 3, 0, false), { clout: 25, points: 5 });
  assert.deepEqual(payout(100, 0, 0, true), { clout: 25, points: 5 });
});

test("scene: titles by points", () => {
  assert.equal(titleFor(0).tier, 0);
  assert.equal(titleFor(30).tier, 1);
  assert.equal(titleFor(30).title("style"), "Fit Checker");
  assert.equal(titleFor(900).next, null);
});

test("scene: a move's status and when it can be hyped", () => {
  const t0 = Date.parse("2026-11-21T10:00:00Z");
  const r: SceneRow = { id: "x", move: "night-out", place: "velvet-static", slot: 1, startedAt: new Date(t0).toISOString(),
    readyAt: new Date(t0 + 8 * 3600e3).toISOString(), staleAt: new Date(t0 + 16 * 3600e3).toISOString(), hypes: [], need: 2 };
  assert.equal(statusOf(r, t0 + 30 * 60e3), "building");
  assert.equal(hypeOpen(r, t0 + 30 * 60e3), false);
  assert.equal(statusOf(r, t0 + 2 * 3600e3), "hype");
  const hyped = { ...r, hypes: [new Date(t0 + 2 * 3600e3).toISOString()] };
  assert.equal(hypeOpen(hyped, t0 + 2.5 * 3600e3), false);
  assert.equal(hypeOpen(hyped, t0 + 3.5 * 3600e3), true);
  assert.equal(statusOf(r, t0 + 9 * 3600e3), "ready");
  assert.equal(hypeOpen(r, t0 + 9 * 3600e3), false);
  assert.equal(statusOf(r, t0 + 17 * 3600e3), "stale");
});

test("scene: needs are rank or net worth", () => {
  const fund = MOVES.find((m) => m.id === "fundraiser")!;
  assert.equal(needsOk(fund, { rank: 1, netWorth: 0 }), false);
  assert.equal(needsOk(fund, { rank: 4, netWorth: 0 }), true);
  assert.equal(needsOk(fund, { rank: 1, netWorth: 60_000 }), true);
});

const mem = (s: Partial<Memory["snapshot"]>, facts: Memory["facts"] = []): Memory => ({
  snapshot: { rank: 1, clout: 0, bank: 2000, meter: 50, band: "middle", home: "h", at: null, job: null, businesses: [], partner: null,
    campus: null, campaign: null, marks: [], crew: 0, skills: {}, conditions: [], ...s }, facts,
});
const ctx = (m: Memory, rank = m.snapshot.rank, netWorth = 0, today = "2026-11-21"): SceneCtx => ({ rank, netWorth, memory: m, today, open: (p) => queens.has(p) && !storyOnly.has(p) });
const none = { active: new Set<string>(), rested: new Set<string>() };

test("for you: four moves from different parts of life, at least one everyday", () => {
  const student = mem({ rank: 2, partner: "p1", campus: "st-johnsons", conditions: ["heatwave"] });
  const picks = forYou(MOVES, ctx(student), "maya", none);
  assert.equal(picks.length, SCENE.forYou);
  assert.ok(picks.some((m) => m.area === "everyday"));
  const areas = picks.filter((m) => m.area !== "everyday").map((m) => m.area);
  assert.equal(new Set(areas).size, areas.length);
  assert.ok(picks.some((m) => m.area === "dating"));
  assert.ok(picks.some((m) => m.area === "school"));
});

test("for you: it fits the player (a rich business owner gets business moves, a single player no couple moves)", () => {
  const dre = mem({ rank: 6, businesses: ["cafe"], job: { track: "tech", level: 4, workMood: 70 } });
  const picks = forYou(MOVES, ctx(dre, 6, 2_400_000), "dre", none);
  assert.ok(picks.some((m) => m.area === "business"));
  assert.ok(picks.some((m) => m.area === "work"));
  assert.ok(!picks.some((m) => m.id === "brunch-date"));
  for (const m of picks) assert.ok(needsOk(m, { rank: 6, netWorth: 2_400_000 }));
});

test("for you: never a running or resting move, and yesterday's only when nothing else fits", () => {
  const p = mem({ rank: 3 });
  const today = forYou(MOVES, ctx(p), "x", none);
  const skip = { active: new Set([today[0].id]), rested: new Set([today[1].id]) };
  const again = forYou(MOVES, ctx(p), "x", skip);
  assert.ok(!again.some((m) => skip.active.has(m.id) || skip.rested.has(m.id)));
  // Tomorrow brings different moves wherever there are others to pick (a single Rank 3 player has one dating and one
  // status move: those may come back).
  const tomorrow = forYou(MOVES, ctx(p, 3, 0, "2026-11-22"), "x", none);
  assert.ok(!tomorrow.some((m) => (m.area === "cast" || m.area === "everyday") && today.some((t) => t.id === m.id)));
});

test("scene settings: every move is there with its numbers", () => {
  const s = sceneSettings(MOVES);
  assert.equal(Object.keys(s.moves).length, MOVES.length);
  assert.equal(s.moves["night-out"].hours, 8);
  assert.equal(s.moves["brunch-date"].gated, true);
});

test("fake it till you make it: below a move's rank you can try to sneak in; invited players pay more as they rise", async () => {
  const { canSneak, costFor, sneakOdds, SNEAK, bribeOf } = await import("../lib/scene.ts");
  const show = MOVES.find((m) => m.id === "talk-show")!;
  assert.equal(canSneak(show, { rank: 2, netWorth: 0 }), true);
  assert.equal(canSneak(show, { rank: 5, netWorth: 0 }), false);
  assert.equal(canSneak(MOVES.find((m) => m.id === "night-out")!, { rank: 1, netWorth: 0 }), false);
  const dinner = MOVES.find((m) => m.id === "rooftop-dinner")!;
  assert.equal(costFor(dinner, 2), 200);
  assert.equal(costFor(dinner, 7), 300);
  const conf = SNEAK.find((w) => w.id === "confidence")!;
  assert.equal(sneakOdds(conf, {}), 0.4);
  assert.ok(Math.abs(sneakOdds(conf, { charisma: 4 }) - 0.6) < 1e-9);
  assert.equal(sneakOdds(conf, { charisma: 20 }), 0.95);
  assert.equal(bribeOf(0), 50);
  assert.equal(bribeOf(300), 150);
});

test("the newest migration carries the same settings as lib/scene.ts", () => {
  const sql = readFileSync(new URL("../supabase/migrations/0173_scene_plaques.sql", import.meta.url), "utf8");
  const m = /values \('scene', '(\{.*?\})'::jsonb\)/s.exec(sql);
  assert.ok(m, "settings row");
  assert.deepEqual(JSON.parse(m![1]), JSON.parse(JSON.stringify(sceneSettings(MOVES))));
});

// ---- Step 2: haters, rivals and pitfalls ----
const HATERS = (JSON.parse(readFileSync(new URL("../content/scene/haters.json", import.meta.url), "utf8")) as { haters: import("../lib/scene.ts").Hater[] }).haters;

test("haters: valid content, three or more at every rank, sharper with fame", async () => {
  const { hatersFor } = await import("../lib/scene.ts");
  const chars = new Set(CHARACTERS.map((c) => c.id));
  const ids = new Set<string>();
  for (const h of HATERS) {
    assert.match(h.id, /^[a-z0-9-]{2,40}$/);
    assert.ok(!ids.has(h.id), `repeated ${h.id}`); ids.add(h.id);
    assert.ok(h.cut >= 0.1 && h.cut <= 0.5, `${h.id} cut`);
    assert.ok(h.quote.length <= 90 && h.line.length <= 90, `${h.id} text`);
    if (h.who) assert.ok(chars.has(h.who), `${h.id} unknown ${h.who}`);
  }
  for (let r = 1; r <= 10; r++) assert.ok(hatersFor(HATERS, r).length >= 3, `rank ${r}`);
  const avg = (r: number) => { const p = hatersFor(HATERS, r); return p.reduce((n, h) => n + h.cut, 0) / p.length; };
  assert.ok(avg(8) > avg(1), "famous players face sharper pitfalls");
});

test("haters: more likely with fame and when you snuck in; their cut comes off the pay unless dealt with", async () => {
  const { haterChance, cutOf, payout, haterAt } = await import("../lib/scene.ts");
  assert.equal(haterChance(1), 0.15);
  assert.ok(haterChance(5) > haterChance(1));
  assert.equal(haterChance(20), 0.6);
  assert.ok(Math.abs(haterChance(1, "sneak") - 0.3) < 1e-9);
  const t = Date.parse("2026-11-21T10:00:00Z");
  assert.equal(haterAt(t, t + 4000, 0), t + 1000);
  assert.equal(haterAt(t, t + 4000, 1), t + 3000);
  const r: SceneRow = { id: "x", move: "night-out", place: "velvet-static", slot: 1, startedAt: "2026-11-21T10:00:00Z", readyAt: "2026-11-21T18:00:00Z",
    staleAt: "2026-11-22T02:00:00Z", hypes: [], need: 2, hater: "reservation", haterAt: "2026-11-21T12:00:00Z", cut: 0.25 };
  assert.equal(cutOf(r, Date.parse("2026-11-21T11:00:00Z")), 0, "not landed yet");
  assert.equal(cutOf(r, Date.parse("2026-11-21T13:00:00Z")), 0.25);
  assert.equal(cutOf({ ...r, dealt: "publicist" }, Date.parse("2026-11-21T13:00:00Z")), 0);
  assert.equal(cutOf({ ...r, dealt: "rise" }, Date.parse("2026-11-21T13:00:00Z")), 0.25, "rising above it keeps the cut");
  assert.deepEqual(payout(100, 2, 2, false, 0.25), { clout: 75, points: 15 });
});

// ---- Step 3: plaques, residencies, trending, the cast remembering you ----
test("plaques at 10, 25 and 50; the next one shown", async () => {
  const { plaqueOf } = await import("../lib/scene.ts");
  assert.deepEqual([plaqueOf(0).have, plaqueOf(0).next?.at], [null, 10]);
  assert.equal(plaqueOf(10).have?.name, "Regular");
  assert.equal(plaqueOf(30).have?.name, "Fixture");
  assert.equal(plaqueOf(30).next?.at, 50);
  assert.equal(plaqueOf(60).next, null);
});

test("trending: three moves anyone can do, the same for everyone all week, new the next", async () => {
  const { trendingFor, mondayOf } = await import("../lib/scene.ts");
  assert.equal(mondayOf("2026-11-21"), "2026-11-16");
  assert.equal(mondayOf("2026-11-16"), "2026-11-16");
  assert.equal(mondayOf("2026-11-22"), "2026-11-16");
  const a = trendingFor(MOVES, "2026-11-16"), b = trendingFor(MOVES, "2026-11-23");
  assert.equal(a.length, 3);
  for (const id of a) assert.ok(!MOVES.find((m) => m.id === id)!.when, `${id} is for everyone`);
  assert.notDeepEqual(a, b);
  assert.deepEqual(a, trendingFor(MOVES, "2026-11-16"));
});

test("hosts who remember you are real cast members with a line each; big moves have Blotter lines", () => {
  const hosts = (JSON.parse(readFileSync(new URL("../content/scene/hosts.json", import.meta.url), "utf8")) as { hosts: Record<string, string> }).hosts;
  const chars = new Set(CHARACTERS.map((c) => c.id));
  for (const [id, line] of Object.entries(hosts)) { assert.ok(chars.has(id), id); assert.ok(line.length <= 100, id); }
  for (const m of MOVES) if (m.host) assert.ok(hosts[m.host], `${m.host} needs a remembered line`);
  assert.ok(MOVES.filter((m) => m.headline).length >= 10);
});

test("the view: residency offered after a first plaque, the host remembers you after three", async () => {
  const { sceneView } = await import("../lib/sceneView.ts");
  const hosts = (JSON.parse(readFileSync(new URL("../content/scene/hosts.json", import.meta.url), "utf8")) as { hosts: Record<string, string> }).hosts;
  const raw = { at: "ditmars-heights-rooftop", rank: 4, netWorth: 0, bank: 5000, energy: 100, holding: false, today: "2026-11-21", boroughs: ["queens"],
    skills: {}, moves: [], rested: [], bounced: [], scores: {}, collected: 13, counts: { "night-out": 10, "crab-breakfast": 3 }, residency: null };
  const v = sceneView(MOVES, HATERS, raw, mem({ rank: 4 }), "p", Date.parse("2026-11-21T15:00:00Z"), 1, hosts);
  assert.deepEqual(v.residencyOffers.map((o) => o.move), ["night-out"]);
  const crab = v.here.find((o) => o.move === "crab-breakfast");
  assert.equal(crab?.knows, hosts["prince-nassim"]);
  assert.equal(v.plaques.find((p) => p.move === "night-out")?.have, "Regular");
});
