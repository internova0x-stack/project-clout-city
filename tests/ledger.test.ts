import { test } from "node:test";
import assert from "node:assert/strict";
import { describeEntry, sampleLedger } from "../lib/ledger.ts";

const row = (kind: string, ref: string, extra = {}) => ({ id: 1, amount: -1, kind, ref, at: "", ...extra });

test("each row says where and what (#29)", () => {
  assert.deepEqual(describeEntry(row("visit", "velvet-static:2026-10-12:1")).title, "Velvet Static");
  assert.equal(describeEntry(row("purchase", "12", { sku: "fit-satin-bomber" })).detail, "Satin bomber jacket");
  assert.match(describeEntry(row("daily_task", "3", { task: { place: "lucky-seven-deli", action: "eat" } })).detail!, /Lucky Seven Deli/);
  assert.equal(describeEntry(row("gig", "4", { gig: "Hold a ring light" })).detail, "Hold a ring light");
  assert.equal(describeEntry(row("bill_phone", "9")).title, "Phone bill");
  assert.equal(describeEntry(row("event_entry", "neon-nights:2026-10-12")).title, "Neon Nights");
  assert.deepEqual(describeEntry(row("travel", "taxi:hell-gate-park:1760000000000")), { emoji: "🚕", title: "Taxi", detail: "Hell Gate Park" });
  assert.equal(describeEntry(row("travel", "subway:home:1760000000000")).detail, "Home");
  assert.deepEqual(describeEntry(row("groceries", "steinway-fresh:meal-prep:1760000000000")), { emoji: "🛒", title: "Groceries", detail: "Meal prep for the week" });
  assert.deepEqual(describeEntry(row("drink", "velvet-static:1760000000000")), { emoji: "🍸", title: "Bar", detail: "Velvet Static" });
});

test("unknown refs and kinds still read as words, never ids", () => {
  assert.equal(describeEntry(row("purchase", "12")).title, "Shop");
  assert.equal(describeEntry(row("some_new_kind", "x")).title, "Some new kind");
  for (const e of sampleLedger()) assert.ok(describeEntry(e).title.length > 2);
});
