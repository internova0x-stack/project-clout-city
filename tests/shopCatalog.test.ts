import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { SHOP_ITEMS } from "../lib/city.ts";
import { brandHits } from "../lib/culture.ts";
import { SHOP_NEW, newArrivals, shopOrder,
  canMove, cloutCurve, COUTURE_NOW, defaultPresentation, fieldProblems, fileProgress, fromShopItem, isOnSale, isReady, parseCatalogFile, readiness, tabForAccessory,
  type CatalogItem,
} from "../lib/shopCatalog.ts";

// The Shop Manager (owner, Oct 21; docs/shop-manager.md).

const dir = new URL("../content/shop/", import.meta.url);
const parody = JSON.parse(readFileSync(new URL("../content/culture/parody-names.json", import.meta.url), "utf8")).names;
const files = readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => ({ f, raw: JSON.parse(readFileSync(new URL(f, dir), "utf8")) }));
const parsed = files.map(({ f, raw }) => ({ f, ...parseCatalogFile(raw, f, { coutureCloutFor: () => 260 }) }));
const drafts = parsed.flatMap((p) => p.drafts);

test("every catalog file loads: 99 new items, 56 pictures for items on sale, no problems", () => {
  for (const p of parsed) assert.deepEqual(p.problems, [], p.f);
  assert.equal(drafts.length, 99);
  assert.equal(new Set(drafts.map((d) => d.sku)).size, drafts.length, "unique ids");
  const images = parsed.flatMap((p) => p.images);
  assert.equal(images.length, 56);
  for (const m of images) assert.ok(SHOP_ITEMS.some((i) => i.name === m.liveName), `"${m.liveName}" is on sale`);
  for (const d of drafts) {
    assert.deepEqual(fieldProblems(d, { brandHits: (t) => brandHits(t, parody) }), [], d.sku);
    assert.ok(!SHOP_ITEMS.some((i) => i.sku === d.sku), `${d.sku} is new`);
    assert.equal(d.wearable, COUTURE_NOW.has(d.sku), `${d.sku}: only Couture's first pieces are unlocked by the file itself`);
  }
});

test("tabs (owner, Oct 21): jewelry and watches in Luxury, hats, shades and bags in Accessories, map pieces in Luxury", () => {
  const tab = (sku: string) => drafts.find((d) => d.sku === sku)!.tab;
  for (const sku of ["ice-rink-watch", "double-rope-chains", "inheritance-pearls", "everyday-hoops", "statement-drops", "the-clout-flame"]) assert.equal(tab(sku), "luxury", sku);
  for (const sku of ["patchwork-bucket-hat", "brunch-shades", "blush-mini-top-handle", "gilded-silk-scarf", "velvet-ring-choker"]) assert.equal(tab(sku), "accessories", sku);
  for (const sku of ["astoria-yacht", "clout-one-jet", "plaza-statue", "midas-shades", "clout-crown"]) assert.equal(tab(sku), "luxury", sku);
  assert.equal(tab("velocity-veloce"), "cars");
  assert.equal(tab("cloud-nine-sofa"), "home");
  assert.equal(tabForAccessory({ template: "rigid:bag", slot: "hand" }), "accessories");
});

test("presentation default (owner, Oct 21): dresses, skirts, heels and the like are Female only; the rest for both", () => {
  const pres = (sku: string) => drafts.find((d) => d.sku === sku)!.presentation;
  for (const sku of ["after-hours-mini", "red-carpet-rehearsal-gown", "study-hall-tartan-skirt", "gala-gold-heels", "lilac-lap-sports-bra",
    "rooftop-halter", "seamless-night-bodysuit", "baby-pink-rib-crop", "hall-pass-mary-janes", "afterparty-clutch", "blush-mini-top-handle", "gilded-sole-heels"]) {
    assert.equal(pres(sku), "f", sku);
  }
  for (const sku of ["cloud-puffer", "forest-floor-hoodie", "commuter-trench", "sartorio-bespoke-suit", "corner-beanie", "ice-rink-watch"]) assert.equal(pres(sku), "all", sku);
  assert.equal(defaultPresentation({ template: "hoodie", name: "Hoodie" }), "all");
});

