// Development previews only: Starter Week in memory, following supabase/migrations/0122. The preview marks missions from
// the simulated city's own calls (PreviewHome wraps them) and pays through `pay`, like starter_state() does.
import { STARTER_DAYS, STARTER_FINISH, STARTER_MISSIONS, type StarterApi, type StarterState } from "./starter.ts";

export function createStarterSim(doneCount: number, pay: (cash: number, clout: number) => void) {
  const done = new Set(STARTER_MISSIONS.slice(0, Math.max(0, Math.min(STARTER_MISSIONS.length, doneCount))).map((m) => m.id));
  // Missions done by the preset were paid before the preview opened.
  const paid = new Set(done);
  const startedAt = new Date(Date.now() - 86400e3).toISOString();
  let hidden = false;
  let finished = done.size === STARTER_MISSIONS.length;
  const active = () => !hidden && !finished;
  const api: StarterApi = {
    async state() {
      const now: StarterState["paid"] = [];
      for (const m of STARTER_MISSIONS) {
        if (done.has(m.id) && !paid.has(m.id)) {
          paid.add(m.id);
          pay(m.reward.cash ?? 0, m.reward.clout ?? 0);
          now.push({ id: m.id, cash: m.reward.cash ?? 0, clout: m.reward.clout ?? 0 });
        }
      }
      let justFinished = false;
      if (!finished && done.size === STARTER_MISSIONS.length) {
        finished = justFinished = true;
        pay(STARTER_FINISH.cash, 0);
      }
      return { ok: true, data: { done: [...done], startedAt, daysLeft: STARTER_DAYS - 1, active: active(), paid: now, finished: justFinished } };
    },
    async hide() { hidden = true; return { ok: true, data: null }; },
  };
  return { api, mark(id: string) { if (active()) done.add(id); } };
}
