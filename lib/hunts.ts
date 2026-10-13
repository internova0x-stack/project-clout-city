// Treasure hunts (v0.6, docs/08-new-features-spec.md section 1; how-to in docs/HUNTS.md).
// A weekly, opt-in hunt: one track per starting style, all sharing a theme and the same
// places. Each step is the regular at a place; their line is the clue, and some steps ask a
// multiple-choice question. The finale's right answer unlocks the treasure.
//
// The week file lives in content/hunts/<Monday>.json and carries the answers, so it is read
// only by the Studio; players get hunt_state() (migration 0018), which never sends an answer.
// The engine below (talk, answer, view) is the same rule set the SQL runs; the preview's
// in-memory city uses it. Dependency-free so tests can import it.

import { CITY_ECONOMY, PLACES } from "./city.ts";
import { regularAt } from "./cast.ts";
import { STYLE_IDS, type StyleId } from "./styles.ts";

export interface HuntQuestion { q: string; choices: string[]; answer: number }
export interface HuntStep {
  /** What the regular says when the player talks to them at this step's place. */
  say: string;
  question?: HuntQuestion;
  /** Said after the right answer (the clue to the next place, or the finale's last word). */
  then?: string;
}
export interface HuntTrack { treasure: string; emoji: string; lore: string; steps: HuntStep[] }
export interface HuntFile {
  week: string;
  id: string;
  theme: string;
  intro: string;
  /** Step places in order; every track uses the same ones. Each has a regular (lib/cast.ts). */
  places: string[];
  /** What regulars say to players who've joined; "{treasure}" becomes their track's treasure. */
  chatter: string[];
  tracks: Record<StyleId, HuntTrack>;
}

/** A player's progress on one hunt. */
export interface HuntProgress {
  style: StyleId;
  /** 0-based current step; equals the step count once the treasure is found. */
  step: number;
  /** Talked to this step's regular (the question, if any, is now open). */
  talked: boolean;
  wrongAt: string | null;
  completedAt: string | null;
}

/** What a player sees (never an answer). */
export interface HuntView {
  id: string;
  week: string;
  theme: string;
  intro: string;
  /** The last day (Sunday, New York); the hunt ends at midnight after it. */
  endsOn: string;
  /** Step 1's place: the only one named outright. */
  firstPlace: string;
  joined: boolean;
  track: { style: StyleId; treasure: string; emoji: string; lore: string; steps: number } | null;
  step: number;
  /** Everything the regulars have told this player, in order. */
  heard: { placeId: string; say: string; then?: string }[];
  /** The open question at the current step, after talking. */
  question: { q: string; choices: string[]; retryAt: string | null } | null;
  completedAt: string | null;
  chatter: string[];
}

export interface HuntCard { huntId: string; week: string; theme: string; treasure: string; emoji: string; lore: string; earnedAt: string }

export interface HuntState {
  hunt: HuntView | null;
  cards: HuntCard[];
  /** Hunts completed; the badge comes at CITY_ECONOMY.hunt.badgeAfter. */
  completed: number;
}

export const HUNT_BADGE = "treasure-hunter";

export type HuntResult =
  | { ok: true; state: HuntState; line?: { say: string; question?: { q: string; choices: string[] } }; correct?: boolean; reward?: { cash: number; clout: number; badge: boolean } }
  | { ok: false; error: string; code?: "not_here" | "visit_first" | "wait" };

export interface HuntApi {
  state(): Promise<HuntResult>;
  join(): Promise<HuntResult>;
  /** Talk to the regular at a place. code "not_here" means they have nothing for the hunt. */
  talk(placeId: string): Promise<HuntResult>;
  answer(choice: number): Promise<HuntResult>;
}

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** A place is cheap enough for "nobody is priced out" when something there costs C$10 or less. */
export const CHEAP_PRICE = 10;
const len = (s: unknown, min: number, max: number) => typeof s === "string" && s.trim().length >= min && s.length <= max;

/**
 * Checks a week file. Every rule the Studio enforces is here (spec section 1, "Weekly content
 * pipeline"): places exist and have a regular, none is a story place (`storyPlaces` adds the
 * ones the live story affects that week), at least one is free or cheap, every track is
 * complete, every question has exactly one right answer.
 */
