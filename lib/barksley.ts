// Sir Barksley (owner, Oct 27): a billionaire's depressed Pomeranian on a bench in Astoria Park, with Dmitri, his walker.
// Starter Week's park mission ("Console a billionaire's depressed dog") plays his scene on arrival; afterwards he stays on
// the park card with a new update each visit. Arriving at the park is what marks the mission (migration 0122); the
// choice is the joke. Safe to import anywhere.

export const BARKSLEY = {
  placeId: "hell-gate-park",
  name: "Sir Barksley",
  walker: "Dmitri",
  portrait: "/cast/sir-barksley.webp",
  /** The tip for consoling him (Starter Week's park mission, migration 0123: C$500 from his allowance). */
  tip: "Sir Barksley would like to tip you. He tips like he still lives in Miami.",
  intro: [
    "This is Sir Barksley. His owner moved to Miami \"for tax reasons.\" They FaceTime. Sir Barksley doesn't do FaceTime.",
    "He's been staring at the river since Tuesday. I'm paid more than a city councilman to watch him stare.",
  ],
  choices: [
    { id: "treat", emoji: "🦴", label: "Offer him a bodega treat", reply: "He's never had food that wasn't imported. He eats it. He looks at you like you've shown him the truth.", walker: "Don't tell the nutritionist." },
    { id: "landlord", emoji: "🏚️", label: "Tell him about your landlord", reply: "You explain the rent. Sir Barksley lies down at your feet. He's been through a co-op board; he understands.", walker: "First time he's made eye contact with a renter." },
    { id: "sit", emoji: "🫂", label: "Just sit with him", reply: "You sit. He leans on your shoe. Nobody says anything. Best therapy in Queens, and it's free.", walker: "That's more than his therapist gets out of him. She charges by the bark." },
  ],
  /** After the first visit: Dmitri's update, a different one each New York day. */
  updates: [
    "He's started journaling.",
    "The owner sent a photo from the yacht. Setback.",
    "He barked at a pigeon today. His vet called it a breakthrough.",
    "He's asking about rent-stabilized dog houses. We don't encourage it.",
    "He's in a book club now. He only reads the jacket.",
    "The owner's ex wants partial custody. Sir Barksley wants Astoria.",
  ],
} as const;

export type BarksleyChoice = (typeof BARKSLEY.choices)[number];

/** Dmitri's update for a day (YYYY-MM-DD): the same all day, a new one tomorrow. */
export function barksleyUpdate(day: string): string {
  const n = [...day].reduce((s, c) => s + c.charCodeAt(0), 0);
  return BARKSLEY.updates[n % BARKSLEY.updates.length];
}

/** Met once per device: the first visit is the consoling (Starter Week); later ones are updates. */
const MET_KEY = "cc-barksley-met";
export function barksleyMet(): boolean {
  try { return localStorage.getItem(MET_KEY) === "1"; } catch { return false; }
}
export function barksleyMeet(): void {
  try { localStorage.setItem(MET_KEY, "1"); } catch { /* private mode: he'll be sad again next time */ }
}
