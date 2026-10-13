"use server";

import type { Player } from "@/lib/player";
import { getServerSupabase } from "@/lib/supabase/server";

export type PlayerUpdate = Pick<Player, "bank_cash" | "clout" | "energy" | "mood" | "confidence" | "onboarding_step" | "first_party_at">;

export async function setTutorialState(state: "done" | "skipped"): Promise<void> {
  const supabase = await getServerSupabase();
  await supabase?.rpc("set_tutorial_state", { p_state: state });
}

export async function attendFirstParty(withClique: boolean): Promise<{ ok: true; player: PlayerUpdate } | { ok: false; error: string }> {
  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, error: "Accounts aren't switched on yet." };
  const { data, error } = await supabase.rpc("attend_first_party", { p_with_clique: withClique });
  if (error || !data) {
    console.error("attend_first_party failed", error);
    return { ok: false, error: error?.message.includes("cant_afford") ? "You can't cover the door. Somehow." : "The bouncer lost the list. Try again." };
  }
  const p = data as Player;
  return {
    ok: true,
    player: { bank_cash: p.bank_cash, clout: p.clout, energy: p.energy, mood: p.mood, confidence: p.confidence, onboarding_step: p.onboarding_step, first_party_at: p.first_party_at },
  };
}

export async function finishHandoff(): Promise<void> {
  const supabase = await getServerSupabase();
  await supabase?.rpc("finish_handoff");
}

export async function setMusicMuted(muted: boolean): Promise<void> {
  const supabase = await getServerSupabase();
  await supabase?.rpc("set_music_muted", { p_muted: muted });
}
