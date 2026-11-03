// A promotion as a celebration (components/Celebrate.tsx; owner, Nov 3): a takeover, and the top of a track a legend. Shown
// wherever the player first sees the new level (GameShell: the game opening, the home screen, Careers closing).

import { trackById, type CareerView } from "@/lib/careers";
import type { Celebration } from "../Celebrate";

const LOLA_PROMO = [
  "A raise and a new title. Don't let it go to your head. Let it go to your outfit.",
  "Promoted. Somewhere a coworker is drafting a very long group-chat message about you.",
  "Moving up. Remember the little people. Like me. I'm little people.",
  "New title, same commute. Congratulations, I think.",
];

export function promotionCelebration(job: CareerView, where: string, onOpen?: () => void): Celebration {
  const track = trackById(job.track);
  const perk = track?.perks.find((p) => p.level === job.level)?.text;
  const share = `I just got promoted to ${job.title} at ${job.employer} in Clout City.`;
  const rewards: Celebration["rewards"] = [{ tone: "cash", text: `C$${job.salary.toLocaleString("en-US")} a week` }, ...(perk ? [{ text: perk.split(":")[0] }] : [])];
  if (job.level >= job.levels) {
    return { rung: 4, emoji: track?.emoji ?? "💼", num: String(job.level), unit: "top level", art: "stage", tag: `Top of ${track?.name ?? "the ladder"}`,
      title: job.title, line: `The top job at ${where}. ${track?.bigBoss.name ?? "The big boss"} finally learned your name.`,
      rewards: [...rewards, { text: "🏅 Top of the ladder" }], share, cta: "Run the place", onCta: onOpen };
  }
  return { rung: 3, emoji: track?.emoji ?? "💼", num: String(job.level), art: "stage", twist: "register", tag: "Promoted", title: job.title,
    line: `Level ${job.level} of ${job.levels} at ${where}.`, rewards, lola: LOLA_PROMO[job.level % LOLA_PROMO.length], share, cta: "Back to work", onCta: onOpen };
}
