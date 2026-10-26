"use server";

import { previewOnly } from "./guard";

import { SUBLETS, subletBounds, type SubletApp, type SubletHome, type SubletListing, type SubletPerson, type SubletResult, type SubletState } from "@/lib/sublets";
import { ECONOMY } from "@/lib/economy";

// Development previews only: sublets in memory, following the rules of supabase/migrations/0119. Refused in production
// builds. The preview player lists from the Jackson Heights 1BR (the sample studio can't host in the real game).
//   ?sublet=browse (default)  three rooms on offer, one still crew-first
//   ?sublet=listed            my spare room is listed, two applications waiting
//   ?sublet=living            I'm subletting @kai_beats's LIC high-rise, week 2 of 4 (Home shows their place)
//   ?sublet=hosting           @dev.r is in my spare room, week 2 of 4, a renewal ask waiting
//   ?sublet=notice            hosting, notice given 2 days ago
//   ?sublet=ended             my sublet ended: the rating card

const person = (id: string, name: string, style: string, avg: number | null, count: number, days = 40): SubletPerson =>
  ({ id, name, style, rating: { avg, count }, days });
const KAI = person("p-kai", "kai_beats", "bodega_drip", 4.9, 7);
const DEV = person("p-dev", "dev.r", "arcade_nerd", 4.6, 3);
const MIRA = person("p-mira", "mira.q", "pilates_princess", null, 0, 12);
const LENNY = person("p-lenny", "lenny.g", "midtown_finance", 4.2, 2);

const iso = (d: Date) => d.toISOString().slice(0, 10);
const today = () => iso(new Date());
const plus = (days: number) => iso(new Date(Date.now() + days * 86400e3));
const rent = (id: string) => ECONOMY.homes.find((h) => h.id === id)?.rent ?? 600;
const MY_HOME = "jackson_heights_1br";

interface S {
  listings: SubletListing[];
  mine: { id: number; rent: number; minWeeks: number; maxWeeks: number; note: string | null; crewUntil: string; apps: SubletApp[] } | null;
  live: SubletState["live"];
  ended: SubletState["ended"];
}
const LISTINGS = (): SubletListing[] => [
  { id: 11, homeId: "lic_highrise", rent: 480, minWeeks: 2, maxWeeks: 6, note: "Quiet after 2 AM. Mostly.", crewOnly: true, crewUntil: plus(0.6), host: KAI, applied: false },
  { id: 12, homeId: "sunnyside_gardens", rent: 340, minWeeks: 1, maxWeeks: 4, note: "The cat comes with the garden.", crewOnly: false, crewUntil: plus(-2), host: DEV, applied: false },
  { id: 13, homeId: "jackson_heights_1br", rent: 260, minWeeks: 1, maxWeeks: 8, note: null, crewOnly: false, crewUntil: plus(-3), host: MIRA, applied: false },
];
const fresh = (): S => ({ listings: LISTINGS(), mine: null, live: null, ended: null });
let s = fresh();

const ok = <T,>(data: T): SubletResult<T> => (process.env.NODE_ENV === "production" ? { ok: false, error: "Previews are off in production." } : { ok: true, data });
const fail = (error: string): SubletResult<never> => ({ ok: false, error });

function state(): SubletState {
  return {
    hostBlock: s.live ? "one_sublet" : null,
    bounds: subletBounds(rent(MY_HOME)),
    live: s.live,
    mine: s.mine ? { ...s.mine, homeId: MY_HOME } : null,
    ended: s.ended,
    listings: s.live || s.mine ? [] : s.listings,
    rules: { minWeeks: SUBLETS.minWeeks, maxWeeks: SUBLETS.maxWeeks, noticeDays: SUBLETS.noticeDays, hangClout: SUBLETS.hangClout, crewHours: SUBLETS.crewHours, noteMax: SUBLETS.noteMax, minAccountDays: SUBLETS.minAccountDays },
  };
}

const liveWith = (role: "host" | "sub", who: SubletPerson, homeId: string, r: number): NonNullable<SubletState["live"]> => ({
  id: 1, role, with: who, homeId, rent: r, deposit: r, weeks: 4, week: 2, start: plus(-8), end: plus(20), nextRent: plus(6),
  noticeEnd: null, renew: null, shown: true, hangToday: false, hangOther: role === "sub",
});

