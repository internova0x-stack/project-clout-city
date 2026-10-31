import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cardView, fit, pickCard, resolveChoice, type ChoiceCard, type ChoiceContext } from "../lib/choices.ts";
import { EMPTY_MEMORY, fillSlots, jobPlace, longestShow, needsJob } from "../lib/storylets.ts";
import { TRACKS } from "../lib/careers.ts";
import type { Fact, FactKey, Memory } from "../lib/memory.ts";

// Office cards (content/choices/office.json; owner, Oct 31): Moral Choices at the player's own job.
const OFFICE: ChoiceCard[] = JSON.parse(readFileSync(new URL("../content/choices/office.json", import.meta.url), "utf8"));
const OFFERED = OFFICE.filter((c) => !c.chainOnly);
const TODAY = "2026-11-02";
const fact = (key: FactKey, subject = "", daysAgo = 1): Fact => {
  const at = new Date(Date.parse(`${TODAY}T12:00:00Z`) - daysAgo * 86_400_000).toISOString();
  return { key, subject, value: {}, count: 1, first: at, last: at, expires: null };
};
/** A player with a job on this track and every career fact an office card can ask for. */
const worker = (track: string, facts: Fact[] = [fact("career.promoted", track), fact("career.took_credit", `${track}:rival`)]): Memory =>
  ({ snapshot: { ...EMPTY_MEMORY.snapshot, job: { track, level: 2, workMood: 60 } }, facts });
const ctx = (memory: Memory | null, o: Partial<ChoiceContext> = {}): ChoiceContext => ({
  place: null, tags: [], after: "workday", integrity: 50, rank: 3, student: false, business: false, roommate: false, history: [], today: TODAY, memory, ...o,
});
const trackOf = (c: ChoiceCard) => c.when?.all?.find((x) => "snap" in x && x.snap === "job.track" && typeof x.is === "string") as { is: string } | undefined;

test("there are 16 to 20 office cards, plus their chains", () => {
  assert.ok(OFFERED.length >= 16 && OFFERED.length <= 20, `${OFFERED.length}`);
  assert.ok(OFFICE.some((c) => c.chainOnly), "at least one chain follow-up");
});

test("every office card is gated on having a job and happens at work", () => {
  for (const c of OFFICE) {
    assert.equal(c.area, "work", c.id);
    assert.ok(needsJob(c.when), `${c.id} needs a job in when.all`);
    if (c.chainOnly) continue;
    assert.equal(c.where.work, true, `${c.id} is an office card (where.work)`);
    assert.equal(fit(c, ctx(null)), 0, `${c.id} without memory`);
    assert.equal(fit(c, ctx(structuredClone(EMPTY_MEMORY))), 0, `${c.id} without a job`);
  }
});

test("office cards come after a workday or at the employer, never elsewhere", () => {
  const card = OFFERED.find((c) => c.id === "office-printer-jam")!;
  for (const t of TRACKS) {
    const m = worker(t.id);
    assert.equal(jobPlace(m), t.place);
    assert.ok(fit(card, ctx(m, { after: "workday", place: "ditmars-deli" })) > 0, `${t.id}: after a workday, wherever it was worked`);
    assert.ok(fit(card, ctx(m, { after: "arrive", place: t.place })) >= 8, `${t.id}: at the employer, as strong as a named place ×2`);
    assert.equal(fit(card, ctx(m, { after: "arrive", place: "ditmars-deli" })), 0, `${t.id}: not at the deli`);
    assert.equal(fit(card, ctx(m, { after: "shift", place: "ditmars-deli" })), 0, `${t.id}: not after a casual shift elsewhere`);
  }
});

test("a workday still counts as a shift for the shift cards", () => {
  const all: ChoiceCard[] = JSON.parse(readFileSync(new URL("../content/choices/work.json", import.meta.url), "utf8"));
  const till = all.find((c) => c.id === "till-skim-cafe")!;
  assert.ok(fit(till, ctx(null, { after: "workday", place: "grind-and-gossip" })) > 0);
});

