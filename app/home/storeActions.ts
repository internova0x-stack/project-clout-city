"use server";

import { headers } from "next/headers";
import { createCheckoutSession, expireCheckoutSession, stripeUnknown, type CheckoutInput } from "@/lib/stripe";
import { forgetCustomer } from "@/lib/supabase/stripeCustomer";
import { RETURN_PARAM, storeError, type CheckoutResult, type StoreProduct } from "@/lib/store";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { getServerSupabase } from "@/lib/supabase/server";
import { inSteamApp } from "./steamStoreActions";

// Real-money checkout (Payments Brief v2). The server creates the Stripe Checkout
// Session; only the webhook (app/api/stripe/webhook) ever grants what was bought.

export async function loadCatalog(): Promise<StoreProduct[] | null> {
  const supabase = await getServerSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("store_catalog");
  return error ? null : (data as StoreProduct[]);
}

async function origin(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
}

export async function startCheckout(sku: string): Promise<CheckoutResult> {
  const secret = process.env.STRIPE_SECRET_KEY ?? "";
  const supabase = await getServerSupabase();
  if (!secret || !process.env.STRIPE_WEBHOOK_SECRET || !process.env.SUPABASE_SERVICE_ROLE_KEY || !supabase) {
    return { ok: false, error: storeError("payments_off") };
  }
  // Steam doesn't allow another checkout inside a Steam game: the Steam app pays through Steam (steamStoreActions.ts).
  if (await inSteamApp()) return { ok: false, error: "Buy this with Steam checkout in the Steam app." };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in first." };
  const { data: product } = await supabase
    .from("store_products").select("sku, product_type, name, price_cents, currency, stripe_price_id, recurring").eq("sku", sku).maybeSingle();
  if (!product) return { ok: false, error: storeError("unknown_product") };
  const back = `${await origin()}/home?${RETURN_PARAM}=`;
  // Membership & purchases (migration 0079): a returning buyer pays as the same Stripe customer.
  const billing = await getAdminSupabase()?.rpc("membership_billing", { p_player: user.id });
  const customer = (billing?.data as { customer?: string | null } | null)?.customer ?? null;
  try {
    const input: CheckoutInput = {
      priceId: product.stripe_price_id,
      name: `Clout City: ${product.name}`,
      amountCents: product.price_cents,
      currency: product.currency,
      successUrl: `${back}success&sku=${encodeURIComponent(sku)}`,
      cancelUrl: `${back}cancelled&sku=${encodeURIComponent(sku)}`,
      playerId: user.id,
      sku,
      productType: product.product_type,
      email: user.email,
      customer,
      recurring: product.recurring === "month" || product.recurring === "year" ? product.recurring : null,
    };
    let session;
    try {
      session = await createCheckoutSession(secret, input);
    } catch (e) {
      // A saved customer from test mode (or another Stripe account): forget it and pay as a new customer.
      if (!customer || !stripeUnknown(e, "customer")) throw e;
      await forgetCustomer(user.id);
      session = await createCheckoutSession(secret, { ...input, customer: null });
    }
    const { data: replaced, error } = await supabase.rpc("start_purchase", { p_sku: sku, p_session: session.id });
    if (error) {
      await expireCheckoutSession(secret, session.id).catch(() => true);
      return { ok: false, error: storeError(error.message) };
    }
    // Migration 0130: the player's older open checkout for this product (or another chat plan) is closed, so only this
    // one can be paid. If the older one was paid in the meantime, this one closes instead.
    // A replaced Steam order (steam:…) can't be paid any more: Steam never finalizes it.
    for (const old of ((replaced as string[] | null) ?? []).filter((id) => id.startsWith("cs_"))) {
      if (!(await expireCheckoutSession(secret, old))) {
        await expireCheckoutSession(secret, session.id).catch(() => true);
        return { ok: false, error: storeError("already_owned") };
      }
    }
    return { ok: true, url: session.url };
  } catch (e) {
    console.error("checkout failed", e);
    return { ok: false, error: storeError(undefined) };
  }
}
