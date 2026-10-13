import { CLUB_EVENTS, itemBySku, placeById } from "./city.ts";

/**
 * The Bank's history (v0.7, #29): each cash row says where and what. Rows come from
 * ledger_feed() (migration 0023), which joins the item, task, gig or hunt a ref points at.
 */
export interface LedgerEntry {
  id: number;
  amount: number;
  kind: string;
  ref: string;
  at: string;
  sku?: string | null;
  task?: { place: string; action: string } | null;
  gig?: string | null;
  theme?: string | null;
}

const BILLS: Record<string, [string, string]> = {
  bill_rent: ["🏠", "Rent"], bill_phone: ["📱", "Phone bill"], bill_car_rental: ["🚗", "Car rental"], bill_car_insurance: ["🛡️", "Car insurance"],
};

/** One line for a ledger row: an emoji, where (or what kind), and what exactly. */
export function describeEntry(e: LedgerEntry): { emoji: string; title: string; detail: string | null } {
  const [first] = e.ref.split(":");
  const place = placeById(first);
  const actionLabel = (kind: string) => place?.actions.find((a) => a.kind === kind)?.label ?? null;
  switch (e.kind) {
    case "birth_lottery": return { emoji: "🎲", title: "Birth lottery", detail: "Your starting cash" };
    case "rent": return { emoji: "🏠", title: "First month's rent", detail: null };
    case "party_entry": return { emoji: "🍸", title: "Velvet Static", detail: "Your first party" };
    case "party_reward": return { emoji: "🍾", title: "Velvet Static", detail: "Seen at your first party" };
    case "visit": return { emoji: place?.category === "nightlife" ? "🍸" : "📍", title: place?.name ?? "Night out", detail: actionLabel("visit") };
    case "eat": return { emoji: "🍽️", title: place?.name ?? "Meal", detail: actionLabel("eat") };
    case "hangout": return { emoji: "🌳", title: place?.name ?? "Hangout", detail: actionLabel("hangout") };
    case "shift": return { emoji: "💼", title: place?.name ?? "Shift pay", detail: place ? `Shift pay · ${actionLabel("shift") ?? "a shift"}` : null };
    case "gig": return { emoji: "💼", title: "Gig payout", detail: e.gig ?? null };
    case "event_entry": {
      const ev = CLUB_EVENTS.find((x) => x.id === first);
      return { emoji: "🎟️", title: ev?.name ?? "Club event", detail: ev ? placeById(ev.placeId)?.name ?? null : null };
    }
    case "daily_task": {
      const p = e.task ? placeById(e.task.place) : undefined;
      const a = p?.actions.find((x) => x.id === e.task!.action);
      return { emoji: "✅", title: "Daily task", detail: p ? `${a?.label ?? "Stop by"} · ${p.name}` : null };
    }
    case "daily_bonus": return { emoji: "🏆", title: "All five daily tasks", detail: "Bonus" };
    case "purchase": {
      const it = e.sku ? itemBySku(e.sku) : undefined;
      return { emoji: "🛍️", title: "Shop", detail: it?.name ?? null };
    }
    case "car_rental": return { emoji: "🚗", title: "Car rental", detail: itemBySku(first)?.name ?? null };
    case "sale": return { emoji: "🏷️", title: "Sold an item", detail: null };
    case "hunt": return { emoji: "🗺️", title: "Treasure hunt", detail: e.theme ?? null };
    default: {
      const bill = BILLS[e.kind];
      if (bill) return { emoji: bill[0], title: bill[1], detail: null };
      return { emoji: "💵", title: e.kind.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()), detail: null };
    }
  }
}

/** Sample history for /preview (development only), in the shape ledger_feed() returns. */
export function sampleLedger(now = Date.now()): LedgerEntry[] {
  const at = (h: number) => new Date(now - h * 3_600_000).toISOString();
  return [
    { id: 9, amount: -180, kind: "purchase", ref: "1", at: at(1), sku: "fit-satin-bomber" },
    { id: 8, amount: 75, kind: "daily_task", ref: "3", at: at(3), task: { place: "lucky-seven-deli", action: "eat" } },
    { id: 7, amount: -60, kind: "visit", ref: "velvet-static:2026-10-12:1", at: at(20) },
    { id: 6, amount: 1080, kind: "gig", ref: "4", at: at(26), gig: "Manage socials for a dog with 40k followers" },
    { id: 5, amount: -7, kind: "eat", ref: "lucky-seven-deli:2026-10-12:1", at: at(28) },
    { id: 4, amount: 120, kind: "shift", ref: "grind-and-gossip:2026-10-11:1", at: at(50) },
    { id: 3, amount: -2100, kind: "rent", ref: "first_rent", at: at(72) },
    { id: 2, amount: 7400, kind: "birth_lottery", ref: "birth", at: at(73) },
  ];
}
