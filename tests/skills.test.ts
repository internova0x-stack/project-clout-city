import { test } from "node:test";
import assert from "node:assert/strict";
import { LEVEL_AT, MAX_LEVEL, SKILLS, levelFor, levelProgress, skillBadge } from "../lib/skills.ts";

test("nine skills, levels 0 to 10 on the same practice table as migration 0056", () => {
  assert.equal(SKILLS.length, 9);
  assert.deepEqual([...LEVEL_AT], [0, 3, 8, 15, 25, 40, 60, 85, 115, 150, 200]);
  assert.equal(levelFor(0), 0);
  assert.equal(levelFor(3), 1);
  assert.equal(levelFor(39), 4);
  assert.equal(levelFor(40), 5);
  assert.equal(levelFor(999), MAX_LEVEL);
  assert.equal(levelProgress(9), (9 - 8) / (15 - 8));
  assert.equal(levelProgress(200), 1);
});

test("skill badges at 5 and 10", () => {
  assert.deepEqual(skillBadge("skill-dance-5"), { emoji: "💃", name: "Dance 5" });
  assert.equal(skillBadge("skill-cooking-10")?.name, "Master Chef");
  assert.equal(skillBadge("skill-dance-7"), null);
  assert.equal(skillBadge("hunt-veteran"), null);
});
