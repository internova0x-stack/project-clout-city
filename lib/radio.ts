// v0.14 Real Clout FM (migration 0057): the city's radio station. Players give their Instagram handle,
// not their Clout City name (owner, Oct 16: the one named brand the game asks for). Its morning show "The Wake-Up Call"
// with DJ Sharm Almight reads one player's shoutout a day; the owner picks it in the Studio. The rules
// live in SQL (radio_request, radio_state); this file is the shapes, the copy and the form's checks.

export const RADIO = {
  station: "Real Clout FM",
  show: "The Wake-Up Call",
  host: "DJ Sharm Almight",
  messageMax: 140,
  handleMax: 30,
  /** How long the on-air banner stays up (owner: "about 8 seconds"). */
  bannerMs: 8000,
} as const;

/** A shoutout as players see it: the Instagram @handle is public, the player behind it isn't. */
export interface Shoutout {
  id: number;
  handle: string;
  message: string;
  /** Its New York day (YYYY-MM-DD). */
  date: string;
  airedAt: string | null;
}

export type ShoutoutStatus = "pending" | "on_air" | "wall" | "not_picked" | "rejected";

export interface RadioState {
  today: string;
  /** When today's show airs (9 a.m. New York), as an ISO time. */
  airsAt: string;
  onAir: Shoutout | null;
  wall: Shoutout[];
  mine: (Shoutout & { status: ShoutoutStatus }) | null;
  requestedToday: boolean;
  /** Places left on today's list. */
  left: number;
  messageMax: number;
  /** The chat word list: the form masks as you type (the server masks again). */
  words: string[];
}

export type RadioResult<T> = { ok: true; data: T } | { ok: false; error: string };

export interface RadioApi {
  state(): Promise<RadioResult<RadioState>>;
  request(handle: string, message: string, confirmed: boolean): Promise<RadioResult<Shoutout & { status: ShoutoutStatus }>>;
  report(id: number, reason: "harassment" | "spam" | "inappropriate" | "other", note: string): Promise<RadioResult<null>>;
}

/** One row of the Studio's Shoutouts queue (admin_shoutouts). */
export interface StudioShoutout {
  id: number;
  handle: string;
  message: string;
  status: ShoutoutStatus;
  at: string;
  airedAt: string | null;
  player: { id: string; name: string };
}
export interface StudioShoutoutDay { date: string; airsAt: string; cap: number; wallMax: number; items: StudioShoutout[] }
export type ShoutoutAction = "air" | "wall" | "reject" | "pending";

export function radioError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("list_full")) return "Today's list is full. Try again tomorrow.";
  if (m.includes("already_requested")) return "You've asked for today's shoutout already. One a day.";
  if (m.includes("confirm_handle")) return "Confirm the Instagram handle is yours first.";
  if (m.includes("bad_handle")) return "Instagram handles are letters, numbers, dots and underscores, up to 30.";
  if (m.includes("bad_message")) return `Say something, in ${RADIO.messageMax} characters or fewer.`;
  if (m.includes("no_tags")) return "Shoutouts can't tag or name anyone else. Keep it about you.";
  if (m.includes("not_allowed")) return "Your account can't send shoutouts right now.";
  if (m.includes("unknown_shoutout")) return "That shoutout isn't on air anymore.";
  if (m.includes("wall_full")) return "The wall is full for that day.";
  if (m.includes("day_over")) return "That day's show is over.";
  if (m.includes("not_admin")) return "This account isn't a story admin.";
  if (m.includes("function") && m.includes("does not exist")) return "Run migration 0057 to switch on Real Clout FM.";
  return "The station's off the air for a second. Try again.";
}

/** A handle as typed, cleaned the way the server stores it (no leading @). Null when it isn't valid. */
export function cleanHandle(raw: string): string | null {
  const h = raw.trim().replace(/^@/, "");
  return /^[A-Za-z0-9._]{1,30}$/.test(h) ? h : null;
}

/** Masks filtered words with bullets (whole words, any case), like the server's chat_filter. */
export function maskWords(text: string, words: readonly string[]): string {
  let out = text;
  for (const w of words) {
    if (!w) continue;
    const safe = w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(new RegExp(`\\b${safe}\\b`, "gi"), "•".repeat(w.length));
  }
  return out;
}

/** What the form says about a message before it's sent (null when it's fine). */
export function messageProblem(message: string): string | null {
  const m = message.trim();
  if (!m) return null;
  if (m.length > RADIO.messageMax) return `${m.length - RADIO.messageMax} over the limit.`;
  if (m.includes("@")) return "No tagging: shoutouts can't name anyone else.";
  return null;
}

/** "9:00 AM" in the player's own time zone for a New York air time. */
export function localAirTime(iso: string, locale?: string): string {
  return new Date(iso).toLocaleTimeString(locale ?? "en-US", { hour: "numeric", minute: "2-digit" });
}

/** The banner shows once per shoutout per device. */
export const bannerSeenKey = (id: number) => `cc-radio-banner-${id}`;
