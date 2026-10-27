"use client";

import { useEffect, useState } from "react";
import { AGE_BLOCK_COOKIE, AGE_BLOCK_DAYS, birthYears, daysInMonth, type Birthdate } from "@/lib/age";

// The age screen (lib/age.ts): a neutral date of birth, and a device that remembers being turned away.

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export type PartialBirthdate = { year?: number; month?: number; day?: number };

export function ageBlocked(): boolean {
  try {
    if (localStorage.getItem(AGE_BLOCK_COOKIE)) return true;
  } catch { /* fine */ }
  return document.cookie.split("; ").some((c) => c.startsWith(`${AGE_BLOCK_COOKIE}=`));
}

export function blockThisDevice(): void {
  document.cookie = `${AGE_BLOCK_COOKIE}=1; path=/; max-age=${AGE_BLOCK_DAYS * 86400}; samesite=lax`;
  try { localStorage.setItem(AGE_BLOCK_COOKIE, "1"); } catch { /* fine */ }
}

/** Read after mount, so the server render matches the first client render. */
export function useAgeBlocked(): [boolean, () => void] {
  const [blocked, setBlocked] = useState(false);
  useEffect(() => setBlocked(ageBlocked()), []);
  return [blocked, () => { blockThisDevice(); setBlocked(true); }];
}

export function BirthdateField({ value, onChange, id = "dob" }: { value: PartialBirthdate; onChange: (v: PartialBirthdate) => void; id?: string }) {
  const days = value.month ? daysInMonth(value.year ?? 2000, value.month) : 31;
  const set = (k: keyof Birthdate, raw: string) => {
    const next = { ...value, [k]: raw ? Number(raw) : undefined };
    if (next.day && next.month && next.day > daysInMonth(next.year ?? 2000, next.month)) next.day = undefined;
    onChange(next);
  };
  return (
    <fieldset className="dob">
      <legend className="dob-label">Date of birth</legend>
      <div className="dob-row">
        <label className="field dob-field">
          <select id={`${id}-month`} aria-label="Month" value={value.month ?? ""} onChange={(e) => set("month", e.target.value)}>
            <option value="">Month</option>
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
        </label>
        <label className="field dob-field dob-day">
          <select id={`${id}-day`} aria-label="Day" value={value.day ?? ""} onChange={(e) => set("day", e.target.value)}>
            <option value="">Day</option>
            {Array.from({ length: days }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
          </select>
        </label>
        <label className="field dob-field dob-year">
          <select id={`${id}-year`} aria-label="Year" value={value.year ?? ""} onChange={(e) => set("year", e.target.value)}>
            <option value="">Year</option>
            {birthYears().map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
      </div>
    </fieldset>
  );
}

export function AgeBlockedNote() {
  return (
    <div className="card stack-4" role="status">
      <p className="title" style={{ margin: 0 }}>Clout City is for adults.</p>
      <p className="subtext" style={{ margin: 0 }}>
        You need to be 18 or older to play. Thanks for stopping by, and come back when you are.
      </p>
    </div>
  );
}
