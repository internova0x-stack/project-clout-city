// Real-time moments in the player's own time zone (v0.8, #18). Exclusive parties and other
// one-offs run on real New York time; players see their local time first, with New York's
// beside it unless they're in New York. Club events stay on the city clock (lib/cityClock.ts).
// The time zone is a parameter so tests can pin it; the UI leaves it to the browser.

const NY = "America/New_York";

const fmt = (iso: string | number, tz: string | undefined, opts: Intl.DateTimeFormatOptions) =>
  new Date(iso).toLocaleString("en-US", { ...opts, timeZone: tz });

const dayTime = (iso: string | number, tz?: string) => fmt(iso, tz, { weekday: "short", hour: "numeric", minute: "2-digit" });
const time = (iso: string | number, tz?: string) => fmt(iso, tz, { hour: "numeric", minute: "2-digit" });

/** True when the player's clock reads the same as New York's at that moment. */
export function sameAsNewYork(iso: string | number, tz?: string): boolean {
  return dayTime(iso, tz) === dayTime(iso, NY);
}

/** "Fri 6:00 PM your time · 9:00 PM in New York", or just "Fri 9:00 PM" in New York. */
export function eventTimeLine(iso: string, tz?: string): string {
  if (sameAsNewYork(iso, tz)) return dayTime(iso, NY);
  const local = dayTime(iso, tz);
  const ny = dayTime(iso, NY);
  // Same weekday in both places: New York's time alone reads cleaner.
  const nyShort = local.split(" ")[0] === ny.split(" ")[0] ? time(iso, NY) : ny;
  return `${local} your time · ${nyShort} in New York`;
}

/** "Doors open in 45 min", "in 2 h 15 min (6:00 PM your time)", or the day and time when it's further off. */
export function doorsLine(startsAt: string, nowMs: number, tz?: string): string {
  const minutes = Math.max(0, Math.ceil((Date.parse(startsAt) - nowMs) / 60_000));
  const local = sameAsNewYork(startsAt, tz) ? time(startsAt, tz) : `${time(startsAt, tz)} your time`;
  if (minutes < 60) return `Doors open in ${minutes} min`;
  if (minutes < 24 * 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `Doors open in ${h} h${m ? ` ${m} min` : ""} (${local})`;
  }
  return `Doors open ${sameAsNewYork(startsAt, tz) ? dayTime(startsAt, tz) : `${dayTime(startsAt, tz)} your time`}`;
}

/** "Oct 17" in the player's own calendar. */
export function localDate(iso: string, tz?: string): string {
  return fmt(iso, tz, { month: "short", day: "numeric" });
}

/** The instant New York's clock reads midnight at the start of a date (YYYY-MM-DD). */
export function nyMidnight(date: string): number {
  // New York is UTC-4 or UTC-5; pick the offset whose New York time is 00:00 on that date.
  for (const offset of [4, 5]) {
    const ms = Date.parse(`${date}T00:00:00Z`) + offset * 3_600_000;
    const ny = new Intl.DateTimeFormat("en-CA", { timeZone: NY, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(ms);
    if (ny.startsWith(date) && ny.endsWith("00:00")) return ms;
  }
  return Date.parse(`${date}T05:00:00Z`);
}

/** "Monday at midnight" in New York, or "Sunday 9:00 PM your time" elsewhere. */
export function nyMidnightLine(date: string, tz?: string): string {
  const ms = nyMidnight(date);
  if (sameAsNewYork(ms, tz)) return `${fmt(ms, NY, { weekday: "long" })} at midnight`;
  return `${fmt(ms, tz, { weekday: "long" })} ${time(ms, tz)} your time`;
}

/** The next Monday on New York's calendar (YYYY-MM-DD), when a new hunt week starts. */
/** The next Saturday in New York (a hunt's first day). */
export function nextNySaturday(nowMs: number): string {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: NY }).format(nowMs);
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + (((6 - d.getUTCDay() + 7) % 7) || 7));
  return d.toISOString().slice(0, 10);
}

export function nextNyMonday(nowMs: number): string {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: NY }).format(nowMs);
  const d = new Date(`${today}T12:00:00Z`);
  const add = ((8 - d.getUTCDay()) % 7) || 7;
  d.setUTCDate(d.getUTCDate() + add);
  return d.toISOString().slice(0, 10);
}
