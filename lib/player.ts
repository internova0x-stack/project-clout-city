import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { getServerSupabase } from "./supabase/server";
import type { Look, StyleId } from "./styles";

export interface Player {
  id: string;
  display_name: string;
  starting_style: StyleId;
  look: Partial<Look>;
  invite_code: string;
  onboarding_step: string;
  created_at: string;
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

/** The signed-in user and their player row, if any. Never throws. */
export async function getSession(): Promise<Session> {
  const supabase = await getServerSupabase();
  if (!supabase) return { user: null, player: null };
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return { user: null, player: null };
  const { data: player } = await supabase
    .from("players")
    .select("id, display_name, starting_style, look, invite_code, onboarding_step, created_at")
    .eq("id", user.id)
    .maybeSingle<Player>();
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
  if (!player) redirect("/create");
  return { user, player };
}