test("clout sits on the live curve; Clout Couture takes the tab's top C$ item", () => {
  assert.equal(cloutCurve(395), 25);
  assert.equal(cloutCurve(17000), 260);
  assert.equal(cloutCurve(0), 0);
  const live = SHOP_ITEMS.filter((x) => ["fashion", "luxury", "makeup"].includes(x.category) && x.price > 0 && !x.cloutReq && x.wear?.slot !== "outfit");
  const near = live.filter((i) => Math.abs(cloutCurve(i.price) - i.clout) / i.clout <= 0.35);
  assert.ok(near.length >= live.length * 0.8, `${near.length} of ${live.length} live items sit near the curve`);

  assert.equal(drafts.find((d) => d.sku === "cloud-puffer")!.clout, cloutCurve(420));
  const couture = drafts.filter((d) => d.collection === "Clout Couture");
  assert.equal(couture.length, 15);
  for (const d of couture) assert.ok(d.realCash && d.price === 0 && d.priceUsdCents! > 0 && d.clout === 260, d.sku);
  assert.equal(drafts.find((d) => d.sku === "waterfront-mansion")!.editionSize, 10);
  assert.equal(drafts.find((d) => d.sku === "clout-throne")!.priceUsdCents, 29900, "the Clout Throne: $299 (owner, Oct 21)");
  assert.equal(drafts.find((d) => d.sku === "clout-throne-midnight")!.priceUsdCents, 39900, "the Midnight Edition: $399 (owner, Oct 21)");
});

test("statuses move only the allowed ways; sold items can't be deleted", () => {
  assert.ok(canMove("draft", "pending_review", false));
  assert.ok(canMove("pending_review", "live", false) && canMove("pending_review", "scheduled", false));
  assert.ok(canMove("live", "retired", true) && canMove("retired", "live", true), "restore, editions included (owner, Oct 21)");
  assert.ok(canMove("live", "deleted", false));
  assert.ok(!canMove("live", "deleted", true), "sold: retire instead");
  assert.ok(!canMove("draft", "live", false), "review first");
  assert.ok(!canMove("deleted", "live", false));
  const now = Date.parse("2026-10-21T12:00:00Z");
  assert.ok(isOnSale({ status: "scheduled", goLiveAt: "2026-10-21T11:00:00Z" }, now));
  assert.ok(!isOnSale({ status: "scheduled", goLiveAt: "2026-10-22T11:00:00Z" }, now));
  assert.ok(!isOnSale({ status: "retired", goLiveAt: null }, now));
});

const row = (over: Partial<CatalogItem> = {}): CatalogItem => ({
  ...drafts.find((d) => d.sku === "cloud-puffer")!, status: "pending_review", goLiveAt: null, images: { card: "c", detail: "d" },
  imageStatus: "ready", imageError: null, note: null, sold: false, origin: "import", ...over,
});

test("readiness: image, words, placement, price and duplicates block; clout and wearable only warn", () => {
  assert.ok(isReady(row()));
  const locked = readiness(row()).find((c) => c.id === "wearable")!;
  assert.ok(!locked.ok && !locked.blocking && /puffer template/.test(locked.detail));
  assert.ok(!isReady(row({ imageStatus: "none" })));
  assert.ok(!isReady(row({ name: "x" })));
  assert.ok(!isReady(row({ slot: "wrist" })), "a wrist slot isn't Fashion");
  assert.ok(!isReady(row({ price: 0 })));
  assert.ok(!isReady(row(), { others: [{ sku: "other", name: "Corner Store Cloud Puffer", status: "live", extra: {} }] }));
  assert.ok(isReady(row({ clout: 999 })), "clout off the curve warns");
  assert.ok(!isReady(row({ description: "Made by a chain café, Starbucks edition" }), { brandHits: (t) => brandHits(t, parody) }));
});

test("items already on sale come in as they are", () => {
  for (const i of SHOP_ITEMS) {
    const d = fromShopItem(i);
    assert.equal(d.tab, i.category);
    assert.equal(d.price, i.price);
    assert.equal(d.clout, i.clout);
    assert.equal(d.presentation, i.fits ?? "all");
    assert.equal(d.wearable, true);
  }
  // Colors of one furniture line share a name, so they aren't duplicates.
  const sofas = SHOP_ITEMS.filter((i) => i.name === "Three-seat sofa").map((i) => ({ ...fromShopItem(i), status: "live" as const }));
  assert.ok(sofas.length > 1);
  const r = readiness({ ...row(), ...sofas[0], status: "live", origin: "code" }, { others: sofas });
  assert.ok(r.find((c) => c.id === "duplicate")!.ok);
});

