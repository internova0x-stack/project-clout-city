// Having people over ends on a results screen (components/ResultCard.tsx; owner, Nov 4). GameShell hands every visit_state
// read to `visitStateRead` and every visit_room read to `visitRoomRead`; no server calls of their own.
//   the host's visit ended (wrapped, or its time ran out)   a results card: the clout, guests who stayed against capacity
//     every spot filled                                    a win: FULL HOUSE
//     half or more                                         a win
//     fewer                                                a near miss: SO CLOSE (the colour stays)
//     nobody stayed                                        a near miss: NO-SHOWS (Solo)
//   a guest's stay paid (visit_settle)                     a banner: the guest's clout and Mood
// A visit called off before it started shows nothing. Nothing is shown twice on a device (`cc-visit-seen`: the hosting
// visit still open, and what was shown). The host's clout is worked out from the last read (guests paid × the Crib Rating
// rate); a Stay-at-home Spouse's ×1.25 isn't in visit_state, so the card counts the base rate.

import { KIND_LABEL, VISITS, hostCloutPerGuest, type VisitKind, type VisitRoom, type VisitState } from "../../lib/visits.ts";
import { handle } from "../../lib/validation.ts";
import type { Celebration } from "../Celebrate.tsx";

/** What the device keeps of the visit it's hosting, so the card can show after it's gone from visit_state. */
export interface OpenHosting { id: number; kind: VisitKind; capacity: number; crib: number; paid: number; ends: string }
interface Store { who: string; open: OpenHosting | null; shown: string[] }
const KEY = "cc-visit-seen";

function load(who: string): Store {
  const blank: Store = { who, open: null, shown: [] };
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? "null") as Store | null;
    return s && s.who === who && Array.isArray(s.shown) ? { ...blank, ...s } : blank;
  } catch { return blank; }
}
function save(s: Store) {
  try { localStorage.setItem(KEY, JSON.stringify({ ...s, shown: s.shown.slice(-40) })); } catch { /* private mode */ }
}
const once = (s: Store, key: string) => { if (s.shown.includes(key)) return false; s.shown.push(key); return true; };
const pick = <T,>(list: readonly T[], seed: number): T => list[Math.abs(seed) % list.length];

/** The host's results card. */
export function hostResult(o: OpenHosting, onAgain?: () => void): Celebration {
  const k = KIND_LABEL[o.kind];
  const party = o.kind === "party";
  const cap = Math.max(1, o.capacity);
  const paid = Math.min(o.paid, cap);
  const clout = paid * hostCloutPerGuest(o.kind, o.crib);
  const mood = Math.min(VISITS.hostMoodMax, paid * VISITS.kinds[o.kind].hostMood);
  const rate = `×${(1 + o.crib / 100).toFixed(2)}`;
  const tag = k.name;
  const meter = { label: "👥 Guests who stayed", have: paid, need: cap, max: cap,
    say: paid >= cap ? "Every spot filled. The neighbors have notes." : `${cap - paid} more and the place is full.` };
  if (paid === 0) {
    return { rung: 3, emoji: "🫥", tag, title: party ? "The party's over" : "That's a wrap", cta: "Host again", onCta: onAgain,
      result: { tone: "lose", stamp: { text: "NO-SHOWS", tone: "warn" }, big: "Solo", unit: "party of one",
        story: pick(["Everyone said \"omw.\" Nobody said which way.", "You cleaned for nobody. The apartment has never looked better."], o.id),
        meter: { ...meter, say: "Nobody stayed long enough to count. Invite your crew, they owe you." },
        keep: [`🏆 Crib Rating ${o.crib}`, "🏠 A spotless place", party ? "🍿 All the snacks" : "🛋️ The good seat"] } };
  }
  const full = paid >= cap;
  const good = full || paid * 2 >= cap;
  const story = full
    ? pick([`All ${cap} spots filled. Someone's cousin came. It's fine.`, `A full house. A neighbor knocked to complain and stayed.`], o.id)
    : party
      ? pick([`${paid} of your people came, ate everything, and left one shoe.`, `${paid} guests, one playlist fight, zero regrets.`], o.id)
      : pick([`${paid} came over, nobody left early. In this city, that's love.`, `${paid} guests on your couch. The couch has never felt so seen.`], o.id);
  return { rung: 3, emoji: k.emoji, tag, title: party ? "The party's over" : "That's a wrap", twist: "chimes",
    cta: good ? "Nice" : "Host again", onCta: good ? undefined : onAgain,
    result: { tone: good ? "win" : "warn", stamp: full ? { text: "FULL HOUSE", tone: "good" } : good ? undefined : { text: "SO CLOSE", tone: "warn" },
      amount: clout, plain: true, unit: "clout", story, meter,
      keep: [`🏆 Crib Rating ${o.crib}: ${rate} clout`, ...(mood > 0 ? [`🙂 +${mood} Mood`] : []), `👥 ${paid} guest${paid === 1 ? "" : "s"} stayed`] } };
}

/** The guest's banner, the moment their stay pays. */
export function guestBanner(r: VisitRoom): Celebration {
  const k = KIND_LABEL[r.kind];
  const v = VISITS.kinds[r.kind];
  return { rung: 2, emoji: k.emoji, tag: `${handle(r.host.name)}'s ${k.name.toLowerCase()}`, title: r.kind === "party" ? "Great party" : "Good hang",
    rewards: [{ tone: "clout", text: `+${v.guestClout} clout` }, { text: `🙂 +${v.guestMood} Mood` }] };
}

export interface VisitCtx { who: string; onAgain?: () => void; show: (c: Celebration) => void }

const snap = (h: NonNullable<VisitState["hosting"]>): OpenHosting =>
  ({ id: h.id, kind: h.kind, capacity: h.capacity, crib: h.crib, paid: h.guests.filter((g) => g.paid).length, ends: h.ends });

/** Every visit_state read: the visit I'm hosting, once it's on, is remembered; once it's gone or over, its card shows. */
export function visitStateRead(next: VisitState | null, ctx: VisitCtx, now = Date.now()): OpenHosting | null {
  if (typeof window === "undefined" || !next) return null;
  const s = load(ctx.who);
  const h = next.hosting;
  let shown: OpenHosting | null = null;
  const finish = (o: OpenHosting) => { if (once(s, `h:${o.id}`)) { ctx.show(hostResult(o, ctx.onAgain)); shown = o; } };
  if (s.open && (!h || h.id !== s.open.id)) { finish(s.open); s.open = null; }
  if (h && Date.parse(h.starts) <= now) {
    const o = snap(h);
    if (Date.parse(h.ends) <= now) { finish(o); s.open = null; }
    else if (!s.shown.includes(`h:${o.id}`)) s.open = o;
  }
  save(s);
  return shown;
}

/** Every visit_room read: a guest's stay that just paid gets the banner (once per visit). Returns true when it showed. */
export function visitRoomRead(prev: VisitRoom | null, next: VisitRoom, ctx: VisitCtx): boolean {
  if (typeof window === "undefined" || next.mine || !next.me?.paid || !prev || prev.me?.paid) return false;
  const s = load(ctx.who);
  const ok = once(s, `g:${next.id}`);
  save(s);
  if (ok) ctx.show(guestBanner(next));
  return ok;
}
