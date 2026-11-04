// The weekly review as a results screen (components/ResultCard.tsx; owner, Nov 4: "build the top 5… right after the weekly
// review"). GameShell shows it the first time this device sees a review (cc-review-seen), which is the moment the review
// runs: careers.screen() settles any review that's due, and GameShell reads it when the game opens, on the home tab and
// when Careers closes. A promotion to the top level stays a legend (promotion.ts).

import { CAREER, trackById, type CareerView } from "@/lib/careers";
import type { Celebration } from "../Celebrate";

const cs = (n: number) => `C$${n.toLocaleString("en-US")}`;
/** The review's own line for its outcome, without its emoji ("✅ A solid week. Odette nods at you, once." → the words). */
function storyOf(lines: string[], marks: string[]): string | undefined {
  const line = lines.find((l) => marks.some((m) => l.startsWith(m)));
  return line?.replace(/^\S+\s/, "").replace(/^Payday: .*$/, "") || undefined;
}

export function reviewResult(job: CareerView, onOpen?: () => void): Celebration | null {
  const r = job.review;
  if (!r) return null;
  const track = trackById(job.track);
  const first = (job.people.manager.name ?? "").split(" ")[0];
  const warnAt = job.people.manager.persona === "supportive" ? CAREER.warn.supportive : CAREER.warn.perf;
  const strikes = Math.min(job.warnings, CAREER.strikes.fireAfter);
  const perf = Math.round(job.performance);
  const tag = job.employer;
  const base = { rung: 3 as const, emoji: track?.emoji ?? "💼", tag, onCta: onOpen };
  switch (r.outcome) {
    case "promotion":
      return { ...base, emoji: "🎉", title: `Promoted to ${job.title}`, cta: "See your new desk",
        share: `I just got promoted to ${job.title} at ${job.employer} in Clout City.`,
        result: { tone: "win", stamp: { text: "PROMOTED", tone: "good" }, amount: job.salary, unit: "a week",
          story: `Level ${job.level} of ${job.levels}. New desk, new salary, same coffee machine.`,
          meter: { label: "Career ladder", have: job.level, need: job.levels, max: job.levels, say: job.level < job.levels ? `${job.levels - job.level} more to the top.` : "The top job." },
          keep: [cs(r.pay), "New desk", "Friends"] } };
    case "warning":
    case "probation":
    case "demotion":
    case "caught": {
      const stamp = r.outcome === "probation" ? "PROBATION" : r.outcome === "demotion" ? "DEMOTED" : "WARNING";
      const title = r.outcome === "probation" ? (strikes >= CAREER.strikes.fireAfter ? "Last chance" : "On probation") : r.outcome === "demotion" ? `Back to ${job.title}` : "A warning";
      const short = Math.max(0, warnAt - perf);
      const say = `${short ? `${short} short. ` : ""}Strike ${strikes} of ${CAREER.strikes.fireAfter}. A good week takes one off.`;
      return { ...base, emoji: r.outcome === "probation" ? "📋" : r.outcome === "demotion" ? "⬇️" : "⚠️", title, cta: "Plan next week",
        result: { tone: "warn", stamp: { text: stamp, tone: "warn" }, amount: r.pay, unit: "this week",
          story: r.outcome === "caught" ? storyOf(r.lines, ["🧾"])
            : strikes >= CAREER.strikes.fireAfter ? "One more bad week and you're out."
            : r.outcome === "probation" ? `Next week's wage is docked ${Math.round(CAREER.strikes.dock * 100)}%.`
            : `${first} wants a better week.`,
          meter: { label: "Performance", have: perf, need: warnAt, say },
          keep: r.outcome === "demotion" ? ["Job", "Friends", "Skills"] : ["Level", "Friends", "Skills"] } };
    }
    case "fired":
      return { ...base, emoji: "📦", title: "Let go", cta: "Find a new job",
        result: { tone: "lose", stamp: { text: "FIRED", tone: "bad" }, amount: r.pay, unit: "last pay",
          story: `${first} walked you out with a box.`,
          meter: { label: "Performance", have: perf, need: warnAt, say: `Apply again in ${CAREER.rehireDays.fired} days, anywhere.` },
          keep: ["Skills", "Friends", "Savings"] } };
    default: {
      const next = job.next;
      const need = next?.perfNeed ?? CAREER.promote.perf;
      const raise = r.outcome === "raise";
      return { ...base, emoji: raise ? "📈" : "💵", title: raise ? "A raise" : "Payday", cta: "Back to work",
        result: { tone: "win", amount: r.pay, unit: "this week",
          story: storyOf(r.lines, ["📈", "✅", "⛔", "🧊"]),
          meter: { label: "Performance", have: perf, need, say: perf >= need ? (next ? "Promotion bar cleared." : "Top of the ladder.") : `${need - perf} more for a promotion.` },
          keep: [cs(r.pay), raise ? `${cs(job.salary)}/wk` : "Your level", strikes ? `${strikes} strike${strikes > 1 ? "s" : ""}` : "Clean record"] } };
    }
  }
}
