import { test } from "node:test";
import assert from "node:assert/strict";
import { cliqueProgress, inviteUrl, normalizeInviteCode } from "../lib/invite.ts";

test("normalizes valid invite codes", () => {
  assert.equal(normalizeInviteCode(" q7mz4k "), "Q7MZ4K");
});

test("rejects codes with look-alike or foreign characters", () => {
  assert.equal(normalizeInviteCode("Q7MZ40"), null); // 0 is excluded
  assert.equal(normalizeInviteCode("Q7MZ4I"), null); // I is excluded
  assert.equal(normalizeInviteCode("Q7MZ4"), null);
  assert.equal(normalizeInviteCode("Q7MZ4K9"), null);
  assert.equal(normalizeInviteCode("<scr>!"), null);
  assert.equal(normalizeInviteCode(null), null);
});

test("builds invite links without double slashes", () => {
  assert.equal(inviteUrl("https://cloutcity.app/", "Q7MZ4K"), "https://cloutcity.app/i/Q7MZ4K");
  // Owner, Oct 15: an invite from a place opens that place.
  assert.equal(inviteUrl("https://cloutcity.app", "Q7MZ4K", "velvet-static"), "https://cloutcity.app/i/Q7MZ4K?at=velvet-static");
  assert.equal(inviteUrl("https://cloutcity.app", "Q7MZ4K", null), "https://cloutcity.app/i/Q7MZ4K");
});

test("clique progress caps at the bonus size", () => {
  assert.deepEqual(cliqueProgress(2, 5), { joined: 2, shown: 2, ratio: 0.4, complete: false });
  assert.deepEqual(cliqueProgress(7, 5), { joined: 7, shown: 5, ratio: 1, complete: true });
  assert.equal(cliqueProgress(-1, 5).joined, 0);
});
