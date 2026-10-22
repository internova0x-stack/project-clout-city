// The story validation script's checks (World State Layer Brief v2, deliverable 5).
// Returns a list of problems; an empty list means the content can ship.

import { PLACES, SHOP_ITEMS } from "./city.ts";
import { PRICE_CAP, dayDiff, lastDay, nyTime, type Arc, type Phase } from "./stories.ts";

const STATUSES = ["active", "paused", "retired"];
const PHASES: Phase[] = ["early", "mid", "late", "post"];
const EFFECT_TYPES = ["price_multiplier", "availability", "chatter_topic", "task_injection", "place_state", "flag", "reward_modifier"];
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

export function validateArcs(arcs: Arc[]): string[] {
  const errors: string[] = [];
  const err = (arc: string, msg: string) => errors.push(`${arc}: ${msg}`);
  const placeTags = new Set(PLACES.flatMap((p) => p.tags));
  const placeIds = new Set(PLACES.map((p) => p.id));
  const byId = new Map(arcs.map((a) => [a.id, a]));
  if (byId.size !== arcs.length) errors.push("duplicate arc ids");

  for (const arc of arcs) {
    const a = arc.id;
    // ---- schema ----
    if (!/^[a-z0-9-]+$/.test(a)) err(a, "id must be kebab-case");
    if (!arc.title) err(a, "missing title");
    if (!["main", "side"].includes(arc.type)) err(a, "type must be main or side");
    if (!["free", "premium"].includes(arc.tier)) err(a, "tier must be free or premium");
    if (!STATUSES.includes(arc.status)) err(a, `bad status ${arc.status}`);
    if (arc.tier === "premium" && !arc.sku) err(a, "premium arcs need a sku");
    if (arc.type === "side") {
      if (!arc.parent_arc_id || !byId.has(arc.parent_arc_id)) err(a, "side arc needs an existing parent_arc_id");
      if (!arc.teaser) err(a, "side arc needs a teaser");
    }
    if (arc.type === "main" && arc.tier !== "free") err(a, "main arcs are always free");
    if (!arc.beats?.length) { err(a, "no beats"); continue; }

    // ---- start date and weekday ----
    if (arc.start_at) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(arc.start_at)) err(a, "start_at must be YYYY-MM-DD");
      else if (arc.start_weekday) {
        const wd = WEEKDAYS[new Date(`${arc.start_at}T12:00:00Z`).getUTCDay()];
        if (wd !== arc.start_weekday) err(a, `start_at ${arc.start_at} is a ${wd}, not a ${arc.start_weekday}`);
      }
    }
    if (arc.start_weekday && !WEEKDAYS.includes(arc.start_weekday)) err(a, `bad start_weekday ${arc.start_weekday}`);

    // ---- beats: ids, days, news ----
    const beatIds = new Set<string>();
    let prevDay = 0;
    for (const b of arc.beats) {
      if (beatIds.has(b.id)) err(a, `duplicate beat id ${b.id}`);
      beatIds.add(b.id);
      if (!Number.isInteger(b.day) || b.day < 1) err(a, `${b.id}: day must be a positive integer`);
      if (b.day < prevDay) err(a, `${b.id}: beats must be in day order`);
      prevDay = b.day;
      if (!STATUSES.includes(b.status)) err(a, `${b.id}: bad status`);
      if (!b.news?.[0]?.headline) err(a, `${b.id}: missing headline`);
      if (arc.type === "main" && b.day > 1 && !b.news?.[0]?.previously) err(a, `${b.id}: main beats after Day 1 need a "previously" line`);
      if (arc.type === "main" && !b.news?.[0]?.hook) err(a, `${b.id}: every main beat ends on a hook`);
      // A blog post (owner, Oct 22) is a real read: several paragraphs, and the card's body stays a short teaser.
      const post = b.news?.[0]?.post;
      if (post !== undefined) {
        const words = post.split(/\s+/).filter(Boolean).length;
        if (words < 300) err(a, `${b.id}: the post is ${words} words; a blog post needs at least 300`);
        if (post.split(/\n\s*\n/).length < 3) err(a, `${b.id}: the post needs paragraphs (a blank line between them)`);
        if ((b.news[0].body ?? "").length > 400) err(a, `${b.id}: with a post, the body is the teaser (400 characters at most)`);
      }
    }
    if (arc.type === "main") {
      const days = arc.beats.map((b) => b.day);
      if (new Set(days).size !== days.length) err(a, "two main beats on the same day");
    }
    if (arc.type === "side" && arc.parent_arc_id && byId.has(arc.parent_arc_id)) {
      const parentLast = lastDay(byId.get(arc.parent_arc_id)!);
      for (const b of arc.beats) if (b.day > parentLast) err(a, `${b.id}: drops after the parent arc ends`);
      if (arc.beats.some((b) => b.effects.some((e) => e.type !== "flag"))) err(a, "side-arc effects are personal-layer only; shared effects are not allowed");
    }

    // ---- effects: types, tags, expiries, caps ----
    const eventIds = new Set((arc.events ?? []).map((e) => e.id));
    const taskIds = new Set((arc.tasks ?? []).map((t) => t.id));
    for (const ev of arc.events ?? []) if (!placeIds.has(ev.place)) err(a, `event ${ev.id}: unknown place ${ev.place}`);
    const addedTags = new Set(arc.beats.flatMap((b) => b.effects.flatMap((e) => e.add_tags ?? [])));
    for (const b of arc.beats) {
      for (const e of b.effects) {
        const where = `${b.id} ${e.type}`;
        if (!EFFECT_TYPES.includes(e.type)) { err(a, `${where}: unknown effect type`); continue; }
        if (e.expires_day !== undefined && e.expires_day <= b.day) err(a, `${where}: expires_day must be after the beat's day`);
        for (const t of e.tags ?? []) if (!placeTags.has(t) && !addedTags.has(t)) err(a, `${where}: unknown tag ${t}`);
        if (e.type === "price_multiplier") {
          if (!e.applies_to) err(a, `${where}: needs applies_to`);
          if (!(e.multiplier! > 0)) err(a, `${where}: multiplier must be positive`);
          if (e.multiplier! > PRICE_CAP) err(a, `${where}: multiplier above the ${PRICE_CAP}x cap`);
          if (!e.reason) err(a, `${where}: price changes need reason text`);
          if (e.expires_day === undefined) err(a, `${where}: every price change must expire`);
        }
        if (e.type === "availability") {
          if (!["closed", "restricted", "open"].includes(e.state ?? "")) err(a, `${where}: bad state`);
          if (!e.reason) err(a, `${where}: availability changes need reason text`);
          if (!e.tags?.length && !e.sku) err(a, `${where}: needs tags or a sku`);
          if (e.sku && !SHOP_ITEMS.some((i) => i.sku === e.sku)) err(a, `${where}: unknown sku ${e.sku}`);
          if (e.state !== "open" && e.expires_day === undefined) err(a, `${where}: closures must expire`);
        }
        if (e.type === "chatter_topic" && (!e.topic || !PHASES.includes(e.phase as Phase))) err(a, `${where}: needs topic and a phase`);
        if (e.type === "task_injection") for (const id of [...(e.add ?? []), ...(e.remove ?? [])]) if (!taskIds.has(id)) err(a, `${where}: unknown task ${id}`);
        if (e.type === "place_state") {
          if (!e.place || !placeIds.has(e.place)) err(a, `${where}: unknown place ${e.place}`);
          if (e.spawn_event && !eventIds.has(e.spawn_event)) err(a, `${where}: unknown event ${e.spawn_event}`);
          if (e.cancel_event && !eventIds.has(e.cancel_event)) err(a, `${where}: unknown event ${e.cancel_event}`);
          const place = PLACES.find((p) => p.id === e.place);
          if (e.unlock_action && !place?.actions.some((x) => x.id === e.unlock_action && x.storyUnlock)) err(a, `${where}: ${e.unlock_action} is not a story-unlock action`);
        }
        if (e.type === "flag" && !e.set) err(a, `${where}: needs set`);
      }
    }

    // ---- story tasks ----
    for (const t of arc.tasks ?? []) {
      if (!t.id.startsWith(`story:${a}:`)) err(a, `task ${t.id}: ids are story:<arc_id>:<task>`);
      const d = t.do;
      if (d.place) {
        const place = PLACES.find((p) => p.id === d.place);
        if (!place) err(a, `task ${t.id}: unknown place`);
        else if (!place.actions.some((x) => x.id === d.action)) err(a, `task ${t.id}: unknown action ${d.action}`);
      } else if (d.event) {
        if (!eventIds.has(d.event)) err(a, `task ${t.id}: unknown event`);
      } else if (d.share || d.evidence) {
        const beat = arc.beats.find((b) => b.id === (d.share ?? d.evidence));
        if (!beat) err(a, `task ${t.id}: unknown beat`);
        if (d.evidence && !beat?.evidence) err(a, `task ${t.id}: beat has no evidence card`);
      } else err(a, `task ${t.id}: needs place, event, share or evidence`);
      if (arc.type === "side" && t.clout > 0) err(a, `task ${t.id}: side-arc tasks earn no clout`);
    }

    // ---- predictions ----
    const badgeIds = new Set((arc.badges ?? []).map((x) => x.id));
    const anchor = arc.start_at ?? "2026-11-01";
    const pointers = arc.beats.filter((b) => b.points_at_answer);
    const predIds = new Set<string>();
    for (const b of arc.beats) {
      const p = b.prediction;
      if (!p) continue;
      if (predIds.has(p.id)) err(a, `duplicate prediction ${p.id}`);
      predIds.add(p.id);
      if (p.options.length < 2) err(a, `${p.id}: needs at least two options`);
      if (!p.options.some((o) => o.id === p.correct)) err(a, `${p.id}: correct answer is not an option`);
      const reveal = arc.beats.find((x) => x.id === p.reveal_beat);
      if (!reveal) err(a, `${p.id}: unknown reveal beat`);
      if (p.closes_at.day < b.day) err(a, `${p.id}: closes before it opens`);
      if (!/^\d{2}:\d{2}$/.test(p.closes_at.time)) err(a, `${p.id}: closes_at.time must be HH:MM`);
      const closes = nyTime(anchor, p.closes_at.day, p.closes_at.time);
      if (reveal && closes >= nyTime(anchor, reveal.day)) err(a, `${p.id}: must close before its reveal beat`);
      for (const ptr of pointers) if (ptr.day > b.day && closes >= nyTime(anchor, ptr.day)) err(a, `${p.id}: closes after ${ptr.id}, which points at the answer`);
      if (p.reward.badge && !badgeIds.has(p.reward.badge)) err(a, `${p.id}: unknown badge ${p.reward.badge}`);
      if (arc.type === "side") err(a, `${p.id}: side arcs can't hold predictions`);
    }
    if (arc.shadow_badge && !badgeIds.has(arc.shadow_badge)) err(a, "shadow_badge: unknown badge");
    if (arc.bonus_badge) {
      if (!badgeIds.has(arc.bonus_badge.badge)) err(a, "bonus_badge: unknown badge");
      for (const id of arc.bonus_badge.requires) if (!predIds.has(id)) err(a, `bonus_badge: unknown prediction ${id}`);
    }

    // ---- premium beats: no paid edge before voting closes ----
    if (arc.type === "side" && arc.parent_arc_id && byId.has(arc.parent_arc_id)) {
      const parent = byId.get(arc.parent_arc_id)!;
      const lastClose = Math.max(...parent.beats.filter((x) => x.prediction).map((x) => nyTime(anchor, x.prediction!.closes_at.day, x.prediction!.closes_at.time)), 0);
      for (const b of arc.beats) if (b.points_at_answer && nyTime(anchor, b.day) <= lastClose) err(a, `${b.id}: premium beat points at the answer before voting closes`);
    }

    // ---- chatter ----
    for (const [topic, phases] of Object.entries(arc.chatter ?? {})) {
      for (const [phase, npcs] of Object.entries(phases)) {
        if (!PHASES.includes(phase as Phase)) err(a, `chatter ${topic}: bad phase ${phase}`);
        for (const [npc, lines] of Object.entries(npcs ?? {})) if (lines.length < 2 || lines.length > 3) err(a, `chatter ${topic}/${phase}/${npc}: 2 to 3 lines`);
      }
    }
  }

  // ---- no finale collisions between scheduled main arcs ----
  const finales = arcs.filter((x) => x.type === "main" && x.start_at && x.status === "active").map((x) => ({ id: x.id, day: dayDiff("2000-01-01", x.start_at!) + lastDay(x) }));
  for (let i = 0; i < finales.length; i++) for (let j = i + 1; j < finales.length; j++) if (finales[i].day === finales[j].day) errors.push(`${finales[i].id} and ${finales[j].id} end on the same day`);

  return errors;
}
