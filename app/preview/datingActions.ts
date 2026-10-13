"use server";

import { DATING, type CrushStatus, type DateCandidate, type DateNight, type DatingInbox, type DatingResult } from "@/lib/dating";
import { CLUB_EVENTS, PLACES } from "@/lib/city";

// Development previews only: crushes and date nights in memory, following the rules of
// supabase/migrations/0011. Refused in production builds. The preview player is connected
// to Tasha and Marco (clique) and Dee (a two-way chat); Kenji is a stranger.

const ME = "preview";
const PEOPLE: Record<string, { name: string; style: string }> = {
  "p-tasha": { name: "tasha.b", style: "pilates_princess" },
  "p-marco": { name: "Marco", style: "midtown_finance" },
  "p-dee": { name: "dee_rivera", style: "thrift_store_icon" },
  "p-kenji": { name: "Kenji", style: "startup_founder" },
};
const CONNECTED = new Set(["p-tasha", "p-marco", "p-dee"]);

interface Row { id: number; host: string; guest: string; kind: "place" | "event"; target: string; status: DateNight["status"] | "cancelled"; hostWent: boolean; guestWent: boolean; paid: boolean }
const fresh = () => ({
  // Tasha already has a crush on the preview player: crushing back reveals it.
  crushes: new Set<string>(["p-tasha>" + ME]),
  seen: new Set<string>(),
  dates: [] as Row[],
  nextId: 1,
});
let s = fresh();

const ok = <T,>(data: T): DatingResult<T> => (process.env.NODE_ENV === "production" ? { ok: false, error: "Previews are off in production." } : { ok: true, data });
const fail = (error: string): DatingResult<never> => ({ ok: false, error });
const has = (a: string, b: string) => s.crushes.has(`${a}>${b}`);
const matched = (id: string) => has(ME, id) && has(id, ME);
const mine = () => [...s.crushes].filter((c) => c.startsWith(ME + ">")).length;
const status = (id: string): CrushStatus => ({ eligible: CONNECTED.has(id), crushed: has(ME, id), matched: matched(id), count: mine(), max: DATING.maxCrushes });
const spot = (kind: "place" | "event", target: string) => {
  if (kind === "event") {
    const e = CLUB_EVENTS.find((x) => x.id === target);
    return e ? { placeId: e.placeId, price: e.entry } : null;
  }
  const p = PLACES.find((x) => x.id === target && x.actions.some((a) => a.kind === "eat"));
  return p ? { placeId: p.id, price: p.actions.find((a) => a.kind === "eat")!.price ?? 0 } : null;
};
function settle(d: Row) {
  if (d.status === "accepted" && d.hostWent && d.guestWent) d.paid = true;
}

/** ?dating=alone has nobody to ask; ?dating=match starts with an unseen "It's mutual"; ?dating=invite with a date invite waiting; ?dating=tonight with one in progress. */
let alone = false;
export async function previewDatingReset(preset: string | undefined) {
  s = fresh();
  // ?dating=alone: no crew and no chats yet, so "Make it a date" has nobody to ask (#5).
  alone = preset === "alone";
  if (preset === "match" || preset === "tonight") s.crushes.add(ME + ">p-tasha");
  if (preset === "invite") s.dates.push({ id: s.nextId++, host: "p-marco", guest: ME, kind: "place", target: "altitude-718", status: "pending", hostWent: true, guestWent: false, paid: false });
  if (preset === "tonight") {
    s.seen.add("p-tasha");
    s.dates.push({ id: s.nextId++, host: ME, guest: "p-tasha", kind: "place", target: "grind-and-gossip", status: "accepted", hostWent: false, guestWent: true, paid: false });
  }
  return ok(null);
}

