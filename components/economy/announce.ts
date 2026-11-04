// The Player Economy's celebrations, once per event per device (components/seenOnce.ts): the polls and reopened sheets that
// see the same gift, deal or handover again stay quiet. The cards themselves are components/economy/results.ts.

import { celebrate } from "@/components/Celebrate";
import { firstTime, recent } from "@/components/seenOnce";
import type { GiftInbox, IncomingGift } from "@/lib/playerEconomy";
import type { MarketState, MarketTrade } from "@/lib/marketplace";
import type { AssetSalesState } from "@/lib/assetSales";
import { assetBoughtBanner, assetSoldResult, giftAcceptedBanner, giftReceivedBanner, listingSoldBanner, swapDoneBanner } from "./results";

const GIFT_DAYS = 8;
const DEAL_DAYS = 7;

/** Sender side, from every inbox load: each accepted gift once. */
export function announceGifts(inbox: GiftInbox | null | undefined, now = Date.now()) {
  for (const g of inbox?.sent ?? []) {
    if (g.status === "accepted" && recent(g.createdAt, GIFT_DAYS, now) && firstTime("eco", `gift-sent:${g.id}`)) celebrate(giftAcceptedBanner(g));
  }
}

/** Receiver side, right after Accept (once, even if the answer is retried). */
export function announceGiftAccepted(g: IncomingGift | undefined) {
  if (g && firstTime("eco", `gift-in:${g.id}`)) celebrate(giftReceivedBanner(g));
}

/** From every Market load (the app and GameShell's badge poll): listings sold and swaps done, each once. */
export function announceMarket(s: MarketState | null | undefined, now = Date.now()) {
  if (!s?.on) return;
  for (const l of s.mine) {
    if (l.status === "sold" && recent(l.soldAt, DEAL_DAYS, now) && firstTime("eco", `sold:${l.id}`)) celebrate(listingSoldBanner(l));
  }
  for (const t of s.trades) announceSwap(t, now);
}

export function announceSwap(t: MarketTrade | null | undefined, now = Date.now()) {
  if (t?.status === "done" && recent(t.settledAt ?? t.updatedAt, DEAL_DAYS, now) && firstTime("eco", `swap:${t.id}`)) celebrate(swapDoneBanner(t));
}

/** From every asset-sales load (the Phone's panels and once when the game opens): a handover, once, on each side. */
export function announceAssets(s: AssetSalesState | null | undefined, now = Date.now()) {
  for (const x of s?.sales ?? []) {
    if (x.status !== "done" || !recent(x.settledAt, DEAL_DAYS, now) || !firstTime("eco", `asset:${x.id}:${x.role}`)) continue;
    celebrate(x.role === "seller" ? assetSoldResult(x) : assetBoughtBanner(x));
  }
}
