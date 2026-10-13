import { test } from "node:test";
import assert from "node:assert/strict";
import { INSTALL_GUIDES, PLATFORM_DEFAULT, detectInstallGuide } from "../lib/install.ts";

const UA = {
  iosSafari: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  iosChrome: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0.0.0 Mobile/15E148 Safari/604.1",
  iosInstagram: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0",
  androidChrome: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36",
  samsung: "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36",
  androidFirefox: "Mozilla/5.0 (Android 14; Mobile; rv:130.0) Gecko/130.0 Firefox/130.0",
  androidWebview: "Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.0.0 Mobile Safari/537.36",
  macSafari: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
  winEdge: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0",
  winFirefox: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:130.0) Gecko/20100101 Firefox/130.0",
};

test("picks the right guide for each browser", () => {
  assert.equal(detectInstallGuide(UA.iosSafari), "ios-safari");
  assert.equal(detectInstallGuide(UA.iosChrome), "ios-chrome");
  assert.equal(detectInstallGuide(UA.iosInstagram), "ios-other");
  assert.equal(detectInstallGuide(UA.androidChrome), "android-chrome");
  assert.equal(detectInstallGuide(UA.samsung), "android-samsung");
  assert.equal(detectInstallGuide(UA.androidFirefox), "android-firefox");
  assert.equal(detectInstallGuide(UA.androidWebview), "android-other");
  assert.equal(detectInstallGuide(UA.macSafari), "desktop-safari");
  assert.equal(detectInstallGuide(UA.winEdge), "desktop-chromium");
  assert.equal(detectInstallGuide(UA.winFirefox), "desktop-firefox");
});

test("every guide has numbered steps with help text", () => {
  for (const g of Object.values(INSTALL_GUIDES)) {
    assert.ok(g.steps.length >= 2, g.id);
    for (const s of g.steps) assert.ok(s.title && s.help, `${g.id}: ${s.title}`);
  }
  for (const [p, id] of Object.entries(PLATFORM_DEFAULT)) assert.equal(INSTALL_GUIDES[id].platform, p);
});
