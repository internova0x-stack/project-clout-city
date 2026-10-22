import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { LETTER_KINDS, MAYOR, MAYOR_WELCOME, deviceLine, kindOf, letterProblem, mayorError } from "../lib/mayor.ts";
import { MAYOR_PAPA_DANI } from "../lib/cast.ts";
import { MAYOR_WEEKLY_FROM, validateNewsWeek } from "../lib/news.ts";

const sql = readFileSync(new URL("../supabase/migrations/0105_mayor_letters.sql", import.meta.url), "utf8");

test("the form's checks match the server's (migration 0105)", () => {
  assert.equal(letterProblem("short"), `A few more words, please (${MAYOR.messageMin} characters at least).`);
  assert.equal(letterProblem("  The bank is broken  "), null);
  assert.match(letterProblem("x".repeat(MAYOR.messageMax + 1)) ?? "", /Keep it to 1000/);
  assert.ok(sql.includes(`char_length(message) between ${MAYOR.messageMin} and ${MAYOR.messageMax}`));
  assert.ok(sql.includes(`>= ${MAYOR.dailyMax} then`) && sql.includes(`greatest(0, ${MAYOR.dailyMax} -`));
  for (const k of LETTER_KINDS) assert.ok(sql.includes(`'${k.id}'`), k.id);
});

test("kinds, devices and errors", () => {
  assert.equal(kindOf("nope").id, "other");
  assert.equal(deviceLine("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1"), "iPhone · Safari");
  assert.equal(deviceLine("Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36"), "Android · Chrome");
  assert.equal(deviceLine(null), null);
  assert.match(mayorError('function public.mayor_write does not exist'), /0105/);
  assert.match(mayorError("daily_max"), /5 letters a day/);
});

test("Mayor Papa-Dani is in the cast and welcomes players", () => {
  assert.equal(MAYOR.name, MAYOR_PAPA_DANI.name);
  assert.ok(MAYOR_WELCOME.join(" ").includes("Mayor Papa-Dani"));
  assert.ok(existsSync(new URL(`../public${MAYOR_PAPA_DANI.portrait}`, import.meta.url)), "his portrait ships with the game");
});

test("the Mayor is in City News every week from his first week", () => {
  const item = (id: string, cast: string[] = []) => ({ id, kind: "city", day: "Tue", headline: "Something happens in Astoria", body: "A long enough body for the city news.", cast });
  const without = validateNewsWeek({ week: MAYOR_WEEKLY_FROM, items: [item("one", ["sal"])] });
  assert.equal(without.ok, false);
  assert.ok(!without.ok && without.problems.some((p) => p.includes("Mayor Papa-Dani")));
  assert.equal(validateNewsWeek({ week: MAYOR_WEEKLY_FROM, items: [item("one", [MAYOR_PAPA_DANI.id])] }).ok, true);
  // Weeks before him don't need him.
  assert.equal(validateNewsWeek({ week: "2026-10-19", items: [item("one", ["sal"])] }).ok, true);
});
