// Development previews only: Starter Week in memory, following supabase/migrations/0122 and 0163. The preview marks missions from
// the simulated city's own calls (PreviewHome wraps them) and pays through `pay`, like starter_state() does.
import { STARTER_DAYS, STARTER_FINISH, STARTER_MISSIONS, type StarterApi, type StarterState } from "./starter.ts";

export function createStarterSim(preset: string | number, pay: (cash: number, clout: number) => void) {
  // ?starter=N: that many missions done, on the day of the next one. ?starter=dayN: day N, every earlier day's missions done.
  const p = String(preset);
  // ?starter=done: day 1 with all of day 1's missions done ("Today's done · 2 more tomorrow").
  const dayPreset = p === "done" ? ["day2", "2"] : /^day(\d+)$/.exec(p);
  const doneCount = dayPreset ? STARTER_MISSIONS.filter((m) => m.day < Number(dayPreset[1])).length : Math.max(0, Math.min(STARTER_MISSIONS.length, Number(p) || 0));
  const done = new Set(STARTER_MISSIONS.slice(0, doneCount).map((m) => m.id));
  const day = p === "done" ? 1 : dayPreset ? Math.min(STARTER_DAYS, Math.max(1, Number(dayPreset[1]))) : STARTER_MISSIONS[doneCount]?.day ?? STARTER_DAYS;
  // Missions done by the preset were paid before the preview opened.
  const paid = new Set(done);
  const startedAt = new Date(Date.now() - (day - 1) * 86400e3).toISOString();
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
      return { ok: true, data: { done: [...done], startedAt, day, daysLeft: STARTER_DAYS - day, active: active(), paid: now, finished: justFinished } };
    },
    async hide() { hidden = true; return { ok: true, data: null }; },
    async lola() { if (active()) done.add("message"); return { ok: true, data: active() || done.has("message") }; },
  };
  return { api, mark(id: string) { if (active()) done.add(id); } };
}
