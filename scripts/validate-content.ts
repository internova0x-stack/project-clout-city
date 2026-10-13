// Checks every week file in content/hunts/ and content/news/ with the same rules the Studio uses
// (lib/hunts.ts, lib/news.ts), plus: each hunt week has a Monday hunt announcement in its news.
// The weekly drafting routine runs this before opening its pull request (docs/WEEKLY-CONTENT.md).
// Usage: npm run validate:content
import { readdirSync, readFileSync } from "node:fs";
import { validateHunt } from "../lib/hunts.ts";
import { validateNewsWeek } from "../lib/news.ts";

const root = new URL("../content/", import.meta.url);
const list = (dir: string) => readdirSync(new URL(dir, root)).filter((f) => f.endsWith(".json")).sort();
let failed = false;
const fail = (file: string, problems: string[]) => {
  failed = true;
  console.error(`✗ ${file}`);
  for (const p of problems) console.error(`    ${p}`);
};

const newsWeeks = new Map<string, { kind: string; day: string }[]>();
for (const f of list("news/")) {
  const raw = JSON.parse(readFileSync(new URL(`news/${f}`, root), "utf8"));
  const r = validateNewsWeek(raw);
  if (!r.ok) fail(`content/news/${f}`, r.problems);
  else if (f !== `${raw.week}.json`) fail(`content/news/${f}`, [`name the file after its week: ${raw.week}.json`]);
  else { newsWeeks.set(raw.week, r.items); console.log(`✓ content/news/${f} (${r.items.length} items)`); }
}
for (const f of list("hunts/")) {
  const raw = JSON.parse(readFileSync(new URL(`hunts/${f}`, root), "utf8"));
  const r = validateHunt(raw);
  if (!r.ok) { fail(`content/hunts/${f}`, r.problems); continue; }
  if (f !== `${raw.week}.json`) { fail(`content/hunts/${f}`, [`name the file after its week: ${raw.week}.json`]); continue; }
  const news = newsWeeks.get(raw.week);
  if (!news?.some((i) => i.kind === "hunt" && i.day === raw.week)) {
    fail(`content/hunts/${f}`, [`content/news/${raw.week}.json needs a Monday "hunt" item announcing "${raw.theme}"`]);
    continue;
  }
  console.log(`✓ content/hunts/${f} (${r.hunt.theme})`);
}
if (failed) process.exit(1);