test("every track has its own office card, and it can fire for that track only", () => {
  for (const t of TRACKS) {
    const own = OFFERED.filter((c) => trackOf(c)?.is === t.id);
    assert.ok(own.length >= 1, `no office card for ${t.id}`);
    for (const c of own) {
      assert.ok(fit(c, ctx(worker(t.id))) > 0, `${c.id} fires for ${t.id}`);
      for (const o of TRACKS.filter((x) => x.id !== t.id)) assert.equal(fit(c, ctx(worker(o.id))), 0, `${c.id} not for ${o.id}`);
    }
    // And with a plain job (no career facts), something still fits after a workday.
    assert.ok(pickCard(OFFERED, ctx(worker(t.id, [])), () => 0.5), `${t.id}: something fits a brand-new hire`);
  }
  assert.ok(OFFERED.filter((c) => !trackOf(c)).length >= 6, "a set of cards for any job");
});

test("slots fill from the job's track, within the limits with the longest names", () => {
  for (const c of OFFERED) {
    const worst = Object.fromEntries(Object.entries(c.slots ?? {}).map(([n, s]) => [n, longestShow(s.show)]));
    const fill = (t: string) => t.replace(/\{([a-z_]+)\}/g, (all, k: string) => worst[k] ?? all);
    assert.ok(fill(c.title).length <= 110, `${c.id} title: ${fill(c.title).length}`);
    for (const o of c.options) {
      assert.ok(fill(o.label).length <= 40 && fill(o.get).length <= 60 && fill(o.cost).length <= 60, `${c.id} option ${o.id}`);
    }
    for (const t of TRACKS) {
      const m = worker(t.id);
      if (!fit(c, ctx(m))) continue;
      assert.ok(fillSlots(c.slots, m), `${c.id} fills for ${t.id}`);
      const v = cardView(c, 1, t.place, m);
      assert.ok(!/\{[a-z_]+\}/.test(JSON.stringify(v)), `${c.id} for ${t.id}: an unfilled slot`);
      assert.ok(v.title.length <= 110, `${c.id} for ${t.id}`);
    }
  }
  // The people slots read the job's track.
  const s = fillSlots({ f: { snap: "job.track", show: "friend" }, r: { snap: "job.track", show: "rival" }, b: { snap: "job.track", show: "bigboss" }, n: { snap: "job.track", show: "newhire" } }, worker("cityhall"))!;
  assert.deepEqual(s.text, { f: "Dolores", r: "Preston", b: "Papa-Dani", n: "Kai" });
});

test("dishonest options pay more today, and what comes back names the choice", () => {
  for (const c of OFFICE) {
    const cash = (pos: boolean) => Math.max(...c.options.filter((o) => o.outcomes.some((x) => ((x.effects.integrity ?? 0) < 0) === !pos))
      .flatMap((o) => o.outcomes.map((x) => (x.effects.cash ?? 0) + (x.effects.clout ?? 0) * 5)), -Infinity);
    assert.ok(cash(false) >= cash(true) || c.chainOnly, `${c.id}: the angle should pay at least as well today`);
    for (const o of c.options) for (const x of o.outcomes) if (x.later) assert.match(x.later.text, /^Remember /, `${c.id} ${o.id}`);
  }
});

test("chains lead to office follow-ups, and choosing writes the thread facts", () => {
  const expenses = OFFERED.find((c) => c.id === "office-expenses")!;
  const m = worker("law");
  const r = resolveChoice(expenses, "pad", TODAY, () => 0, 50, m);
  assert.deepEqual(r.sets, [{ fact: "thread.padded_expenses", subject: "law" }]);
  assert.equal(r.later?.card, "office-expenses-audit");
  assert.equal(fit(expenses, ctx({ ...m, facts: [...m.facts, fact("thread.padded_expenses", "law")] })), 0, "once padded, never offered again");
  for (const c of OFFICE) for (const o of c.options) for (const x of o.outcomes) {
    if (x.later?.card) assert.ok(OFFICE.some((y) => y.id === x.later!.card && y.chainOnly), `${c.id} → ${x.later.card}`);
  }
});
