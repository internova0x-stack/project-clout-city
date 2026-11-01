// Story Studio (/studio): what the admin page reads and asks for. The rules live in
// the admin_* SQL functions (supabase/migrations/0007); one approval puts a story
// on the schedule (product owner, Oct 12, 2026).

import type { EconomyAdmin, EconomyPhase, FlagOutcome } from "./playerEconomy.ts";
import type { MarketAdmin } from "./marketplace.ts";
import type { LetterStatus, MailbagFilter, StudioMailbag } from "./mayor.ts";
import type { Autopilot, AutopilotKind } from "./autopilot.ts";
import type { StoryletAction, StudioStorylets } from "./storyletWeeks.ts";
import type { StudioCondition } from "./cityConditions.ts";
import type { StudioUnderworldJob } from "./underworldWeeks.ts";
import type { StudioLearning } from "./cardLearning.ts";
import type { CatalogItem, EditableField, ShopFile } from "./shopCatalog.ts";
import type { GossipWeek } from "./gossip.ts";
import type { Insights } from "./insights.ts";
import type { PlayerFilter, PlayerList, PlayerProfile, PlayerSort } from "./adminPlayers.ts";
import type { Arc, Beat, Status } from "./stories.ts";
import type { NewsItem } from "./news.ts";
import type { HuntFile } from "./hunts.ts";
import type { ShoutoutAction, StudioShoutoutDay } from "./radio.ts";
import type { StudioBigScreen, TvAction } from "./cloutTv.ts";
import type { Affiliates, AffiliatesOverview, CreatorInput, CreatorPage, LinkInput, PayoutMethod, PayoutsAdmin, VideoInput, VideosAdmin } from "./creators.ts";

export type Review = "draft" | "approved" | "declined";

/**
 * Where a story stands for players, in one word (owner, Oct 18: "Approved" didn't say whether it was live).
 * Approval alone never puts a story live: a main story also needs a Day 1 (Schedule, or Go live now).
 */
export type Stage = "review" | "declined" | "ready" | "scheduled" | "live" | "finished" | "paused" | "retired";
export const STAGE_LABEL: Record<Stage, string> = {
  review: "Needs review", declined: "Declined", ready: "Not live", scheduled: "Scheduled", live: "Live",
  finished: "Finished", paused: "Paused", retired: "Retired",
};
export function storyStage(a: Pick<StudioArc, "type" | "status" | "review" | "startAt" | "day" | "lastDay">, parent?: Pick<StudioArc, "status" | "review" | "startAt" | "day" | "lastDay"> | null): Stage {
  if (a.status === "retired") return "retired";
  if (a.status === "paused") return "paused";
  if (a.review === "declined") return "declined";
  if (a.review !== "approved") return "review";
  if (a.day !== null) return a.day > a.lastDay ? "finished" : "live";
  // A side story runs with its main story, so it waits on the main's date.
  const start = a.type === "side" ? (parent && parent.status === "active" && parent.review === "approved" ? parent.startAt : null) : a.startAt;
  return start ? "scheduled" : "ready";
}

/** One row of admin_story_list(). */
export interface StudioArc {
  id: string;
  title: string;
  type: "main" | "side";
  tier: "free" | "premium";
  sku: string | null;
  parent: string | null;
  status: Status;
  review: Review;
  reviewNote: string | null;
  reviewedAt: string | null;
  startAt: string | null;
  /** Today's story day while live, else null. */
  day: number | null;
  lastDay: number;
  updatedAt: string;
  startWeekday: string | null;
  beats: { id: string; day: number; headline: string; status: Status; prediction: string | null }[] | null;
  votes: Record<string, number>;
  /** Its place in the Studio's list (migration 0071; null: after the ordered ones). */
  position?: number | null;
}

/**
 * What the Studio can change in a beat (owner, Oct 17: "click on the beats to read them and to edit them"):
 * the words only. Days, effects, answers and rewards stay as the file has them, so an edit can't break the
 * story's rules, and the story keeps its approval.
 */
export interface BeatText {
  news: { headline: string; body?: string; hook?: string; previously?: string | null }[];
  card_note?: string;
  evidence?: { title: string; lines: string[] };
  prediction?: { question: string; options: { id: string; label: string }[]; roasts?: Record<string, string> };
}

