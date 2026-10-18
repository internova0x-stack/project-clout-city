"use server";

import { headers } from "next/headers";
import { createPortalSession, getCheckoutSession, getSubscription } from "@/lib/stripe";
import { purchaseEmoji, vipFromSubscription, type MembershipResult, type MembershipState } from "@/lib/membership";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { getServerSupabase } from "@/lib/supabase/server";

// Membership & purchases (migration 0079): the player's plan and receipts, read from the database and, for the
// renewal date and cancel/payment status, live from Stripe; and a Stripe billing portal session. Stripe ids never
// reach the browser.

interface Billing { customer: string | null; subscription: string | null; sessions: string[] }
interface Stored {
  vip: { sku: string; priceCents: number; currency: string } | null;
  chatForever: boolean;
  hasCustomer: boolean;
  purchases: { id: string; sku: string; name: string; type: string; amountCents: number; currency: string; at: string; status: "paid" | "refunded" }[];
}

const OFF = "Payments aren't switched on yet.";

async function player() {
  const supabase = await getServerSupabase();
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  return user ? { supabase, user } : null;
}

/** The customer and VIP subscription (service role). Finds and saves the customer for buyers from before 0079. */
async function billing(secret: string, playerId: string): Promise<Billing | null> {
  const admin = getAdminSupabase();
  if (!admin) return null;
  const { data, error } = await admin.rpc("membership_billing", { p_player: playerId });
  if (error) { console.error("membership_billing failed", error); return null; }
  const b = data as Billing;
  if (!b.customer) {
    try {
      const found = b.subscription
        ? (await getSubscription(secret, b.subscription)).customer
        : b.sessions[0] ? (await getCheckoutSession(secret, b.sessions[0])).customer : null;
      if (found) {
        b.customer = found;
        await admin.rpc("payment_customer", { p_player: playerId, p_customer: found });
      }
    } catch (e) {
      console.error("membership customer lookup failed", e);
    }
  }
  return b;
}

export async function membershipState(): Promise<MembershipResult<MembershipState>> {
  const p = await player();
  if (!p) return { ok: false, error: "Sign in first." };
  const { data, error } = await p.supabase.rpc("membership_state");
  if (error) { console.error("membership_state failed", error); return { ok: false, error: "The bank's not answering. Try again in a minute." }; }
  const s = data as Stored;
  const secret = process.env.STRIPE_SECRET_KEY ?? "";
  const plan = s.vip?.sku === "chat-unlimited-yearly" ? "yearly" as const : "monthly" as const;
  let vip: MembershipState["vip"] = s.vip ? { plan, status: "active", periodEnd: null, priceCents: s.vip.priceCents, currency: s.vip.currency } : null;
  let canManage = s.hasCustomer;
  if (secret && (s.vip || s.purchases.length)) {
    const b = await billing(secret, p.user.id);
    canManage = !!b?.customer;
    if (s.vip && b?.subscription) {
      try {
        vip = vipFromSubscription(await getSubscription(secret, b.subscription), { plan, priceCents: s.vip.priceCents, currency: s.vip.currency });
      } catch (e) {
        console.error("membership subscription read failed", e);
      }
    }
  }
  return {
    ok: true,
    data: {
      vip,
      chatForever: s.chatForever,
      canManage: !!secret && canManage,
      purchases: s.purchases.map((x) => ({ id: x.id, name: x.name, emoji: purchaseEmoji(x.type, x.sku), amountCents: x.amountCents, currency: x.currency, at: x.at, status: x.status })),
    },
  };
}

/** Stripe's billing portal for this player: switch plan, update card, cancel at period end, receipts. */
export async function membershipPortal(): Promise<MembershipResult<{ url: string }>> {
  const secret = process.env.STRIPE_SECRET_KEY ?? "";
  const p = await player();
  if (!p) return { ok: false, error: "Sign in first." };
  if (!secret) return { ok: false, error: OFF };
  const b = await billing(secret, p.user.id);
  if (!b?.customer) return { ok: false, error: "Nothing to manage yet: Stripe opens a billing page after your first purchase." };
  try {
    const h = await headers();
    const origin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
    const { url } = await createPortalSession(secret, b.customer, `${origin}/home?membership=back`);
    return { ok: true, data: { url } };
  } catch (e) {
    console.error("billing portal failed", e);
    return { ok: false, error: "Stripe's billing page didn't open. Nothing changed; try again." };
  }
}
