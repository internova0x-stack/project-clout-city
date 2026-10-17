import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { arcIdFrom, beatPrefix, cleanArc, newArc, newEffect, newPrediction, nextBeat, optionId, ownProblems, sideSku } from "../lib/storyBuilder.ts";
import { validateArcs } from "../lib/storyValidation.ts";

test("names: ids from titles, beat prefixes, product codes, option ids", () => {
  assert.equal(arcIdFrom("The Bodega Cat Heist"), "bodega-cat-heist");
  assert.equal(arcIdFrom("Ray's Night Book!"), "rays-night-book");
  assert.equal(beatPrefix("bodega-cat-heist"), "bch");
  assert.equal(beatPrefix("sarah"), "sar");
  assert.equal(sideSku("sarah-bird-night-book"), "side_sarah_bird_night_book");
  assert.equal(optionId("To apologize", ["a"]), "to-apologize");
  assert.equal(optionId("Sal", ["sal"]), "sal-2");
});

test("a story written in the builder passes the same checks as a file", () => {
  const a = newArc("main");
  a.title = "The Bodega Cat Heist";
  a.id = arcIdFrom(a.title);
  for (let i = 0; i < 3; i++) a.beats.push(nextBeat(a));
  assert.deepEqual(a.beats.map((b) => [b.id, b.day]), [["bch-1", 1], ["bch-2", 2], ["bch-3", 3]]);
  // Empty: the checker names what's missing.
  assert.ok(ownProblems(validateArcs([cleanArc(a)]), a.id).some((p) => /missing headline/.test(p)));
  a.beats.forEach((b, i) => { b.news[0].headline = `Headline ${i + 1}`; b.news[0].hook = "And then?"; if (b.news[0].previously !== undefined) b.news[0].previously = "Before."; });
  const p = newPrediction(a, a.beats[0]);
  assert.equal(p.id, "P1");
  assert.equal(p.reveal_beat, "bch-3", "revealed two days on when there's a beat there");
  p.question = "Who?";
  p.options = [{ id: "sal", label: "Sal" }, { id: "jojo", label: "Jojo" }];
  p.correct = "jojo";
  p.roasts = { sal: "Nope.", jojo: "dropped: the right answer has no roast" };
  a.beats[0].prediction = p;
  a.beats[1].effects.push({ ...newEffect("price_multiplier", a.beats[1]), tags: ["rockaway_diner"], reason: "Cat tourists" });
  a.tasks = [{ id: "", label: "Pet the deli cat", do: { place: "ditmars-deli", action: "", event: "" }, clout: 20 }];
  const clean = cleanArc(a);
  assert.equal(clean.tier, "free");
  assert.equal(clean.beats[0].news[0].body, undefined, "empty text is dropped");
  assert.deepEqual(clean.beats[0].prediction!.roasts, { sal: "Nope." });
  assert.equal(clean.tasks![0].id, "story:bodega-cat-heist:pet-the-deli-cat");
  assert.deepEqual(Object.keys(clean.tasks![0].do), ["place"], "empty task fields are dropped");
  const problems = ownProblems(validateArcs([clean]), clean.id).filter((x) => !/task story:bodega-cat-heist:pet-the-deli-cat/.test(x));
  assert.deepEqual(problems, []);
});

test("side stories are paid, keep only flags, and name their main story", () => {
  const s = newArc("side", "sarah-bird");
  s.title = "Jojo's Receipts";
  const clean = cleanArc(s);
  assert.equal(clean.tier, "premium");
  assert.equal(clean.sku, "side_jojos_receipts");
  assert.equal(clean.parent_arc_id, "sarah-bird");
  assert.equal(clean.start_weekday, undefined);
});

test("opening a saved story in the builder and saving it unchanged keeps the file exactly as it was", () => {
  const dir = new URL("../content/stories/", import.meta.url);
  for (const f of readdirSync(dir)) {
    const arc = JSON.parse(readFileSync(new URL(f, dir), "utf8"));
    assert.deepEqual(cleanArc(structuredClone(arc)), arc, f);
  }
});
