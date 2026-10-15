// v0.12 businesses in the preview (/preview/home): the same rules as migration 0048, in memory, paying
// into the city simulator's cash. ?biz=start|some|rich|public sets where the player starts.

import { BUSINESSES, businessById, businessError, canGoPublic, nextBusiness, tillNow, upgradeCost, type BusinessApi, type OwnedBusiness } from "./businesses.ts";
import { CITY_ECONOMY } from "./city.ts";

interface SimHooks {
  cash(): number;
  clout(): number;
  pay(cash: number, clout?: number): void;
}

const ago = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();

/** Preview presets: "some" is a few businesses with full tills, "rich" the whole ladder ready to go public, "public" after. */
export function presetBusinesses(preset: string | undefined): OwnedBusiness[] {
  const own = (id: string, level: number, hours: number, pub = false): OwnedBusiness => ({ id, level, public: pub, collectedAt: ago(hours) });
  if (preset === "some") return [own("hot-dog-cart", 3, 50), own("bodega", 2, 48), own("laundromat", 1, 6), own("cafe", 0, 0.2)];
  if (preset === "rich" || preset === "public") {
    // "rich": everything fully upgraded, the startup ready to go public; "public": it already has.
    return BUSINESSES.map((b, i) => own(b.id, 3, 20, preset === "public" && i === 7));
  }
  return [];
}

export function createBusinessSim(hooks: SimHooks, preset?: string): BusinessApi {
  const owned: OwnedBusiness[] = presetBusinesses(preset);
  const fail = (code: string) => ({ ok: false as const, error: businessError(code) });
  const collectOne = (o: OwnedBusiness) => {
    const amount = tillNow(businessById(o.id)!, o.level, o.collectedAt, Date.now());
    if (amount <= 0) return 0;
    o.collectedAt = new Date().toISOString();
    hooks.pay(amount);
    return amount;
  };
  return {
    async state() {
      return { ok: true, data: { owned: structuredClone(owned), now: new Date().toISOString() } };
    },
    async buy(id) {
      const b = businessById(id);
      if (!b) return fail("unknown_business");
      if (owned.some((o) => o.id === id)) return fail("already_owned");
      if (nextBusiness(owned)?.id !== id) return fail("business_locked");
      if (hooks.cash() < b.price) return fail("cant_afford");
      owned.push({ id, level: 0, public: false, collectedAt: new Date().toISOString() });
      hooks.pay(-b.price);
      return { ok: true, data: { cash: -b.price } };
    },
    async upgrade(id) {
      const o = owned.find((x) => x.id === id);
      if (!o) return fail("not_owned");
      if (o.level >= 3) return fail("max_level");
      const cost = upgradeCost(businessById(id)!);
      const till = collectOne(o);
      if (hooks.cash() < cost) return fail("cant_afford");
      o.level++;
      hooks.pay(-cost);
      return { ok: true, data: { cash: till - cost, level: o.level } };
    },
    async collect() {
      const paid = owned.map((o) => ({ id: o.id, cash: collectOne(o) })).filter((x) => x.cash > 0);
      return { ok: true, data: { cash: paid.reduce((a, x) => a + x.cash, 0), paid } };
    },
    async goPublic() {
      const g = CITY_ECONOMY.businesses.goPublic;
      const last = owned.find((o) => o.id === BUSINESSES[BUSINESSES.length - 1].id);
      if (!last || last.level < 3) return fail("not_ready");
      if (last.public) return fail("already_public");
      if (!canGoPublic(owned, hooks.clout())) return fail("need_clout");
      if (hooks.cash() < g.fee) return fail("cant_afford");
      last.public = true;
      hooks.pay(-g.fee);
      return { ok: true, data: { cash: -g.fee } };
    },
  };
}
