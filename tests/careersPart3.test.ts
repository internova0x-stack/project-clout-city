// Careers part 3 (owner, Oct 31: "build the 'mentioned in the spec, but not built' section"): the six new office moves, the
// big boss, pushing the boss out, the new hire who has your back, and the quit card (with "quit to run your business").
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CAREER, TRACKS, addDays, answerTask, careerView, hire, office, pushoutReady, quit, quitCardDue, startDay, stickItOut,
  type CareerContent, type CareerCtx, type CareerState,
} from "../lib/careers.ts";
import { OFFICE_FACT, FACTS } from "../lib/memory.ts";
import { OFFICE } from "../lib/careers.ts";

const content: CareerContent = JSON.parse(readFileSync(new URL("../content/careers/careers.json", import.meta.url), "utf8"));
const DAY = "2026-11-02";
const ctx = (o: Partial<CareerCtx> = {}): CareerCtx => ({
  clout: 0, crew: 0, energy: 100, atPlace: "grind-and-gossip", shiftsToday: 0, skills: { charisma: 6, cooking: 5 }, past: {}, ...o,
});
function clockedIn(day = DAY): CareerState {
  const s = hire("p3", "hospitality", ctx(), "honest", day);
  startDay(content, s, "steady", ctx(), day, () => 0.5);
  return s;
}
const finishDay = (s: CareerState) => {
  for (let i = 0; i < s.today!.tasks.length; i++) answerTask(content, s, i, content.tasks.find((t) => t.id === s.today!.tasks[i].id)!.options[0].id, ctx(), () => 0.5);
};

test("every track has a big boss, a new hire and a successor; every move has a memory fact", () => {
  for (const t of TRACKS) assert.ok(t.bigBoss.name && t.newHire.name && t.successor.name && t.successor.name !== t.manager.name, t.id);
  for (const o of OFFICE) assert.ok(FACTS[OFFICE_FACT[o.id]], o.id);
});

test("cover a mistake: their trust, and the boss sometimes finds out", () => {
  const ok = clockedIn();
  const r = office(ok, "cover", "friend", ctx(), DAY, () => 0.9);
  assert.ok(ok.trust.friend > 60 && r.integrity > 0);
  const found = clockedIn();
  const r2 = office(found, "cover", "friend", ctx(), DAY, () => 0.01);
  assert.ok(found.trust.manager < 55 && r2.integrity < 0);
});

test("back the boss: the boss likes it, the coworkers don't", () => {
  const s = clockedIn();
  office(s, "back", "manager", ctx(), DAY, () => 0.5);
  assert.ok(s.trust.manager > 55 && s.trust.friend < 50 && s.trust.rival < 45);
  assert.throws(() => office(clockedIn(), "back", "friend", ctx(), DAY, () => 0.5), /bad_target/);
});

test("mentor the new hire three times and they warn you off the next payback", () => {
  let s = clockedIn();
  let day = DAY;
  for (let i = 0; i < 3; i++) {
    const r = office(s, "mentor", "hire", ctx(), day, () => 0.5);
    assert.equal(r.effects.energy, -CAREER.office.mentorEnergy);
    finishDay(s);
    day = addDays(day, 1);
    startDay(content, s, "steady", ctx(), day, () => 0.5);
  }
  assert.equal(s.ally, true);
  s.grudges = [{ who: "rival", level: 2, due: day }];
  finishDay(s);
  assert.ok(s.today!.summary.some((l) => /Wren tipped you off/.test(l)), s.today!.summary.join(" | "));
  assert.equal(s.ally, false);
  assert.equal(s.grudges![0].level, 1);
  s = clockedIn();
  assert.throws(() => office(s, "mentor", "hire", ctx({ energy: 5 }), DAY, () => 0.5), /no_energy/);
});

test("undermine: quiet pays, traced costs trust and a grudge", () => {
  const quiet = clockedIn();
  office(quiet, "undermine", "rival", ctx(), DAY, () => 0.99);
  assert.ok(quiet.performance > 50 && (quiet.grudges ?? []).length === 0 && quiet.trust.rival === 45);
  const caught = clockedIn();
  office(caught, "undermine", "rival", ctx(), DAY, () => 0.01);
  assert.equal(caught.exposed, 1);
  assert.equal(caught.grudges![0].who, "rival");
});

test("go over the boss's head: the big boss may like it; the boss always finds out", () => {
  const won = clockedIn();
  office(won, "overhead", "manager", ctx(), DAY, () => 0.01);
  assert.ok(won.bigBoss! > 50 && won.trust.manager < 55 && won.grudges![0].who === "manager");
  const lost = clockedIn();
  office(lost, "overhead", "manager", ctx(), DAY, () => 0.99);
  assert.ok(lost.bigBoss! < 50 && lost.trust.manager <= 30 && lost.grudges![0].level === 2);
});