export async function previewSubletReset(preset: string | undefined) {
  previewOnly();
  s = fresh();
  if (preset === "listed") {
    s.mine = { id: 21, rent: 300, minWeeks: 2, maxWeeks: 6, note: "Real bedroom door. Bring earplugs for the 7 train.", crewUntil: plus(0.6), apps: [
      { id: 31, weeks: 4, note: "Neat, quiet, I bring bagels.", at: new Date().toISOString(), from: MIRA },
      { id: 32, weeks: 6, note: "I work nights. You won't see me.", at: new Date().toISOString(), from: LENNY },
    ] };
  }
  if (preset === "living") s.live = liveWith("sub", KAI, "lic_highrise", 480);
  if (preset === "hosting" || preset === "notice") {
    s.live = liveWith("host", DEV, MY_HOME, 300);
    if (preset === "hosting") s.live.renew = { weeks: 2, mine: false };
    if (preset === "notice") { s.live.noticeEnd = plus(5); s.live.nextRent = null; }
  }
  if (preset === "ended") s.ended = { id: 2, role: "sub", reason: "notice", with: KAI, deposit: 480, rated: false };
}

export async function previewSubletState() { previewOnly(); return ok(state()); }
export async function previewSubletHome(): Promise<SubletResult<SubletHome | null>> {
  previewOnly();
  if (s.live?.role !== "sub") return ok(null);
  return ok({ id: s.live.id, host: s.live.with.id, hostName: s.live.with.name, homeId: s.live.homeId, layout: null, items: [] });
}
export async function previewSubletList(r: number, minWeeks: number, maxWeeks: number, note: string) {
  previewOnly();
  const [lo, hi] = subletBounds(rent(MY_HOME));
  if (s.live) return fail("One sublet at a time.");
  if (r < lo || r > hi) return fail("Rent has to be between a quarter and half of yours.");
  if (minWeeks < SUBLETS.minWeeks || maxWeeks > SUBLETS.maxWeeks || minWeeks > maxWeeks) return fail("That length isn't on offer.");
  s.mine = { id: 21, rent: r, minWeeks, maxWeeks, note: note.trim() || null, crewUntil: s.mine?.crewUntil ?? plus(1), apps: s.mine?.apps ?? [] };
  return ok(state());
}
export async function previewSubletUnlist() { previewOnly(); s.mine = null; return ok(state()); }
export async function previewSubletApply(listing: number, weeks: number, note: string) {
  previewOnly();
  void note;
  const l = s.listings.find((x) => x.id === listing);
  if (!l) return fail("That room's gone. Someone was faster.");
  if (weeks < l.minWeeks || weeks > l.maxWeeks) return fail("That length isn't on offer.");
  if (l.applied) return fail("You already applied there.");
  l.applied = true;
  return ok(state());
}
export async function previewSubletWithdraw(listing: number) {
  previewOnly();
  const l = s.listings.find((x) => x.id === listing);
  if (l) l.applied = false;
  return ok(state());
}
export async function previewSubletAnswer(app: number, yes: boolean) {
  previewOnly();
  const a = s.mine?.apps.find((x) => x.id === app);
  if (!s.mine || !a) return fail("That application isn't around anymore.");
  if (!yes) { s.mine.apps = s.mine.apps.filter((x) => x.id !== app); return ok(state()); }
  const r = s.mine.rent;
  s.mine = null;
  s.live = { ...liveWith("host", a.from, MY_HOME, r), weeks: a.weeks, week: 1, start: today(), end: plus(7 * a.weeks), nextRent: plus(7), hangOther: false };
  return ok(state());
}
export async function previewSubletNotice(on: boolean) {
  previewOnly();
  if (s.live?.role !== "host") return fail("You're not hosting anyone.");
  s.live.noticeEnd = on ? plus(SUBLETS.noticeDays) : null;
  s.live.renew = on ? null : s.live.renew;
  return ok(state());
}
export async function previewSubletLeave() {
  previewOnly();
  if (s.live?.role !== "sub") return fail("You're not in a sublet.");
  s.live = null;
  return ok(state());
}
export async function previewSubletRenew(weeks: number) {
  previewOnly();
  if (!s.live) return fail("You're not in a sublet.");
  s.live.renew = { weeks, mine: true };
  return ok(state());
}
export async function previewSubletRenewAnswer(yes: boolean) {
  previewOnly();
  if (!s.live?.renew || s.live.renew.mine) return fail("Nothing to answer.");
  if (yes) { s.live.weeks += s.live.renew.weeks; s.live.end = iso(new Date(Date.parse(s.live.end) + 7 * s.live.renew.weeks * 86400e3)); }
  s.live.renew = null;
  return ok(state());
}
export async function previewSubletHang() {
  previewOnly();
  if (!s.live) return fail("You're not in a sublet.");
  s.live.hangToday = true;
  return ok(state());
}
export async function previewSubletShow(on: boolean) {
  previewOnly();
  if (!s.live) return fail("You're not in a sublet.");
  s.live.shown = on;
  return ok(state());
}
export async function previewSubletRate(id: number, stars: number) {
  previewOnly();
  void id; void stars;
  s.ended = null;
  return ok(state());
}
export async function previewSubletSeen(id: number) { previewOnly(); void id; s.ended = null; return ok(state()); }
