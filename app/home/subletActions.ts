"use server";

import { subletError, type SubletHome, type SubletResult, type SubletState } from "@/lib/sublets";
import { getServerSupabase } from "@/lib/supabase/server";

// Server actions behind sublets (supabase/migrations/0119). Each calls one SQL function, which checks homes, rent
// bounds, account age, blocks, money and limits.

async function call<T>(fn: string, args: Record<string, unknown> = {}): Promise<SubletResult<T>> {
  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, error: "Accounts aren't switched on yet." };
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return { ok: false, error: subletError(error.message) };
  return { ok: true, data: data as T };
}

export async function subletState() { return call<SubletState>("sublet_state"); }
export async function subletHome() { return call<SubletHome | null>("sublet_home"); }
export async function subletList(rent: number, minWeeks: number, maxWeeks: number, note: string) {
  return call<SubletState>("sublet_list", { p_rent: rent, p_min_weeks: minWeeks, p_max_weeks: maxWeeks, p_note: note });
}
export async function subletUnlist() { return call<SubletState>("sublet_unlist"); }
export async function subletApply(listing: number, weeks: number, note: string) {
  return call<SubletState>("sublet_apply", { p_listing: listing, p_weeks: weeks, p_note: note });
}
export async function subletWithdraw(listing: number) { return call<SubletState>("sublet_withdraw", { p_listing: listing }); }
export async function subletAnswer(app: number, yes: boolean) { return call<SubletState>("sublet_answer", { p_app: app, p_yes: yes }); }
export async function subletNotice(on: boolean) { return call<SubletState>("sublet_notice", { p_on: on }); }
export async function subletLeave() { return call<SubletState>("sublet_leave"); }
export async function subletRenew(weeks: number) { return call<SubletState>("sublet_renew", { p_weeks: weeks }); }
export async function subletRenewAnswer(yes: boolean) { return call<SubletState>("sublet_renew_answer", { p_yes: yes }); }
export async function subletHang() { return call<SubletState>("sublet_hang"); }
export async function subletShow(on: boolean) { return call<SubletState>("sublet_show", { p_on: on }); }
export async function subletRate(sublet: number, stars: number) { return call<SubletState>("sublet_rate", { p_sublet: sublet, p_stars: stars }); }
export async function subletSeen(sublet: number) { return call<SubletState>("sublet_seen", { p_sublet: sublet }); }
