import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { analyticsOff, missedRent, rentPaid, shopBought, taskEvents } from "../lib/analyticsEvents.ts";
import type { CityState } from "../lib/cityState.ts";

// PostHog analytics (owner, Oct 27): what each game change reports, and the privacy rules around it.
const task = (id: number, done: boolean) => ({ id, slot: id, kind: "visit", place_id: "ditmars-deli", action_id: "eat", reward: 20, done_at: done ? "2026-10-27T12:00:00Z" : null }) as CityState["tasks"][number];
const state = (over: Partial<CityState> = {}): CityState => ({
  player: { id: "u1", bank_cash: 1000, home_id: "astoria_studio" }, today: "2026-10-27", tasks: [task(1, false), task(2, false)],
  bills: [], items: [], ...over,
}) as unknown as CityState;

test("the Story Studio and its preview send nothing", () => {
  assert.ok(analyticsOff("/studio"));
  assert.ok(analyticsOff("/studio/anything"));
  assert.ok(analyticsOff("/preview/studio"));
  assert.ok(!analyticsOff("/home"));
  assert.ok(!analyticsOff("/studious"));
});

test("a task done reports once, and the last one reports the sweep", () => {
  const a = state(), b = state({ tasks: [task(1, true), task(2, false)] }), c = state({ tasks: [task(1, true), task(2, true)] });
  assert.deepEqual(taskEvents(a, b).map((e) => e.event), ["daily_task_completed"]);
  assert.deepEqual(taskEvents(b, b), []);
  assert.deepEqual(taskEvents(b, c).map((e) => e.event), ["daily_task_completed", "all_daily_tasks_completed"]);
  assert.deepEqual(taskEvents(null, c), [], "no 'before': nothing (the first load)");
  assert.deepEqual(taskEvents(state({ today: "2026-10-26" }), c), [], "a new day's list isn't a completion");
});

test("rent: missed once per bill, paid with how late", () => {
  const bill = { id: 7, kind: "rent", amount: 425, due_date: "2026-10-24", status: "due", paid_at: null } as const;
  const s = state({ bills: [bill] });
  const m = missedRent(s, new Set());
  assert.equal(m.length, 1);
  assert.equal(m[0].props.days_late, 3);
  assert.equal(missedRent(s, new Set([7])).length, 0);
  assert.equal(missedRent(state({ bills: [{ ...bill, due_date: "2026-10-27" }] }), new Set()).length, 0, "due today isn't missed");
  assert.equal(rentPaid(bill, s)[0].props.days_late, 3);
  assert.deepEqual(rentPaid({ ...bill, kind: "phone" }, s), []);
});

test("a C$ purchase carries the item, the price and the currency", () => {
  const before = state(), after = state({ player: { id: "u1", bank_cash: 880, home_id: "x" } as CityState["player"], items: [{ id: 1, sku: "home-rug-pink", category: "home", value: 120, acquired: "bought", equipped: false }] });
  assert.deepEqual(shopBought("home-rug-pink", "buy", before, after).props, { item: "home-rug-pink", category: "home", price: 120, currency: "C$", mode: "buy" });
  assert.equal(shopBought("home-rug-pink", "buy", before, after, -95).props.price, 95);
});

test("no typed text or email goes to PostHog", () => {
  const shell = readFileSync(new URL("../components/GameShell.tsx", import.meta.url), "utf8");
  for (const m of shell.matchAll(/trackEvent\("chat_message_sent", (\{[^}]*\})/g)) assert.doesNotMatch(m[1], /body[,}]|body:|text/, m[1]);
  const init = readFileSync(new URL("../instrumentation-client.ts", import.meta.url), "utf8");
  assert.match(init, /maskAllInputs: true/);
  assert.match(init, /maskTextSelector: "\.ph-sensitive"/);
  const chat = readFileSync(new URL("../components/chat/Messages.tsx", import.meta.url), "utf8");
  assert.match(chat, /chat-bubbles ph-sensitive/);
  const lib = readFileSync(new URL("../lib/analytics.ts", import.meta.url), "utf8");
  assert.doesNotMatch(lib, /\.email\b|display_name/);
});
