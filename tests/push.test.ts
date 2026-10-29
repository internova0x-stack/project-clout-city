import { test } from "node:test";
import assert from "node:assert/strict";
import { PUSH_KINDS, PUSH_RULES, isQuiet, planPush, type PushContext, type QueuedPush } from "../lib/push.ts";

// 2026-10-18 15:00 in New York (afternoon, not quiet).
const NOON = new Date("2026-10-18T19:00:00Z");
const ctx = (o: Partial<PushContext> = {}): PushContext => ({ now: NOON, tz: "America/New_York", off: [], sentToday: 0, lastSentAt: null, lastChatAt: null, active: false, ...o });
let id = 0;
const q = (kind: string, o: Partial<QueuedPush> = {}): QueuedPush => ({
  id: ++id, kind, group_key: null, title: kind, body: `${kind} body`, url: "/home", deadline_at: null, close: false,
  created_at: new Date(NOON.getTime() - 5 * 60_000).toISOString(), ...o,
});

test("every kind has a known category and tier", () => {
  for (const [k, v] of Object.entries(PUSH_KINDS)) {
    assert.ok(["messages", "social", "money", "reminders", "rewards", "news"].includes(v.category), k);
    assert.ok(v.tier >= 0 && v.tier <= 3 && v.ttlMin > 0, k);
  }
});

test("the highest tier wins; someone waiting beats a reward", () => {
  const plan = planPush([q("rank_up"), q("date_invite"), q("gig_ready")], ctx());
  assert.equal(plan.send?.title, "date_invite");
});

test("a close deadline and a crush outrank their tier-mates", () => {
  const soon = new Date(NOON.getTime() + 20 * 60_000).toISOString();
  assert.equal(planPush([q("gig_ready"), q("party_soon", { deadline_at: soon })], ctx()).send?.title, "party_soon");
  assert.equal(planPush([q("crew_invite"), q("date_invite", { close: true })], ctx()).send?.title, "date_invite");
});

test("same group merges into one push with a count", () => {
  const plan = planPush([q("message", { group_key: "chat:tasha", title: "💬 Tasha" }), q("message", { group_key: "chat:tasha", title: "💬 Tasha" }), q("message", { group_key: "chat:dev", title: "💬 Dev" })], ctx());
  assert.equal(plan.send?.ids.length, 2);
  assert.equal(plan.send?.title, "💬 Tasha (2)");
  assert.equal(plan.send?.chat, true);
});

test("4 a day, plus chat; 15 minutes between pushes; 10 between chat pushes", () => {
  assert.equal(planPush([q("gig_ready")], ctx({ sentToday: PUSH_RULES.perDay })).send, null, "cap");
  assert.ok(planPush([q("message", { group_key: "c" })], ctx({ sentToday: PUSH_RULES.perDay })).send, "chat isn't capped");
  assert.equal(planPush([q("gig_ready")], ctx({ lastSentAt: new Date(NOON.getTime() - 5 * 60_000) })).send, null, "gap");
  assert.equal(planPush([q("message")], ctx({ lastChatAt: new Date(NOON.getTime() - 5 * 60_000) })).send, null, "chat gap");
});

test("quiet hours 10 PM to 9 AM: things wait, except a date happening now", () => {
  assert.deepEqual([21, 22, 3, 8, 9].map((h) => isQuiet(h)), [false, true, true, true, false]);
  const night = new Date("2026-10-19T03:00:00Z"); // 11 PM in New York
  assert.equal(planPush([q("gig_ready", { created_at: night.toISOString() })], ctx({ now: night })).send, null);
  assert.equal(planPush([q("date_now", { created_at: night.toISOString() })], ctx({ now: night })).send?.title, "date_now");
  // Quiet hours follow the player's own time zone.
  assert.ok(planPush([q("gig_ready", { created_at: night.toISOString() })], ctx({ now: night, tz: "America/Los_Angeles" })).send, "8 PM in LA");
});

test("expired, switched-off and in-game pushes are dropped, not sent late", () => {
  const plan = planPush([
    q("party_soon", { created_at: new Date(NOON.getTime() - 120 * 60_000).toISOString() }),
    q("rank_up"),
  ], ctx({ off: ["rewards"] }));
  assert.equal(plan.send, null);
  assert.deepEqual(plan.drop.map((d) => d.reason).sort(), ["expired", "off"]);
  assert.deepEqual(planPush([q("gig_ready")], ctx({ active: true })).drop.map((d) => d.reason), ["in_game"]);
});

test("come-back-and-play pushes only go out as one morning roundup", () => {
  const plan = planPush([q("daily_tasks", { title: "☀️ Fresh tasks" }), q("hunt_new", { title: "🗺️ New hunt" }), q("winback", { title: "Queens misses you" })], ctx());
  assert.equal(plan.send?.ids.length, 3);
  assert.equal(plan.send?.tag, "digest");
  assert.match(plan.send!.body, /Fresh tasks · 🗺️ New hunt · \+1 more/);
  // A reward goes first when both are waiting.
  assert.equal(planPush([q("daily_tasks"), q("rank_up")], ctx()).send?.title, "rank_up");
});

test("the test push skips caps, quiet hours and switches", () => {
  const night = new Date("2026-10-19T03:00:00Z");
  assert.ok(planPush([q("test", { created_at: night.toISOString() })], ctx({ now: night, sentToday: 9, off: ["messages"], active: true })).send);
});

test("devices only at the browsers' push services, the same list as migration 0130 (security review)", async () => {
  const { pushEndpointOk } = await import("../lib/push.ts");
  for (const ok of ["https://fcm.googleapis.com/fcm/send/abc", "https://updates.push.services.mozilla.com/wpush/v2/x",
                    "https://web.push.apple.com/QH", "https://wns2-par02p.notify.windows.com/w/?token=1"]) assert.ok(pushEndpointOk(ok), ok);
  for (const bad of ["https://169.254.169.254/latest", "https://evil.example/fcm.googleapis.com/", "http://fcm.googleapis.com/x",
                     "https://fcm.googleapis.com.evil.example/x", "https://notify.windows.com/x"]) assert.ok(!pushEndpointOk(bad), bad);
  const { readFileSync } = await import("node:fs");
  const sql = readFileSync(new URL("../supabase/migrations/0130_security_review.sql", import.meta.url), "utf8");
  for (const host of ["fcm\\.googleapis\\.com", "android\\.googleapis\\.com", "push\\.services\\.mozilla\\.com", "push\\.apple\\.com", "notify\\.windows\\.com"]) {
    assert.ok(sql.includes(host), host);
  }
});
