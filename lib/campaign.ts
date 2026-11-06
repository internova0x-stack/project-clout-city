// Campaign Mode (docs/CAMPAIGN-MODE.md, spec v0.5; owner, Oct 29): the player manages a challenger's campaign
// against Mayor Papa-Dani, one campaign week per real New York day. This file is the shapes, the tunable numbers
// and the plain-language helpers; the rules live in lib/campaignEngine.ts (pure, every roll from an injected
// random source) and run on the server (app/home/campaignActions.ts) or in the preview's memory (lib/campaignSim.ts).
// The content (candidates, places, messages, situations, the debate) is content/campaign/*.json, passed in, so
// nothing here pulls the hidden odds into a player's bundle.

export type CandidateId = "goldcrest" | "castellano" | "kowalczyk" | "starr";
export type Channel = "digital" | "street" | "tv";
/** Owner, Nov 4: the week's budget also pays staff bonuses and community giving (absent on older campaigns: 0). */
export type Budget = Record<Channel, number> & { staff?: number; community?: number };
export type DebateStyle = "facts" | "charm" | "attack" | "deflect" | "own";
export type OpId = "fake_news" | "poach_ally";
export type Ending = "clean_win" | "dirty_win" | "loss";

/** The tunable numbers (spec sections 4, 8, 10, 13 and 15). */
export const CAMPAIGN = {
  unlockRank: 2,
  weeks: 4,
  slots: 10,
  maxMeetings: 3,
  debateWeek: 3,
  galaWeek: 2,
  /** Seeding from the manager's own bank, once, at the start (the test build has one act of money). */
  seedMax: 1000,
  /** Skimming: at most this share of the campaign's raised C$, and never more than skimCap in a campaign. */
  skimShare: 0.1,
  skimCap: 1500,
  /** A new campaign at most every this many days, one at a time. */
  restartDays: 7,
  heatDecay: 5,
  traceDecay: 0.9,
  exposuresPerCampaign: 2,
  factCheckChance: 0.35,
  integrityStart: { goldcrest: 55, starr: 60, kowalczyk: 75, castellano: 85 } as Record<CandidateId, number>,
  /**
   * Option C (owner, Oct 31): the manager's own Halo ↔ Hustler meter and the candidate's Integrity stay separate but
   * linked. Going in, a Halo manager starts the candidate a little cleaner and a Hustler a little dirtier (and gets the
   * anonymous offers a week early); coming out, each End Week moves the manager's meter by half of how far the
   * candidate's Integrity moved that week, both ways, at most ±8 a week and ±15 a campaign (migration 0142).
   */
  rep: { startBonus: 5, factor: 0.5, weekCap: 8, campaignCap: 15 },
  /**
   * Momentum and the candidate's Energy (owner, Nov 4: "momentum, morale, energy, integrity should be bars… World state
   * should react: when momentum is high, you should get more favors, but attacks to derail you should be more").
   * Every meter reads Low under `low`, High from `high`. Momentum follows the poll: each End Week it settles toward 50
   * and moves with the week's change (and the debate). High momentum brings a favor a week and draws the Mayor's
   * attacks; low momentum makes donors wait and see. Energy is spent by the calendar and won back by rest; a tired
   * candidate rallies worse and goes off-script more, a fresh one a little better.
   */
  meters: { low: 34, high: 67 },
  /**
   * The whole city votes (owner, Nov 4: "the mayor role is for the whole city"): Queens is the swing borough and carries
   * this share of the vote; the other boroughs (content.boroughs) take the rest. Citywide moves reach them at `reach`.
   */
  boroughs: { queens: 0.27, reach: 0.5, cloutShare: 0.5 },
  /**
   * The week's money (owner, Nov 4: "the calendar also has budgetary implications", "team salary, donations… seem
   * missing", steps of C$500). Calendar stops cost money, paid at End Week; payroll is fixed. Staff bonuses lift morale and
   * loyalty; community giving lifts Integrity and the whole city a little. Both are capped.
   */
  money: {
    step: 500,
    payroll: 1200,
    slotCost: { rally: 800, tour: 200, gotv: 500 } as Record<string, number>,
    small: 3000, donorCall: 4000,
    /** The campaign manager's fee (owner, Nov 4: a campaign is a full-time job, so the job goes on leave): paid from the
     * campaign's funds to the manager's own bank each campaign week (ledger 'campaign_fee', migration 0161). */
    fee: 300,
    staff: { per: 500, morale: 2, loyalty: 1, maxMorale: 10 },
    community: { per: 1000, integrity: 1, maxIntegrity: 4, rating: 0.2, maxRating: 0.8 },
  },
  momentum: {
    start: 50, keep: 0.6, perPoint: 12, debate: 10,
    highFavors: 1, highAttack: 0.5, attackBest: 1.5, attackAll: 0.3,
    lowDonors: 0.8,
  },
  energy: {
    start: 80, weekly: 10,
    cost: { rally: 12, tour: 6, donors: 4, prep: 4, gotv: 8, meeting: 4, op: 2, rest: -20 } as Record<string, number>,
    lowMult: 0.75, highMult: 1.1, lowOffScript: 1.5,
  },
  /** Careers part 3 (owner, Oct 31): the manager's job as campaign background. */
  background: {
    hospitalityMorale: 10, techFunds: 1.2, mediaPoints: 2,
    /** City Hall: points up across the city below Policy Aide, and from it. */
    cityhallPoints: [1, 2] as const,
    /** Streaming: chat shows up to vote. Fashion: the volunteers finally look good. */
    streamingPoints: 1, fashionMorale: 5,
    /** Finance: donors who golf. Real Estate: landlords who donate. Law: you know the election rules cold. */
    financeFunds: 1.3, realestateFunds: 1.15, lawPoints: 1,
    lines: {
      hospitality: "💼 You've run a floor before: the staff start in a better mood.",
      tech: "💼 Your startup contacts open their wallets: fundraising pays a fifth more.",
      media: "💼 People know your face from Clout TV: 2 points up across the city.",
      cityhall: "💼 You work in the Mayor's own office. You know his playbook, and he knows you know.",
      streaming: "💼 You told chat to register. Some of them did: 1 point up across the city.",
      fashion: "💼 You restyled the volunteers. They've never looked better, or worked harder.",
      realestate: "💼 Every landlord in Astoria has your number. Some of them write checks: fundraising pays 15% more.",
      finance: "💼 Your Court Square contacts golf with donors: fundraising pays 30% more.",
      law: "💼 You know election law cold. Every filing on time: 1 point up across the city.",
    } as Record<"hospitality" | "tech" | "media" | "cityhall" | "streaming" | "fashion" | "realestate" | "finance" | "law", string>,
  },
  cleanIntegrity: 70,
  /** Team trouble after dirty play (spec section 10). */
  teamRisk: { clean: 0.1, trace: 0.2, perExtraOp: 0.05 },
  /** Clout back into the main game. */
  /** Each campaign task pays this much clout at End Week (ledger 'campaign_task'). */
  taskClout: 15,
  reward: { finish: 100, win: 200, clean: 100, pollPerPoint: 5, pollWeekCap: 30, lossShare: 0.05, repeatWinFactor: 0.5 },
} as const;

