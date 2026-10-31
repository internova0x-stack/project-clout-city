"use server";

import { galaError, type GalaResult, type GalaState } from "@/lib/gala";
import { getServerSupabase } from "@/lib/supabase/server";

// The Charity Gala (the underworld, part 2; migration 0150): the player's own calls, checked by the database (Halo only,
// at the rooftop, once a New York week).

const codeOf = (m: string) => /^(not_invited|not_here|cant_afford|done_this_week|bad_amount|rate_limited)/.exec(m)?.[1] ?? "unknown";

export async function galaState(): Promise<GalaResult<GalaState>> {
  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, error: "Accounts aren't switched on yet." };
  const { data, error } = await supabase.rpc("gala_state");
  if (error) return { ok: false, error: /gala_state/.test(error.message) ? "Run migration 0150 to open the gala." : galaError(codeOf(error.message)) };
  return { ok: true, data: data as GalaState };
}

export async function galaDonate(amount: number): Promise<GalaResult<{ clout: number; mood: number }>> {
  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, error: "Accounts aren't switched on yet." };
  const { data, error } = await supabase.rpc("gala_donate", { p_amount: Math.round(Number(amount) || 0) });
  if (error) return { ok: false, error: galaError(codeOf(error.message)) };
  return { ok: true, data: data as { clout: number; mood: number } };
}
