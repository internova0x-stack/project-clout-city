import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FAME_PERKS, SPOTLIGHT, fameSettings, perksAt, rewardMult } from "../lib/fame.ts";
import type { SceneMove } from "../lib/scene.ts";

const MOVES = (JSON.parse(readFileSync(new URL("../content/scene/moves.json", import.meta.url), "utf8")) as { moves: SceneMove[] }).moves;

test("migration 0175 carries lib/fame.ts's settings", () => {
  const sql = readFileSync(new URL("../supabase/migrations/0175_fame_perks.sql", import.meta.url), "utf8");
  const m = /values \('fame', '(\{.*?\})'::jsonb\)/s.exec(sql);
  assert.ok(m);
  assert.deepEqual(JSON.parse(m![1]), JSON.parse(JSON.stringify(fameSettings(MOVES.filter((x) => x.host).map((x) => x.id)))));
});

test("everyday rewards grow 20% a rank, capped at ×2.8", () => {
  assert.equal(rewardMult(1), 1);
  assert.ok(Math.abs(rewardMult(2) - 1.2) < 1e-9);
  assert.ok(Math.abs(rewardMult(6) - 2) < 1e-9);
  assert.ok(Math.abs(rewardMult(10) - 2.8) < 1e-9);
  assert.ok(Math.abs(rewardMult(15) - 2.8) < 1e-9);
});

test("a perk at every rank from 2; a Spotlight at every rank from 5; the own-night move needs Rank 9", () => {
  for (let r = 2; r <= 10; r++) assert.ok(FAME_PERKS.some((p) => p.rank === r), `rank ${r}`);
  for (let r = 5; r <= 10; r++) { assert.ok(SPOTLIGHT[r]?.includes("{name}"), `spotlight ${r}`); assert.ok(!SPOTLIGHT[r].includes("'"), "no straight apostrophes"); }
  assert.deepEqual(perksAt(1).have, []);
  assert.equal(perksAt(4).have.length, 3);
  assert.equal(MOVES.find((m) => m.id === "own-night")?.needs?.rank, 9);
});