/** "Low", "Medium", "High" with the color the meters use. */

// ---------------------------------------------------------------------------------------------------------------
// Content shapes (content/campaign/*.json)
// ---------------------------------------------------------------------------------------------------------------

/** What a choice does. Ratings are points; `place` lands on the place the card is about, `rating` citywide. */
export interface Effects {
  rating?: number;
  place?: number;
  mayor?: number;
  cash?: number;
  heat?: number;
  integrity?: number;
  morale?: number;
  favors?: number;
  dirtyFavors?: number;
  /** Intel on the Mayor's weak spots: makes Attack land in the debate. */
  intel?: number;
  /** A stakeholder (city.json) now on the campaign's side: a bought or won endorsement (owner, Oct 30). */
  ally?: string;
}

/** What a choice previews (owner, Oct 30/31: You get and It costs only; no risk labels or "may come back" hints anywhere). */
export interface Preview { get: string; cost: string }

export interface Choice extends Preview {
  id: string;
  label: string;
  effects: Effects;
  /** What can go wrong: its chance (never shown), what it does and the receipt then. */
  fail?: { chance: number; effects: Effects; receipt: string };
  receipt: string;
  /** A hidden trace of this weight (0 to 1), discovered later by Heat (spec section 13.4). */
  trace?: number;
}

