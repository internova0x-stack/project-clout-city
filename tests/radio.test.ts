import { test } from "node:test";
import assert from "node:assert/strict";
import { RADIO, cleanHandle, maskWords, messageProblem, radioError } from "../lib/radio.ts";

test("handles: the @ is optional, the characters are the server's", () => {
  assert.equal(cleanHandle("@mia.k"), "mia.k");
  assert.equal(cleanHandle("  kai_beats "), "kai_beats");
  assert.equal(cleanHandle("mia k"), null);
  assert.equal(cleanHandle("@"), null);
  assert.equal(cleanHandle("a".repeat(31)), null);
});

test("the form masks filtered words as you type, whole words only", () => {
  assert.equal(maskWords("Damn, Queens is damned good", ["damn"]), "••••, Queens is damned good");
  assert.equal(maskWords("no words", []), "no words");
});

test("messages: 140 characters, no tagging anyone", () => {
  assert.equal(messageProblem(""), null);
  assert.equal(messageProblem("Good morning Queens"), null);
  assert.match(messageProblem("x".repeat(RADIO.messageMax + 3))!, /3 over/);
  assert.match(messageProblem("hi @zed")!, /tagging/);
});

test("server errors read as plain copy", () => {
  assert.equal(radioError("list_full"), "Today's list is full. Try again tomorrow.");
  assert.match(radioError("function public.radio_state() does not exist"), /0057/);
});
