import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { NPC_BONDS, bigFavorOf, bondKind, bondLevel, pickFavor, toNext } from "../lib/npcBonds.ts";
import type { ChoiceCard } from "../lib/choices.ts";

const sql = readFileSync(new URL("../supabase/migrations/0159_npc_bonds.sql", import.meta.url), "utf8");
const FAVORS = JSON.parse(readFileSync(new URL("../content/choices/favors.json", import.meta.url), "utf8")) as ChoiceCard[];

test("game_settings 'npc_bonds' matches the client's numbers", () => {
  const m = sql.match(/\('npc_bonds', '(\{.*?\})'::jsonb\)/);
  assert.ok(m);
  assert.deepEqual(JSON.parse(m![1]), NPC_BONDS);
});

test("levels and the next one", () => {
  assert.equal(bondLevel(0), "stranger");
  assert.equal(bondLevel(2), "friendly");
  assert.equal(bondLevel(5), "friend");
  assert.equal(bondLevel(10), "family");
  assert.deepEqual(toNext(3), { level: "friend", need: 2 });
  assert.equal(toNext(12), null);
});

test("a choice's nudge is the friendship's move", () => {
  assert.equal(bondKind(8), "help");
  assert.equal(bondKind(-10), "exploit");
  assert.equal(bondKind(0), "pass");
  assert.equal(bondKind(undefined), "pass");
});

test("the big favor back: Sgt. Bev gets you out of holding, everyone else C$300", () => {
  assert.deepEqual(bigFavorOf("sgt-bev"), { kind: "holding" });
  assert.deepEqual(bigFavorOf("sal"), { kind: "cash", cash: 300 });
});

test("favors: every card is a talk-only favor with a regular, and the pick is stable for the day", () => {
  for (const c of FAVORS) {
    assert.ok(c.who, c.id);
    assert.deepEqual(c.where, { after: ["talk"] }, c.id);
  }
  const npcs = [...new Set(FAVORS.map((c) => c.who!))];
  for (const npc of npcs) {
    const ctx = { today: "2026-11-03", integrity: 50, rank: 3, history: [] };
    const a = pickFavor(FAVORS, npc, ctx);
    assert.ok(a, npc);
    assert.equal(pickFavor(FAVORS, npc, ctx)?.id, a!.id, "same favor all day");
    assert.equal(a!.who, npc);
    // A favor seen in the last 30 days isn't asked again.
    const seen = FAVORS.filter((c) => c.who === npc).map((c) => ({ id: c.id, day: "2026-10-20" }));
    assert.equal(pickFavor(FAVORS, npc, { ...ctx, history: seen }), null);
  }
});
