import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { RACE, ACTIVITIES, addDays, choose, nextMonday, raceView, refresh, reply, setSlot, startRace, tierOf, type Activity, type RaceContent, type RaceState } from "../lib/schoolRace.ts";

const content = JSON.parse(readFileSync(new URL("../content/school/race.json", import.meta.url), "utf8")) as RaceContent;
const START = "2026-11-09"; // a Monday
const seq = (seed: number) => { let x = seed; return () => { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648; }; };

/** Plays a whole semester with one weekly plan and a rule for every card. */
function semester(plan: Activity[][], pickOpt: (card: string, opts: string[]) => string, seed = 1, crown: "king" | "queen" = "king"): RaceState {
  const rng = seq(seed);
  const s = startRace(content, { id: "r", campus: "st-johnsons", crown, startOn: START, job: true, dating: true });
  s.plan = plan.map((d) => [...d]);
  for (let day = 0; day <= 7 * RACE.weeks + 1 && s.phase === "running"; day++) {
    const today = addDays(START, day);
    for (let guard = 0; guard < 6; guard++) {
      refresh(content, s, today, rng);
      if (!s.pending.length) break;
      const card = content.cards.find((c) => c.id === s.pending[0])!;
      choose(content, s, card.id, pickOpt(card.id, card.options.map((o) => o.id)), rng);
    }
    for (const m of s.inbox.filter((x) => x.status === "new")) {
      const msg = content.inbox.find((x) => x.id === m.id)!;
      if (msg.options.length) reply(content, s, m.id, pickOpt(m.id, msg.options.map((o) => o.id)), rng);
    }
    s.plan = plan.map((d) => [...d]);
  }
  return s;
}

const BALANCED: Activity[][] = [["class", "hang"], ["class", "party"], ["class", "study"], ["class", "sleep"], ["class", "hang"], ["work", "party"], ["sleep", "study"]];
const PARTY: Activity[][] = [["class", "party"], ["hang", "party"], ["class", "party"], ["hang", "party"], ["class", "party"], ["party", "party"], ["hang", "party"]];
const GRIND: Activity[][] = [["class", "study"], ["class", "study"], ["class", "study"], ["class", "study"], ["class", "sleep"], ["study", "study"], ["sleep", "study"]];

test("the content is complete: every card and message names real people, cliques and follow-ups", () => {
  const ids = new Set(content.cards.map((c) => c.id));
  for (const c of content.cards) for (const o of c.options) {
    assert.ok(o.label && o.get && o.cost, `${c.id}/${o.id} shows label, get and cost`);
    if (o.later) assert.ok(ids.has(o.later.card), `${c.id}/${o.id} comes back as a real card`);
    for (const k of Object.keys(o.effects.standing ?? {})) assert.ok(content.cliques.some((q) => q.id === k), k);
  }
  for (const m of content.inbox) assert.ok(m.from === "rival" || [...content.squad, ...content.people].some((p) => p.id === m.from), m.from);
  assert.ok(content.rivals.some((r) => r.crown === "king") && content.rivals.some((r) => r.crown === "queen"));
  assert.equal(ACTIVITIES.length, 8);
});

test("a semester ends on Homecoming Saturday of week 4 with a result", () => {
  const s = semester(BALANCED, (_, o) => o[o.length - 1]);
  assert.equal(s.phase, "over");
  assert.ok(s.result);
  assert.equal(s.verdicts.length, RACE.weeks - 0 >= 4 ? s.verdicts.length : 0);
  assert.ok(s.verdicts.length >= 3, "a Friday verdict every week before Homecoming");
});

