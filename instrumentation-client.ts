import posthog from "posthog-js";
import { analyticsOff } from "./lib/analyticsEvents";

// PostHog analytics (owner, Oct 27; Next.js 15.3+ starts it here, before the app). Autocapture and page views stay on;
// session replay masks every input and anything marked `ph-sensitive` (chats, letters, shoutouts, notes), which
// autocapture also skips. The Story Studio never sends anything. No token (local development): nothing starts.

const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;

if (token && typeof window !== "undefined" && !analyticsOff(window.location.pathname)) {
  posthog.init(token, {
    api_host: host || "https://us.i.posthog.com",
    defaults: "2026-08-30",
    autocapture: true,
    capture_pageview: "history_change",
    person_profiles: "identified_only",
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: ".ph-sensitive",
    },
    // Moving into the Studio inside one tab still sends nothing.
    before_send: (e) => (analyticsOff(window.location.pathname) ? null : e),
  });
}
