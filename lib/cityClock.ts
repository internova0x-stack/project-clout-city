// The city clock: a sped-up time of day for flavor only (Clarifications section 12).
// It never drives anything that pays out; that is the New York story calendar's job.

export interface CityClockConfig {
  realHoursPerCityDay: number;
  dayStartsAt: number;
  nightStartsAt: number;
}

const MINUTES_PER_DAY = 24 * 60;

/** Minutes since city-clock midnight, 0 to 1439. */
export function cityMinutes(nowMs: number, cfg: CityClockConfig): number {
  const cycleMs = cfg.realHoursPerCityDay * 60 * 60 * 1000;
  const progress = (((nowMs % cycleMs) + cycleMs) % cycleMs) / cycleMs;
  return Math.floor(progress * MINUTES_PER_DAY);
}

/** "9:41 PM". Time only, never a date or weekday. */
export function formatCityTime(minutes: number): string {
  const h24 = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const suffix = h24 < 12 ? "AM" : "PM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

export function isCityDaytime(minutes: number, cfg: CityClockConfig): boolean {
  const hour = minutes / 60;
  return hour >= cfg.dayStartsAt && hour < cfg.nightStartsAt;
}

/** Real milliseconds until the city clock's next displayed minute. */
export function msUntilNextCityMinute(nowMs: number, cfg: CityClockConfig): number {
  const msPerCityMinute = (cfg.realHoursPerCityDay * 60 * 60 * 1000) / MINUTES_PER_DAY;
  const into = ((nowMs % msPerCityMinute) + msPerCityMinute) % msPerCityMinute;
  return Math.max(50, Math.ceil(msPerCityMinute - into));
}
