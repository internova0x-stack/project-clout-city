// Campaign Mode (docs/CAMPAIGN-MODE.md, spec v0.5; owner, Oct 29): the player manages a challenger's campaign
// against Mayor Papa-Dani, one campaign week per real New York day. This file is the shapes, the tunable numbers
// and the plain-language helpers; the rules live in lib/campaignEngine.ts (pure, every roll from an injected
// random source) and run on the server (app/home/campaignActions.ts) or in the preview's memory (lib/campaignSim.ts).
// The content (candidates, places, messages, situations, the debate) is content/campaign/*.json, passed in, so
// nothing here pulls the hidden odds into a player's bundle.

export type CandidateId = "goldcrest" | "castellano" | "kowalczyk" | "starr";
export type Channel = "digital" | "street" | "tv";
export type Risk = "low" | "medium" | "high";
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
  cleanIntegrity: 70,
  /** Team trouble after dirty play (spec section 10). */
  teamRisk: { clean: 0.1, trace: 0.2, perExtraOp: 0.05 },
  /** Clout back into the main game. */
  /** Each campaign task pays this much clout at End Week (ledger 'campaign_task'). */
  taskClout: 15,
  reward: { finish: 100, win: 200, clean: 100, pollPerPoint: 5, pollWeekCap: 30, lossShare: 0.05, repeatWinFactor: 0.5 },
} as const;

/** "Low", "Medium", "High" with the color the meters use. */
export const RISK_LABEL: Record<Risk, string> = { low: "Low", medium: "Medium", high: "High" };

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
}

/** The "You get / It costs / Risk" preview every option shows (spec section 6.2). */
export interface Preview { get: string; cost: string; risk: Risk; why: string; later?: boolean }

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
export interface Staff { id: string; name: string; role: string; job: string; pronoun: "he" | "she" }
export interface Stakeholder { id: string; name: string; role: string; mayorAlly?: boolean }

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
}

export interface DebateQuestion { id: string; topic: string; by: "moderator" | "mayor"; text: string }
export interface DebateContent {
  topics: { id: string; label: string }[];
  questions: DebateQuestion[];
  styles: Record<DebateStyle, { label: string; good: string; bad: string; preview: Preview }>;
}

export interface CampaignContent {
  candidates: Candidate[];
  places: Place[];
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
  you: number;
  mayor: number;
  change: number;
  /** Shown from this New York day (results arrive overnight). */
  revealOn: string;
}

export interface DebateState { round: number; crowd: number; rounds: { q: string; style: DebateStyle; delta: number; line: string }[]; done: boolean; won?: boolean }

export interface ElectionResult { place: string; you: number; mayor: number; turnout: number }

export interface CampaignState {
  v: 1;
  id: string;
  candidate: CandidateId;
  week: number;
  phase: "planning" | "deciding" | "waiting" | "over";
  /** The New York day End Week was last tapped. */
  endedOn: string | null;
  places: Record<string, { you: number; mayor: number }>;
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
  staff: StaffState[];
  trust: Record<string, number>;
  budget: Record<Channel, number>;
  slots: (SlotAction | null)[];
  inbox: { id: string; status: "new" | "answered" | "expired"; option?: string }[];
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
  links: { clout: number; crew: number; home: string | null; fundMult: number; wonBefore: boolean };
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
export interface Payout { currency: "cash" | "clout"; amount: number; kind: "campaign_seed" | "campaign_skim" | "campaign_repay" | "campaign_poll" | "campaign_reward" | "campaign_task"; ref: string }

/** Citywide rating: places weighted by population. */
export function citywide(state: Pick<CampaignState, "places">, places: Place[]): { you: number; mayor: number } {
  let you = 0, mayor = 0, w = 0;
  for (const p of places) {
    const r = state.places[p.id];
    if (!r) continue;
    you += r.you * p.weight; mayor += r.mayor * p.weight; w += p.weight;
  }
  return w ? { you: Math.round((you / w) * 10) / 10, mayor: Math.round((mayor / w) * 10) / 10 } : { you: 0, mayor: 0 };
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
  city: { places: Place[]; staff: Staff[]; stakeholders: Stakeholder[] };
  inbox: { messages: InboxMessage[] };
  situations: { situations: Situation[] };
  debate: DebateContent;
  lines: CampaignContent["lines"];
  tasks: CampaignContent["tasks"];
}): CampaignContent {
  return {
    candidates: files.candidates.candidates,
    places: files.city.places,
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
}

export type CampaignResult<T> = { ok: true; data: T } | { ok: false; error: string };
type R = Promise<CampaignResult<CampaignScreen>>;

export interface CampaignApi {
  screen(): R;
  start(candidate: CandidateId, seed: number): R;
  budget(budget: Record<Channel, number>): R;
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
