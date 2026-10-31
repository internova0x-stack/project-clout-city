import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { COUPLE_ITEMS, COUPLES, coupleAlerts, coupleBadge, coupleError, moveInLine, officialLine, rentParts, type CoupleState } from "../lib/couples.ts";
import { CATALOG_FURNITURE, SHOP_ITEMS } from "../lib/city.ts";
import { PUSH_KINDS } from "../lib/push.ts";
import { parseCatalogFile } from "../lib/shopCatalog.ts";

const sql = readFileSync(new URL("../supabase/migrations/0118_relationships.sql", import.meta.url), "utf8");
// Living together (migration 0149) sets the whole row again with its own keys.
const sql149 = readFileSync(new URL("../supabase/migrations/0149_living_together.sql", import.meta.url), "utf8");

test("lib/couples.ts mirrors game_settings 'couples' (the latest row: migration 0149)", () => {
  const m = sql149.match(/values \('couples', '(\{.*?\})'::jsonb\)/s);
  assert.ok(m, "the couples settings row");
  assert.deepEqual(JSON.parse(m![1]), JSON.parse(JSON.stringify(COUPLES)));
  // 0149 only adds keys: 0118's numbers are unchanged.
  const old = JSON.parse(sql.match(/values \('couples', '(\{.*?\})'::jsonb\)/s)![1]);
  for (const [k, v] of Object.entries(old)) assert.deepEqual((COUPLES as Record<string, unknown>)[k], v, k);
});

test("every couple push kind is known to the sender, and every streak badge has a name", () => {
  for (const s of [sql, sql149]) for (const k of s.matchAll(/push_enqueue\([^,]+, '([a-z_]+)'/g)) assert.ok(PUSH_KINDS[k[1]], k[1]);
  for (const r of COUPLES.streakRewards) if ("badge" in r) assert.ok(coupleBadge(r.badge), r.badge);
});

test("errors read as people, and the official line counts dates", () => {
  assert.match(coupleError("ERROR: more_dates"), /Three date nights/);
  assert.match(coupleError("weird"), /Cupid/);
  assert.equal(officialLine({ dates: 2, blockedBy: "more_dates" }), "2 of 3 date nights together");
  assert.match(officialLine({ dates: 3, blockedBy: null }), /make it official/);
  assert.match(coupleError("ERROR: too_soon"), /7 days official/);
  assert.match(coupleError("ERROR: home_too_small"), /doesn't fit two/);
  assert.equal(moveInLine(null), null);
  assert.equal(moveInLine("already_together"), null);
  assert.match(moveInLine("rent_due")!, /rent/);
});

test("rent splits like the database: the mover floor(half), the host the rest", () => {
  assert.deepEqual(rentParts(600), { mover: 300, host: 300 });
  assert.deepEqual(rentParts(425), { mover: 212, host: 213 });
  assert.ok(sql149.includes("mine := floor(p_amount * share)::int"), "the same split in SQL");
});

test("alerts: an ask to answer, an unseen gift, the breakup note and a move-in ask", () => {
  const base: CoupleState = {
    partner: null, relId: null, since: null, days: null, streak: 0, todayDone: false, nextReward: null, shown: null,
    gifts: { boxes: 0, sentToday: false, received: [] }, paid: [], ended: null, matches: [], asks: [],
    rules: { datesToOfficial: 3, streakMessages: 5, giftMood: 10, giftClout: 10 },
  };
  assert.equal(coupleAlerts(base), 0);
  assert.equal(coupleAlerts({ ...base, asks: [{ id: 1, mine: true, with: { id: "x", name: "x", style: "s" } }] }), 0);
  assert.equal(coupleAlerts({ ...base, asks: [{ id: 1, mine: false, with: { id: "x", name: "x", style: "s" } }],
    gifts: { boxes: 0, sentToday: false, received: [{ id: 2, from: "x", day: "2026-10-26" }] }, ended: { id: 3, reason: "breakup", name: "x" } }), 3);
  const home = { live: null, blockedBy: null, ended: null, rules: { moveInDays: 7, homeMood: 8, homeClout: 5, rentShare: 0.5 } };
  assert.equal(coupleAlerts({ ...base, home: { ...home, asks: [{ id: 4, mine: true, homeId: "astoria_studio" }] } }), 0);
  assert.equal(coupleAlerts({ ...base, home: { ...home, asks: [{ id: 4, mine: false, homeId: "astoria_studio" }] } }), 1);
});

test("couple Shop pieces: in content/shop/couple.json, couples only, C$ furniture the home can place", () => {
  const raw = JSON.parse(readFileSync(new URL("../content/shop/couple.json", import.meta.url), "utf8"));
  const { drafts, problems } = parseCatalogFile(raw, "couple.json");
  assert.deepEqual(problems, []);
  assert.deepEqual(new Set(drafts.map((d) => d.sku)), COUPLE_ITEMS);
  for (const d of drafts) {
    assert.equal(d.tab, "home", d.sku);
    assert.ok(!d.realCash && d.price > 0, `${d.sku}: C$ only`);
    assert.equal(d.extra.couplesOnly, true, `${d.sku}: couples only`);
    assert.equal(d.extra.emojiOnly, true, `${d.sku}: shows its emoji until it has a picture`);
    assert.equal(d.emoji, raw.items.find((i: { id: string }) => i.id === d.sku).emoji, `${d.sku}: its own emoji`);
    const f = CATALOG_FURNITURE[d.sku];
    assert.ok(f, `${d.sku} has furniture`);
    assert.equal(f.room, d.slot, `${d.sku}: shelved in its room`);
    assert.ok(!SHOP_ITEMS.some((i) => i.sku === d.sku), `${d.sku} is new`);
  }
});
