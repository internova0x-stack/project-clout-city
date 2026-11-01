// Living places in the preview (/preview/home?life=...): the same rules as the server, in memory, with the real content.
// Presets: (none) as it is; `rush` puts the clock in every place's happening; `regular` gives 8 days at every place (the
// 7-day stamp waiting); `brownout` runs a brownout today.

import { LIFE, LifeError, todaysPick, claimStamp, doActivity, doMoment, lifeError, lifeView, momentFor, momentView, type LifeApi, type LifeDone, type LifeScene } from "./placeLife.ts";
import { LIFE_CONTENT } from "./placeLifeContent.ts";

export const LIFE_PRESETS = ["rush", "regular", "brownout"] as const;

export function createLifeSim(preset: string | null, opts: {
  at: () => string | null;
  energy: () => number;
  minute: () => number;
  weekday: () => number;
  regularDays: (place: string) => number;
  conditions: () => string[];
  pay: (r: { cash: number; clout: number; mood: number; energy: number }) => void;
}): LifeApi {
  const done: LifeDone = { refs: new Set(), momentsToday: 0 };
  const scene = (place?: string): LifeScene => {
    let minute = opts.minute();
    if (preset === "rush" && place) {
      const h = LIFE_CONTENT.happenings.find((x) => x.place === place && x.hours);
      if (h?.hours) minute = h.hours[0] * 60 + 15;
    }
    return { minute, weekday: preset === "rush" ? 5 : opts.weekday(), conditions: preset === "brownout" ? [...opts.conditions(), "brownout"] : opts.conditions() };
  };
  const days = (place: string) => (preset === "regular" ? 8 : opts.regularDays(place));
  const view = (place: string) => lifeView(LIFE_CONTENT, place, scene(place), done, days(place));
  const fail = (e: unknown) => ({ ok: false as const, error: e instanceof LifeError ? lifeError(e.code) : "Something went wrong." });
  const apply = (r: { cash: number; clout: number; mood: number; energy: number; ref: string }) => {
    done.refs.add(r.ref);
    if (r.ref.startsWith("m:")) done.momentsToday += 1;
    opts.pay(r);
  };
  return {
    view: async (place) => ({ ok: true, data: view(place) }),
    async activity(id, option) {
      try {
        const a = LIFE_CONTENT.activities.find((x) => x.id === id);
        const r = doActivity(LIFE_CONTENT, id, option, { at: opts.at(), scene: scene(a?.place), done, energy: opts.energy(), skill: () => 3 }, Math.random);
        apply(r);
        return { ok: true, data: { result: r, view: view(a!.place) } };
      } catch (e) { return fail(e); }
    },
    async moment(crowdType) {
      const m = momentFor(LIFE_CONTENT, crowdType, done, preset ? () => 0 : Math.random);
      return { ok: true, data: m ? momentView(m) : null };
    },
    async playMoment(id, option) {
      try {
        const r = doMoment(LIFE_CONTENT, id, option, done, () => 3, Math.random);
        apply(r);
        return { ok: true, data: r };
      } catch (e) { return fail(e); }
    },
    async today() {
      const all = Object.fromEntries(Object.keys(LIFE_CONTENT.stamps).map((p) => [p, days(p)]));
      // ?life=regular puts one place a visit from its reward; the rest as they are.
      if (preset === "regular") for (const p of Object.keys(all)) all[p] = p === "ditmars-deli" ? 6 : 0;
      const place = preset === "rush" ? "feta-compli" : undefined;
      return { ok: true, data: todaysPick(LIFE_CONTENT, scene(place), done, all, Math.floor(Date.now() / 86_400_000)) };
    },
    async stamp(place, d) {
      try {
        const r = claimStamp(LIFE_CONTENT, place, d, days(place), done);
        apply(r);
        return { ok: true, data: { result: r, view: view(place) } };
      } catch (e) { return fail(e); }
    },
  };
}

export { LIFE };
