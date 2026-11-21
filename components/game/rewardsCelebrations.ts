// Credit for small progress and surprises (migration 0177, lib/rewards.ts): the cards GameShell shows for a goal half
// done (a banner), last week's recap (a results card, Mondays) and today's surprise (a banner, or a takeover for a
// celebrity's invite).

import type { Celebration } from "@/components/Celebrate";
import { GOAL_COPY } from "@/lib/goals";
import { momentText, type Surprise, type WeekRecap } from "@/lib/rewards";
import { scoreOf, type ScoreId } from "@/lib/scene";

export interface RewardsApi {
  halfway: () => Promise<{ id: string; clout: number }[]>;
  recap: () => Promise<WeekRecap | null>;
  surprise: () => Promise<Surprise | null>;
}

const n = (x: number) => x.toLocaleString("en-US");

export function halfwayCelebration(p: { id: string; clout: number }, onOpen?: () => void): Celebration {
  const copy = GOAL_COPY[p.id];
  return { rung: 2, emoji: copy?.emoji ?? "🎯", tag: "Halfway there", title: copy?.title ?? "A goal",
    rewards: [{ tone: "clout", text: `+${n(p.clout)} 🔥` }, { text: "The rest when it's done" }], onCta: onOpen };
}

export function recapCelebration(r: WeekRecap, onScene?: () => void): Celebration {
  const scores = (Object.entries(r.scores) as [ScoreId, number][]).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const top = scores[0];
  const bits = [
    r.cash > 0 ? `C$${n(r.cash)} earned` : null,
    r.fullDays ? `${r.fullDays} full ${r.fullDays === 1 ? "day" : "days"}` : null,
    r.moves ? `${r.moves} Scene ${r.moves === 1 ? "move" : "moves"}` : null,
    r.plaques ? `${r.plaques} ${r.plaques === 1 ? "plaque" : "plaques"}` : null,
  ].filter(Boolean) as string[];
  const keep = [
    ...(top ? [`${scoreOf(top[0]).emoji} Most known for ${scoreOf(top[0]).label} (+${n(top[1])})`] : []),
    ...(r.best ? [`⭐ Best moment: ${momentText(r.best.kind)} (+${n(r.best.clout)} 🔥)`] : []),
  ];
  return {
    rung: 3, emoji: "🗞️", tag: "Last week", title: r.clout >= 500 ? "What a week" : r.clout > 0 ? "Your week" : "A quiet week",
    lola: r.fullDays >= 5 ? "Five full days. People are starting to say your name right." : "New week, new chances to be seen.",
    cta: onScene ? "On to this week" : "Love that", onCta: onScene,
    result: { tone: "win", amount: r.clout, plain: true, unit: "clout gained", story: bits.join(" · ") || "Every week counts.", keep },
  };
}

export function surpriseCelebration(s: Surprise, onInvite?: () => void): Celebration {
  const rewards = [
    ...(s.cash ? [{ tone: "cash" as const, text: `+C$${n(s.cash)}` }] : []),
    ...(s.clout ? [{ tone: "clout" as const, text: `+${n(s.clout)} 🔥` }] : []),
    ...(s.energy ? [{ text: `+${s.energy} ⚡` }] : []),
    ...(s.mood ? [{ text: `+${s.mood} 😊` }] : []),
  ];
  if (s.kind === "invite" && s.invite) {
    return { rung: 3, emoji: s.emoji, tag: "A surprise", title: s.title, line: s.line, art: "people",
      rewards: [{ text: `💌 ${s.invite.title} free today` }], cta: "See Your Scene", onCta: onInvite,
      result: s.face ? { tone: "win", face: s.face, big: "Invited", story: s.line, keep: [`💌 Free today at ${s.invite.placeName}`] } : undefined };
  }
  return { rung: 2, emoji: s.emoji, tag: "A surprise", title: s.title, line: s.line, rewards };
}