export async function previewDatingInbox() {
  const matches = Object.keys(PEOPLE).filter(matched).map((id) => ({ id, ...PEOPLE[id], seen: s.seen.has(id) }));
  const dates: DateNight[] = s.dates
    .filter((d) => d.status !== "cancelled" && (d.status !== "declined" || d.host === ME))
    .map((d) => {
      const other = d.host === ME ? d.guest : d.host;
      const sp = spot(d.kind, d.target)!;
      return {
        id: d.id, mine: d.host === ME, kind: d.kind, target: d.target, status: d.status as DateNight["status"],
        with: { id: other, ...PEOPLE[other] }, price: sp.price, placeId: sp.placeId,
        iWent: d.host === ME ? d.hostWent : d.guestWent, theyWent: d.host === ME ? d.guestWent : d.hostWent,
        paid: d.paid, matched: matched(other),
      };
    })
    .reverse();
  return ok<DatingInbox>({ matches, dates, crushes: mine(), max: DATING.maxCrushes, bonus: { mood: DATING.dateMood, clout: DATING.dateClout } });
}
export async function previewCrushStatus(id: string) {
  return PEOPLE[id] ? ok(status(id)) : fail("That player isn't around anymore.");
}
export async function previewCrush(id: string, on: boolean) {
  if (on) {
    if (!CONNECTED.has(id)) return fail("You two need to know each other first: a crew member or a real chat.");
    if (!has(ME, id) && mine() >= DATING.maxCrushes) return fail(`That's ${DATING.maxCrushes} crushes. Take one back to make room.`);
    s.crushes.add(`${ME}>${id}`);
  } else {
    s.crushes.delete(`${ME}>${id}`);
    s.seen.delete(id);
  }
  return ok(status(id));
}
export async function previewMatchSeen(id: string) {
  s.seen.add(id);
  return ok(null);
}
export async function previewDateCandidates() {
  if (alone) return ok<DateCandidate[]>([]);
  const list: DateCandidate[] = [...CONNECTED].map((id) => ({ id, ...PEOPLE[id], matched: matched(id), crush: has(ME, id) }));
  return ok(list.sort((a, b) => Number(b.matched) - Number(a.matched) || a.name.localeCompare(b.name)));
}
export async function previewDateInvite(withId: string, kind: "place" | "event", target: string) {
  if (!CONNECTED.has(withId)) return fail("You two need to know each other first: a crew member or a real chat.");
  if (!spot(kind, target)) return fail("Pick a place with food or a club night.");
  const live = (d: Row) => d.status === "pending" || d.status === "accepted";
  if (s.dates.some((d) => live(d) && [d.host, d.guest].includes(withId))) return fail("You two already have a date tonight.");
  if (s.dates.filter((d) => d.host === ME).length >= DATING.datesPerDay) return fail(`That's ${DATING.datesPerDay} date invites today. Pace yourself.`);
  const d: Row = { id: s.nextId++, host: ME, guest: withId, kind, target, status: "pending", hostWent: false, guestWent: false, paid: false };
  s.dates.push(d);
  // In the preview, the other player says yes and goes a few seconds later.
  setTimeout(() => { if (d.status === "pending") { d.status = "accepted"; d.guestWent = true; settle(d); } }, 4000);
  return ok(null);
}
export async function previewDateRespond(id: number, yes: boolean) {
  const d = s.dates.find((x) => x.id === id && x.guest === ME);
  if (!d) return fail("That date isn't around anymore.");
  if (d.status !== "pending") return fail("That one's already been answered.");
  d.status = yes ? "accepted" : "declined";
  settle(d);
  return ok(null);
}
export async function previewDateCancel(id: number) {
  const d = s.dates.find((x) => x.id === id && x.host === ME && !x.paid);
  if (d) d.status = "cancelled";
  return ok(null);
}
/** The preview city calls this after a visit or an event, like the SQL triggers. */
export async function previewDateWent(kind: "place" | "event", target: string) {
  for (const d of s.dates) {
    if (d.kind !== kind || d.target !== target || (d.status !== "pending" && d.status !== "accepted")) continue;
    if (d.host === ME) d.hostWent = true;
    if (d.guest === ME) d.guestWent = true;
    settle(d);
  }
  return ok(null);
}
/** Blocking cancels everything between the two (as the SQL trigger on blocks does). */
export async function previewDatingBlock(id: string) {
  s.crushes.delete(`${ME}>${id}`);
  s.crushes.delete(`${id}>${ME}`);
  s.seen.delete(id);
  for (const d of s.dates) if ([d.host, d.guest].includes(id) && (d.status === "pending" || d.status === "accepted")) d.status = "cancelled";
  return ok(null);
}
