import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanSlug, conversion, creatorUrl, giftItems, landingPath, normalizeCreatorCode, slugProblem } from "../lib/creators.ts";

test("creators: codes are typed loosely and stored strictly (3 to 16 letters and numbers)", () => {
  assert.equal(normalizeCreatorCode(" tasha "), "TASHA");
  assert.equal(normalizeCreatorCode("dev-q"), "DEVQ");
  assert.equal(normalizeCreatorCode("ab"), null);
  assert.equal(normalizeCreatorCode("x".repeat(17)), null);
  assert.equal(normalizeCreatorCode(null), null);
});

test("creators: slugs follow the database rule", () => {
  assert.equal(cleanSlug(" Tasha TikTok "), "tasha-tiktok");
  assert.equal(slugProblem("tasha-tiktok"), null);
  assert.ok(slugProblem("a"));
  assert.ok(slugProblem("-tasha"));
  assert.ok(slugProblem("tasha--x"));
  assert.ok(slugProblem("x".repeat(41)));
  assert.equal(creatorUrl("https://example.com/", "tasha"), "https://example.com/c/tasha");
});

test("creators: guests land at the front door, players on the screen", () => {
  assert.equal(landingPath("signup", false), "/?signup=1");
  assert.equal(landingPath("shop", false), "/");
  assert.equal(landingPath("home", true), "/home");
  assert.equal(landingPath("signup", true), "/home");
  assert.equal(landingPath("vip", true), "/home?open=vip");
});

test("creators: the welcome gift is a Shop fashion piece sold for C$, never a collector or reward piece", () => {
  const items = giftItems();
  assert.ok(items.length > 0);
  assert.ok(items.every((i) => i.category === "fashion" && !i.collector && !i.reward && i.price > 0));
});

test("creators: click to sign-up", () => {
  assert.equal(conversion(12, 100), 12);
  assert.equal(conversion(1, 3), 33.3);
  assert.equal(conversion(5, 0), null);
});
