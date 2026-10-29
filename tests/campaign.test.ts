import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CAMPAIGN, buildContent, citywide, endReward, skimRoom, type CampaignContent, type CampaignState, type CandidateId, type Payout } from "../lib/campaign.ts";
import { CampaignError, campaignView, choose, debateRound, dilemma, endWeek, nextDay, refresh, reply, setBudget, setSlot, startCampaign, type Rng } from "../lib/campaignEngine.ts";

// Campaign Mode (docs/CAMPAIGN-MODE.md): the content holds together, and thousands of simulated campaigns run start
// to finish without breaking a rule (caps, one week a day, nothing hidden leaking into the player's view).

const read = (f: string) => JSON.parse(readFileSync(new URL(`../content/campaign/${f}.json`, import.meta.url), "utf8"));
const content: CampaignContent = buildContent({
  candidates: read("candidates"), city: read("city"), inbox: read("inbox"), situations: read("situations"), debate: read("debate"), lines: read("lines"),
});
const IDS: CandidateId[] = ["goldcrest", "castellano", "kowalczyk", "starr"];

function rng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test("the content holds together", () => {
  assert.deepEqual(content.candidates.map((c) => c.id).sort(), [...IDS].sort());
  const places = new Set(content.places.map((p) => p.id));
  const people = new Set(content.stakeholders.map((s) => s.id));
  assert.ok(Math.abs(content.places.reduce((n, p) => n + p.weight, 0) - 1) < 0.001, "place weights add up to 1");
  assert.deepEqual(content.staff.map((s) => s.id).sort(), ["comms", "deputy", "field", "pollster"]);
  for (const c of content.candidates) {
    assert.deepEqual(Object.keys(c.places).sort(), [...places].sort(), c.id);
    for (const s of [...c.warm, ...c.cold]) assert.ok(people.has(s), `${c.id}: ${s}`);
    assert.equal(c.issues.length, 4, c.id);
    assert.ok(c.offScript.lines.length >= 2, c.id);
    assert.ok(content.debate.questions.some((q) => q.by === "mayor" && q.topic === c.id), `${c.id}: the Mayor's question`);
    assert.ok(content.situations.filter((s) => s.candidate === c.id).length >= 2, `${c.id}: two cards of their own`);
    if (c.refuses.length) assert.ok(c.refuseLine, c.id);
  }
  for (const t of ["exposure", "poach", "lawsuit"]) assert.ok(content.situations.some((s) => s.trigger === t), t);
  assert.ok(content.stakeholders.filter((s) => s.mayorAlly).length >= 2, "Poach Ally needs targets");
  const previews: { id: string; get: string; cost: string; risk: string; why: string }[] = [];
  for (const s of content.situations) {
    assert.ok(s.choices.length >= 2 && s.choices.length <= 4, s.id);
    assert.ok(s.weeks[0] >= 1 && s.weeks[1] <= CAMPAIGN.weeks, s.id);
    previews.push(...s.choices.map((c) => ({ ...c, id: `${s.id}.${c.id}` })));
  }
  for (const m of content.inbox) {
    assert.ok(m.from === "anon" || people.has(m.from), m.id);
    assert.ok(m.week >= 1 && m.week <= CAMPAIGN.weeks, m.id);
    for (const o of m.options) {
      if (o.where) assert.ok(places.has(o.where), `${m.id}.${o.id}`);
      if (o.effects.place) assert.ok(o.where, `${m.id}.${o.id}: a place effect needs where`);
      previews.push({ ...o, id: `${m.id}.${o.id}` });
    }
  }
  // Every option explains itself (spec section 6.2): You get, It costs, Risk with a reason.
  for (const p of previews) {
    assert.ok(p.get && p.cost && p.why, p.id);
    assert.ok(["low", "medium", "high"].includes(p.risk), p.id);
  }
});

type Style = "clean" | "dirty";

