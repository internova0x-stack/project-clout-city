// The Market in the preview (/preview/home): the same rules as migration 0152, in memory, with its own sample closet.
// ?market=browse (friends' and open-board listings), listing (you have one up and one sold), offer (a swap waiting for
// you), confirm (a big swap they've confirmed: the second "Are you sure?"), off (the phase is switched off: Opening soon).
// Sample friends answer swaps on their own after a few seconds.

import { itemBySku } from "./city.ts";
import { PLAYER_ECONOMY, economyFee, priceBand } from "./playerEconomy.ts";
import {
  MARKETPLACE, marketError, swapCheck,
  type ClosetItem, type MarketApi, type MarketListing, type MarketPerson, type MarketState, type MarketTrade, type MyListing, type MyThing, type TradeItem,
} from "./marketplace.ts";

interface SimHooks {
  cash(): number;
  pay(cash: number): void;
}

const PEOPLE: MarketPerson[] = [
  { id: "p-tasha", name: "tasha.b", style: "pilates_princess", crew: true, partner: false, canTrade: true },
  { id: "p-dev", name: "dev.r", style: "arcade_nerd", crew: false, partner: true, canTrade: true },
  { id: "p-kai", name: "kai_beats", style: "bodega_drip", crew: false, partner: false, canTrade: true },
];
const STRANGER = { id: "p-marisol", name: "marisol.thrifts", style: "thrift_store_icon" };
const iso = (msAgo = 0) => new Date(Date.now() - msAgo).toISOString();
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const info = (sku: string) => {
  const i = itemBySku(sku);
  return { name: i?.name ?? sku, emoji: i?.emoji ?? "🛍️", category: i?.category ?? "home", reference: i?.price ?? 100 };
};

