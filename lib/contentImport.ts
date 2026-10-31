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
import { readAutopilot } from "./autopilot";
import { validateStoryletWeek } from "./storyletWeeks";
import { validateUnderworldWeek } from "./underworldWeeks";
import { UNDERWORLD_CONTENT } from "./underworldContent";
import type { Job } from "./underworld";
import { validateConditionWeek, validateReactions, type ReactionRule } from "./cityConditions";
import REACTIONS from "../content/city/reactions.json";
import { PLACES } from "./city";
import { CHOICE_CARDS, CHOICE_KNOWN } from "./choicesContent";
import type { ChoiceCard } from "./choices";
import { learnWeights, LEARNING, type CardStats } from "./cardLearning";

const EVERY_MS = 10 * 60_000;
let lastRun = 0;

async function weekFiles(kind: "hunts" | "news" | "exams" | "storylets" | "conditions" | "underworld-weeks"): Promise<{ file: string; raw: unknown }[]> {
  const dir = path.join(process.cwd(), "content", kind);
  const files = (await readdir(dir).catch(() => [] as string[])).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
  const out: { file: string; raw: unknown }[] = [];
  for (const file of files) {
    try { out.push({ file: `content/${kind}/${file}`, raw: JSON.parse(await readFile(path.join(dir, file), "utf8")) }); } catch { /* the Studio's checks report it */ }
  }
  return out;
}

