"use server";

import { TV } from "@/lib/cloutTv";
import { cancelAllSubscriptions } from "@/lib/stripe";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { getServerSupabase } from "@/lib/supabase/server";

// Delete my account (owner, Oct 27; GDPR right to erasure; supabase/migrations/0124). In order, stopping at the first
// failure so nothing is half-done: cancel any VIP subscription in Stripe (a player is never billed after deleting),
// remove their Clout TV photos, delete the login (which removes the player and everything theirs), then sign out.

export type DeleteResult = { ok: true } | { ok: false; error: string };

export async function deleteAccount(confirm: string): Promise<DeleteResult> {
  if (confirm.trim().toUpperCase() !== "DELETE") return { ok: false, error: "Type DELETE to confirm." };
  const supabase = await getServerSupabase();
  const admin = getAdminSupabase();
  if (!supabase || !admin) return { ok: false, error: "Accounts aren't switched on yet." };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in first." };

  const prep = await admin.rpc("account_delete_prepare", { p_player: user.id });
  if (prep.error) return { ok: false, error: "We couldn't delete your account just now. Nothing changed; try again." };
  const customer = (prep.data as { customer?: string | null } | null)?.customer ?? null;

  if (customer) {
    const secret = process.env.STRIPE_SECRET_KEY ?? "";
    if (!secret) return { ok: false, error: "We couldn't reach billing to cancel your plan. Nothing changed; try again later." };
    try {
      await cancelAllSubscriptions(secret, customer);
    } catch (e) {
      console.error("delete account: cancel subscriptions failed", e);
      return { ok: false, error: "We couldn't cancel your VIP plan in billing. Nothing changed; try again in a minute." };
    }
  }

  // Clout TV photos live in the player's own folder of the private bucket.
  const bucket = admin.storage.from(TV.bucket);
  const { data: files } = await bucket.list(user.id, { limit: 1000 });
  if (files?.length) await bucket.remove(files.map((f) => `${user.id}/${f.name}`));

  const del = await admin.auth.admin.deleteUser(user.id);
  if (del.error) {
    console.error("delete account: deleteUser failed", del.error);
    return { ok: false, error: "We couldn't delete your account just now. Your plan is cancelled; try again in a minute." };
  }
  await supabase.auth.signOut().catch(() => undefined);
  await forgetInAnalytics(user.id);
  return { ok: true };
}

/**
 * Their PostHog person and events, when the team has set a personal API key (docs/SETUP.md 2f): looked up by the
 * Supabase id the game identified them with. Best effort: the account is already gone either way.
 */
async function forgetInAnalytics(userId: string): Promise<void> {
  const key = process.env.POSTHOG_PERSONAL_API_KEY ?? "";
  const project = process.env.POSTHOG_PROJECT_ID ?? "";
  if (!key || !project) return;
  const host = (process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com").replace(".i.posthog.com", ".posthog.com");
  const headers = { Authorization: `Bearer ${key}` };
  try {
    const found = await fetch(`${host}/api/projects/${project}/persons/?distinct_id=${encodeURIComponent(userId)}`, { headers, cache: "no-store" });
    const people = ((await found.json()) as { results?: { id: string }[] }).results ?? [];
    for (const p of people) {
      await fetch(`${host}/api/projects/${project}/persons/${p.id}/?delete_events=true`, { method: "DELETE", headers, cache: "no-store" });
    }
  } catch (e) {
    console.error("delete account: analytics cleanup failed", e);
  }
}
