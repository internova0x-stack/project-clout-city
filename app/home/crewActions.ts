"use server";

import { crewError, type CrewInbox, type CrewPerson, type CrewResult } from "@/lib/crew";
import { getServerSupabase } from "@/lib/supabase/server";

// Server actions behind crew outings. Each calls one SQL function
// (supabase/migrations/0013), which checks the crew, the activity and the limits.

async function call<T>(fn: string, args: Record<string, unknown> = {}, map: (d: unknown) => T = (d) => d as T): Promise<CrewResult<T>> {
  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, error: "Accounts aren't switched on yet." };
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return { ok: false, error: crewError(error.message) };
  return { ok: true, data: map(data) };
}

export async function crewInbox() {
  return call<CrewInbox>("crew_inbox", {}, (d) => {
    const r = d as CrewInbox;
    return { outings: r.outings, clout: Number(r.clout) };
  });
}
export async function crewMembers() {
  return call<CrewPerson[]>("crew_members");
}
export async function crewCreate(kind: "place" | "event", placeId: string, activity: string, members: string[]) {
  return call("crew_outing_create", { p_kind: kind, p_place: placeId, p_activity: activity, p_members: members }, () => null);
}
export async function crewRespond(outingId: number, yes: boolean) {
  return call("crew_respond", { p_outing: outingId, p_yes: yes }, () => null);
}
