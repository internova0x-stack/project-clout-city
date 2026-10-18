"use server";

import type { AttendResult, CampusId, CampusResult, CampusState, ExamQuestion, Leaderboard, SubmitResult } from "@/lib/campus";
import { cityError } from "@/lib/cityState";
import { getServerSupabase } from "@/lib/supabase/server";

// v0.15 Campus (migration 0072). The server checks where the player is, what they're enrolled in and what's due;
// exam answers never leave it.

async function call<T>(fn: string, args: Record<string, unknown> = {}): Promise<CampusResult<T>> {
  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, error: "Accounts aren't switched on yet." };
  const { data, error } = await supabase.rpc(fn, args);
  if (error) {
    if (!/^[a-z_]+(:|$)/.test(error.message)) console.error(`${fn} failed`, error);
    return { ok: false, error: cityError(error.message) };
  }
  return { ok: true, data: data as T };
}

export async function campusState() { return call<CampusState>("campus_state"); }
export async function campusEnrol(campus: CampusId) { return call<CampusState>("campus_enrol", { p_campus: campus }); }
export async function campusPick(courses: string[]) { return call<CampusState>("campus_pick", { p_courses: courses }); }
export async function campusAttend(course: string) { return call<AttendResult>("campus_attend", { p_course: course }); }
export async function campusExam(course: string) { return call<ExamQuestion[]>("campus_exam", { p_course: course }); }
export async function campusSubmit(course: string, answers: number[], peek: boolean) {
  return call<SubmitResult>("campus_exam_submit", { p_course: course, p_answers: answers, p_peek: peek });
}
export async function campusEat() { return call<{ cash: number; energy: number }>("campus_eat"); }
export async function campusLeaderboard() { return call<Leaderboard>("campus_leaderboard"); }
