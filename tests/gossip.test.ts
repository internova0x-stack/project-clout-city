import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { answerWords, gossipLeads, hintLine, inWindow, leadAction, leadFrom, leadLine, validateGossipWeek, windowLine, type GossipWeek } from "../lib/gossip.ts";
import { placeById } from "../lib/city.ts";
import { regularAt } from "../lib/cast.ts";

const week = (): GossipWeek => JSON.parse(readFileSync(new URL("../content/gossip/2026-10-19.json", import.meta.url), "utf8"));
const problems = (w: unknown, opts = {}) => { const r = validateGossipWeek(w, opts); return r.ok ? [] : r.problems; };

test("the first gossip week passes its checks", () => {
  assert.deepEqual(problems(week()), []);
});

test("a story is exactly five pieces at five different real places", () => {
  const w = week();
  w.stories[0].pieces.pop();
  assert.ok(problems(w).some((p) => /exactly 5 pieces/.test(p)));
  const d = week();
  d.stories[0].pieces[1].place = d.stories[0].pieces[0].place;
  assert.ok(problems(d).some((p) => /different place/.test(p)));
  const x = week();
  x.stories[0].pieces[0].place = "nowhere-cafe";
  assert.ok(problems(x).some((p) => /isn't a place/.test(p)));
});

test("3 to 5 stories, unique ids, a Monday week", () => {
  const w = week();
  w.stories = w.stories.slice(0, 2);
  assert.ok(problems(w).some((p) => /3 to 5 a week/.test(p)));
  const d = week();
  d.stories[1].id = d.stories[0].id;
  assert.ok(problems(d).some((p) => /used twice/.test(p)));
  const t = week();
  t.week = "2026-10-20";
  assert.ok(problems(t).some((p) => /must be a Monday/.test(p)));
});

test("a regular's piece needs a regular there", () => {
  const w = week();
  const p = w.stories[0].pieces.find((x) => x.source === "overheard")!;
  p.place = "steinway-fresh";
  p.source = "regular";
  assert.ok(problems(w).some((x) => /has no regular/.test(x)));
});

test("story safety: no story places, never a live story's answer", () => {
  const w = week();
  w.stories[0].pieces[0].place = "rockaway-diner";
  assert.ok(problems(w).some((p) => /part of a story/.test(p)));
  assert.ok(problems(week(), { storyPlaces: ["grind-and-gossip"] }).some((p) => /part of a story/.test(p)));
  const leak = week();
  leak.stories[2].pieces[0].text = "Everyone knows it was Pastor Vale, the brothers said so twice.";
  assert.ok(problems(leak, { forbidden: answerWords({ killer: "pastor-vale", server_only: true }) }).some((p) => /pastor vale/.test(p)));
});

test("city-clock windows wrap past midnight", () => {
  assert.equal(inWindow([21, 3], 23), true);
  assert.equal(inWindow([21, 3], 2), true);
  assert.equal(inWindow([21, 3], 12), false);
  assert.equal(inWindow([6, 11], 6), true);
  assert.equal(inWindow([6, 11], 11), false);
  assert.equal(inWindow(undefined, 4), true);
  assert.equal(windowLine([21, 3]), "9 PM to 3 AM (city time)");
  const w = week();
  w.stories[0].pieces[0].hours = [5, 5];
  assert.ok(problems(w).some((p) => /hours/.test(p)));
});

test("hints say how, what kind of place, where and when, never the place", async () => {
  const { hintLine, quietLine } = await import("../lib/gossip.ts");
  const miss = { n: 2, found: false as const, source: "overheard" as const, hours: [21, 3] as [number, number], place: null, kind: "club", area: "Long Island City" };
  assert.equal(hintLine(miss), "Overheard at a club in Long Island City · 9 PM to 3 AM (city time)");
  assert.equal(hintLine({ ...miss, source: "regular", hours: null, kind: "games", area: "Astoria" }), "The regular at a gaming arena in Astoria");
  assert.equal(hintLine({ ...miss, hours: null, place: "two-bros-pizza" }, "Two Bros Who Fight Pizza"), "Overheard at Two Bros Who Fight Pizza");
  assert.match(quietLine([21, 3], 0), /9 PM to 3 AM/);
  assert.ok(quietLine(null, 1).length > 10);
});

test("the trail (v0.11): leads are each story's next known piece, passed on by everyone else", () => {
  const piece = (n: number, found: boolean, place: string | null, source: "overheard" | "regular" = "overheard") =>
    found ? { n, found: true as const, text: "said", place: place!, source, via: "overheard" as const, shared: false }
          : { n, found: false as const, source, hours: null, place, kind: "cafe", area: "Astoria" };
  const story = (id: string, pieces: ReturnType<typeof piece>[], done = false) =>
    ({ id, week: "2026-10-19", endsOn: "2026-11-01", title: id, topic: "regulars" as const, emoji: "🫖", teaser: "t", done, pieces });
  const state = {
    cards: [],
    stories: [
      // Sal told piece one; piece two (Rosa's) is now named.
      story("a", [piece(0, true, "ditmars-deli", "regular"), piece(1, false, "grind-and-gossip", "regular"), piece(2, false, null), piece(3, false, null), piece(4, false, null)]),
      // Not started: the first piece is the lead.
      story("b", [piece(0, false, "two-bros-pizza"), piece(1, false, null), piece(2, false, null), piece(3, false, null), piece(4, false, null)]),
      story("c", [piece(0, true, "ditmars-deli")], true),
    ],
  };
  const leads = gossipLeads(state);
  assert.deepEqual(leads.map((l) => `${l.story}:${l.place}`), ["a:grind-and-gossip", "b:two-bros-pizza"], "finished stories have no lead");
  assert.equal(leadFrom(state, "grind-and-gossip")?.place, "two-bros-pizza", "never points you to where you are");
  assert.equal(leadFrom(state, null, 1)?.story, "b", "varies with the seed");
  assert.equal(leadFrom({ cards: [], stories: [] }, null), null);
  const rosa = regularAt("grind-and-gossip")!.name;
  assert.equal(leadAction(leads[0]), `Talk to ${rosa} at ${placeById("grind-and-gossip")!.name}`);
  assert.equal(leadAction({ place: "velvet-static", source: "overheard", hours: [21, 3] }), "Listen in at Velvet Static, 9 PM to 3 AM");
  assert.match(leadLine(leads[0]), new RegExp(`Ask ${rosa} at`));
  assert.match(leadLine(leads[1]), /Go listen\.$/);
  // The Tea app's hint names the regular once the trail reaches them.
  assert.match(hintLine(state.stories[0].pieces[1] as never, placeById("grind-and-gossip")!.name), new RegExp(`^Talk to ${rosa} at`));
});

test("#19 restroom pieces: only where there's a restroom, never behind a door rule", () => {
  const w = week();
  const i = w.stories[0].pieces.findIndex((p) => p.place === "velvet-static");
  w.stories[0].pieces[i].source = "restroom";
  assert.deepEqual(problems(w), [], "a club's restroom is fine");
  const d = week();
  d.stories[0].pieces[0].source = "restroom";
  d.stories[0].pieces[0].place = "grind-and-gossip";
  assert.ok(problems(d).some((p) => /no restroom floor/.test(p)));
  const x = week();
  x.stories[0].pieces[i].place = "ultraviolet-society";
  assert.ok(problems(x).some((p) => /turns people away at the door/.test(p)));
  assert.match(hintLine({ n: 1, found: false, source: "restroom", hours: null, place: null, kind: "club", area: "Astoria" }), /^Overheard in the restroom at a club in Astoria/);
  assert.match(leadAction({ place: "hellgate-hall", source: "restroom", hours: null }), /^Listen in downstairs at The Kiln/);
});
