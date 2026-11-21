"use server";

import type { GuideState } from "@/lib/guide";
import { getServerSupabase } from "@/lib/supabase/server";

// The Guide (migration 0170): the state, a screen the game saw opened, and paying a done step. Missing until 0170 runs,
// when the Guide just doesn't show.

export async function guideState(): Promise<Omit<GuideState, "rank"> | null> {
  const supabase = await getServerSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("guide_state");
  if (error) {
    if (!/guide_state|no_player/.test(error.message)) console.error("guide_state failed", error);
    return null;
  }
  return data as Omit<GuideState, "rank">;
}

export async function guideSeen(step: string): Promise<void> {
  const supabase = await getServerSupabase();
  if (!supabase) return;
  const { error } = await supabase.rpc("guide_seen", { p_step: step });
  if (error && !/guide_seen|bad_step|rate_limited/.test(error.message)) console.error("guide_seen failed", error);
}

export async function guideClaim(step: string): Promise<{ cash: number; clout: number; chapter: number | null } | null> {
  const supabase = await getServerSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("guide_claim", { p_step: step });
  if (error) {
    if (!/not_yet|guide_claim|rate_limited/.test(error.message)) console.error("guide_claim failed", error);
    return null;
  }
  return data as { cash: number; clout: number; chapter: number | null };
}