export function validateHunt(raw: unknown, opts: { storyPlaces?: string[] } = {}): { ok: true; hunt: HuntFile } | { ok: false; problems: string[] } {
  const problems: string[] = [];
  const f = raw as Partial<HuntFile> | null;
  if (!f || typeof f !== "object") return { ok: false, problems: ["That isn't a hunt file."] };
  const week = typeof f.week === "string" ? f.week : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(week) || new Date(`${week}T12:00:00Z`).getUTCDay() !== 1) problems.push(`week: "${week}" must be a Monday (YYYY-MM-DD)`);
  if (!/^[a-z0-9-]{3,40}$/.test(f.id ?? "")) problems.push("id: 3 to 40 lowercase letters, numbers and dashes");
  if (!len(f.theme, 4, 60)) problems.push("theme: 4 to 60 characters");
  if (!len(f.intro, 20, 500)) problems.push("intro: 20 to 500 characters");
  const places = Array.isArray(f.places) ? f.places : [];
  if (places.length < 4 || places.length > 5) problems.push("places: 4 or 5 steps");
  if (new Set(places).size !== places.length) problems.push("places: each step at a different place");
  const story = new Set(opts.storyPlaces ?? []);
  let cheap = false;
  for (const id of places) {
    const p = PLACES.find((x) => x.id === id);
    if (!p) { problems.push(`places: "${id}" isn't a place in lib/city.ts`); continue; }
    if (!regularAt(id)) problems.push(`places: ${p.name} has no regular to give the clue (lib/cast.ts)`);
    if (!p.actions.some((a) => a.kind !== "gigs" && !a.storyUnlock)) problems.push(`places: ${p.name} has nothing to do there, so it can't be visited`);
    if (p.story || story.has(id)) problems.push(`places: ${p.name} is part of a story; pick another place`);
    if (p.actions.some((a) => !a.storyUnlock && (a.price ?? 0) <= CHEAP_PRICE)) cheap = true;
  }
  if (places.length && !cheap) problems.push(`places: at least one step must be free or cost C$${CHEAP_PRICE} or less`);
  const chatter = Array.isArray(f.chatter) ? f.chatter : [];
  if (chatter.length < 1 || chatter.length > 6 || !chatter.every((c) => len(c, 10, 200))) problems.push("chatter: 1 to 6 lines, 10 to 200 characters each");
  const tracks = (f.tracks ?? {}) as Partial<Record<string, HuntTrack>>;
  for (const k of Object.keys(tracks)) if (!(STYLE_IDS as string[]).includes(k)) problems.push(`tracks: "${k}" isn't a starting style`);
  for (const style of STYLE_IDS) {
    const t = tracks[style];
    const at = `tracks.${style}`;
    if (!t) { problems.push(`${at}: missing (every starting style needs a track)`); continue; }
    if (!len(t.treasure, 3, 40)) problems.push(`${at}: treasure, 3 to 40 characters`);
    if (!len(t.emoji, 1, 8)) problems.push(`${at}: emoji`);
    if (!len(t.lore, 20, 300)) problems.push(`${at}: lore, 20 to 300 characters`);
    const steps = Array.isArray(t.steps) ? t.steps : [];
    if (steps.length !== places.length) problems.push(`${at}: one step per place (${places.length})`);
    steps.forEach((s, i) => {
      const sat = `${at} step ${i + 1}`;
      if (!len(s?.say, 10, 400)) problems.push(`${sat}: say, 10 to 400 characters`);
      const q = s?.question;
      if (q) {
        if (!len(q.q, 8, 160)) problems.push(`${sat}: question, 8 to 160 characters`);
        const choices = Array.isArray(q.choices) ? q.choices : [];
        if (choices.length < 2 || choices.length > 4 || !choices.every((c) => len(c, 1, 60))) problems.push(`${sat}: 2 to 4 choices, up to 60 characters`);
        if (new Set(choices.map((c) => c.trim().toLowerCase())).size !== choices.length) problems.push(`${sat}: choices must differ (exactly one right answer)`);
        if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= choices.length) problems.push(`${sat}: answer must be the index of one choice (0 is the first)`);
        if (!len(s.then, 10, 400)) problems.push(`${sat}: then (said after the right answer), 10 to 400 characters`);
      } else if (s?.then) problems.push(`${sat}: "then" only follows a question; put the clue in "say"`);
    });
    if (steps.length && !steps[steps.length - 1]?.question) problems.push(`${at}: the finale needs a question`);
  }
  return problems.length ? { ok: false, problems } : { ok: true, hunt: f as HuntFile };
}

/** The hunt runs Monday to Sunday of its week, New York time. */
export function huntLive(week: string, today: string): boolean {
  return today >= week && today <= addDays(week, 6);
}

