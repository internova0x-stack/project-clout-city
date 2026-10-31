// Campaign Mode's rules (docs/CAMPAIGN-MODE.md). Pure: every function takes the content, the state and a random
// source, and changes the state it's given. The server runs them with a crypto random source and saves the result;
// the preview runs them in memory. Players only ever see `campaignView`, which leaves out the hidden rolls (traces,
// fact-checks, queued trouble) and the overnight results until their New York day comes.

import {
  CAMPAIGN, citywide, cs, endReward, skimRoom,
  type CampaignContent, type CampaignState, type CampaignTask, type Candidate, type CandidateId, type TaskDef, type Choice, type DebateStyle, type Effects,
  type InboxMessage, type InboxOption, type OpId, type Payout, type Place, type Situation, type SlotAction,
} from "./campaign.ts";

export type Rng = () => number;

export class CampaignError extends Error {
  code: string;
  constructor(code: string) { super(code); this.code = code; }
}
const fail = (code: string): never => { throw new CampaignError(code); };

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
const round1 = (n: number) => Math.round(n * 10) / 10;
const pick = <T>(rng: Rng, xs: readonly T[]): T => xs[Math.floor(rng() * xs.length)];

/** The next New York day after `day` (YYYY-MM-DD). */
export function nextDay(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function candidateOf(content: CampaignContent, id: CandidateId): Candidate {
  return content.candidates.find((c) => c.id === id) ?? fail("unknown");
}

// ---------------------------------------------------------------------------------------------------------------
// Starting a campaign
// ---------------------------------------------------------------------------------------------------------------

export interface StartInput {
  id: string;
  /** Option C: the manager's own Halo ↔ Hustler band (null before their first moral choice). */
  band?: "high" | "middle" | "low" | null;
  /** Aspirations (migration 0143): the manager's pick (a Public Servant starts ahead). */
  aspiration?: string | null;
  /** Careers part 3 (owner, Oct 31): the manager's current job, as background (Hospitality: a happier staff; Tech: the
   * startup crowd's money; Media: name recognition). */
  career?: { track: "hospitality" | "tech" | "media" | "cityhall" | "streaming" | "fashion" | "realestate" | "finance" | "law"; level: number } | null;
  candidate: CandidateId;
  clout: number;
  crew: number;
  home: string | null;
  seed: number;
  wonBefore: boolean;
}

/** A new campaign: the candidate's money and lean, the manager's clout and crew, and week 1's inbox. */
export function startCampaign(content: CampaignContent, input: StartInput, rng: Rng): CampaignState {
  const c = candidateOf(content, input.candidate);
  if (input.seed < 0 || input.seed > CAMPAIGN.seedMax) fail("bad_seed");
  // A famous manager opens doors: up to +6 points to start and up to double the fundraising.
  // Aspirations (migration 0143): a Public Servant's campaigns start 3 points up across the city.
  const job = input.career ?? null;
  const cloutBonus = Math.min(6, Math.log10(1 + Math.max(0, input.clout)) * 1.5) + (input.aspiration === "public" ? 3 : 0)
    + (job?.track === "media" ? CAMPAIGN.background.mediaPoints : 0)
    + (job?.track === "cityhall" ? CAMPAIGN.background.cityhallPoints[job.level >= 3 ? 1 : 0] : 0)
    + (job?.track === "streaming" ? CAMPAIGN.background.streamingPoints : 0)
    + (job?.track === "law" ? CAMPAIGN.background.lawPoints : 0);
  const places: CampaignState["places"] = {};
  for (const p of content.places) {
    const lean = (c.places[p.id] ?? 0) + (input.home === p.id ? 3 : 0);
    places[p.id] = { you: round1(clamp(16 + cloutBonus + lean + (rng() - 0.5) * 2)), mayor: round1(clamp(p.mayor + (rng() - 0.5) * 2)) };
  }
  // Option C: a Halo manager starts the candidate a little cleaner, a Hustler a little dirtier.
  const start = clamp(CAMPAIGN.integrityStart[c.id] + (input.band === "high" ? CAMPAIGN.rep.startBonus : input.band === "low" ? -CAMPAIGN.rep.startBonus : 0));
  const trust: Record<string, number> = {};
  for (const s of content.stakeholders) trust[s.id] = c.warm.includes(s.id) ? 1 : c.cold.includes(s.id) ? -1 : 0;
  const state: CampaignState = {
    v: 1, id: input.id, candidate: c.id, week: 1, phase: "planning", endedOn: null,
    places, cash: c.cash + input.seed, raised: 0, seeded: input.seed, skimmed: 0,
    favors: 0, dirtyFavors: 0, heat: 0, integrity: start, intel: 0, morale: 70, startIntegrity: start, repMark: start, rep: [],
    staff: content.staff.map((s) => ({ id: s.id, competence: 50 + Math.floor(rng() * 30), morale: 70 + (job?.track === "hospitality" ? CAMPAIGN.background.hospitalityMorale : job?.track === "fashion" ? CAMPAIGN.background.fashionMorale : 0), loyalty: c.id === "kowalczyk" ? 80 : 60 + Math.floor(rng() * 15), out: false })),
    trust, budget: { digital: 0, street: 0, tv: 0 }, slots: Array(CAMPAIGN.slots).fill(null),
    inbox: [], pending: [], seen: [], traces: [], factChecks: [], dirtyOps: 0, exposures: 0, events: [], prepped: [],
    debate: null, recap: null, receipts: [], log: [], election: null, ending: null,
    links: { clout: input.clout, crew: input.crew, home: input.home, fundMult: (1 + Math.min(1, Math.max(0, input.clout) / 5000)) * (job?.track === "tech" ? CAMPAIGN.background.techFunds : job?.track === "finance" ? CAMPAIGN.background.financeFunds : job?.track === "realestate" ? CAMPAIGN.background.realestateFunds : 1), wonBefore: input.wonBefore, band: input.band ?? undefined },
    earned: 0, dilemmas: {}, turnout: {}, queue: [], before: null,
  };
  if (job) {
    const line = CAMPAIGN.background.lines[job.track];
    state.receipts.push(line);
    state.log.push({ week: 1, text: line });
  }
  deliverInbox(content, state);
  drawTasks(content, state, rng);
  return state;
}

function deliverInbox(content: CampaignContent, state: CampaignState) {
  for (const m of content.inbox) {
    // Option C: a Hustler manager hears from the anonymous offers a week early.
    const early = state.links.band === "low" && m.kind === "anonymous" && m.week === state.week + 1;
    if (m.week !== state.week && !early) continue;
    if (m.candidates && !m.candidates.includes(state.candidate)) continue;
    if (!state.inbox.some((x) => x.id === m.id)) state.inbox.push({ id: m.id, status: "new" });
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Effects
// ---------------------------------------------------------------------------------------------------------------

/** Moves both ratings in one place, keeping at least 5 points undecided. */
function bump(state: CampaignState, place: string, you: number, mayor: number) {
  const r = state.places[place];
  if (!r) return;
  r.you = clamp(r.you + you);
  r.mayor = clamp(r.mayor + mayor);
  const over = r.you + r.mayor - 95;
  if (over > 0) {
    const t = r.you + r.mayor;
    r.you -= (over * r.you) / t;
    r.mayor -= (over * r.mayor) / t;
  }
  r.you = round1(r.you);
  r.mayor = round1(r.mayor);
}

/** Campaigning wins voters, and some of them were the Mayor's: a gain takes 30% of itself off him. */
function gain(state: CampaignState, place: string, amount: number) {
  bump(state, place, amount, -round1(amount * 0.3));
}
function gainAll(state: CampaignState, amount: number) {
  for (const id of Object.keys(state.places)) gain(state, id, amount);
}

function bumpAll(state: CampaignState, you: number, mayor: number) {
  for (const id of Object.keys(state.places)) bump(state, id, you, mayor);
}

export function applyEffects(state: CampaignState, e: Effects, place: string | undefined, integrityMult = 1) {
  if (e.rating) bumpAll(state, e.rating, 0);
  if (e.mayor) bumpAll(state, 0, e.mayor);
  if (e.place) bump(state, place ?? weakestPlace(state), e.place, 0);
  if (e.cash) { state.cash = Math.max(0, state.cash + e.cash); if (e.cash > 0) state.raised += e.cash; }
  if (e.heat) state.heat = clamp(state.heat + e.heat);
  if (e.integrity) state.integrity = clamp(state.integrity + (e.integrity < 0 ? e.integrity * integrityMult : e.integrity));
  if (e.morale) state.morale = clamp(state.morale + e.morale);
  if (e.favors) state.favors = Math.max(0, state.favors + e.favors);
  if (e.dirtyFavors) state.dirtyFavors = Math.max(0, state.dirtyFavors + e.dirtyFavors);
  if (e.intel) state.intel = Math.max(0, state.intel + e.intel);
  if (e.ally) state.trust[e.ally] = Math.max(state.trust[e.ally] ?? 0, 1);
}

export function weakestPlace(state: CampaignState): string {
  return Object.entries(state.places).sort((a, b) => (a[1].you - a[1].mayor) - (b[1].you - b[1].mayor))[0]?.[0] ?? "";
}

function addTrace(state: CampaignState, source: string, weight: number, skim?: number) {
  state.traces.push({ id: `${source}:${state.week}:${state.traces.length}`, source, weight, week: state.week, skim });
}

/** A choice or option: its effects, or what went wrong (the chance is never shown). Returns the receipt. */
function resolveChoice(state: CampaignState, c: Choice | InboxOption, place: string | undefined, mult: number, rng: Rng, source: string): string {
  if (c.fail && rng() < c.fail.chance) {
    applyEffects(state, c.fail.effects, place, mult);
    if (c.trace) addTrace(state, source, c.trace);
    return c.fail.receipt;
  }
  applyEffects(state, c.effects, place, mult);
  if (c.trace) addTrace(state, source, c.trace);
  return c.receipt;
}

const fill = (text: string, vars: Record<string, string>) => text.replace(/\{(\w+)\}/g, (m, k) => vars[k] ?? m);

function vars(content: CampaignContent, state: CampaignState, place?: string, target?: string): Record<string, string> {
  const c = candidateOf(content, state.candidate);
  return {
    candidate: c.short,
    place: content.places.find((p) => p.id === place)?.name ?? "",
    target: content.stakeholders.find((s) => s.id === target)?.name ?? content.staff.find((s) => s.id === target)?.name ?? "",
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Planning the week
// ---------------------------------------------------------------------------------------------------------------

function requirePlanning(state: CampaignState) {
  if (state.phase === "over") fail("no_campaign");
  if (state.phase === "deciding") fail("pending");
  if (state.phase !== "planning") fail("not_planning");
}

/** Brings a waiting campaign back to planning once the results' day has come. Returns true when it changed. */
export function refresh(state: CampaignState, today: string): boolean {
  if (state.phase === "waiting" && state.recap && today >= state.recap.revealOn) {
    state.phase = "planning";
    state.before = null;
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------------------------------------------
// Campaign daily tasks (content/campaign/tasks.json): two a week, one from the campaign's state, one in the
// candidate's voice. Done is worked out from the week's plan and replies, and they pay at End Week.
// ---------------------------------------------------------------------------------------------------------------

const firstName = (name: string) => name.replace(/^(Dean|Pastor|Auntie|Dr\.)\s+/, "").split(" ")[0];

/** Draws this week's two tasks, if the week has none yet. */
export function drawTasks(content: CampaignContent, state: CampaignState, rng: Rng) {
  if (state.phase === "over" || state.tasks?.some((t) => t.week === state.week)) return;
  const place = (id: string) => content.places.find((p) => p.id === id)!;
  const margin = (id: string) => state.places[id].you - state.places[id].mayor;
  const ids = Object.keys(state.places);
  const weak = [...ids].sort((a, b) => margin(a) - margin(b))[0];
  const turf = [...ids].sort((a, b) => state.places[b].mayor - state.places[a].mayor)[0];
  const newMsg = (kind: string) => state.inbox.map((m) => content.inbox.find((x) => x.id === m.id && m.status === "new")).find((m) => m && (kind === "meeting" ? m.options.some((o) => o.meeting) : m.kind === kind));
  const tired = [...state.staff].filter((x) => !x.out).sort((a, b) => a.morale - b.morale)[0];
  const lastWeek = (state.tasks ?? []).filter((t) => t.week === state.week - 1).map((t) => t.id);
  const fit = (d: TaskDef): CampaignTask | null => {
    const base = { id: d.id, done: d.done, week: state.week };
    const who = (m: InboxMessage) => firstName(content.stakeholders.find((s) => s.id === m.from)?.name ?? "them");
    switch (d.when) {
      case "threat": case "request": case "meeting": {
        const m = newMsg(d.when);
        if (!m || m.from === "anon") return null;
        return { ...base, title: fill(d.title, { who: who(m) }), tag: d.tag, target: m.id };
      }
      case "weak": return margin(weak) < 0 ? { ...base, title: fill(d.title, { place: place(weak).short ?? place(weak).name }), tag: fill(d.tag, { n: String(Math.round(-margin(weak))) }), target: weak } : null;
      case "mayor_turf": return state.week >= 2 ? { ...base, title: fill(d.title, { place: place(turf).short ?? place(turf).name }), tag: d.tag, target: turf } : null;
      case "debate": {
        if (state.week !== CAMPAIGN.debateWeek) return null;
        const topic = ["weak", "rent", "transit", "safety"].find((t) => !state.prepped.includes(t));
        return topic ? { ...base, title: fill(d.title, { topic: topic === "weak" ? "weak spot" : topic }), tag: d.tag, target: topic } : null;
      }
      case "low_morale": return tired && tired.morale < 60 ? { ...base, title: fill(d.title, { staffer: firstName(content.staff.find((x) => x.id === tired.id)!.name) }), tag: d.tag } : null;
      case "election": return state.week === CAMPAIGN.weeks ? { ...base, title: fill(d.title, { place: place(weak).short ?? place(weak).name }), tag: d.tag, target: weak } : null;
      default: return null;
    }
  };
  const shared = content.tasks.shared.map(fit).filter((t): t is CampaignTask => !!t);
  const pickFrom = shared.filter((t) => !lastWeek.includes(t.id));
  const one = (pickFrom.length ? pickFrom : shared)[0] ?? null;
  const own = content.tasks.candidates[state.candidate].filter((d) => !lastWeek.includes(d.id) && !(state.tasks ?? []).some((t) => t.id === d.id));
  const d = own.length ? pick(rng, own) : pick(rng, content.tasks.candidates[state.candidate]);
  const spot = rallyPlaceFor(state, weak);
  const second: CampaignTask = { id: d.id, title: d.title, tag: fill(d.tag, { place: place(spot).short ?? place(spot).name }), done: d.done, week: state.week, target: d.done === "rally" || d.done === "tour" ? spot : undefined };
  state.tasks = [...(state.tasks ?? []).filter((t) => t.week >= state.week - 1), ...(one ? [one] : []), second];
}

function rallyPlaceFor(state: CampaignState, fallback: string): string {
  const ids = Object.keys(state.places);
  return ids[(state.week * 7 + state.candidate.length) % ids.length] ?? fallback;
}

/** Whether a task is done by this week's plan and replies. */
export function taskDone(t: CampaignTask, state: CampaignState): boolean {
  const slots = state.slots.filter(Boolean) as SlotAction[];
  const at = (k: SlotAction["kind"]) => slots.some((s) => s.kind === k && (!t.target || !("place" in s) || s.place === t.target));
  switch (t.done) {
    case "reply": return state.inbox.some((m) => m.id === t.target && m.status === "answered");
    case "meeting": return slots.some((s) => s.kind === "meeting" && s.message === t.target);
    case "visit": return at("rally") || at("tour");
    case "rally": return at("rally");
    case "tour": return at("tour");
    case "gotv": return at("gotv");
    case "donors": return slots.some((s) => s.kind === "donors");
    case "rest": return slots.some((s) => s.kind === "rest");
    case "prep": return slots.some((s) => s.kind === "prep" && (!t.target || s.topic === t.target));
  }
}

/** The one line that says how a task gets done (owner, Oct 29: no hidden actions). */
export function taskHow(t: CampaignTask, content: CampaignContent): string {
  const place = content.places.find((p) => p.id === t.target);
  const at = place ? ` in ${place.short ?? place.name}` : "";
  switch (t.done) {
    case "reply": return "Reply to their message in the Inbox";
    case "meeting": return "Accept the meeting in the Inbox";
    case "visit": return `Book a rally or tour stop${at}`;
    case "rally": return `Book a rally${at}`;
    case "tour": return `Book a tour stop${at}`;
    case "gotv": return `Book Get out the vote${at}`;
    case "donors": return "Book donor calls";
    case "rest": return "Book a rest day";
    case "prep": return t.target ? `Book debate prep: ${t.target === "weak" ? "your weak spot" : t.target}` : "Book debate prep";
  }
}

const spent = (state: CampaignState) => state.budget.digital + state.budget.street + state.budget.tv;

export function setBudget(state: CampaignState, budget: Record<"digital" | "street" | "tv", number>) {
  requirePlanning(state);
  const b = { digital: Math.max(0, Math.round(budget.digital)), street: Math.max(0, Math.round(budget.street)), tv: Math.max(0, Math.round(budget.tv)) };
  if (b.digital + b.street + b.tv > state.cash) fail("no_cash");
  state.budget = b;
}

const opCost: Record<OpId, { cash: number; favors: number }> = { fake_news: { cash: 5000, favors: 1 }, poach_ally: { cash: 15000, favors: 0 } };

function refundSlot(state: CampaignState, a: SlotAction | null) {
  if (a?.kind === "op" && a.paid) {
    state.cash += a.paid.cash;
    state.favors += a.paid.favors;
    state.dirtyFavors += a.paid.dirty;
  }
  if (a?.kind === "meeting") {
    const m = state.inbox.find((x) => x.id === a.message);
    if (m) { m.status = "new"; delete m.option; }
  }
}

/** Puts an action in a slot (or clears it with null). Ops are paid here and refunded if cleared. */
export function setSlot(content: CampaignContent, state: CampaignState, index: number, action: SlotAction | null) {
  requirePlanning(state);
  if (index < 0 || index >= CAMPAIGN.slots) fail("unknown");
  const old = state.slots[index];
  if (old?.kind === "meeting" && action) fail("unknown");
  refundSlot(state, old);
  state.slots[index] = null;
  if (!action) return;
  const placeIds = new Set(content.places.map((p) => p.id));
  if ((action.kind === "rally" || action.kind === "tour" || action.kind === "gotv") && !placeIds.has(action.place)) fail("unknown");
  if (action.kind === "gotv" && state.week !== CAMPAIGN.weeks) fail("unknown");
  if (action.kind === "prep") { const topic = action.topic; if (!content.debate.topics.some((t) => t.id === topic)) fail("unknown"); }
  if (action.kind === "meeting") fail("unknown"); // meetings come from inbox replies
  if (action.kind === "op") {
    const c = candidateOf(content, state.candidate);
    if (c.refuses.includes(action.op) && !action.persuaded) fail("refused");
    if (action.op === "fake_news" && !placeIds.has(action.target)) fail("unknown");
    const target = action.target;
    if (action.op === "poach_ally" && !content.stakeholders.some((s) => s.id === target && s.mayorAlly)) fail("unknown");
    const base = opCost[action.op];
    // Poach Ally: C$15,000 or 3 Favors. A cut-out costs half as much again.
    const useFavors = action.op === "poach_ally" && state.favors + state.dirtyFavors >= 3 && state.cash < base.cash;
    const cash = useFavors ? 0 : Math.round(base.cash * (action.cutout ? 1.5 : 1));
    const favors = useFavors ? 3 : base.favors;
    if (cash > state.cash - spent(state)) fail("no_cash");
    if (favors > state.favors + state.dirtyFavors) fail("no_favors");
    const dirty = Math.min(state.dirtyFavors, favors);
    state.cash -= cash;
    state.dirtyFavors -= dirty;
    state.favors -= favors - dirty;
    action = { ...action, paid: { cash, favors: favors - dirty, dirty } };
  }
  state.slots[index] = action;
}

/** Answers an inbox message. A meeting books a slot (it happens at End Week); anything else happens now. */
export function reply(content: CampaignContent, state: CampaignState, messageId: string, optionId: string, rng: Rng): string {
  requirePlanning(state);
  const box = state.inbox.find((x) => x.id === messageId) ?? fail("unknown");
  if (box.status !== "new") fail("unknown");
  const msg = content.inbox.find((m) => m.id === messageId) ?? fail("unknown");
  const opt = msg.options.find((o) => o.id === optionId) ?? fail("unknown");
  if (opt.meeting) {
    if (state.slots.filter((s) => s?.kind === "meeting").length >= CAMPAIGN.maxMeetings) fail("meetings_full");
    const free = state.slots.findIndex((s) => s === null);
    if (free < 0) fail("no_slot");
    state.slots[free] = { kind: "meeting", message: msg.id, option: opt.id };
    box.status = "answered";
    box.option = opt.id;
    return "Booked. It's on the calendar.";
  }
  box.status = "answered";
  box.option = opt.id;
  if (opt.trust) state.trust[msg.from] = clamp((state.trust[msg.from] ?? 0) + opt.trust, -2, 2);
  if (opt.dirty) state.dirtyOps += 1;
  const receipt = resolveChoice(state, opt, opt.where, candidateOf(content, state.candidate).opIntegrity, rng, `inbox:${msg.id}`);
  const text = fill(receipt, vars(content, state));
  state.receipts.push(text);
  return text;
}

/** The budget dilemmas (spec section 11.2): skimming into the manager's own bank, and charity. */
export function dilemma(content: CampaignContent, state: CampaignState, id: "skim" | "charity", choice: string): { receipt: string; payouts: Payout[] } {
  requirePlanning(state);
  const key = id === "skim" ? `skim:${state.week}` : "charity";
  if (state.dilemmas[key]) fail("unknown");
  if (state.week < 2 || (id === "skim" && state.week > 3)) fail("unknown");
  const payouts: Payout[] = [];
  let receipt = "";
  if (id === "skim") {
    const room = skimRoom(state);
    const amount = choice === "lot" ? room : choice === "little" ? Math.floor(room / 2) : 0;
    if (choice !== "leave" && amount <= 0) fail("no_cash");
    if (amount > state.cash - spent(state)) fail("no_cash");
    if (amount > 0) {
      state.cash -= amount;
      state.skimmed += amount;
      state.integrity = clamp(state.integrity - (choice === "lot" ? 12 : 6));
      addTrace(state, "skim", choice === "lot" ? 0.6 : 0.35, amount);
      payouts.push({ currency: "cash", amount, kind: "campaign_skim", ref: `${state.id}:${state.week}` });
      receipt = `${cs(amount)} moved to your own account. Nobody saw. Probably.`;
    } else receipt = "You left the campaign's money alone. Your accountant exhales.";
  } else {
    const amount = 3000;
    if (choice !== "none") {
      if (amount > state.cash - spent(state)) fail("no_cash");
      state.cash -= amount;
      if (choice === "public") { bump(state, weakestPlace(state), 2, 0); receipt = `A big check for the food pantry, on camera. +2 where it counted.`; }
      else { state.integrity = clamp(state.integrity + 5); receipt = "An anonymous gift to the food pantry. They'll remember you."; }
    } else receipt = "No donation this time.";
  }
  state.dilemmas[key] = choice;
  state.receipts.push(receipt);
  state.log.push({ week: state.week, text: receipt });
  return { receipt, payouts };
}

// ---------------------------------------------------------------------------------------------------------------
// The debate (week 3): four rounds, played live
// ---------------------------------------------------------------------------------------------------------------

/** The debate's four questions: two of the city's issues, the Mayor on the candidate's weak spot, then money or the scandal. */
export function debateQuestions(content: CampaignContent, state: CampaignState): string[] {
  const qs = content.debate.questions;
  const issue = qs.filter((q) => q.by === "moderator" && q.topic !== "scandal" && q.topic !== "money").slice(0, 2);
  const weak = qs.find((q) => q.by === "mayor" && q.topic === state.candidate);
  const last = qs.find((q) => q.topic === (state.exposures > 0 ? "scandal" : "money"));
  return [...issue, weak, last].filter(Boolean).map((q) => q!.id);
}

export function debateRound(content: CampaignContent, state: CampaignState, style: DebateStyle, rng: Rng): { delta: number; line: string; done: boolean } {
  requirePlanning(state);
  if (state.week !== CAMPAIGN.debateWeek) fail("unknown");
  const ids = debateQuestions(content, state);
  if (!state.debate) state.debate = { round: 0, crowd: 0, rounds: [], done: false };
  const d = state.debate;
  if (d.done) fail("unknown");
  const q = content.debate.questions.find((x) => x.id === ids[d.round]) ?? fail("unknown");
  const c = candidateOf(content, state.candidate);
  let score = c.debate[style];
  const weakSpot = q.topic === state.candidate || q.topic === "scandal";
  if (style === "facts") score += state.prepped.includes(q.topic) || (weakSpot && state.prepped.includes("weak")) ? 2 : -1;
  if (style === "attack") { if (state.intel > 0) { score += 2; state.intel -= 1; } else score -= 1; }
  if (style === "deflect") score += weakSpot ? 1 : -1;
  if (style === "own") score += q.topic === "scandal" ? 2 : -1;
  if (style === "charm" && state.morale >= 70) score += 1;
  if (state.slots.every(Boolean)) score -= 1; // an overbooked week shows on stage
  const delta = Math.round(score - 2 + (rng() * 4 - 2));
  const s = content.debate.styles[style];
  const line = delta > 0 ? s.good : s.bad;
  d.crowd += delta;
  d.rounds.push({ q: q.id, style, delta, line });
  d.round += 1;
  if (d.round >= ids.length) {
    d.done = true;
    d.won = d.crowd > 0;
    const swing = clamp(d.crowd * 0.4, -4, 4);
    bumpAll(state, round1(swing), round1(-swing / 2));
    const text = d.won ? `Won the debate (crowd ${d.crowd > 0 ? "+" : ""}${d.crowd}). The snap poll likes ${c.short}.` : `Lost the debate (crowd ${d.crowd}). The clip everyone's sharing isn't a good one.`;
    state.receipts.push(text);
    state.log.push({ week: state.week, text });
  }
  return { delta, line, done: d.done };
}

// ---------------------------------------------------------------------------------------------------------------
// End Week: situations, then the week resolves (results revealed the next New York day)
// ---------------------------------------------------------------------------------------------------------------

function drawSituations(content: CampaignContent, state: CampaignState, rng: Rng, unlocked: readonly string[] = []): CampaignState["pending"] {
  const out: CampaignState["pending"] = [];
  for (const q of state.queue.splice(0, 2)) {
    const [trigger, arg] = q.split(":");
    const card = content.situations.find((s) => s.trigger === trigger);
    if (card) out.push({ id: card.id, target: arg });
  }
  const want = state.week === 1 ? 1 : 2;
  const pool = content.situations.filter((s) => !s.trigger && !state.seen.includes(s.id) && state.week >= s.weeks[0] && state.week <= s.weeks[1] && (!s.candidate || s.candidate === state.candidate)
    // Step 7: a gated situation only when the manager's memory unlocked it (the server works that out).
    && (!s.when || unlocked.includes(s.id)));
  // A situation from the manager's own past comes first (one a week).
  const mine = pool.filter((s) => s.when);
  if (mine.length && out.length < 3) {
    const s = pick(rng, mine);
    pool.splice(pool.indexOf(s), 1);
    out.push({ id: s.id, place: rallyPlace(state) ?? pick(rng, Object.keys(state.places)) });
  }
  for (const s of mine) if (pool.includes(s)) pool.splice(pool.indexOf(s), 1);
  // Each week leans toward a candidate card when one fits.
  const own = pool.filter((s) => s.candidate);
  while (out.length < Math.min(3, want + (out.length ? 1 : 0)) && pool.length) {
    const from = own.length && rng() < 0.5 ? own : pool;
    const s = pick(rng, from);
    pool.splice(pool.indexOf(s), 1);
    if (own.includes(s)) own.splice(own.indexOf(s), 1);
    const place = rallyPlace(state) ?? pick(rng, Object.keys(state.places));
    out.push({ id: s.id, place });
  }
  return out;
}

function rallyPlace(state: CampaignState): string | undefined {
  const a = state.slots.find((s) => s?.kind === "rally" || s?.kind === "tour");
  return a && "place" in a ? a.place : undefined;
}

export function endWeek(content: CampaignContent, state: CampaignState, today: string, rng: Rng, opts: { anyDay?: boolean; unlocked?: readonly string[] } = {}): { payouts: Payout[] } {
  requirePlanning(state);
  if (!opts.anyDay && state.endedOn === today) fail("ended_today");
  if (state.week === CAMPAIGN.debateWeek && !state.debate?.done) fail("debate_first");
  state.endedOn = today;
  state.receipts = [];
  state.before = JSON.parse(JSON.stringify(state.places));
  state.pending = drawSituations(content, state, rng, opts.unlocked);
  for (const p of state.pending) if (!state.seen.includes(p.id)) state.seen.push(p.id);
  if (state.pending.length) {
    state.phase = "deciding";
    return { payouts: [] };
  }
  return resolveWeek(content, state, today, rng);
}

/** Decides one waiting situation; the last one resolves the week. */
export function choose(content: CampaignContent, state: CampaignState, situationId: string, choiceId: string, today: string, rng: Rng): { receipt: string; payouts: Payout[] } {
  if (state.phase !== "deciding") fail("unknown");
  const i = state.pending.findIndex((p) => p.id === situationId);
  if (i < 0) fail("unknown");
  const p = state.pending[i];
  const card = content.situations.find((s) => s.id === situationId) ?? fail("unknown");
  const choice = card.choices.find((c) => c.id === choiceId) ?? fail("unknown");
  const c = candidateOf(content, state.candidate);
  let receipt = resolveChoice(state, choice, p.place, c.opIntegrity, rng, `card:${card.id}`);
  receipt = fill(receipt, vars(content, state, p.place, p.target));
  if (card.trigger === "exposure" && p.target) {
    const t = state.traces.find((x) => x.id === p.target);
    if (t) t.weight = 0;
  }
  if (card.trigger === "exposure") {
    const line = content.lines.scandal[choiceId];
    if (line) state.scandals = [...(state.scandals ?? []), { week: state.week, text: fill(line, vars(content, state)) }];
  }
  if (card.trigger === "poach" && p.target) {
    const s = state.staff.find((x) => x.id === p.target);
    if (s && choiceId === "let_go") s.out = true;
    if (s && choiceId === "counter") { s.loyalty = clamp(s.loyalty + 20); s.morale = clamp(s.morale + 10); }
  }
  state.receipts.push(receipt);
  state.log.push({ week: state.week, text: receipt });
  state.pending.splice(i, 1);
  if (state.pending.length) return { receipt, payouts: [] };
  return { receipt, ...resolveWeek(content, state, today, rng) };
}

const comp = (state: CampaignState, id: string) => {
  const s = state.staff.find((x) => x.id === id && !x.out);
  return s ? 0.8 + (s.competence / 100) * 0.4 * (0.6 + s.morale / 250) : 0.7;
};

function resolveWeek(content: CampaignContent, state: CampaignState, today: string, rng: Rng): { payouts: Payout[] } {
  const c = candidateOf(content, state.candidate);
  const before = citywide(state, content.places).you;
  const lines: string[] = [...state.receipts];
  const payouts: Payout[] = [];
  const visited = new Set<string>();
  const moraleMult = 0.7 + state.morale / 200;
  let darkThisWeek = state.dirtyOps;
  state.dirtyOps = 0;

  let donorTotal = 0;
  // 1. The calendar.
  for (const a of state.slots) {
    if (!a) continue;
    if (a.kind === "rally") { gain(state, a.place, round1(2.5 * comp(state, "field") * moraleMult * (0.4 + c.channels.street * 0.6))); visited.add(a.place); }
    if (a.kind === "tour") { gain(state, a.place, round1(1.5 * moraleMult)); visited.add(a.place); }
    if (a.kind === "donors") { const got = Math.round(4000 * c.donor * state.links.fundMult); state.cash += got; state.raised += got; donorTotal += got; }
    if (a.kind === "prep" && !state.prepped.includes(a.topic)) state.prepped.push(a.topic);
    if (a.kind === "rest") state.morale = clamp(state.morale + 8);
    if (a.kind === "gotv") state.turnout[a.place] = (state.turnout[a.place] ?? 0) + 1;
    if (a.kind === "meeting") {
      const msg = content.inbox.find((m) => m.id === a.message);
      const opt = msg?.options.find((o) => o.id === a.option);
      if (!msg || !opt) continue;
      if (opt.trust) state.trust[msg.from] = clamp((state.trust[msg.from] ?? 0) + opt.trust, -2, 2);
      lines.push(fill(resolveChoice(state, opt, opt.where, c.opIntegrity, rng, `meeting:${msg.id}`), vars(content, state)));
      // Semi-private and shadow meetings can be photographed (a trace).
      const seenChance = opt.meeting === "shadow" ? 0.35 : opt.meeting === "semi" ? 0.15 : 0;
      if (seenChance && rng() < seenChance) addTrace(state, `photo:${msg.id}`, opt.meeting === "shadow" ? 0.5 : 0.3);
      if (opt.meeting === "shadow" || opt.dirty) darkThisWeek += 1;
    }
    if (a.kind === "op") { lines.push(resolveOp(content, state, a, rng)); darkThisWeek += 1; }
  }
  if (donorTotal) lines.push(`Donor calls raised ${cs(donorTotal)}.`);
  const booked = state.slots.filter(Boolean).length;
  if (booked >= CAMPAIGN.slots) { state.morale = clamp(state.morale - 6); lines.push("A packed week. The team is running on cold brew."); }

  // 2. The budget, with diminishing returns.
  const b = state.budget;
  const total = Math.min(state.cash, b.digital + b.street + b.tv);
  const scale = total < b.digital + b.street + b.tv ? total / (b.digital + b.street + b.tv) : 1;
  state.cash -= total;
  const k = (amount: number) => Math.sqrt((amount * scale) / 1000);
  if (b.digital) gainAll(state, round1(k(b.digital) * 0.45 * c.channels.digital * comp(state, "comms") * (0.6 + rng() * 0.8)));
  if (b.tv) gainAll(state, round1(k(b.tv) * 0.55 * c.channels.tv * comp(state, "comms")));
  if (b.street) {
    const where = visited.size ? [...visited] : Object.keys(state.places);
    for (const p of where) gain(state, p, round1((k(b.street) * 1.2 * c.channels.street * comp(state, "field")) / where.length));
  }
  // Crew volunteers knock on doors in their home place (Kowalczyk's count double).
  if (state.links.crew && state.links.home) gain(state, state.links.home, round1(Math.min(3, state.links.crew * 0.3) * (c.id === "kowalczyk" ? 2 : 1)));

  // 3. Small-dollar money and payroll.
  const small = Math.round(1500 * c.donor * state.links.fundMult);
  state.cash += small;
  state.raised += small;
  const payroll = 1200;
  if (state.cash >= payroll) state.cash -= payroll;
  else { state.cash = 0; state.morale = clamp(state.morale - 15); for (const s of state.staff) s.loyalty = clamp(s.loyalty - 10); lines.push("Payroll bounced. The team noticed."); }

  // 4. The Mayor's machine: he fills the places nobody visited and cuts a ribbon somewhere.
  for (const p of Object.keys(state.places)) if (!visited.has(p)) bump(state, p, -0.3, 0.6);
  const ribbon = pick(rng, content.places);
  bump(state, ribbon.id, 0, 1.5);
  lines.push(fill(pick(rng, content.lines.ribbon), { place: ribbon.name }));
  if (darkThisWeek > 0 && rng() < 0.5 + state.heat / 150) {
    const hit = pick(rng, content.places);
    if (rng() < comp(state, "comms") - 0.55) lines.push("The Mayor's people tried a hit piece. Your comms team killed it by lunch.");
    else { bumpAll(state, -0.5, 0); bump(state, hit.id, -2, 0); lines.push(`The Mayor's people hit back in ${hit.name}. -2 there, -0.5 everywhere.`); }
  }

  // 5. Fact-checks on fake stories.
  for (const f of state.factChecks) {
    f.weeksLeft -= 1;
    if (rng() < CAMPAIGN.factCheckChance / 2) {
      f.weeksLeft = -1;
      bump(state, f.place, -4, 0);
      bumpAll(state, -1, 0.5);
      state.integrity = clamp(state.integrity - 8);
      state.heat = clamp(state.heat + 15);
      lines.push(content.lines.factCheck.debunked);
      if (!state.events.includes("lawsuit")) state.queue.push("lawsuit:defamation");
    }
  }
  state.factChecks = state.factChecks.filter((f) => f.weeksLeft > 0);

  // 6. The candidate goes off-script now and then.
  if (rng() < c.offScript.chance) {
    const o = pick(rng, c.offScript.lines);
    bumpAll(state, o.rating, 0);
    lines.push(o.text);
  }

  // 7. Heat cools; hidden traces roll for discovery (at most two exposures a campaign).
  state.heat = clamp(state.heat - CAMPAIGN.heatDecay);
  for (const t of state.traces) {
    if (t.weight <= 0) continue;
    const queued = state.queue.filter((q) => q.startsWith("exposure:")).length;
    if (state.exposures + queued < CAMPAIGN.exposuresPerCampaign && rng() < (state.heat / 100) * t.weight * 1.5) {
      state.queue.push(`exposure:${t.id}`);
      state.exposures += 1;
      if (t.skim) {
        // Exposure takes the money back: from the campaign first, then the manager's own bank.
        const fromCampaign = Math.min(state.cash, t.skim);
        state.cash -= fromCampaign;
        if (t.skim - fromCampaign > 0) payouts.push({ currency: "cash", amount: -(t.skim - fromCampaign), kind: "campaign_repay", ref: `${state.id}:${t.id}` });
        lines.push(`Someone found the skim. ${cs(t.skim)} went back where it came from.`);
      }
    } else t.weight = round1(t.weight * CAMPAIGN.traceDecay * 100) / 100;
  }

  // 8. The team: dirty play warns first, then may cost you (one incident a week at most).
  if (darkThisWeek > 0) {
    if (!state.events.includes("warned")) {
      state.events.push("warned");
      lines.push(fill(content.lines.warning, { name: staffName(content, "comms") }));
    } else {
      const chance = (state.traces.some((t) => t.week === state.week) ? CAMPAIGN.teamRisk.trace : CAMPAIGN.teamRisk.clean) + CAMPAIGN.teamRisk.perExtraOp * (darkThisWeek - 1) - (state.morale - 60) / 400;
      if (rng() < chance) {
        state.heat = clamp(state.heat + 8);
        addTrace(state, "leak", 0.3);
        const leaker = [...state.staff].filter((s) => !s.out).sort((a, b) => a.loyalty - b.loyalty)[0];
        lines.push(fill(content.lines.leak, { name: staffName(content, leaker?.id ?? "comms") }));
      } else lines.push(fill(pick(rng, content.lines.grumble), { name: staffName(content, "comms") }));
    }
  }

  // 9. Scripted trouble for the weeks ahead: one poach attempt (week 2), one lawsuit (week 3).
  if (state.week === 2 && !state.events.includes("poach")) {
    const target = [...state.staff].filter((s) => !s.out).sort((a, b) => a.loyalty - b.loyalty)[0];
    if (target) { state.queue.push(`poach:${target.id}`); state.events.push("poach"); }
  }
  if (state.week === 3 && !state.events.includes("lawsuit")) { state.queue.push("lawsuit:vendor"); state.events.push("lawsuit"); }
  if (state.queue.some((q) => q.startsWith("lawsuit")) && !state.events.includes("lawsuit")) state.events.push("lawsuit");

  // 10. Unanswered messages expire and cool those relationships.
  for (const m of state.inbox) if (m.status === "new") {
    const msg = content.inbox.find((x) => x.id === m.id);
    if (msg && msg.week <= state.week) { m.status = "expired"; state.trust[msg.from] = clamp((state.trust[msg.from] ?? 0) - 1, -2, 2); }
  }

  // 11. The poll, with a little noise.
  for (const p of Object.keys(state.places)) bump(state, p, round1((rng() - 0.5) * 1.2), round1((rng() - 0.5) * 1.2));
  const now = citywide(state, content.places);
  const change = round1(now.you - before);
  const clout = Math.min(CAMPAIGN.reward.pollWeekCap, Math.max(0, Math.round(change * CAMPAIGN.reward.pollPerPoint)));
  if (clout > 0) { state.earned += clout; payouts.push({ currency: "clout", amount: clout, kind: "campaign_poll", ref: `${state.id}:${state.week}` }); }

  // Option C: how the candidate's week rubs off on the manager (half the Integrity it moved, capped), shown in the recap.
  const mark = state.repMark ?? state.startIntegrity ?? CAMPAIGN.integrityStart[state.candidate];
  const applied = (state.rep ?? []).reduce((n, r) => n + r.delta, 0);
  const R = CAMPAIGN.rep;
  let nudge = Math.max(-R.weekCap, Math.min(R.weekCap, Math.round((state.integrity - mark) * R.factor)));
  nudge = Math.max(-R.campaignCap - applied, Math.min(R.campaignCap - applied, nudge));
  state.repMark = state.integrity;
  if (nudge) (state.rep ??= []).push({ week: state.week, delta: nudge });
  const repLine = nudge > 0 ? "😇 Running it straight is rubbing off on you." : nudge < 0 ? "💸 The campaign's habits are rubbing off on you." : null;
  const h = content.lines.headlines;
  const headline = fill(pick(rng, change > 0.5 ? h.up : change < -0.5 ? h.down : h.flat), { candidate: c.short, points: String(Math.abs(change)) });
  const mayorLine = pick(rng, change > 0.5 ? content.lines.mayor.up : content.lines.mayor.down);
  state.recap = { week: state.week, headline, lines: [...lines.slice(0, repLine ? 6 : 7), ...(repLine ? [repLine] : []), `Papa-Dani: "${fill(mayorLine, { candidate: c.short })}"`], you: now.you, mayor: now.mayor, change, revealOn: nextDay(today) };
  state.log.push({ week: state.week, text: `Week ${state.week}: ${change >= 0 ? "+" : ""}${change} (${now.you} vs ${now.mayor}).` });

  // 12. This week's campaign tasks pay (15 clout each, once).
  for (const t of (state.tasks ?? []).filter((x) => x.week === state.week)) {
    if (taskDone(t, state)) payouts.push({ currency: "clout", amount: CAMPAIGN.taskClout, kind: "campaign_task", ref: `${state.id}:${state.week}:${t.id}` });
  }

  // 13. The next week, or Election Day.
  if (state.week >= CAMPAIGN.weeks) {
    payouts.push(...runElection(content, state, rng));
    state.phase = "over";
  } else {
    state.week += 1;
    state.phase = "waiting";
    state.slots = Array(CAMPAIGN.slots).fill(null);
    state.budget = { digital: 0, street: 0, tv: 0 };
    deliverInbox(content, state);
    drawTasks(content, state, rng);
  }
  state.receipts = [];
  return { payouts };
}

function staffName(content: CampaignContent, id: string): string {
  return content.staff.find((s) => s.id === id)?.name.split(" ")[0] ?? "Someone";
}

function resolveOp(content: CampaignContent, state: CampaignState, a: Extract<SlotAction, { kind: "op" }>, rng: Rng): string {
  const c = candidateOf(content, state.candidate);
  if (a.persuaded) state.morale = clamp(state.morale - 10);
  const base = a.op === "fake_news" ? 0.7 : 0.6;
  const success = clamp(base + (comp(state, "comms") - 1) * 0.5, 0.2, 0.9);
  const roll = rng();
  const traceW = (a.op === "fake_news" ? 0.5 : 0.4) * (a.cutout ? 0.7 : 1);
  const place = content.places.find((p) => p.id === a.target);
  const who = content.stakeholders.find((s) => s.id === a.target);
  if (roll > 0.94) {
    state.heat = clamp(state.heat + 20);
    for (const s of state.staff) s.loyalty = clamp(s.loyalty - 10);
    addTrace(state, `op:${a.op}`, 0.8);
    return a.op === "fake_news" ? `Blown. The fake story was traced to your office in an afternoon. Heat +20.` : `Blown. ${who?.name ?? "The ally"} recorded the whole pitch. Heat +20.`;
  }
  if (roll >= success) {
    state.heat = clamp(state.heat + (a.op === "fake_news" ? 4 : 3));
    return a.op === "fake_news" ? "The fake story went nowhere. Nobody clicked. A small mercy." : `${who?.name ?? "The ally"} said no, and will be telling people you asked.`;
  }
  const withTrace = roll > success * 0.6 || (a.cutout && rng() < 0.2);
  if (withTrace) addTrace(state, `op:${a.op}`, traceW);
  if (a.op === "fake_news") {
    if (place) bump(state, place.id, 0, -2);
    bumpAll(state, 0, -0.5);
    state.heat = clamp(state.heat + 8);
    state.integrity = clamp(state.integrity - 5 * c.opIntegrity);
    if (place) state.factChecks.push({ place: place.id, weeksLeft: 2 });
    return `The story about the Mayor's ribbon budget ran${place ? ` in ${place.name}` : ""}. He's down. For now.`;
  }
  bumpAll(state, 1.5, -1.5);
  state.cash += 3000;
  state.raised += 3000;
  state.heat = clamp(state.heat + 6);
  state.integrity = clamp(state.integrity - 4 * c.opIntegrity);
  if (who) state.trust[who.id] = 1;
  if (rng() < 0.25) state.events.push(`doublecross:${who?.id ?? ""}`);
  return `${who?.name ?? "The ally"} switched sides, with a check. The Mayor's office is "focused on potholes."`;
}

/** Election Day (spec section 14.2): each place votes from both ratings, turnout and a little luck. */
function runElection(content: CampaignContent, state: CampaignState, rng: Rng): Payout[] {
  if (state.events.some((e) => e.startsWith("doublecross:"))) bumpAll(state, -2, 0);
  let youVotes = 0, mayorVotes = 0;
  state.election = content.places.map((p) => {
    const r = state.places[p.id];
    const undecided = 100 - r.you - r.mayor;
    const lean = r.you / Math.max(1, r.you + r.mayor);
    const gotv = state.turnout[p.id] ?? 0;
    let you = r.you + undecided * lean + gotv * 1.5 + (rng() - 0.5) * 4;
    let mayor = r.mayor + undecided * (1 - lean) + (rng() - 0.5) * 4;
    const t = you + mayor;
    you = round1((you / t) * 100);
    mayor = round1(100 - you);
    const turnout = round1(clamp(42 + gotv * 4 + (rng() - 0.5) * 6, 25, 75));
    youVotes += you * turnout * p.weight;
    mayorVotes += mayor * turnout * p.weight;
    return { place: p.id, you, mayor, turnout };
  });
  const won = youVotes > mayorVotes;
  const liveTraces = state.traces.some((t) => t.weight > 0.05);
  state.ending = !won ? "loss" : state.integrity >= CAMPAIGN.cleanIntegrity && !liveTraces ? "clean_win" : "dirty_win";
  const reward = endReward(state.ending, state.earned, state.links.wonBefore);
  return reward ? [{ currency: "clout", amount: reward, kind: "campaign_reward", ref: state.id }] : [];
}

// ---------------------------------------------------------------------------------------------------------------
// What the player sees
// ---------------------------------------------------------------------------------------------------------------

export interface CampaignView {
  id: string;
  candidate: CandidateId;
  week: number;
  weeks: number;
  phase: CampaignState["phase"];
  /** End Week already used today. */
  endedToday: boolean;
  you: number;
  mayor: number;
  places: { id: string; name: string; you: number; mayor: number; cares: string }[];
  cash: number;
  free: number;
  raised: number;
  favors: number;
  heat: number | null;
  integrity: number | null;
  morale: number | null;
  intel: number;
  staff: { id: string; name: string; role: string; job: string; morale: number; loyalty: number; out: boolean }[] | null;
  budget: CampaignState["budget"];
  slots: CampaignState["slots"];
  inbox: { message: InboxMessage; status: "new" | "answered" | "expired"; option?: string }[];
  pending: { situation: Situation; place?: string; target?: string }[];
  debate: (CampaignState["debate"] & { questions: string[] }) | null;
  debateWeek: boolean;
  prepped: string[];
  recap: CampaignState["recap"];
  /** The overnight results are in but not yet read (the morning paper). */
  recapReady: boolean;
  receipts: string[];
  log: CampaignState["log"];
  election: CampaignState["election"];
  ending: CampaignState["ending"];
  /** Which meters have appeared (spec section 8's gradual reveal). */
  shown: { favors: boolean; shadow: boolean; team: boolean };
  dilemmas: { skim: number | null; charity: boolean };
  refuses: OpId[];
  /** Lola's write-ups of the campaign's scandals (News → City), newest first. */
  scandals: { week: number; text: string }[];
  /** This week's campaign tasks, whether the plan does them, and how to do them (owner, Oct 29: every card says how). */
  tasks: (CampaignTask & { isDone: boolean; how: string })[];
  mayorAllies: { id: string; name: string; role: string }[];
}

export function campaignView(content: CampaignContent, state: CampaignState, today: string): CampaignView {
  const waiting = (state.phase === "waiting" || state.phase === "over") && !!state.recap && today < state.recap.revealOn;
  const recapReady = !!state.recap && today >= state.recap.revealOn;
  const shadow = state.integrity < (state.startIntegrity ?? CAMPAIGN.integrityStart[state.candidate]) || state.traces.length > 0 || state.inbox.some((m) => content.inbox.find((x) => x.id === m.id)?.kind === "anonymous");
  const team = state.week >= 2 || state.staff.some((s) => s.morale !== 70);
  // Until the reveal, the ratings stay where they stood when End Week was tapped.
  const shownPlaces = (waiting || state.phase === "deciding") && state.before ? state.before : state.places;
  const shownState = citywide({ places: shownPlaces }, content.places);
  const c = candidateOf(content, state.candidate);
  return {
    id: state.id,
    candidate: state.candidate,
    week: state.week,
    weeks: CAMPAIGN.weeks,
    phase: waiting ? "waiting" : state.phase,
    endedToday: state.endedOn === today,
    you: shownState.you,
    mayor: shownState.mayor,
    places: content.places.map((p) => ({ id: p.id, name: p.name, you: shownPlaces[p.id].you, mayor: shownPlaces[p.id].mayor, cares: p.cares })),
    cash: state.cash,
    free: state.cash - spent(state),
    raised: state.raised,
    favors: state.favors + state.dirtyFavors,
    heat: shadow ? state.heat : null,
    integrity: shadow ? state.integrity : null,
    morale: team ? state.morale : null,
    intel: state.intel,
    staff: team ? content.staff.map((s) => { const x = state.staff.find((y) => y.id === s.id)!; return { id: s.id, name: s.name, role: s.role, job: s.job, morale: x.morale, loyalty: x.loyalty, out: x.out }; }) : null,
    budget: state.budget,
    slots: state.slots,
    inbox: state.inbox.map((m) => ({ message: content.inbox.find((x) => x.id === m.id)!, status: m.status, option: m.option })).filter((m) => m.message)
      .map((m) => ({ ...m, message: hydrateMessage(content, state, m.message) })),
    pending: state.pending.map((p) => ({ situation: hydrate(content, state, content.situations.find((s) => s.id === p.id)!, p.place, p.target), place: p.place, target: p.target })),
    debate: state.debate || state.week === CAMPAIGN.debateWeek ? { ...(state.debate ?? { round: 0, crowd: 0, rounds: [], done: false }), questions: debateQuestions(content, state).map((id) => content.debate.questions.find((q) => q.id === id)!.text) } : null,
    debateWeek: state.week === CAMPAIGN.debateWeek,
    prepped: state.prepped,
    recap: recapReady ? state.recap : null,
    recapReady,
    receipts: state.receipts,
    log: state.log,
    election: state.phase === "over" && recapReady ? state.election : null,
    ending: state.phase === "over" && recapReady ? state.ending : null,
    shown: { favors: state.favors + state.dirtyFavors > 0 || state.inbox.some((m) => m.status !== "new"), shadow, team },
    dilemmas: {
      skim: state.week >= 2 && state.week <= 3 && !state.dilemmas[`skim:${state.week}`] && skimRoom(state) > 0 ? skimRoom(state) : null,
      charity: state.week >= 2 && !state.dilemmas.charity,
    },
    refuses: c.refuses,
    scandals: [...(state.scandals ?? [])].reverse().slice(0, 3),
    tasks: state.phase === "over" ? [] : (state.tasks ?? []).filter((t) => t.week === state.week).map((t) => ({ ...t, isDone: taskDone(t, state), how: taskHow(t, content) })),
    mayorAllies: content.stakeholders.filter((s) => s.mayorAlly && (state.trust[s.id] ?? 0) < 1).map((s) => ({ id: s.id, name: s.name, role: s.role })),
  };
}

/** A message as the player sees it: the names filled in, the outcomes and odds left out. */
function hydrateMessage(content: CampaignContent, state: CampaignState, m: InboxMessage): InboxMessage {
  const v = vars(content, state);
  return {
    ...m, subject: fill(m.subject, v), body: fill(m.body, v),
    options: m.options.map((o) => ({ id: o.id, label: fill(o.label, v), get: fill(o.get, v), cost: fill(o.cost, v), meeting: o.meeting, effects: {}, receipt: "" })),
  };
}

function hydrate(content: CampaignContent, state: CampaignState, s: Situation, place?: string, target?: string): Situation {
  const v = vars(content, state, place, target);
  return { ...s, text: fill(s.text, v), choices: s.choices.map((c) => ({ ...c, label: fill(c.label, v), get: fill(c.get, v), cost: fill(c.cost, v), receipt: "", fail: undefined, effects: {}, trace: undefined })) };
}

/** The player's candidate pick screen: everything about the four, nothing hidden. */
export function candidateCards(content: CampaignContent) {
  return content.candidates.map((c) => ({ id: c.id, name: c.name, short: c.short, title: c.title, slogan: c.slogan, emoji: c.emoji, bio: c.bio, issues: c.issues, satire: c.satire, cash: c.cash, integrity: CAMPAIGN.integrityStart[c.id] }));
}

export type CandidateCard = ReturnType<typeof candidateCards>[number];
export type { Place };
