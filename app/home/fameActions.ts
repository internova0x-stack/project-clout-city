"use server";

import type { FameUse } from "@/components/game/Ranks";
import { getServerSupabase } from "@/lib/supabase/server";

// Fame perks (migration 0175, lib/fame.ts): which repeating perks are used this week or today, for the Ranks & fame
// perks list. Missing until 0175 runs, when the list just doesn't show usage.
export async function fameState(): Promise<FameUse | null> {
  const supabase = await getServerSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("fame_state");
  if (error) {
    if (!/fame_state/.test(error.message)) console.error("fame_state failed", error);
    return null;
  }
  return (data ?? null) as FameUse | null;
}