export function huntView(h: HuntFile, prog: HuntProgress | null, nowMs: number): HuntView {
  const base = { id: h.id, week: h.week, theme: h.theme, intro: h.intro, endsOn: addDays(h.week, 6), firstPlace: h.places[0] };
  if (!prog) return { ...base, joined: false, track: null, step: 0, heard: [], question: null, completedAt: null, chatter: [] };
  const t = h.tracks[prog.style];
  const heard: HuntView["heard"] = [];
  t.steps.forEach((s, i) => {
    if (i < prog.step) heard.push({ placeId: h.places[i], say: s.say, then: s.then });
    else if (i === prog.step && prog.talked) heard.push({ placeId: h.places[i], say: s.say });
  });
  const cur = t.steps[prog.step];
  const retry = prog.wrongAt ? Date.parse(prog.wrongAt) + CITY_ECONOMY.hunt.retryMinutes * 60_000 : 0;
  return {
    ...base,
    joined: true,
    track: { style: prog.style, treasure: t.treasure, emoji: t.emoji, lore: t.lore, steps: t.steps.length },
    step: prog.step,
    heard,
    question: cur?.question && prog.talked ? { q: cur.question.q, choices: cur.question.choices, retryAt: retry > nowMs ? new Date(retry).toISOString() : null } : null,
    completedAt: prog.completedAt,
    chatter: h.chatter.map((c) => c.replaceAll("{treasure}", t.treasure)),
  };
}

/** Talking to the regular at `placeId`. The step's place must have been visited today. */
export function huntTalk(h: HuntFile, prog: HuntProgress, placeId: string, visitedToday: boolean):
  { ok: true; prog: HuntProgress; say: string; question?: { q: string; choices: string[] } } | { ok: false; code: "not_here" | "visit_first" } {
  const s = h.tracks[prog.style].steps[prog.step];
  if (!s || prog.completedAt || h.places[prog.step] !== placeId) return { ok: false, code: "not_here" };
  if (!visitedToday) return { ok: false, code: "visit_first" };
  // A step without a question is done as soon as it's heard.
  const next: HuntProgress = s.question ? { ...prog, talked: true } : { ...prog, step: prog.step + 1, talked: false, wrongAt: null };
  return { ok: true, prog: next, say: s.say, question: s.question ? { q: s.question.q, choices: s.question.choices } : undefined };
}

/** Answering the open question. A wrong answer locks it for CITY_ECONOMY.hunt.retryMinutes. */
export function huntAnswer(h: HuntFile, prog: HuntProgress, choice: number, nowMs: number):
  { ok: true; prog: HuntProgress; correct: boolean; then?: string; finished: boolean } | { ok: false; code: "not_here" | "wait" } {
  const s = h.tracks[prog.style].steps[prog.step];
  if (!s?.question || !prog.talked || prog.completedAt) return { ok: false, code: "not_here" };
  if (prog.wrongAt && Date.parse(prog.wrongAt) + CITY_ECONOMY.hunt.retryMinutes * 60_000 > nowMs) return { ok: false, code: "wait" };
  if (choice !== s.question.answer) return { ok: true, prog: { ...prog, wrongAt: new Date(nowMs).toISOString() }, correct: false, finished: false };
  const step = prog.step + 1;
  const finished = step >= h.places.length;
  return { ok: true, prog: { ...prog, step, talked: false, wrongAt: null, completedAt: finished ? new Date(nowMs).toISOString() : null }, correct: true, then: s.then, finished };
}

/** Week files the Studio can upload; also used by the preview (sample data). */
export function huntCard(h: HuntFile, style: StyleId, earnedAt: string): HuntCard {
  const t = h.tracks[style];
  return { huntId: h.id, week: h.week, theme: h.theme, treasure: t.treasure, emoji: t.emoji, lore: t.lore, earnedAt };
}

/**
 * Places a story touches (story safety): its own story places, and any place whose tags or id
 * one of its effects names. The Studio passes these for stories running in the hunt's week.
 */
export function storyPlaceIds(arc: { id: string; beats: { effects?: { tags?: string[]; place?: string }[] }[] }): string[] {
  const effects = arc.beats.flatMap((b) => b.effects ?? []);
  return PLACES.filter((p) => p.story === arc.id || effects.some((e) => e.place === p.id || e.tags?.some((t) => p.tags.includes(t)))).map((p) => p.id);
}
