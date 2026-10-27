// Per-player rate limits (migration 0126; game_settings 'rate_limits', checked by tests/rateLimits.test.ts). The
// database enforces them; the browser only says so when a request comes back 429.

export const RATE_LIMITS = {
  windowSeconds: 60,
  all: 240,
  buckets: {
    guess: { limit: 20, rpc: ["hunt_answer", "campus_exam_check", "campus_exam_submit", "gossip_find", "is_name_available"] },
    post: { limit: 10, rpc: ["mayor_write", "tv_submit", "radio_request", "chat_report", "party_report", "radio_report"] },
    chat: { limit: 30, rpc: ["chat_send"] },
    checkout: { limit: 10, rpc: ["start_purchase"] },
  },
} as const;

/** The window event the browser's Supabase client fires on a 429 from the database. */
export const SLOW_DOWN_EVENT = "cc-slow-down";
export const SLOW_DOWN_TEXT = "Whoa, slow down. The city needs a minute to catch up.";

/** A database answer that a rate limit refused (not Supabase Auth's own limits, which have their own messages). */
export const isRateLimited = (url: string, status: number) => status === 429 && url.includes("/rest/v1/");
