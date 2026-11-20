import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CHAPTERS, STEPS, chapterDone, chapterDue, chapterSteps, guideSettings, nextStep } from "../lib/guide.ts";

const sql = readFileSync(new URL("../supabase/migrations/0170_guide.sql", import.meta.url), "utf8");

test("lib/guide.ts mirrors game_settings 'guide' in migration 0170", () => {
  const m = sql.match(/values \('guide', '(\{.*?\})'::jsonb\)/s);
  assert.ok(m, "the settings row");
  assert.deepEqual(JSON.parse(m![1]), JSON.parse(JSON.stringify(guideSettings())));
});

test("every step is well formed", () => {
  const ids = new Set<string>();
  for (const s of STEPS) {
    assert.ok(!ids.has(s.id), `${s.id} repeats`);
    ids.add(s.id);
    assert.ok(CHAPTERS.some((c) => c.n === s.chapter && c.live), `${s.id}: its chapter is live`);
    assert.ok(s.cards.length >= 2 && s.cards.length <= 3, `${s.id}: two or three cards`);
    assert.ok(s.tip.length <= 60 && s.hint.length <= 70, `${s.id}: short tip and hint`);
    assert.ok((s.reward.cash ?? 0) + (s.reward.clout ?? 0) > 0, `${s.id}: pays something`);
    assert.ok((s.reward.cash ?? 0) <= 200 && (s.reward.clout ?? 0) <= 60, `${s.id}: small rewards (C$50-200, 15-60 clout)`);
    for (const c of s.cards) assert.ok(c.t.length <= 60 && c.b.length <= 180, `${s.id}: card "${c.t}" fits`);
  }
  assert.equal(chapterSteps(1).length, 13, "Chapter 1 has 13 steps (the clout basics merged in, owner Nov 20)");
});

test("the next step is the first unpaid one in an open chapter", () => {
  const base = { paid: [] as string[], ready: [] as string[], chapters: [] as number[], day: 1, rank: 1 };
  assert.equal(nextStep(base)?.id, "1.1");
  assert.equal(nextStep({ ...base, paid: ["1.1", "1.2"] })?.id, "1.3");
  const all = chapterSteps(1).map((s) => s.id);
  assert.equal(nextStep({ ...base, paid: all })?.id, "2.1", "Chapter 2 follows");
  const both = [...all, ...chapterSteps(2).map((s) => s.id)];
  assert.equal(nextStep({ ...base, paid: both })?.id, "9.1", "on day 1, Choices (which opens on day 1) comes before Money");
  assert.equal(nextStep({ ...base, paid: both, day: 2 })?.id, "3.1");
  const ch3 = chapterSteps(3).map((s) => s.id);
  const early = [...both, ...ch3.filter((id) => id !== "3.10" && id !== "3.11")];
  assert.equal(nextStep({ ...base, paid: early, day: 2 })?.id, "4.1", "businesses and the Jobs board wait for Rank 2; Chapter 4 comes next");
  assert.equal(nextStep({ ...base, paid: early, day: 2, rank: 2 })?.id, "3.10");
  assert.equal(chapterDue({ ...base, paid: all })?.n, 1);
  assert.equal(chapterDue({ ...base, paid: all, chapters: [1] }), null);
});

test("optional steps can be skipped and don't hold a chapter back; Big plays needs any three", () => {
  const base = { paid: [] as string[], ready: [] as string[], chapters: [] as number[], day: 30, rank: 3 };
  const ch8 = CHAPTERS.find((c) => c.n === 8)!;
  assert.ok(chapterDone(ch8, ["8.1", "8.2", "8.3"]), "the dating steps are optional");
  const before8 = STEPS.filter((s) => s.chapter < 8).map((s) => s.id);
  assert.equal(nextStep({ ...base, paid: [...before8, "8.1", "8.2", "8.3"] })?.id, "8.4", "optional steps are still suggested");
  assert.equal(nextStep({ ...base, paid: [...before8, "8.1", "8.2", "8.3"], skipped: ["8.4", "8.5", "8.6", "8.7", "8.8", "8.9"] })?.id, "9.1", "until skipped");
  const ch10 = CHAPTERS.find((c) => c.n === 10)!;
  assert.ok(!chapterDone(ch10, ["10.1", "10.2"]));
  assert.ok(chapterDone(ch10, ["10.1", "10.5", "10.7"]), "any three");
  for (const c of CHAPTERS) assert.ok(c.live, `chapter ${c.n} is written`);
});