test("push the boss out: only when ready, once a job; success swaps the boss and promotes, failure is a warning", () => {
  const s = clockedIn();
  assert.equal(pushoutReady(s), false);
  assert.throws(() => office(s, "pushout", "manager", ctx(), DAY, () => 0.01), /not_ready/);
  s.bigBoss = 70; s.performance = 75;
  assert.equal(careerView(content, s, DAY, ctx()).pushout, "ready");
  const won = structuredClone(s);
  const r = office(won, "pushout", "manager", ctx(), DAY, () => 0.01);
  assert.equal(won.ousted, true);
  assert.equal(won.level, 2, "promoted");
  assert.ok(r.payouts?.some((p) => p.kind === "career_promo"));
  assert.match(r.headline!, /\{name\}/);
  assert.ok(Math.abs(r.integrity) <= 12);
  const v = careerView(content, won, DAY, ctx());
  assert.equal(v.people.manager.name, "Theo Marangos");
  assert.equal(v.pushout, "done");
  const lost = structuredClone(s);
  const r2 = office(lost, "pushout", "manager", ctx(), DAY, () => 0.99);
  assert.ok(!lost.ousted && lost.warnings === 1 && lost.grudges![0].level === 3 && lost.coup);
  assert.ok(Math.abs(r2.integrity) <= 12);
});

test("the quit card: under 30 work mood; stick it out rests it a week; quit to run your business needs one", () => {
  const s = clockedIn();
  assert.equal(quitCardDue(s, DAY), false);
  s.workMood = 20;
  assert.equal(careerView(content, s, DAY, ctx()).quitCard, true);
  stickItOut(s, DAY);
  assert.equal(quitCardDue(s, addDays(DAY, 3)), false);
  s.workMood = 20;
  assert.equal(quitCardDue(s, addDays(DAY, 7)), true);
  assert.throws(() => quit(structuredClone(s), DAY, { reason: "business", businesses: 0 }), /no_business/);
  const biz = structuredClone(s);
  const r = quit(biz, DAY, { reason: "business", businesses: 2 });
  assert.equal(biz.status, "quit");
  assert.equal(r.effects.mood, 8);
  assert.match(biz.log[0].text, /run your businesses/);
  const plain = structuredClone(s);
  assert.equal(quit(plain, DAY).effects.mood, 5, "quitting a job you dread lifts your mood");
});

test("friends for life: the work friend's trust reaches 85 and never falls under 60; they cover a missed day", async () => {
  const { befriend } = await import("../lib/careers.ts");
  const s = clockedIn();
  s.trust.friend = 80;
  const r = office(s, "share", "friend", ctx(), DAY, () => 0.5);
  assert.equal(s.lifer, true);
  assert.match(r.receipt, /friends for life/);
  s.trust.friend = 20;
  befriend(s);
  assert.equal(s.trust.friend, 60);
  assert.equal(careerView(content, s, DAY, ctx()).lifer, true);
  // Four workdays of five: a friend for life covers the fifth.
  const a = structuredClone(s); a.worked = ["a", "b", "c", "d"]; a.performance = 60;
  const b = structuredClone(a); b.lifer = false;
  const { refresh } = await import("../lib/careers.ts");
  refresh(a, a.nextReview, ctx(), () => 0.5);
  refresh(b, b.nextReview, ctx(), () => 0.5);
  assert.ok(a.performance > b.performance, `${a.performance} vs ${b.performance}`);
});

test("a career is campaign background: Hospitality's staff mood, Tech's fundraising, Media's points", async () => {
  const { startCampaign } = await import("../lib/campaignEngine.ts");
  const { buildContent } = await import("../lib/campaign.ts");
  const read = (f: string) => JSON.parse(readFileSync(new URL(`../content/campaign/${f}.json`, import.meta.url), "utf8"));
  const CAMPAIGN_CONTENT = buildContent({ candidates: read("candidates"), city: read("city"), inbox: read("inbox"), situations: read("situations"), debate: read("debate"), lines: read("lines"), tasks: read("tasks") });
  const base = { id: "c", candidate: CAMPAIGN_CONTENT.candidates[0].id, clout: 0, crew: 0, home: null, seed: 0, wonBefore: false };
  const rng = () => 0.5;
  const none = startCampaign(CAMPAIGN_CONTENT, base, rng);
  const hosp = startCampaign(CAMPAIGN_CONTENT, { ...base, career: { track: "hospitality", level: 2 } }, rng);
  const tech = startCampaign(CAMPAIGN_CONTENT, { ...base, career: { track: "tech", level: 2 } }, rng);
  const media = startCampaign(CAMPAIGN_CONTENT, { ...base, career: { track: "media", level: 2 } }, rng);
  assert.ok(hosp.staff.every((x, i) => x.morale === none.staff[i].morale + 10));
  assert.ok(Math.abs(tech.links.fundMult - none.links.fundMult * 1.2) < 1e-9);
  const p = Object.keys(none.places)[0];
  assert.ok(media.places[p].you > none.places[p].you);
  assert.ok(media.receipts.some((l) => /Clout TV/.test(l)));
  assert.equal(none.receipts.length, 0);
});
