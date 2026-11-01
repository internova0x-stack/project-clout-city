"use server";

import { previewOnly } from "./guard";
import { MARKETPLACE, type MarketAdmin } from "@/lib/marketplace";

// Phase 2 in /preview/studio → Economy → Recent trades (migration 0152): sample sales and swaps in memory on the dev server
// (the same shape admin_market_recent returns). Reverse works on them; nothing is saved.

const iso = (hoursAgo: number) => new Date(Date.now() - hoursAgo * 3_600_000).toISOString();
let store: MarketAdmin | null = null;

function data(): MarketAdmin {
  store ??= {
    reversalDays: MARKETPLACE.reversalDays,
    week: { sales: 12, trades: 5, listed: 23, value: 14_820, fees: 431 },
    recent: [
      { kind: "sale", id: 31, at: iso(1), status: "done", label: "🛏️ Platform bed", value: 1_340, reference: 900, fee: 67,
        from: { id: "p-moneybags", name: "moneybags.alt" }, to: { id: "p-mainchar", name: "main.character" }, reversible: true, reversal: null },
      { kind: "trade", id: 12, at: iso(4), status: "done", label: "🏝️ Kitchen island ⇄ 🧥 Leather blazer + C$500", value: 1_400, reference: 1_425, fee: 25,
        from: { id: "p-tasha", name: "tasha.b" }, to: { id: "p-dev", name: "dev.r" }, reversible: true, reversal: null },
      { kind: "sale", id: 30, at: iso(9), status: "done", label: "📺 Big TV", value: 700, reference: 650, fee: 35,
        from: { id: "p-kai", name: "kai_beats" }, to: { id: "p-nina", name: "nina.nyc" }, reversible: true, reversal: null },
      { kind: "sale", id: 27, at: iso(30), status: "reversed", label: "🎹 Upright piano", value: 3_100, reference: 6_000, fee: 155,
        from: { id: "p-hacked", name: "definitely.me" }, to: { id: "p-sketchy", name: "definitely.not.selling.cs" }, reversible: false,
        reversal: { reason: "Account taken over; owner wrote to the Mayor", at: iso(26) } },
      { kind: "trade", id: 9, at: iso(24 * 9), status: "done", label: "🧶 Area rug ⇄ 💡 Floor lamp", value: 120, reference: 90, fee: 0,
        from: { id: "p-tasha", name: "tasha.b" }, to: { id: "p-nina", name: "nina.nyc" }, reversible: false, reversal: null },
    ],
  };
  return store;
}

export async function previewMarketRecent() {
  previewOnly();
  return { ok: true as const, data: structuredClone(data()) };
}

export async function previewMarketReverse(kind: "sale" | "trade", id: number, reason: string) {
  previewOnly();
  const r = data().recent.find((x) => x.kind === kind && x.id === id);
  if (!r || !r.reversible) return { ok: false as const, error: "That one can't be reversed any more." };
  Object.assign(r, { status: "reversed", reversible: false, reversal: { reason, at: new Date().toISOString() } });
  return { ok: true as const, data: { ...structuredClone(data()), last: { short: kind === "sale" ? 120 : 0, missing: [] } } };
}