export interface Issue { title: string; line: string; emoji?: string }

export interface Candidate {
  id: CandidateId;
  name: string;
  short: string;
  title: string;
  slogan: string;
  emoji: string;
  bio: string;
  issues: Issue[];
  satire: string;
  cash: number;
  donor: number;
  channels: Record<Channel, number>;
  debate: Record<DebateStyle, number>;
  /** Starting lean per place (points). */
  places: Record<string, number>;
  warm: string[];
  cold: string[];
  refuses: OpId[];
  refuseLine: string;
  opIntegrity: number;
  offScript: { chance: number; lines: { text: string; rating: number }[] };
  mayorJab: string;
}

export interface Place { id: string; name: string; weight: number; cares: string; mayor: number; /** For task cards. */ short?: string }

/** A campaign daily task (content/campaign/tasks.json): what finishes it, and when the shared ones fit. */
export type TaskDone = "reply" | "meeting" | "visit" | "rally" | "tour" | "donors" | "prep" | "rest" | "gotv";
export interface TaskDef { id: string; title: string; tag: string; done: TaskDone; when?: "threat" | "request" | "meeting" | "weak" | "mayor_turf" | "debate" | "low_morale" | "election" }
/** A task drawn for this week, its names filled in. `target` is the place, message or topic it's about. */
export interface CampaignTask { id: string; title: string; tag: string; done: TaskDone; target?: string; week: number }
/** age and vibe (owner, Nov 4): who they are at a glance; the portrait is public/cast/campaign-<id>.webp. */
export interface Staff { id: string; name: string; role: string; job: string; pronoun: "he" | "she"; age?: number; vibe?: string }
export interface Stakeholder { id: string; name: string; role: string; mayorAlly?: boolean; age?: number; vibe?: string }

export interface InboxOption extends Preview {
  id: string;
  label: string;
  /** Books a meeting into the week (resolved at End Week). */
  meeting?: "public" | "semi" | "shadow";
  effects: Effects;
  fail?: { chance: number; effects: Effects; receipt: string };
  receipt: string;
  trace?: number;
  /** Sets the stakeholder's trust (−2 to +2). */
  trust?: number;
  /** A dirty offer: counts as dark play for team trouble. */
  dirty?: boolean;
  /** The place a `place` effect lands on (a place id). */
  where?: string;
}
export interface InboxMessage {
  id: string;
  week: number;
  from: string;
  kind: "invite" | "request" | "tip" | "threat" | "anonymous";
  label: "Verified" | "Unverified" | "Anonymous";
  subject: string;
  body: string;
  /** Only for these candidates (none: everyone). */
  candidates?: CandidateId[];
  options: InboxOption[];
}

export interface Situation {
  id: string;
  weeks: [number, number];
  candidate?: CandidateId;
  /** Engine-made cards: exposure, poach, lawsuit, debunk. */
  trigger?: "exposure" | "poach" | "lawsuit" | "debunk";
  icon: string;
  text: string;
  choices: Choice[];
  /** Content Engine step 7 (lib/cardFormat.ts): a memory gate. Only campaigns whose manager's memory fits get it. */
  when?: import("./storylets.ts").When;
}

