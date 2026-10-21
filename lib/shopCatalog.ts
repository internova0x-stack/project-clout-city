// The Shop Manager's rules (docs/shop-manager.md; owner, Oct 21): the catalog's tabs, statuses and allowed moves, how
// the catalog files in content/shop/ become drafts, the clout curve, the presentation default and the readiness checks.
// Pure and dependency-free (the parody names are passed in), so tests, the Studio and the server share it.

import type { Edition } from "./store.ts";
import type { ShopItem } from "./city.ts";
import { SHOP_STATIC_IMAGES } from "./shopImagesStatic.ts";

export type ShopTab = "fashion" | "accessories" | "home" | "cars" | "houses" | "luxury" | "makeup";
export const SHOP_TABS: ShopTab[] = ["fashion", "accessories", "home", "cars", "houses", "luxury", "makeup"];

export type CatalogStatus = "draft" | "pending_review" | "scheduled" | "live" | "retired" | "deleted";
export const STATUS_LABEL: Record<CatalogStatus, string> = {
  draft: "Draft", pending_review: "Needs review", scheduled: "Scheduled", live: "● Live", retired: "Retired", deleted: "Deleted",
};

/** "all" is Male and Female; "f" Female only; "m" Male only (owner, Oct 21: clothes are gender based). */
export type Presentation = "all" | "f" | "m";
export const PRESENTATION_LABEL: Record<Presentation, string> = { all: "Male and Female", f: "Female only", m: "Male only" };

export type Tier = "budget" | "mid" | "luxury";
export const STYLE_LINES = [
  "streetwear", "gothic", "nerdy-preppy", "sporty", "business-casual", "fashionista", "luxury", "avant-garde", "wasteland-luxe",
] as const;
export type StyleLine = (typeof STYLE_LINES)[number];
export const STYLE_LINE_LABEL: Record<StyleLine, string> = {
  streetwear: "Streetwear", gothic: "Gothic", "nerdy-preppy": "Nerdy / Preppy", sporty: "Sporty", "business-casual": "Business Casual",
  fashionista: "Fashionista", luxury: "Luxury", "avant-garde": "Avant-garde", "wasteland-luxe": "Wasteland Luxe",
};

/** Slots per tab. A one-piece fills the top and the bottom. */
export const SLOTS: Record<ShopTab, readonly string[]> = {
  fashion: ["top", "bottom", "one-piece", "shoes", "accessory", "outfit"],
  accessories: ["head", "face", "ears", "neck", "wrist", "hand"],
  luxury: ["head", "face", "ears", "neck", "wrist", "hand", "car", "waterfront", "sky", "plaza", "face-effect"],
  home: ["living", "bedroom", "dining", "decor", "kitchen", "bathroom", "plot"],
  cars: ["car"],
  houses: ["plot"],
  makeup: ["face-effect"],
};

/** One row of the catalog, as the Studio and the game see it. */
export interface CatalogItem {
  sku: string;
  status: CatalogStatus;
  /** Scheduled items go live at this time (ISO). */
  goLiveAt: string | null;
  tab: ShopTab;
  slot: string | null;
  presentation: Presentation;
  name: string;
  description: string;
  emoji: string;
  /** C$ (0 for real-money pieces). */
  price: number;
  clout: number;
  tier: Tier | null;
  stars: number;
  styleLines: string[];
  /** The garment template or rigid accessory it needs to be worn ("hoodie", "rigid:hat"); null when nothing is needed. */
  template: string | null;
  /** False while its template or 3D piece doesn't exist: it shows, locked, and can't be bought. */
  wearable: boolean;
  realCash: boolean;
  priceUsdCents: number | null;
  editionSize: number | null;
  /** Processed images (public URLs), or null while it still shows its emoji. */
  images: { card: string; detail: string } | null;
  imageStatus: "none" | "ready" | "failed";
  imageError: string | null;
  sourceImage: string | null;
  transparent: boolean;
  /** "Clout Couture" for the real-money collection. */
  collection: string | null;
  note: string | null;
  /** Anyone owns it (Delete is blocked then). */
  sold: boolean;
  /** Clout Couture (migration 0102): a numbered piece's drop and what's left of it. */
  edition?: Edition | null;
  origin: "code" | "import";
  file: string | null;
  /** Everything else (customizable fields, the batch, Couture notes). */
  extra: Record<string, unknown>;
  /** The Studio's list carries it (to refresh the history). */
  updatedAt?: string;
}

