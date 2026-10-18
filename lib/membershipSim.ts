// Membership & purchases in the development preview (?member=…): sample plans and receipts, no Stripe.

import type { MembershipApi, MembershipState, Purchase } from "./membership.ts";

const day = 86_400_000;
const at = (days: number) => new Date(Date.now() + days * day).toISOString();

const RECEIPTS: Purchase[] = [
  { id: "p4", name: "VIP yearly", emoji: "👑", amountCents: 3999, currency: "usd", at: at(-12), status: "paid" },
  { id: "p3", name: "Velvet Static: Rooftop Rewind", emoji: "🎟️", amountCents: 499, currency: "usd", at: at(-20), status: "paid" },
  { id: "p2", name: "Postcard: The Unisphere", emoji: "📮", amountCents: 199, currency: "usd", at: at(-26), status: "refunded" },
  { id: "p1", name: "The Sarah Bird Files (side story)", emoji: "📖", amountCents: 299, currency: "usd", at: at(-31), status: "paid" },
];

export function previewMembership(preset: string): MembershipApi {
  const yearly = { plan: "yearly" as const, priceCents: 3999, currency: "usd" };
  const monthly = { plan: "monthly" as const, priceCents: 499, currency: "usd" };
  const rest = RECEIPTS.slice(1);
  const states: Record<string, MembershipState> = {
    vip: { vip: { ...yearly, status: "active", periodEnd: at(353) }, chatForever: false, purchases: RECEIPTS, canManage: true },
    monthly: { vip: { ...monthly, status: "active", periodEnd: at(18) }, chatForever: false, purchases: [{ ...RECEIPTS[0], name: "VIP monthly", amountCents: 499 }, ...rest], canManage: true },
    cancelling: { vip: { ...monthly, status: "cancelling", periodEnd: at(18) }, chatForever: false, purchases: [{ ...RECEIPTS[0], name: "VIP monthly", amountCents: 499 }, ...rest], canManage: true },
    pastdue: { vip: { ...monthly, status: "past_due", periodEnd: at(-1) }, chatForever: false, purchases: [{ ...RECEIPTS[0], name: "VIP monthly", amountCents: 499 }, ...rest], canManage: true },
    forever: { vip: null, chatForever: true, purchases: [{ ...RECEIPTS[0], name: "Chat forever", emoji: "✨", amountCents: 11999 }, ...rest], canManage: true },
    free: { vip: null, chatForever: false, purchases: rest, canManage: true },
    none: { vip: null, chatForever: false, purchases: [], canManage: false },
  };
  const state = states[preset] ?? states.vip;
  return {
    state: () => Promise.resolve({ ok: true, data: state }),
    portal: () => Promise.resolve({ ok: false, error: "Preview: this opens Stripe's billing portal (switch plan, card, cancel, receipts)." }),
  };
}
