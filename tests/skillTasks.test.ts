import { test } from "node:test";
import assert from "node:assert/strict";
import { taskTitle } from "../lib/cityState.ts";

// Migration 0063: one daily task levels up a skill; its title names the skill and where to train it.
test("skill task titles", () => {
  assert.equal(taskTitle({ kind: "cook", place_id: "home", action_id: "cook", skill: "cooking" }), "Level up your cooking: cook a meal at home today");
  assert.equal(taskTitle({ kind: "visit", place_id: "rep-count", action_id: "workout", skill: "fitness" }), "Level up your fitness: work out at Rep Count Fitness today");
  // Other tasks keep their titles.
  assert.equal(taskTitle({ kind: "visit", place_id: "rep-count", action_id: "workout", skill: null }), taskTitle({ kind: "visit", place_id: "rep-count", action_id: "workout" }));
});
