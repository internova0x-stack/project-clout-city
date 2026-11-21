// Moments (owner, Nov 21: "there are not a lot of moments or animations with the avatar… Is this a gap"; "plan all three",
// "start"). Phase 1: after something you do at a place, your avatar acts it out in the room for a few seconds, the place
// card or activity sheet steps aside with a caption, then the result comes back. Uses the moves every body already has
// (dance, run, wave, sit, sleep, walk) plus the dog that walks at your heels.
// Pure: GameShell picks the moment, Room3D plays it, tests check the mapping.

export type MomentKind = "dance" | "run" | "dogwalk" | "wave" | "sit" | "sleep" | "work" | "date" | "together" | "crew";

export const MOMENTS: Record<MomentKind, { emoji: string; verb: string; seconds: number }> = {
  dance: { emoji: "💃", verb: "On the floor", seconds: 5 },
  run: { emoji: "🏃", verb: "Running laps", seconds: 5 },
  dogwalk: { emoji: "🐕", verb: "Walking the dog", seconds: 5.5 },
  wave: { emoji: "👋", verb: "Saying hi", seconds: 2.6 },
  sit: { emoji: "🍽️", verb: "Taking a seat", seconds: 5.5 },
  sleep: { emoji: "😴", verb: "Lights out", seconds: 4 },
  work: { emoji: "💼", verb: "On the clock", seconds: 4.5 },
  // Phase 2: someone beside you.
  date: { emoji: "🌹", verb: "Date night", seconds: 6 },
  together: { emoji: "🛋️", verb: "Home together", seconds: 6 },
  crew: { emoji: "👯", verb: "Out with the crew", seconds: 6 },
};

/** A repeat the same New York day plays quickly: enough to see it, not enough to wait for it. */
export const QUICK_SECONDS = 1.6;

const RULES: [RegExp, MomentKind][] = [
  [/\b(dog|dogs|leash|leashes|barksley|stroller)\b/i, "dogwalk"],
  [/\b(dance|dancing|circle|dj|floor|opa|musical number|party|rave|club night)\b/i, "dance"],
  [/\b(run|running|runs|lap|laps|jog|jogging|sprint|sprinklers|track)\b/i, "run"],
  [/\b(sleep|nap|lights out)\b/i, "sleep"],
  [/\b(shift|counter|barback|rush|work|clock in|behind the bar)\b/i, "work"],
  [/\b(eat|meal|brunch|lunch|dinner|breakfast|coffee|slice|plate|table|order|menu|bagel|feast|drink|toast)\b/i, "sit"],
  [/\b(hello|hi|wave|photo|picture|selfie|directions|ring light|get ready with me|meet)\b/i, "wave"],
];

/** The moment for something done at a place, from its id, title and kind (null: nothing to act out). */
export function momentFor(thing: { id?: string; title?: string; label?: string; kind?: string }): MomentKind | null {
  // A meal is a seat whatever it's called ("Two dirty water dogs" is a hot dog, not a walk).
  if (thing.kind === "eat") return "sit";
  const text = [thing.id?.replace(/[-_]/g, " "), thing.title, thing.label].filter(Boolean).join(" · ");
  for (const [re, kind] of RULES) if (re.test(text)) return kind;
  if (thing.kind === "shift") return "work";
  return null;
}

/** How long a moment plays: in full the first time today, quick after that. */
export const momentSeconds = (kind: MomentKind, firstToday: boolean) => (firstToday ? MOMENTS[kind].seconds : QUICK_SECONDS);
