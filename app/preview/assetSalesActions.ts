"use server";

import { previewOnly } from "./guard";
import { appraiseBusiness, appraiseHouse, type AssetAdmin } from "@/lib/assetSales";
import { economyFee } from "@/lib/playerEconomy";

// Phase 3 in /preview/studio → Economy → Asset sales (migration 0153): sample sales, in memory on the dev server (the same
// shapes admin_asset_sales returns). Nothing is saved.

const iso = (hoursAgo: number) => new Date(Date.now() - hoursAgo * 3_600_000).toISOString();
let store: AssetAdmin | null = null;

function data(): AssetAdmin {
  if (store) return store;
  const row = (id: number, kind: "business" | "house", asset: string, label: string, emoji: string, level: number, appraisal: number, price: number,
    status: AssetAdmin["sales"][number]["status"], hoursAgo: number, seller: [string, number], buyer: [string, number], flags: string[] = [], traces = false) => ({
    id, kind, asset, label, emoji, level, appraisal, price, fee: economyFee("asset", price), status, reason: null, traces,
    offeredAt: iso(hoursAgo + 30), acceptedAt: iso(hoursAgo + 24), coolingUntil: iso(hoursAgo), settledAt: status === "done" ? iso(hoursAgo) : null,
    reversedAt: null, reverseReason: null, canReverse: status === "done" && hoursAgo < 7 * 24,
    seller: { id: `p-${seller[0]}`, name: seller[0], joined: iso(seller[1] * 24) },
    buyer: { id: `p-${buyer[0]}`, name: buyer[0], joined: iso(buyer[1] * 24) },
    flags,
  });
  const bodega = appraiseBusiness("bodega", 2);
  const cart = appraiseBusiness("hot-dog-cart", 3);
  const house = appraiseHouse("house-astoria-townhouse");
  store = {
    reverseDays: 7,
    sales: [
      row(14, "business", "bodega", "Bodega, Cat Included", "🐈", 2, bodega, Math.floor(bodega * 1.5), "done", 3, ["main.character", 40], ["moneybags.alt", 9], ["band_edge", "asset_new_buyer"]),
      row(13, "house", "house-astoria-townhouse", "Astoria townhouse", "🏡", 0, house, house, "cooling", -20, ["tasha.b", 60], ["nina.nyc", 58]),
      row(12, "business", "hot-dog-cart", "Dirty Water Dogs", "🌭", 3, cart, Math.round(cart * 0.9), "done", 50, ["kai_beats", 33], ["dev.r", 45], [], true),
      row(11, "business", "hot-dog-cart", "Dirty Water Dogs", "🌭", 1, appraiseBusiness("hot-dog-cart", 1), 7000, "done", 24 * 9, ["lex.luxe", 80], ["errand.boy", 30]),
    ],
  };
  return store;
}
const out = () => ({ ok: true as const, data: structuredClone(data()) });

export async function previewAssetSales() {
  previewOnly();
  return out();
}

export async function previewAssetReverse(id: number, reason: string) {
  previewOnly();
  const s = data().sales.find((x) => x.id === id);
  if (!s || !s.canReverse) return { ok: false as const, error: "Only finished sales from the last 7 days can be reversed." };
  Object.assign(s, { status: "reversed", canReverse: false, reversedAt: new Date().toISOString(), reverseReason: reason.trim() || null });
  return out();
}
