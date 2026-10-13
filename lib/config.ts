// Game configuration. Tunable numbers live here, never inline in components.
// Kept dependency-free so the Node test runner can import it directly.

export const GAME_CONFIG = {
  /** Current shipped version (see docs/07-milestones-and-versions.md). */
  version: "0.1",

  cityClock: {
    /** One in-game day every N real hours (Clarifications section 12). */
    realHoursPerCityDay: 2,
    /** City-clock hour when the map switches to daytime. */
    dayStartsAt: 6,
    /** City-clock hour when the map switches back to night. */
    nightStartsAt: 19,
  },

  clique: {
    /** Members needed for the big clique bonus (Clarifications section 7). */
    bonusSize: 5,
  },

  profile: {
    nameMinLength: 2,
    nameMaxLength: 20,
  },

  /** Invite links: /i/<code>. The code is kept in this cookie through sign-up. */
  invite: {
    cookieName: "cc_invite",
    cookieMaxAgeDays: 30,
  },

  /** Set for an hour when someone confirms 18+ and then signs in with Google. */
  ageCookieName: "cc_age_ok",
} as const;
