"use server";

// The Shop Manager's server actions (migration 0099; docs/shop-manager.md). Every database call goes through an
// admin_shop_* function, which checks story_admins itself; pictures are processed here and stored with the service role.

import { getServerSupabase } from "@/lib/supabase/server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { studioError, type Admin, type CoutureOwner, type ShopAction, type ShopAuditRow, type ShopImportResult } from "@/lib/studio";
import { fieldProblems, readiness, shippedPictures, type CatalogItem, type EditableField, type ShopFile } from "@/lib/shopCatalog";
import { brandCheck, buildImages, listShopFiles, prepareImport, readShopFile } from "@/lib/shopImport";

async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<Admin<T>> {
  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, error: "Accounts aren't switched on yet." };
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return { ok: false, error: /function .* does not exist|schema cache/i.test(error.message) ? "Run migration 0099 first." : studioError(error.message) };
  return { ok: true, data: data as T };
}

export async function studioShopList(): Promise<Admin<CatalogItem[]>> {
  return rpc<CatalogItem[]>("admin_shop_list");
}

export async function studioShopFiles(): Promise<Admin<ShopFile[]>> {
  const gate = await rpc<boolean>("is_story_admin");
  if (!gate.ok) return gate;
  if (!gate.data) return { ok: false, error: "This account isn't a story admin." };
  return { ok: true, data: await listShopFiles() };
}

/** One item per picture still to process (items sharing a picture get it together). */
const toProcess = (items: CatalogItem[]) => {
  const seen = new Set<string>();
  return items.filter((i) => i.sourceImage && i.imageStatus !== "ready" && i.status !== "deleted" && !seen.has(i.sourceImage) && seen.add(i.sourceImage)).map((i) => i.sku);
};

export async function studioShopImport(source: { file: string } | { json: string }): Promise<Admin<ShopImportResult>> {
  const cat = await studioShopList();
  if (!cat.ok) return cat;
  let raw: unknown;
  const file = "file" in source ? source.file : "pasted.json";
  try {
    raw = "file" in source ? await readShopFile(source.file) : JSON.parse(source.json);
  } catch {
    return { ok: false, error: "That isn't a catalog file (not valid JSON)." };
  }
  const prep = await prepareImport(raw, file, cat.data);
  const result: ShopImportResult = { added: [], updated: [], kept: [], unchanged: [], pictures: [], notFound: [], problems: prep.problems, toProcess: [] };
  if (prep.drafts.length) {
    const r = await rpc<Pick<ShopImportResult, "added" | "updated" | "kept" | "unchanged">>("admin_shop_import", {
      p_items: prep.drafts.map(({ file: _f, ...d }) => d), p_file: file,
    });
    if (!r.ok) return r;
    Object.assign(result, r.data);
  }
  for (const m of prep.images) {
    // A picture for one color of a line (matched by sku) ships with the game: the Shop shows it by sku
    // (shippedPictures), and the database's match by name would give every color the same one.
    if (m.sku) { result.pictures.push({ name: m.liveName, skus: [m.sku] }); continue; }
    const r = await rpc<string[]>("admin_shop_image_source", { p_name: m.liveName, p_source: m.sourceImage, p_transparent: m.transparent, p_file: file });
    if (!r.ok) return r;
    if (r.data.length) result.pictures.push({ name: m.liveName, skus: r.data });
    else result.notFound.push(m.liveName);
  }
  const after = await studioShopList();
  if (after.ok) result.toProcess = toProcess(after.data);
  return { ok: true, data: result };
}

/** Up to four pictures per call (a function stays well inside its time limit); the Studio loops until none are left. */
export async function studioShopProcessImages(skus: string[]): Promise<Admin<{ sku: string; ok: boolean; error?: string }[]>> {
  const cat = await studioShopList();
  if (!cat.ok) return cat;
  const storage = getAdminSupabase();
  if (!storage) return { ok: false, error: "Add SUPABASE_SERVICE_ROLE_KEY in Vercel to store pictures (docs/SETUP.md)." };
  const out: { sku: string; ok: boolean; error?: string }[] = [];
  for (const sku of skus.slice(0, 4)) {
    const item = cat.data.find((i) => i.sku === sku);
    if (!item?.sourceImage) { out.push({ sku, ok: false, error: "no picture source" }); continue; }
    // Shipped with the game (scripts/build-shop-images.ts): no download, no upload.
    const shipped = shippedPictures(sku, item.sourceImage);
    if (shipped) {
      const same = cat.data.filter((x) => x.sku === sku || (x.sourceImage === item.sourceImage && x.imageStatus !== "ready"));
      for (const x of same) {
        const r = await rpc<null>("admin_shop_set_image", { p_sku: x.sku, p_images: shipped, p_error: null });
        out.push(r.ok ? { sku: x.sku, ok: true } : { sku: x.sku, ok: false, error: r.error });
      }
      continue;
    }
    try {
      const img = await buildImages(item);
      const put = async (bucket: string, p: string, body: Buffer, type: string) => {
        const { error } = await storage.storage.from(bucket).upload(p, body, { contentType: type, upsert: true, cacheControl: "31536000" });
        if (error) throw new Error(`storage: ${error.message}`);
      };
      await put("shop", img.paths.card, img.card, "image/webp");
      await put("shop", img.paths.detail, img.detail, "image/webp");
      await put("shop-masters", img.paths.master, img.master, "image/png");
      const url = (p: string) => storage.storage.from("shop").getPublicUrl(p).data.publicUrl;
      // Every item with the same picture (a furniture line's colors) gets it too, processed once.
      const same = cat.data.filter((x) => x.sku === sku || (x.sourceImage === item.sourceImage && x.imageStatus !== "ready"));
      for (const x of same) {
        const r = await rpc<null>("admin_shop_set_image", { p_sku: x.sku, p_images: { card: url(img.paths.card), detail: url(img.paths.detail) }, p_error: null });
        out.push(r.ok ? { sku: x.sku, ok: true } : { sku: x.sku, ok: false, error: r.error });
      }
    } catch (e) {
      const error = e instanceof Error ? e.message : "processing failed";
      await rpc<null>("admin_shop_set_image", { p_sku: sku, p_images: null, p_error: error.slice(0, 200) });
      out.push({ sku, ok: false, error });
    }
  }
  return { ok: true, data: out };
}