/** Plays one campaign the way a player of that style might. */
function play(candidate: CandidateId, style: Style, seed: number) {
  const r = rng(seed);
  const state = startCampaign(content, { id: `c${seed}`, candidate, clout: 150, crew: 2, home: "astoria", seed: 500, wonBefore: false }, r);
  let day = "2026-11-02";
  const payouts: Payout[] = [];
  for (let guard = 0; guard < 20 && state.phase !== "over"; guard++) {
    refresh(state, day);
    if (state.phase === "waiting") { day = nextDay(day); continue; }
    // Inbox: clean players skip dirty and shadow options; dirty players take them.
    for (const m of state.inbox.filter((x) => x.status === "new")) {
      const msg = content.inbox.find((x) => x.id === m.id)!;
      const opt = style === "dirty" ? msg.options[0] : msg.options.find((o) => !o.dirty && o.meeting !== "shadow" && !o.trace) ?? msg.options[msg.options.length - 1];
      try { reply(content, state, msg.id, opt.id, r); } catch (e) { if (!(e instanceof CampaignError)) throw e; }
    }
    const v = campaignView(content, state, day);
    if (v.dilemmas.charity) payouts.push(...dilemma(content, state, "charity", style === "clean" ? "anon" : "none").payouts);
    if (v.dilemmas.skim !== null) payouts.push(...dilemma(content, state, "skim", style === "dirty" ? "lot" : "leave").payouts);
    // The calendar: rallies and tours where it's weakest, money, debate prep before week 3, GOTV in week 4.
    const weak = Object.entries(state.places).sort((a, b) => (a[1].you - a[1].mayor) - (b[1].you - b[1].mayor)).map(([id]) => id);
    const free = () => state.slots.findIndex((s) => s === null);
    const put = (a: Parameters<typeof setSlot>[3]) => { const i = free(); if (i >= 0) try { setSlot(content, state, i, a); } catch (e) { if (!(e instanceof CampaignError)) throw e; } };
    if (style === "dirty") {
      put({ kind: "op", op: "fake_news", target: weak[0], cutout: false, persuaded: true });
      if (state.week >= 2) put({ kind: "op", op: "poach_ally", target: content.stakeholders.find((s) => s.mayorAlly && (state.trust[s.id] ?? 0) < 1)!.id, cutout: false, persuaded: true });
    }
    if (state.week === CAMPAIGN.weeks) for (const p of weak.slice(0, 3)) put({ kind: "gotv", place: p });
    if (state.week === 2 || state.week === 3) { put({ kind: "prep", topic: "weak" }); put({ kind: "prep", topic: "rent" }); }
    put({ kind: "rally", place: weak[0] });
    put({ kind: "rally", place: weak[1] });
    put({ kind: "tour", place: weak[2] });
    put({ kind: "donors" });
    put({ kind: "donors" });
    put({ kind: "rest" });
    const room = state.cash - 0;
    const spend = Math.floor(room * 0.6);
    setBudget(state, { digital: Math.floor(spend / 3), street: Math.floor(spend / 3), tv: Math.floor(spend / 3) });
    if (state.week === CAMPAIGN.debateWeek) {
      for (let i = 0; i < 4 && !state.debate?.done; i++) {
        const q = campaignView(content, state, day).debate!.questions[state.debate?.round ?? 0] ?? "";
        debateRound(content, state, q.startsWith("Papa-Dani") ? "deflect" : state.intel > 0 ? "attack" : "facts", r);
      }
    }
    payouts.push(...endWeek(content, state, day, r).payouts);
    while (state.phase === "deciding") {
      const p = state.pending[0];
      const card = content.situations.find((s) => s.id === p.id)!;
      payouts.push(...choose(content, state, p.id, (style === "dirty" ? card.choices[0] : card.choices[card.choices.length - 1]).id, day, r).payouts);
    }
    day = nextDay(day);
  }
  return { state, payouts, day };
}

test("thousands of campaigns run start to finish inside the rules", () => {
  for (const id of IDS) for (const style of ["clean", "dirty"] as Style[]) for (let seed = 1; seed <= 150; seed++) {
    const { state, payouts } = play(id, style, seed * 7 + id.length);
    assert.equal(state.phase, "over", `${id} ${style} ${seed}`);
    assert.ok(state.ending, `${id} ${style} ${seed}: an ending`);
    assert.ok(state.week === CAMPAIGN.weeks);
    for (const p of Object.values(state.places)) {
      assert.ok(p.you >= 0 && p.mayor >= 0 && p.you + p.mayor <= 95.05, `${id} ${seed}: ratings in range`);
    }
    assert.ok(state.cash >= 0);
    const skim = payouts.filter((p) => p.kind === "campaign_skim").reduce((n, p) => n + p.amount, 0);
    assert.ok(skim <= CAMPAIGN.skimCap && skim <= Math.floor(state.raised * CAMPAIGN.skimShare) + 1, `${id} ${seed}: skim capped`);
    for (const p of payouts.filter((x) => x.kind === "campaign_poll")) assert.ok(p.amount > 0 && p.amount <= CAMPAIGN.reward.pollWeekCap);
    const refs = payouts.map((p) => `${p.kind}:${p.ref}`);
    assert.equal(new Set(refs).size, refs.length, "every payout is once (ledger kind, ref)");
    assert.ok(state.exposures <= CAMPAIGN.exposuresPerCampaign);
    assert.equal(payouts.filter((p) => p.kind === "campaign_reward").length, 1);
  }
});

