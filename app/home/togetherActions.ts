"use server";

import {
  togetherError, type JobHome, type JobsBoard, type RideStatus, type TogetherBonus, type TogetherInbox, type TogetherResult,
} from "@/lib/together";
import { getServerSupabase } from "@/lib/supabase/server";

// v0.13 Better Together (migration 0050). The browser names people, places and jobs; the server checks
// who may do what and sets every amount paid.

async function call<T>(fn: string, args: Record<string, unknown> = {}): Promise<TogetherResult<T>> {
  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, error: "Accounts aren't switched on yet." };
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return { ok: false, error: togetherError(error.message) };
  return { ok: true, data: data as T };
}

export async function togetherInbox() {
  return call<TogetherInbox>("together_inbox");
}
export async function togetherInvite(to: string, place: string, action: string) {
  return call<{ id: number }>("together_invite", { p_to: to, p_place: place, p_action: action });
}
export async function togetherRespond(id: number, yes: boolean) {
  return call<{ status: string }>("together_respond", { p_id: id, p_yes: yes });
}
export async function togetherClaim(id: number) {
  return call<TogetherBonus>("together_claim", { p_id: id });
}
export async function togetherSeen(id: number) {
  return call<null>("together_seen", { p_id: id });
}
export async function rideOffer(to: string, place: string, mode: "subway" | "taxi") {
  return call<{ id: number; fare: number; each: number }>("ride_offer", { p_to: to, p_place: place, p_mode: mode });
}
export async function rideRespond(id: number, yes: boolean) {
  return call<RideStatus>("ride_respond", { p_id: id, p_yes: yes });
}
export async function rideStatus(id: number) {
  return call<RideStatus | null>("ride_status", { p_id: id });
}

export async function jobsBoard() {
  return call<JobsBoard>("jobs_board");
}
export async function postJob(kind: "decorator" | "manager", pay: number, cut: number, note: string) {
  return call<{ id: number; cash: number }>("post_job", { p_kind: kind, p_pay: pay, p_cut: cut, p_note: note.slice(0, 140) });
}
export async function cancelJob(id: number) {
  return call<{ cash: number }>("cancel_job", { p_id: id });
}
export async function takeJob(id: number) {
  return call<{ id: number; kind: string }>("take_job", { p_id: id });
}
export async function jobHome(id: number) {
  return call<JobHome>("job_home", { p_id: id });
}
export async function decorateSave(id: number, layout: unknown) {
  return call<{ moved: number }>("decorate_save", { p_id: id, p_layout: layout });
}
export async function jobFinish(id: number) {
  return call<{ status: string }>("job_finish", { p_id: id });
}
export async function jobSettle(id: number, keep: boolean, stars: number | null) {
  return call<{ status: string; cash: number }>("job_settle", { p_id: id, p_keep: keep, p_stars: stars });
}
export async function rateJob(id: number, stars: number) {
  return call<null>("rate_job", { p_id: id, p_stars: stars });
}
export async function managerCollect(id: number) {
  return call<{ collected: number; cash: number }>("manager_collect", { p_id: id });
}
export async function endJob(id: number) {
  return call<{ status: string }>("end_job", { p_id: id });
}
// Migration 0151: game-verified jobs and rating the client.
export async function postTask(kind: "errand" | "event", pay: number, target: { places?: string[]; event?: string }, hours: number, note: string) {
  return call<{ id: number; cash: number; fee: number }>("post_task", { p_kind: kind, p_pay: pay, p_target: target, p_hours: hours, p_note: note.slice(0, 140) });
}
export async function jobCheck(id: number) {
  return call<{ status: string; progress: string[]; earned: number }>("job_check", { p_id: id });
}
export async function rateClient(id: number, stars: number) {
  return call<null>("rate_client", { p_id: id, p_stars: stars });
}