/** A beat's words, for the editor. */
export function beatText(b: Beat): BeatText {
  return {
    news: b.news.map((n) => ({ headline: n.headline, body: n.body, hook: n.hook, previously: n.previously })),
    card_note: b.card_note,
    evidence: b.evidence ? { title: b.evidence.title, lines: [...b.evidence.lines] } : undefined,
    prediction: b.prediction ? { question: b.prediction.question, options: b.prediction.options.map((o) => ({ id: o.id, label: o.label })), roasts: b.prediction.roasts ? { ...b.prediction.roasts } : undefined } : undefined,
  };
}

const clean = (s: string | undefined | null) => (typeof s === "string" ? s.trim() : s);

/**
 * The beat with new words and nothing else changed: same number of news items, same options (matched by id),
 * same roast keys. Empty optional text is dropped. Returns an error instead when the shape doesn't match.
 */
export function applyBeatText(b: Beat, t: BeatText): { ok: true; beat: Beat } | { ok: false; error: string } {
  if (!Array.isArray(t.news) || t.news.length !== b.news.length) return { ok: false, error: "A beat keeps its number of news items." };
  if (t.news.some((n) => !clean(n.headline))) return { ok: false, error: "Every news item needs a headline." };
  const news = b.news.map((n, i) => {
    const e = t.news[i];
    const out = { ...n, headline: clean(e.headline)! };
    for (const k of ["body", "hook"] as const) { const v = clean(e[k]); if (v) out[k] = v; else delete out[k]; }
    if ("previously" in n || e.previously) { const v = clean(e.previously); out.previously = v || null; }
    return out;
  });
  const beat: Beat = { ...b, news };
  const note = clean(t.card_note);
  if (note) beat.card_note = note; else delete beat.card_note;
  if (b.evidence) {
    if (!t.evidence || !clean(t.evidence.title)) return { ok: false, error: "The evidence needs a title." };
    beat.evidence = { ...b.evidence, title: clean(t.evidence.title)!, lines: t.evidence.lines.map((l) => l.trim()).filter(Boolean) };
  }
  if (b.prediction) {
    const p = t.prediction;
    if (!p || !clean(p.question)) return { ok: false, error: "The prediction needs a question." };
    const labels = new Map(p.options.map((o) => [o.id, clean(o.label)]));
    if (b.prediction.options.some((o) => !labels.get(o.id))) return { ok: false, error: "Every option needs a label." };
    beat.prediction = {
      ...b.prediction,
      question: clean(p.question)!,
      options: b.prediction.options.map((o) => ({ ...o, label: labels.get(o.id)! })),
      ...(b.prediction.roasts ? { roasts: Object.fromEntries(Object.entries(b.prediction.roasts).map(([k, v]) => [k, clean(p.roasts?.[k]) || v])) } : {}),
    };
  }
  return { ok: true, beat };
}

/** One report in the chat review queue (admin_reports, migration 0010). */
export interface StudioReport {
  id: number;
  reason: "harassment" | "spam" | "inappropriate" | "other";
  note: string | null;
  status: "open" | "dismissed" | "warned" | "muted" | "banned";
  at: string;
  reviewedAt: string | null;
  messageId: number | null;
  reporter: { id: string; name: string };
  reported: { id: string; name: string; warned: boolean; mutedUntil: string | null; banned: boolean; reports: number };
  messages: { id: number; from: string; body: string; at: string; reported: boolean }[];
}

/** The success metrics (admin_metrics, migration 0010; Clarifications section 8). */
export interface StudioMetrics {
  players: number;
  newThisWeek: number;
  firstTask: number;
  invited: number;
  invitesJoined: number;
  day1Cohort: number;
  day1Returned: number;
  activeToday: number;
  beatOpens: number;
  readers: number;
  votes: number;
  voters: number;
  purchases: Record<string, { count: number; cents: number }>;
  refunds: number;
  messagesToday: number;
  openReports: number;
}

export type Admin<T> = { ok: true; data: T } | { ok: false; error: string };

export type StudioResult = { ok: true; arcs: StudioArc[]; message?: string } | { ok: false; error: string; problems?: string[] };

