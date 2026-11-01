// The Clout Pass and the starter pack in the preview (/preview/home?pass=...&pack=...): the same tiers as the server, in
// memory. Presets: soon (before the season), new (day one, 0 XP), progress (tier 6, rewards waiting), paid (the pass
// bought, tier 9), vip (VIP, tier 12), done (every tier). The paid row and the pack follow the preview store (buying them
// there unlocks them after its 4-second wait). ?pack=offer|owned|none.

import { SEASON, STARTER_PACK, claimable, type PassApi, type PassReward, type PassState, type StarterPackState } from "./seasonPass.ts";

export const PASS_PRESETS = ["soon", "new", "progress", "paid", "vip", "done"] as const;

export function createSeasonSim(preset: string | null, pack: string | null, opts: {
  owns: (sku: string) => boolean;
  pending: (sku: string) => boolean;
  reward: (cash: number, clout: number) => void;
  item: (sku: string) => void;
}): PassApi {
  const xp = { soon: 0, new: 0, progress: 6 * SEASON.xpPerTier + 60, paid: 9 * SEASON.xpPerTier + 20, vip: 12 * SEASON.xpPerTier + 90, done: SEASON.tiers.length * SEASON.xpPerTier }[preset ?? "progress"] ?? 6 * SEASON.xpPerTier + 60;
  const vip = preset === "vip";
  const claimed = { free: [] as number[], paid: [] as number[] };
  if (preset === "paid" || preset === "done") for (let t = 1; t <= 4; t++) { claimed.free.push(t); claimed.paid.push(t); }
  else if (preset === "progress") for (let t = 1; t <= 3; t++) claimed.free.push(t);
  const state = (): PassState => ({
    season: SEASON, xp, vip, today: preset === "new" ? 0 : 50,
    paid: vip || preset === "paid" || preset === "done" || opts.owns(SEASON.sku),
    pending: opts.pending(SEASON.sku),
    phase: preset === "soon" ? "soon" : "on",
    claimed: { free: [...claimed.free], paid: [...claimed.paid] },
  });
  let packGranted = false;
  return {
    state: async () => ({ ok: true, data: state() }),
    async claimAll() {
      const s = state();
      if (s.phase === "soon") return { ok: false, error: "The season hasn't started yet." };
      const ready = claimable(s);
      const got: PassReward[] = [];
      for (const t of ready.free) {
        claimed.free.push(t);
        for (const r of SEASON.tiers[t - 1].free) {
          got.push(r);
          if (r.kind === "cash") opts.reward(r.amount, 0);
          else if (r.kind === "clout") opts.reward(0, r.amount);
          else if (r.kind === "item") opts.item(r.sku);
        }
      }
      for (const t of ready.paid) {
        claimed.paid.push(t);
        for (const r of SEASON.tiers[t - 1].paid) {
          got.push(r);
          if (r.kind === "item") opts.item(r.sku);
        }
      }
      return { ok: true, data: { ...state(), got } };
    },
    async starter(): Promise<{ ok: true; data: StarterPackState }> {
      const owned = pack === "owned" || opts.owns(STARTER_PACK.sku);
      if (owned && !packGranted) { packGranted = true; STARTER_PACK.items.forEach((sku) => opts.item(sku)); }
      return { ok: true, data: { owned, offer: !owned && pack !== "none", endsAt: new Date(Date.now() + 9 * 86_400_000).toISOString(), pending: opts.pending(STARTER_PACK.sku) } };
    },
  };
}