/** A file entry turned into something to import. */
export type CatalogDraft = Omit<CatalogItem, "status" | "goLiveAt" | "images" | "imageStatus" | "imageError" | "note" | "sold" | "origin" | "updatedAt">;

/** A catalog file in the repo, for the Import panel's Load buttons. */
export interface ShopFile { file: string; label: string; items: number; pictures: number; problems: string[] }

/** live-shop-images.json: a picture for an item already on sale, matched by its exact name (or by its sku, where a
 *  line's colors share the name and each has its own picture: the three area rugs). */
export interface ImageMatch { liveName: string; tab: string; sourceImage: string; transparent: boolean; sku?: string }

/** The items on sale a picture entry is for. */
export function imageMatches<T extends { sku: string; name: string }>(m: ImageMatch, items: readonly T[]): T[] {
  return items.filter((i) => (m.sku ? i.sku === m.sku : i.name === m.liveName));
}

// ---------------------------------------------------------------------------
// Moves and actions (section 1)
// ---------------------------------------------------------------------------
const MOVES: Record<CatalogStatus, CatalogStatus[]> = {
  draft: ["pending_review", "deleted"],
  pending_review: ["scheduled", "live", "draft", "deleted"],
  scheduled: ["live", "pending_review"],
  live: ["retired", "deleted"],
  retired: ["live", "deleted"],
  deleted: [],
};
/** Can an item move from one status to another? Live or retired items can be deleted only if never sold. */
export function canMove(from: CatalogStatus, to: CatalogStatus, sold: boolean): boolean {
  if (!MOVES[from].includes(to)) return false;
  return !(to === "deleted" && (from === "live" || from === "retired") && sold);
}

/** What players see: live, or scheduled and its time has come. Retired items show only to owners. */
export function isOnSale(i: Pick<CatalogItem, "status" | "goLiveAt">, nowMs: number): boolean {
  return i.status === "live" || (i.status === "scheduled" && !!i.goLiveAt && Date.parse(i.goLiveAt) <= nowMs);
}

// ---------------------------------------------------------------------------
// Numbers: the live clout curve and the presentation default
// ---------------------------------------------------------------------------
/**
 * Clout from price on the live curve (owner, Oct 21: "Put on a live curve"): fitted to the clothing, jewelry and watches
 * already on sale (a C$395 bomber gives 25, a C$17,000 watch 260).
 */
export function cloutCurve(price: number): number {
  return price > 0 ? Math.max(1, Math.round(0.6046 * price ** 0.6225)) : 0;
}

const FEMALE_TEMPLATES = new Set([
  "mini_dress", "gown", "midi_dress", "wrap_dress", "ruffle_dress", "knit_maxi_dress", "sundress", "pleated_skirt", "slip_skirt",
  "tennis_skirt", "mini_skirt", "heels", "sports_bra", "halter_top", "bodysuit", "crop_top", "mary_janes", "slingbacks", "ballet_flats",
  "platform_sandals", "mini_bag",
]);
/**
 * The presentation default (owner, Oct 21): dresses and gowns, skirts, heels, the sports bra, halter, bodysuit and crop
 * tops, Mary Janes, slingbacks, ballet flats, platform sandals, clutches and mini bags are Female only; everything else
 * is for both. Editable per item in the Studio.
 */
