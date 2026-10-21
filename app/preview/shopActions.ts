"use server";

import { previewOnly } from "./guard";
import { SHOP_ITEMS } from "@/lib/city";
import { canMove, COUTURE_NOW, fieldProblems, fromShopItem, imageMatches, isOnSale, readiness, shippedPictures, type CatalogItem, type CatalogStatus, type EditableField, type ShopFile } from "@/lib/shopCatalog";
import { brandCheck, buildImages, listShopFiles, prepareImport, readShopFile } from "@/lib/shopImport";
import type { Admin, CoutureOwner, ShopAction, ShopAuditRow, ShopImportResult } from "@/lib/studio";

// Development previews only: the Shop Manager on an in-memory copy of the Shop (the same rules as migration 0099's
// admin_shop_* functions). Pictures are really processed (sharp) and kept as data URLs, so the preview game's Shop
// (previewShopCatalog) shows what was approved here.

let rows: Map<string, CatalogItem> | null = null;
const audit: (ShopAuditRow & { sku: string })[] = [];
const OWNED = new Set(["fit-bucket-hat", "fit-satin-bomber"]);

function store(): Map<string, CatalogItem> {
  if (rows) return rows;
  rows = new Map();
  SHOP_ITEMS.forEach((i) => {
    // Real-money pieces at their store prices (the chinchilla at $16.99, owner Oct 21).
    const usd = ({ "col-faux-chinchilla": 1699, "col-holo-boots": 399 } as Record<string, number>)[i.sku] ?? null;
    rows!.set(i.sku, {
      ...fromShopItem(i, usd), status: "live", goLiveAt: null, images: null, imageStatus: "none",
      imageError: null, note: null, sold: OWNED.has(i.sku), origin: "code", file: null,
    });
  });
  return rows;
}
const list = () => [...store().values()].filter((i) => i.status !== "deleted");

// Clout Couture's step 5 pieces (docs/shop-manager.md section 5) are on sale in the preview, with their shipped pictures,
// so /preview/home shows the drop as players will see it once the owner approves it in the Studio.
let coutureReady: Promise<void> | null = null;
function withCouture(): Promise<void> {
  return (coutureReady ??= (async () => {
    const prep = await prepareImport(await readShopFile("clout-couture.json"), "clout-couture.json", list());
    for (const d of prep.drafts) {
      if (!COUTURE_NOW.has(d.sku) || store().has(d.sku)) continue;
      // A sample of each drop already sold; the Tourbillon's has sold out, so the Studio shows its next drop.
      const size = d.editionSize ?? 100;
      const issued = d.sku === "ledger-tourbillon" ? size : 7 + ([...d.sku].reduce((n, ch) => n + ch.charCodeAt(0), 0) % (size - 8));
      store().set(d.sku, { ...d, status: "live", goLiveAt: null, images: shippedPictures(d.sku, d.sourceImage), imageStatus: "ready", imageError: null,
                           note: null, sold: true, origin: "import",
                           edition: { size, drop: 1, dropEnd: size, issued, left: size - issued, soldOut: issued >= size } });
    }
  })());
}
const log = (sku: string, action: string, before: unknown, after: unknown, note: string | null = null) =>
  audit.unshift({ sku, action, at: new Date().toISOString(), before, after, note, actor: "preview" });

export async function previewShopList(): Promise<Admin<CatalogItem[]>> {
  previewOnly();
  await withCouture();
  for (const i of list()) if (i.status === "scheduled" && isOnSale(i, Date.now())) { i.status = "live"; log(i.sku, "went_live", { status: "scheduled" }, { status: "live" }); }
  return { ok: true, data: list().map((i) => ({ ...i })) };
}

export async function previewShopFiles(): Promise<Admin<ShopFile[]>> {
  previewOnly();
  return { ok: true, data: await listShopFiles() };
}

