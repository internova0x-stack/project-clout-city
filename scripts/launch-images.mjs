// Renders the iPhone launch images (lib/launchImages.ts) from /preview/loading?still=1 on a running dev server:
//   npm run dev   (in another terminal), then   npm run build:launch-images   [BASE=http://localhost:3000]
// Needs Playwright (npx playwright, or PLAYWRIGHT=/path/to/playwright/index.mjs and CHROMIUM=/path/to/chromium).
import { mkdirSync } from "node:fs";
import { LAUNCH_SCREENS, launchImageName } from "../lib/launchImages.ts";

const { chromium } = await import(process.env.PLAYWRIGHT ?? "playwright");
const base = process.env.BASE ?? "http://localhost:3000";
mkdirSync("public/splash", { recursive: true });
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
for (const s of LAUNCH_SCREENS) {
  const page = await browser.newPage({ viewport: { width: s.w, height: s.h }, deviceScaleFactor: s.dpr });
  await page.goto(`${base}/preview/loading?still=1`, { waitUntil: "networkidle" });
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `public/splash/${launchImageName(s)}`, type: "jpeg", quality: 78 });
  await page.close();
  console.log("wrote", launchImageName(s));
}
await browser.close();
