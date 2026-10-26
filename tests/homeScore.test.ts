import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { CATALOG_FURNITURE } from "../lib/city.ts";
import { ECONOMY } from "../lib/economy.ts";
import { HOME_SCORE, homeScore, homeTips, nextMilestone, qualityTarget, tierFor } from "../lib/homeScore.ts";

const sql = readFileSync(new URL("../supabase/migrations/0120_home_score.sql", import.meta.url), "utf8");
const art = JSON.parse(readFileSync(new URL("../content/shop/wall-art.json", import.meta.url), "utf8")).items as { id: string; texture: string; stars: number }[];

test("lib/homeScore.ts mirrors game_settings 'home_score' in migration 0120", () => {
  const m = sql.match(/values \('home_score', '(\{.*?\})'::jsonb\)/s);
  assert.ok(m, "the settings row");
  assert.deepEqual(JSON.parse(m![1]), JSON.parse(JSON.stringify(HOME_SCORE)));
  for (const id of Object.keys(HOME_SCORE.targets)) assert.ok(ECONOMY.homes.some((h) => h.id === id), id);
});

test("the same pieces as supabase/tests/home_score.test.sql score the same here", () => {
  const sofa = { room: "living", line: "sofa", stars: 3 };
  const pieces = [{ room: "art", line: "art-clout", stars: 4 }, { room: "art", line: "art-rent-is-due", stars: 1 },
    sofa, { ...sofa }, { room: "bedroom", line: "bed", stars: 3 }, { room: "decor", line: "plant", stars: 1 }];
  assert.equal(homeScore(pieces, qualityTarget("astoria_studio", null)).score, 68);
  const more = [...pieces, { room: "dining", line: "chair", stars: 1 }];
  assert.equal(homeScore(more, 10).score, 82);
  assert.equal(homeScore(more, qualityTarget("lic_highrise", null)).score, 68);
  assert.equal(qualityTarget("lic_highrise", "house-astoria-townhouse"), HOME_SCORE.houseTarget);
  assert.equal(homeScore([], 10).score, 0);
  assert.equal(tierFor(0), "Bare walls");
  assert.equal(tierFor(100), "Iconic");
});

test("tips point at the biggest gains, and milestones count up", () => {
  const s = homeScore([{ room: "living", line: "sofa", stars: 3 }], 10);
  const tips = homeTips(s);
  assert.equal(tips.length, 3);
  assert.equal(tips[0].gain, 16);
  assert.deepEqual(nextMilestone(s.score), HOME_SCORE.milestones[0]);
  assert.equal(nextMilestone(100), null);
});

test("every painting is in the migration, hangs on a wall and has its picture", () => {
  assert.equal(art.length, 12);
  for (const a of art) {
    assert.ok(sql.includes(`'${a.id}'`), a.id);
    assert.deepEqual(CATALOG_FURNITURE[a.id], { kind: "painting", room: "art", line: a.id, art: a.texture }, a.id);
    assert.ok(existsSync(new URL(`../public${a.texture}`, import.meta.url)), a.texture);
  }
});
