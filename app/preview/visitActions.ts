"use server";

import { previewOnly } from "./guard";

import { VISITS, snacksFor, type VisitHome, type VisitKind, type VisitMessage, type VisitPerson, type VisitResult, type VisitRoom, type VisitState } from "@/lib/visits";

// Development previews only: having people over in memory, following supabase/migrations/0121. Refused in production.
// Sample players accept and walk in a few seconds after being invited; paying is mirrored by the caller.
//   ?visit=none (default)  nothing going on: the Mood row offers "Have people over"
//   ?visit=hosting         a hangout with @tasha.b and @dev.r in your place
//   ?visit=invite          @kai_beats invited you to a house party that's on now
//   ?visit=guest           you're at @kai_beats's party with two others

const P = (id: string, name: string, style: string): VisitPerson => ({ id, name, style, look: null });
const TASHA = P("p-tasha", "tasha.b", "pilates_princess");
const DEV = P("p-dev", "dev.r", "arcade_nerd");
const KAI = P("p-kai", "kai_beats", "bodega_drip");
const MIRA = P("p-mira", "mira.q", "pilates_princess");
const INVITABLE = [{ ...TASHA, crew: true, partner: false }, { ...DEV, crew: true, partner: false }, { ...MIRA, crew: false, partner: false }, { ...KAI, crew: true, partner: false }];
const CAP = 3;

interface S {
  hosting: VisitState["hosting"] & object | null;
  hostedAt: number;
  invite: VisitState["invites"][number] | null;
  messages: VisitMessage[];
  left: Record<VisitKind, number>;
  paid: Set<string>;
}
const iso = (ms: number) => new Date(ms).toISOString();
const fresh = (): S => ({ hosting: null, hostedAt: 0, invite: null, messages: [], left: { hang: 3, party: 1 }, paid: new Set() });
let s = fresh();
const ok = <T,>(data: T): VisitResult<T> => (process.env.NODE_ENV === "production" ? { ok: false, error: "Previews are off in production." } : { ok: true, data });
const fail = (error: string): VisitResult<never> => ({ ok: false, error });

function tick() {
  // Invited sample players walk in 6 seconds after the invite, and count as stayed (for the preview) 10 seconds later.
  if (!s.hosting) return;
  const since = Date.now() - s.hostedAt;
  for (const g of s.hosting.guests) {
    if (g.status === "invited" && since > 6000) Object.assign(g, { status: "accepted", here: true });
    if (g.here && since > 16000) g.paid = true;
  }
}
function state(): VisitState {
  tick();
  return {
    hosting: s.hosting && Date.parse(s.hosting.ends) > Date.now() ? s.hosting : null,
    invites: s.invite ? [s.invite] : [],
    invitable: INVITABLE, capacity: CAP, snacks: snacksFor(CAP), left: s.left, blocked: null, crib: 61,
  };
}

