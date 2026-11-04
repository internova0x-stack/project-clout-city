// Date nights and crew outings end on a results screen (components/ResultCard.tsx; owner, Nov 4). GameShell hands every
// dating and crew inbox read to `dateNightsRead` / `crewNightsRead`; they compare it with the read before and show the card
// with `celebrate`. No server calls of their own: the inboxes (and the last couple state GameShell took) are enough.
//   date night paid (you both pulled up)           a win: the clout, toward official (3 dates) or the couple streak
//   you went, they declined                        a near miss: RAIN CHECK
//   you went, midnight came, they never did        a near miss: STOOD UP (shown on the first read of the next New York day)
//   the whole crew (6) went                         a win: FULL CREW
//   everyone still in went, short of 6              a near miss: SO CLOSE (or a win when it's close)
//   midnight came on an outing you went to          the same card, on the first read of the next day
// Nothing here is ever shown twice on a device (`cc-nights`: the New York day, what's still open, what was shown).

import { COUPLES, type CoupleState } from "@/lib/couples";
import { CREW, activityLabel, crewProgress, type CrewInbox, type CrewOuting } from "@/lib/crew";
import { placeById } from "@/lib/city";
import { dateSpotName, type DateNight, type DatingInbox } from "@/lib/dating";
import { handle } from "@/lib/validation";
import { celebrate, type Celebration } from "./Celebrate";

const nyDay = (at = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(at);
/** A pick that stays the same for one night (no flicker between titles on a re-render). */
const pick = <T,>(list: readonly T[], seed: number): T => list[Math.abs(seed) % list.length];

// ---- What the device remembers ----
interface OpenDate { id: number; name: string; withId: string; where: string; matched: boolean }
interface OpenOuting { id: number; place: string; went: number; total: number; clout: number }
interface Store { who: string; day: string; dates: OpenDate[]; outings: OpenOuting[]; shown: string[] }
const KEY = "cc-nights";
function load(who: string): Store {
  const blank: Store = { who, day: nyDay(), dates: [], outings: [], shown: [] };
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? "null") as Store | null;
    return s && s.who === who && Array.isArray(s.shown) ? { ...blank, ...s } : blank;
  } catch { return blank; }
}
function save(s: Store) {
  try { localStorage.setItem(KEY, JSON.stringify({ ...s, shown: s.shown.slice(-40) })); } catch { /* private mode */ }
}
const once = (s: Store, key: string) => { if (s.shown.includes(key)) return false; s.shown.push(key); return true; };

// The last couple state GameShell took (GameShell calls `nightsCouple` from takeCouple), and when.
let couple: CoupleState | null = null;
let coupleAt = 0;
let inboxAt = 0;
export function nightsCouple(st: CoupleState) { couple = st; coupleAt = Date.now(); }

/** What the cards' buttons open (GameShell's panels). */
export interface NightCtx { who: string; onUs?: () => void; onDates?: () => void; onCrew?: () => void }

/** A new New York day: the dates you went to that never paid were a no-show, and the outings you went to are over. */
function rollover(s: Store, ctx: NightCtx): boolean {
  const today = nyDay();
  if (s.day === today) return false;
  let shown = false;
  for (const o of s.dates) if (once(s, `d:${o.id}`)) { celebrate(dateMissCard(o, false, ctx)); shown = true; }
  for (const o of s.outings) if (once(s, `c:${o.id}`)) { celebrate(crewCard({ ...o, full: false }, ctx)); shown = true; }
  s.day = today;
  s.dates = [];
  s.outings = [];
  return shown;
}

// ---- Date nights ----

/** The bar under a date: toward official with a match, the couple streak with a partner. */
function dateMeter(withId: string, counted: boolean): { meter: NonNullable<Celebration["result"]>["meter"]; partner: boolean; official: boolean; streak: number } {
  const st = couple;
  if (st?.partner?.id === withId) {
    const streak = st.streak + (st.todayDone || counted ? 0 : 1);
    const next = st.nextReward;
    return { partner: true, official: false, streak, meter: next
      ? { label: "💞 Couple streak", have: Math.min(streak, next.day), need: next.day, say: `Day ${next.day} pays +${next.clout} clout.` }
      : { label: "💞 Couple streak", have: streak, need: streak, say: "Every day counts. Even the boring ones." } };
  }
  const need = st?.rules.datesToOfficial ?? COUPLES.datesToOfficial;
  const m = st?.matches.find((x) => x.id === withId);
  if (!m) return { partner: false, official: false, streak: 0, meter: undefined };
  const have = Math.min(need, m.dates + (counted ? 0 : 1));
  const official = have >= need && (m.blockedBy === null || m.blockedBy === "more_dates");
  return { partner: false, official, streak: 0, meter: { label: "💗 Date nights together", have, need, max: need,
    say: have >= need ? (official ? "That's three. You could make it official." : "Three dates. The rest is up to you two.") : `${need - have} more and you can make it official.` } };
}

