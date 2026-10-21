// Checks every week file in content/hunts/, content/news/, content/gossip/ and content/exams/ with the same rules the
// Studio uses (lib/hunts.ts, lib/news.ts, lib/gossip.ts), plus: each hunt week has a Monday hunt
// announcement in its news, and no gossip story id repeats across weeks.
// Culture pack C1: the culture files (content/culture/) follow their rules, and no file in content/ uses a real brand,
// team or trademarked name from content/culture/parody-names.json.
// The weekly drafting routine runs this before opening its pull request (docs/WEEKLY-CONTENT.md).
// Usage: npm run validate:content
import { readdirSync, readFileSync, statSync } from "node:fs";
import { validateHunt } from "../lib/hunts.ts";
import { validateNewsWeek } from "../lib/news.ts";
import { validateGossipWeek } from "../lib/gossip.ts";
import { validateExamWeek } from "../lib/exams.ts";
import { brandHits, validateCulture, type CultureData } from "../lib/culture.ts";
import { PLACES, boroughOf } from "../lib/city.ts";
import { REGULARS } from "../lib/cast.ts";

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
const gossipIds = new Map<string, string>();
for (const f of list("gossip/")) {
  const raw = JSON.parse(readFileSync(new URL(`gossip/${f}`, root), "utf8"));
  const r = validateGossipWeek(raw);
  if (!r.ok) { fail(`content/gossip/${f}`, r.problems); continue; }
  if (f !== `${raw.week}.json`) { fail(`content/gossip/${f}`, [`name the file after its week: ${raw.week}.json`]); continue; }
  const dup = r.week.stories.filter((s) => gossipIds.has(s.id)).map((s) => `stories: "${s.id}" was already used in ${gossipIds.get(s.id)}`);
  if (dup.length) { fail(`content/gossip/${f}`, dup); continue; }
  for (const s of r.week.stories) gossipIds.set(s.id, f);
  console.log(`✓ content/gossip/${f} (${r.week.stories.length} stories)`);
}
// v0.15 campus exams: five questions per course, a week per file.
for (const f of list("exams/")) {
  const raw = JSON.parse(readFileSync(new URL(`exams/${f}`, root), "utf8"));
  const r = validateExamWeek(raw);
  if (!r.ok) { fail(`content/exams/${f}`, r.problems); continue; }
  if (f !== `${raw.week}.json`) { fail(`content/exams/${f}`, [`name the file after its week: ${raw.week}.json`]); continue; }
  console.log(`✓ content/exams/${f} (${r.rows.length} questions)`);
}
// Culture pack C1: the slang, the invented names and Astoria's profiles.
const culture: CultureData = {
  slang: JSON.parse(readFileSync(new URL("culture/slang.json", root), "utf8")),
  parody: JSON.parse(readFileSync(new URL("culture/parody-names.json", root), "utf8")),
  npcs: JSON.parse(readFileSync(new URL("culture/npcs.json", root), "utf8")),
};
const astoria = PLACES.filter((p) => p.neighborhood === "Astoria" && boroughOf(p) === "queens").map((p) => p.id);
const cultureProblems = validateCulture(culture, { placeIds: PLACES.map((p) => p.id), astoria, regulars: REGULARS });
if (cultureProblems.length) fail("content/culture/", cultureProblems);
else console.log(`✓ content/culture/ (${culture.slang.terms.length} slang terms, ${culture.npcs.profiles.length} profiles, ${culture.parody.names.length} invented names)`);
// No real brand names anywhere in content/ (the invented-name list itself is the one place they're written down).
const walk = (dir: URL): string[] => readdirSync(dir).flatMap((f) => {
  const u = new URL(f, dir);
  return statSync(u).isDirectory() ? walk(new URL(`${f}/`, dir)) : f.endsWith(".json") ? [u.pathname] : [];
});
let brandFiles = 0;
for (const file of walk(root)) {
  if (file.endsWith("culture/parody-names.json")) continue;
  brandFiles++;
  const hits = brandHits(readFileSync(file, "utf8"), culture.parody.names);
  if (hits.length) fail(file.slice(file.indexOf("content/")), [`real names: ${[...new Set(hits)].join(", ")} (use the invented ones in content/culture/parody-names.json)`]);
}
console.log(`✓ no real brand names in ${brandFiles} content files`);
if (failed) process.exit(1);
