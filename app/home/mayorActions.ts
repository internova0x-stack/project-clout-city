"use server";

import { headers } from "next/headers";
import { deviceLine, mayorError, type LetterKind, type MayorResult, type MayorState } from "@/lib/mayor";
import { getServerSupabase } from "@/lib/supabase/server";

// Contact the Mayor (migration 0105). The browser sends what the letter is about and its text; the server adds the
// device (from the request, never typed) and the database adds where the player was.

async function call<T>(fn: string, args: Record<string, unknown> = {}): Promise<MayorResult<T>> {
  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, error: "Accounts aren't switched on yet." };
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return { ok: false, error: mayorError(error.message) };
  return { ok: true, data: data as T };
}

export async function mayorState() {
  return call<MayorState>("mayor_letters_state");
}
export async function mayorWrite(kind: LetterKind, message: string) {
  const device = deviceLine((await headers()).get("user-agent"));
  return call<MayorState>("mayor_write", { p_kind: kind, p_message: message, p_device: device });
}
export async function mayorSeen() {
  return call<null>("mayor_seen");
}
