"use server";

import { getAdminSupabase } from "@/lib/supabase/admin";
import { getServerSupabase } from "@/lib/supabase/server";
import { memoryOf } from "@/lib/memoryServer";
import { remembered, type RememberRule } from "@/lib/characterMemory";
import REMEMBERS from "@/content/characters/remembers.json";

// The Content Engine, step 5: what the city's people remember about this player (content/characters/remembers.json,
// lib/characterMemory.ts), read from their memory with the service role. Only the filled lines leave the server, never
// the player's facts or the rules. Empty before migration 0138 has run.

export async function characterRemembered(): Promise<Record<string, string[]>> {
  const supabase = await getServerSupabase();
  const admin = getAdminSupabase();
  if (!supabase || !admin) return {};
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return {};
  const memory = await memoryOf(admin, user.id);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  return remembered(REMEMBERS as RememberRule[], memory, today, new Date().getDate());
}
