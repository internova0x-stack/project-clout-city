"use server";

import type { StarterResult, StarterState } from "@/lib/starter";
import { getServerSupabase } from "@/lib/supabase/server";

// Server actions behind Starter Week (supabase/migrations/0122). Marks come from triggers; reading the state pays them.

async function call<T>(fn: string, args?: Record<string, unknown>): Promise<StarterResult<T>> {
  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, error: "Accounts aren't switched on yet." };
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return { ok: false, error: "Something went wrong. Try again." };
  return { ok: true, data: (data ?? null) as T };
}

export async function starterState() { return call<StarterState | null>("starter_state"); }
export async function starterHide() { return call<null>("starter_hide"); }
/** Migration 0164: answering Lola's text counts as the message mission. */
export async function starterLola(reply: number) { return call<boolean>("starter_lola_reply", { p_reply: reply }); }