export function createMarketSim(hooks: SimHooks, preset?: string): MarketApi {
  let nextId = 900;
  let on = preset !== "off";
  let open = preset === "browse";
  const things: (MyThing & { owner: "me" })[] = [];
  const closets: Record<string, { id: number; sku: string }[]> = {
    "p-tasha": [{ id: nextId++, sku: "home-armchair-green" }, { id: nextId++, sku: "fit-leather-blazer" }],
    "p-dev": [{ id: nextId++, sku: "home-desk" }, { id: nextId++, sku: "set-gala-night" }, { id: nextId++, sku: "lux-diamond-studs" }],
    "p-kai": [{ id: nextId++, sku: "fit-varsity-tee" }, { id: nextId++, sku: "home-bookshelf" }],
  };
  const mine = (sku: string, extra: Partial<MyThing> = {}) => {
    const i = info(sku);
    const b = priceBand(i.reference);
    things.push({ id: nextId++, sku, name: i.name, emoji: i.emoji, category: i.category, reference: i.reference, min: b.min, max: b.max,
      ok: true, worn: false, locked: null, holdUntil: null, acquired: "bought", owner: "me", ...extra });
  };
  mine("home-tv"); mine("fit-chunky-sneakers"); mine("home-island"); mine("set-st-marks-punk"); mine("home-plant");
  mine("fit-satin-bomber", { worn: true }); mine("home-rug-violet", { ok: false, holdUntil: iso(-9 * DAY) });
  const browse: MarketListing[] = [];
  const listings: MyListing[] = [];
  const trades: MarketTrade[] = [];
  const listing = (seller: { id: string; name: string; style: string }, sku: string, price: number, friend: boolean, ago: number) => {
    const i = info(sku);
    browse.push({ id: nextId++, sku, name: i.name, emoji: i.emoji, category: i.category, price, reference: i.reference, createdAt: iso(ago), expiresAt: iso(ago - 14 * DAY),
      seller: seller.id, sellerName: seller.name, sellerStyle: seller.style, friend, owned: things.some((t) => t.sku === sku), skuLeft: MARKETPLACE.perSkuWeek });
  };
  listing(PEOPLE[0], "home-bed-pink", 820, true, 2 * HOUR);
  listing(PEOPLE[2], "fit-meteors-jersey", 95, true, 5 * HOUR);
  listing(PEOPLE[1], "home-piano", 5200, true, DAY);
  listing(STRANGER, "set-witch", 2100, false, 3 * HOUR);
  listing(STRANGER, "home-rug-sand", 130, false, 7 * HOUR);
  const item = (id: number, sku: string, side: "a" | "b"): TradeItem => {
    const i = info(sku);
    return { id, sku, name: i.name, emoji: i.emoji, category: i.category, reference: i.reference, side };
  };
  if (preset === "listing") {
    const tv = things.find((t) => t.sku === "home-tv")!;
    const l: MyListing = { id: nextId++, itemId: tv.id, sku: tv.sku, name: tv.name, emoji: tv.emoji, price: 720, reference: tv.reference, fee: economyFee("sale", 720),
      status: "open", createdAt: iso(3 * HOUR), expiresAt: iso(-13 * DAY), soldAt: null, buyerName: null };
    tv.locked = `listing:${l.id}`;
    tv.ok = false;
    listings.push(l);
    listings.push({ id: nextId++, itemId: null, sku: "home-floor-lamp", name: "Floor lamp", emoji: "💡", price: 110, reference: 90, fee: economyFee("sale", 110),
      status: "sold", createdAt: iso(2 * DAY), expiresAt: iso(-12 * DAY), soldAt: iso(DAY), buyerName: "kai_beats" });
  }
  if (preset === "offer" || preset === "confirm") {
    const big = preset === "confirm";
    const myIsland = things.find((t) => t.sku === (big ? "home-island" : "fit-chunky-sneakers"))!;
    const theirs = big ? closets["p-dev"].find((c) => c.sku === "set-gala-night")! : closets["p-tasha"].find((c) => c.sku === "fit-leather-blazer")!;
    const them = big ? PEOPLE[1] : PEOPLE[0];
    const ti = item(theirs.id, theirs.sku, "a");
    const yi = item(myIsland.id, myIsland.sku, "b");
    const theirCash = big ? 600 : 0;
    const yourCash = big ? 0 : 0;
    // Big: the dev's gala outfit + C$600 for your island and the punk set (over C$2,500 on their side).
    const extra = big ? things.find((t) => t.sku === "set-st-marks-punk")! : null;
    const yourItems = extra ? [yi, item(extra.id, extra.sku, "b")] : [yi];
    trades.push({
      id: nextId++, version: 1, status: "open", mine: "b", createdAt: iso(40 * 60_000), updatedAt: iso(40 * 60_000), expiresAt: iso(-23 * HOUR), settledAt: null,
      with: them.id, withName: them.name, withStyle: them.style,
      you: { items: yourItems, cash: yourCash, value: yourItems.reduce((s, x) => s + x.reference, 0) + yourCash, ok: false },
      them: { items: [ti], cash: theirCash, value: ti.reference + theirCash, ok: true },
      big: false,
    });
    const t = trades[0];
    t.big = Math.max(t.you.value, t.them.value) > MARKETPLACE.bigTrade;
  }
  const ok = <T,>(data: T) => ({ ok: true as const, data });
  const fail = (code: string) => ({ ok: false as const, error: marketError(code) });
  const state = (): MarketState => on ? ({
    on, unlocked: true, reason: null, unlocksAt: iso(8 * DAY), hold: null, open,
    browse: structuredClone(browse.filter((l) => l.friend || open)), mine: structuredClone(listings), trades: structuredClone(trades),
    items: structuredClone(things.map(({ owner: _o, ...t }) => t)),
  }) : { on: false, unlocked: true, reason: null, unlocksAt: iso(8 * DAY), hold: null, open, browse: [], mine: [], trades: [], items: [] };
  const closetOf = (who: string): ClosetItem[] => (closets[who] ?? []).map((c) => { const i = info(c.sku); return { id: c.id, sku: c.sku, ...i }; });
  const contents = (mineIds: number[], theirIds: number[], who: string, cashMine: number, cashTheirs: number) => {
    const my = mineIds.map((id) => things.find((t) => t.id === id)).filter((x): x is (typeof things)[number] => !!x);
    const their = theirIds.map((id) => closets[who]?.find((c) => c.id === id)).filter((x): x is { id: number; sku: string } => !!x);
    if (my.length !== mineIds.length || their.length !== theirIds.length) return { error: "bad_items" as const };
    if (my.some((t) => t.worn)) return { error: "item_worn" as const };
    if (my.some((t) => !t.ok && !(t.locked ?? "").startsWith("trade:"))) return { error: my.some((t) => t.locked) ? "item_locked" as const : "not_tradable" as const };
    const yv = my.reduce((s, t) => s + t.reference, 0);
    const tv = their.reduce((s, c) => s + info(c.sku).reference, 0);
    const chk = swapCheck({ items: my.length, value: yv, cash: cashMine }, { items: their.length, value: tv, cash: cashTheirs });
    if (!chk.ok) return { error: chk.reason };
    return { my, their, yv, tv };
  };
  const release = (t: MarketTrade) => {
    for (const x of things) if (x.locked === `trade:${t.id}`) { x.locked = null; x.ok = true; }
    if (t.you.ok && t.you.cash > 0) hooks.pay(t.you.cash);
    t.you.ok = false; t.them.ok = false;
  };
  const settle = (t: MarketTrade) => {
    for (const x of t.you.items) { const i = things.findIndex((y) => y.id === x.id); if (i >= 0) things.splice(i, 1); }
    for (const x of t.them.items) {
      const i = info(x.sku);
      const b = priceBand(i.reference);
      things.push({ id: x.id, sku: x.sku, name: i.name, emoji: i.emoji, category: i.category, reference: i.reference, min: b.min, max: b.max,
        ok: false, worn: false, locked: null, holdUntil: iso(-PLAYER_ECONOMY.noResaleDays * DAY), acquired: "bought", owner: "me" });
    }
    if (t.them.cash > 0) hooks.pay(t.them.cash - economyFee("trade", t.them.cash));
    t.status = "done";
    t.settledAt = iso();
  };
  return {
    async state() { return ok(state()); },
    async people() { return ok(structuredClone(PEOPLE)); },
    async closet(who) { return on ? ok(closetOf(who)) : fail("phase_off"); },
    async setOpen(v) { open = v; return ok(null); },
    async list(id, price) {
      if (!on) return fail("phase_off");
      const t = things.find((x) => x.id === id);
      if (!t) return fail("unknown_item");
      if (t.locked) return fail("item_locked");
      if (t.holdUntil && Date.parse(t.holdUntil) > Date.now()) return fail("no_resale");
      if (!t.ok) return fail("not_tradable");
      if (t.worn) return fail("item_worn");
      if (price < t.min || price > t.max) return fail("out_of_band");
      if (listings.filter((l) => l.status === "open").length >= MARKETPLACE.listing.maxOpen) return fail("listing_limit");
      const l: MyListing = { id: nextId++, itemId: t.id, sku: t.sku, name: t.name, emoji: t.emoji, price, reference: t.reference, fee: economyFee("sale", price),
        status: "open", createdAt: iso(), expiresAt: iso(-MARKETPLACE.listing.days * DAY), soldAt: null, buyerName: null };
      listings.unshift(l);
      t.locked = `listing:${l.id}`;
      t.ok = false;
      // A sample friend snaps up the cheap ones.
      if (price <= t.reference) setTimeout(() => {
        if (l.status !== "open") return;
        l.status = "sold"; l.soldAt = iso(); l.buyerName = "tasha.b";
        const i = things.findIndex((x) => x.id === t.id);
        if (i >= 0) things.splice(i, 1);
        hooks.pay(price - l.fee);
      }, 8000);
      return ok({ id: l.id, fee: l.fee });
    },
    async cancel(id) {
      const l = listings.find((x) => x.id === id && x.status === "open");
      if (!l) return fail("listing_gone");
      l.status = "cancelled";
      const t = things.find((x) => x.locked === `listing:${id}`);
      if (t) { t.locked = null; t.ok = true; }
      return ok(null);
    },
    async buy(id, sure) {
      if (!on) return fail("phase_off");
      const i = browse.findIndex((x) => x.id === id);
      if (i < 0) return fail("listing_gone");
      const l = browse[i];
      if (l.price > MARKETPLACE.bigTrade && !sure) return fail("confirm_big");
      if (things.some((t) => t.sku === l.sku)) return fail("already_owned");
      if (hooks.cash() < l.price) return fail("cant_afford");
      hooks.pay(-l.price);
      browse.splice(i, 1);
      const b = priceBand(l.reference);
      things.push({ id: nextId++, sku: l.sku, name: l.name, emoji: l.emoji, category: l.category, reference: l.reference, min: b.min, max: b.max,
        ok: false, worn: false, locked: null, holdUntil: iso(-PLAYER_ECONOMY.noResaleDays * DAY), acquired: "bought", owner: "me" });
      return ok({ id, cash: -l.price });
    },
    async offer(to, mineIds, theirIds, cashMine, cashTheirs) {
      if (!on) return fail("phase_off");
      const who = PEOPLE.find((p) => p.id === to);
      if (!who) return fail("not_visible");
      if (trades.some((t) => t.status === "open" && t.with === to)) return fail("trade_open");
      const c = contents(mineIds, theirIds, to, cashMine, cashTheirs);
      if ("error" in c) return fail(c.error!);
      if (cashMine > hooks.cash()) return fail("cant_afford");
      const id = nextId++;
      const t: MarketTrade = {
        id, version: 1, status: "open", mine: "a", createdAt: iso(), updatedAt: iso(), expiresAt: iso(-MARKETPLACE.swap.hours * HOUR), settledAt: null,
        with: to, withName: who.name, withStyle: who.style,
        you: { items: c.my.map((x) => item(x.id, x.sku, "a")), cash: cashMine, value: c.yv + cashMine, ok: true },
        them: { items: c.their.map((x) => item(x.id, x.sku, "b")), cash: cashTheirs, value: c.tv + cashTheirs, ok: false },
        big: Math.max(c.yv + cashMine, c.tv + cashTheirs) > MARKETPLACE.bigTrade,
      };
      for (const x of c.my) { x.locked = `trade:${id}`; x.ok = false; }
      if (cashMine > 0) hooks.pay(-cashMine);
      trades.unshift(t);
      // kai_beats says no; everyone else says yes, after a beat.
      setTimeout(() => {
        if (t.status !== "open" || t.version !== 1) return;
        if (to === "p-kai") { release(t); t.status = "declined"; t.settledAt = iso(); return; }
        t.them.ok = true;
        settle(t);
      }, 7000);
      return ok(structuredClone(t));
    },
    async edit(id, version, mineIds, theirIds, cashMine, cashTheirs) {
      const t = trades.find((x) => x.id === id && x.status === "open");
      if (!t) return fail("trade_gone");
      if (t.version !== version) return fail("trade_changed");
      release(t);
      const c = contents(mineIds, theirIds, t.with!, cashMine, cashTheirs);
      if ("error" in c) return fail(c.error!);
      const me = t.mine;
      const other = me === "a" ? "b" : "a";
      Object.assign(t, {
        version: t.version + 1, updatedAt: iso(), expiresAt: iso(-MARKETPLACE.swap.hours * HOUR),
        you: { items: c.my.map((x) => item(x.id, x.sku, me)), cash: cashMine, value: c.yv + cashMine, ok: false },
        them: { items: c.their.map((x) => item(x.id, x.sku, other)), cash: cashTheirs, value: c.tv + cashTheirs, ok: false },
        big: Math.max(c.yv + cashMine, c.tv + cashTheirs) > MARKETPLACE.bigTrade,
      });
      // Changes reset both sides; the sample friend looks again and confirms.
      setTimeout(() => { if (t.status === "open" && t.version === version + 1) t.them.ok = true; }, 5000);
      return ok(structuredClone(t));
    },
    async confirm(id, version, sure) {
      if (!on) return fail("phase_off");
      const t = trades.find((x) => x.id === id && x.status === "open");
      if (!t) return fail("trade_gone");
      if (t.version !== version) return fail("trade_changed");
      if (t.big && !sure) return fail("confirm_big");
      if (t.you.cash > hooks.cash()) return fail("cant_afford");
      if (!t.you.ok) {
        for (const x of t.you.items) { const th = things.find((y) => y.id === x.id); if (th) { th.locked = `trade:${t.id}`; th.ok = false; } }
        if (t.you.cash > 0) hooks.pay(-t.you.cash);
        t.you.ok = true;
      }
      if (t.them.ok) settle(t);
      return ok(structuredClone(t));
    },
    async cancelTrade(id) {
      const t = trades.find((x) => x.id === id && x.status === "open");
      if (!t) return fail("trade_gone");
      release(t);
      t.status = t.mine === "a" ? "cancelled" : "declined";
      t.settledAt = iso();
      return ok(structuredClone(t));
    },
  };
}
