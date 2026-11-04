// The Charity Gala's gift as a results card (components/ResultCard.tsx; owner, Nov 4). gala_donate takes one gift a New York
// week, so it shows once per gift. No goal for the night exists, so the bar is the gift's clout against the biggest gift's.

import { GALA } from "@/lib/gala";
import type { Celebration } from "../Celebrate";

export function galaResult(amount: number, got: { clout: number; mood: number }): Celebration {
  const top = got.clout >= GALA.cloutMax;
  return {
    rung: 3, emoji: "🥂", tag: "The Charity Gala", title: top ? "The big gift" : "A generous soul", cta: "Back to the party", twist: "chimes",
    result: {
      tone: "win", stamp: { text: "DONATED", tone: "good" }, amount, unit: "to the Literacy & Rooftop Garden Fund",
      story: top ? "The jazz trio stopped mid-song so the room could clap at you." : "The committee will mention you in calligraphy.",
      meter: { label: "🔥 Gala clout", have: got.clout, need: GALA.cloutMax, max: GALA.cloutMax,
        say: top ? "Top of the donor board." : "Bigger gift, bigger font on the donor board." },
      keep: [`🔥 +${got.clout} clout`, `😊 +${got.mood} Mood`, "📜 Name on the donor board"],
    },
  };
}
