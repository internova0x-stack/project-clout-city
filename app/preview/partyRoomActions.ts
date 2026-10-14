"use server";

// Development previews only: a party room in memory on the dev server (?party=ticket gives you a
// ticket to tonight's party at the lounge). A few real-looking guests and some chat; NPCs fill the rest.
import type { PartyMessage, PartyPerson, PartyRoomResult, PartyRoomState } from "@/lib/partyRoom";

const off = () => process.env.NODE_ENV === "production";
const PEOPLE: PartyPerson[] = [
  { id: "p-1", name: "Rina Rooftop", style: "influencer_soft_glam", look: {}, crew: true },
  { id: "p-2", name: "Dev Nightshift", style: "night_owl_goth", look: {}, crew: false },
  { id: "p-3", name: "Marcus Ledger", style: "midtown_finance", look: {}, crew: false },
  { id: "p-4", name: "Kiki Pixel", style: "arcade_nerd", look: {}, crew: false },
];
const mem: { messages: PartyMessage[]; next: number } = {
  messages: [
    { id: 1, from: "p-2", name: "Dev Nightshift", body: "Who's on the decks tonight?", at: new Date().toISOString(), mine: false },
    { id: 2, from: "p-1", name: "Rina Rooftop", body: "This view though 🌃", at: new Date().toISOString(), mine: false },
    { id: 3, from: "p-3", name: "Marcus Ledger", body: "Did anyone see who Chardonnay left with?? 👀", at: new Date().toISOString(), mine: false },
  ],
  next: 4,
};

export async function previewPartyRoom(_eventId: string, after: number): Promise<PartyRoomResult<PartyRoomState>> {
  if (off()) return { ok: false, error: "Previews are off in production." };
  return { ok: true, data: { count: PEOPLE.length + 1, people: PEOPLE, messages: mem.messages.filter((m) => m.id > after) } };
}
export async function previewPartySay(_eventId: string, body: string): Promise<PartyRoomResult<PartyMessage>> {
  if (off()) return { ok: false, error: "Previews are off in production." };
  const m: PartyMessage = { id: mem.next++, from: "preview", name: "You", body: body.slice(0, 200), at: new Date().toISOString(), mine: true };
  mem.messages.push(m);
  return { ok: true, data: m };
}
export async function previewPartyReport(): Promise<PartyRoomResult<null>> {
  return off() ? { ok: false, error: "Previews are off in production." } : { ok: true, data: null };
}