test("the balancing act: partying every night wins Rep and loses the ballot; grinding keeps the ballot and stays a Nobody", () => {
  const party = semester(PARTY, (_, o) => o[0], 3);
  const grind = semester(GRIND, (_, o) => o[o.length - 1], 3);
  assert.ok(party.rep > grind.rep, `party Rep ${party.rep} > grind ${grind.rep}`);
  assert.ok(grind.gpa > party.gpa, `grind GPA ${grind.gpa} > party ${party.gpa}`);
  assert.ok(party.gpa < RACE.eligibleGpa, `partying every night drops under the line (${party.gpa})`);
  assert.equal(party.result?.ending, "ineligible");
  assert.notEqual(grind.result?.ending, "crown", "studying alone doesn't win a popularity contest");
});

test("a balanced semester can win, sometimes", () => {
  let wins = 0, ineligible = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const s = semester(BALANCED, (_, o) => o[Math.floor(seq(seed)() * o.length)], seed);
    if (s.result?.ending === "crown" || s.result?.ending === "dirty") wins++;
    if (s.result?.ending === "ineligible") ineligible++;
  }
  assert.ok(wins >= 40 && wins <= 170, `balanced wins ${wins}/200`);
  assert.ok(ineligible < 100, `balanced is mostly eligible (${ineligible} out)`);
});

test("using the leaked answers usually comes back and takes you off the ballot", () => {
  let out = 0;
  for (let seed = 1; seed <= 50; seed++) {
    const s = semester(BALANCED, (card, o) => (card === "leak" ? "use" : o[o.length - 1]), seed);
    if (!s.eligible) out++;
  }
  assert.ok(out >= 25, `the leak caught ${out}/50`);
});

test("the planner refuses past days, Homecoming and what you can't do", () => {
  const s = startRace(content, { id: "x", campus: "st-johnsons", crown: "queen", startOn: START, job: false, dating: false });
  assert.equal(s.rival, "marisol");
  assert.throws(() => setSlot(s, addDays(START, 2), 0, 0, "party", { club: true, date: true, work: true }), /past/);
  assert.throws(() => setSlot(s, START, 3, 1, "date", { club: true, date: false, work: true }), /needs_date/);
  setSlot(s, START, 3, 1, "hang", { club: true, date: true, work: true });
  assert.equal(s.plan[3][1], "hang");
  assert.ok(!s.plan.flat().includes("work"), "no job, no work shifts in the starting plan");
});

test("the view hides the hidden parts and names the rival", () => {
  const s = semester(BALANCED, (_, o) => o[0], 2, "queen");
  const v = raceView(content, s, addDays(START, 30));
  const json = JSON.stringify(v);
  assert.ok(!json.includes("chance") && !json.includes("\"dean\"") && !json.includes("traces"), "no odds, Dean heat or traces");
  assert.ok(!json.includes("{rival}") && !json.includes("{Rival}"));
  assert.equal(v.rival.name, "Marisol Vega");
});

test("tiers follow the crown's own words", () => {
  assert.equal(tierOf(97, "queen"), "Queen Bee");
  assert.equal(tierOf(97, "king"), "Big Man on Campus");
  assert.equal(tierOf(85, "queen"), "It Girl");
  assert.equal(tierOf(5, "king"), "Nobody");
  assert.equal(nextMonday("2026-11-04"), "2026-11-09");
  assert.equal(nextMonday("2026-11-09"), "2026-11-09");
});

test("a new week starts on its Monday: the view and that week's mail arrive that day", () => {
  const s = startRace(content, { id: "mon", campus: "st-johnsons", crown: "queen", startOn: START, job: true, dating: true });
  const monday = addDays(START, 7);
  for (let i = 0; i < 20; i++) {
    refresh(content, s, monday, () => 0.5);
    if (!s.pending.length) break;
    choose(content, s, s.pending[0], content.cards.find((c) => c.id === s.pending[0])!.options[0].id, () => 0.5);
  }
  assert.equal(s.playedTo, monday);
  assert.equal(raceView(content, s, monday).week, 2);
  for (const m of content.inbox.filter((x) => x.week === 2)) assert.ok(s.inbox.some((x) => x.id === m.id), m.id);
});
