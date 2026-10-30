"use server";

import { headers } from "next/headers";
import { expireCheckoutSession } from "@/lib/stripe";
import { finalizeTxn, initTxn, newOrderId, steamConfig, steamPrice, steamSession, steamWallet } from "@/lib/steam";
import { storeError } from "@/lib/store";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { getServerSupabase } from "@/lib/supabase/server";

// Steam checkout (step 3; docs/STEAM.md; migration 0134: the wallet rates). Only inside the Steam app (its user agent says
// CloutCitySteam): Steam doesn't allow another checkout in a Steam game, and the web keeps Stripe (storeActions.ts).
//   1. steamCheckout(sku): the same start_purchase as Stripe (owned, sold out, editions, one open checkout) under the
//      session 'steam:<order>', then InitTxn in the player's wallet currency. Steam shows its checkout in the overlay.
//   2. The app hears Steam's answer (MicroTxnAuthorizationResponse) and the page calls steamFinish(order, approved):
//      approved, the server finalizes it with Steam and grants it with payment_grant, exactly as the Stripe webhook does;
//      declined, the purchase row closes (payment_expired).
// One-time products only: VIP (a subscription) stays on the web until Steam subscriptions are approved.

export type SteamCheckout = { ok: true; orderId: string } | { ok: false; error: string };

const sandbox = () => process.env.STEAM_MICROTXN_SANDBOX === "1";

/** Inside the Steam app? (desktop/main.js adds CloutCitySteam to the user agent.) */
export async function inSteamApp(): Promise<boolean> {
  return /CloutCitySteam\//.test((await headers()).get("user-agent") ?? "");
}

async function steamIdOf(userId: string): Promise<string | null> {
  const { data } = await getAdminSupabase()!.from("steam_accounts").select("steam_id").eq("user_id", userId).maybeSingle<{ steam_id: string }>();
  return data?.steam_id ?? null;
}

export async function steamCheckout(sku: string): Promise<SteamCheckout> {
  const cfg = steamConfig();
  const supabase = await getServerSupabase();
  const admin = getAdminSupabase();
  if (!cfg || !supabase || !admin) return { ok: false, error: "Steam checkout isn't switched on yet. Nothing was charged." };
  if (!(await inSteamApp())) return { ok: false, error: storeError(undefined) };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in first." };
  const steamId = await steamIdOf(user.id);
  if (!steamId) return { ok: false, error: "Open Clout City from Steam to buy here." };

  const { data: product } = await supabase.from("store_products").select("sku, name, price_cents, currency, recurring").eq("sku", sku).maybeSingle();
  if (!product) return { ok: false, error: storeError("unknown_product") };
  if (product.recurring) return { ok: false, error: "VIP isn't sold on Steam yet. Everything else is." };

  const wallet = await steamWallet(cfg, steamId, sandbox());
  if (!wallet.ok) return { ok: false, error: wallet.error === "wallet_locked" ? "Steam says your wallet can't make purchases right now." : "Steam isn't answering. Nothing was charged; try again." };
  const { data: settings } = await admin.from("game_settings").select("value").eq("key", "steam_store").maybeSingle<{ value: { rates?: Record<string, number> } }>();
  const amount = (product.currency ?? "usd").toLowerCase() === "usd" ? steamPrice(product.price_cents, wallet.currency, settings?.value?.rates ?? {}) : null;
  if (amount === null) return { ok: false, error: `Steam checkout in ${wallet.currency} isn't open yet. Nothing was charged.` };

  const orderId = newOrderId();
  const session = steamSession(orderId);
  const { data: replaced, error } = await supabase.rpc("start_purchase", { p_sku: sku, p_session: session });
  if (error) return { ok: false, error: storeError(error.message) };
  // An older open web checkout for the same thing is closed in Stripe, so it can't be paid as well (a replaced Steam
  // order is never finalized). If it was paid in the meantime, this order closes instead.
  const secret = process.env.STRIPE_SECRET_KEY ?? "";
  for (const old of ((replaced as string[] | null) ?? []).filter((id) => id.startsWith("cs_"))) {
    if (secret && !(await expireCheckoutSession(secret, old))) {
      await admin.rpc("payment_expired", { p_event: `${session}:replaced`, p_session: session });
      return { ok: false, error: storeError("already_owned") };
    }
  }
  const r = await initTxn(cfg, { orderId, steamId, sku, name: product.name, amount, currency: wallet.currency }, sandbox());
  if (!r.ok) {
    console.error("Steam InitTxn failed", r.error);
    await admin.rpc("payment_expired", { p_event: `${session}:init`, p_session: session });
    return { ok: false, error: "Steam checkout didn't open. Nothing was charged; try again." };
  }
  // The price Steam was asked for, kept on the purchase until it is paid.
  await admin.from("purchases").update({ amount_cents: amount, currency: wallet.currency.toLowerCase() }).eq("stripe_session_id", session);
  return { ok: true, orderId };
}

export async function steamFinish(orderId: string, approved: boolean): Promise<{ ok: boolean; error?: string }> {
  const cfg = steamConfig();
  const supabase = await getServerSupabase();
  const admin = getAdminSupabase();
  if (!cfg || !supabase || !admin || !/^[0-9]{1,19}$/.test(orderId)) return { ok: false, error: storeError(undefined) };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in first." };
  const session = steamSession(orderId);
  const { data: row } = await admin.from("purchases").select("player_id, sku, status, amount_cents, currency").eq("stripe_session_id", session)
    .maybeSingle<{ player_id: string; sku: string; status: string; amount_cents: number | null; currency: string | null }>();
  if (!row || row.player_id !== user.id) return { ok: false, error: storeError(undefined) };
  if (!approved) {
    await admin.rpc("payment_expired", { p_event: `${session}:declined`, p_session: session });
    return { ok: true };
  }
  const fin = await finalizeTxn(cfg, orderId, sandbox());
  if (!fin.ok) {
    console.error("Steam FinalizeTxn failed", fin.error);
    return { ok: false, error: "Steam didn't confirm the payment. If you were charged, it unlocks on its own; otherwise nothing was taken." };
  }
  const transId = String(fin.params.transid ?? orderId);
  const { error } = await admin.rpc("payment_grant", {
    p_event: `${session}:finalized`, p_session: session, p_payment: `steam:${transId}`, p_player: user.id, p_sku: row.sku,
    p_amount: row.amount_cents, p_currency: row.currency ?? "usd",
  });
  if (error) {
    console.error("payment_grant for a Steam order failed", error);
    return { ok: false, error: "Paid on Steam; unlocking can take a minute. It will appear on its own." };
  }
  return { ok: true };
}
