// Campaign Mode in the preview (/preview/home?campaign=...): the same engine as the server, in memory, with the
// sample content. Results arrive 6 seconds after End Week instead of the next morning, so the whole loop can be
// walked in a minute. Presets: locked (before Rank 2), pick, week (week 2 with mail), situation (End Week waiting on
// a choice), bribe (week 3, a bought endorsement and votes for cash), debate (week 3), waiting (results not in yet),
// election (election night).

import { CAMPAIGN, type CampaignApi, type CampaignResult, type CampaignScreen, type CampaignState, type CandidateId } from "./campaign";
import { CAMPAIGN_CONTENT as content } from "./campaignContent";
import {
  CampaignError, campaignView, candidateCards, choose, debateRound, dilemma, endWeek, nextDay, refresh, reply, setBudget, setSlot, startCampaign,
} from "./campaignEngine";

export type CampaignPreset = "locked" | "pick" | "week" | "situation" | "bribe" | "debate" | "waiting" | "election";

export function createCampaignSim(preset: string | null, opts: { clout: number; bank: number; onBank?: (delta: number) => void }): CampaignApi {
  const rng = Math.random;
  let day = "2026-11-02";
  let state: CampaignState | null = null;
  let bank = opts.bank;
  const won: CandidateId[] = [];
  const unlocked = preset !== "locked";
  let pendingReveal: ReturnType<typeof setTimeout> | null = null;

  const begin = (candidate: CandidateId) => {
    state = startCampaign(content, { id: `preview-${Date.now()}`, candidate, clout: opts.clout, crew: 3, home: "astoria", seed: 0, wonBefore: won.includes(candidate) }, rng);
  };
  /** Plays a quick, sensible week so a preset can start mid-campaign. */
  const autoWeek = () => {
    const s = state!;
    refresh(s, day);
    for (const m of s.inbox.filter((x) => x.status === "new")) {
      const msg = content.inbox.find((x) => x.id === m.id)!;
      try { reply(content, s, msg.id, msg.options[msg.options.length - 1].id, rng); } catch { /* full week */ }
    }
    const weak = Object.entries(s.places).sort((a, b) => (a[1].you - a[1].mayor) - (b[1].you - b[1].mayor)).map(([id]) => id);
    const plan = [{ kind: "rally", place: weak[0] }, { kind: "rally", place: weak[1] }, { kind: "tour", place: weak[2] }, { kind: "donors" }, { kind: "donors" }, { kind: "prep", topic: "weak" }] as const;
    let i = 0;
    for (const a of plan) { while (i < CAMPAIGN.slots && s.slots[i]) i++; try { setSlot(content, s, i, a); } catch { /* taken */ } }
    const spend = Math.floor(s.cash * 0.6 / 3);
    setBudget(s, { digital: spend, street: spend, tv: spend });
    if (s.week === CAMPAIGN.debateWeek) for (let r = 0; r < 4 && !s.debate?.done; r++) debateRound(content, s, r === 2 ? "deflect" : "charm", rng);
    endWeek(content, s, day, rng);
    while (s.phase === "deciding") {
      const p = s.pending[0];
      choose(content, s, p.id, content.situations.find((x) => x.id === p.id)!.choices[0].id, day, rng);
    }
    day = nextDay(day);
    refresh(s, day);
  };

  if (preset && preset !== "locked" && preset !== "pick") {
    begin("starr");
    const weeks = preset === "debate" ? 2 : preset === "bribe" ? 2 : preset === "election" ? CAMPAIGN.weeks : 1;
    for (let w = 0; w < weeks; w++) autoWeek();
    if (preset === "situation" || preset === "bribe" || preset === "waiting") {
      const s = state!;
      s.week = Math.max(s.week, 2);
      if (s.week === CAMPAIGN.debateWeek) for (let r = 0; r < 4 && !s.debate?.done; r++) debateRound(content, s, r === 2 ? "deflect" : "charm", rng);
      endWeek(content, s, day, rng);
      // ?campaign=bribe: End Week opens on a bought endorsement and an offer of votes for cash.
      if (preset === "bribe") s.pending = [{ id: "buy_joy" }, { id: "votes_cash", place: s.pending[0]?.place ?? "astoria" }];
      if (preset === "waiting") while (s.phase === "deciding") {
        const p = s.pending[0];
        choose(content, s, p.id, content.situations.find((x) => x.id === p.id)!.choices[0].id, day, rng);
      }
    }
  }

  const screen = (extra: Partial<CampaignScreen> = {}): CampaignResult<CampaignScreen> => ({
    ok: true,
    data: {
      unlocked,
      rank: unlocked ? 2 : 1,
      clout: opts.clout,
      canStart: unlocked && (!state || state.phase === "over"),
      nextStartOn: null,
      bank,
      candidates: candidateCards(content),
      wonBefore: won,
      view: state ? campaignView(content, state, day) : null,
      ...extra,
    },
  });

  const act = async (fn: (s: CampaignState) => { payouts?: { currency: string; amount: number }[]; receipt?: string; round?: CampaignScreen["round"] } | void): Promise<CampaignResult<CampaignScreen>> => {
    if (!state) return { ok: false, error: "No campaign running." };
    refresh(state, day);
    try {
      const r = fn(state) || {};
      for (const p of r.payouts ?? []) if (p.currency === "cash") { bank += p.amount; opts.onBank?.(p.amount); }
      if (state.phase === "over" && state.ending && state.ending !== "loss" && !won.includes(state.candidate)) won.push(state.candidate);
      return screen({ receipt: r.receipt, round: r.round });
    } catch (e) {
      if (e instanceof CampaignError) {
        const { campaignError } = await import("./campaign");
        return { ok: false, error: campaignError(e.code) };
      }
      throw e;
    }
  };

  /** After End Week resolves, the "next morning" comes in 6 seconds. */
  const scheduleReveal = () => {
    if (!state || (state.phase !== "waiting" && state.phase !== "over")) return;
    if (pendingReveal) clearTimeout(pendingReveal);
    pendingReveal = setTimeout(() => { day = nextDay(day); }, 6000);
  };

  return {
    screen: async () => { if (state) refresh(state, day); return screen(); },
    start: async (candidate) => {
      if (!unlocked) return { ok: false, error: "Campaign Mode opens at Rank 2." };
      begin(candidate);
      return screen();
    },
    budget: (b) => act((s) => setBudget(s, b)),
    slot: (i, a) => act((s) => setSlot(content, s, i, a)),
    reply: (m, o) => act((s) => ({ receipt: reply(content, s, m, o, rng) })),
    dilemma: (id, c) => act((s) => dilemma(content, s, id, c)),
    debate: (style) => act((s) => { const r = debateRound(content, s, style, rng); return { round: { delta: r.delta, line: r.line } }; }),
    endWeek: async () => { const r = await act((s) => endWeek(content, s, day, rng)); scheduleReveal(); return r; },
    choose: async (sit, c) => { const r = await act((s) => choose(content, s, sit, c, day, rng)); scheduleReveal(); return r; },
  };
}
