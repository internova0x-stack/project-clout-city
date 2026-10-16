"use server";

import { radioError, type RadioResult, type RadioState, type Shoutout, type ShoutoutStatus } from "@/lib/radio";
import { getServerSupabase } from "@/lib/supabase/server";

// v0.14 Real Clout FM (migration 0057). The browser sends a handle and a message; the server checks,
// filters and caps them, and the owner decides what airs.

async function call<T>(fn: string, args: Record<string, unknown> = {}): Promise<RadioResult<T>> {
  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, error: "Accounts aren't switched on yet." };
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return { ok: false, error: radioError(error.message) };
  return { ok: true, data: data as T };
}

export async function radioState() {
  return call<RadioState>("radio_state");
}
export async function radioRequest(handle: string, message: string, confirmed: boolean) {
  return call<Shoutout & { status: ShoutoutStatus }>("radio_request", { p_handle: handle, p_message: message, p_confirmed: confirmed });
}
export async function radioReport(id: number, reason: string, note: string) {
  return call<null>("radio_report", { p_shoutout: id, p_reason: reason, p_note: note });
}
