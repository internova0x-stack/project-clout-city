// What the client knows about stories: the filtered feed from story_feed()
// (supabase/migrations/0007). It never contains answer keys, correct options
// before a reveal, unreleased beats or locked side-arc text. Safe to import anywhere.

import type { Phase, StoryEffect, StoryEvent, StoryTask } from "./stories.ts";

export interface FeedBeat {
  id: string;
  day: number;
  headline: string;
  locked: boolean;
  seen: boolean;
  body?: string;
  hook?: string;
  previously?: string;
  cardNote?: string;
  pointsAtAnswer?: boolean;
  evidence?: { title: string; kind: string; lines: string[] };
}

export interface FeedPrediction {
  id: string;
  beatId: string;
  question: string;
  options: { id: string; label: string }[];
  reward: { clout: number; badge?: string };
  closesAt: string;
  revealsAt?: string;
  revealBeat: string;
  state: "open" | "closed" | "revealed";
  myVote?: string;
  shadowGuess?: string;
  results?: { total: number; counts: Record<string, number> };
  correct?: string;
  roast?: string;
}

export interface FeedArc {
  id: string;
  title: string;
  type: "main" | "side";
  kind?: string;
  tier: "free" | "premium";
  sku?: string;
  parent?: string;
  teaser?: string;
  emoji?: string;
  prompt?: string;
  day: number;
  lastDay: number;
  finished: boolean;
  entitled: boolean;
  beats: FeedBeat[];
  predictions: FeedPrediction[];
  badges?: { id: string; name: string; emoji: string; line: string }[];
}

export interface StoryFeed {
  today: string;
  arcs: FeedArc[];
  effects: { arc: string; beat: string; effect: StoryEffect }[];
  events: (StoryEvent & { arc: string; cancelled: boolean })[];
  tasks: (StoryTask & { arc: string; done: boolean })[];
  chatter: { topic: string; phase: Phase; priority: number; lines: Record<string, string[]> | null }[];
  badges: { id: string; arc: string; earnedAt: string }[];
  startedArcs: string[];
}

export const EMPTY_FEED: StoryFeed = { today: "", arcs: [], effects: [], events: [], tasks: [], chatter: [], badges: [], startedArcs: [] };

/** Everything a story is doing to one place right now (for reason banners). */
export function placeStory(feed: StoryFeed | null, place: { id: string; tags: string[] }) {
  const effects = (feed?.effects ?? []).map((e) => e.effect);
  const tagHit = (e: StoryEffect) => e.tags?.some((t) => place.tags.includes(t));
  const closed = effects.find((e) => e.type === "availability" && e.state === "closed" && tagHit(e));
  const restricted = effects.find((e) => e.type === "availability" && e.state === "restricted" && tagHit(e));
  const prices = effects.filter((e) => e.type === "price_multiplier" && tagHit(e));
  const price = prices.sort((a, b) => (b.multiplier ?? 1) - (a.multiplier ?? 1))[0];
  return {
    closed: closed ? { reason: closed.reason ?? "Closed" } : null,
    restricted: !closed && restricted ? { reason: restricted.reason ?? "Restricted", allow: restricted.allow ?? [] } : null,
    price: price ? { multiplier: Math.min(2, price.multiplier ?? 1), reason: price.reason ?? "", appliesTo: price.applies_to } : null,
    notes: effects.filter((e) => e.type === "place_state" && e.place === place.id && e.note).map((e) => e.note!),
    unlocked: effects.filter((e) => e.type === "place_state" && e.place === place.id && e.unlock_action).map((e) => e.unlock_action!),
    events: (feed?.events ?? []).filter((e) => e.place === place.id),
  };
}

export function storyItemOpen(feed: StoryFeed | null, sku: string): { open: boolean; reason?: string } {
  const e = feed?.effects.find((x) => x.effect.type === "availability" && x.effect.sku === sku && x.effect.state === "open");
  return e ? { open: true, reason: e.effect.reason } : { open: false };
}

/** One chatter line for an NPC type: the story's current phase first, generic lines as the fallback. */
export function chatterLine(feed: StoryFeed | null, npc: string, generic: Record<string, string[]>, seed = Date.now()): string {
  for (const t of feed?.chatter ?? []) {
    const lines = t.lines?.[npc];
    if (lines?.length) return lines[seed % lines.length];
  }
  const g = generic[npc] ?? generic.bartender ?? ["Nice day for it."];
  return g[seed % g.length];
}

export const mainArc = (feed: StoryFeed | null) => feed?.arcs.find((a) => a.type === "main" && !a.finished) ?? null;

export function unseenBeats(feed: StoryFeed | null): number {
  return (feed?.arcs ?? []).filter((a) => !a.finished && (a.type === "main" || a.entitled)).reduce((n, a) => n + a.beats.filter((b) => !b.seen && !b.locked).length, 0);
}

export function badgeInfo(feed: StoryFeed | null, id: string) {
  for (const a of feed?.arcs ?? []) {
    const b = a.badges?.find((x) => x.id === id);
    if (b) return b;
  }
  return null;
}

export type StoryResult = { ok: true; feed: StoryFeed; clout?: number; message?: string } | { ok: false; error: string };

/** Everything the story screens can ask for. */
export interface StoryApi {
  refresh(offsetSeconds?: number): Promise<StoryResult>;
  vote(predictionId: string, optionId: string): Promise<StoryResult>;
  shadowGuess(predictionId: string, optionId: string): Promise<StoryResult>;
  markSeen(beatId: string): Promise<StoryResult>;
  completeTask(taskId: string): Promise<StoryResult>;
  attendEvent(eventId: string): Promise<StoryResult>;
  /** Staging only (dev tools): start the pilot on a given story day today, or unschedule (null). */
  devStart?(day: number | null): Promise<StoryResult>;
  devEntitle?(sku: string, on: boolean): Promise<StoryResult>;
}

const STORY_ERRORS: Record<string, string> = {
  voting_closed: "Voting's closed on this one. The truth is on its way.",
  unknown_prediction: "That prediction isn't open.",
  already_voted: "You already voted on this one, so the archive guess is off.",
  not_archived: "Shadow guesses open once the story is in the archive.",
  task_unavailable: "That story task has moved on. Stories wait for no one.",
  event_unavailable: "That event isn't happening anymore.",
  event_not_open: "That one's invitation only.",
  already_attended: "You were already there. Everyone saw you. It's fine.",
  no_energy: "Not enough Energy. Eat something, or sleep it off until tomorrow.",
  dev_tools_off: "Time travel is switched off here.",
};

export function storyError(message: string | undefined): string {
  if (message) for (const code of Object.keys(STORY_ERRORS)) if (message.includes(code)) return STORY_ERRORS[code];
  return "The newsroom glitched. Try again.";
}
