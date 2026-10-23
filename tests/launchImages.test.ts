import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { LAUNCH_SCREENS, launchImageName, launchStartupImages } from "../lib/launchImages.ts";
import { LOADING_TIPS } from "../lib/loadingTips.ts";

test("every iPhone launch image is listed once and shipped in public/splash", () => {
  const names = LAUNCH_SCREENS.map(launchImageName);
  assert.equal(new Set(launchStartupImages().map((i) => i.media)).size, LAUNCH_SCREENS.length);
  for (const n of names) assert.ok(existsSync(new URL(`../public/splash/${n}`, import.meta.url)), `public/splash/${n} (npm run build:launch-images)`);
  assert.ok(existsSync(new URL("../public/loading-skyline.webp", import.meta.url)));
});

test("Lola's loading tips are short enough for a phone", () => {
  for (const t of LOADING_TIPS) assert.ok(t.length <= 70, t);
});