export interface StudioApi {
  /** Adds or replaces arcs from a JSON file (one arc or a list). Validated first; changed arcs go back to draft. */
  upload(json: string): Promise<StudioResult>;
  review(arc: string, decision: Review, note: string): Promise<StudioResult>;
  /** Day 1 as YYYY-MM-DD (New York), or null to unschedule. */
  schedule(arc: string, start: string | null): Promise<StudioResult>;
  status(arc: string, status: Status): Promise<StudioResult>;
  beatStatus(arc: string, beat: string, status: Status): Promise<StudioResult>;
  /** Approves a main story and makes today its Day 1 (migration 0080). */
  goLive?(arc: string): Promise<StudioResult>;
  /** The Studio's order of stories (migration 0071): every id, top to bottom. */
  reorder?(ids: string[]): Promise<StudioResult>;
  /** A beat's words (migration 0071); the story keeps its approval. */
  beatEdit?(arc: string, beat: string, text: BeatText): Promise<StudioResult>;
  /** Full content of an arc and its side arcs, for the player preview. */
  content(arc: string): Promise<{ ok: true; arcs: Arc[] } | { ok: false; error: string }>;
  /** Chat review queue: open first, newest first. */
  reports?(status: "open" | "all"): Promise<Admin<StudioReport[]>>;
  reportAction?(id: number, action: "dismiss" | "warn" | "mute" | "ban"): Promise<Admin<null>>;
  metrics?(): Promise<Admin<StudioMetrics>>;
  /** Insights (migration 0053): the last `days` days (7 to 90). */
  insights?(days: number): Promise<Admin<Insights>>;
  /** Studio Players (migration 0055). */
  players?(query: string, filter: PlayerFilter, sort: PlayerSort, offset: number): Promise<Admin<PlayerList>>;
  player?(id: string): Promise<Admin<PlayerProfile>>;
  playerBan?(id: string, ban: boolean, reason: string): Promise<Admin<{ banned: boolean }>>;
  /** Affiliates (migration 0087): creators and their links, with numbers for the last `days` days (0 = all time). */
  affiliates?(days: number): Promise<Admin<Affiliates>>;
  creatorSave?(input: CreatorInput): Promise<Admin<string>>;
  linkSave?(input: LinkInput): Promise<Admin<number>>;
  linkStatus?(id: number, status: "active" | "retired"): Promise<Admin<null>>;
  /** Migration 0088: the Overview and one affiliate's page. */
  affiliatesOverview?(days: number): Promise<Admin<AffiliatesOverview>>;
  creatorPage?(id: string, days: number): Promise<Admin<CreatorPage>>;
  /** Migration 0090: payouts by hand. */
  payouts?(): Promise<Admin<PayoutsAdmin>>;
  payoutMark?(creatorId: string, method: PayoutMethod, reference: string, note: string, belowMinimum: boolean): Promise<Admin<{ id: number; totalCents: number }>>;
  payoutVoid?(id: number, reason: string): Promise<Admin<null>>;
  /** Migration 0091: paid videos, their fees and results. */
  videos?(): Promise<Admin<VideosAdmin>>;
  videoSave?(input: VideoInput): Promise<Admin<number>>;
  videoStatus?(id: number, status: "live" | "removed"): Promise<Admin<null>>;
  /** v0.6 regulars' lines (migration 0016). */
  castLines?(): Promise<Admin<CastLine[]>>;
  castAdd?(npc: string, line: string, kind: "line" | "update", weekOf: string | null): Promise<Admin<null>>;
  castStatus?(id: number, status: CastLine["status"]): Promise<Admin<null>>;
  /** v0.6 City News (migration 0017). Uploads are checked with lib/news.ts first. */
  newsList?(): Promise<Admin<NewsAdminItem[]>>;
  newsUpload?(json: string): Promise<Admin<number> & { problems?: string[] }>;
  newsStatus?(id: string, status: NewsAdminItem["status"]): Promise<Admin<null>>;
  newsReschedule?(id: string, day: string): Promise<Admin<null>>;
  /** v0.6 treasure hunts (migration 0018). Uploads are checked with lib/hunts.ts first. */
  huntList?(): Promise<Admin<HuntAdmin[]>>;
  huntUpload?(json: string): Promise<Admin<null> & { problems?: string[] }>;
  /** A note goes with "back to review" (migration 0019). */
  huntStatus?(id: string, status: HuntAdmin["status"], note?: string): Promise<Admin<null>>;
  /** Week files in the repo (content/hunts, content/news), for the calendar's one-tap load. */
  drafts?(): Promise<Admin<ContentDraft[]>>;
  /** v0.10 gossip (migration 0034): weeks go live on their own; the Studio reads, pauses or holds them. */
  gossipList?(): Promise<Admin<{ weeks: GossipAdmin[]; files: GossipFileCheck[] }>>;
  gossipStatus?(week: string, status: GossipAdmin["status"], note?: string): Promise<Admin<null>>;
  /** Autopilot (migration 0107): the switches, and flipping one. */
  autopilot?(): Promise<Admin<Autopilot>>;
  autopilotSet?(kind: AutopilotKind, on: boolean): Promise<Admin<Autopilot>>;
  /** Content Engine step 3 (migration 0139): the weekly storylets and their veto window. */
  storylets?(): Promise<Admin<StudioStorylets>>;
  storyletSet?(id: string, action: StoryletAction): Promise<Admin<StudioStorylets>>;
  /** Content Engine step 4 (migration 0140): city conditions (weekly and fired by the city's tallies). */
  conditions?(): Promise<Admin<StudioCondition[]>>;
  conditionSet?(id: string, action: StoryletAction): Promise<Admin<StudioCondition[]>>;
  /** The underworld, part 2 (migration 0150): each week's new jobs for Pablo and their veto window. */
  underworldJobs?(): Promise<Admin<StudioUnderworldJob[]>>;
  underworldJobSet?(id: string, action: StoryletAction): Promise<Admin<StudioUnderworldJob[]>>;
  /** Content Engine step 6 (migration 0141): what works: every card's numbers and weight, and the owner's override. */
  learning?(): Promise<Admin<StudioLearning>>;
  learningSet?(card: string, set: { weight: number; retired: boolean } | "auto"): Promise<Admin<StudioLearning>>;
  /** The Player Economy (migration 0151): phase switches, the week's numbers, the flag queue and frozen accounts. */
  economy?(): Promise<Admin<EconomyAdmin>>;
  economySet?(phase: EconomyPhase, on: boolean): Promise<Admin<EconomyAdmin>>;
  economyFlag?(id: number, outcome: FlagOutcome, note: string): Promise<Admin<EconomyAdmin>>;
  economyFreeze?(player: string, frozen: boolean, reason: string): Promise<Admin<EconomyAdmin>>;
  /** Phase 2 (migration 0152): Recent trades in the Economy tab, and reversing one after a reported theft. */
  marketRecent?(): Promise<Admin<MarketAdmin>>;
  marketReverse?(kind: "sale" | "trade", id: number, reason: string): Promise<Admin<MarketAdmin>>;
  /** Phase 3 (migration 0153): recent business and property sales, and reversing one within 7 days. */
  assetSales?(): Promise<Admin<import("./assetSales.ts").AssetAdmin>>;
  assetReverse?(id: number, reason: string): Promise<Admin<import("./assetSales.ts").AssetAdmin>>;
  /** Contact the Mayor (migration 0105): players' letters, marking them read or done, and writing back. */
  mailbag?(filter: MailbagFilter): Promise<Admin<StudioMailbag>>;
  letter?(id: number, status: LetterStatus, reply: string | null, filter: MailbagFilter): Promise<Admin<StudioMailbag>>;
  /** v0.14 Real Clout FM (migration 0057): a New York day's shoutout requests, and picking what airs. */
  shoutouts?(date?: string): Promise<Admin<StudioShoutoutDay>>;
  shoutoutAction?(id: number, action: ShoutoutAction): Promise<Admin<StudioShoutoutDay>>;
  /** v0.14 Clout TV (migration 0058): photo submissions by status, the rotation (one every 3 hours) and what's on screen. */
  bigScreen?(status: "pending" | "approved" | "featured" | "all"): Promise<Admin<StudioBigScreen>>;
  bigScreenAction?(id: number, action: TvAction): Promise<Admin<null>>;
  /** The Shop Manager (migration 0099; docs/shop-manager.md). */
  shopList?(): Promise<Admin<CatalogItem[]>>;
  shopFiles?(): Promise<Admin<ShopFile[]>>;
  /** Loads a repo catalog file (by name) or pasted JSON as drafts and picture matches. */
  shopImport?(source: { file: string } | { json: string }): Promise<Admin<ShopImportResult>>;
  /** Processes up to four items' pictures; the Studio calls it again until none are left. */
  shopProcessImages?(skus: string[]): Promise<Admin<{ sku: string; ok: boolean; error?: string }[]>>;
  /** approve (now, or at `at` for a drop), send_back (with a note), unschedule, retire, restore, delete. */
  shopAction?(skus: string[], action: ShopAction, opts?: { at?: string | null; note?: string; news?: boolean }): Promise<Admin<{ done: string[]; refused: { sku: string; reason: string }[] }>>;
  shopEdit?(sku: string, fields: Partial<Pick<CatalogItem, EditableField>>): Promise<Admin<null>>;
  shopAudit?(sku: string): Promise<Admin<ShopAuditRow[]>>;
  /** Clout Couture (migration 0102): the next drop of a sold-out numbered piece (optionally a new size), with Lola's News item. */
  shopNewDrop?(sku: string, size?: number | null): Promise<Admin<null>>;
  /** Clout Couture on the map (migration 0104): a map piece's owners, hiding a name, taking a statue off the plaza. */
  shopCoutureOwners?(sku: string): Promise<Admin<CoutureOwner[]>>;
  shopCoutureName?(player: string, sku: string, hidden: boolean): Promise<Admin<null>>;
  shopPlazaRemove?(week: string, reason: string): Promise<Admin<null>>;
  /** Setup check (owner, Oct 14): which key, migration or webhook is missing. Never returns a secret. */
  setupCheck?(): Promise<Admin<SetupCheckRow[]>>;
}