export function dateWinCard(d: DateNight, inbox: DatingInbox, counted: boolean, ctx: NightCtx): Celebration {
  const name = handle(d.with.name);
  const where = dateSpotName(d.kind, d.target);
  const { meter, partner, official, streak } = dateMeter(d.with.id, counted);
  const clout = partner ? COUPLES.dateClout : inbox.bonus.clout;
  const mood = partner ? COUPLES.dateMood : inbox.bonus.mood;
  const title = pick(["A great night", "Sparks, actually", "Nobody checked their phone", "Second-date energy"], d.id);
  const story = pick([
    `You and ${name} at ${where}. Nobody ghosted. In this city.`,
    `Dinner at ${where} with ${name}. The waiter asked how long you've been together.`,
    `You and ${name} closed out ${where}. The staff stacked chairs around you.`,
  ], d.id);
  const keep = [`🙂 +${mood} Mood`,
    partner ? `💞 Dating ${name}` : d.matched ? `💗 Matched with ${name}` : `🤝 ${name}, still a friend`,
    ...(partner ? [`🔥 ${Math.max(1, streak)}-day couple streak`] : [])];
  return { rung: 3, emoji: "💞", tag: "Date night", title, twist: "chimes",
    cta: official ? "Make it official" : "Nice", onCta: official ? ctx.onUs : undefined,
    result: { tone: "win", amount: clout, plain: true, unit: "clout", story, meter, keep } };
}

export function dateMissCard(o: OpenDate, declined: boolean, ctx: NightCtx): Celebration {
  const { meter, partner } = dateMeter(o.withId, true);
  const story = declined
    ? `${o.name} can't make it to ${o.where}. You got a table and a story.`
    : `You showed up to ${o.where}. ${o.name} didn't. The breadsticks did.`;
  return { rung: 3, emoji: declined ? "🌧️" : "🌹", tag: "Date night", title: declined ? "Rain check" : "It was… fine",
    cta: "Plan another night", onCta: ctx.onDates,
    result: { tone: "warn", stamp: declined ? { text: "RAIN CHECK", tone: "warn" } : { text: "STOOD UP", tone: "warn" },
      big: "Solo", unit: "table for one", story,
      meter: meter ? { ...meter, say: partner ? meter.say : "This one didn't count. The next one can." } : undefined,
      keep: ["🍽️ You still went out", partner ? `💞 Still dating ${o.name}` : o.matched ? `💗 Still matched with ${o.name}` : `🤝 ${o.name}, still a friend`, "😌 Your dignity, mostly"] } };
}

/** Every dating inbox read. Returns the date that just paid (GameShell adds the gain and re-reads the player). */
export function dateNightsRead(prev: DatingInbox | null, next: DatingInbox, ctx: NightCtx): DateNight | null {
  const prevAt = inboxAt;
  inboxAt = Date.now();
  if (typeof window === "undefined") return null;
  const s = load(ctx.who);
  rollover(s, ctx);
  let paid: DateNight | null = null;
  for (const d of next.dates) {
    const was = prev?.dates.find((p) => p.id === d.id);
    if (d.paid && was && !was.paid) {
      paid = d;
      // couple_state counts completed dates: it already has this one only if it was read after this inbox's last read.
      if (once(s, `d:${d.id}`)) celebrate(dateWinCard(d, next, coupleAt > prevAt && prevAt > 0, ctx));
    } else if (d.status === "declined" && d.iWent && was && was.status !== "declined") {
      if (once(s, `d:${d.id}`)) celebrate(dateMissCard(open(d), true, ctx));
    }
  }
  s.dates = next.dates.filter((d) => d.iWent && !d.paid && d.status !== "declined" && !s.shown.includes(`d:${d.id}`)).map(open);
  save(s);
  return paid;
}
const open = (d: DateNight): OpenDate => ({ id: d.id, name: handle(d.with.name), withId: d.with.id, where: dateSpotName(d.kind, d.target), matched: d.matched });

