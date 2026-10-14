// #11 (owner, Oct 14): actions take time ("not just happen in a split second"). The client runs a
// short timer, then asks the server; these say how long each kind of thing takes.
import { GAME_CONFIG } from "./config.ts";
import type { PlaceAction } from "./city.ts";

const T = GAME_CONFIG.actionSeconds;

/** Quick looks: a browse, a chat, a stop at the platform. Everything else that's a visit is 6 s. */
const QUICK = new Set(["browse", "platform", "report", "pet-dog", "lobby"]);

/** Seconds a place action takes: shifts 12, meals 6 (snacks 4), visits 6 (a browse 4); gigs are instant. */
export function actionSeconds(a: Pick<PlaceAction, "id" | "kind" | "energy">): number {
  if (a.kind === "gigs") return 0;
  if (a.kind === "shift") return T.shift;
  if (a.kind === "eat") return (a.energy ?? 0) > -16 ? T.snack : T.meal;
  return QUICK.has(a.id) ? T.quick : T.visit;
}

/** The other timed things: a bar drink, groceries, an event. (Naps, sitting and cooking keep their own
 *  seconds in CITY_ECONOMY.rest and .cook, with their own countdown.) */
export const OTHER_SECONDS = {
  drink: T.snack,
  groceries: T.quick,
  event: T.visit,
} as const;

/** What the timer says while it runs ("Working a shift"). */
export function actionVerb(a: Pick<PlaceAction, "id" | "kind" | "label" | "energy">): { emoji: string; label: string } {
  if (a.kind === "shift") return { emoji: "💼", label: "Working a shift" };
  if (a.kind === "eat") return a.id === "movie" ? { emoji: "🎬", label: "Watching the movie" } : (a.energy ?? 0) > -16 ? { emoji: "🥪", label: "Grabbing a snack" } : { emoji: "🍽️", label: "Eating" };
  if (a.id === "workout") return { emoji: "🏋️", label: "Working out" };
  if (a.id === "lecture" || a.id === "night-class" || a.id === "study") return { emoji: "📚", label: "In class" };
  if (QUICK.has(a.id)) return { emoji: "👀", label: "Looking around" };
  return { emoji: "✨", label: a.label };
}