export function defaultPresentation(e: { template?: string | null; name?: string; description?: string; slot?: string | null }): Presentation {
  const t = (e.template ?? "").replace(/^rigid:/, "");
  if (FEMALE_TEMPLATES.has(t)) return "f";
  const words = `${e.name ?? ""} ${e.description ?? ""}`.toLowerCase();
  if (/\bclutch\b|\bstiletto|\bheels\b|\bdress\b|\bgown\b|\bskirt\b/.test(words)) return "f";
  return "all";
}

/** Jewelry and watches go under Luxury; hats, shades, scarves, chokers and bags under Accessories (owner, Oct 21). */
export function tabForAccessory(e: { template?: string | null; slot?: string | null }): ShopTab {
  const t = e.template ?? "";
  return /necklace|earrings|watch|^rigid:ring$|bracelet/.test(t) || e.slot === "wrist" ? "luxury" : "accessories";
}

const COUTURE_TAB: Record<string, ShopTab> = {
  fashion: "fashion", luxury: "luxury", cars: "cars", home: "home", makeup: "makeup", houses: "houses", map: "luxury",
};

// ---------------------------------------------------------------------------
// Reading the catalog files (section 2)
// ---------------------------------------------------------------------------
type Raw = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : "");
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : NaN);

/**
 * Turns one catalog file into drafts (new items) and image matches (pictures for items on sale), with a problem per
 * entry that can't load. `couturePriceFor(tab)` gives a Clout Couture piece's clout: the most expensive C$ item's clout
 * in that tab.
 */
/** Clout Couture pieces that work in the game now (migrations 0102, 0103); the yacht, jet, plaza statue and mansion come later. */
export const COUTURE_NOW: ReadonlySet<string> = new Set(["cloud-nine-sofa", "self-portrait-statue", "velocity-veloce", "sartorio-bespoke-suit",
  "gilded-sole-heels", "midas-shades", "ledger-tourbillon", "clout-crown", "24k-glow-ritual", "clout-throne"]);

export function parseCatalogFile(raw: unknown, file: string, opts: { coutureCloutFor?: (tab: ShopTab) => number; wearableNow?: (sku: string) => boolean } = {}): {
  drafts: CatalogDraft[]; images: ImageMatch[]; problems: { id: string; problem: string }[];
} {
  const drafts: CatalogDraft[] = [];
  const images: ImageMatch[] = [];
  const problems: { id: string; problem: string }[] = [];
  const f = (raw ?? {}) as Raw;
  const items = Array.isArray(f.items) ? (f.items as Raw[]) : [];
  if (!items.length) problems.push({ id: file, problem: "no items in the file" });
  const couture = typeof f.collection === "string";
  for (const it of items) {
    if (typeof it.liveName === "string") {
      images.push({ liveName: it.liveName, tab: str(it.tab), sourceImage: str(it.sourceImage), transparent: it.transparent === true, ...(typeof it.sku === "string" ? { sku: it.sku } : {}) });
      continue;
    }
    const id = str(it.id);
    const name = str(it.name);
    const slot = str(it.slot) || null;
    const template = str(it.template) || null;
    const description = str(it.description);
    let tab: ShopTab;
    if (couture) tab = COUTURE_TAB[str(it.tab).toLowerCase()] ?? "luxury";
    else if (it.category === "accessories") tab = tabForAccessory({ template, slot });
    else if (it.category === "fashion") tab = "fashion";
    else { problems.push({ id: id || name, problem: `unknown category "${str(it.category)}"` }); continue; }
    const realCash = it.realCash === true;
    const price = realCash ? 0 : Math.round(num(it.priceCs));
    const usd = num(it.priceUsd);
    const tier = (["budget", "mid", "luxury"] as const).find((t) => t === it.tier) ?? (realCash ? "luxury" : null);
    const { id: _i, name: _n, description: _d, category: _c, slot: _s, styleLines: _sl, tier: _t, stars: _st, priceCs: _p, priceUsd: _u,
      clout: _cl, currency: _cu, realCash: _r, template: _te, wearable: _w, sourceImage: _so, images: _im, transparent: _tr, tab: _tb,
      editionSize: _e, ...extra } = it;
    drafts.push({
      sku: id, tab, slot, presentation: defaultPresentation({ template, name, description, slot }), name, description,
      emoji: emojiFor(tab, slot, template), price,
      clout: realCash ? (opts.coutureCloutFor?.(tab) ?? 0) : cloutCurve(price),
      tier, stars: Number.isInteger(it.stars) ? (it.stars as number) : realCash ? 4 : 1,
      styleLines: Array.isArray(it.styleLines) ? (it.styleLines as unknown[]).map(String) : [],
      // Wearable once its shape exists (the caller knows the client's tables) or it is one of the Couture pieces built in stage 5.
      template: template ?? (couture ? `couture:${slot ?? "piece"}` : null), wearable: COUTURE_NOW.has(id) || !!opts.wearableNow?.(id),
      realCash, priceUsdCents: realCash && Number.isFinite(usd) ? Math.round(usd * 100) : null,
      editionSize: Number.isInteger(it.editionSize) ? (it.editionSize as number) : null,
      sourceImage: str(it.sourceImage) || null, transparent: it.transparent === true,
      collection: couture ? str(f.collection) : null, file, extra,
    });
  }
  return { drafts, images, problems };
}

