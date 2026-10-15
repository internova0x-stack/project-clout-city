"use server";

import { loadArcs } from "@/lib/storyContent";
import { buildFeed, castVote, claimRewards, emptyStoryState, type PlayerStoryState, type VoteCounts } from "@/lib/storyFeedBuild";
import type { StoryResult } from "@/lib/storyFeed";
import type { CheckoutResult, StoreProduct } from "@/lib/store";
import type { PartyInbox, PartyMention, PartyResult, PlusOne } from "@/lib/party";
import { addDaysISO, predictionWindow } from "@/lib/stories";
import { PLACES, SHOP_ITEMS, collectorValue } from "@/lib/city";

// Development previews only: the story world in memory on the dev server, so the
// News app can be tried without a database. Refused in production builds.

const store: { starts: Record<string, string | null>; st: PlayerStoryState; offset: number } = {
  starts: { "sarah-bird": null },
  st: emptyStoryState(),
  offset: 0,
};

// Simulated Queens, for live poll results (roughly the brief's expected poll shape).
const CROWD: VoteCounts = {
  P1: { confront: 412, apologize: 268, "meet-jett": 190, "take-back": 230 },
  P2: { jett: 1240, loretta: 610, theo: 330, "pastor-vale": 220 },
  P3: { "jetts-car": 520, "lorettas-handbag": 470, "radiant-harbor": 260, "east-river": 610 },
};

const nowMs = () => Date.now() + store.offset * 1000;
const nyDate = (ms: number) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date(ms));

function result(extra: { clout?: number; message?: string } = {}): StoryResult {
  if (process.env.NODE_ENV === "production") return { ok: false, error: "Previews are off in production." };
  const arcs = loadArcs();
  const clout = claimRewards(arcs, store.starts, nowMs(), store.st) + (extra.clout ?? 0);
  return { ok: true, feed: buildFeed(arcs, store.starts, nowMs(), store.st, CROWD), clout: clout || undefined, message: extra.message };
}
const fail = (error: string): StoryResult => ({ ok: false, error });

export async function previewStoryRefresh(offsetSeconds = 0) {
  store.offset = offsetSeconds;
  return result();
}
export async function previewStoryVote(pid: string, option: string) {
  const e = castVote(loadArcs(), store.starts, nowMs(), store.st, pid, option);
  return e ? fail(e) : result();
}
export async function previewStoryShadow(pid: string, option: string) {
  if (store.st.votes[pid]) return fail("You already voted on this one, so the archive guess is off.");
  store.st.shadow[pid] = option;
  const arc = loadArcs().find((a) => a.beats.some((b) => b.prediction?.id === pid))!;
  const p = arc.beats.find((b) => b.prediction?.id === pid)!.prediction!;
  if (option === p.correct && arc.shadow_badge && !store.st.badges.some((b) => b.id === arc.shadow_badge)) {
    store.st.badges.push({ id: arc.shadow_badge, arc: arc.id, earnedAt: new Date(nowMs()).toISOString() });
  }
  return result();
}
export async function previewStorySeen(beatId: string) {
  if (!store.st.seen.includes(beatId)) store.st.seen.push(beatId);
  return result();
}
/** Completes a story task by id (share, evidence) or by what was done (place action, event). */
export async function previewStoryTask(taskId: string, by?: { place?: string; action?: string; event?: string }) {
  const feed = result();
  if (!feed.ok) return feed;
  const task = feed.feed.tasks.find((t) => (by ? (by.event ? t.do.event === by.event : t.do.place === by.place && t.do.action === by.action) : t.id === taskId));
  if (!task || task.done) return by ? feed : fail("That story task has moved on. Stories wait for no one.");
  store.st.tasksDone.push(task.id);
  return result({ clout: task.clout, message: `Story task done: ${task.label}` });
}
export async function previewStoryDevStart(day: number | null) {
  store.starts["sarah-bird"] = day === null ? null : addDaysISO(nyDate(nowMs()), -(day - 1));
  if (day === null) store.st = emptyStoryState();
  return result();
}
export async function previewStoryEntitle(sku: string, on: boolean) {
  store.st.skus = on ? [...new Set([...store.st.skus, sku])] : store.st.skus.filter((s) => s !== sku);
  return result();
}
/** Hours until a story day's time from the current game clock (to drive the city clock offset). */
export async function previewStoryHoursTo(day: number, time = "12:00") {
  const start = store.starts["sarah-bird"];
  if (!start) return 0;
  const arc = loadArcs().find((a) => a.id === "sarah-bird")!;
  const ms = predictionWindow(arc, { day } as never, { closes_at: { day, time } } as never, start).closes - 59_999;
  return (ms - Date.now()) / 3_600_000;
}