/** One line of the Studio's Setup check. */
export interface SetupCheckRow { group: string; label: string; state: "ok" | "warn" | "fail"; detail: string }

/** A gossip week as the Studio sees it. "approved" is live from its Monday (the default). */
export interface GossipAdmin {
  week: string;
  status: "review" | "approved" | "paused";
  data: GossipWeek;
  /** Why it's held (sent back with a note). */
  note?: string | null;
  /** Players who found at least one piece, and who finished, per story id. */
  started: Record<string, number>;
  finished: Record<string, number>;
}

/** A week file in content/gossip and whether it passes the checks (files that fail don't go live). */
export interface GossipFileCheck { week: string; file: string; ok: boolean; problems: string[]; stories: number }

/** A week file committed to content/ (by the weekly drafting routine or by hand). */
export interface ContentDraft {
  kind: "hunt" | "news";
  /** The Monday it's for. */
  week: string;
  file: string;
  json: string;
  /** What it is: the hunt's theme, or how many news items. */
  label: string;
}

/** A hunt as the Studio sees it: the whole file (answers included), its status and how it's going. */
export interface HuntAdmin {
  id: string;
  week: string;
  status: "review" | "approved" | "paused";
  data: HuntFile;
  /** Why it was sent back to review (migration 0019). */
  note?: string | null;
  joined: number;
  completed: number;
  /** Players still on each step (index 0 is step 1): where they get stuck. */
  atStep: number[];
}

