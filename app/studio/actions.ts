"use server";

import type { Arc, Status } from "@/lib/stories";
import { applyBeatText, parseArcs, studioError, type Admin, type BeatText, type Review, type CastLine, type NewsAdminItem, type HuntAdmin, type ContentDraft, type GossipAdmin, type GossipFileCheck, type SetupCheckRow, type StudioArc, type StudioMetrics, type StudioReport, type StudioResult } from "@/lib/studio";
import { validateArcs } from "@/lib/storyValidation";
import { validateNewsWeek } from "@/lib/news";
import { storyPlaceIds, validateHunt } from "@/lib/hunts";
import { readContentDrafts } from "@/lib/contentDrafts";
import { checkGossipFiles, syncGossipWeeks } from "@/lib/gossipImport";
import { syncWeeklyContent } from "@/lib/contentImport";
import { getServerSupabase } from "@/lib/supabase/server";
import { runSetupCheck } from "@/lib/setupCheck";
import type { PlayerFilter, PlayerList, PlayerProfile, PlayerSort } from "@/lib/adminPlayers";
import type { Insights } from "@/lib/insights";
import type { ShoutoutAction, StudioShoutoutDay } from "@/lib/radio";
import { TV, type StudioBigScreen, type StudioTvSubmission, type TvAction } from "@/lib/cloutTv";
import { headers } from "next/headers";

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

/** Go live now (migration 0080): approved, and today is Day 1. */
export async function studioGoLive(arc: string) {
  return run("admin_story_go_live", { p_arc: arc }, "Live. Today is Day 1: players see it on their next refresh.");
}

export async function studioStatus(arc: string, status: Status) {
  return run("admin_story_status", { p_arc: arc, p_status: status }, status === "active" ? "Resumed." : status === "paused" ? "Paused. Players stop seeing it until it resumes." : "Retired.");
}

export async function studioBeatStatus(arc: string, beat: string, status: Status) {
  return run("admin_beat_status", { p_arc: arc, p_beat: beat, p_status: status }, `Beat ${beat} is ${status}.`);
}

/** The Studio's order of stories (migration 0071). */
export async function studioReorder(ids: string[]) {
  return run("admin_story_reorder", { p_ids: ids }, "Order saved.");
}

