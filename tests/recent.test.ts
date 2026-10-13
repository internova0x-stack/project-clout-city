import { test } from "node:test";
import assert from "node:assert/strict";
import { PLACES } from "../lib/city.ts";
import { recentLine, recentWhen, statTips } from "../lib/recent.ts";

test("recent lines name the place, event, item or hunt, and drop unknown refs", () => {
  assert.equal(recentLine({ kind: "visit", ref: "velvet-static:2026-10-12", at: "" })?.text, "Stopped by Velvet Static");
  assert.equal(recentLine({ kind: "event", ref: "neon-nights:2026-10-12", at: "" })?.text, "Pulled up to Neon Nights");
  assert.match(recentLine({ kind: "hunt", ref: "h", at: "", theme: "Auntie Vee's Storage Unit" })!.text, /Auntie Vee/);
  assert.equal(recentLine({ kind: "visit", ref: "nowhere:2026-10-12", at: "" }), null);
  assert.equal(recentLine({ kind: "purchase", ref: "no-such-sku", at: "" }), null);
});

test("recentWhen reads like a feed", () => {
  const now = new Date("2026-10-13T18:00:00");
  assert.equal(recentWhen("2026-10-13T17:59:30", now), "Just now");
  assert.equal(recentWhen("2026-10-13T15:00:00", now), "3h");
  assert.equal(recentWhen("2026-10-12T20:00:00", now), "Yesterday");
  assert.equal(recentWhen("2026-10-10T20:00:00", now), "Sat");
});

test("stat tips pick the cheapest affordable action that raises each stat", () => {
  const tips = statTips(PLACES, 1000);
  for (const t of Object.values(tips)) assert.ok(t && t.gain > 0 && t.price <= 1000);
  assert.equal(tips.mood!.price, 0, "a free mood boost exists (the park)");
  const broke = statTips(PLACES, 0);
  assert.ok(broke.energy === null || broke.energy.price === 0, "never suggests what you can't afford");
  const locked = { ...PLACES[0], id: "x", actions: [{ id: "a", kind: "visit" as const, label: "", price: 0, energy: 0, mood: 99, blurb: "", storyUnlock: true }] };
  assert.equal(statTips([locked], 100).mood, null, "story-locked actions are skipped");
});
