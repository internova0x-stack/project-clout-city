"use server";

import { SEASON, passError, type PassReward, type PassResult, type PassState, type StarterPackState } from "@/lib/seasonPass";
import { cityError } from "@/lib/cityState";
import { getServerSupabase } from "@/lib/supabase/server";

// The Clout Pass and the starter pack (migration 0156). The server counts XP and pays every claim; the season's tiers come
// from lib/seasonPass.ts, which game_settings 'season_pass' mirrors.

async function call<T>(fn: string): Promise<PassResult<T>> {
  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, error: "Accounts aren't switched on yet." };
  const { data, error } = await supabase.rpc(fn);
  if (error) {
    if (/season_state|season_claim_all|starter_pack_state/.test(error.message)) return { ok: false, error: "The Clout Pass opens with migration 0156." };
    const code = /^[a-z_]+/.exec(error.message)?.[0] ?? "";
    if (!passError(code) && !/^[a-z_]+(:|$)/.test(error.message)) console.error(`${fn} failed`, error);
    return { ok: false, error: passError(code) ?? cityError(error.message) };
  }
  return { ok: true, data: data as T };
}

type Raw = Omit<PassState, "season"> & { seasonId: string; got?: PassReward[] };
const withSeason = (r: Raw): PassState => ({ ...r, season: SEASON });

export async function passState(): Promise<PassResult<PassState>> {
  const r = await call<Raw | null>("season_state");
  if (!r.ok) return r;
  if (!r.data || r.data.seasonId !== SEASON.id) return { ok: false, error: "No season right now." };
  return { ok: true, data: withSeason(r.data) };
}

export async function passClaimAll(): Promise<PassResult<PassState & { got: PassReward[] }>> {
  const r = await call<Raw>("season_claim_all");
  if (!r.ok) return r;
  return { ok: true, data: { ...withSeason(r.data), got: r.data.got ?? [] } };
}

export async function starterPackState(): Promise<PassResult<StarterPackState>> {
  const r = await call<StarterPackState | null>("starter_pack_state");
  if (!r.ok) return r;
  if (!r.data) return { ok: false, error: "Create your character first." };
  return r as PassResult<StarterPackState>;
}
