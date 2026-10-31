// Server only: a player's memory (migration 0138) plus the city's conditions in force (migration 0140), read with the
// service role. Storylets (app/home/choiceActions.ts) and the characters who remember you (app/home/characterActions.ts)
// read it. Null before migration 0138 has run.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Memory } from "./memory";
import { conditionsInForce, type ConditionNow } from "./cityConditions";

export async function memoryOf(admin: SupabaseClient, id: string): Promise<Memory | null> {
  const [{ data, error }, cond] = await Promise.all([admin.rpc("player_memory", { p_player: id }), admin.rpc("city_conditions_now")]);
  if (error || !data) return null;
  const m = data as Memory;
  return { ...m, snapshot: { ...m.snapshot, conditions: !cond.error && Array.isArray(cond.data) ? conditionsInForce(cond.data as ConditionNow[]) : [] } };
}