export async function previewShopImport(source: { file: string } | { json: string }): Promise<Admin<ShopImportResult>> {
  previewOnly();
  let raw: unknown;
  const file = "file" in source ? source.file : "pasted.json";
  try { raw = "file" in source ? await readShopFile(source.file) : JSON.parse(source.json); } catch { return { ok: false, error: "That isn't a catalog file (not valid JSON)." }; }
  const prep = await prepareImport(raw, file, list());
  const r: ShopImportResult = { added: [], updated: [], kept: [], unchanged: [], pictures: [], notFound: [], problems: prep.problems, toProcess: [] };
  let pos = store().size;
  for (const d of prep.drafts) {
    const cur = store().get(d.sku);
    if (!cur) {
      store().set(d.sku, { ...d, status: "draft", goLiveAt: null, images: null, imageStatus: "none", imageError: null, note: null, sold: false, origin: "import", extra: { ...d.extra, position: pos++ } });
      r.added.push(d.sku);
      log(d.sku, "import", null, d, file);
    } else if (cur.status === "draft" || cur.status === "pending_review") {
      const newPic = cur.sourceImage !== d.sourceImage;
      store().set(d.sku, { ...cur, ...d, images: newPic ? null : cur.images, imageStatus: newPic ? "none" : cur.imageStatus, status: newPic ? "draft" : cur.status });
      r.updated.push(d.sku);
    } else r.kept.push(d.sku);
  }
  for (const m of prep.images) {
    const hits = imageMatches(m, list());
    for (const h of hits) if (h.sourceImage !== m.sourceImage) Object.assign(h, { sourceImage: m.sourceImage, transparent: m.transparent, imageStatus: "none", file: h.file ?? file });
    if (hits.length) r.pictures.push({ name: m.liveName, skus: hits.map((h) => h.sku) }); else r.notFound.push(m.liveName);
  }
  const seen = new Set<string>();
  r.toProcess = list().filter((i) => i.sourceImage && i.imageStatus !== "ready" && !seen.has(i.sourceImage) && seen.add(i.sourceImage)).map((i) => i.sku);
  return { ok: true, data: r };
}

export async function previewShopProcessImages(skus: string[]): Promise<Admin<{ sku: string; ok: boolean; error?: string }[]>> {
  previewOnly();
  const out: { sku: string; ok: boolean; error?: string }[] = [];
  for (const sku of skus.slice(0, 4)) {
    const i = store().get(sku);
    if (!i?.sourceImage) { out.push({ sku, ok: false, error: "no picture source" }); continue; }
    try {
      // Shipped with the game (scripts/build-shop-images.ts) unless the picture is new.
      const shipped = shippedPictures(sku, i.sourceImage);
      const img = shipped ? null : await buildImages(i);
      const url = (b: Buffer) => `data:image/webp;base64,${b.toString("base64")}`;
      // Every color of a furniture line shares one picture: process it once.
      for (const x of list().filter((x) => x === i || (x.sourceImage === i.sourceImage && x.imageStatus !== "ready"))) {
        x.images = shipped ?? { card: url(img!.card), detail: url(img!.detail) };
        x.imageStatus = "ready"; x.imageError = null;
        if (x.status === "draft") x.status = "pending_review";
        log(x.sku, "image", null, { card: "(processed)" });
        out.push({ sku: x.sku, ok: true });
      }
    } catch (e) {
      i.imageStatus = "failed"; i.imageError = e instanceof Error ? e.message : "processing failed";
      out.push({ sku, ok: false, error: i.imageError });
    }
  }
  return { ok: true, data: out };
}

const TO: Record<ShopAction, (i: CatalogItem, at: string | null) => CatalogStatus> = {
  approve: (_i, at) => (at && Date.parse(at) > Date.now() ? "scheduled" : "live"),
  send_back: () => "draft", unschedule: () => "pending_review", retire: () => "retired", restore: () => "live", delete: () => "deleted",
};

export async function previewShopAction(skus: string[], action: ShopAction, opts: { at?: string | null; note?: string; news?: boolean } = {}) {
  previewOnly();
  const brands = await brandCheck();
  const done: string[] = [];
  const refused: { sku: string; reason: string }[] = [];
  for (const sku of skus) {
    const i = store().get(sku);
    if (!i || i.status === "deleted") { refused.push({ sku, reason: "not in the catalog" }); continue; }
    const to = TO[action](i, opts.at ?? null);
    if (action === "approve") {
      const bad = readiness(i, { brandHits: brands, others: list() }).find((c) => c.blocking && !c.ok);
      if (bad) { refused.push({ sku, reason: `${bad.label}: ${bad.detail}` }); continue; }
    }
    if (!(canMove(i.status, to, i.sold) || (i.status === "scheduled" && to === "scheduled"))) {
      refused.push({ sku, reason: to === "deleted" && i.sold ? "Someone owns this, so it can't be deleted. Retire it instead: owners keep it." : "That move isn't allowed from this status." });
      continue;
    }
    if (action === "send_back" && !opts.note?.trim()) { refused.push({ sku, reason: "Write a note for the writer." }); continue; }
    const before = { status: i.status, goLiveAt: i.goLiveAt };
    i.status = to;
    if (to === "scheduled") i.goLiveAt = opts.at ?? null;
    if (action === "send_back") i.note = opts.note ?? null;
    log(sku, action, before, { status: to, goLiveAt: i.goLiveAt }, opts.note ?? null);
    done.push(sku);
  }
  return { ok: true as const, data: { done, refused } };
}

