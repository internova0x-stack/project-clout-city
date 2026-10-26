"use server";

import type { HomeScore } from "@/lib/homeScore";
import { getServerSupabase } from "@/lib/supabase/server";

// The home score (supabase/migrations/0120): home_score_state() works it out from the placed pieces and pays the
// milestones it reaches, once each.

type State = HomeScore & { paid: { score: number; clout: number }[]; reached: number[] };

export async function homeScoreState(): Promise<{ ok: true; data: State } | { ok: false; error: string }> {
  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, error: "Accounts aren't switched on yet." };
  const { data, error } = await supabase.rpc("home_score_state");
  if (error) return { ok: false, error: "The home score is taking a nap." };
  return { ok: true, data: data as State };
}