export async function studioShopAction(skus: string[], action: ShopAction, opts: { at?: string | null; note?: string; news?: boolean } = {}) {
  const cat = await studioShopList();
  if (!cat.ok) return cat;
  const brands = await brandCheck();
  const done: string[] = [];
  const refused: { sku: string; reason: string }[] = [];
  for (const sku of skus) {
    const item = cat.data.find((i) => i.sku === sku);
    if (!item) { refused.push({ sku, reason: "not in the catalog" }); continue; }
    if (action === "approve") {
      const bad = readiness(item, { brandHits: brands, others: cat.data }).find((c) => c.blocking && !c.ok);
      if (bad) { refused.push({ sku, reason: `${bad.label}: ${bad.detail}` }); continue; }
    }
    const r = await rpc<unknown>("admin_shop_action", { p_sku: sku, p_action: action, p_at: opts.at ?? null, p_note: opts.note ?? null });
    if (r.ok) done.push(sku); else refused.push({ sku, reason: r.error });
  }
  if (action === "approve" && opts.at && Date.parse(opts.at) > Date.now() && opts.news !== false && done.length) {
    await rpc<string>("admin_shop_drop_news", { p_skus: done, p_at: opts.at });
  }
  return { ok: true as const, data: { done, refused } };
}

export async function studioShopEdit(sku: string, fields: Partial<Pick<CatalogItem, EditableField>>): Promise<Admin<null>> {
  const cat = await studioShopList();
  if (!cat.ok) return cat;
  const item = cat.data.find((i) => i.sku === sku);
  if (!item) return { ok: false, error: "That item isn't in the catalog anymore." };
  const problems = fieldProblems({ ...item, ...fields }, { brandHits: await brandCheck() });
  if (problems.length) return { ok: false, error: problems.join("; ") };
  const r = await rpc<null>("admin_shop_edit", { p_sku: sku, p_fields: fields });
  return r.ok ? { ok: true, data: null } : r;
}

export async function studioShopAudit(sku: string): Promise<Admin<ShopAuditRow[]>> {
  return rpc<ShopAuditRow[]>("admin_shop_audit", { p_sku: sku });
}

/** Clout Couture: the next drop of a sold-out numbered piece (admin_couture_new_drop: numbering continues, News item). */
export async function studioShopNewDrop(sku: string, size?: number | null): Promise<Admin<null>> {
  const r = await rpc<unknown>("admin_couture_new_drop", { p_sku: sku, p_size: size ?? null });
  return r.ok ? { ok: true, data: null } : r;
}

/** Clout Couture on the map (migration 0104): a yacht's, jet's or statue's owners as the map shows them. */
export async function studioCoutureOwners(sku: string): Promise<Admin<CoutureOwner[]>> {
  return rpc<CoutureOwner[]>("admin_couture_owners", { p_sku: sku });
}
/** Hides an owner's name on the hull or banner (the edition number shows), or shows it again. */
export async function studioCoutureName(player: string, sku: string, hidden: boolean): Promise<Admin<null>> {
  const r = await rpc<unknown>("admin_couture_name", { p_player: player, p_sku: sku, p_hidden: hidden });
  return r.ok ? { ok: true, data: null } : r;
}
/** Takes the week's statue off the plaza (a refund, if any, is made in Stripe). */
export async function studioPlazaRemove(week: string, reason: string): Promise<Admin<null>> {
  const r = await rpc<unknown>("admin_plaza_remove", { p_week: week, p_reason: reason });
  return r.ok ? { ok: true, data: null } : r;
}
