import { test } from "node:test";
import assert from "node:assert/strict";
import { mentionLine, onList, partyBadge, partyError, plusOnesFor, type PartyInbox, type PlusOne } from "../lib/party.ts";
import type { StoreProduct } from "../lib/store.ts";

const ev = { id: "jada-sol-listening", placeId: "low-light-lounge", name: "Jada Sol's listening party", host: "Jada Sol", blurb: "", startsAt: "", endsAt: "", clout: 120, energy: 20, mood: 8, confidence: 8, attended: false };
const product = (over: Partial<StoreProduct> = {}, evOver = {}): StoreProduct =>
  ({ sku: "event-jada-sol-listening", type: "exclusive_event", name: ev.name, priceCents: 499, currency: "usd", parent: null, owned: false, pending: false, event: { ...ev, ...evOver }, ...over });

test("\"Spotted at\": you first, named friends, then everyone else (#19)", () => {
  const m = { eventId: ev.id, eventName: ev.name, placeId: ev.placeId, endsAt: "" };
  assert.equal(mentionLine({ ...m, total: 15, names: ["Priya", "Marco"] }), "Spotted at Jada Sol's listening party: you, Priya, Marco and 12 others.");
  assert.equal(mentionLine({ ...m, total: 2, names: ["Priya"] }), "Spotted at Jada Sol's listening party: you and Priya.");
  assert.equal(mentionLine({ ...m, total: 2, names: [] }), "Spotted at Jada Sol's listening party: you and 1 other.");
  assert.equal(mentionLine({ ...m, total: 1, names: [] }), "Spotted at Jada Sol's listening party: you, holding court.");
});

test("on the list: a ticket or someone's plus-one", () => {
  assert.equal(onList(product({ owned: true })), true);
  assert.equal(onList(product({}, { plusOneOf: "Dana" })), true);
  assert.equal(onList(product()), false);
});

test("plus-ones for a party: the one I sent, and an invite waiting for me", () => {
  const person = (name: string) => ({ id: name, name, style: "bodega_drip" });
  const row = (mine: boolean, status: PlusOne["status"], eventId = ev.id): PlusOne =>
    ({ eventId, eventName: "", placeId: "", startsAt: "", endsAt: "", mine, status, host: person("Dana"), guest: person("Marco") });
  const inbox: PartyInbox = { newsOptOut: false, plusOnes: [row(true, "declined"), row(false, "invited"), row(false, "invited", "other")] };
  const r = plusOnesFor(ev.id, inbox);
  assert.equal(r.sent?.status, "declined", "a decline shows so you can ask someone else");
  assert.equal(r.received?.mine, false);
  assert.deepEqual(plusOnesFor(ev.id, null), { sent: undefined, received: undefined });
});

test("party badges take their name from the event", () => {
  assert.deepEqual(partyBadge("party:jada-sol-listening", [product()]), { id: "party:jada-sol-listening", emoji: "🎟️", name: "Was at Jada Sol's listening party" });
  assert.equal(partyBadge("party:gone", [])?.name, "Was at an exclusive party");
  assert.equal(partyBadge("called-it", [product()]), null);
  assert.match(partyError("plus_one_taken: x"), /One per ticket/);
});
