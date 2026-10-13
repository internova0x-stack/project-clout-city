"use server";

import type { HuntResult, HuntState } from "@/lib/hunts";
import { getServerSupabase } from "@/lib/supabase/server";

// Server actions behind treasure hunts. Each calls one SQL function (supabase/migrations/0018),
// which checks the week, the step, the visit and the wait. Answers never leave the database.

const ERRORS: Record<string, string> = {
  no_hunt: "There's no hunt this week. A new one starts Monday.",
  not_here: "They don't have anything for your hunt.",
  visit_first: "Stop in first, then ask.",
  wait: "Not yet. Give it ten minutes and try again.",
  no_player: "Finish making your character first.",
};

async function call(fn: string, args: Record<string, unknown> = {}): Promise<HuntResult> {
  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, error: "Accounts aren't switched on yet." };
  const { data, error } = await supabase.rpc(fn, args);
  if (error) {
    const code = (["not_here", "visit_first", "wait"] as const).find((c) => error.message.includes(c));
    const known = Object.keys(ERRORS).find((c) => error.message.includes(c));
    return { ok: false, code, error: known ? ERRORS[known] : "The hunt glitched. Try again." };
  }
  if (fn === "hunt_state" || fn === "hunt_join") return { ok: true, state: data as HuntState };
  const r = data as {
    state: HuntState; line?: { say: string; question?: { q: string; choices: string[] } | null };
    correct?: boolean; then?: string | null; reward?: { cash: number; clout: number; badge: boolean } | null;
  };
  const line = r.line ? { say: r.line.say, question: r.line.question ?? undefined } : r.then ? { say: r.then } : undefined;
  return { ok: true, state: r.state, line, correct: r.correct, reward: r.reward ?? undefined };
}

/** Before migration 0018 this fails, which hides hunts. */
export async function huntState() {
  return call("hunt_state");
}
export async function huntJoin() {
  return call("hunt_join");
}
export async function huntTalk(placeId: string) {
  return call("hunt_talk", { p_place: placeId });
}
export async function huntAnswer(choice: number) {
  return call("hunt_answer", { p_choice: choice });
}