export interface DebateQuestion { id: string; topic: string; by: "moderator" | "mayor"; text: string }
export interface DebateContent {
  topics: { id: string; label: string }[];
  questions: DebateQuestion[];
  styles: Record<DebateStyle, { label: string; good: string; bad: string; preview: Preview }>;
}

/** Another borough (owner, Nov 4): mostly decided, moved only by citywide campaigning. weight is its share of the city. */
export interface Borough { id: string; name: string; weight: number; you: number; mayor: number; cares: string; leans: Partial<Record<CandidateId, number>> }

export interface CampaignContent {
  candidates: Candidate[];
  places: Place[];
  /** The other four boroughs; Queens (the places) is CAMPAIGN.boroughs.queens of the city. */
  boroughs: Borough[];
  staff: Staff[];
  stakeholders: Stakeholder[];
  inbox: InboxMessage[];
  situations: Situation[];
  debate: DebateContent;
  tasks: { shared: TaskDef[]; candidates: Record<CandidateId, TaskDef[]> };
  lines: {
    headlines: { up: string[]; down: string[]; flat: string[] };
    mayor: { up: string[]; down: string[] };
    neglect: string;
    ribbon: string[];
    grumble: string[];
    warning: string;
    leak: string;
    factCheck: { debunked: string; held: string };
    /** Lola's News line when a scandal breaks, by how the campaign answered it. */
    scandal: Record<string, string>;
  };
}

// ---------------------------------------------------------------------------------------------------------------
// The state (stored as jsonb on the server; the player only ever sees `CampaignView`)
// ---------------------------------------------------------------------------------------------------------------

export type SlotAction =
  | { kind: "rally"; place: string }
  | { kind: "tour"; place: string }
  | { kind: "donors" }
  | { kind: "prep"; topic: string }
  | { kind: "rest" }
  | { kind: "meeting"; message: string; option: string }
  | { kind: "op"; op: OpId; target: string; cutout: boolean; persuaded?: boolean; paid?: { cash: number; favors: number; dirty: number } }
  | { kind: "gotv"; place: string };

export interface StaffState { id: string; competence: number; morale: number; loyalty: number; out: boolean }

export interface Trace { id: string; source: string; weight: number; week: number; skim?: number }

export interface LogEntry { week: number; text: string }

export interface Recap {
  week: number;
  headline: string;
  lines: string[];
  /** The whole city (owner, Nov 4); queens is the swing borough's own poll and change (older recaps: none). */
  you: number;
  mayor: number;
  queens?: { you: number; mayor: number; change: number };
  change: number;
  /** Shown from this New York day (results arrive overnight). */
  revealOn: string;
}

export interface DebateState { round: number; crowd: number; rounds: { q: string; style: DebateStyle; delta: number; line: string }[]; done: boolean; won?: boolean }

/** borough: one of the other four boroughs (they report first on election night). */
export interface ElectionResult { place: string; you: number; mayor: number; turnout: number; borough?: boolean }

