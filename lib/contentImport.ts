// Test phase (owner, Oct 14): news weeks and treasure hunts go live on their own, like gossip (and, v0.15, campus exam
// weeks from content/exams, migration 0077). The
// game server reads every week file in content/news and content/hunts, checks it with the Studio's
// rules (lib/news.ts, lib/hunts.ts, story safety included) and stores it approved with
// content_import_news() / content_import_hunt() (migration 0037, service role only). The Studio still
// lists everything and can pause an item or a hunt. Server only: hunt files carry the answers.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { storyPlaceIds, validateHunt } from "./hunts";
import { validateNewsWeek } from "./news";
import { validateExamWeek } from "./exams";
import { loadArcs } from "./storyContent";
import { validateArcs } from "./storyValidation";
import { getAdminSupabase } from "./supabase/admin";

const EVERY_MS = 10 * 60_000;
let lastRun = 0;

async function weekFiles(kind: "hunts" | "news" | "exams"): Promise<{ file: string; raw: unknown }[]> {
  const dir = path.join(process.cwd(), "content", kind);
  const files = (await readdir(dir).catch(() => [] as string[])).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
  const out: { file: string; raw: unknown }[] = [];
  for (const file of files) {
    try { out.push({ file: `content/${kind}/${file}`, raw: JSON.parse(await readFile(path.join(dir, file), "utf8")) }); } catch { /* the Studio's checks report it */ }
  }
  return out;
}

/** Stores the repo's news weeks and hunts (at most every 10 minutes per server, or now with `force`). */
export async function syncWeeklyContent(opts: { force?: boolean } = {}): Promise<{ file: string; result: string }[]> {
  const now = Date.now();
  if (!opts.force && now - lastRun < EVERY_MS) return [];
  lastRun = now;
  const admin = getAdminSupabase();
  if (!admin) return [];
  let storyPlaces: string[] = [];
  try { storyPlaces = loadArcs().flatMap((a) => storyPlaceIds(a as unknown as Parameters<typeof storyPlaceIds>[0])); } catch { /* no stories */ }
  const out: { file: string; result: string }[] = [];
  const missing = (msg: string) => /does not exist|schema cache/i.test(msg);
  for (const { file, raw } of await weekFiles("news")) {
    const r = validateNewsWeek(raw);
    if (!r.ok) { out.push({ file, result: `skipped: ${r.problems[0]}` }); continue; }
    const { data, error } = await admin.rpc("content_import_news", { p_items: r.items });
    // Before migration 0037 runs, the function is missing: try again on the next run.
    if (error) { if (missing(error.message)) { lastRun = 0; return out; } out.push({ file, result: `error: ${error.message}` }); continue; }
    out.push({ file, result: `${data} items` });
  }
  for (const { file, raw } of await weekFiles("hunts")) {
    const r = validateHunt(raw, { storyPlaces });
    if (!r.ok) { out.push({ file, result: `skipped: ${r.problems[0]}` }); continue; }
    const { data, error } = await admin.rpc("content_import_hunt", { p_data: r.hunt });
    if (error) { if (missing(error.message)) { lastRun = 0; return out; } out.push({ file, result: `error: ${error.message}` }); continue; }
    out.push({ file, result: String(data) });
  }
  // v0.15 campus exams (migration 0077): each week's questions; a course already sat that week keeps its set.
  for (const { file, raw } of await weekFiles("exams")) {
    const r = validateExamWeek(raw);
    if (!r.ok) { out.push({ file, result: `skipped: ${r.problems[0]}` }); continue; }
    const { data, error } = await admin.rpc("content_import_exams", { p_week: r.week, p_rows: r.rows });
    if (error) { if (missing(error.message)) { lastRun = 0; return out; } out.push({ file, result: `error: ${error.message}` }); continue; }
    out.push({ file, result: `${data} questions` });
  }
  // Culture pack C6 (migration 0098): a story file the Studio doesn't have yet waits there for review. Stories the Studio
  // already has are never touched (edits go through the Studio's upload; approving and Day 1 stay the owner's).
  let arcs: ReturnType<typeof loadArcs> = [];
  try { arcs = loadArcs(); } catch { /* no story files */ }
  const problems = validateArcs(arcs);
  for (const arc of arcs) {
    const file = `content/stories/${arc.id}.json`;
    const mine = problems.find((p) => p.startsWith(`${arc.id}:`));
    if (mine) { out.push({ file, result: `skipped: ${mine}` }); continue; }
    const { data, error } = await admin.rpc("content_import_story", { p_data: arc });
    if (error) { if (missing(error.message)) { lastRun = 0; return out; } out.push({ file, result: `error: ${error.message}` }); continue; }
    out.push({ file, result: String(data) });
  }
  return out;
}
