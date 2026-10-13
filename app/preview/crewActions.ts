"use server";

import { CREW, crewActivities, type CrewInbox, type CrewMember, type CrewOuting, type CrewPerson, type CrewResult } from "@/lib/crew";
import { placeById } from "@/lib/city";

// Development previews only: crew outings in memory, following the rules of
// supabase/migrations/0013. Refused in production builds.

// The preview player (SAMPLE in app/preview/[screen]/page.tsx), so the game can tell "you" apart.
const ME = "00000000-0000-0000-0000-000000000000";
const ME_P: CrewPerson = { id: ME, name: "bigsal", style: "arcade_nerd" };
const PEOPLE: CrewPerson[] = [
  { id: "p-tasha", name: "tasha.b", style: "pilates_princess" },
  { id: "p-marco", name: "Marco", style: "midtown_finance" },
  { id: "p-dee", name: "dee_rivera", style: "thrift_store_icon" },
  { id: "p-kenji", name: "Kenji", style: "startup_founder" },
  { id: "p-rae", name: "Rae", style: "night_owl_goth" },
];
const who = (id: string) => (id === ME ? ME_P : PEOPLE.find((p) => p.id === id)!);

interface Row { id: number; host: string; kind: "place" | "event"; placeId: string; activity: string; members: { id: string; status: CrewMember["status"]; went: boolean }[]; full: boolean }
let s = { outings: [] as Row[], next: 1, pairs: new Set<string>(), fullPaid: false, clout: 0, crew: PEOPLE.map((p) => p.id), preset: "" };

const ok = <T,>(data: T): CrewResult<T> => (process.env.NODE_ENV === "production" ? { ok: false, error: "Previews are off in production." } : { ok: true, data });
const fail = (error: string): CrewResult<never> => ({ ok: false, error });
const price = (o: Row) => {
  const place = placeById(o.placeId);
  return place ? crewActivities(place).find((a) => a.id === o.activity)?.price ?? 0 : 0;
};

/** Pays as crew_went does: +perFriend both ways per pair, and the full bonus at fullSize. Only the preview player's share is tracked. */
function went(o: Row, id: string) {
  const m = o.members.find((x) => x.id === id);
  if (!m || m.went || m.status === "declined") return;
  m.went = true;
  if (m.status === "invited") m.status = "in";
  for (const other of o.members.filter((x) => x.went && x.id !== id)) {
    const mine = id === ME ? other.id : other.id === ME ? id : null;
    if (mine && !s.pairs.has(mine)) { s.pairs.add(mine); s.clout += CREW.perFriendClout; }
  }
  if (!o.full && o.members.filter((x) => x.went).length >= CREW.fullSize) {
    o.full = true;
    if (o.members.find((x) => x.id === ME)?.went && !s.fullPaid) { s.fullPaid = true; s.clout += CREW.fullClout; }
  }
}

/** ?crew=invite (Marco asks you out), tonight (you're hosting, 3 went), full (5 went; your visit completes it), empty (no crew). */
export async function previewCrewReset(preset: string | undefined) {
  s = { outings: [], next: 1, pairs: new Set(), fullPaid: false, clout: 0, crew: preset === "empty" ? [] : PEOPLE.map((p) => p.id), preset: preset ?? "" };
  const all = (host: string) => [host, ...[ME, ...PEOPLE.map((p) => p.id)].filter((x) => x !== host)].slice(0, 6);
  if (preset === "invite") {
    s.outings.push({ id: s.next++, host: "p-marco", kind: "place", placeId: "grind-and-gossip", activity: "eat", full: false,
      members: all("p-marco").map((id, i) => ({ id, status: i === 0 ? "host" : id === ME ? "invited" : i < 4 ? "in" : "invited", went: i === 0 || id === "p-tasha" })) });
  }
  if (preset === "tonight" || preset === "full") {
    const o: Row = { id: s.next++, host: ME, kind: "place", placeId: "lucky-seven-deli", activity: "eat", full: false,
      members: all(ME).map((id, i) => ({ id, status: i === 0 ? "host" : "invited", went: false })) };
    s.outings.push(o);
    const goers = preset === "full" ? ["p-tasha", "p-marco", "p-dee", "p-kenji", "p-rae"] : ["p-tasha", "p-marco"];
    if (preset === "tonight") went(o, ME);
    for (const g of goers) went(o, g);
  }
  return ok(null);
}

export async function previewCrewInbox() {
  const outings: CrewOuting[] = s.outings
    .filter((o) => o.members.find((m) => m.id === ME)?.status !== "declined")
    .map((o) => {
      const me = o.members.find((m) => m.id === ME)!;
      return {
        id: o.id, kind: o.kind, placeId: o.placeId, activity: o.activity, price: price(o), mine: o.host === ME, full: o.full,
        myStatus: me.status, iWent: me.went, host: who(o.host),
        members: o.members.map((m) => ({ ...who(m.id), status: m.status, went: m.went })),
      };
    })
    .reverse();
  return ok<CrewInbox>({ outings, clout: s.clout });
}
export async function previewCrewMembers() {
  return ok(s.crew.map(who));
}
export async function previewCrewCreate(kind: "place" | "event", placeId: string, activity: string, members: string[]) {
  const place = placeById(placeId);
  if (!place || !crewActivities(place).some((a) => a.kind === kind && a.id === activity)) return fail("The crew can't come along for that one.");
  if (!members.length) return fail("Pick at least one friend.");
  if (s.outings.some((o) => o.host === ME && o.placeId === placeId && o.activity === activity)) return fail("Your crew is already invited to this tonight.");
  if (s.outings.filter((o) => o.host === ME).length >= CREW.outingsPerDay) return fail(`That's ${CREW.outingsPerDay} crew outings today. Even legends rest.`);
  const o: Row = { id: s.next++, host: ME, kind, placeId, activity, full: false,
    members: [{ id: ME, status: "host", went: false }, ...members.map((id) => ({ id, status: "invited" as const, went: false }))] };
  s.outings.push(o);
  // In the preview, friends say yes and pull up one by one.
  members.forEach((id, i) => setTimeout(() => went(o, id), 5000 + i * 4000));
  return ok(null);
}
export async function previewCrewRespond(id: number, yes: boolean) {
  const o = s.outings.find((x) => x.id === id);
  const m = o?.members.find((x) => x.id === ME);
  if (!o || !m || m.status === "host") return fail("That plan isn't around anymore.");
  if (!m.went) m.status = yes ? "in" : "declined";
  return ok(null);
}
/** The preview city calls this after a visit or an event (complete_task does it in SQL). */
export async function previewCrewWent(placeId: string, activity: string) {
  for (const o of s.outings) if (o.placeId === placeId && o.activity === activity) went(o, ME);
  return ok(null);
}
