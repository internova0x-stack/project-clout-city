// Age screen (owner, Oct 27; COPPA and FTC guidance): sign-up asks for a date of birth with no hint of the "right"
// answer, rather than an "I'm 18+" box. Under 18 is turned away, and this device remembers it (a cookie and local
// storage), so going back and picking another year doesn't get in. The birthdate itself is never stored: only that
// the screen was passed, and how.

export const MIN_AGE = 18;
/** The device-wide "turned away" mark: a year, long enough to stop a quick retry. */
export const AGE_BLOCK_COOKIE = "cc_age_no";
export const AGE_BLOCK_DAYS = 365;

export interface Birthdate { year: number; month: number; day: number } // month 1-12

export const daysInMonth = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();

/** A real calendar date, not in the future, at most 120 years ago. */
export function validBirthdate(b: Partial<Birthdate>, today: Date = new Date()): b is Birthdate {
  const { year, month, day } = b;
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (month! < 1 || month! > 12 || day! < 1 || day! > daysInMonth(year!, month!)) return false;
  const y = today.getFullYear();
  if (year! > y || year! < y - 120) return false;
  return ageOn(b as Birthdate, today) >= 0;
}

/** Whole years on `today` (local date): a birthday counts from its day, and 29 February from 1 March in other years. */
export function ageOn(b: Birthdate, today: Date = new Date()): number {
  const m = today.getMonth() + 1;
  const d = today.getDate();
  let age = today.getFullYear() - b.year;
  if (m < b.month || (m === b.month && d < b.day)) age -= 1;
  return age;
}

export const isAdult = (b: Birthdate, today: Date = new Date()) => validBirthdate(b, today) && ageOn(b, today) >= MIN_AGE;

/** The year list, newest first: this year back 100 years. Not preset or ordered to suggest an adult year. */
export function birthYears(today: Date = new Date()): number[] {
  const y = today.getFullYear();
  return Array.from({ length: 101 }, (_, i) => y - i);
}
