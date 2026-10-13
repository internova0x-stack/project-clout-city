import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { getServerSupabase } from "./supabase/server";
import type { StyleId } from "./styles";

export type OnboardingStep = "look_done" | "traits_done" | "lottery_done" | "home_done" | "party_done" | "handoff_done";

export interface Player {
  id: string;
  display_name: string;
  starting_style: StyleId;
  /** Free Look choices; read through normalizeLook(). */
  look: Record<string, unknown>;
  invite_code: string;
  onboarding_step: OnboardingStep;
  created_at: string;
  traits: string[] | null;
  birth_cash: number | null;
  home_id: string | null;
  bank_cash: number;
  clout: number;
  energy: number;
  mood: number;
  confidence: number;
  tutorial_state: "pending" | "done" | "skipped";
  first_party_at: string | null;
  music_muted: boolean;
}

export interface CliqueMember {
  display_name: string;
  starting_style: StyleId;
  joined_at: string;
}

export interface Session {
  user: User | null;
  player: Player | null;
}

const PLAYER_COLUMNS =
  "id, display_name, starting_style, look, invite_code, onboarding_step, created_at, traits, birth_cash, home_id, bank_cash, clout, energy, mood, confidence, tutorial_state, first_party_at, music_muted";

/** Character creation is finished once the player has moved into a home. */
export function creationDone(p: Pick<Player, "home_id">): boolean {
  return p.home_id !== null;
}

/** The signed-in user and their player row, if any. Never throws. */
export async function getSession(): Promise<Session> {
  const supabase = await getServerSupabase();
  if (!supabase) return { user: null, player: null };
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return { user: null, player: null };
  const { data: player } = await supabase.from("players").select(PLAYER_COLUMNS).eq("id", user.id).maybeSingle<Player>();
  return { user, player: player ?? null };
}

export async function getClique(): Promise<CliqueMember[]> {
  const supabase = await getServerSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("my_clique");
  if (error || !data) return [];
  return data as CliqueMember[];
}

/** For pages that need a finished player: sends everyone else where they belong. */
export async function requirePlayer(): Promise<{ user: User; player: Player }> {
  const { user, player } = await getSession();
  if (!user) redirect("/");
  if (!player || !creationDone(player)) redirect("/create");
  return { user, player };
}