export interface NewsAdminItem extends NewsItem {
  status: "review" | "approved" | "paused";
}

export interface CastLine {
  id: number;
  npc: string;
  line: string;
  kind: "line" | "update";
  /** Monday of the week it shows (YYYY-MM-DD), or null for every week. */
  weekOf: string | null;
  status: "review" | "approved" | "paused";
  at: string;
}

const ERRORS: Record<string, string> = {
  not_admin: "This account isn't a story admin.",
  // The Shop Manager (migration 0099).
  sold_retire_instead: "Someone owns this, so it can't be deleted. Retire it instead: owners keep it.",
  image_not_ready: "Process its picture first.",
  note_needed: "Write a note for the writer.",
  not_allowed: "That move isn't allowed from this status.",
  unknown_item: "That item isn't in the catalog anymore.",
  name_required: "Give the creator a name.",
  bad_code: "Codes are 3 to 16 letters and numbers.",
  code_taken: "Another creator already has that code.",
  bad_rate: "The rate goes from 0 to 50%.",
  bad_length: "Pick 12 months, 24 months or for life.",
  bad_gift_item: "The gift has to be a Shop fashion item (not a collector piece).",
  slug_taken: "That link is taken. Links are never deleted, so pick another.",
  bad_slug: "Links use letters, numbers and single hyphens, 2 to 40 of them.",
  no_creator: "That creator is gone.",
  no_link: "That link is gone.",
  bad_lands: "Pick where the link lands.",
  nothing_payable: "Nothing is payable for that creator right now.",
  below_minimum: "That's under the $50 minimum. Tick \"Pay below the minimum\" to pay it anyway.",
  bad_method: "Pick how it was paid.",
  reason_required: "Say why you're undoing it.",
  no_payout: "That payout is gone or already undone.",
  link_not_theirs: "That link belongs to another creator.",
  title_required: "Give the video a title.",
  bad_platform: "Pick a platform.",
  bad_fee: "The fee can't be negative.",
  no_video: "That video is gone.",
  is_admin: "That's a Studio admin. Remove them from story_admins first.",
  unknown_player: "That player isn't around anymore.",
  arc_is_live: "That story is live. Pause or retire it instead of changing it mid-run.",
  not_approved: "Approve the story before scheduling it.",
  start_in_past: "Day 1 can't be in the past.",
  wrong_weekday: "That's the wrong weekday for this story's start.",
  finale_collision: "Another story has its finale on the same day. Pick a different week.",
  side_arcs_follow_parent: "Side stories run with their main story; schedule the main story.",
  unknown_arc: "That story doesn't exist.",
  unknown_beat: "That beat doesn't exist.",
  bad_beat: "That edit would change more than the beat's words.",
  bad_arc: "That file isn't a story.",
  bad_status: "Unknown status.",
  bad_decision: "Unknown decision.",
  unknown_report: "That report is gone.",
  unknown_line: "That line is gone.",
  unknown_news: "That news item is gone.",
  bad_news: "That isn't a news week.",
  unknown_hunt: "That hunt is gone.",
  bad_hunt: "That isn't a hunt file.",
  hunts_week_key: "Another hunt already has that week. Run migration 0019 to let a new hunt replace one nobody has joined.",
  week_in_play: "Players have already joined this week's hunt, so it can't be replaced. Pause it, or use next week.",
  hunt_in_play: "Players have already joined this hunt, so it can't be changed. Pause it, or write next week's.",
  unknown_shoutout: "That shoutout is gone.",
  wall_full: "The wall is full for that day.",
  day_over: "That day's show is over.",
  unknown_submission: "That photo is gone.",
  not_pending: "That one was already reviewed.",
  not_featured: "That one isn't featured.",
};

