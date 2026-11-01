// Business and property sales in the preview (/preview/home?assets=sell|offer|cooling|done|off): the same rules as
// migration 0153, in memory, with sample assets and friends of its own (the Businesses app's own preview list doesn't
// change when something sells here). sell: a bodega and a townhouse to sell (the hot dog cart is too new); offer: tasha.b
// offers you her laundromat, with "undisclosed issues"; cooling: your bodega sale to dev.r is in its cooling-off; done: it
// went through; off: the Studio's switch is off ("Opening soon"). Sample buyers answer an offer after a few seconds.

import {
  ASSET_SALES, appraiseBusiness, appraiseHouse, assetBand, assetError,
  type AssetApi, type AssetKind, type AssetSale, type AssetSalesState, type AssetView,
} from "./assetSales.ts";
import { businessById } from "./businesses.ts";
import { itemBySku } from "./city.ts";
import { economyFee, type GiftCandidate } from "./playerEconomy.ts";

interface SimHooks {
  cash(): number;
  pay(cash: number): void;
}

const FRIENDS: GiftCandidate[] = [
  { id: "p-tasha", name: "tasha.b", style: "pilates_princess", crew: true, partner: false, canReceive: true },
  { id: "p-dev", name: "dev.r", style: "arcade_nerd", crew: false, partner: true, canReceive: true },
  { id: "p-kai", name: "kai_beats", style: "bodega_drip", crew: false, partner: false, canReceive: true },
  { id: "p-nina", name: "nina.nyc", style: "pilates_princess", crew: true, partner: false, canReceive: false },
];
const DAY = 86_400_000;
const iso = (msFromNow = 0) => new Date(Date.now() + msFromNow).toISOString();

interface SimAsset { kind: AssetKind; id: string; level: number; since: number }

