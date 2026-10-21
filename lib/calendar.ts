// Culture pack C5 (owner, Oct 20; docs/culture/README.md): events on real New York dates (content/culture/calendar.json).
// The server (migration 0096: calendar_attend, buy_gift, calendar_state) holds the same data in game_settings
// 'calendar' and checks the date, the time, the place, the dress code and the gift. Dependency-free (the data is passed
// in or imported by the caller) so tests can import it.

import { nyClock } from "./news.ts";

export type CalendarKind = "invite" | "block_party" | "countdown" | "parade";

export interface CalendarEvent {
  id: string;
  kind: CalendarKind;
  /** New York date, YYYY-MM-DD. */
  date: string;
  /** New York time it starts, "HH:MM", and how long it runs (it ends by midnight). */
  from: string;
  hours: number;
  place: string;
  title: string;
  host: string | null;
  blurb: string;
  entry: number;
  clout: number;
  mood: number;
  /** Invites: wearing something from the Shop pays this extra clout. */
  dressCode?: { label: string; clout: number };
  /** Invites: arriving without a gift box costs this much clout (a gift box is used up). */
  gift?: { label: string; penalty: number };
}

export interface CalendarData {
  giftPrice: number;
  giftsMax: number;
  giftPlaces: string[];
  events: CalendarEvent[];
}

/** What calendar_state() returns: the events this player went to, and gift boxes held. */
export interface CalendarState { attended: string[]; gifts: number }

export const CALENDAR_KIND: Record<CalendarKind, { emoji: string; label: string }> = {
  invite: { emoji: "💌", label: "You're invited" },
  block_party: { emoji: "🎃", label: "Block party" },
  countdown: { emoji: "🎆", label: "Countdown" },
  parade: { emoji: "🎺", label: "Parade" },
};

const minutesOf = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** The rules the data must follow (tests/calendar.test.ts runs them over the file). */
export function validateCalendar(d: CalendarData, placeIds: string[]): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const e of d.events) {
    const at = `event ${e.id}`;
    if (ids.has(e.id)) problems.push(`${at}: id repeats`);
    ids.add(e.id);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date)) problems.push(`${at}: date is YYYY-MM-DD`);
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(e.from) || !(e.hours >= 1 && minutesOf(e.from) + e.hours * 60 <= 24 * 60)) problems.push(`${at}: from and hours must end by midnight`);
    if (!placeIds.includes(e.place)) problems.push(`${at}: no place "${e.place}"`);
    if (!(e.clout > 0 && e.mood >= 0 && e.entry >= 0)) problems.push(`${at}: clout, mood and entry`);
    if (e.kind === "invite" && !(e.dressCode && e.gift && e.host)) problems.push(`${at}: an invite has a host, a dress code and a gift`);
    if (e.gift && !(e.gift.penalty > 0 && e.gift.penalty < e.clout)) problems.push(`${at}: the gift penalty is less than the clout (going empty-handed still pays a little)`);
    if (e.dressCode && !(e.dressCode.clout > 0)) problems.push(`${at}: the dress code pays clout`);
    if (!/^[a-z0-9-]{3,60}$/.test(e.id)) problems.push(`${at}: id`);
  }
  for (const p of d.giftPlaces) if (!placeIds.includes(p)) problems.push(`gift place "${p}" isn't a place`);
  return problems;
}

/** Is the event on right now (New York time)? */
export function calendarLive(e: Pick<CalendarEvent, "date" | "from" | "hours">, nowMs: number): boolean {
  const { day, minutes } = nyClock(nowMs);
  const from = minutesOf(e.from);
  return e.date === day && minutes >= from && minutes < from + e.hours * 60;
}

/** Has it ended (its day passed, or today after its window)? */
export function calendarOver(e: Pick<CalendarEvent, "date" | "from" | "hours">, nowMs: number): boolean {
  const { day, minutes } = nyClock(nowMs);
  return e.date < day || (e.date === day && minutes >= minutesOf(e.from) + e.hours * 60);
}

/** What's on the calendar: live ones first, then the next `days` days, soonest first. */
export function upcoming(events: CalendarEvent[], nowMs: number, days = 75): CalendarEvent[] {
  const { day } = nyClock(nowMs);
  const until = new Date(`${day}T12:00:00Z`);
  until.setUTCDate(until.getUTCDate() + days);
  const last = until.toISOString().slice(0, 10);
  return events
    .filter((e) => !calendarOver(e, nowMs) && e.date <= last)
    .sort((a, b) => Number(calendarLive(b, nowMs)) - Number(calendarLive(a, nowMs)) || a.date.localeCompare(b.date) || a.from.localeCompare(b.from));
}

/** The invite on the Phone: the next name day this player hasn't been to, from two weeks out until it ends. */
export function phoneInvite(events: CalendarEvent[], attended: string[], nowMs: number): CalendarEvent | null {
  return upcoming(events, nowMs, 14).find((e) => e.kind === "invite" && !attended.includes(e.id)) ?? null;
}

/** "Today, 6 PM to 11 PM" / "Sat Oct 31, 5 PM to 11 PM". */
export function whenLine(e: Pick<CalendarEvent, "date" | "from" | "hours">, nowMs: number): string {
  const { day } = nyClock(nowMs);
  const h = (m: number) => { const x = Math.floor(m / 60) % 24; const mm = m % 60; return `${x % 12 === 0 ? 12 : x % 12}${mm ? `:${String(mm).padStart(2, "0")}` : ""} ${x < 12 ? "AM" : "PM"}`; };
  const start = minutesOf(e.from);
  const date = e.date === day ? "Today" : new Date(`${e.date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
  return `${date}, ${h(start)} to ${start + e.hours * 60 >= 24 * 60 ? "midnight" : h(start + e.hours * 60)}`;
}

/** The dress code is met by wearing anything bought from the Shop (the server checks the same). */
export function dressedUp(items: { category: string; equipped: boolean }[]): boolean {
  return items.some((i) => i.category === "fashion" && i.equipped);
}

/** What going pays: base clout and Mood, the dress-code bonus, minus the gift penalty without a gift box. */
export function calendarReward(e: CalendarEvent, opts: { dressed: boolean; gifts: number }): { clout: number; mood: number; dress: boolean; gift: "brought" | "forgot" | null } {
  const dress = !!e.dressCode && opts.dressed;
  const gift = e.gift ? (opts.gifts > 0 ? "brought" : "forgot") : null;
  return { clout: e.clout + (dress ? e.dressCode!.clout : 0) - (gift === "forgot" ? e.gift!.penalty : 0), mood: e.mood, dress, gift };
}
