// The Guide in the preview (/preview/home): migration 0170's guide_state, guide_seen and guide_claim in memory. Steps the
// game marks ("seen") work as in the game; a step the server would check from the ledger counts as done 6 seconds after its
// "Show me" begins, so every step can be played through. ?guide=new|mid|done sets where it starts.
import { CHAPTERS, STEPS, chapterSteps, stepById, type GuideApi } from "./guide.ts";

export function createGuideSim(start: "new" | "mid" | "done" = "new"): GuideApi {
  const ids = chapterSteps(1).map((s) => s.id);
  const paid = new Set<string>(start === "mid" ? ids.slice(0, 5) : start === "done" ? ids : []);
  const chapters = new Set<number>(start === "done" ? [1] : []);
  const seen = new Set<string>();
  const shownAt = new Map<string, number>();
  const ready = (id: string) => {
    const s = stepById(id)!;
    return "seen" in s.check ? seen.has(id) : (shownAt.get(id) ?? Infinity) <= Date.now() - 6000;
  };
  return {
    async state() {
      return { paid: [...paid], ready: STEPS.filter((s) => !paid.has(s.id) && ready(s.id)).map((s) => s.id), chapters: [...chapters], day: 1 };
    },
    async seen(step) { if (stepById(step) && "seen" in stepById(step)!.check) seen.add(step); },
    shown(step) { if (!shownAt.has(step)) shownAt.set(step, Date.now()); },
    async claim(step) {
      const s = stepById(step);
      if (!s || paid.has(step) || !ready(step)) return null;
      paid.add(step);
      let cash = s.reward.cash ?? 0, clout = s.reward.clout ?? 0, chapter: number | null = null;
      const c = CHAPTERS.find((x) => x.n === s.chapter)!;
      if (!chapters.has(c.n) && chapterSteps(c.n).every((x) => paid.has(x.id))) {
        chapters.add(c.n);
        cash += c.reward.cash ?? 0; clout += c.reward.clout ?? 0; chapter = c.n;
      }
      return { cash, clout, chapter };
    },
  };
}
