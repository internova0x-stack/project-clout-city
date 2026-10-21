"use server";

import { coutureError, EMPTY_COUTURE_MAP, type CoutureMap, type CoutureResult, type PlazaWeeks } from "@/lib/coutureMap";
import { getServerSupabase } from "@/lib/supabase/server";

// Clout Couture on the map (migration 0104): what the map draws, and the plaza statue's booking.

async function call<T>(fn: string, args: Record<string, unknown> = {}): Promise<CoutureResult<T>> {
  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, error: "Accounts aren't switched on yet." };
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return { ok: false, error: coutureError(error.message) };
  return { ok: true, data: data as T };
}

export async function coutureMap(): Promise<CoutureResult<CoutureMap>> {
  const r = await call<CoutureMap>("couture_map");
  return r.ok ? { ok: true, data: { ...EMPTY_COUTURE_MAP, ...r.data } } : r;
}
export async function plazaWeeks() {
  return call<PlazaWeeks>("plaza_weeks");
}
export async function plazaBook(week: string) {
  return call<PlazaWeeks>("plaza_book", { p_week: week });
}