/** Story files that didn't load into the Studio (skipped by its checks, an error, a missing migration), said plainly. */
export function storyImportTrouble(results: { file: string; result: string }[]): string | null {
  const bad = results.filter((r) => r.file.startsWith("content/stories/") && !/^(kept|added|started)/.test(r.result));
  return bad.length ? `These story files didn't load: ${bad.map((r) => `${r.file} (${r.result})`).join("; ")}` : null;
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
  // A kind whose migration hasn't run yet is skipped (and retried next run); the others, stories included, still load.
  const missing = (msg: string) => /does not exist|schema cache/i.test(msg);
  // Autopilot (migration 0107): a paused kind waits for the Studio. Before 0107 every kind is on.
  const auto = readAutopilot((await admin.from("game_settings").select("value").eq("key", "autopilot").maybeSingle()).data?.value);
  for (const { file, raw } of auto.news ? await weekFiles("news") : []) {
    const r = validateNewsWeek(raw);
    if (!r.ok) { out.push({ file, result: `skipped: ${r.problems[0]}` }); continue; }
    const { data, error } = await admin.rpc("content_import_news", { p_items: r.items });
    // Before migration 0037 runs, the function is missing: try again on the next run.
    if (error) { if (missing(error.message)) { lastRun = 0; out.push({ file, result: "waiting for its migration" }); break; } out.push({ file, result: `error: ${error.message}` }); continue; }
    out.push({ file, result: `${data} items` });
  }
  for (const { file, raw } of auto.hunts ? await weekFiles("hunts") : []) {
    const r = validateHunt(raw, { storyPlaces });
    if (!r.ok) { out.push({ file, result: `skipped: ${r.problems[0]}` }); continue; }
    const { data, error } = await admin.rpc("content_import_hunt", { p_data: r.hunt });
    if (error) { if (missing(error.message)) { lastRun = 0; out.push({ file, result: "waiting for its migration" }); break; } out.push({ file, result: `error: ${error.message}` }); continue; }
    out.push({ file, result: String(data) });
  }
  // v0.15 campus exams (migration 0077): each week's questions; a course already sat that week keeps its set.
  for (const { file, raw } of await weekFiles("exams")) {
    const r = validateExamWeek(raw);
    if (!r.ok) { out.push({ file, result: `skipped: ${r.problems[0]}` }); continue; }
    const { data, error } = await admin.rpc("content_import_exams", { p_week: r.week, p_rows: r.rows });
    if (error) { if (missing(error.message)) { lastRun = 0; out.push({ file, result: "waiting for its migration" }); break; } out.push({ file, result: `error: ${error.message}` }); continue; }
    out.push({ file, result: `${data} questions` });
  }
  // Content Engine step 3 (migration 0139): each week's new storylets arrive scheduled, live 24 hours later unless the
  // Studio vetoes them (paused while their autopilot is off). A card already stored keeps the Studio's decision.
  let seen: ChoiceCard[] = [...CHOICE_CARDS];
  for (const { file, raw } of await weekFiles("storylets")) {
    const r = validateStoryletWeek(raw, { others: seen, known: CHOICE_KNOWN });
    if (!r.ok) { out.push({ file, result: `skipped: ${r.problems[0]}` }); continue; }
    seen = [...seen, ...r.week.cards];
    const { data, error } = await admin.rpc("content_import_storylets", { p_week: r.week.week, p_cards: r.week.cards });
    if (error) { if (missing(error.message)) { out.push({ file, result: "waiting for its migration" }); break; } out.push({ file, result: `error: ${error.message}` }); continue; }
    out.push({ file, result: `${data} new storylets` });
  }
  // The underworld, part 2 (migration 0150): each week's new jobs for Pablo arrive like storylets (live 24 hours later
  // unless vetoed in Studio → Storylets → Pablo's jobs; held while the storylets autopilot is off).
  {
    let jobsSeen: Job[] = [];
    for (const { file, raw } of await weekFiles("underworld-weeks")) {
      const r = validateUnderworldWeek(raw, UNDERWORLD_CONTENT, jobsSeen);
      if (!r.ok) { out.push({ file, result: `skipped: ${r.problems[0]}` }); continue; }
      jobsSeen = [...jobsSeen, ...r.week.jobs];
      const { data, error } = await admin.rpc("content_import_underworld", { p_week: r.week.week, p_jobs: r.week.jobs });
      if (error) { if (missing(error.message)) { out.push({ file, result: "waiting for its migration" }); break; } out.push({ file, result: `error: ${error.message}` }); continue; }
      out.push({ file, result: `${data} new jobs for Pablo` });
    }
  }
  // Content Engine step 4 (migration 0140): the week's city conditions arrive like storylets (live 24 hours later unless
  // vetoed); then the city storylets fire any reaction whose tally has crossed its line.
  const known = { tags: [...new Set(PLACES.flatMap((p) => p.tags ?? []))], places: PLACES.map((p) => p.id) };
  let condIds: string[] = [];
  let condMissing = false;
  for (const { file, raw } of await weekFiles("conditions")) {
    const r = validateConditionWeek(raw, known, condIds);
    if (!r.ok) { out.push({ file, result: `skipped: ${r.problems[0]}` }); continue; }
    condIds = [...condIds, ...r.week.conditions.map((c) => c.id)];
    const { data, error } = await admin.rpc("content_import_conditions", { p_week: r.week.week, p_items: r.week.conditions });
    if (error) { if (missing(error.message)) { condMissing = true; out.push({ file, result: "waiting for its migration" }); break; } out.push({ file, result: `error: ${error.message}` }); continue; }
    out.push({ file, result: `${data} new city conditions` });
  }
  if (!condMissing && validateReactions(REACTIONS as ReactionRule[], known).length === 0) {
    const { data, error } = await admin.rpc("city_react", { p_rules: REACTIONS });
    if (!error && Array.isArray(data) && data.length) out.push({ file: "content/city/reactions.json", result: `fired: ${data.join(", ")}` });
  }
  // Content Engine step 6 (migration 0141): once a New York day, the cards' last 28 days become their weights.
  const due = await admin.rpc("card_learning_due");
  if (!due.error && due.data === true) {
    const st = await admin.rpc("card_stats", { p_days: LEARNING.windowDays });
    if (!st.error && Array.isArray(st.data)) {
      const options = Object.fromEntries(seen.map((c) => [c.id, c.options.length]));
      const rows = learnWeights(st.data as CardStats[], options);
      const { data, error } = await admin.rpc("card_weights_auto", { p_rows: rows });
      out.push({ file: "card learning", result: error ? `error: ${error.message}` : `${data} card weights` });
    }
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
  // Autopilot (migration 0107): when no story is running or scheduled, the next one in the Studio's list starts today.
  if (auto.stories) {
    const { data, error } = await admin.rpc("story_autopilot");
    if (!error && data) out.push({ file: `content/stories/${data}.json`, result: "started today (autopilot)" });
  }
  return out;
}