// ---- Payments, simulated: no Stripe. "Checkout" returns straight to the game, and a
// pretend webhook unlocks the side story a few seconds later, like the real one.
const pending = new Set<string>();
const visited = new Set<string>();
const attended = new Set<string>();
// Two parties at the lounge: one on now, one tomorrow night (real parties are dated rows in exclusive_events).
const hour = 3_600_000;
const PARTIES = () => {
  const now = nowMs();
  const tomorrow10pm = new Date(now + 24 * hour);
  tomorrow10pm.setHours(22, 0, 0, 0);
  return [
    { sku: "event-jada-sol-listening", price: 399, id: "jada-sol-listening", name: "Jada Sol's listening party", host: "Jada Sol",
      blurb: "The pop star plays her new album for a guest list that keeps growing and one very nervous publicist. Phones in a velvet bag at the door.",
      startsAt: new Date(now - hour).toISOString(), endsAt: new Date(now + 3 * hour).toISOString(), clout: 120, mood: 8, confidence: 8 },
    { sku: "event-dex-monroe-afterparty", price: 399, id: "dex-monroe-afterparty", name: "Dex Monroe's sneaker-drop afterparty", host: "Dex Monroe",
      blurb: "The sneaker king celebrates a shoe nobody can buy. You can't buy it either, but you can stand next to it.",
      startsAt: tomorrow10pm.toISOString(), endsAt: new Date(tomorrow10pm.getTime() + 4 * hour).toISOString(), clout: 80, mood: 8, confidence: 8 },
  ];
};
export async function previewStoreCatalog(): Promise<StoreProduct[] | null> {
  if (process.env.NODE_ENV === "production") return null;
  const owned = (sku: string) => store.st.skus.includes(sku);
  // Owned copies get a sample serial (migration 0022 numbers them in collection order).
  const base = (sku: string) => ({
    sku, currency: "usd", parent: null, owned: owned(sku), pending: pending.has(sku),
    serial: owned(sku) ? 41 + store.st.skus.indexOf(sku) : null, ownedAt: owned(sku) ? new Date().toISOString() : null,
  });
  return [
    ...loadArcs()
      .filter((a) => a.type === "side" && a.sku)
      .map((a) => ({ ...base(a.sku!), type: "side_arc" as const, name: a.title, priceCents: 299, parent: a.parent_arc_id ?? null })),
    ...PLACES.filter((p) => p.postcard).map((p) => ({
      ...base(p.postcard!), type: "postcard" as const, name: `Postcard: ${p.name}`, priceCents: 99, placeId: p.id, visited: visited.has(p.id),
    })),
    ...SHOP_ITEMS.filter((i) => i.collector).map((i) => ({
      ...base(i.sku), type: "collector_item" as const, name: i.name, priceCents: i.sku === "col-faux-chinchilla" ? 499 : 399, value: collectorValue(i.category),
    })),
    // Meeting players (migration 0047): unlimited chat, monthly or forever.
    { ...base("chat-unlimited-monthly"), type: "chat_pass" as const, name: "Unlimited chat (monthly)", priceCents: 499 },
    { ...base("chat-unlimited-forever"), type: "chat_pass" as const, name: "Unlimited chat (forever)", priceCents: 3999 },
    ...PARTIES().map((e) => ({
      ...base(e.sku), type: "exclusive_event" as const, name: e.name, priceCents: e.price, placeId: "low-light-lounge",
      event: { id: e.id, placeId: "low-light-lounge", name: e.name, host: e.host, blurb: e.blurb, startsAt: e.startsAt, endsAt: e.endsAt,
               clout: e.clout, energy: 20, mood: e.mood, confidence: e.confidence, attended: attended.has(e.id),
               plusOneOf: party.plusOnes.find((x) => x.eventId === e.id && !x.mine && x.status === "in")?.host.name ?? null },
    })),
  ];
}
/** Meeting players: whether the preview player bought unlimited chat (either plan). */
export async function previewChatUnlimited() {
  return store.st.skus.includes("chat-unlimited-monthly") || store.st.skus.includes("chat-unlimited-forever");
}
export async function previewStoreVisited(placeId: string) {
  visited.add(placeId);
}
export async function previewStoreAttended(eventId: string) {
  attended.add(eventId);
  // v0.9: the party's badge (migration 0029 awards it in attend_exclusive_event).
  if (!store.st.badges.some((b) => b.id === `party:${eventId}`)) store.st.badges.push({ id: `party:${eventId}`, arc: "party", earnedAt: new Date().toISOString() });
}