// ---- Crew outings ----
export function crewCard(o: { id: number; place: string; went: number; total: number; full: boolean; clout: number }, ctx: NightCtx): Celebration {
  const need = CREW.fullSize;
  const meter = { label: "👥 Crew who pulled up", have: Math.min(o.went, need), need, max: need,
    say: o.full ? "Everyone. Even the one who's always late." : o.total < need ? `A crew of ${need} unlocks the +${CREW.fullClout} full-crew bonus.` : `${need - o.went} short of the +${CREW.fullClout} full-crew bonus.` };
  const friends = Math.max(0, o.went - 1);
  if (o.full) {
    return { rung: 3, emoji: "🎉", tag: "Crew night", title: "Full crew", twist: "chimes", cta: "Nice",
      result: { tone: "win", stamp: { text: "FULL CREW", tone: "good" }, amount: o.clout, plain: true, unit: "clout",
        story: `All ${need} of you pulled up to ${o.place}. The city noticed. Mostly the noise.`, meter,
        keep: [`🙂 +${CREW.fullMood} Mood`, `🔥 +${CREW.fullClout} full-crew bonus`, `👥 ${friends} friends showed`] } };
  }
  if (friends === 0) {
    return { rung: 3, emoji: "🫥", tag: "Crew night", title: "Party of one", cta: "Bring the crew again", onCta: ctx.onCrew,
      result: { tone: "lose", stamp: { text: "SOLO", tone: "warn" }, big: "Solo", unit: "crew of one",
        story: `You held down ${o.place}. The group chat said "omw" and meant it spiritually.`, meter,
        keep: ["🍽️ You still went out", "👥 Your crew, still yours", "📸 Solo pics hit different"] } };
  }
  const close = need - o.went <= 2;
  return { rung: 3, emoji: "🍻", tag: "Crew night", title: close ? "So close" : "A solid night", cta: "Bring the crew again", onCta: ctx.onCrew,
    result: { tone: close ? "warn" : "win", stamp: close ? { text: "SO CLOSE", tone: "warn" } : undefined,
      amount: o.clout, plain: true, unit: "clout",
      story: `${o.went} of you at ${o.place}. ${friends === 1 ? "One friend" : `${friends} friends`} pulled up, which in New York is loyalty.`, meter,
      keep: [`🔥 +${CREW.perFriendClout} a friend who came`, `👥 ${friends} friend${friends === 1 ? "" : "s"} showed`, "🍽️ A night out"] } };
}

const placeOf = (o: CrewOuting) => placeById(o.placeId)?.name ?? activityLabel(undefined, o.kind, o.activity);
/** Everyone still in has gone (nobody left to wait for), with at least one friend. */
const allIn = (o: CrewOuting) => {
  const live = o.members.filter((m) => m.status !== "declined");
  return live.length >= 2 && live.every((m) => m.went);
};

/** Every crew inbox read. Returns true when it showed a card (GameShell then skips its "pulled up" toast). */
export function crewNightsRead(prev: CrewInbox | null, next: CrewInbox, ctx: NightCtx): boolean {
  if (typeof window === "undefined") return false;
  const s = load(ctx.who);
  let shown = rollover(s, ctx);
  for (const o of next.outings) {
    if (!o.iWent) continue;
    const was = prev?.outings.find((p) => p.id === o.id);
    if (!was) continue;
    const { went, total } = crewProgress(o);
    const done = (o.full && !was.full) || (!o.full && allIn(o) && !allIn(was));
    if (done && once(s, `c:${o.id}`)) {
      celebrate(crewCard({ id: o.id, place: placeOf(o), went, total, full: o.full, clout: next.clout }, ctx));
      shown = true;
    }
  }
  s.outings = next.outings
    .filter((o) => o.iWent && !o.full && !s.shown.includes(`c:${o.id}`))
    .map((o) => ({ id: o.id, place: placeOf(o), ...crewProgress(o), clout: next.clout }));
  save(s);
  return shown;
}