/** A stand-in emoji while there's no picture (and on old phones' fallbacks). */
function emojiFor(tab: ShopTab, slot: string | null, template: string | null): string {
  const t = template ?? "";
  if (tab === "cars") return "🏎️";
  if (tab === "houses") return "🏛️";
  if (tab === "home") return /statue/.test(t) || slot === "decor" ? "🗿" : "🛋️";
  if (tab === "makeup") return "✨";
  if (slot === "sky") return "🛩️";
  if (slot === "waterfront") return "🛥️";
  if (slot === "plaza") return "🗽";
  if (/watch/.test(t) || slot === "wrist") return "⌚";
  if (/necklace|choker|scarf/.test(t) || slot === "neck") return "📿";
  if (/earrings/.test(t) || slot === "ears") return "💎";
  if (/eyewear/.test(t) || slot === "face") return "🕶️";
  if (/hat|balaclava|beanie/.test(t) || slot === "head") return "🧢";
  if (/bag/.test(t) || slot === "hand") return "👜";
  if (slot === "shoes") return /heels|slingbacks|mary|flats|sandals/.test(t) ? "👠" : "👟";
  if (slot === "bottom") return /skirt/.test(t) ? "👗" : "👖";
  if (slot === "one-piece") return /suit/.test(t) ? "🤵" : "👗";
  return "🧥";
}

/** The catalog row an item already on sale becomes (the Shop Manager's first import, as `live`). */
export function fromShopItem(i: ShopItem, priceUsdCents: number | null = null): CatalogDraft {
  const slot = i.wear?.slot ?? (i.furniture ? i.furniture.room : i.category === "cars" ? "car" : i.category === "houses" ? "plot" : null);
  return {
    sku: i.sku, tab: i.category, slot, presentation: i.fits ?? "all", name: i.name, description: i.blurb, emoji: i.emoji, price: i.price,
    clout: i.clout, tier: null, stars: i.rating, styleLines: [], template: null, wearable: true, realCash: !!i.collector,
    priceUsdCents, editionSize: null, sourceImage: null, transparent: false, collection: null, file: null,
    extra: { ...(i.furniture ? { line: i.furniture.line } : {}) },
  };
}

// ---------------------------------------------------------------------------
// Field rules (section 2) and readiness checks (section 4)
// ---------------------------------------------------------------------------
export interface FieldContext {
  /** Words from content/culture/parody-names.json that count as real brand names. */
  brandHits?: (text: string) => string[];
  /** Other items in the catalog (for duplicate names). */
  others?: Pick<CatalogItem, "sku" | "name" | "status" | "extra">[];
}

