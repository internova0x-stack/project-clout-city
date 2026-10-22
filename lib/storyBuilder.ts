// The Studio's story builder (owner, Oct 17: "a create story button, that goes into a story creation
// interface"). The builder edits a draft Arc; these pure helpers name things, add beats and clean the draft
// into the same JSON a story file holds, so it goes through the same checks (lib/storyValidation.ts) and
// the same upload as a file. Safe to import anywhere.

import type { Arc, Beat, Phase, Prediction, StoryEffect, StoryEvent, StoryTask } from "./stories.ts";

export const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;
export const PHASES: Phase[] = ["early", "mid", "late", "post"];
/** Who says chatter lines in places (the regulars' roles, lib/cast.ts). */
export const CHATTER_ROLES = ["bartender", "barista", "doorman", "driver", "clerk"] as const;
export const EVIDENCE_KINDS = ["story-post", "document", "photo", "voice-note", "receipt", "text-thread"] as const;
export const SIDE_KINDS = ["insider", "evidence", "perspective"] as const;

/** "The Bodega Cat Heist" → "the-bodega-cat-heist". */
export function slugify(s: string): string {
  return s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
}

/** A story id from its title, without a leading "the". */
export function arcIdFrom(title: string): string {
  return slugify(title.replace(/^\s*the\s+/i, ""));
}

/** Beat ids start with the id's initials: "bodega-cat-heist" → "bch". */
export function beatPrefix(arcId: string): string {
  const parts = arcId.split("-").filter(Boolean);
  if (!parts.length) return "b";
  return parts.length === 1 ? parts[0].slice(0, 3) : parts.map((p) => p[0]).join("").slice(0, 4);
}

/** A side story's product code. */
export const sideSku = (arcId: string) => `side_${arcId.replace(/-/g, "_")}`;

export function newArc(type: Arc["type"] = "main", parent?: string): Arc {
  return {
    id: "", title: "", type, tier: type === "main" ? "free" : "premium", status: "active",
    ...(type === "main" ? { start_weekday: "sunday", borough_scope: ["queens"] } : { parent_arc_id: parent ?? "", kind: "insider", teaser: "" }),
    emoji: "", prompt: "", beats: [],
  };
}

/** The next beat: the next free id, the day after the last beat. */
export function nextBeat(arc: Arc): Beat {
  const prefix = beatPrefix(arc.id || "story");
  const used = new Set(arc.beats.map((b) => b.id));
  let n = arc.beats.length + 1;
  while (used.has(`${prefix}-${n}`)) n++;
  const day = arc.beats.length ? Math.max(...arc.beats.map((b) => b.day)) + 1 : 1;
  return { id: `${prefix}-${n}`, day, status: "active", news: [{ headline: "", hook: "", body: "", ...(arc.type === "main" && day > 1 ? { previously: "" } : {}) }], effects: [] };
}

/** The next free prediction id in the story (P1, P2, …). */
export function nextPredictionId(arc: Arc): string {
  const used = new Set(arc.beats.flatMap((b) => (b.prediction ? [b.prediction.id] : [])));
  let n = 1;
  while (used.has(`P${n}`)) n++;
  return `P${n}`;
}

export function newPrediction(arc: Arc, beat: Beat): Prediction {
  // Revealed two days on if there's a beat there, else the next one; voting closes the night before the reveal.
  const later = arc.beats.filter((b) => b.day > beat.day).sort((a, b) => a.day - b.day);
  const reveal = later.find((b) => b.day > beat.day + 1) ?? later[0];
  return {
    id: nextPredictionId(arc), question: "", options: [{ id: "a", label: "" }, { id: "b", label: "" }],
    closes_at: { day: reveal ? reveal.day - 1 : beat.day, time: "23:59" }, reveal_beat: reveal?.id ?? "", correct: "a", reward: { clout: 50 }, changeable: true,
  };
}

/** A starting point for each kind of city change. */
export function newEffect(type: StoryEffect["type"], beat: Beat): StoryEffect {
  const expires = beat.day + 3;
  switch (type) {
    case "price_multiplier": return { type, tags: [], applies_to: "visit_price", multiplier: 1.5, reason: "", expires_day: expires };
    case "availability": return { type, state: "closed", tags: [], reason: "", expires_day: expires };
    case "chatter_topic": return { type, topic: "", phase: "early", priority: 1 };
    case "task_injection": return { type, add: [] };
    case "place_state": return { type, place: "", note: "" };
    case "flag": return { type, set: "" };
    default: return { type };
  }
}

export const optionId = (label: string, taken: string[]) => {
  const base = slugify(label).slice(0, 24) || "option";
  let id = base, n = 2;
  while (taken.includes(id)) id = `${base}-${n++}`;
  return id;
};

const text = (s: unknown) => (typeof s === "string" ? s.trim() : "");
const list = (a: unknown) => (Array.isArray(a) ? a.map((x) => text(x)).filter(Boolean) : []);

/** The task id's last part ("story:sarah-bird:light-candle" → "light-candle"). */
export const taskSlug = (id: string) => id.split(":").pop() ?? id;

function cleanEffect(e: StoryEffect, arcId: string): StoryEffect {
  const out: StoryEffect = { type: e.type };
  const o = out as unknown as Record<string, unknown>;
  for (const [k, v] of Object.entries(e)) {
    if (k === "type" || v === undefined || v === null) continue;
    if (typeof v === "string") { if (v.trim()) o[k] = v.trim(); continue; }
    if (Array.isArray(v)) {
      const items = list(v).map((x) => (k === "add" || k === "remove" ? `story:${arcId}:${taskSlug(x)}` : x));
      if (items.length) o[k] = items;
      continue;
    }
    if (typeof v === "number" && Number.isNaN(v)) continue;
    o[k] = v;
  }
  return out;
}