test("migration 0099 seeds every item on sale, exactly as the Shop had it", async () => {
  const { shopSeed } = await import("../scripts/gen-shop-seed.ts");
  const sql = readFileSync(new URL("../supabase/migrations/0099_shop_manager.sql", import.meta.url), "utf8");
  const m = sql.match(/jsonb_to_recordset\('((?:[^']|'')*)'::jsonb\)/);
  assert.ok(m, "seed");
  assert.deepEqual(JSON.parse(m[1].replace(/''/g, "'")), JSON.parse(JSON.stringify(shopSeed())));
  assert.equal(shopSeed().length, SHOP_ITEMS.length);
});

test("a catalog file's progress: what's not loaded yet, and the rest by status", () => {
  const catalog = [{ sku: "a", status: "live" as const }, { sku: "b", status: "pending_review" as const }, { sku: "c", status: "deleted" as const }];
  const p = fileProgress({ skus: ["a", "b", "c", "d"] }, catalog);
  assert.deepEqual(p.notLoaded, ["c", "d"]);
  assert.deepEqual(p.byStatus, { live: 1, pending_review: 1 });
  assert.deepEqual(fileProgress({}, catalog).notLoaded, []);
});

test("the Shop lists C$ pieces cheapest first, then real cash cheapest first, and a New row of recent pieces", () => {
  const it = (name: string, price: number, extra: Partial<{ collector: boolean; priceUsdCents: number; since: string | null }> = {}) =>
    ({ name, price, collector: false, priceUsdCents: null as number | null, since: null as string | null, ...extra });
  const order = shopOrder([it("Yacht", 0, { collector: true, priceUsdCents: 9999 }), it("Coat", 900), it("Cap", 40),
    it("Shades", 0, { collector: true, priceUsdCents: 499 }), it("Belt", 40)]);
  assert.deepEqual(order.map((i) => i.name), ["Belt", "Cap", "Coat", "Shades", "Yacht"]);
  const now = Date.parse("2026-10-22T12:00:00Z");
  const days = (d: number) => new Date(now - d * 86_400_000).toISOString();
  const fresh = newArrivals([it("Old", 1, { since: days(SHOP_NEW.days + 1) }), it("Week", 1, { since: days(7) }), it("Today", 1, { since: days(0) }),
    it("Code", 1), it("Later", 1, { since: days(-2) })], now);
  assert.deepEqual(fresh.map((i) => i.name), ["Today", "Week"]);
  assert.equal(newArrivals(Array.from({ length: 20 }, (_, n) => it(`N${n}`, 1, { since: days(1) })), now).length, SHOP_NEW.max);
});

test("no product is listed twice: every Shop file and the code's items have unique ids, names and pictures", () => {
  const all = [
    ...SHOP_ITEMS.map((i) => ({ sku: i.sku, name: i.name, pic: null as string | null, line: i.furniture?.line ?? null, from: "lib/city.ts" })),
    ...parsed.flatMap((p) => p.drafts.map((d) => ({ sku: d.sku, name: d.name, pic: d.sourceImage, line: typeof d.extra?.line === "string" ? d.extra.line : null, from: p.f }))),
  ];
  const ids = new Map<string, string>(), names = new Map<string, { line: string | null; at: string }>(), pics = new Map<string, string>();
  for (const i of all) {
    const at = `${i.sku} (${i.from})`;
    // A file may re-list a code item (same id) to give it a picture: that's the same product, not a second listing.
    const prev = ids.get(i.sku);
    if (prev) { assert.ok(prev.endsWith("(lib/city.ts)"), `${at} repeats ${prev}`); continue; }
    ids.set(i.sku, at);
    // Colors of one furniture line share a name on purpose (the Shop shows them as one card with swatches).
    const same = names.get(i.name.trim().toLowerCase());
    assert.ok(!same || (!!i.line && same.line === i.line), `${at}: same name as ${same?.at}`);
    names.set(i.name.trim().toLowerCase(), { line: i.line, at });
    if (i.pic) { assert.ok(!pics.has(i.pic), `${at}: same picture as ${pics.get(i.pic)}`); pics.set(i.pic, at); }
  }
});

test("a second item with the same picture can't be approved", () => {
  const a = { ...row(), sku: "a-coat", name: "A coat", sourceImage: "https://x/coat.png" };
  const b = { ...row(), sku: "b-coat", name: "Another coat", sourceImage: "https://x/coat.png" };
  const d = readiness(b, { others: [a, b] }).find((c) => c.id === "duplicate")!;
  assert.equal(d.ok, false);
  assert.match(d.detail, /Same picture as A coat/);
});
