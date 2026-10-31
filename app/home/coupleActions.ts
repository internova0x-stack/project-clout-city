"use server";

import { coupleError, type CohabitHome, type CoupleResult, type CoupleState } from "@/lib/couples";
import { getServerSupabase } from "@/lib/supabase/server";

// Server actions behind relationships (supabase/migrations/0118). Each calls one SQL function, which checks
// matches, dates, blocks, account age and limits.

async function call<T>(fn: string, args: Record<string, unknown> = {}, map: (d: unknown) => T = (d) => d as T): Promise<CoupleResult<T>> {
  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, error: "Accounts aren't switched on yet." };
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return { ok: false, error: coupleError(error.message) };
  return { ok: true, data: map(data) };
}

export async function coupleState() {
  return call<CoupleState>("couple_state");
}
export async function coupleAsk(playerId: string) {
  return call<CoupleState>("couple_ask", { p_player: playerId });
}
export async function coupleAnswer(askId: number, yes: boolean) {
  return call<CoupleState>("couple_answer", { p_ask: askId, p_yes: yes });
}
export async function coupleEnd() {
  return call<CoupleState>("couple_end");
}
export async function coupleShow(on: boolean) {
  return call<CoupleState>("couple_show", { p_on: on });
}
export async function coupleGift() {
  return call<CoupleState>("couple_gift");
}
export async function coupleSeen() {
  return call("couple_seen", {}, () => null);
}
// Living together (supabase/migrations/0149).
export async function cohabitAsk() {
  return call<CoupleState>("cohabit_ask");
}
export async function cohabitCancel() {
  return call<CoupleState>("cohabit_cancel");
}
export async function cohabitAnswer(askId: number, yes: boolean) {
  return call<CoupleState>("cohabit_answer", { p_ask: askId, p_yes: yes });
}
export async function cohabitLeave() {
  return call<CoupleState>("cohabit_leave");
}
export async function cohabitHang() {
  return call<CoupleState>("cohabit_hang");
}
export async function cohabitHome() {
  return call<CohabitHome | null>("cohabit_home");
}
