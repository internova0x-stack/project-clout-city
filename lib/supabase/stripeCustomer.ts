import { getAdminSupabase } from "./admin";

// Server only (service role); never export this from a "use server" file, where it would become a browser-callable action.

/** A saved Stripe customer that Stripe doesn't know in this mode (test purchases read with live keys): forget it. */
export async function forgetCustomer(playerId: string): Promise<void> {
  const { error } = await getAdminSupabase()?.from("stripe_customers").delete().eq("player_id", playerId) ?? { error: null };
  if (error) console.error("forget stripe customer failed", error);
}
