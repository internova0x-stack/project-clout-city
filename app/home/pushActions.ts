"use server";

import type { PushPrefs, PushResult } from "@/lib/pushClient";
import { cityError } from "@/lib/cityState";
import { kickPush } from "@/lib/pushServer";
import { getServerSupabase } from "@/lib/supabase/server";

// Push notifications (migration 0078): this device's subscription, the category switches and "Send a test".

async function call<T>(fn: string, args: Record<string, unknown> = {}): Promise<PushResult<T>> {
  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, error: "Accounts aren't switched on yet." };
  const { data, error } = await supabase.rpc(fn, args);
  if (error) {
    if (!/^[a-z_]+(:|$)/.test(error.message)) console.error(`${fn} failed`, error);
    return { ok: false, error: cityError(error.message) };
  }
  return { ok: true, data: data as T };
}

export async function pushPrefs() { return call<PushPrefs>("push_prefs_get"); }
export async function pushSubscribe(sub: { endpoint: string; p256dh: string; auth: string }, tz: string) {
  const r = await call<null>("push_subscribe", { p_endpoint: sub.endpoint, p_p256dh: sub.p256dh, p_auth: sub.auth, p_tz: tz });
  return r.ok ? { ok: true as const, data: null } : r;
}
export async function pushUnsubscribe(endpoint: string) {
  const r = await call<null>("push_unsubscribe", { p_endpoint: endpoint });
  return r.ok ? { ok: true as const, data: null } : r;
}
export async function pushSetOff(off: string[]) { return call<PushPrefs>("push_prefs_set", { p_off: off }); }
export async function pushAsked() { return call<PushPrefs>("push_prefs_set", { p_off: null, p_asked: true }); }
/** Queues a test push and sends it at once (the sender runs for this player only). */
export async function pushTest() {
  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false as const, error: "Accounts aren't switched on yet." };
  const r = await call<null>("push_test");
  if (!r.ok) return r;
  const { data } = await supabase.auth.getUser();
  if (data.user) await kickPush(data.user.id);
  return { ok: true as const, data: null };
}