/** Problems with an item's fields; an empty list means it can be saved. */
export function fieldProblems(d: Omit<CatalogDraft, "file" | "extra">, ctx: FieldContext = {}): string[] {
  const p: string[] = [];
  if (!/^[a-z0-9][a-z0-9-]{1,59}$/.test(d.sku)) p.push("id: lowercase letters, numbers and dashes");
  if (d.name.trim().length < 3 || d.name.length > 60) p.push("name: 3 to 60 characters");
  if (d.description.trim().length < 10 || d.description.length > 500) p.push("description: 10 to 500 characters");
  const hits = ctx.brandHits?.(`${d.name} ${d.description}`) ?? [];
  if (hits.length) p.push(`real brand names: ${hits.join(", ")}`);
  if (!SHOP_TABS.includes(d.tab)) p.push("tab");
  if (d.slot && !SLOTS[d.tab]?.includes(d.slot)) p.push(`slot "${d.slot}" doesn't fit the ${d.tab} tab`);
  if (!(["all", "f", "m"] as string[]).includes(d.presentation)) p.push("presentation");
  for (const s of d.styleLines) if (!(STYLE_LINES as readonly string[]).includes(s)) p.push(`style line "${s}"`);
  if (!(d.stars >= 1 && d.stars <= 4)) p.push("stars: 1 to 4");
  if (d.realCash ? !(d.priceUsdCents && d.priceUsdCents > 0) : !(Number.isInteger(d.price) && d.price > 0)) p.push("price");
  if (!(Number.isInteger(d.clout) && d.clout >= 0)) p.push("clout");
  return p;
}

export interface Check { id: string; label: string; ok: boolean; detail: string; blocking: boolean }

/** The review card's checks. Approve needs every blocking one to pass. */
export function readiness(i: CatalogItem, ctx: FieldContext = {}): Check[] {
  const problems = fieldProblems(i, ctx);
  const words = problems.filter((x) => /^name|^description|brand/.test(x));
  const place = problems.filter((x) => /^tab|^slot|presentation|style line/.test(x));
  const line = (x: Pick<CatalogItem, "extra">) => (typeof x.extra?.line === "string" ? x.extra.line : null);
  const dup = (ctx.others ?? []).find((o) => o.sku !== i.sku && o.status !== "deleted" && o.name.trim().toLowerCase() === i.name.trim().toLowerCase()
    && !(line(o) && line(o) === line(i)));
  const off = i.realCash ? 0 : Math.abs(i.clout - cloutCurve(i.price)) / Math.max(1, cloutCurve(i.price));
  return [
    { id: "image", label: "Image", ok: i.imageStatus === "ready" || (i.origin === "code" && !i.sourceImage), blocking: true,
      detail: i.imageStatus === "ready" ? "Both sizes processed" : i.imageStatus === "failed" ? `Failed: ${i.imageError ?? "unknown"}` : i.origin === "code" ? "Shows its emoji" : "Not processed yet" },
    { id: "words", label: "Name and description", ok: !words.length, blocking: true, detail: words.join("; ") || "OK" },
    { id: "placement", label: "Tab, slot, style lines, presentation", ok: !place.length, blocking: true, detail: place.join("; ") || "OK" },
    { id: "price", label: "Price", ok: !problems.includes("price"), blocking: true,
      detail: i.realCash ? (i.priceUsdCents ? `$${(i.priceUsdCents / 100).toFixed(2)}${i.editionSize ? ` · editions of ${i.editionSize}` : ""}` : "No dollar price") : `C$${i.price.toLocaleString("en-US")}` },
    { id: "duplicate", label: "No duplicate name", ok: !dup, blocking: true, detail: dup ? `Same name as ${dup.sku}` : "OK" },
    { id: "clout", label: "Clout", ok: !problems.includes("clout") && off <= 0.2, blocking: false,
      detail: off > 0.2 ? `${i.clout} is more than 20% off the curve (${cloutCurve(i.price)})` : `${i.clout}` },
    { id: "wearable", label: "Wearable", ok: i.wearable, blocking: false,
      detail: i.wearable ? "Ready to wear or use" : `Locked until its ${i.template?.startsWith("couture:") ? "Clout Couture build (stage 5)" : `${(i.template ?? "piece").replace(/^rigid:/, "")} ${i.template?.startsWith("rigid:") ? "accessory" : "template"}`} exists` },
  ];
}

