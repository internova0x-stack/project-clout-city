import { test } from "node:test";
import assert from "node:assert/strict";
import { afterSignIn } from "../lib/authNext.ts";

test("a Studio sign-in returns to the Studio, by link or by cookie", () => {
  assert.equal(afterSignIn("/studio", null), "/studio");
  assert.equal(afterSignIn(null, "/studio"), "/studio");
  assert.equal(afterSignIn("", "/studio"), "/studio");
});

test("everything else goes to the game, never somewhere unknown", () => {
  assert.equal(afterSignIn(null, null), "/create");
  assert.equal(afterSignIn("https://evil.example", undefined), "/create");
  assert.equal(afterSignIn("//evil.example", "/elsewhere"), "/create");
});

test("a creator sign-in returns to the creator page (migration 0089)", () => {
  assert.equal(afterSignIn("/creator", null), "/creator");
  assert.equal(afterSignIn(null, "/creator"), "/creator");
});
