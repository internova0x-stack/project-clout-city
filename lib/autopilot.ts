// Autopilot (migration 0107, owner Oct 22: "Automate news, treasure hunts, tea, Stories unless paused"). Each kind of
// weekly content goes live on its own while its switch is on: news weeks, treasure hunts and Tea (gossip) as soon as
// their files are on main (the weekly routine merges its own pull request once its checks pass), and stories one after
// another: when no main story is running or scheduled, the next one in the Studio's order is approved and starts that
// day (story_autopilot). A paused kind waits for the Studio, as before. The switches live in game_settings
// 'autopilot'; Studio → Calendar shows them.

export type AutopilotKind = "news" | "hunts" | "gossip" | "stories" | "storylets";
export type Autopilot = Record<AutopilotKind, boolean>;

export const AUTOPILOT_DEFAULT: Autopilot = { news: true, hunts: true, gossip: true, stories: true, storylets: true };

export const AUTOPILOT_LABEL: Record<AutopilotKind, { title: string; on: string; off: string }> = {
  news: { title: "City News", on: "Each week's news goes live by itself.", off: "Paused: new weeks wait for you in the Calendar." },
  hunts: { title: "Treasure hunts", on: "Each week's hunt goes live by itself.", off: "Paused: new hunts wait for you in the Calendar." },
  gossip: { title: "Tea", on: "Each week's gossip goes live by itself.", off: "Paused: new gossip waits for you in Gossip." },
  stories: { title: "Stories", on: "When a story ends, the next one in your list starts by itself.", off: "Paused: stories wait for your approval and a Day 1." },
  storylets: { title: "Storylets", on: "Each week's new cards go live 24 hours after they arrive, unless you veto one.", off: "Paused: new cards wait for you in Storylets." },
};

/** The stored switches, with any missing kind on (the default). */
export function readAutopilot(value: unknown): Autopilot {
  const v = (value && typeof value === "object" ? value : {}) as Partial<Record<AutopilotKind, unknown>>;
  return Object.fromEntries((Object.keys(AUTOPILOT_DEFAULT) as AutopilotKind[]).map((k) => [k, v[k] !== false])) as Autopilot;
}