export function studioError(message: string | undefined): string {
  if (message) for (const code of Object.keys(ERRORS)) if (message.includes(code)) return ERRORS[code];
  // A Studio button whose database function isn't there yet (a migration not run).
  const fn = message?.match(/function public\.(\w+)|function (\w+)\(/i);
  if (message && /schema cache|could not find the function|does not exist/i.test(message)) {
    return `The database is missing a step${fn ? ` (${fn[1] ?? fn[2]})` : ""}. Run the newest files in supabase/migrations; the Setup tab shows which.`;
  }
  return "The Studio glitched. Try again.";
}

/** Accepts one arc or a list of arcs. */
export function parseArcs(json: string): { arcs: Arc[] } | { error: string } {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return { error: "That isn't valid JSON." };
  }
  const list = Array.isArray(data) ? data : [data];
  if (!list.length || !list.every((a) => a && typeof a === "object" && typeof (a as Arc).id === "string" && Array.isArray((a as Arc).beats))) {
    return { error: "Each story needs an id and a beats list." };
  }
  return { arcs: list as Arc[] };
}

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

/** The next date on or after `from` that falls on `weekday` (default Sunday, the brief's start day). */
export function nextWeekday(from: string, weekday = "sunday"): string {
  const d = new Date(`${from}T12:00:00Z`);
  const want = Math.max(0, WEEKDAYS.indexOf(weekday));
  d.setUTCDate(d.getUTCDate() + ((want - d.getUTCDay() + 7) % 7));
  return d.toISOString().slice(0, 10);
}

export const weekdayOf = (day: string) => WEEKDAYS[new Date(`${day}T12:00:00Z`).getUTCDay()];

/** Shop Manager actions (docs/shop-manager.md section 1). */
export type ShopAction = "approve" | "send_back" | "unschedule" | "retire" | "restore" | "delete";
export interface ShopImportResult {
  added: string[]; updated: string[]; kept: string[]; unchanged: string[];
  /** Items on sale that got a new picture source, by name. */
  pictures: { name: string; skus: string[] }[];
  /** Picture names with no item on sale. */
  notFound: string[];
  problems: string[];
  /** Items whose picture is waiting to be processed. */
  toProcess: string[];
}
export interface ShopAuditRow { action: string; at: string; before: unknown; after: unknown; note: string | null; actor: string | null }

/** A map piece's owner as the Studio sees it (admin_couture_owners, migration 0104). */
export interface CoutureOwner { player: string; displayName: string; shown: string; edition: number | null; hidden: boolean; week: string | null }
