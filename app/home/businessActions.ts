"use server";

import { businessError, type BusinessResult, type BusinessState } from "@/lib/businesses";
import { getServerSupabase } from "@/lib/supabase/server";

// v0.12 businesses (migration 0048). The browser names a business; the server sets every price, pay
// and worth, and refuses what isn't allowed.

async function call<T>(fn: string, args: Record<string, unknown> = {}): Promise<BusinessResult<T>> {
  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, error: "Accounts aren't switched on yet." };
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return { ok: false, error: businessError(error.message) };
  return { ok: true, data: data as T };
}

export async function businessState() {
  return call<BusinessState>("business_state");
}
export async function buyBusiness(id: string) {
  return call<{ cash: number }>("buy_business", { p_id: id });
}
export async function upgradeBusiness(id: string) {
  return call<{ cash: number; level: number }>("upgrade_business", { p_id: id });
}
export async function collectTills() {
  return call<{ cash: number; paid: { id: string; cash: number }[] }>("collect_tills");
}
export async function goPublic() {
  return call<{ cash: number }>("go_public");
}
