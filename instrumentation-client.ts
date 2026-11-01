import { startAnalytics } from "./lib/analytics";

// PostHog analytics (owner, Oct 27; Next.js 15.3+ starts it here, before the app). Autocapture and page views stay on;
// session replay masks every input and anything marked `ph-sensitive` (chats, letters, shoutouts, notes), which
// autocapture also skips. The Story Studio never sends anything. No token (local development): nothing starts.
// Consent (owner, Oct 27; GDPR/ePrivacy): nothing is sent or stored until the player taps Accept on the banner
// (components/ConsentBanner.tsx); Reject keeps it that way, and Settings → Privacy choices changes it later.
// Speed (owner, Nov 1): PostHog itself downloads only after Accept (lib/analytics.ts).

startAnalytics();
