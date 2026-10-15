// Builds a player's story feed from content in TypeScript, mirroring story_feed()
// in supabase/migrations/0007. Used by development previews, tests and the Story
// Studio's player preview (admins only), never by the live game, which asks the
// database. It takes arcs as input and never loads story files itself.

import {
  activeChatter, activeEffects, lastDay, nyTime, predictionWindow, storyDay, type Arc,
} from "./stories.ts";
import type { FeedArc, FeedPrediction, StoryFeed } from "./storyFeed.ts";

export interface PlayerStoryState {
  votes: Record<string, string>;
  shadow: Record<string, string>;
  seen: string[];
  tasksDone: string[];
  badges: { id: string; arc: string; earnedAt: string }[];
  skus: string[];
  /** Clout already paid per reward key, so rewards pay once. */
  paid: string[];
}

export const emptyStoryState = (): PlayerStoryState => ({ votes: {}, shadow: {}, seen: [], tasksDone: [], badges: [], skus: [], paid: [] });

const nyDate = (ms: number) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date(ms));

/** The arc as players see it: approved, active and started (side arcs follow their parent). */
function liveDay(arc: Arc, arcs: Arc[], starts: Record<string, string | null>, today: string): number | null {
  if (arc.status !== "active") return null;
  const startOf = (a: Arc) => (a.type === "side" ? starts[a.parent_arc_id!] ?? null : starts[a.id] ?? a.start_at ?? null);
  if (arc.type === "side") {
    const parent = arcs.find((a) => a.id === arc.parent_arc_id);
    if (!parent || parent.status !== "active") return null;
  }
  return storyDay(arc, today, startOf(arc));
}

/** Pays revealed prediction rewards and badges once. Returns clout earned now. */
export function claimRewards(arcs: Arc[], starts: Record<string, string | null>, nowMs: number, st: PlayerStoryState): number {
  let clout = 0;
  const today = nyDate(nowMs);
  for (const arc of arcs.filter((a) => a.type === "main")) {
    const day = liveDay(arc, arcs, starts, today);
    const start = starts[arc.id] ?? arc.start_at;
    if (day === null || !start) continue;
    const right: string[] = [];
    for (const b of arc.beats.filter((x) => x.prediction && x.status === "active" && x.day <= day)) {
      const p = b.prediction!;
      const w = predictionWindow(arc, b, p, start);
      if (nowMs < w.reveals || st.votes[p.id] !== p.correct) continue;
      right.push(p.id);
      if (!st.paid.includes(p.id)) {
        st.paid.push(p.id);
        clout += p.reward.clout;
      }
      if (p.reward.badge && !st.badges.some((x) => x.id === p.reward.badge)) st.badges.push({ id: p.reward.badge, arc: arc.id, earnedAt: new Date(nowMs).toISOString() });
    }
    const bonus = arc.bonus_badge;
    if (bonus && bonus.requires.every((id) => right.includes(id)) && !st.badges.some((x) => x.id === bonus.badge)) {
      st.badges.push({ id: bonus.badge, arc: arc.id, earnedAt: new Date(nowMs).toISOString() });
    }
  }
  return clout;
}

/** All votes cast by everyone, for live results (previews pass a few simulated voters). */
export type VoteCounts = Record<string, Record<string, number>>;

