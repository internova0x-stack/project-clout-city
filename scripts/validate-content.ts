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
import { validateCards } from "../lib/choices.ts";
import { validateStoryletWeek } from "../lib/storyletWeeks.ts";
import { contentProblems, type Job, type UnderworldContent } from "../lib/underworld.ts";
import { validateUnderworldWeek } from "../lib/underworldWeeks.ts";
import { validateConditionWeek, validateReactions } from "../lib/cityConditions.ts";
import { validateRemembers } from "../lib/characterMemory.ts";
import { faceProblems, gateProblems, type CardFace } from "../lib/cardFormat.ts";
import { validateCalendar } from "../lib/calendar.ts";
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
// Culture pack C5: the calendar of real-date events.
const calendar = JSON.parse(readFileSync(new URL("culture/calendar.json", root), "utf8"));
const calendarProblems = validateCalendar(calendar, PLACES.map((p) => p.id));
if (calendarProblems.length) fail("content/culture/calendar.json", calendarProblems);
else console.log(`✓ content/culture/calendar.json (${calendar.events.length} events)`);
// Moral Choices (migration 0131): every situation card follows lib/choices.ts's rules.
{
  const cards = list("choices/").flatMap((f) => JSON.parse(readFileSync(new URL(`choices/${f}`, root), "utf8")));
  const regulars = [...REGULARS.map((r) => r.id), ...culture.npcs.profiles.map((p) => p.id), ...((culture.npcs as { roommates?: { id: string }[] }).roommates ?? []).map((p) => p.id)];
  const problems = validateCards(cards, { places: PLACES.map((p) => p.id), tags: [...new Set(PLACES.flatMap((p) => p.tags ?? []))], npcs: regulars });
  if (problems.length) fail("content/choices/", problems);
  else console.log(`✓ content/choices/ (${cards.length} cards, ${new Set(cards.map((c: { base: string }) => c.base)).size} dilemmas)`);
  // Content Engine step 3 (migration 0139): the weekly storylets, checked alongside every card already in the game
  // and every earlier week (ids never repeat).
  let seen = [...cards];
  for (const f of list("storylets/")) {
    const raw = JSON.parse(readFileSync(new URL(`storylets/${f}`, root), "utf8"));
    const r = validateStoryletWeek(raw, { others: seen, known: { places: PLACES.map((p) => p.id), tags: [...new Set(PLACES.flatMap((p) => p.tags ?? []))], npcs: regulars } });
    const file = `content/storylets/${f}`;
    if (!r.ok) { fail(file, r.problems); continue; }
    if (`${r.week.week}.json` !== f) { fail(file, [`the file name must be its week (${r.week.week}.json)`]); continue; }
    seen = [...seen, ...r.week.cards];
    console.log(`✓ ${file} (${r.week.cards.length} storylets, ${new Set(r.week.cards.map((c) => c.family)).size} families)`);
  }
}
// The underworld (migrations 0148, 0150): Pablo's job file, then each week's new jobs beside it (ids never repeat).
{
  const base = JSON.parse(readFileSync(new URL("underworld/jobs.json", root), "utf8")) as UnderworldContent;
  const problems = contentProblems(base);
  if (problems.length) fail("content/underworld/jobs.json", problems);
  else console.log(`✓ content/underworld/jobs.json (${base.jobs.length} jobs, ${base.crew?.length ?? 0} crew)`);
  let seen: Job[] = [];
  for (const f of list("underworld-weeks/")) {
    const raw = JSON.parse(readFileSync(new URL(`underworld-weeks/${f}`, root), "utf8"));
    const r = validateUnderworldWeek(raw, base, seen);
    const file = `content/underworld-weeks/${f}`;
    if (!r.ok) { fail(file, r.problems); continue; }
    if (`${r.week.week}.json` !== f) { fail(file, [`the file name must be its week (${r.week.week}.json)`]); continue; }
    seen = [...seen, ...r.week.jobs];
    console.log(`✓ ${file} (${r.week.jobs.length} jobs for Pablo)`);
  }
}
// Content Engine step 4 (migration 0140): the weekly city conditions and the city storylets (reactions to the tallies).
{
  const known = { tags: [...new Set(PLACES.flatMap((p) => p.tags ?? []))], places: PLACES.map((p) => p.id) };
  let ids: string[] = [];
  for (const f of list("conditions/")) {
    const file = `content/conditions/${f}`;
    const r = validateConditionWeek(JSON.parse(readFileSync(new URL(`conditions/${f}`, root), "utf8")), known, ids);
    if (!r.ok) { fail(file, r.problems); continue; }
    if (`${r.week.week}.json` !== f) { fail(file, [`the file name must be its week (${r.week.week}.json)`]); continue; }
    ids = [...ids, ...r.week.conditions.map((c) => c.id)];
    console.log(`✓ ${file} (${r.week.conditions.length} city conditions)`);
  }
  const rules = JSON.parse(readFileSync(new URL("city/reactions.json", root), "utf8"));
  const problems = validateReactions(rules, known);
  if (problems.length) fail("content/city/reactions.json", problems);
  else console.log(`✓ content/city/reactions.json (${rules.length} city storylets)`);
}
// Content Engine step 5: what the city's people remember about a player.
{
  const rules = JSON.parse(readFileSync(new URL("characters/remembers.json", root), "utf8"));
  const problems = validateRemembers(rules);
  if (problems.length) fail("content/characters/remembers.json", problems);
  else console.log(`✓ content/characters/remembers.json (${rules.length} remembered lines, ${new Set(rules.map((r: { who: string }) => r.who)).size} characters)`);
}
// Content Engine step 7: one card format. Career tasks and campaign situations share the Moral Choices face, and their
// memory gates follow the storylet rules.
{
  const careers = JSON.parse(readFileSync(new URL("careers/careers.json", root), "utf8")) as { tasks: { id: string; emoji: string; title: string; when?: never; slots?: never; options: { id: string; label: string; get: string; cost: string; outcomes: { text: string }[] }[] }[] };
  const sits = (JSON.parse(readFileSync(new URL("campaign/situations.json", root), "utf8")) as { situations: { id: string; icon: string; text: string; when?: never; choices: CardFace["options"] }[] }).situations;
  const problems = [
    ...careers.tasks.flatMap((t) => [...faceProblems(`task ${t.id}`, t), ...gateProblems(`task ${t.id}`, t, { title: t.title, more: t.options.flatMap((o) => [o.label, ...o.outcomes.map((x) => x.text)]) })]),
    // The campaign shows the candidate's own Integrity on screen, so it may name it.
    ...sits.flatMap((s) => [...faceProblems(`situation ${s.id}`, { emoji: s.icon, title: s.text, options: s.choices }).filter((x) => !/never the meter/.test(x)),
      ...gateProblems(`situation ${s.id}`, s, { title: s.text.replace("{candidate}", "Candidate") })]),
  ];
  if (problems.length) fail("one card format (content/careers, content/campaign)", problems);
  else console.log(`✓ one card format (${careers.tasks.length} career tasks, ${sits.length} campaign situations; ${careers.tasks.filter((t) => t.when).length + sits.filter((s) => s.when).length} react to memory)`);
}
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
