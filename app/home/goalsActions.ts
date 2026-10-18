"use server";

import type { GoalsResult, GoalsState } from "@/lib/goals";
import { cityError } from "@/lib/cityState";
import { getServerSupabase } from "@/lib/supabase/server";

// Daily tasks 2.0 (migrations 0073, 0074). goals_state also pays any goal that has just finished.

async function call<T>(fn: string, args: Record<string, unknown> = {}): Promise<GoalsResult<T>> {
  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, error: "Accounts aren't switched on yet." };
  const { data, error } = await supabase.rpc(fn, args);
  if (error) {
    if (!/^[a-z_]+(:|$)/.test(error.message)) console.error(`${fn} failed`, error);
    return { ok: false, error: cityError(error.message) };
  }
  return { ok: true, data: data as T };
}

export async function goalsState() { return call<GoalsState>("goals_state"); }
export async function spendGuestPass(place: string) { return call<GoalsState>("use_guest_pass", { p_place: place }); }