export interface CampaignState {
  v: 1;
  id: string;
  candidate: CandidateId;
  week: number;
  phase: "planning" | "deciding" | "waiting" | "over";
  /** The New York day End Week was last tapped. */
  endedOn: string | null;
  places: Record<string, { you: number; mayor: number }>;
  /** The other four boroughs' ratings (owner, Nov 4); campaigns from before have none (boroughsOf fills them in). */
  boroughs?: Record<string, { you: number; mayor: number }>;
  beforeBoroughs?: Record<string, { you: number; mayor: number }> | null;
  cash: number;
  raised: number;
  seeded: number;
  skimmed: number;
  favors: number;
  dirtyFavors: number;
  heat: number;
  integrity: number;
  intel: number;
  morale: number;
  /** Owner, Nov 4 (absent on campaigns from before: CAMPAIGN.momentum.start and CAMPAIGN.energy.start). */
  momentum?: number;
  energy?: number;
  staff: StaffState[];
  trust: Record<string, number>;
  budget: Budget;
  slots: (SlotAction | null)[];
  /** at: when it arrived (ISO), for the inbox's time stamp (owner, Nov 4); older campaigns have none. */
  inbox: { id: string; status: "new" | "answered" | "expired"; option?: string; at?: string; receipt?: string }[];
  /** Situations waiting for a choice during End Week. */
  pending: { id: string; place?: string; target?: string }[];
  seen: string[];
  /** Hidden from the player: discovery happens on the server. */
  traces: Trace[];
  factChecks: { place: string; weeksLeft: number }[];
  dirtyOps: number;
  exposures: number;
  events: string[];
  prepped: string[];
  debate: DebateState | null;
  recap: Recap | null;
  receipts: string[];
  log: LogEntry[];
  election: ElectionResult[] | null;
  ending: Ending | null;
  /** Clout bonuses, worked out at the start. */
  links: { clout: number; crew: number; home: string | null; fundMult: number; wonBefore: boolean; band?: "high" | "middle" | "low"; /** The underworld (migration 0148): the manager's Street Rep at the start. */ streetRep?: number };
  /** Option C: the candidate's Integrity at the start (after the manager's band), and where this week started. */
  startIntegrity?: number;
  repMark?: number;
  /** The manager's own meter nudges, one per End Week (the server applies each once: campaign_rep). */
  rep?: { week: number; delta: number }[];
  earned: number;
  dilemmas: Record<string, string>;
  /** This week's two campaign tasks (drawn when the week opens; done is worked out from the week's plan). */
  tasks?: CampaignTask[];
  /** Scandals Lola has written up (News → City), newest last. */
  scandals?: { week: number; text: string }[];
  /** Get-out-the-vote points per place (Election week). */
  turnout: Record<string, number>;
  /** Engine-made cards waiting for the next End Week: "exposure:<trace>", "poach", "lawsuit", "debunk". */
  queue: string[];
  /** The ratings as last week's paper printed them, shown until tonight's results are revealed. */
  before: Record<string, { you: number; mayor: number }> | null;
}

/** A payment into or out of the main game, which the server writes to the ledger once (ledger kind, ref). */
export interface Payout { currency: "cash" | "clout"; amount: number; kind: "campaign_seed" | "campaign_skim" | "campaign_repay" | "campaign_poll" | "campaign_reward" | "campaign_task" | "campaign_fee"; ref: string }

/** The other boroughs where a campaign starts: their lean for this candidate plus half the manager's fame. */
export function startBoroughs(content: Pick<CampaignContent, "boroughs">, candidate: CandidateId, cloutBonus = 0): Record<string, { you: number; mayor: number }> {
  const out: Record<string, { you: number; mayor: number }> = {};
  for (const b of content.boroughs) {
    out[b.id] = { you: Math.round((b.you + (b.leans[candidate] ?? 0) + cloutBonus * CAMPAIGN.boroughs.cloutShare) * 10) / 10, mayor: b.mayor };
  }
  return out;
}

/** The boroughs' ratings now (a campaign from before 0161 gets the start values). */
export function boroughsOf(state: Pick<CampaignState, "boroughs" | "candidate">, content: Pick<CampaignContent, "boroughs">): Record<string, { you: number; mayor: number }> {
  return state.boroughs ?? startBoroughs(content, state.candidate);
}