export function createAssetSalesSim(hooks: SimHooks, preset?: string): AssetApi {
  let nextId = 900;
  const owned: SimAsset[] = [
    { kind: "business", id: "hot-dog-cart", level: 3, since: Date.now() - 3 * DAY },
    { kind: "business", id: "bodega", level: 2, since: Date.now() - 30 * DAY },
    { kind: "house", id: "house-astoria-townhouse", level: 0, since: Date.now() - 40 * DAY },
  ];
  const sales: AssetSale[] = [];
  const appraise = (a: SimAsset) => (a.kind === "business" ? appraiseBusiness(a.id, a.level) : appraiseHouse(a.id));
  const nameOf = (kind: AssetKind, id: string) => {
    if (kind === "business") { const b = businessById(id); return { label: b?.name ?? id, emoji: b?.emoji ?? "🏪" }; }
    const i = itemBySku(id); return { label: i?.name ?? id, emoji: i?.emoji ?? "🏡" };
  };
  const sale = (s: Partial<AssetSale> & Pick<AssetSale, "role" | "kind" | "asset" | "price" | "status">): AssetSale => {
    const appraisal = s.appraisal ?? (s.kind === "business" ? appraiseBusiness(s.asset, s.level ?? 0) : appraiseHouse(s.asset));
    return {
      id: nextId++, ...nameOf(s.kind, s.asset), level: 0, appraisal, fee: economyFee("asset", s.price), reason: null, issues: false,
      offeredAt: iso(-2 * 3_600_000), expiresAt: iso(ASSET_SALES.offerDays * DAY), acceptedAt: null, coolingUntil: null, settledAt: null,
      closedByMe: false, with: null, ...s,
    };
  };
  const friend = (id: string) => { const f = FRIENDS.find((x) => x.id === id)!; return { id: f.id, name: f.name, style: f.style }; };
  if (preset === "offer") {
    const appraisal = appraiseBusiness("laundromat", 1);
    sales.push(sale({ role: "buyer", kind: "business", asset: "laundromat", level: 1, appraisal, price: Math.round(appraisal * 0.9 / 100) * 100,
      status: "offered", issues: true, with: friend("p-tasha") }));
  }
  if (preset === "cooling" || preset === "done") {
    const appraisal = appraiseBusiness("bodega", 2);
    const price = Math.round(appraisal * 1.1 / 100) * 100;
    const s = sale({ role: "seller", kind: "business", asset: "bodega", level: 2, appraisal, price, status: "cooling", with: friend("p-dev"),
      acceptedAt: iso(-3_600_000), coolingUntil: iso(23 * 3_600_000 - 60_000) });
    if (preset === "done") {
      Object.assign(s, { status: "done", acceptedAt: iso(-25 * 3_600_000), coolingUntil: iso(-3_600_000), settledAt: iso(-3_600_000) });
      owned.splice(owned.findIndex((a) => a.id === "bodega"), 1);
    }
    sales.push(s);
  }
  const used = () => sales.filter((s) => s.acceptedAt && s.status !== "failed").length;
  const view = (a: SimAsset): AssetView => {
    const v = appraise(a);
    const sellableFrom = new Date(a.since + ASSET_SALES.minOwnDays * DAY).toISOString();
    const live = sales.some((s) => s.role === "seller" && s.asset === a.id && (s.status === "offered" || s.status === "cooling"));
    const block = Date.parse(sellableFrom) > Date.now() ? "too_soon"
      : live ? "sale_live"
      : used() + sales.filter((s) => s.role === "seller" && s.status === "offered").length >= ASSET_SALES.perMonth ? "sales_limit" : null;
    return { kind: a.kind, id: a.id, ...nameOf(a.kind, a.id), level: a.level, appraisal: v, band: assetBand(v), feeRate: 0.1, block, sellableFrom };
  };
  const ok = <T,>(data: T) => ({ ok: true as const, data: structuredClone(data) });
  const fail = (code: string) => ({ ok: false as const, error: assetError(code), off: code === "phase_off" });
  const off = preset === "off";
  return {
    async state() {
      if (off) return fail("phase_off");
      const data: AssetSalesState = {
        on: true, now: iso(), assets: owned.map(view), sales, used: used(), perMonth: ASSET_SALES.perMonth,
        room: { send: 1_000_000, receive: 1_000_000 }, unlock: null,
      };
      return ok(data);
    },
    async buyers() { return off ? fail("phase_off") : ok(FRIENDS); },
    async offer(kind, id, buyer, price) {
      if (off) return fail("phase_off");
      const a = owned.find((x) => x.kind === kind && x.id === id);
      if (!a) return fail("not_owned");
      const v = view(a);
      if (v.block) return fail(v.block);
      const who = FRIENDS.find((f) => f.id === buyer);
      if (!who) return fail("not_friends");
      if (!who.canReceive) return fail("they_cant_buy");
      if (price < v.band.min || price > v.band.max) return fail("out_of_band");
      const s = sale({ role: "seller", kind, asset: id, level: a.level, appraisal: v.appraisal, price, status: "offered", offeredAt: iso(), with: friend(buyer) });
      sales.unshift(s);
      // The sample buyer answers (kai_beats always passes).
      setTimeout(() => {
        if (s.status !== "offered") return;
        if (buyer === "p-kai") Object.assign(s, { status: "declined", settledAt: iso() });
        else Object.assign(s, { status: "cooling", acceptedAt: iso(), coolingUntil: iso(ASSET_SALES.coolingHours * 3_600_000) });
      }, 5000);
      return ok(s);
    },
    async answer(id, accept) {
      const s = sales.find((x) => x.id === id && x.role === "buyer" && x.status === "offered");
      if (!s) return fail("sale_gone");
      if (!accept) { Object.assign(s, { status: "declined", closedByMe: true, settledAt: iso() }); return ok(s); }
      if (used() >= ASSET_SALES.perMonth) return fail("buy_limit");
      if (hooks.cash() < s.price) return fail("cant_afford");
      hooks.pay(-s.price);
      Object.assign(s, { status: "cooling", acceptedAt: iso(), coolingUntil: iso(ASSET_SALES.coolingHours * 3_600_000) });
      return ok(s);
    },
    async cancel(id) {
      const s = sales.find((x) => x.id === id && (x.status === "offered" || x.status === "cooling"));
      if (!s) return fail("sale_gone");
      if (s.status === "cooling" && s.role === "buyer") hooks.pay(s.price);
      Object.assign(s, { status: s.status === "offered" && s.role === "buyer" ? "declined" : "cancelled", closedByMe: true, settledAt: iso() });
      return ok(s);
    },
  };
}
