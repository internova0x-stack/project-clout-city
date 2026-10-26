// Push notifications (owner, Oct 18: push only; 4 a day plus chat; quiet hours 10 PM to 9 AM; win-back in). The rules
// the sender (lib/pushServer.ts, app/api/push/run) applies to a player's queue (push_queue, migration 0078): which push
// goes now, which merge into it, which wait and which are dropped. Pure, so tests/push.test.ts can check every rule.

export type PushCategory = "messages" | "social" | "money" | "reminders" | "rewards" | "news";

/** The switches in Settings → Notifications. */
export const PUSH_CATEGORIES: readonly { id: PushCategory; label: string; emoji: string; line: string }[] = [
  { id: "messages", label: "Messages", emoji: "💬", line: "When someone texts you. Bundled, so your phone survives." },
  { id: "social", label: "Dates & crew", emoji: "💘", line: "Matches, date invites, your crew heading out." },
  { id: "money", label: "Money & bills", emoji: "💸", line: "Rent due, gigs ready, a full till." },
  { id: "reminders", label: "Reminders", emoji: "⏰", line: "Streaks about to end, exams, party night." },
  { id: "rewards", label: "Rewards", emoji: "🏆", line: "Rank ups, goals, grades, lotto wins." },
  { id: "news", label: "News & hunts", emoji: "📰", line: "One morning roundup: new tasks, hunts, gossip, big news." },
];

/** 0: someone's waiting on you; 1: something expires or costs you; 2: you won something; 3: come back and play. */
export type PushTier = 0 | 1 | 2 | 3;

export interface PushKind {
  tier: PushTier;
  category: PushCategory;
  /** Minutes after it's queued that it stops being worth sending (a deadline can end it sooner). */
  ttlMin: number;
  /** May go out during quiet hours (a date that's happening right now). */
  quietOk?: boolean;
}

export const PUSH_KINDS: Record<string, PushKind> = {
  // P0: someone is waiting on you
  message: { tier: 0, category: "messages", ttlMin: 360 },
  crush_match: { tier: 0, category: "social", ttlMin: 1440 },
  date_invite: { tier: 0, category: "social", ttlMin: 720 },
  date_now: { tier: 0, category: "social", ttlMin: 90, quietOk: true },
  crew_invite: { tier: 0, category: "social", ttlMin: 720 },
  crew_there: { tier: 0, category: "social", ttlMin: 120 },
  ride_request: { tier: 0, category: "social", ttlMin: 60 },
  together_invite: { tier: 0, category: "social", ttlMin: 720 },
  friend_joined: { tier: 0, category: "social", ttlMin: 2880 },
  calendar_invite: { tier: 0, category: "social", ttlMin: 1440 },
  // Relationships (migration 0118)
  couple_ask: { tier: 0, category: "social", ttlMin: 2880 },
  couple_gift: { tier: 0, category: "social", ttlMin: 1440 },
  // Having people over (migration 0121)
  visit_invite: { tier: 0, category: "social", ttlMin: 720 },
  // Sublets (migration 0119)
  sublet_app: { tier: 0, category: "social", ttlMin: 1440 },
  sublet_accepted: { tier: 0, category: "social", ttlMin: 1440 },
  sublet_renew: { tier: 0, category: "social", ttlMin: 1440 },
  sublet_hang: { tier: 0, category: "social", ttlMin: 240 },
  sublet_notice: { tier: 1, category: "money", ttlMin: 1440 },
  sublet_ended: { tier: 1, category: "money", ttlMin: 1440 },
  // P1: something expires or costs you
  bill_due: { tier: 1, category: "money", ttlMin: 1440 },
  bill_overdue: { tier: 1, category: "money", ttlMin: 1440 },
  eviction_warning: { tier: 1, category: "money", ttlMin: 1440 },
  rent_short: { tier: 1, category: "money", ttlMin: 1440 },
  gig_ready: { tier: 1, category: "money", ttlMin: 720 },
  till_full: { tier: 1, category: "money", ttlMin: 1440 },
  streak_risk: { tier: 1, category: "reminders", ttlMin: 300 },
  exams_open: { tier: 1, category: "reminders", ttlMin: 720 },
  exams_last_day: { tier: 1, category: "reminders", ttlMin: 600 },
  party_soon: { tier: 1, category: "reminders", ttlMin: 60 },
  event_ticket: { tier: 1, category: "reminders", ttlMin: 90 },
  pass_tonight: { tier: 1, category: "reminders", ttlMin: 240 },
  calendar_tonight: { tier: 1, category: "reminders", ttlMin: 300 },
  // P2: you won something
  rank_up: { tier: 2, category: "rewards", ttlMin: 1440 },
  goal_done: { tier: 2, category: "rewards", ttlMin: 1440 },
  streak_reward: { tier: 2, category: "rewards", ttlMin: 1440 },
  skill_up: { tier: 2, category: "rewards", ttlMin: 1440 },
  grades: { tier: 2, category: "rewards", ttlMin: 1440 },
  lotto_win: { tier: 2, category: "rewards", ttlMin: 1440 },
  radio_on_air: { tier: 2, category: "rewards", ttlMin: 30 },
  tv_on_screen: { tier: 2, category: "rewards", ttlMin: 180 },
  // P3: come back and play (only ever in the morning roundup)
  daily_tasks: { tier: 3, category: "news", ttlMin: 600 },
  hunt_new: { tier: 3, category: "news", ttlMin: 2880 },
  gossip_new: { tier: 3, category: "news", ttlMin: 2880 },
  story_beat: { tier: 3, category: "news", ttlMin: 1440 },
  borough_open: { tier: 3, category: "news", ttlMin: 2880 },
  winback: { tier: 3, category: "news", ttlMin: 1440 },
};