/** The whole city's poll: Queens (its places) at CAMPAIGN.boroughs.queens, plus every other borough by its weight. */
export function cityTotal(
  state: Pick<CampaignState, "places" | "boroughs" | "candidate">, content: Pick<CampaignContent, "places" | "boroughs">,
): { you: number; mayor: number } {
  const q = citywide(state, content.places);
  if (!content.boroughs.length) return q;
  const bs = boroughsOf(state, content);
  let you = q.you * CAMPAIGN.boroughs.queens, mayor = q.mayor * CAMPAIGN.boroughs.queens, w = CAMPAIGN.boroughs.queens;
  for (const b of content.boroughs) { const r = bs[b.id]; if (!r) continue; you += r.you * b.weight; mayor += r.mayor * b.weight; w += b.weight; }
  return { you: Math.round((you / w) * 10) / 10, mayor: Math.round((mayor / w) * 10) / 10 };
}

/** Queens' rating: its places weighted by population. (Named citywide from before the other boroughs.) */
export function citywide(state: Pick<CampaignState, "places">, places: Place[]): { you: number; mayor: number } {
  let you = 0, mayor = 0, w = 0;
  for (const p of places) {
    const r = state.places[p.id];
    if (!r) continue;
    you += r.you * p.weight; mayor += r.mayor * p.weight; w += p.weight;
  }
  return w ? { you: Math.round((you / w) * 10) / 10, mayor: Math.round((mayor / w) * 10) / 10 } : { you: 0, mayor: 0 };
}

/** Low, medium or high, for every campaign meter's bar (CAMPAIGN.meters). */
export type MeterLevel = "low" | "medium" | "high";
export function meterLevel(n: number): MeterLevel {
  return n < CAMPAIGN.meters.low ? "low" : n >= CAMPAIGN.meters.high ? "high" : "medium";
}

/** What a calendar slot costs in campaign cash (paid at End Week). */
export function slotCash(a: { kind: string } | null | undefined): number {
  return a ? CAMPAIGN.money.slotCost[a.kind] ?? 0 : 0;
}

/** The candidate's Energy a slot costs (rest gives it back). */
export function energyCost(a: { kind: string } | null | undefined): number {
  return a ? CAMPAIGN.energy.cost[a.kind] ?? 0 : 0;
}

/** "C$4,000". */
export function cs(n: number): string {
  return `${n < 0 ? "-" : ""}C$${Math.abs(Math.round(n)).toLocaleString("en-US")}`;
}

/** The skim a dilemma offers right now ("a little" is half of "a lot"), inside the share and the campaign cap. */
export function skimRoom(state: Pick<CampaignState, "raised" | "skimmed">): number {
  return Math.max(0, Math.min(Math.floor(state.raised * CAMPAIGN.skimShare), CAMPAIGN.skimCap) - state.skimmed);
}

/** The clout reward when a campaign ends (spec section 14.4), before any repeat-win halving. */
export function endReward(ending: Ending, earned: number, wonBefore: boolean): number {
  const r = CAMPAIGN.reward;
  if (ending === "loss") return r.finish - Math.round(earned * r.lossShare);
  const win = r.finish + r.win + (ending === "clean_win" ? r.clean : 0);
  return wonBefore ? Math.round(win * r.repeatWinFactor) : win;
}

/** The player-facing errors from campaign actions. */
export function campaignError(code: string): string {
  const map: Record<string, string> = {
    locked: `Campaign Mode opens at Rank ${CAMPAIGN.unlockRank}.`,
    running: "You're already running a campaign. One at a time, boss.",
    school_running: "You're running for Homecoming. One full-time race at a time.",
    too_soon: `A new campaign opens ${CAMPAIGN.restartDays} days after your last one started.`,
    no_campaign: "No campaign running.",
    not_planning: "The week's already in motion. Results arrive tomorrow morning.",
    ended_today: "One campaign week a day. The results arrive tomorrow morning.",
    no_cash: "The campaign can't afford that.",
    no_slot: "The week is full. Free a slot first.",
    meetings_full: `${CAMPAIGN.maxMeetings} meetings a week, max. Even you need sleep.`,
    no_favors: "Not enough Favors for that.",
    refused: "Your candidate won't do it.",
    pending: "Decide what's waiting first.",
    debate_first: "The debate's this week. Get on stage first.",
    bad_seed: `Seed up to ${cs(CAMPAIGN.seedMax)} from your own bank.`,
    no_bank: "Your bank can't cover that.",
    conflict: "Something changed. Try that again.",
    unknown: "That didn't work. Try again.",
  };
  return map[code] ?? map.unknown;
}

