// The Shop Manager's import (docs/shop-manager.md section 2), shared by the Studio and its preview: reads the catalog
// files in content/shop/, turns one into checked drafts and picture matches, and processes and stores pictures.
// Server only: it reads the repo's files and runs sharp.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { ACCESSORIES } from "./accessories";
import { CATALOG_WEAR } from "./catalogWear";
import { brandHits, type ParodyName } from "./culture";
import { fieldProblems, parseCatalogFile, type CatalogDraft, type CatalogItem, type ImageMatch, type ShopFile, type ShopTab } from "./shopCatalog";
import { fetchSourceImage, imagePaths, processShopImage } from "./shopImages";
export { imagePaths };

const DIR = () => path.join(process.cwd(), "content", "shop");


let parody: ParodyName[] | null = null;
async function parodyNames(): Promise<ParodyName[]> {
  parody ??= JSON.parse(await readFile(path.join(process.cwd(), "content", "culture", "parody-names.json"), "utf8")).names as ParodyName[];
  return parody;
}
export async function brandCheck(): Promise<(text: string) => string[]> {
  const names = await parodyNames();
  return (t) => brandHits(t, names);
}

export async function listShopFiles(): Promise<ShopFile[]> {
  const files = (await readdir(DIR()).catch(() => [] as string[])).filter((f) => f.endsWith(".json")).sort();
  const out: ShopFile[] = [];
  for (const file of files) {
    try {
      const raw = JSON.parse(await readFile(path.join(DIR(), file), "utf8"));
      const r = parseCatalogFile(raw, file);
      const label = typeof raw.collection === "string" ? raw.collection : typeof raw.batch === "string" ? raw.batch
        : Array.isArray(raw.batches) ? (raw.batches as string[]).join(", ") : r.images.length ? "Pictures for items on sale" : file;
      out.push({ file, label, items: r.drafts.length, pictures: r.images.length, problems: r.problems.map((p) => `${p.id}: ${p.problem}`) });
    } catch (e) {
      out.push({ file, label: file, items: 0, pictures: 0, problems: [e instanceof Error ? e.message : "not valid JSON"] });
    }
  }
  return out;
}

export async function readShopFile(file: string): Promise<unknown> {
  if (!/^[a-z0-9._-]+\.json$/i.test(file)) throw new Error("not a catalog file");
  return JSON.parse(await readFile(path.join(DIR(), file), "utf8"));
}

/** The Clout Couture rule: a piece's clout is the most expensive C$ item's clout in its tab. */
export function coutureClout(catalog: Pick<CatalogItem, "tab" | "realCash" | "price" | "clout" | "status">[]): (tab: ShopTab) => number {
  return (tab) => {
    const top = catalog.filter((i) => i.tab === tab && !i.realCash && i.price > 0 && i.status !== "deleted").sort((a, b) => b.price - a.price)[0];
    return top?.clout ?? 0;
  };
}

/** One file (or pasted JSON) to drafts that pass the field rules, picture matches, and every problem found. */
export async function prepareImport(raw: unknown, file: string, catalog: CatalogItem[]): Promise<{
  drafts: CatalogDraft[]; images: ImageMatch[]; problems: string[];
}> {
  const parsed = parseCatalogFile(raw, file, { coutureCloutFor: coutureClout(catalog), wearableNow: (sku) => !!CATALOG_WEAR[sku] || !!ACCESSORIES[sku] });
  const brands = await brandCheck();
  const problems = parsed.problems.map((p) => `${p.id}: ${p.problem}`);
  const drafts: CatalogDraft[] = [];
  for (const d of parsed.drafts) {
    const p = fieldProblems(d, { brandHits: brands });
    if (p.length) problems.push(`${d.sku || d.name}: ${p.join("; ")}`);
    else drafts.push(d);
  }
  return { drafts, images: parsed.images, problems };
}

/** Downloads and processes one item's picture. */
export async function buildImages(item: Pick<CatalogItem, "sku" | "sourceImage" | "transparent">) {
  if (!item.sourceImage) throw new Error("no source image");
  const src = await fetchSourceImage(item.sourceImage);
  const out = await processShopImage(src, item.transparent);
  return { ...out, paths: imagePaths(item.sku, item.sourceImage) };
}
