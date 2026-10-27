"use server";

import type { StarterResult, StarterState } from "@/lib/starter";
import { getServerSupabase } from "@/lib/supabase/server";

// Server actions behind Starter Week (supabase/migrations/0122). Marks come from triggers; reading the state pays them.

async function call<T>(fn: string): Promise<StarterResult<T>> {
  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, error: "Accounts aren't switched on yet." };
  const { data, error } = await supabase.rpc(fn);
  if (error) return { ok: false, error: "Something went wrong. Try again." };
  return { ok: true, data: (data ?? null) as T };
}

export async function starterState() { return call<StarterState | null>("starter_state"); }
export async function starterHide() { return call<null>("starter_hide"); }
