// Step-by-step "add to home screen" instructions for each browser, used by the
// install prompt (Clarifications section 1, step 13; Design System Guide C17).
// Pure and dependency-free so it can be unit tested.

export type InstallGuideId =
  | "ios-safari" | "ios-chrome" | "ios-other"
  | "android-chrome" | "android-samsung" | "android-firefox" | "android-other"
  | "desktop-chromium" | "desktop-safari" | "desktop-firefox";

export type Platform = "iphone" | "android" | "computer";

export interface InstallStep {
  /** Short instruction; the glyph names what to look for on screen. */
  title: string;
  glyph?: string;
  /** Where to find it, in plain words. */
  help: string;
}

export interface InstallGuide {
  id: InstallGuideId;
  platform: Platform;
  browser: string;
  steps: InstallStep[];
  /** Shown under the steps, e.g. when a browser can't install at all. */
  note?: string;
}

const DONE: InstallStep = {
  title: "Find Clout City on your home screen",
  glyph: "📲",
  help: "It opens full screen, like an app. Fame takes effort; you just made some.",
};

export const INSTALL_GUIDES: Record<InstallGuideId, InstallGuide> = {
  "ios-safari": {
    id: "ios-safari", platform: "iphone", browser: "Safari",
    steps: [
      { title: "Tap Share", glyph: "⎋", help: "The square with an arrow pointing up. On iPhone it's in the bar at the bottom; on iPad, top right." },
      { title: "Tap Add to Home Screen", glyph: "⊞", help: "Scroll down the list if you don't see it. It may be under \"More\"." },
      { title: "Tap Add", help: "Top right. Keep the name \"Clout City\" or rename it something iconic." },
      DONE,
    ],
  },
  "ios-chrome": {
    id: "ios-chrome", platform: "iphone", browser: "Chrome",
    steps: [
      { title: "Tap Share", glyph: "⎋", help: "The square with an arrow, at the right end of the address bar." },
      { title: "Tap Add to Home Screen", glyph: "⊞", help: "Scroll down the list if you don't see it." },
      { title: "Tap Add", help: "Top right." },
      DONE,
    ],
    note: "Needs iOS 16.4 or newer. On older iPhones, open this page in Safari instead.",
  },
  "ios-other": {
    id: "ios-other", platform: "iphone", browser: "another app",
    steps: [
      { title: "Open this page in Safari", glyph: "🧭", help: "Tap the ⋯ or share menu and choose \"Open in Safari\", or copy the link into Safari." },
      { title: "Tap Share", glyph: "⎋", help: "The square with an arrow pointing up, in Safari's bottom bar." },
      { title: "Tap Add to Home Screen, then Add", glyph: "⊞", help: "Scroll down the list if you don't see it." },
      DONE,
    ],
    note: "In-app browsers (Instagram, TikTok, X) can't add apps to your home screen.",
  },
  "android-chrome": {
    id: "android-chrome", platform: "android", browser: "Chrome",
    steps: [
      { title: "Tap the menu", glyph: "⋮", help: "The three dots at the top right of Chrome." },
      { title: "Tap Add to Home screen or Install app", glyph: "⊕", help: "The wording depends on your Chrome version." },
      { title: "Tap Install", help: "Confirm in the pop-up. Chrome adds the icon for you." },
      DONE,
    ],
  },
  "android-samsung": {
    id: "android-samsung", platform: "android", browser: "Samsung Internet",
    steps: [
      { title: "Tap the menu", glyph: "☰", help: "The three lines at the bottom right." },
      { title: "Tap Add page to", glyph: "＋", help: "Then choose Home screen." },
      { title: "Tap Add", help: "Confirm, and the icon lands on your home screen." },
      DONE,
    ],
  },
  "android-firefox": {
    id: "android-firefox", platform: "android", browser: "Firefox",
    steps: [
      { title: "Tap the menu", glyph: "⋮", help: "The three dots, next to the address bar." },
      { title: "Tap Install or Add to Home screen", glyph: "⊕", help: "Near the bottom of the menu." },
      { title: "Tap Add", help: "Confirm in the pop-up." },
      DONE,
    ],
  },
  "android-other": {
    id: "android-other", platform: "android", browser: "another app",
    steps: [
      { title: "Open this page in Chrome", glyph: "🌐", help: "Tap the ⋮ menu and choose \"Open in Chrome\" or \"Open in browser\"." },
      { title: "Tap Chrome's menu", glyph: "⋮", help: "The three dots at the top right." },
      { title: "Tap Add to Home screen or Install app, then Install", glyph: "⊕", help: "The wording depends on your Chrome version." },
      DONE,
    ],
    note: "In-app browsers (Instagram, TikTok, X) can't install apps.",
  },
  "desktop-chromium": {
    id: "desktop-chromium", platform: "computer", browser: "Chrome or Edge",
    steps: [
      { title: "Click the install icon", glyph: "⊕", help: "A small monitor with a down arrow, at the right end of the address bar." },
      { title: "Or use the menu", glyph: "⋮", help: "Chrome: ⋮ → Cast, save and share → Install page as app. Edge: ⋯ → Apps → Install this site as an app." },
      { title: "Click Install", help: "Clout City opens in its own window and joins your apps." },
    ],
  },
  "desktop-safari": {
    id: "desktop-safari", platform: "computer", browser: "Safari on Mac",
    steps: [
      { title: "Open the File menu", glyph: "📁", help: "In the menu bar at the top of the screen." },
      { title: "Click Add to Dock", glyph: "⊞", help: "Needs macOS Sonoma or newer." },
      { title: "Click Add", help: "Clout City appears in your Dock." },
    ],
  },
  "desktop-firefox": {
    id: "desktop-firefox", platform: "computer", browser: "Firefox",
    steps: [
      { title: "Bookmark this page", glyph: "☆", help: "Firefox on computers can't install web apps yet; a bookmark is the next best thing." },
      { title: "Or open it in Chrome or Edge", glyph: "🌐", help: "Then use the install icon in the address bar." },
    ],
  },
};

/** The guide for this browser, from its user agent. */
export function detectInstallGuide(ua: string): InstallGuideId {
  const s = ua.toLowerCase();
  const ios = /iphone|ipad|ipod/.test(s) || (s.includes("macintosh") && s.includes("mobile"));
  const inApp = /instagram|fban|fbav|tiktok|bytedance|twitter|snapchat|line\//.test(s);
  if (ios) {
    if (inApp) return "ios-other";
    if (s.includes("crios")) return "ios-chrome";
    if (/fxios|edgios|opios/.test(s)) return "ios-other";
    return "ios-safari";
  }
  if (s.includes("android")) {
    if (inApp || s.includes("; wv)")) return "android-other";
    if (s.includes("samsungbrowser")) return "android-samsung";
    if (s.includes("firefox")) return "android-firefox";
    return "android-chrome";
  }
  if (s.includes("firefox")) return "desktop-firefox";
  if (s.includes("safari") && !/chrome|chromium|edg\//.test(s)) return "desktop-safari";
  return "desktop-chromium";
}

/** One representative guide per platform tab, used when the player picks another device. */
export const PLATFORM_DEFAULT: Record<Platform, InstallGuideId> = {
  iphone: "ios-safari",
  android: "android-chrome",
  computer: "desktop-chromium",
};
