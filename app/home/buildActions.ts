"use server";

import { randomUUID } from "node:crypto";
import { cityError, type CityResult } from "@/lib/cityState";
import { loadCityState } from "@/lib/cityServer";
import { homeFloorsFor, homeKeyOf, planCost, planFor, planProblems, type HomePlan } from "@/lib/homeBuild";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { getServerSupabase } from "@/lib/supabase/server";

// Build mode (migration 0169, lib/homeBuild.ts): the browser sends the whole plan; the server checks it against the
// player's own home, prices it against the plan they had (the contractor is instant), and home_build_save charges that
// price and stores it. The browser never names a price.

const ERRORS: Record<string, string> = {
  cant_afford: "That's more than you've got in the bank. Contractors take C$ only.",
  rate_limited: "Slow down a little.",
  no_player: "Create your character first.",
};

export async function saveHomePlan(plan: HomePlan): Promise<CityResult> {
  const supabase = await getServerSupabase();
  const admin = getAdminSupabase();
  if (!supabase || !admin) return { ok: false, error: "Accounts aren't switched on yet." };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in first." };
  const me = await admin.from("players").select("home_id, house_sku, home_plan").eq("id", user.id).maybeSingle<{ home_id: string | null; house_sku: string | null; home_plan: unknown }>();
  if (me.error) {
    if (/home_plan/.test(me.error.message)) return { ok: false, error: "Run migration 0169 to open build mode." };
    console.error("build: load failed", me.error);
    return { ok: false, error: "Something went wrong. Try again." };
  }
  if (!me.data?.home_id) return { ok: false, error: "Create your character first." };
  const key = homeKeyOf(me.data.home_id, me.data.house_sku);
  const floors = homeFloorsFor(me.data.home_id, me.data.house_sku);
  const problems = planProblems(plan, key, floors);
  if (problems.length) return { ok: false, error: "That plan doesn't fit your home. Move things around and try again." };
  const cost = planCost(planFor(me.data.home_plan, key), plan, floors).total;
  const { error } = await admin.rpc("home_build_save", { p_player: user.id, p_plan: plan, p_cost: cost, p_ref: `b:${randomUUID()}` });
  if (error) {
    const code = /^[a-z_]+/.exec(error.message)?.[0] ?? "";
    if (!ERRORS[code]) console.error("home_build_save failed", error);
    return { ok: false, error: ERRORS[code] ?? cityError(error.message) };
  }
  const state = await loadCityState(supabase);
  if (!state) return { ok: false, error: "The city isn't open on this server yet." };
  return { ok: true, state };
}