test("win rates are in a playable range (tuning check)", () => {
  const rates: string[] = []; // clean ~45-65% wins, dirty ~55-80% (Oct 29 tuning)
  const out: { label: string; wins: number; clean: number; style: Style }[] = [];
  for (const id of IDS) for (const style of ["clean", "dirty"] as Style[]) {
    let wins = 0, clean = 0;
    const n = 200;
    for (let seed = 1; seed <= n; seed++) {
      const { state } = play(id, style, 1000 + seed);
      if (state.ending !== "loss") wins++;
      if (state.ending === "clean_win") clean++;
    }
    rates.push(`${id} ${style}: ${Math.round((wins / n) * 100)}% wins, ${Math.round((clean / n) * 100)}% clean`);
    out.push({ label: rates[rates.length - 1], wins: wins / n, clean: clean / n, style });
  }
  for (const o of out) {
    // A sensible strategy can win, and nothing wins every time.
    assert.ok(o.wins >= 0.15 && o.wins <= 0.95, o.label);
    if (o.style === "dirty") assert.ok(o.clean < 0.2, `${o.label}: dirty play rarely ends clean`);
  }
});

test("End Week once per New York day; results arrive the next morning", () => {
  const r = rng(5);
  const s = startCampaign(content, { id: "x", candidate: "starr", clout: 0, crew: 0, home: null, seed: 0, wonBefore: false }, r);
  endWeek(content, s, "2026-11-02", r);
  while (s.phase === "deciding") choose(content, s, s.pending[0].id, content.situations.find((x) => x.id === s.pending[0].id)!.choices[0].id, "2026-11-02", r);
  assert.equal(s.phase, "waiting");
  const v = campaignView(content, s, "2026-11-02");
  assert.equal(v.phase, "waiting");
  assert.equal(v.recap, null, "no results before the morning");
  assert.throws(() => setBudget(s, { digital: 0, street: 0, tv: 0 }), /not_planning/);
  assert.equal(refresh(s, "2026-11-03"), true);
  assert.equal(campaignView(content, s, "2026-11-03").recap?.week, 1);
  assert.equal(s.week, 2);
});

test("the player's view never carries the hidden odds", () => {
  const { state, day } = play("goldcrest", "dirty", 42);
  const v = JSON.stringify(campaignView(content, state, day));
  assert.ok(!/"traces"|"factChecks"|"queue"|"fail"|"trace":/.test(v), "no traces, fact-checks, queued trouble or fail odds");
  const mid = startCampaign(content, { id: "m", candidate: "goldcrest", clout: 10, crew: 0, home: null, seed: 0, wonBefore: false }, rng(3));
  mid.week = 2;
  endWeek(content, mid, "2026-11-02", rng(4));
  const pending = campaignView(content, mid, "2026-11-02").pending;
  for (const p of pending) for (const c of p.situation.choices) {
    assert.equal(c.receipt, "");
    assert.equal(c.fail, undefined);
    assert.deepEqual(c.effects, {});
  }
});

test("candidates have a will of their own", () => {
  const s = startCampaign(content, { id: "c", candidate: "castellano", clout: 0, crew: 0, home: null, seed: 0, wonBefore: false }, rng(1));
  s.favors = 2;
  assert.throws(() => setSlot(content, s, 0, { kind: "op", op: "fake_news", target: "astoria", cutout: false }), /refused/);
  setSlot(content, s, 0, { kind: "op", op: "fake_news", target: "astoria", cutout: false, persuaded: true });
  assert.equal(s.favors, 1, "paid when booked");
  setSlot(content, s, 0, null);
  assert.equal(s.favors, 2, "refunded when cleared");
});

test("money rules: the seed cap, the skim room, the end reward", () => {
  assert.throws(() => startCampaign(content, { id: "s", candidate: "starr", clout: 0, crew: 0, home: null, seed: CAMPAIGN.seedMax + 1, wonBefore: false }, rng(1)), /bad_seed/);
  assert.equal(skimRoom({ raised: 100000, skimmed: 0 }), CAMPAIGN.skimCap);
  assert.equal(skimRoom({ raised: 8000, skimmed: 300 }), 500);
  assert.equal(endReward("clean_win", 0, false), 400);
  assert.equal(endReward("dirty_win", 0, true), 150);
  assert.equal(endReward("loss", 100, false), 95);
  const s = { places: { a: { you: 30, mayor: 40 }, b: { you: 50, mayor: 30 } } } as unknown as CampaignState;
  assert.deepEqual(citywide(s, [{ id: "a", name: "A", weight: 0.5, cares: "", mayor: 0 }, { id: "b", name: "B", weight: 0.5, cares: "", mayor: 0 }]), { you: 40, mayor: 35 });
});