export function buildFeed(arcs: Arc[], starts: Record<string, string | null>, nowMs: number, st: PlayerStoryState, counts: VoteCounts = {}): StoryFeed {
  const today = nyDate(nowMs);
  const out: FeedArc[] = [];
  for (const arc of [...arcs].sort((a, b) => (a.type === b.type ? a.id.localeCompare(b.id) : a.type === "main" ? -1 : 1))) {
    const day = liveDay(arc, arcs, starts, today);
    if (day === null) continue;
    const start = arc.type === "side" ? starts[arc.parent_arc_id!] ?? null : starts[arc.id] ?? arc.start_at ?? null;
    // VIP (migration 0052): monthly and yearly members have every side story.
    const vip = st.skus.includes("chat-unlimited-monthly") || st.skus.includes("chat-unlimited-yearly");
    const entitled = arc.type === "main" || st.skus.includes(arc.sku ?? "") || (arc.type === "side" && vip);
    const finished = day > lastDay(arc);
    const beats = arc.beats.filter((b) => b.status === "active" && b.day <= day).map((b) => ({
      id: b.id, day: b.day, headline: b.news[0].headline, locked: !entitled, seen: st.seen.includes(b.id),
      ...(entitled ? {
        body: b.news[0].body, hook: b.news[0].hook, previously: b.news[0].previously ?? undefined, cardNote: b.card_note,
        evidence: b.evidence, pointsAtAnswer: b.points_at_answer,
      } : {}),
    }));
    const predictions: FeedPrediction[] = [];
    if (arc.type === "main" && start) {
      for (const b of arc.beats.filter((x) => x.prediction && x.status === "active" && x.day <= day)) {
        const p = b.prediction!;
        const w = predictionWindow(arc, b, p, start);
        const state = nowMs <= w.closes ? "open" : nowMs < w.reveals ? "closed" : "revealed";
        const my = st.votes[p.id];
        const shadow = st.shadow[p.id];
        const c = { ...(counts[p.id] ?? {}) };
        if (my) c[my] = (c[my] ?? 0) + 1;
        const total = Object.values(c).reduce((x, y) => x + y, 0);
        const revealed = state === "revealed";
        predictions.push({
          id: p.id, beatId: b.id, question: p.question, options: p.options, reward: p.reward,
          revealBeat: p.reveal_beat,
          closesAt: new Date(w.closes).toISOString(), revealsAt: Number.isFinite(w.reveals) ? new Date(w.reveals).toISOString() : undefined,
          state, myVote: my, shadowGuess: shadow,
          results: my || state !== "open" ? { total, counts: c } : undefined,
          correct: revealed && (!finished || my || shadow) ? p.correct : undefined,
          roast: revealed && my && my !== p.correct ? p.roasts?.[my] : undefined,
        });
      }
    }
    out.push({
      id: arc.id, title: arc.title, type: arc.type, kind: arc.kind, tier: arc.tier, sku: arc.sku, parent: arc.parent_arc_id,
      teaser: arc.teaser, emoji: arc.emoji, prompt: arc.prompt, day, lastDay: lastDay(arc), finished, entitled, beats, predictions, badges: arc.badges,
    });
  }
  const effects = activeEffects(arcs.filter((a) => liveDay(a, arcs, starts, today) !== null), today, starts);
  const events = effects
    .filter((x) => x.effect.type === "place_state" && x.effect.spawn_event)
    .map((x) => {
      const arc = arcs.find((a) => a.id === x.arc)!;
      const ev = arc.events!.find((e) => e.id === x.effect.spawn_event)!;
      return { ...ev, arc: arc.id, cancelled: effects.some((y) => y.effect.cancel_event === ev.id) };
    });
  const tasks = effects
    .filter((x) => x.effect.type === "task_injection")
    .flatMap((x) => (x.effect.add ?? []).map((id) => ({ ...arcs.find((a) => a.id === x.arc)!.tasks!.find((t) => t.id === id)!, arc: x.arc, done: st.tasksDone.includes(id) })));
  const chatter = activeChatter(effects).map((c) => ({
    topic: c.topic, phase: c.phase, priority: 2, lines: (arcs.find((a) => a.id === c.arc)?.chatter?.[c.topic]?.[c.phase] as Record<string, string[]>) ?? null,
  }));
  return {
    today,
    arcs: out,
    effects: effects.filter((x) => ["price_multiplier", "availability", "place_state", "flag"].includes(x.effect.type)).map((x) => ({ arc: x.arc, beat: x.beat, effect: x.effect })),
    events,
    tasks,
    chatter,
    badges: st.badges,
    startedArcs: arcs.filter((a) => liveDay(a, arcs, starts, today) !== null).map((a) => a.id),
  };
}

/** Vote rules (mirrors vote_prediction): only while open; changeable unless the prediction says not. */
export function castVote(arcs: Arc[], starts: Record<string, string | null>, nowMs: number, st: PlayerStoryState, pid: string, option: string): string | null {
  for (const arc of arcs.filter((a) => a.type === "main")) {
    const start = starts[arc.id] ?? arc.start_at;
    const b = arc.beats.find((x) => x.prediction?.id === pid);
    if (!b || !start) continue;
    const w = predictionWindow(arc, b, b.prediction!, start);
    if (nowMs < w.opens || nowMs > w.closes) return "Voting is closed.";
    if (!b.prediction!.options.some((o) => o.id === option)) return "That isn't an option.";
    if (st.votes[pid] && b.prediction!.changeable === false) return "Your vote is locked in.";
    st.votes[pid] = option;
    return null;
  }
  return "That prediction isn't open.";
}

export { nyTime };
