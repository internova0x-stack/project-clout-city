"use server";

import type { Arc, Status } from "@/lib/stories";
import { parseArcs, studioError, type Admin, type Review, type CastLine, type StudioArc, type StudioMetrics, type StudioReport, type StudioResult } from "@/lib/studio";
import { validateArcs } from "@/lib/storyValidation";
import { getServerSupabase } from "@/lib/supabase/server";

// Server actions behind the Story Studio. Every call goes through an admin_* SQL
// function, which checks story_admins itself, so these never trust the browser.

type Supabase = NonNullable<Awaited<ReturnType<typeof getServerSupabase>>>;

async function list(supabase: Supabase, message?: string): Promise<StudioResult> {
  const { data, error } = await supabase.rpc("admin_story_list");
  if (error) return { ok: false, error: studioError(error.message) };
  return { ok: true, arcs: (data ?? []) as StudioArc[], message };
}

async function run(fn: string, args: Record<string, unknown>, message: string): Promise<StudioResult> {
  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, error: "Accounts aren't switched on yet." };
  const { error } = await supabase.rpc(fn, args);
  if (error) return { ok: false, error: studioError(error.message) };
  return list(supabase, message);
}

export async function studioList(): Promise<StudioResult> {
  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, error: "Accounts aren't switched on yet." };
  return list(supabase);
}

export async function studioUpload(json: string): Promise<StudioResult> {
  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, error: "Accounts aren't switched on yet." };
  const parsed = parseArcs(json);
  if ("error" in parsed) return { ok: false, error: parsed.error };
  // Validate against everything already in the Studio, so side arcs can find their parent.
  const current = await list(supabase);
  if (!current.ok) return current;
  const uploaded = new Set(parsed.arcs.map((a) => a.id));
  const others: Arc[] = [];
  for (const a of current.arcs.filter((x) => !uploaded.has(x.id))) {
    const { data } = await supabase.rpc("admin_story_get", { p_arc: a.id });
    if (data) others.push(data as Arc);
  }
  const problems = validateArcs([...others, ...parsed.arcs]).filter((p) => !p.includes(":") || uploaded.has(p.split(":")[0]));
  if (problems.length) return { ok: false, error: `The file has ${problems.length} problem${problems.length === 1 ? "" : "s"}. Nothing was saved.`, problems };
  for (const arc of parsed.arcs) {
    const { error } = await supabase.rpc("admin_story_upsert", { p_data: arc });
    if (error) return { ok: false, error: `${arc.id}: ${studioError(error.message)}` };
  }
  return list(supabase, `Saved ${parsed.arcs.map((a) => a.title || a.id).join(", ")}. New or changed stories wait for approval.`);
}

export async function studioReview(arc: string, decision: Review, note: string) {
  const msg = decision === "approved" ? "Approved. It can be scheduled now." : decision === "declined" ? "Declined. The note is saved with it." : "Back to draft.";
  return run("admin_story_review", { p_arc: arc, p_decision: decision, p_note: note.trim() || null }, msg);
}

export async function studioSchedule(arc: string, start: string | null) {
  return run("admin_story_schedule", { p_arc: arc, p_start: start }, start ? `Scheduled: Day 1 is ${start}.` : "Unscheduled.");
}

export async function studioStatus(arc: string, status: Status) {
  return run("admin_story_status", { p_arc: arc, p_status: status }, status === "active" ? "Resumed." : status === "paused" ? "Paused. Players stop seeing it until it resumes." : "Retired.");
}

export async function studioBeatStatus(arc: string, beat: string, status: Status) {
  return run("admin_beat_status", { p_arc: arc, p_beat: beat, p_status: status }, `Beat ${beat} is ${status}.`);
}

export async function studioContent(arc: string): Promise<{ ok: true; arcs: Arc[] } | { ok: false; error: string }> {
  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, error: "Accounts aren't switched on yet." };
  const current = await list(supabase);
  if (!current.ok) return current;
  const ids = [arc, ...current.arcs.filter((a) => a.parent === arc).map((a) => a.id)];
  const arcs: Arc[] = [];
  for (const id of ids) {
    const { data, error } = await supabase.rpc("admin_story_get", { p_arc: id });
    if (error) return { ok: false, error: studioError(error.message) };
    const row = current.arcs.find((a) => a.id === id);
    if (data) arcs.push({ ...(data as Arc), status: row?.status ?? (data as Arc).status });
  }
  return { ok: true, arcs };
}

// ---- Chat review queue and metrics (migration 0010) ----
async function admin<T>(fn: string, args: Record<string, unknown> = {}): Promise<Admin<T>> {
  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, error: "Accounts aren't switched on yet." };
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return { ok: false, error: /function .* does not exist|schema cache/i.test(error.message) ? (fn.includes("npc") ? "Run migration 0016 first." : "Run migration 0010 first.") : studioError(error.message) };
  return { ok: true, data: data as T };
}
export async function studioReports(status: "open" | "all") {
  return admin<StudioReport[]>("admin_reports", { p_status: status });
}
export async function studioReportAction(id: number, action: "dismiss" | "warn" | "mute" | "ban") {
  const r = await admin<unknown>("admin_report_action", { p_report: id, p_action: action });
  return r.ok ? { ok: true as const, data: null } : r;
}
// ---- Regulars' lines (migration 0016) ----
export async function studioCastLines() {
  return admin<CastLine[]>("admin_npc_lines");
}
export async function studioCastAdd(npc: string, line: string, kind: "line" | "update", weekOf: string | null) {
  const r = await admin<unknown>("admin_npc_line_add", { p_npc: npc, p_line: line, p_kind: kind, p_week: weekOf });
  return r.ok ? { ok: true as const, data: null } : r;
}
export async function studioCastStatus(id: number, status: CastLine["status"]) {
  const r = await admin<unknown>("admin_npc_line_status", { p_id: id, p_status: status });
  return r.ok ? { ok: true as const, data: null } : r;
}
export async function studioMetrics() {
  return admin<StudioMetrics>("admin_metrics");
}