// ---- v0.9 party keepsakes, simulated (migration 0029): plus-ones, mentions and the gossip setting.
const ME = { id: "00000000-0000-0000-0000-000000000000", name: "bigsal", style: "arcade_nerd" };
const party: PartyInbox = { plusOnes: [], newsOptOut: false };
/** ?party=invite: Dana asks you to be her plus-one at tomorrow's afterparty. ?party=sent: you have
    a Jada ticket and Marco is coming as your plus-one. ?party=ticket: a Jada ticket, no plus-one yet. */
export async function previewPartyReset(preset?: string) {
  party.plusOnes = [];
  party.newsOptOut = false;
  const [jada, dex] = PARTIES();
  const ev = (e: typeof jada) => ({ eventId: e.id, eventName: e.name, placeId: "low-light-lounge", startsAt: e.startsAt, endsAt: e.endsAt });
  if (preset === "invite") {
    party.plusOnes.push({ ...ev(dex), mine: false, status: "invited", host: { id: "p-dana", name: "dana.vibes", style: "pilates_princess" }, guest: ME });
  }
  if (preset === "sent" || preset === "ticket") {
    if (!store.st.skus.includes(jada.sku)) store.st.skus.push(jada.sku);
  }
  if (preset === "sent") {
    party.plusOnes.push({ ...ev(jada), mine: true, status: "in", host: ME, guest: { id: "p-marco", name: "Marco", style: "midtown_finance" } });
  }
}
export async function previewPartyInbox(): Promise<PartyInbox | null> {
  if (process.env.NODE_ENV === "production") return null;
  return structuredClone(party);
}
export async function previewPartyInvite(eventId: string, guestId: string): Promise<PartyResult> {
  const e = PARTIES().find((x) => x.id === eventId);
  if (!e || !store.st.skus.includes(e.sku)) return { ok: false, error: "You need a ticket to bring someone." };
  if (party.plusOnes.some((x) => x.eventId === eventId && x.mine && x.status !== "declined")) return { ok: false, error: "You already have a plus-one. One per ticket; the bouncer counts." };
  const people: Record<string, { name: string; style: string }> = {
    "p-tasha": { name: "tasha.b", style: "pilates_princess" }, "p-marco": { name: "Marco", style: "midtown_finance" },
    "p-dee": { name: "dee_rivera", style: "thrift_store_icon" }, "p-kenji": { name: "Kenji", style: "startup_founder" }, "p-rae": { name: "Rae", style: "night_owl_goth" },
  };
  const g = people[guestId];
  if (!g) return { ok: false, error: "Plus-ones come from your crew. Invite them to the game first." };
  party.plusOnes = party.plusOnes.filter((x) => !(x.eventId === eventId && x.mine));
  // In the preview, friends say yes after a moment.
  const row: PlusOne = { eventId, eventName: e.name, placeId: "low-light-lounge", startsAt: e.startsAt, endsAt: e.endsAt, mine: true, status: "invited", host: ME, guest: { id: guestId, ...g } };
  party.plusOnes.push(row);
  setTimeout(() => { row.status = "in"; }, 5000);
  return { ok: true };
}
export async function previewPartyRespond(eventId: string, yes: boolean): Promise<PartyResult> {
  const row = party.plusOnes.find((x) => x.eventId === eventId && !x.mine && x.status === "invited");
  if (!row) return { ok: false, error: "That invite isn't waiting anymore." };
  row.status = yes ? "in" : "declined";
  return { ok: true };
}
export async function previewPartyMentions(): Promise<PartyMention[] | null> {
  if (process.env.NODE_ENV === "production") return null;
  if (party.newsOptOut) return [];
  return PARTIES().filter((e) => attended.has(e.id)).map((e) => {
    const plus = party.plusOnes.find((x) => x.eventId === e.id && x.status === "in");
    const friend = plus ? (plus.mine ? plus.guest.name : plus.host.name) : null;
    return { eventId: e.id, eventName: e.name, placeId: "low-light-lounge", endsAt: e.endsAt, total: 15, names: friend ? [friend, "tasha.b"] : ["tasha.b"] };
  });
}
export async function previewSetNewsOptOut(out: boolean): Promise<PartyResult> {
  party.newsOptOut = out;
  return { ok: true };
}
export async function previewCheckout(sku: string, returnTo: string): Promise<CheckoutResult> {
  if (process.env.NODE_ENV === "production") return { ok: false, error: "Previews are off in production." };
  pending.add(sku);
  setTimeout(() => {
    pending.delete(sku);
    if (!store.st.skus.includes(sku)) store.st.skus.push(sku);
  }, 4000);
  const url = new URL(returnTo, "http://preview.local");
  url.searchParams.set("purchase", "success");
  url.searchParams.set("sku", sku);
  return { ok: true, url: `${url.pathname}${url.search}` };
}
