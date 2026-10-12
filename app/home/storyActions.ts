"use server";

import { storyError, type StoryFeed, type StoryResult } from "@/lib/storyFeed";
import { getServerSupabase } from "@/lib/supabase/server";

// Server actions for the News app and story world. Each calls one SQL function,
// then returns the player's fresh story feed (supabase/migrations/0007).

async function run(fn: string, args: Record<string, unknown>, clout?: (data: unknown) => number | undefined): Promise<StoryResult> {
  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, error: "Accounts aren't switched on yet." };
  let earned: number | undefined;
  if (fn) {
    const { data, error } = await supabase.rpc(fn, args);
    if (error) return { ok: false, error: storyError(error.message) };
    earned = clout?.(data);
  }
  const { data, error } = await supabase.rpc("story_feed");
  if (error || !data) return { ok: false, error: "The newsroom is closed on this server." };
  return { ok: true, feed: data as StoryFeed, clout: earned };
}

const taskClout = (d: unknown) => (Array.isArray(d) ? d.reduce((n, t) => n + (Number(t?.clout) || 0), 0) : undefined);

export async function refreshStory() {
  return run("", {});
}
export async function voteStory(predictionId: string, optionId: string) {
  return run("vote_prediction", { p_prediction: predictionId, p_option: optionId });
}
export async function shadowGuessStory(predictionId: string, optionId: string) {
  return run("shadow_guess", { p_prediction: predictionId, p_option: optionId });
}
export async function markBeatSeen(beatId: string) {
  return run("mark_beat_seen", { p_beat: beatId });
}
export async function completeStoryTask(taskId: string) {
  return run("complete_story_task", { p_task: taskId }, taskClout);
}
export async function attendStoryEvent(eventId: string) {
  return run("attend_story_event", { p_event: eventId }, (d) => Number((d as { clout?: number })?.clout) || undefined);
}
export async function devStartStory(day: number | null) {
  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false as const, error: "Accounts aren't switched on yet." };
  const { data: today } = await supabase.rpc("ny_today");
  const start = day === null ? null : new Date(Date.parse(`${today}T12:00:00Z`) - (day - 1) * 86_400_000).toISOString().slice(0, 10);
  return run("dev_story_start", { p_arc: "sarah-bird", p_start: start });
}
export async function devEntitleStory(sku: string, on: boolean) {
  return run("dev_grant_entitlement", { p_sku: sku, p_on: on });
}

/** Loads the feed for the home page; null when migration 0007 isn't applied yet. */
export async function loadStoryFeed(): Promise<StoryFeed | null> {
  const supabase = await getServerSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("story_feed");
  return error ? null : (data as StoryFeed);
}
