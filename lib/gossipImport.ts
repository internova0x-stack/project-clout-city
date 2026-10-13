// Gossip weeks go live on their own (owner, Oct 13): the game server reads every week file in
// content/gossip/, checks it with the Studio's rules (lib/gossip.ts) and stores it with
// gossip_import() (migration 0034, service role only). A stored week is live from its Monday unless
// the owner pauses it or holds it with a note in the Studio. Server only: the files hold every piece.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { answerWords, validateGossipWeek } from "./gossip";
import { storyPlaceIds } from "./hunts";
import { loadArcs } from "./storyContent";
import { getAdminSupabase } from "./supabase/admin";
import type { GossipFileCheck } from "./studio";

const EVERY_MS = 10 * 60_000;
let lastRun = 0;


/** Checks every file in content/gossip with the Studio's rules, story safety included. */
export async function checkGossipFiles(): Promise<{ checks: GossipFileCheck[]; weeks: { week: string; data: unknown }[] }> {
  const dir = path.join(process.cwd(), "content", "gossip");
  const files = (await readdir(dir).catch(() => [] as string[])).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
  // Story safety, kept simple and strict: no piece at any story's places, no word of any story's answer.
  let storyPlaces: string[] = [];
  let forbidden: string[] = [];
  try {
    const arcs = loadArcs();
    storyPlaces = arcs.flatMap((a) => storyPlaceIds(a as unknown as Parameters<typeof storyPlaceIds>[0]));
    forbidden = arcs.flatMap((a) => answerWords(a.answer_key));
  } catch { /* no story files: nothing to protect */ }
  const checks: GossipFileCheck[] = [];
  const weeks: { week: string; data: unknown }[] = [];
  for (const file of files) {
    let raw: unknown = null;
    try { raw = JSON.parse(await readFile(path.join(dir, file), "utf8")); } catch { /* reported below */ }
    const r = raw ? validateGossipWeek(raw, { storyPlaces, forbidden }) : { ok: false as const, problems: ["Not valid JSON."] };
    const week = file.slice(0, 10);
    if (r.ok && r.week.week !== week) {
      checks.push({ week, file: `content/gossip/${file}`, ok: false, problems: [`the file says week ${r.week.week}; name it ${r.week.week}.json`], stories: 0 });
      continue;
    }
    checks.push({ week, file: `content/gossip/${file}`, ok: r.ok, problems: r.ok ? [] : r.problems, stories: r.ok ? r.week.stories.length : 0 });
    if (r.ok) weeks.push({ week, data: r.week });
  }
  return { checks, weeks };
}

/** Stores the repo's gossip weeks (at most every 10 minutes per server, or now with `force`). */
export async function syncGossipWeeks(opts: { force?: boolean } = {}): Promise<{ week: string; result: string }[]> {
  const now = Date.now();
  if (!opts.force && now - lastRun < EVERY_MS) return [];
  lastRun = now;
  const admin = getAdminSupabase();
  if (!admin) return [];
  const { weeks } = await checkGossipFiles();
  const out: { week: string; result: string }[] = [];
  for (const w of weeks) {
    const { data, error } = await admin.rpc("gossip_import", { p_data: w.data });
    // Before migration 0034 runs, the function is missing: try again on the next run.
    if (error) { if (/does not exist|schema cache/i.test(error.message)) { lastRun = 0; return out; } out.push({ week: w.week, result: `error: ${error.message}` }); continue; }
    out.push({ week: w.week, result: String(data) });
  }
  return out;
}