export const isReady = (i: CatalogItem, ctx: FieldContext = {}) => readiness(i, ctx).every((c) => c.ok || !c.blocking);

/** The fields Edit can change (and the audit log records). */
export const EDITABLE = ["name", "description", "price", "clout", "tier", "stars", "styleLines", "slot", "tab", "presentation", "priceUsdCents", "editionSize", "emoji"] as const;
export type EditableField = (typeof EDITABLE)[number];

/** A picture's version from its source link (in its file names, so a new picture never shows a cached old one). */
export function sourceVersion(source: string): string {
  let h = 0;
  for (const c of source) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h.toString(36);
}

/**
 * The pictures shipped with the game (scripts/build-shop-images.ts, public/shop-img/): by sku, or for a source link
 * (any item that shares that picture). The Shop shows them when the catalog has no stored picture yet.
 */
export function shippedPictures(sku: string, source?: string | null): { card: string; detail: string } | null {
  if (!source) return SHOP_STATIC_IMAGES[sku] ?? null;
  const v = `-${sourceVersion(source)}-256.webp`;
  const own = SHOP_STATIC_IMAGES[sku];
  if (own?.card.endsWith(v)) return own;
  return Object.values(SHOP_STATIC_IMAGES).find((p) => p.card.endsWith(v)) ?? null;
}

// ---------------------------------------------------------------------------
// The game's Shop: catalog rows on top of the pieces the code knows how to wear or place
// ---------------------------------------------------------------------------
/** A Shop card's item: the code's piece (its wear, furniture, rent) with the catalog's words, numbers and picture. */
export type ShopCardItem = ShopItem & {
  image: string | null; detailImage: string | null; wearableNow: boolean; styleLines: string[]; collection: string | null;
  priceUsdCents: number | null; presentation: Presentation; retired: boolean; editionSize: number | null;
};

/** The Shop's items in a tab, from the catalog (what's on sale, and retired pieces). `base` is the code's ShopItem by sku. */
export function catalogShopItems(catalog: Pick<CatalogItem, "sku" | "status" | "tab" | "name" | "description" | "emoji" | "price" | "clout" | "stars"
  | "images" | "wearable" | "styleLines" | "collection" | "priceUsdCents" | "presentation" | "realCash" | "editionSize" | "slot">[],
  base: (sku: string) => ShopItem | undefined): ShopCardItem[] {
  return catalog.map((c) => {
    const b = base(c.sku);
    const item: ShopItem = {
      ...(b ?? { sku: c.sku, rating: 1, emoji: c.emoji, blurb: "", name: c.name, category: c.tab, price: 0, clout: 0 }),
      category: c.tab, name: c.name, blurb: c.description, emoji: c.emoji, price: c.price, clout: c.clout,
      rating: Math.min(4, Math.max(1, c.stars)) as ShopItem["rating"], collector: c.realCash || b?.collector,
      ...(c.presentation !== "all" ? { fits: c.presentation } : { fits: undefined }),
    };
    return {
      ...item, image: c.images?.card ?? shippedPictures(c.sku)?.card ?? null, detailImage: c.images?.detail ?? shippedPictures(c.sku)?.detail ?? null,
      wearableNow: c.wearable, styleLines: c.styleLines,
      collection: c.collection, priceUsdCents: c.priceUsdCents, presentation: c.presentation, retired: c.status === "retired", editionSize: c.editionSize,
    };
  });
}
