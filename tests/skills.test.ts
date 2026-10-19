import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LEVEL_AT, MAX_LEVEL, SKILLS, SKILL_PERKS, levelFor, levelProgress, perkOn, perkStatus, skillBadge, skillPerksSeed, type PerksState } from "../lib/skills.ts";

test("nine skills, levels 0 to 10 on the same practice table as migration 0056", () => {
  assert.equal(SKILLS.length, 9);
  assert.deepEqual([...LEVEL_AT], [0, 3, 8, 15, 25, 40, 60, 85, 115, 150, 200]);
  assert.equal(levelFor(0), 0);
  assert.equal(levelFor(3), 1);
  assert.equal(levelFor(39), 4);
  assert.equal(levelFor(40), 5);
  assert.equal(levelFor(999), MAX_LEVEL);
  assert.equal(levelProgress(9), (9 - 8) / (15 - 8));
  assert.equal(levelProgress(200), 1);
});

test("skill badges at 5 and 10", () => {
  assert.deepEqual(skillBadge("skill-dance-5"), { emoji: "💃", name: "Dance 5" });
  assert.equal(skillBadge("skill-cooking-10")?.name, "Master Chef");
  assert.equal(skillBadge("skill-dance-7"), null);
  assert.equal(skillBadge("hunt-veteran"), null);
});

test("skill perks: three per skill at 3, 6 and 9, and migration 0092 holds the same rules", () => {
  for (const sk of SKILLS) assert.deepEqual(SKILL_PERKS.filter((p) => p.skill === sk.id).map((p) => p.level), [3, 6, 9], sk.id);
  assert.equal(new Set(SKILL_PERKS.map((p) => p.id)).size, SKILL_PERKS.length);
  for (const p of SKILL_PERKS) {
    if (p.kind === "gig") assert.ok(p.pay && p.energy && p.waitMinutes, p.id);
    if (p.kind === "invite") assert.ok(p.clout, p.id);
    if (p.kind === "access") assert.ok(p.access, p.id);
  }
  const sql = readFileSync(new URL("../supabase/migrations/0092_skill_perks.sql", import.meta.url), "utf8");
  const seed = JSON.parse(sql.match(/'skill_perks', '(.+?)'::jsonb/)![1]);
  assert.deepEqual(seed, skillPerksSeed());
});

test("perk status follows the level now, the week's gigs and accepted invites", () => {
  const levels = Object.fromEntries(SKILLS.map((s) => [s.id, 0])) as PerksState["levels"];
  const s: PerksState = { levels: { ...levels, cooking: 6, charisma: 9, dance: 3 }, gigs: [], invites: ["charisma-3"] };
  const perk = (id: string) => SKILL_PERKS.find((p) => p.id === id)!;
  assert.equal(perkStatus(perk("cooking-9"), s, 0), "locked");
  assert.equal(perkStatus(perk("cooking-6"), s, 0), "take");
  assert.equal(perkStatus(perk("charisma-3"), s, 0), "went");
  assert.equal(perkStatus(perk("charisma-9"), s, 0), "rsvp");
  s.gigs.push({ perk: "cooking-6", accepted_at: "2026-10-19T10:00:00Z", ready_at: "2026-10-19T12:00:00Z", collected_at: null });
  assert.equal(perkStatus(perk("cooking-6"), s, Date.parse("2026-10-19T11:00:00Z")), "working");
  assert.equal(perkStatus(perk("cooking-6"), s, Date.parse("2026-10-19T12:00:00Z")), "collect");
  assert.ok(perkOn(s, "door"));
  assert.ok(!perkOn(s, "vip"));
  assert.deepEqual(skillBadge("perk-charisma-9"), { emoji: "🏆", name: "Cloutie Presenter" });
});