export async function previewShopEdit(sku: string, fields: Partial<Pick<CatalogItem, EditableField>>): Promise<Admin<null>> {
  previewOnly();
  const i = store().get(sku);
  if (!i) return { ok: false, error: "That item isn't in the catalog anymore." };
  const problems = fieldProblems({ ...i, ...fields }, { brandHits: await brandCheck() });
  if (problems.length) return { ok: false, error: problems.join("; ") };
  log(sku, "edit", Object.fromEntries(Object.keys(fields).map((k) => [k, i[k as EditableField]])), fields);
  Object.assign(i, fields);
  return { ok: true, data: null };
}

export async function previewShopAudit(sku: string): Promise<Admin<ShopAuditRow[]>> {
  previewOnly();
  return { ok: true, data: audit.filter((a) => a.sku === sku) };
}

/** The preview game's Shop: what's on sale here, as shop_catalog_public() gives players. */
export async function previewShopCatalog(): Promise<CatalogItem[]> {
  previewOnly();
  await withCouture();
  return list().filter((i) => isOnSale(i, Date.now()) || i.status === "retired");
}

export async function previewShopNewDrop(sku: string, size?: number | null): Promise<Admin<null>> {
  previewOnly();
  const i = store().get(sku);
  if (!i?.editionSize) return { ok: false, error: "Only numbered pieces have drops." };
  const e = i.edition ?? { size: i.editionSize, drop: 1, dropEnd: i.editionSize, issued: i.editionSize, left: 0, soldOut: true };
  if (!e.soldOut) return { ok: false, error: "This drop hasn't sold out yet." };
  const n = size ?? i.editionSize;
  i.editionSize = n;
  i.edition = { size: n, drop: e.drop + 1, dropEnd: Math.max(e.dropEnd, e.issued) + n, issued: e.issued, left: n, soldOut: false };
  log(sku, "new_drop", { drop: e.drop }, { drop: e.drop + 1 });
  return { ok: true, data: null };
}

// Clout Couture on the map: sample owners (the same as app/preview/coutureActions.ts draws).
const thisMonday = (() => { const d = new Date(); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); })();
const sampleOwners: Record<string, CoutureOwner[]> = {
  "astoria-yacht": [
    { player: "p-nina", displayName: "nina.nyc", shown: "nina.nyc", edition: 1, hidden: false, week: null },
    { player: "p-dev", displayName: "dev.r", shown: "dev.r", edition: 2, hidden: false, week: null },
    { player: "p-tasha", displayName: "tasha.b", shown: "tasha.b", edition: 3, hidden: false, week: null },
    { player: "p-marco", displayName: "Marco", shown: "No. 0004", edition: 4, hidden: true, week: null },
  ],
  "clout-one-jet": [{ player: "p-nina", displayName: "nina.nyc", shown: "nina.nyc", edition: 1, hidden: false, week: null }],
  "plaza-statue": [{ player: "p-nina", displayName: "nina.nyc", shown: "nina.nyc", edition: 1, hidden: false, week: thisMonday }],
};
export async function previewCoutureOwners(sku: string): Promise<Admin<CoutureOwner[]>> {
  previewOnly();
  return { ok: true, data: sampleOwners[sku] ?? [] };
}
export async function previewCoutureName(player: string, sku: string, hidden: boolean): Promise<Admin<null>> {
  previewOnly();
  const o = sampleOwners[sku]?.find((x) => x.player === player);
  if (!o) return { ok: false, error: "No such owner." };
  Object.assign(o, { hidden, shown: hidden ? `No. ${String(o.edition ?? 0).padStart(4, "0")}` : o.displayName });
  return { ok: true, data: null };
}
export async function previewPlazaRemove(week: string, reason: string): Promise<Admin<null>> {
  previewOnly();
  if (!reason.trim()) return { ok: false, error: "Add a reason first." };
  const list = sampleOwners["plaza-statue"];
  const o = list?.find((x) => x.week === week);
  if (!o) return { ok: false, error: "No statue that week." };
  o.week = null;
  return { ok: true, data: null };
}