export async function previewVisitReset(preset: string | undefined) {
  previewOnly();
  s = fresh();
  const now = Date.now();
  if (preset === "hosting") {
    s.hosting = { id: 1, kind: "hang", starts: iso(now - 10 * 60e3), ends: iso(now + 50 * 60e3), capacity: CAP, crib: 61,
      guests: [{ ...TASHA, status: "accepted", here: true, paid: true }, { ...DEV, status: "accepted", here: true, paid: false }] };
    s.hostedAt = now - 60e3;
    s.left.hang = 2;
    s.messages = [
      { id: 1, from: TASHA.id, name: TASHA.name, body: "Okay the paintings?? 😍", at: iso(now - 5 * 60e3), mine: false },
      { id: 2, from: DEV.id, name: DEV.name, body: "Who's got the aux", at: iso(now - 2 * 60e3), mine: false },
    ];
  }
  if (preset === "invite" || preset === "guest") {
    s.invite = { id: 9, kind: "party", starts: iso(now - 20 * 60e3), ends: iso(now + 100 * 60e3), host: KAI, status: preset === "guest" ? "accepted" : "invited", capacity: 6, going: 3 };
    s.messages = [{ id: 1, from: KAI.id, name: KAI.name, body: "Shoes off, vibes on 🎉", at: iso(now - 10 * 60e3), mine: false }];
  }
}
export async function previewVisitState() { previewOnly(); return ok(state()); }
export async function previewVisitHost(kind: VisitKind, guests: string[], startsAt: string | null) {
  previewOnly();
  if (s.hosting) return fail("You're already hosting. One thing at a time.");
  if (!guests.length) return fail("Pick someone to invite.");
  if (guests.length > CAP) return fail("Your place doesn't fit that many.");
  if (s.left[kind] < 1) return fail("That's enough hosting for today. Your neighbors need sleep.");
  const start = kind === "hang" || !startsAt ? Date.now() : Date.parse(startsAt);
  s.left[kind] -= 1;
  s.hostedAt = Date.now();
  s.messages = [];
  s.hosting = { id: 2, kind, starts: iso(start), ends: iso(start + VISITS.kinds[kind].minutes * 60e3), capacity: CAP, crib: 61,
    guests: INVITABLE.filter((p) => guests.includes(p.id)).map((p) => ({ id: p.id, name: p.name, style: p.style, look: null, status: "invited" as const, here: false, paid: false })) };
  return ok(state());
}
export async function previewVisitEnd() { previewOnly(); s.hosting = null; return ok(state()); }
export async function previewVisitSendHome(id: string) {
  previewOnly();
  const g = s.hosting?.guests.find((x) => x.id === id);
  if (g) Object.assign(g, { status: "sent_home", here: false });
  return ok(state());
}
export async function previewVisitAnswer(id: number, yes: boolean) {
  previewOnly();
  if (!s.invite || s.invite.id !== id) return fail("You're not on that guest list.");
  if (yes) s.invite.status = "accepted"; else s.invite = null;
  return ok(state());
}
function room(id: number, after: number): VisitRoom | null {
  tick();
  if (s.hosting && s.hosting.id === id) {
    return { id, kind: s.hosting.kind, starts: s.hosting.starts, ends: s.hosting.ends, over: false, host: P("me", "you", "bodega_drip"), mine: true, crib: 61, me: null,
      people: s.hosting.guests.filter((g) => g.here).map((g) => ({ id: g.id, name: g.name, style: g.style, look: null, host: false })),
      messages: s.messages.filter((m) => m.id > after) };
  }
  if (s.invite && s.invite.id === id) {
    return { id, kind: s.invite.kind, starts: s.invite.starts, ends: s.invite.ends, over: false, host: KAI, mine: false, crib: 74,
      me: { status: "accepted", paid: s.paid.has("guest") }, people: [{ ...KAI, host: true }, { ...TASHA, host: false }, { ...DEV, host: false }],
      messages: s.messages.filter((m) => m.id > after) };
  }
  return null;
}
export async function previewVisitArrive(id: number) {
  previewOnly();
  if (!s.invite || s.invite.id !== id) return fail("You're not on that guest list.");
  s.invite.status = "accepted";
  return ok(room(id, 0)!);
}
export async function previewVisitLeave(id: number) { previewOnly(); void id; s.invite = null; return ok(state()); }
export async function previewVisitRoom(id: number, after: number) {
  previewOnly();
  const r = room(id, after);
  return r ? ok(r) : fail("That's over. You missed it.");
}
export async function previewVisitHome(id: number): Promise<VisitResult<VisitHome>> {
  previewOnly();
  return ok({ id, host: KAI.id, hostName: KAI.name, homeId: "lic_highrise", houseSku: null, layout: null, items: [] });
}
export async function previewVisitSay(id: number, body: string) {
  previewOnly();
  void id;
  const m: VisitMessage = { id: (s.messages.at(-1)?.id ?? 0) + 1, from: "me", name: "you", body: body.trim(), at: new Date().toISOString(), mine: true };
  s.messages.push(m);
  return ok(m);
}