/** The content files as they're stored, put together (lib/campaignContent.ts for the app, readFileSync for tests). */
export function buildContent(files: {
  candidates: { candidates: Candidate[] };
  city: { places: Place[]; staff: Staff[]; stakeholders: Stakeholder[]; boroughs?: Borough[] };
  inbox: { messages: InboxMessage[] };
  situations: { situations: Situation[] };
  debate: DebateContent;
  lines: CampaignContent["lines"];
  tasks: CampaignContent["tasks"];
}): CampaignContent {
  return {
    candidates: files.candidates.candidates,
    places: files.city.places,
    boroughs: files.city.boroughs ?? [],
    staff: files.city.staff,
    stakeholders: files.city.stakeholders,
    inbox: files.inbox.messages,
    situations: files.situations.situations,
    debate: { topics: files.debate.topics, questions: files.debate.questions, styles: files.debate.styles },
    lines: files.lines,
    tasks: { shared: files.tasks.shared, candidates: files.tasks.candidates },
  };
}

// ---------------------------------------------------------------------------------------------------------------
// The screen's calls (app/home/campaignActions.ts on the server; lib/campaignSim.ts in the preview)
// ---------------------------------------------------------------------------------------------------------------

/** One challenger on the pick screen (nothing hidden about them). */
export interface CandidateCard {
  id: CandidateId; name: string; short: string; title: string; slogan: string; emoji: string; bio: string;
  issues: Issue[]; satire: string; cash: number; integrity: number;
}

export interface CampaignScreen {
  /** Rank 2 reached. */
  unlocked: boolean;
  rank: number;
  /** The manager's clout (the teaser's progress to Rank 2). */
  clout: number;
  /** A new campaign can start now (none running, the 7-day rule clear). */
  canStart: boolean;
  /** When the 7-day rule clears (New York date), if it hasn't. */
  nextStartOn: string | null;
  bank: number;
  candidates: CandidateCard[];
  wonBefore: CandidateId[];
  /** The running campaign, or the last one that ended (its results), or none. */
  view: import("./campaignEngine.ts").CampaignView | null;
  /** What just happened, after an action. */
  receipt?: string;
  round?: { delta: number; line: string };
  /** The manager's career job (owner, Nov 4): it goes on leave while a campaign runs. */
  job?: { employer: string; title: string; leave: boolean } | null;
}

export type CampaignResult<T> = { ok: true; data: T } | { ok: false; error: string };
type R = Promise<CampaignResult<CampaignScreen>>;

export interface CampaignApi {
  screen(): R;
  start(candidate: CandidateId, seed: number): R;
  budget(budget: Budget): R;
  slot(index: number, action: SlotAction | null): R;
  reply(message: string, option: string): R;
  dilemma(id: "skim" | "charity", choice: string): R;
  debate(style: DebateStyle): R;
  endWeek(): R;
  choose(situation: string, choice: string): R;
}

/** The New York date (YYYY-MM-DD) a moment falls on. */
export function nyDay(at: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(at);
}

/** The campaign place a player's home is in (their crew knocks doors there), or null. */
export function campaignHome(homeId: string | null | undefined): string | null {
  const h = homeId ?? "";
  if (h.startsWith("astoria")) return "astoria";
  if (h.startsWith("lic") || h.startsWith("hunters")) return "lic";
  if (h.startsWith("sunnyside") || h.startsWith("woodside")) return "sunnyside-woodside";
  if (h.startsWith("jackson")) return "jackson-heights";
  if (h.startsWith("flushing")) return "flushing";
  if (h.startsWith("jamaica")) return "jamaica";
  return null;
}
