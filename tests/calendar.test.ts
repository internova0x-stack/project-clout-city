import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import CALENDAR_FILE from "../content/culture/calendar.json" with { type: "json" };
import { calendarLive, calendarOver, calendarReward, dressedUp, upcoming, validateCalendar, whenLine, type CalendarData, type CalendarEvent } from "../lib/calendar.ts";
import { CLUB_EVENTS, PLACES, SHOP_ITEMS } from "../lib/city.ts";
import { REGULARS } from "../lib/cast.ts";
import { nyClock } from "../lib/news.ts";

// Culture pack C5 (owner, Oct 20): real-date events, the Meteors at Meteor Park, the name-day invite.

const { about: _about, ...DATA } = CALENDAR_FILE as CalendarData & { about: string };
const at = (iso: string) => Date.parse(iso); // New York is UTC−4 until Nov 1, UTC−5 after

test("the database's calendar matches content/culture/calendar.json", () => {
  const dir = new URL("../supabase/migrations/", import.meta.url);
  let seed: unknown = null;
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql")).sort().reverse()) {
    const m = readFileSync(new URL(f, dir), "utf8").match(/values \('calendar', '((?:[^']|'')*)'::jsonb\)/);
    if (m) { seed = JSON.parse(m[1].replace(/''/g, "'")); break; }
  }
  assert.ok(seed, "no calendar seed");
  assert.deepEqual(seed, DATA);
});

test("the file follows the rules: NYE on the roof, the Greek parade on its date, and a name-day invite", () => {
  assert.deepEqual(validateCalendar(DATA, PLACES.map((p) => p.id)), []);
  const nye = DATA.events.find((e) => e.kind === "countdown")!;
  assert.equal(nye.date.slice(5), "12-31");
  assert.equal(nye.place, "ditmars-heights-rooftop");
  assert.equal(PLACES.find((p) => p.id === nye.place)!.neighborhood, "Astoria", "Times Square stays locked");
  const parade = DATA.events.find((e) => e.kind === "parade")!;
  assert.match(parade.title, /Greek Independence Day/);
  assert.ok(DATA.events.some((e) => e.kind === "invite" && e.dressCode && e.gift));
  const bad = validateCalendar({ ...DATA, events: [{ ...DATA.events[0], gift: { label: "x", penalty: 99 } }] }, PLACES.map((p) => p.id));
  assert.ok(bad.some((p) => /penalty/.test(p)));
});

test("the Meteors play at Meteor Park in Flushing; the cap and jersey are in the Shop; Kiki and Hector are there", () => {
  const game = CLUB_EVENTS.find((e) => e.id === "meteors-home-game")!;
  assert.equal(game.placeId, "meteor-park");
  assert.equal(PLACES.find((p) => p.id === "meteor-park")!.neighborhood, "Flushing Meadows");
  for (const sku of ["fit-meteors-cap", "fit-meteors-jersey"]) assert.equal(SHOP_ITEMS.find((i) => i.sku === sku)?.category, "fashion", sku);
  assert.ok(REGULARS.some((r) => r.placeId === "meteor-park"));
  assert.ok(REGULARS.some((r) => r.placeId === "ditmars-heights-rooftop"));
});

test("live, over and the when line run on New York time", () => {
  const e = { date: "2026-10-26", from: "18:00", hours: 5 };
  assert.ok(!calendarLive(e, at("2026-10-26T21:59:00Z")));
  assert.ok(calendarLive(e, at("2026-10-26T22:00:00Z")));
  assert.ok(calendarLive(e, at("2026-10-27T02:59:00Z")));
  assert.ok(!calendarLive(e, at("2026-10-27T03:00:00Z")) && calendarOver(e, at("2026-10-27T03:00:00Z")));
  assert.equal(whenLine(e, at("2026-10-26T12:00:00Z")), "Today, 6 PM to 11 PM");
  assert.equal(whenLine({ date: "2026-12-31", from: "21:00", hours: 3 }, at("2026-10-26T12:00:00Z")), "Thu, Dec 31, 9 PM to midnight");
  const soon = upcoming(DATA.events, at("2026-10-21T16:00:00Z"));
  assert.equal(soon[0].id, "name-day-dimitra-2026");
  assert.ok(soon.some((x) => x.kind === "countdown"), "NYE is on the calendar from October");
  assert.ok(!soon.some((x) => x.date >= "2027-01-01"), "the far ones wait");
});

test("the invite pays for dressing up and takes a little back for arriving empty-handed", () => {
  const inv = DATA.events.find((e) => e.kind === "invite")!;
  assert.deepEqual(calendarReward(inv, { dressed: true, gifts: 1 }), { clout: 65, mood: 10, dress: true, gift: "brought" });
  assert.deepEqual(calendarReward(inv, { dressed: false, gifts: 0 }), { clout: 20, mood: 10, dress: false, gift: "forgot" });
  const nye = DATA.events.find((e) => e.kind === "countdown")!;
  assert.deepEqual(calendarReward(nye, { dressed: false, gifts: 0 }), { clout: 100, mood: 15, dress: false, gift: null });
  assert.ok(dressedUp([{ category: "fashion", equipped: true }]));
  assert.ok(!dressedUp([{ category: "fashion", equipped: false }, { category: "furniture", equipped: true }]));
});

test("the preview simulator: buy a gift at Sal's, go to the name day, once only", async () => {
  const { createSimApi, sampleCityState } = await import("../lib/citySim.ts");
  const { day, minutes } = nyClock(Date.now());
  const start = Math.max(0, minutes - 30);
  const from = `${String(Math.floor(start / 60)).padStart(2, "0")}:${String(start % 60).padStart(2, "0")}`;
  const inv: CalendarEvent = { ...DATA.events[0], date: day, from, hours: 1 };
  const api = createSimApi(sampleCityState({ bank_cash: 500 }), undefined, undefined, undefined, { ...DATA, events: [inv] });
  assert.ok(!(await api.buyGift!()).ok, "not at a gift place");
  await api.travel!("ditmars-deli", "taxi");
  const gift = await api.buyGift!();
  assert.ok(gift.ok && gift.state.calendar?.gifts === 1);
  assert.ok(!(await api.calendarAttend!(inv.id)).ok, "not there yet");
  await api.travel!(inv.place, "taxi");
  const went = await api.calendarAttend!(inv.id);
  assert.ok(went.ok, went.ok ? "" : went.error);
  assert.equal(went.gain?.clout, 65, "the sample player wears a bucket hat and brought the gift");
  assert.deepEqual(went.state.calendar, { attended: [inv.id], gifts: 0 });
  assert.ok(!(await api.calendarAttend!(inv.id)).ok, "once");
});

test("the Phone shows the next name day from two weeks out, until the player has gone", async () => {
  const { phoneInvite } = await import("../lib/calendar.ts");
  assert.equal(phoneInvite(DATA.events, [], at("2026-10-13T16:00:00Z"))?.id, "name-day-dimitra-2026", "two weeks out");
  assert.equal(phoneInvite(DATA.events, [], at("2026-10-01T16:00:00Z")), null, "not yet");
  assert.equal(phoneInvite(DATA.events, ["name-day-dimitra-2026"], at("2026-10-26T23:00:00Z")), null, "went");
  assert.equal(phoneInvite(DATA.events, [], at("2026-11-20T16:00:00Z"))?.id, "name-day-andreas-2026");
});