/** A beat's words only (migration 0071): checked like a file, and the story keeps its approval. */
export async function studioBeatEdit(arcId: string, beatId: string, text: BeatText): Promise<StudioResult> {
  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, error: "Accounts aren't switched on yet." };
  const current = await list(supabase);
  if (!current.ok) return current;
  const arcs: Arc[] = [];
  for (const a of current.arcs) {
    const { data } = await supabase.rpc("admin_story_get", { p_arc: a.id });
    if (data) arcs.push(data as Arc);
  }
  const arc = arcs.find((a) => a.id === arcId);
  const beat = arc?.beats.find((b) => b.id === beatId);
  if (!arc || !beat) return { ok: false, error: "That beat doesn't exist." };
  const r = applyBeatText(beat, text);
  if (!r.ok) return { ok: false, error: r.error };
  const edited = { ...arc, beats: arc.beats.map((b) => (b.id === beatId ? r.beat : b)) };
  const problems = validateArcs(arcs.map((a) => (a.id === arcId ? edited : a))).filter((p) => p.startsWith(`${arcId}:`) || !p.includes(":"));
  if (problems.length) return { ok: false, error: `The edit has ${problems.length} problem${problems.length === 1 ? "" : "s"}. Nothing was saved.`, problems };
  return run("admin_beat_edit", { p_arc: arcId, p_beat: beatId, p_data: r.beat }, `Saved beat ${beatId}.`);
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
  if (error) return { ok: false, error: /function .* does not exist|schema cache/i.test(error.message) ? (fn.includes("npc") ? "Run migration 0016 first." : fn.includes("gossip") ? "Run migration 0034 first." : fn.includes("news") ? "Run migration 0017 first." : fn.includes("hunt") ? ("p_note" in args ? "Run migration 0019 first." : "Run migration 0018 first.") : fn.includes("insights") ? "Run migration 0053 first." : fn.includes("admin_player") ? "Run migration 0055 first." : fn.includes("shoutout") ? "Run migration 0057 first." : fn.includes("big_screen") ? "Run migration 0058 first." : "Run migration 0010 first.") : studioError(error.message) };
  return { ok: true, data: data as T };
}
export async function studioReports(status: "open" | "all") {
  return admin<StudioReport[]>("admin_reports", { p_status: status });
}
export async function studioReportAction(id: number, action: "dismiss" | "warn" | "mute" | "ban") {
  const r = await admin<unknown>("admin_report_action", { p_report: id, p_action: action });
  return r.ok ? { ok: true as const, data: null } : r;
}
// ---- Real Clout FM shoutouts (migration 0057) ----
export async function studioShoutouts(date?: string) {
  return admin<StudioShoutoutDay>("admin_shoutouts", { p_date: date ?? null });
}
export async function studioShoutoutAction(id: number, action: ShoutoutAction) {
  return admin<StudioShoutoutDay>("admin_shoutout_action", { p_id: id, p_action: action });
}
// ---- Clout TV's Big Screen queue (migration 0058): photos signed with the admin's own session ----
export async function studioBigScreen(status: "pending" | "approved" | "featured" | "all") {
  const r = await admin<Omit<StudioBigScreen, "items"> & { items: Omit<StudioTvSubmission, "url">[] }>("admin_big_screen", { p_status: status });
  if (!r.ok) return r;
  const supabase = (await getServerSupabase())!;
  const paths = r.data.items.map((x) => x.photo);
  const { data } = paths.length ? await supabase.storage.from(TV.bucket).createSignedUrls(paths, 60 * 60) : { data: [] };
  const urls = new Map((data ?? []).map((d) => [d.path, d.signedUrl]));
  return { ok: true as const, data: { ...r.data, items: r.data.items.map((x) => ({ ...x, url: urls.get(x.photo) ?? null })) } };
}
export async function studioBigScreenAction(id: number, action: TvAction) {
  const r = await admin<unknown>("admin_big_screen_action", { p_id: id, p_action: action });
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
// ---- City News (migration 0017) ----
export async function studioNewsList() {
  // Test phase: the repo's news and hunts publish themselves; load them now (admins only, the list checks).
  const first = await admin<NewsAdminItem[]>("admin_news_list");
  if (!first.ok) return first;
  await syncWeeklyContent({ force: true }).catch(() => []);
  return admin<NewsAdminItem[]>("admin_news_list");
}
export async function studioNewsUpload(json: string): Promise<Admin<number> & { problems?: string[] }> {
  let raw: unknown;
  try { raw = JSON.parse(json); } catch { return { ok: false, error: "That isn't valid JSON." }; }
  const checked = validateNewsWeek(raw);
  if (!checked.ok) return { ok: false, error: "The week didn't pass its checks.", problems: checked.problems };
  return admin<number>("admin_news_upsert", { p_items: checked.items });
}
export async function studioNewsStatus(id: string, status: NewsAdminItem["status"]) {
  const r = await admin<unknown>("admin_news_status", { p_id: id, p_status: status });
  return r.ok ? { ok: true as const, data: null } : r;
}
export async function studioNewsReschedule(id: string, day: string) {
  const r = await admin<unknown>("admin_news_reschedule", { p_id: id, p_day: day });
  return r.ok ? { ok: true as const, data: null } : r;
}
// ---- Treasure hunts (migration 0018) ----
export async function studioHuntList() {
  const first = await admin<HuntAdmin[]>("admin_hunt_list");
  if (!first.ok) return first;
  await syncWeeklyContent({ force: true }).catch(() => []);
  return admin<HuntAdmin[]>("admin_hunt_list");
}
export async function studioHuntUpload(json: string): Promise<Admin<null> & { problems?: string[] }> {
  let raw: unknown;
  try { raw = JSON.parse(json); } catch { return { ok: false, error: "That isn't valid JSON." }; }
  const week = (raw as { week?: unknown } | null)?.week;
  // Story safety: places touched by any approved, scheduled story that runs during the hunt's week.
  const storyPlaces: string[] = [];
  const arcs = await admin<{ id: string; status: string; review: string; startAt: string | null; lastDay: number }[]>("admin_story_list");
  if (arcs.ok && typeof week === "string") {
    const end = new Date(`${week}T12:00:00Z`);
    end.setUTCDate(end.getUTCDate() + 6);
    for (const a of arcs.data) {
      if (!a.startAt || a.status !== "active" || a.review !== "approved") continue;
      const last = new Date(`${a.startAt}T12:00:00Z`);
      last.setUTCDate(last.getUTCDate() + Math.max(0, a.lastDay - 1));
      if (a.startAt > end.toISOString().slice(0, 10) || last.toISOString().slice(0, 10) < week) continue;
      const full = await admin<Arc>("admin_story_get", { p_arc: a.id });
      if (full.ok && full.data) storyPlaces.push(...storyPlaceIds(full.data as unknown as Parameters<typeof storyPlaceIds>[0]));
    }
  }
  const checked = validateHunt(raw, { storyPlaces });
  if (!checked.ok) return { ok: false, error: "The hunt didn't pass its checks.", problems: checked.problems };
  const r = await admin<unknown>("admin_hunt_upsert", { p_data: checked.hunt });
  return r.ok ? { ok: true as const, data: null } : r;
}
export async function studioHuntStatus(id: string, status: HuntAdmin["status"], note?: string) {
  // Without a note this works before migration 0019 too.
  const r = await admin<unknown>("admin_hunt_status", note ? { p_id: id, p_status: status, p_note: note } : { p_id: id, p_status: status });
  return r.ok ? { ok: true as const, data: null } : r;
}
// ---- Gossip (migration 0034): automatic. Week files in the repo go live on their own; the Studio
// shows each week in full, its file checks, and lets the owner pause it or hold it with a note. ----
export async function studioGossipList(): Promise<Admin<{ weeks: GossipAdmin[]; files: GossipFileCheck[] }>> {
  // Admins only (the list checks), then load the repo's files now rather than waiting for the game.
  const first = await admin<GossipAdmin[]>("admin_gossip_list");
  if (!first.ok) return first;
  await syncGossipWeeks({ force: true });
  const [{ checks }, r] = await Promise.all([checkGossipFiles(), admin<GossipAdmin[]>("admin_gossip_list")]);
  return r.ok ? { ok: true, data: { weeks: r.data, files: checks } } : r;
}
export async function studioGossipStatus(week: string, status: GossipAdmin["status"], note?: string): Promise<Admin<null>> {
  const r = await admin<unknown>("admin_gossip_status", { p_week: week, p_status: status, p_note: note ?? null });
  return r.ok ? { ok: true as const, data: null } : r;
}

// ---- Calendar: week files in the repo (admins only: hunt files carry answers) ----
export async function studioDrafts(): Promise<Admin<ContentDraft[]>> {
  const gate = await admin<boolean>("is_story_admin");
  if (!gate.ok) return gate;
  if (!gate.data) return { ok: false, error: "This account isn't a story admin." };
  return { ok: true, data: await readContentDrafts() };
}
export async function studioMetrics() {
  return admin<StudioMetrics>("admin_metrics");
}
/** Insights (migration 0053): players, revenue, sessions, retention, funnel, features and spending. */
export async function studioPlayers(query: string, filter: PlayerFilter, sort: PlayerSort, offset: number) {
  return admin<PlayerList>("admin_players", { p_query: query, p_filter: filter, p_sort: sort, p_limit: 50, p_offset: offset });
}
export async function studioPlayer(id: string) {
  return admin<PlayerProfile>("admin_player", { p_player: id });
}
export async function studioPlayerBan(id: string, ban: boolean, reason: string) {
  return admin<{ banned: boolean }>("admin_player_ban", { p_player: id, p_ban: ban, p_reason: reason });
}
export async function studioInsights(days: number) {
  return admin<Insights>("admin_insights", { p_days: days });
}

// ---- Setup check (owner, Oct 14): admins only; reports what's missing, never a secret ----
export async function studioSetupCheck(): Promise<Admin<SetupCheckRow[]>> {
  const gate = await admin<unknown>("admin_story_list");
  if (!gate.ok) return gate;
  const h = await headers();
  const origin = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "") || `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
  try {
    return { ok: true, data: await runSetupCheck(origin) };
  } catch (e) {
    return { ok: false, error: `The check itself failed: ${e instanceof Error ? e.message : String(e)}` };
  }
}