/** The numbers (owner, Oct 18). */
export const PUSH_RULES = {
  /** Pushes a day outside Messages (the player's local day). */
  perDay: 4,
  /** Minutes between two non-chat pushes. */
  gapMin: 15,
  /** Minutes between two chat pushes. */
  chatGapMin: 10,
  /** Quiet hours, local: from 22:00 to 09:00. */
  quiet: { from: 22, to: 9 },
  /** The morning roundup (P3) goes out between these local hours. */
  digest: { from: 9, to: 21 },
  tierScore: [100, 70, 50, 20] as const,
  /** Up to this much more as a deadline gets close (within the window). */
  urgencyMax: 30,
  urgencyWindowMin: 360,
  /** From a crush, a match or the crew. */
  closeBonus: 15,
  /** Less for each push already sent today. */
  fatiguePerSent: 10,
  /** In the game in the last this-many minutes: no push (they'd see it in the game). */
  activeMin: 2,
};

export interface QueuedPush {
  id: number;
  kind: string;
  group_key: string | null;
  title: string;
  body: string;
  url: string;
  deadline_at: string | null;
  close: boolean;
  created_at: string;
}

export interface PushContext {
  now: Date;
  tz: string;
  off: string[];
  /** Non-chat pushes sent today (local day), and when the last one went. */
  sentToday: number;
  lastSentAt: Date | null;
  lastChatAt: Date | null;
  /** In the game right now. */
  active: boolean;
}

export interface PushPlan {
  /** The one push to send now (its id and the ids merged into it), or null. */
  send: { ids: number[]; title: string; body: string; url: string; tag: string; chat: boolean } | null;
  drop: { id: number; reason: "expired" | "off" | "in_game" | "unknown" }[];
}

/** The local hour (0 to 23) in a time zone, falling back to New York. */
export function localHour(now: Date, tz: string): number {
  const at = (zone: string) => Number(new Intl.DateTimeFormat("en-US", { timeZone: zone, hour: "numeric", hourCycle: "h23" }).format(now));
  try { return at(tz); } catch { return at("America/New_York"); }
}

/** The local date (YYYY-MM-DD) in a time zone, for "today's" cap. */
export function localDate(now: Date, tz: string): string {
  const at = (zone: string) => new Intl.DateTimeFormat("en-CA", { timeZone: zone }).format(now);
  try { return at(tz); } catch { return at("America/New_York"); }
}

export const isQuiet = (hour: number, q = PUSH_RULES.quiet) => (q.from > q.to ? hour >= q.from || hour < q.to : hour >= q.from && hour < q.to);

const minutes = (a: Date, b: Date) => (a.getTime() - b.getTime()) / 60_000;

