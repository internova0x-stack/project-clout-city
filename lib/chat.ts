// Chat (Clarifications section 10, Design Guide C35) as the game sees it: the
// chat_* functions in supabase/migrations/0010. Safe to import anywhere.

export interface ChatSummary {
  with: string;
  name: string;
  style: string;
  blocked: boolean;
  last: string | null;
  lastMine: boolean | null;
  at: string;
  unread: number;
}

/** `kind` (migration 0047): "reaction" is a free emoji, shown big and never counted. */
export interface ChatMessage { id: number; mine: boolean; body: string; at: string; kind?: "text" | "reaction" }

export interface ChatThread {
  with: string;
  blocked: boolean;
  /** The other player blocked you: you can read the history but not send. */
  blockedMe: boolean;
  messages: ChatMessage[];
}

export interface ChatStatus {
  limit: number; left: number; mutedUntil: string | null; warned: boolean; banned: boolean;
  /** Meeting players (migration 0047): unlimited chat (monthly or forever), and "who can message me". */
  unlimited?: boolean;
  messagesFrom?: "anyone" | "crew";
}

export interface PlayerCard {
  id: string;
  name: string;
  style: string;
  clout: number;
  homeId: string | null;
  badges: number;
  joined: string;
  blocked: boolean;
  isMe: boolean;
  /** v0.5 (migration 0011): my side of a crush on this player; absent before the migration. */
  crush?: import("./dating.ts").CrushStatus | null;
  /** v0.7 (migration 0020): place in the Queens leaderboard, and public recent moments. */
  rank?: number;
  recent?: import("./recent.ts").RecentItem[];
  /** v0.7 (migration 0024): bank cash plus everything they own, public (owner, Oct 13). */
  netWorth?: number;
  /** v0.13 the Jobs board (migration 0050): "⭐ 4.8 · hired 12 times". */
  jobs?: { hired: number; rating: number | null; rated: number };
  /** Meeting players (migration 0047): the place you're both at right now, if any. */
  herePlace?: string | null;
  /** False when their "who can message me" is crew only (or a block stands). */
  canMessage?: boolean;
  crew?: boolean;
}

export type ReportReason = "harassment" | "spam" | "inappropriate" | "other";
export const REPORT_REASONS: { id: ReportReason; label: string }[] = [
  { id: "harassment", label: "Harassment" },
  { id: "spam", label: "Spam" },
  { id: "inappropriate", label: "Inappropriate" },
  { id: "other", label: "Other" },
];

export type ChatResult<T> = { ok: true; data: T } | { ok: false; error: string };

export interface ChatApi {
  list(): Promise<ChatResult<ChatSummary[]>>;
  thread(withId: string): Promise<ChatResult<ChatThread>>;
  /** `left` is null with unlimited chat. */
  send(to: string, body: string): Promise<ChatResult<{ left: number | null }>>;
  status(): Promise<ChatResult<ChatStatus>>;
  block(playerId: string, on: boolean): Promise<ChatResult<null>>;
  report(playerId: string, messageId: number | null, reason: ReportReason, note: string): Promise<ChatResult<null>>;
  card(playerId: string): Promise<ChatResult<PlayerCard | null>>;
  /** Meeting players (migration 0047). Missing before it runs. */
  react?(to: string, emoji: string): Promise<ChatResult<ChatMessage>>;
  setMessagesFrom?(who: "anyone" | "crew"): Promise<ChatResult<"anyone" | "crew">>;
  presence?(placeId: string, floor: number): Promise<ChatResult<import("./meet.ts").Presence>>;
  counts?(): Promise<ChatResult<import("./meet.ts").PlaceCounts>>;
}

/** The daily limit's message; the game opens the unlimited chat offer when it sees it. */
export const DAILY_LIMIT = "That's your 20 for today. They come back at midnight.";

const ERRORS: Record<string, string> = {
  daily_limit: DAILY_LIMIT,
  crew_only: "They only take messages from their crew.",
  react_too_fast: "You just reacted. Give it a few minutes.",
  not_together: "Reactions are for people in the same place.",
  bad_reaction: "That reaction isn't on the menu.",
  blocked: "You can't message this person.",
  muted: "You're muted from chat for now. The city needs a minute.",
  banned: "Your account can't use chat.",
  too_long: "Keep it under 500 characters. This is a city, not a novel.",
  empty: "Say something first.",
  unknown_player: "That player isn't around anymore.",
  unknown_message: "That message is gone.",
};

export function chatError(message: string | undefined): string {
  if (message) for (const code of Object.keys(ERRORS)) if (message.includes(code)) return ERRORS[code];
  return "Messages glitched. Try again.";
}

/** "2:14 PM" today, "Tue" this week, "Oct 3" before that. */
export function chatTime(iso: string, now = Date.now()): string {
  const d = new Date(iso);
  const days = (now - d.getTime()) / 86_400_000;
  if (days < 1 && new Date(now).toDateString() === d.toDateString()) return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (days < 7) return d.toLocaleDateString("en-US", { weekday: "short" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
