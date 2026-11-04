// The Player Economy's wins as celebrations (owner, Nov 4: the rest of the results screens; components/Celebrate.tsx).
//   a gift you sent, accepted          banner (sender side; seen in the gift inbox's "You sent" list)
//   a gift you accepted                banner (receiver side, right after Accept)
//   a Market listing sold / you bought banner with what you got
//   a swap done                        banner with what you got
//   an asset sale handed over          the seller's results card (the price minus the city's cut) and the buyer's banner
// Pure builders (tests/economyResults.test.ts); components/economy/announce.ts celebrates each event once per device.

import type { Celebration } from "../Celebrate.tsx";
import type { IncomingGift, SentGift } from "../../lib/playerEconomy.ts";
import type { MarketListing, MarketTrade, MyListing } from "../../lib/marketplace.ts";
import type { AssetSale } from "../../lib/assetSales.ts";

const cs = (n: number) => `C$${Math.round(n).toLocaleString("en-US")}`;
const at = (name: string | null | undefined) => (name ? `@${name}` : "Someone");
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

// ---- Builders -------------------------------------------------------------------------------------------------------

/** Sender side: the friend said yes. */
export function giftAcceptedBanner(g: SentGift): Celebration {
  return { rung: 2, emoji: "🎁", tag: "Gift accepted", title: `${at(g.toName)} said yes to the ${lower(g.name)}`,
    rewards: [{ text: "💞 Good taste, confirmed" }] };
}

/** Receiver side: you tapped Accept. */
export function giftReceivedBanner(g: IncomingGift): Celebration {
  return { rung: 2, emoji: "🎁", tag: `Gift from ${at(g.fromName)}`, title: `The ${lower(g.name)} is yours`,
    rewards: [{ tone: "cash", text: `Worth ${cs(g.value)}` }] };
}

/** Your listing sold: the money after the city's 5%. */
export function listingSoldBanner(l: MyListing): Celebration {
  return { rung: 2, emoji: l.emoji ?? "🏷️", tag: "Sold on the Market", title: `${at(l.buyerName)} bought your ${lower(l.name)}`,
    rewards: [{ tone: "cash", text: `+${cs(l.price - l.fee)}` }] };
}

/** You bought someone's listing. */
export function listingBoughtBanner(l: Pick<MarketListing, "name" | "emoji" | "sellerName" | "reference" | "price">): Celebration {
  const deal = l.reference - l.price;
  return { rung: 2, emoji: l.emoji ?? "🛍️", tag: "Market find", title: `The ${lower(l.name)} is yours`,
    rewards: [{ text: `From ${at(l.sellerName)}` }, ...(deal > 0 ? [{ tone: "cash" as const, text: `${cs(deal)} under the Shop` }] : [])] };
}

/** A swap went through: what came your way (and any C$ topped up, after the city's cut, which the server already took). */
export function swapDoneBanner(t: MarketTrade): Celebration {
  const got = t.them.items;
  const first = got[0];
  return { rung: 2, emoji: "🔁", tag: `Swap with ${at(t.withName)}`,
    title: got.length === 1 && first ? `The ${lower(first.name)} is yours` : `${got.length} new things are yours`,
    rewards: [...got.slice(0, 3).map((i) => ({ text: `${i.emoji ?? "🛍️"} ${i.name}` })), ...(t.them.cash > 0 ? [{ tone: "cash" as const, text: `+${cs(t.them.cash)}` }] : [])] };
}

/** The seller's results card: the price minus the city's cut, the price against the appraisal. */
export function assetSoldResult(s: AssetSale): Celebration {
  const net = s.price - s.fee;
  const over = s.price >= s.appraisal;
  return { rung: 3, emoji: s.emoji || (s.kind === "house" ? "🏠" : "🏪"), tag: s.kind === "house" ? "House sold" : "Business sold",
    title: `${s.label} is ${at(s.with?.name)}'s problem now`, cta: "Count it", twist: "register",
    result: { tone: "win", stamp: { text: "SOLD", tone: "good" }, amount: net, unit: `after the city's ${cs(s.fee)}`,
      story: over ? "Over the appraisal. The notary raised one eyebrow." : "A friends-and-family price. The notary sighed.",
      meter: { label: "📋 Price vs appraisal", have: s.price, need: s.appraisal, max: Math.round(s.appraisal * 1.25),
        say: `Appraised at ${cs(s.appraisal)}.` },
      keep: ["Your clout", "Your crew", s.kind === "house" ? "Your things" : "Your other businesses"] } };
}

/** The buyer's banner: the keys. */
export function assetBoughtBanner(s: AssetSale): Celebration {
  return { rung: 2, emoji: "🔑", tag: s.kind === "house" ? "New place" : "New business", title: `${s.label} is yours`,
    rewards: [{ text: `${s.emoji} From ${at(s.with?.name)}` }] };
}
