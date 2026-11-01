// The Player Economy in the preview (/preview/home): the same rules as migration 0151, in memory. Sample friends answer
// on their own. ?economy=gift|gifted|history|jobs starts in that state (gift: tap 🎁 in the Shop; gifted: a gift waits on
// the home screen; history: Phone → Bank → Trades & gifts has a few weeks of rows; jobs: the Jobs board's errands and
// event support, one errand half done). ?economy=locked shows a player who isn't Rank 2 yet.

import { itemBySku } from "./city.ts";
import {
  PLAYER_ECONOMY, economyError, uncountedFor,
  type EconomyApi, type EconomyRow, type EconomyState, type GiftCandidate, type GiftInbox, type IncomingGift, type SentGift,
} from "./playerEconomy.ts";

interface SimHooks {
  cash(): number;
  pay(cash: number): void;
  /** Puts an accepted gift in the player's things (false when they already own it). */
  grant(sku: string): boolean;
  /** The Shop's name and price for a sku (the catalog or the code's list). */
  item(sku: string): { name: string; price: number } | null;
}

const FRIENDS: GiftCandidate[] = [
  { id: "p-tasha", name: "tasha.b", style: "pilates_princess", crew: true, partner: false, canReceive: true },
  { id: "p-dev", name: "dev.r", style: "arcade_nerd", crew: false, partner: true, canReceive: true },
  { id: "p-kai", name: "kai_beats", style: "bodega_drip", crew: false, partner: false, canReceive: true },
  { id: "p-nina", name: "nina.nyc", style: "pilates_princess", crew: true, partner: false, canReceive: false },
];
const iso = (msAgo = 0) => new Date(Date.now() - msAgo).toISOString();
const DAY = 86_400_000;
const monday = () => {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
};

