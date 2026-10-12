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

export interface ChatMessage { id: number; mine: boolean; body: string; at: string }

export interface ChatThread {
  with: string;
  blocked: boolean;
  /** The other player blocked you: you can read the history but not send. */
  blockedMe: boolean;
  messages: ChatMessage[];
}

export interface ChatStatus { limit: number; left: number; mutedUntil: string | null; warned: boolean; banned: boolean }

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
  send(to: string, body: string): Promise<ChatResult<{ left: number }>>;
  status(): Promise<ChatResult<ChatStatus>>;
  block(playerId: string, on: boolean): Promise<ChatResult<null>>;
  report(playerId: string, messageId: number | null, reason: ReportReason, note: string): Promise<ChatResult<null>>;
  card(playerId: string): Promise<ChatResult<PlayerCard | null>>;
}

const ERRORS: Record<string, string> = {
  daily_limit: "That's your 10 for today. Back tomorrow.",
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