function cleanBeat(b: Beat, arc: Arc): Beat {
  const news = b.news.map((n) => {
    const item: Beat["news"][number] = { headline: text(n.headline) };
    if (text(n.previously)) item.previously = text(n.previously);
    else if (n.previously === null) item.previously = null;
    if (text(n.body)) item.body = text(n.body);
    if (text(n.hook)) item.hook = text(n.hook);
    if (text(n.post)) item.post = text(n.post);
    return item;
  });
  const out: Beat = { id: b.id, day: b.day, status: b.status ?? "active", news, effects: b.effects.map((e) => cleanEffect(e, arc.id)) };
  if (b.points_at_answer) out.points_at_answer = true;
  if (text(b.card_note)) out.card_note = text(b.card_note);
  if (b.evidence) out.evidence = { title: text(b.evidence.title), kind: text(b.evidence.kind) || "document", lines: list(b.evidence.lines) };
  if (b.prediction) {
    const p = b.prediction;
    const roasts = Object.fromEntries(Object.entries(p.roasts ?? {}).filter(([k, v]) => k !== p.correct && text(v) && p.options.some((o) => o.id === k)).map(([k, v]) => [k, text(v)]));
    out.prediction = {
      id: p.id, question: text(p.question), options: p.options.map((o) => ({ id: o.id, label: text(o.label) })),
      closes_at: { day: Number(p.closes_at.day), time: text(p.closes_at.time) || "23:59" }, reveal_beat: p.reveal_beat, correct: p.correct,
      reward: { clout: Number(p.reward.clout) || 0, ...(text(p.reward.badge) ? { badge: text(p.reward.badge) } : {}) },
      ...(p.changeable ? { changeable: true } : {}),
      ...(Object.keys(roasts).length ? { roasts } : {}),
    };
  }
  return out;
}

/**
 * The draft as a story file: ids follow the title, empty optional text and lists are dropped, main stories are
 * free and side stories paid with their product code, and story tasks are named story:<id>:<task>.
 */
export function cleanArc(draft: Arc): Arc {
  const id = text(draft.id) || arcIdFrom(draft.title);
  const arc: Arc = { id, title: text(draft.title), type: draft.type, tier: draft.type === "main" ? "free" : "premium", status: draft.status ?? "active", beats: [] };
  if (draft.type === "side") {
    arc.parent_arc_id = text(draft.parent_arc_id);
    arc.sku = text(draft.sku) || sideSku(id);
    if (text(draft.kind)) arc.kind = text(draft.kind);
    arc.teaser = text(draft.teaser);
  } else {
    if (draft.start_weekday) arc.start_weekday = draft.start_weekday;
    if (draft.borough_scope?.length) arc.borough_scope = draft.borough_scope;
    if (text(draft.teaser)) arc.teaser = text(draft.teaser);
    if (draft.answer_key && Object.keys(draft.answer_key).length) arc.answer_key = draft.answer_key;
  }
  if (draft.start_at !== undefined) arc.start_at = draft.start_at;
  if (text(draft.emoji)) arc.emoji = text(draft.emoji);
  if (text(draft.prompt)) arc.prompt = text(draft.prompt);
  const badges = (draft.badges ?? []).filter((b) => text(b.name)).map((b) => ({ id: text(b.id) || slugify(b.name), name: text(b.name), emoji: text(b.emoji) || "🏅", line: text(b.line) }));
  if (badges.length) arc.badges = badges;
  if (draft.bonus_badge?.badge && draft.bonus_badge.requires.length) arc.bonus_badge = draft.bonus_badge;
  if (text(draft.shadow_badge)) arc.shadow_badge = text(draft.shadow_badge);
  const tasks: StoryTask[] = (draft.tasks ?? []).filter((t) => text(t.label)).map((t) => {
    const d = Object.fromEntries(Object.entries(t.do).filter(([, v]) => text(v))) as StoryTask["do"];
    return { id: `story:${id}:${slugify(taskSlug(t.id)) || slugify(t.label)}`, label: text(t.label), do: d, clout: draft.type === "side" ? 0 : Number(t.clout) || 0 };
  });
  if (tasks.length) arc.tasks = tasks;
  const events: StoryEvent[] = (draft.events ?? []).filter((e) => text(e.name)).map((e) => ({
    id: text(e.id) || slugify(e.name), name: text(e.name), place: e.place, attendable: !!e.attendable,
    ...(e.attendable ? { energy: Number(e.energy) || 0, clout: Number(e.clout) || 0, mood: Number(e.mood) || 0 } : {}),
    blurb: text(e.blurb),
  }));
  if (events.length) arc.events = events;
  arc.beats = draft.beats.map((b) => cleanBeat(b, { ...draft, id }));
  const chatter: NonNullable<Arc["chatter"]> = {};
  for (const [topic, phases] of Object.entries(draft.chatter ?? {})) {
    const t: Partial<Record<Phase, Record<string, string[]>>> = {};
    for (const [phase, roles] of Object.entries(phases ?? {})) {
      const r = Object.fromEntries(Object.entries(roles ?? {}).map(([role, lines]) => [role, list(lines)]).filter(([, lines]) => lines.length));
      if (Object.keys(r).length) t[phase as Phase] = r;
    }
    if (text(topic) && Object.keys(t).length) chatter[text(topic)] = t;
  }
  if (Object.keys(chatter).length) arc.chatter = chatter;
  return arc;
}

/** Problems for this story only (the checker also looks at the stories it leans on). */
export function ownProblems(problems: string[], arcId: string): string[] {
  return problems.filter((p) => p.startsWith(`${arcId}:`) || !p.includes(":") || p.includes(` ${arcId} `) || p.startsWith(`${arcId} and`));
}