export function createEconomySim(hooks: SimHooks, preset?: string): EconomyApi {
  let nextId = 500;
  const week = { sent: 0, received: 0, giftsSent: 0, earned: 0 };
  let open = false;
  const incoming: IncomingGift[] = [];
  const sent: SentGift[] = [];
  const rows: EconomyRow[] = [];
  const row = (r: Omit<EconomyRow, "id" | "ref" | "status" | "withStyle"> & { status?: EconomyRow["status"] }) => {
    const f = FRIENDS.find((x) => x.id === r.with);
    rows.unshift({ id: nextId++, ref: `${r.kind}:${nextId}`, status: "done", withStyle: f?.style ?? null, ...r });
  };
  if (preset === "gifted") {
    incoming.push({ id: nextId++, sku: "home-island", name: "Kitchen island", value: 1400, message: "For the kitchen you swear you'll use.",
      createdAt: iso(20 * 60_000), expiresAt: iso(-7 * DAY), from: "p-tasha", fromName: "tasha.b", fromStyle: "pilates_princess" });
  }
  if (preset === "history") {
    row({ kind: "job", label: "Errands: 3 check-ins", value: 1000, fee: 50, cash: true, at: iso(3 * DAY), direction: "received", with: "p-tasha", withName: "tasha.b" });
    row({ kind: "gift", label: "Chunky sneakers", value: 460, fee: 0, cash: false, at: iso(2 * DAY), direction: "sent", with: "p-dev", withName: "dev.r" });
    row({ kind: "gift", label: "Potted plant", value: 45, fee: 0, cash: false, at: iso(DAY), direction: "sent", with: "p-kai", withName: "kai_beats", status: "reversed" });
    row({ kind: "job", label: "Event support: Neon Nights", value: 500, fee: 25, cash: true, at: iso(5 * 3_600_000), direction: "sent", with: "p-kai", withName: "kai_beats" });
    row({ kind: "gift", label: "Kitchen island", value: 1400, fee: 0, cash: false, at: iso(3_600_000), direction: "received", with: "p-tasha", withName: "tasha.b" });
    Object.assign(week, { sent: 960, received: 1400, giftsSent: 2, earned: 6200 });
  }
  const locked = preset === "locked";
  const ok = <T,>(data: T) => ({ ok: true as const, data });
  const fail = (code: string) => ({ ok: false as const, error: economyError(code) });
  const state = (): EconomyState => ({
    phases: { ...PLAYER_ECONOMY.phases },
    unlocked: !locked,
    reason: locked ? "economy_locked" : null,
    unlocksAt: iso(8 * DAY),
    rank: locked ? 1 : 3,
    open,
    week: { start: monday(), cap: PLAYER_ECONOMY.weeklyCap.min, sent: week.sent, received: week.received, giftsSent: week.giftsSent,
            giftsLeft: Math.max(0, PLAYER_ECONOMY.gifts.perWeek - week.giftsSent) },
    uncounted: uncountedFor(week.earned),
  });
  return {
    async state() { return ok(state()); },
    async setOpen(on) { open = on; return ok(state()); },
    async history() { return ok(structuredClone(rows)); },
    async candidates() { return ok(structuredClone(FRIENDS)); },
    async inbox(): Promise<{ ok: true; data: GiftInbox }> { return ok({ incoming: structuredClone(incoming), sent: structuredClone(sent) }); },
    async send(to, sku, message) {
      if (locked) return fail("economy_locked");
      const who = FRIENDS.find((f) => f.id === to);
      const item = hooks.item(sku);
      if (!who) return fail("not_friends");
      if (!who.canReceive) return fail("they_cant_receive");
      if (!item) return fail("not_giftable");
      if (message.length > PLAYER_ECONOMY.gifts.messageMax) return fail("message_too_long");
      if (week.giftsSent >= PLAYER_ECONOMY.gifts.perWeek) return fail("gift_limit");
      if (week.sent + item.price > PLAYER_ECONOMY.weeklyCap.min) return fail("weekly_limit");
      if (sent.some((g) => g.to === to && g.sku === sku && g.status !== "declined")) return fail("they_own_it");
      if (hooks.cash() < item.price) return fail("cant_afford");
      hooks.pay(-item.price);
      week.sent += item.price;
      week.giftsSent += 1;
      const id = nextId++;
      const g: SentGift = { id, sku, name: item.name, price: item.price, status: "pending", createdAt: iso(), to, toName: who.name, toStyle: who.style };
      sent.unshift(g);
      row({ kind: "gift", label: item.name, value: item.price, fee: 0, cash: false, at: iso(), direction: "sent", with: to, withName: who.name });
      // Sample friends answer after a few seconds (kai_beats is a decliner).
      setTimeout(() => {
        g.status = to === "p-kai" ? "declined" : "accepted";
        if (g.status === "declined") {
          if (!hooks.grant(sku)) hooks.pay(item.price);
          week.sent -= item.price;
          const r = rows.find((x) => x.label === item.name && x.direction === "sent" && x.status === "done");
          if (r) r.status = "reversed";
        }
      }, 6000);
      return ok({ id, cash: -item.price });
    },
    async answer(id, accept) {
      const i = incoming.findIndex((g) => g.id === id);
      if (i < 0) return fail("gift_gone");
      const g = incoming.splice(i, 1)[0];
      if (accept) {
        if (!hooks.grant(g.sku)) { incoming.splice(i, 0, g); return fail("already_owned"); }
        week.received += g.value;
        row({ kind: "gift", label: g.name, value: g.value, fee: 0, cash: false, at: iso(), direction: "received", with: g.from, withName: g.fromName });
        return ok({ status: "accepted" });
      }
      return ok({ status: "declined", back: "item" as const });
    },
  };
}

/** The Shop's name and price for the sim (the code's list; catalog pieces fall back to their sku). */
export function simItem(sku: string, catalog?: { sku: string; name: string; price: number }[]): { name: string; price: number } | null {
  const c = catalog?.find((x) => x.sku === sku);
  if (c) return { name: c.name, price: c.price };
  const i = itemBySku(sku);
  return i ? { name: i.name, price: i.price } : null;
}