/** When a push stops mattering: its kind's expiry, or its deadline if sooner. */
export function expiresAt(p: QueuedPush, k: PushKind): Date {
  const ttl = new Date(Date.parse(p.created_at) + k.ttlMin * 60_000);
  return p.deadline_at && Date.parse(p.deadline_at) < ttl.getTime() ? new Date(p.deadline_at) : ttl;
}

/** How much a push matters now: its tier, how close its deadline is, who it's from, minus today's fatigue. */
export function score(p: QueuedPush, k: PushKind, ctx: Pick<PushContext, "now" | "sentToday">, r = PUSH_RULES): number {
  let s = r.tierScore[k.tier];
  if (p.deadline_at) {
    const left = minutes(new Date(p.deadline_at), ctx.now);
    s += r.urgencyMax * Math.min(1, Math.max(0, 1 - left / r.urgencyWindowMin));
  }
  if (p.close) s += r.closeBonus;
  return s - r.fatiguePerSent * ctx.sentToday;
}

/** Picks what to send to one player now, what merges into it and what to drop; everything else waits. */
export function planPush(queue: QueuedPush[], ctx: PushContext, r = PUSH_RULES): PushPlan {
  const drop: PushPlan["drop"] = [];
  const live: { p: QueuedPush; k: PushKind }[] = [];
  for (const p of queue) {
    const k = p.kind === "test" ? ({ tier: 0, category: "messages", ttlMin: 60, quietOk: true } as PushKind) : PUSH_KINDS[p.kind];
    if (!k) { drop.push({ id: p.id, reason: "unknown" }); continue; }
    if (ctx.now > expiresAt(p, k)) { drop.push({ id: p.id, reason: "expired" }); continue; }
    if (p.kind !== "test" && ctx.off.includes(k.category)) { drop.push({ id: p.id, reason: "off" }); continue; }
    if (p.kind !== "test" && ctx.active) { drop.push({ id: p.id, reason: "in_game" }); continue; }
    live.push({ p, k });
  }
  const hour = localHour(ctx.now, ctx.tz);
  const quiet = isQuiet(hour, r.quiet);
  const eligible = live.filter(({ p, k }) => {
    if (p.kind === "test") return true;
    if (quiet && !k.quietOk) return false;
    if (k.category === "messages") return !ctx.lastChatAt || minutes(ctx.now, ctx.lastChatAt) >= r.chatGapMin;
    if (ctx.sentToday >= r.perDay) return false;
    if (ctx.lastSentAt && minutes(ctx.now, ctx.lastSentAt) < r.gapMin) return false;
    if (k.tier === 3) return hour >= r.digest.from && hour < r.digest.to;
    return true;
  });
  if (!eligible.length) return { send: null, drop };
  // Highest score first; the oldest wins a tie.
  eligible.sort((a, b) => score(b.p, b.k, ctx, r) - score(a.p, a.k, ctx, r) || Date.parse(a.p.created_at) - Date.parse(b.p.created_at));
  const top = eligible[0];
  // The morning roundup: every come-back-and-play push in one.
  if (top.k.tier === 3) {
    const all = eligible.filter((e) => e.k.tier === 3);
    const titles = all.map((e) => e.p.title);
    const body = titles.length > 1 ? `${titles.slice(0, 2).join(" · ")}${titles.length > 2 ? ` · +${titles.length - 2} more` : ""}` : top.p.body;
    return { send: { ids: all.map((e) => e.p.id), title: titles.length > 1 ? "☀️ Your Clout City morning" : top.p.title, body, url: top.p.url, tag: "digest", chat: false }, drop };
  }
  // Same group (or, without one, same kind) merges into the top one.
  const key = (e: { p: QueuedPush }) => e.p.group_key ?? `kind:${e.p.kind}`;
  const same = eligible.filter((e) => key(e) === key(top));
  const n = same.length;
  return {
    send: {
      ids: same.map((e) => e.p.id),
      title: n > 1 ? `${top.p.title} (${n})` : top.p.title,
      body: top.p.body,
      url: top.p.url,
      tag: key(top),
      chat: top.k.category === "messages" && top.p.kind !== "test",
    },
    drop,
  };
}
