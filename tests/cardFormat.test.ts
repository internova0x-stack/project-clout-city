import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { faceProblems, fillNames, gateProblems, unlockedCards, type CardFace } from "../lib/cardFormat.ts";
import { hire, startDay, careerView, type CareerContent, type CareerCtx } from "../lib/careers.ts";
import { EMPTY_MEMORY } from "../lib/storylets.ts";
import type { ChoiceCard } from "../lib/choices.ts";
import type { Fact, FactKey, Memory } from "../lib/memory.ts";

const read = (p: string) => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));
const CHOICES: ChoiceCard[] = readdirSync(new URL("../content/choices/", import.meta.url)).filter((f) => f.endsWith(".json")).flatMap((f) => read(`../content/choices/${f}`));
const CAREERS: CareerContent = read("../content/careers/careers.json");
const SITUATIONS: { id: string; icon: string; text: string; when?: unknown; choices: CardFace["options"] }[] = read("../content/campaign/situations.json").situations;
const f = (key: FactKey, subject = ""): Fact => ({ key, subject, value: {}, count: 1, first: "2026-11-01T12:00:00Z", last: "2026-11-01T12:00:00Z", expires: null });

test("one face: Moral Choices cards, career tasks and campaign situations all pass the shared rules", () => {
  // Moral Choices keep their (hidden) risk notes in the file; cardView never sends them.
  for (const c of CHOICES) assert.deepEqual(faceProblems(`card ${c.id}`, c as unknown as CardFace, { allowRiskFields: true }), []);
  for (const t of CAREERS.tasks) assert.deepEqual(faceProblems(`task ${t.id}`, t as unknown as CardFace), []);
  // The campaign shows the candidate's own Integrity on screen, so it may name it.
  for (const s of SITUATIONS) {
    const p = faceProblems(`situation ${s.id}`, { emoji: s.icon, title: s.text, options: s.choices } as CardFace).filter((x) => !/never the meter/.test(x));
    assert.deepEqual(p, []);
  }
});

test("gated career tasks and campaign situations pass the storylet rules", () => {
  const gatedTasks = CAREERS.tasks.filter((t) => t.when || t.slots);
  const gatedSits = SITUATIONS.filter((s) => s.when);
  assert.ok(gatedTasks.length >= 3 && gatedSits.length >= 2);
  for (const t of gatedTasks) {
    const more = t.options.flatMap((o) => [o.label, ...o.outcomes.map((x) => x.text)]);
    assert.deepEqual(gateProblems(`task ${t.id}`, t, { title: t.title, more }), []);
  }
  for (const s of gatedSits) assert.deepEqual(gateProblems(`situation ${s.id}`, s as never, { title: s.text.replace("{candidate}", "Candidate") }), []);
  assert.match(gateProblems("x", { id: "x", when: { all: [{ has: "career.nope" as FactKey }] } }, { title: "Hi" }).join(), /unknown fact/);
});

test("a feud unlocks the feud task, with the coworker's name, as the day's first task", () => {
  const mem: Memory = { ...EMPTY_MEMORY, facts: [f("thread.feud", "tech:rival")] };
  const unlocked = unlockedCards(CAREERS.tasks, mem, "2026-11-02");
  assert.deepEqual(unlocked["tech-feud-cc"], { coworker: "Brent" });
  assert.equal(unlocked["hosp-banned-regular"], undefined);
  assert.deepEqual(unlockedCards(CAREERS.tasks, null, "2026-11-02"), {});
  const ctx: CareerCtx = { clout: 500, crew: 1, energy: 100, atPlace: "triborough-works", shiftsToday: 0, skills: { smarts: 3 }, past: {}, unlocked };
  const s = hire("x", "tech", ctx, "honest", "2026-11-02");
  startDay(CAREERS, s, "steady", ctx, "2026-11-02", () => 0.3);
  assert.equal(s.today!.tasks[0].id, "tech-feud-cc");
  const view = careerView(CAREERS, s, "2026-11-02", ctx);
  assert.match(view.today!.tasks[0].title, /^Brent cc'd/);
  // Without the feud it never comes up.
  const plain = hire("y", "tech", { ...ctx, unlocked: {} }, "honest", "2026-11-02");
  for (let i = 0; i < 20; i++) {
    const t = structuredClone(plain);
    startDay(CAREERS, t, "steady", { ...ctx, unlocked: {} }, "2026-11-02", () => i / 20);
    assert.ok(!t.today!.tasks.some((x) => x.id === "tech-feud-cc"));
  }
  assert.equal(fillNames("{a} and {b}", { a: "x" }), "x and {b}");
});
