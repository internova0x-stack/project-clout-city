// The Charity Gala in the preview (/preview/home?gala=on|off|new|done&at=ditmars-heights-rooftop&open=gala): on (a Halo, on the
// list), off (revealed, not Halo), new (no choices yet), done (gave this week). The same rules as gala_donate, in memory.

import { GALA, galaClout, galaError, type GalaApi, type GalaState } from "./gala";

export function createGalaSim(preset: string | null, opts: { here: () => string | null; bank: () => number; onPay?: (e: { cash: number; clout: number; mood: number }) => void }): GalaApi {
  let donated: number | null = preset === "done" ? 250 : null;
  const invited = preset === "on" || preset === "done";
  const state = (): GalaState => ({ invited, revealed: preset !== "new", donated, week: "2026-11-02", amounts: [...GALA.amounts] });
  return {
    state: async () => ({ ok: true, data: state() }),
    donate: async (amount) => {
      if (!invited) return { ok: false, error: galaError("not_invited") };
      if (!(GALA.amounts as readonly number[]).includes(amount)) return { ok: false, error: galaError("bad_amount") };
      if (opts.here() !== GALA.place) return { ok: false, error: galaError("not_here") };
      if (donated !== null) return { ok: false, error: galaError("done_this_week") };
      if (opts.bank() < amount) return { ok: false, error: galaError("cant_afford") };
      donated = amount;
      opts.onPay?.({ cash: -amount, clout: galaClout(amount), mood: GALA.mood });
      return { ok: true, data: { clout: galaClout(amount), mood: GALA.mood } };
    },
  };
}
