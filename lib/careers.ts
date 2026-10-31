// Careers, part 1 (owner, Oct 31: "go"; spec section 30, from "Clout City: Jobs and Careers" v0.1). Steady jobs with
// a ladder: apply in the Phone's Careers app, a short interview card, then one workday per New York day at the
// employer's place (Go to work: Hustle, Steady or Coast, then two or three tasks from the manager), a review every 7 New
// York days (payday, then a raise, a promotion, a warning, a demotion or the sack). Careers have nothing to do with the
// look or traits picked in the creator (owner, Oct 31: "both are separate"): anyone can apply to any track whose
// requirements they meet. Gigs and the casual shifts stay as they are; a workday is the day's work, so it can't follow
// a shift and no shift can follow it (migration 0135).
//
// Pure rules, every roll from an injected random source, like Campaign Mode: the server (app/home/careerActions.ts,
// crypto random, service role) and the preview (lib/careerSim.ts) run them. The task file (content/careers/tasks.json)
// holds the hidden outcomes, so only those two import lib/careersContent.ts; players get `careerView`.

export type TrackId = "hospitality" | "tech" | "media";
export type WorkStyle = "hustle" | "steady" | "coast";
export type SkillId = "cooking" | "charisma" | "fitness" | "smarts" | "music" | "hustle" | "dance" | "gossip" | "photography";
export type Persona = "supportive" | "micromanager" | "credit_stealer";
export type Answer = "honest" | "polish" | "connection";
export type Who = "manager" | "friend" | "rival";

export interface Person { name: string; emoji: string }
export interface Level {
  title: string;
  /** Weekly salary in C$ for five workdays. */
  salary: number;
  needs: { skills?: Partial<Record<SkillId, number>>; clout?: number };
}
export interface Track {
  id: TrackId;
  name: string;
  emoji: string;
  employer: string;
  /** The place the job is at (lib/city.ts): Go to work starts there. */
  place: string;
  blurb: string;
  keySkills: [SkillId, SkillId];
  manager: Person & { persona: Persona; style: string };
  friend: Person;
  rival: Person;
  /** What the job gives besides pay, by level (shown on the ladder). */
  perks: { level: number; text: string }[];
  levels: Level[];
}

export const TRACKS: Track[] = [
  {
    id: "hospitality", name: "Hospitality", emoji: "🍽️", employer: "The Gossip Group", place: "grind-and-gossip",
    blurb: "Run the floor at Astoria's loudest café. Everyone you serve has a secret, and a complaint.",
    keySkills: ["charisma", "cooking"],
    manager: { name: "Odette Vlahos", emoji: "👩‍🍳", persona: "supportive", style: "Supportive: fair reviews, real coaching" },
    friend: { name: "Bashir", emoji: "🧑‍🍳" }, rival: { name: "Kendall", emoji: "💁" },
    perks: [
      { level: 1, text: "Staff meal after every workday: +10 Energy" },
      { level: 3, text: "Tips: C$30 × your level a workday, paid on payday" },
    ],
    levels: [
      { title: "Host", salary: 600, needs: {} },
      { title: "Server", salary: 850, needs: { skills: { charisma: 2 } } },
      { title: "Bartender", salary: 1200, needs: { skills: { charisma: 3, cooking: 2 } } },
      { title: "Floor Manager", salary: 1700, needs: { skills: { charisma: 5, cooking: 3 } } },
      { title: "General Manager", salary: 2500, needs: { skills: { charisma: 6, cooking: 5 }, clout: 1000 } },
    ],
  },
  {
    id: "tech", name: "Tech", emoji: "💻", employer: "Pivotly", place: "triborough-works",
    blurb: "Skyler Beta's latest startup, on its fourth pivot. Free cold brew, no idea what the product is.",
    keySkills: ["smarts", "hustle"],
    manager: { name: "Dana Okafor", emoji: "👩‍💻", persona: "micromanager", style: "Micromanager: three tasks a day, every day" },
    friend: { name: "Mateo", emoji: "🧑‍💻" }, rival: { name: "Brent", emoji: "🧢" },
    perks: [
      { level: 1, text: "Free cold brew: +5 Energy after every workday" },
      { level: 3, text: "Work from anywhere: start your workday without going in" },
    ],
    levels: [
      { title: "Beta Tester", salary: 700, needs: { skills: { smarts: 2 } } },
      { title: "Junior Dev", salary: 1000, needs: { skills: { smarts: 3 } } },
      { title: "Product Person", salary: 1500, needs: { skills: { smarts: 4, hustle: 3 } } },
      { title: "Senior Engineer", salary: 2200, needs: { skills: { smarts: 6, hustle: 4 } } },
      { title: "Head of Growth", salary: 3200, needs: { skills: { smarts: 7, hustle: 6 }, clout: 2000 } },
    ],
  },
  {
    id: "media", name: "Media", emoji: "🎬", employer: "Clout TV", place: "clout-tower",
    blurb: "The Big Screen's newsroom. The pay starts low and the camera never does.",
    keySkills: ["gossip", "photography"],
    manager: { name: "Vivian Starke", emoji: "🕶️", persona: "credit_stealer", style: "Credit-stealer: your best ideas become hers" },
    friend: { name: "Nour", emoji: "🎬" }, rival: { name: "Jax Holloway", emoji: "🎤" },
    perks: [
      { level: 1, text: "Screen time: 5 × your level in clout every workday" },
      { level: 4, text: "Your face on the Big Screen's promos: double screen time" },
    ],
    levels: [
      { title: "Coffee Runner", salary: 500, needs: { skills: { gossip: 2 } } },
      { title: "Social Media Assistant", salary: 800, needs: { skills: { gossip: 2, photography: 2 } } },
      { title: "Reporter", salary: 1200, needs: { skills: { gossip: 4, photography: 3 } } },
      { title: "Producer", salary: 1800, needs: { skills: { gossip: 5, photography: 5 } } },
      { title: "On-Air Personality", salary: 2800, needs: { skills: { gossip: 7, photography: 6 }, clout: 5000 } },
    ],
  },
];

export const trackById = (id: string): Track | undefined => TRACKS.find((t) => t.id === id);

export const CAREER = {
  styles: {
    hustle: { emoji: "🔥", label: "Hustle", energy: 35, perf: 4, blurb: "Big gain, big Energy. Three in a row and you burn out." },
    steady: { emoji: "⚖️", label: "Steady", energy: 25, perf: 2, blurb: "The sensible default." },
    coast: { emoji: "🛋️", label: "Coast", energy: 12, perf: -2, blurb: "Saves Energy for tonight. Managers notice." },
  } as Record<WorkStyle, { emoji: string; label: string; energy: number; perf: number; blurb: string }>,
  /** A review (and payday) every 7 New York days from the hire. */
  reviewEvery: 7,
  /** Workdays a week the salary is for; each one missed below this costs performance at the review. */
  expectedDays: 5,
  missedPenalty: 4,
  /** A promotion needs this performance and trust, and as many good reviews at the level as the level's number. */
  promote: { perf: 75, trust: 60, creditStealerTrust: 70, reset: 50 },
  raise: { perf: 60, max: 2, pct: 0.1 },
  warn: { perf: 40, supportive: 35 },
  /** A review needs at least this many workdays, or it's a bad one whatever the performance. */
  minDays: 2,
  burnout: { streak: 3, mood: -10 },
  /** Clout for a promotion: this × the new level. */
  promoClout: 50,
  /** Waiting before applying again to the same track. */
  rehireDays: { fired: 7, quit: 2 },
  /** The interview's name-drop needs a crew or this much clout. */
  connectionClout: 500,
  /** An exaggerated interview is checked at each review with this chance, until it's caught once. */
  lieCheck: 0.3,
  history: 20,
  /** Part 2, office politics. */
  office: {
    moodStart: 60, miserable: 30, happy: 75,
    /** A landed joint project pays this share of the weekly salary. */
    teamBonus: 0.15,
    helpEnergy: 10,
    /** Sabotage traced back: the base chance, and more for each one before. */
    traced: { credit: 0.25, rumor: 0.35, per: 0.1 },
    /** Exposed this many times and coworkers' trust grows at half speed. */
    guarded: 2,
  },
} as const;

/** The task file: what the manager hands out, and what each answer does (hidden from players). */
export interface TaskOutcome {
  weight: number;
  text: string;
  perf: number;
  trust?: Partial<Record<Who, number>>;
  mood?: number;
}
export interface TaskOption { id: string; label: string; get: string; cost: string; outcomes: TaskOutcome[] }
export interface CareerTask {
  id: string; track: TrackId; minLevel: number; emoji: string; title: string; options: TaskOption[];
  /** Content Engine step 7 (lib/cardFormat.ts): a storylet gate. Only players whose memory fits get the task; {slot} names are filled. */
  when?: import("./storylets.ts").When;
  slots?: Record<string, import("./storylets.ts").SlotDef>;
}
export interface CareerContent {
  tasks: CareerTask[];
  /** End-of-day lines: the manager by trust band, the work friend and the rival. */
  lines: Record<TrackId, { manager: { high: string[]; mid: string[]; low: string[] }; friend: string[]; rival: string[] }>;
}

export interface CareerLog { day: string; kind: "hired" | "raise" | "promotion" | "review" | "warning" | "demotion" | "fired" | "quit" | "caught"; text: string }

export interface CareerState {
  v: 1;
  id: string;
  track: TrackId;
  level: number;
  raises: number;
  /** Good reviews at this level (a promotion needs as many as the level's number). */
  reviewsAtLevel: number;
  hiredOn: string;
  performance: number;
  trust: Record<Who, number>;
  warnings: number;
  demoted: boolean;
  /** Exaggerated in the interview, not caught yet. */
  lie: boolean;
  periodStart: string;
  nextReview: string;
  /** Workdays in this review period. */
  worked: string[];
  tips: number;
  hustleStreak: number;
  today: {
    day: string; style: WorkStyle;
    tasks: { id: string; picked: string | null; text: string | null; perf: number; names?: Record<string, string> }[];
    done: boolean; summary: string[];
  } | null;
  /** The last review, shown until the next workday. */
  review: { day: string; lines: string[]; pay: number; outcome: CareerLog["kind"] } | null;
  log: CareerLog[];
  status: "employed" | "fired" | "quit";
  endedOn: string | null;
  // ---- Part 2: office politics (optional, so jobs from part 1 carry on) ----
  /** How the job feels, 0 to 100 (starts at 60); it feeds the player's Mood and, at the ends, performance. */
  workMood?: number;
  /** Today's office moves: one collaborate and one sabotage a workday. */
  office?: { day: string; collab: boolean; sabotage: boolean };
  /** Who's holding a grudge, how badly (1 to 3) and when they strike next. */
  grudges?: Grudge[];
  /** A joint project, judged at the next review. */
  team?: { with: Peer; due: string } | null;
  /** A rumor you started: its target is busy defending themselves until then. */
  rumor?: { who: Who; until: string } | null;
  /** Sabotage done, and how often it was traced back to you (twice and everyone's guarded). */
  sabotages?: number;
  exposed?: number;
}

export type Peer = "friend" | "rival";
export interface Grudge { who: Who; level: number; due: string }
export type OfficeAction = "help" | "share" | "team" | "credit" | "report" | "rumor";

/** What the server reads from the player (career_context). */
export interface CareerCtx {
  clout: number;
  crew: number;
  energy: number;
  atPlace: string | null;
  shiftsToday: number;
  skills: Partial<Record<SkillId, number>>;
  /** Past jobs by track: the best level reached, how the last one ended and when. */
  past: Partial<Record<TrackId, { best: number; fired: number; lastStatus: "fired" | "quit" | null; lastEnded: string | null }>>;
  /** Step 7: gated tasks this player has unlocked, with their filled names (the server reads memory: lib/cardFormat.ts). */
  unlocked?: Record<string, Record<string, string>>;
}

export type Payout = { kind: "career_pay" | "career_promo" | "career_screen" | "career_team"; currency: "cash" | "clout"; amount: number; ref: string };
export interface Effects { energy?: number; mood?: number }

export class CareerError extends Error {
  code: string;
  constructor(code: string) { super(code); this.code = code; }
}

const ERRORS: Record<string, string> = {
  needs: "You don't meet this job's requirements yet.",
  employed: "You already have a job. Quit it first.",
  not_employed: "You don't have a job right now.",
  too_soon: "They're not hiring you back just yet.",
  no_connection: "Name-dropping needs a crew or 500 clout.",
  worked_today: "You've already worked today. Come back tomorrow.",
  shifted_today: "You already worked a shift today. Your job starts again tomorrow.",
  not_here: "Head to work first.",
  no_energy: "Not enough Energy for that. Eat, nap or pick an easier pace.",
  no_day: "Start your workday first.",
  bad_task: "That task isn't on today's list.",
  answered: "You've already handled that one.",
  not_working: "Office politics happen at work. Clock in first.",
  office_used: "You've already made a move like that today. Tomorrow.",
  team_busy: "You already have a joint project going.",
  bad_target: "That doesn't work on them.",
  conflict: "Something changed. Try again.",
  rate_limited: "Slow down. Work will still be there.",
  unknown: "Work is closed for a second. Try again.",
};
export const careerError = (code: string) => ERRORS[code] ?? ERRORS.unknown;

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Math.round(n)));
const dayNum = (d: string) => Math.floor(Date.parse(`${d}T12:00:00Z`) / 86_400_000);
export const addDays = (d: string, n: number) => new Date((dayNum(d) + n) * 86_400_000).toISOString().slice(0, 10);
export const daysBetween = (a: string, b: string) => dayNum(b) - dayNum(a);
type Rng = () => number;
const pick = <T,>(xs: readonly T[], rng: Rng): T => xs[Math.floor(rng() * xs.length) % xs.length];
function weighted<T extends { weight: number }>(xs: readonly T[], rng: Rng): T {
  let r = rng() * xs.reduce((s, x) => s + x.weight, 0);
  for (const x of xs) if ((r -= x.weight) < 0) return x;
  return xs[xs.length - 1];
}

/** The weekly salary at this level with its raises. */
export const salaryOf = (s: Pick<CareerState, "track" | "level" | "raises">) =>
  Math.round(trackById(s.track)!.levels[s.level - 1].salary * (1 + CAREER.raise.pct * s.raises));

/** What a level still needs, in words ("Aura 3", "1,000 clout"); empty when it's met. */
export function missing(track: Track, level: number, ctx: Pick<CareerCtx, "skills" | "clout">): string[] {
  const l = track.levels[level - 1];
  if (!l) return ["No such level"];
  const out: string[] = [];
  for (const [k, n] of Object.entries(l.needs.skills ?? {}) as [SkillId, number][]) {
    if ((ctx.skills[k] ?? 0) < n) out.push(`${SKILL_NAMES[k]} ${n}`);
  }
  if (l.needs.clout && ctx.clout < l.needs.clout) out.push(`${l.needs.clout.toLocaleString("en-US")} clout`);
  return out;
}
export const SKILL_NAMES: Record<SkillId, string> = {
  cooking: "Cooking", charisma: "Aura", fitness: "Fitness", smarts: "Smarts", music: "Music", hustle: "Hustle", dance: "Dance", gossip: "Gossip", photography: "Photography",
};

/** Where a hire starts: one below the best level reached before (unless the last job there ended in the sack), if met. */
export function startLevel(track: Track, ctx: Pick<CareerCtx, "skills" | "clout" | "past">): number {
  const p = ctx.past[track.id];
  const top = p && p.lastStatus !== "fired" ? Math.max(1, p.best - 1) : 1;
  for (let l = top; l > 1; l--) if (!missing(track, l, ctx).length) return l;
  return 1;
}

/** When this player may apply to a track again (null: now). */
export function rehireOn(track: TrackId, ctx: Pick<CareerCtx, "past">, today: string): string | null {
  const p = ctx.past[track];
  if (!p?.lastEnded || !p.lastStatus) return null;
  const on = addDays(p.lastEnded, CAREER.rehireDays[p.lastStatus]);
  return daysBetween(today, on) > 0 ? on : null;
}

/** The interview's three answers, as the card shows them. */
export const INTERVIEW: { id: Answer; label: string; get: string; cost: string }[] = [
  { id: "honest", label: "Tell it straight", get: "A clean start", cost: "Nothing to impress them with" },
  { id: "polish", label: "Polish the truth a little", get: "A better first impression", cost: "A story you'll have to keep up" },
  { id: "connection", label: "Name-drop someone", get: "The manager's trust, day one", cost: "Coworkers who know you got help" },
];

/** Hires the player: the interview answer sets where they start. */
export function hire(id: string, trackId: TrackId, ctx: CareerCtx, answer: Answer, today: string): CareerState {
  const track = trackById(trackId);
  if (!track) throw new CareerError("unknown");
  const level = startLevel(track, ctx);
  if (missing(track, level, ctx).length) throw new CareerError("needs");
  if (rehireOn(trackId, ctx, today)) throw new CareerError("too_soon");
  if (answer === "connection" && ctx.crew < 1 && ctx.clout < CAREER.connectionClout) throw new CareerError("no_connection");
  const firedBefore = (ctx.past[trackId]?.fired ?? 0) > 0;
  const trust = { manager: 55, friend: 50, rival: 45 };
  let performance = 50;
  if (answer === "polish") { performance = 55; trust.manager = 65; }
  if (answer === "connection") { trust.manager = 70; trust.rival = 25; }
  if (firedBefore) trust.manager -= 15;
  const title = track.levels[level - 1].title;
  return {
    v: 1, id, track: trackId, level, raises: 0, reviewsAtLevel: 0, hiredOn: today, performance, trust, warnings: 0, demoted: false,
    lie: answer === "polish", periodStart: today, nextReview: addDays(today, CAREER.reviewEvery), worked: [], tips: 0, hustleStreak: 0,
    today: null, review: null, status: "employed", endedOn: null,
    log: [{ day: today, kind: "hired", text: `Hired at ${track.employer} as ${title}.` }],
  };
}

function note(s: CareerState, day: string, kind: CareerLog["kind"], text: string) {
  s.log.unshift({ day, kind, text });
  s.log.length = Math.min(s.log.length, CAREER.history);
}

/** Step 7: fills a gated task's {slot} names (lib/cardFormat.ts fillNames, kept here so this file imports no engine). */
const names = (t: string, n: Record<string, string> | undefined) => (n ? t.replace(/\{([a-z_]+)\}/g, (all, k: string) => n[k] ?? all) : t);

const tasksFor = (s: CareerState, persona: Persona) => (persona === "micromanager" || s.level >= 3 ? 3 : 2);
const remote = (s: CareerState) => s.track === "tech" && s.level >= 3;

/** Starts today's workday: the pace, the Energy it costs, and the manager's tasks. */
export function startDay(content: CareerContent, s: CareerState, style: WorkStyle, ctx: CareerCtx, today: string, rng: Rng): { effects: Effects } {
  const track = trackById(s.track)!;
  if (s.status !== "employed") throw new CareerError("not_employed");
  if (s.today?.day === today || s.worked.includes(today)) throw new CareerError("worked_today");
  if (ctx.shiftsToday > 0) throw new CareerError("shifted_today");
  if (!remote(s) && ctx.atPlace !== track.place) throw new CareerError("not_here");
  const cost = CAREER.styles[style].energy;
  if (ctx.energy < cost) throw new CareerError("no_energy");
  // Step 7: a gated task only for players whose memory unlocked it, and at most one a day, first.
  const gated = (t: CareerTask) => !!(t.when || t.slots);
  const pool = content.tasks.filter((t) => t.track === s.track && t.minLevel <= s.level && (!gated(t) || ctx.unlocked?.[t.id]));
  const chosen: CareerTask[] = [];
  const mine = pool.filter(gated);
  if (mine.length) chosen.push(mine[Math.floor(rng() * mine.length) % mine.length]);
  const bag = pool.filter((t) => !gated(t));
  while (chosen.length < tasksFor(s, track.manager.persona) && bag.length) chosen.push(bag.splice(Math.floor(rng() * bag.length) % bag.length, 1)[0]);
  s.today = { day: today, style, tasks: chosen.map((t) => ({ id: t.id, picked: null, text: null, perf: 0, ...(ctx.unlocked?.[t.id] ? { names: ctx.unlocked[t.id] } : {}) })), done: false, summary: [] };
  s.worked.push(today);
  s.review = null;
  return { effects: { energy: -cost } };
}

const skillBonus = (s: CareerState, ctx: Pick<CareerCtx, "skills">) => {
  const [a, b] = trackById(s.track)!.keySkills;
  return Math.floor(((ctx.skills[a] ?? 0) + (ctx.skills[b] ?? 0)) / 2 / 3);
};

/** Handles one of today's tasks; the last one closes the day (summary, perks, lines). */
export function answerTask(content: CareerContent, s: CareerState, index: number, optionId: string, ctx: CareerCtx, rng: Rng):
  { effects: Effects; payouts: Payout[]; receipt: string } {
  const track = trackById(s.track)!;
  const persona = track.manager.persona;
  if (s.status !== "employed") throw new CareerError("not_employed");
  const day = s.today;
  if (!day || day.done) throw new CareerError("no_day");
  const slot = day.tasks[index];
  if (!slot) throw new CareerError("bad_task");
  if (slot.picked) throw new CareerError("answered");
  const task = content.tasks.find((t) => t.id === slot.id);
  const option = task?.options.find((o) => o.id === optionId);
  if (!task || !option) throw new CareerError("bad_task");
  const out = weighted(option.outcomes, rng);
  let perf = out.perf;
  if (perf > 0 && persona === "credit_stealer") perf = Math.round(perf * 0.8);
  for (const [w, d] of Object.entries(out.trust ?? {}) as [Who, number][]) {
    let delta = d;
    if (w === "manager" && persona === "supportive" && d > 0) delta = Math.round(d * 1.25);
    if (w === "manager" && persona === "micromanager" && d < 0) delta = Math.round(d * 1.25);
    s.trust[w] = clamp(s.trust[w] + delta);
  }
  slot.picked = option.id;
  slot.text = names(out.text, slot.names);
  slot.perf = perf;
  const effects: Effects = { mood: out.mood ?? 0 };
  const payouts: Payout[] = [];
  if (day.tasks.every((t) => t.picked)) {
    const closing = closeDay(content, s, ctx, rng);
    effects.mood = (effects.mood ?? 0) + (closing.mood ?? 0);
    effects.energy = closing.energy;
    payouts.push(...closing.payouts);
  }
  return { effects, payouts, receipt: out.text };
}

function closeDay(content: CareerContent, s: CareerState, _ctx: CareerCtx, rng: Rng): Effects & { payouts: Payout[] } {
  const track = trackById(s.track)!;
  const day = s.today!;
  const style = CAREER.styles[day.style];
  const lines: string[] = [];
  // The day's change: the pace, half the average task (a quarter when coasting), a little skill, a little luck.
  const avg = day.tasks.reduce((n, t) => n + t.perf, 0) / Math.max(1, day.tasks.length);
  let perf = style.perf + Math.round(avg * (day.style === "coast" ? 0.25 : 0.5)) + skillBonus(s, _ctx) + Math.round(rng() * 2 - 1);
  let mood = 0;
  let energy = 0;
  const payouts: Payout[] = [];
  s.hustleStreak = day.style === "hustle" ? s.hustleStreak + 1 : 0;
  if (s.hustleStreak >= CAREER.burnout.streak) {
    mood += CAREER.burnout.mood;
    perf -= 2;
    lines.push(`🥵 ${s.hustleStreak} hustle days in a row. You're running on fumes.`);
  }
  if (day.style === "coast" && rng() < 0.25) {
    s.trust.manager = clamp(s.trust.manager - 5);
    lines.push(`👀 ${track.manager.name.split(" ")[0]} noticed you coasting.`);
  }
  // A rival busy fending off a rumor has no time to take your credit.
  const rivalBusy = s.rumor?.who === "rival" && daysBetween(day.day, s.rumor.until) >= 0;
  if (s.trust.rival < 30 && !rivalBusy && rng() < 0.3) {
    perf -= 3;
    lines.push(`😒 ${track.rival.name} presented your work as a "team effort" in the meeting.`);
  }
  if (s.trust.friend >= 70 && rng() < 0.3) {
    perf += 2;
    lines.push(`🤝 ${track.friend.name} covered the boring part of your afternoon.`);
  }
  // Grudges: whoever you crossed gets even, the way the card warned (they cool off a level each time).
  for (const g of s.grudges ?? []) {
    if (daysBetween(g.due, day.day) < 0) continue;
    const r = revenge(track, g);
    perf += r.perf;
    s.trust.manager = clamp(s.trust.manager + r.manager);
    s.workMood = clamp((s.workMood ?? CAREER.office.moodStart) + r.workMood);
    mood += r.mood;
    lines.push(r.line);
    g.level -= 1;
    g.due = addDays(day.day, 3 + Math.floor(rng() * 4));
  }
  s.grudges = (s.grudges ?? []).filter((g) => g.level > 0);
  // Work mood: the boss, the work friend, the pace and how the tasks went.
  const persona = track.manager.persona;
  let wm = persona === "supportive" ? 2 : persona === "micromanager" ? -2 : -1;
  if (s.trust.friend >= 60) wm += 2;
  if (day.style === "hustle") wm -= 3;
  if (day.style === "coast") wm += 1;
  wm += avg > 0 ? 1 : -2;
  s.workMood = clamp((s.workMood ?? CAREER.office.moodStart) + wm);
  if (s.workMood < CAREER.office.miserable) {
    perf -= 2;
    mood -= 3;
    lines.push(`😩 You dread coming in (work mood ${s.workMood}). It shows in your work, and your evenings.`);
  } else if (s.workMood >= CAREER.office.happy) {
    perf += 1;
    mood += 2;
  }
  const before = s.performance;
  s.performance = clamp(s.performance + perf);
  const moved = s.performance - before;
  lines.push(`📊 Performance ${moved >= 0 ? "+" : "−"}${Math.abs(moved)} today (now ${s.performance}).`);
  // Perks.
  if (s.track === "hospitality") { energy += 10; if (s.level >= 3) s.tips += 30 * s.level; }
  if (s.track === "tech") energy += 5;
  if (s.track === "media") {
    const clout = 5 * s.level * (s.level >= 4 ? 2 : 1);
    payouts.push({ kind: "career_screen", currency: "clout", amount: clout, ref: `${s.id}:${day.day}` });
  }
  const L = content.lines[s.track];
  const band = s.trust.manager >= 65 ? "high" : s.trust.manager >= 40 ? "mid" : "low";
  lines.unshift(`${track.manager.emoji} ${track.manager.name.split(" ")[0]}: "${pick(L.manager[band], rng)}"`);
  lines.push(s.trust.friend >= 50 ? `${track.friend.emoji} ${track.friend.name}: "${pick(L.friend, rng)}"` : `${track.rival.emoji} ${track.rival.name}: "${pick(L.rival, rng)}"`);
  day.summary = lines;
  day.done = true;
  return { mood, energy, payouts };
}

/** Runs every review that's due (payday first), so a player who was away catches up. */
export function refresh(s: CareerState, today: string, ctx: Pick<CareerCtx, "skills" | "clout">, rng: Rng): { payouts: Payout[]; changed: boolean } {
  const payouts: Payout[] = [];
  let changed = false;
  if (s.today && s.today.day !== today && !s.today.done) {
    // An unfinished day counts as worked, with nothing more done.
    s.today.done = true;
    changed = true;
  }
  while (s.status === "employed" && daysBetween(s.nextReview, today) >= 0) {
    review(s, ctx, rng, payouts);
    changed = true;
  }
  return { payouts, changed };
}

function review(s: CareerState, ctx: Pick<CareerCtx, "skills" | "clout">, rng: Rng, payouts: Payout[]) {
  const track = trackById(s.track)!;
  const persona = track.manager.persona;
  const day = s.nextReview;
  const worked = s.worked.length;
  const lines: string[] = [];
  const missed = Math.max(0, CAREER.expectedDays - worked);
  const penalty = missed * (s.trust.friend >= 70 ? CAREER.missedPenalty / 2 : CAREER.missedPenalty);
  if (missed) {
    s.performance = clamp(s.performance - penalty);
    lines.push(`📅 ${worked} of ${CAREER.expectedDays} workdays this week.`);
  }
  const pay = Math.round((salaryOf(s) * Math.min(worked, CAREER.expectedDays)) / CAREER.expectedDays) + s.tips;
  if (pay > 0) {
    payouts.push({ kind: "career_pay", currency: "cash", amount: pay, ref: `${s.id}:pay:${day}` });
    lines.unshift(`💵 Payday: C$${pay.toLocaleString("en-US")}${s.tips ? ` (C$${s.tips.toLocaleString("en-US")} in tips)` : ""}.`);
  }
  // A joint project is judged first: a team bonus on top of payday, or a flop.
  if (s.team) {
    const who = s.team.with;
    const name = who === "friend" ? track.friend.name : track.rival.name;
    const chance = Math.max(0.2, Math.min(0.9, 0.45 + (s.trust[who] - 50) / 100 + (s.performance - 50) / 200));
    if (rng() < chance) {
      const bonus = Math.round(salaryOf(s) * CAREER.office.teamBonus);
      payouts.push({ kind: "career_team", currency: "cash", amount: bonus, ref: `${s.id}:team:${day}` });
      s.performance = clamp(s.performance + 6);
      s.trust[who] = clamp(s.trust[who] + 8);
      s.workMood = clamp((s.workMood ?? CAREER.office.moodStart) + 5);
      lines.push(`🤝 The joint project with ${name} landed: a C$${bonus.toLocaleString("en-US")} team bonus.`);
    } else {
      s.performance = clamp(s.performance - 4);
      s.trust[who] = clamp(s.trust[who] - 5);
      lines.push(`📉 The joint project with ${name} flopped. ${name} blames you; you blame ${name}.`);
    }
    s.team = null;
  }
  let outcome: CareerLog["kind"] = "review";
  if (s.lie && rng() < CAREER.lieCheck) {
    s.lie = false;
    s.trust.manager = clamp(s.trust.manager - 30);
    s.warnings = Math.max(s.warnings, 1);
    note(s, day, "caught", "HR checked your interview story. It didn't check out.");
    lines.push(`🧾 HR checked the story you told in your interview. It didn't check out. Formal warning.`);
    outcome = "caught";
  }
  const warnAt = persona === "supportive" ? CAREER.warn.supportive : CAREER.warn.perf;
  const bad = s.performance < warnAt || worked < CAREER.minDays;
  const mgr = track.manager.name.split(" ")[0];
  if (bad) {
    if (s.warnings === 0) {
      s.warnings = 1;
      outcome = "warning";
      lines.push(`⚠️ ${mgr} gave you a warning. Another bad week and it gets worse.`);
      note(s, day, "warning", "A warning at your review.");
    } else if (s.level > 1 && !s.demoted) {
      s.level -= 1;
      s.raises = 0;
      s.reviewsAtLevel = 0;
      s.demoted = true;
      outcome = "demotion";
      const title = track.levels[s.level - 1].title;
      lines.push(`⬇️ Demoted to ${title}. ${mgr}: "Let's call it a reset."`);
      note(s, day, "demotion", `Demoted to ${title}.`);
    } else {
      s.status = "fired";
      s.endedOn = day;
      outcome = "fired";
      lines.push(`📦 ${mgr} walked you out with a box. You're fired.`);
      note(s, day, "fired", `Fired from ${track.employer}.`);
    }
  } else {
    s.reviewsAtLevel += 1;
    if (s.performance >= 60) s.warnings = 0;
    const next = track.levels[s.level];
    const trustNeed = persona === "credit_stealer" ? CAREER.promote.creditStealerTrust : CAREER.promote.trust;
    const ready = s.performance >= CAREER.promote.perf && s.trust.manager >= trustNeed && s.reviewsAtLevel >= s.level;
    const short = next ? missing(track, s.level + 1, ctx) : [];
    if (ready && next && !short.length) {
      s.level += 1;
      s.raises = 0;
      s.reviewsAtLevel = 0;
      s.demoted = false;
      s.performance = CAREER.promote.reset;
      outcome = "promotion";
      payouts.push({ kind: "career_promo", currency: "clout", amount: CAREER.promoClout * s.level, ref: `${s.id}:L${s.level}` });
      lines.push(`🎉 Promoted to ${next.title}! New desk, new salary: C$${salaryOf(s).toLocaleString("en-US")} a week.`);
      note(s, day, "promotion", `Promoted to ${next.title}.`);
      if (s.trust.rival < 50) lines.push(`😤 ${track.rival.name} slammed a drawer when they heard.`);
    } else if (s.performance >= CAREER.raise.perf && s.raises < CAREER.raise.max) {
      s.raises += 1;
      outcome = "raise";
      lines.push(`📈 A raise: C$${salaryOf(s).toLocaleString("en-US")} a week.${ready && short.length ? ` A promotion needs ${short.join(" and ")}.` : ""}`);
      note(s, day, "raise", `A raise to C$${salaryOf(s).toLocaleString("en-US")} a week.`);
    } else {
      lines.push(ready && short.length ? `✅ A strong week. A promotion needs ${short.join(" and ")}.` : `✅ A solid week. ${mgr} nods at you, once.`);
      if (!ready && next) lines.push(`🎯 For a promotion: performance ${CAREER.promote.perf}+, ${mgr}'s trust ${trustNeed}+ and ${s.level} good review${s.level > 1 ? "s" : ""} as ${track.levels[s.level - 1].title} (${s.reviewsAtLevel} so far).`);
    }
  }
  const moodHit: Partial<Record<CareerLog["kind"], number>> = { promotion: 15, raise: 8, warning: -12, caught: -12, demotion: -20 };
  s.workMood = clamp((s.workMood ?? CAREER.office.moodStart) + (moodHit[outcome] ?? 0));
  s.review = { day, lines, pay, outcome };
  s.periodStart = day;
  s.nextReview = addDays(day, CAREER.reviewEvery);
  s.worked = [];
  s.tips = 0;
}

// ---- Part 2: office politics (spec section 30, part 2) ----

/** The six moves, as the Office card shows them: who they can target and the usual preview. */
export const OFFICE: { id: OfficeAction; kind: "collab" | "sabotage"; emoji: string; label: string; get: string; cost: string; targets: Who[] }[] = [
  { id: "help", kind: "collab", emoji: "🙋", label: "Help with their task", get: "Their trust, a favor owed", cost: `${CAREER.office.helpEnergy} Energy and your break`, targets: ["friend", "rival"] },
  { id: "share", kind: "collab", emoji: "🤲", label: "Share the credit", get: "A big jump in their trust", cost: "Some of today's performance", targets: ["friend", "rival"] },
  { id: "team", kind: "collab", emoji: "🤝", label: "Team up on a project", get: "A team bonus at your review, maybe", cost: "Your result rides on theirs", targets: ["friend", "rival"] },
  { id: "credit", kind: "sabotage", emoji: "🫳", label: "Take credit for their work", get: "Performance, and the boss's eye", cost: "Their trust, and worse if it's traced", targets: ["friend", "rival"] },
  { id: "report", kind: "sabotage", emoji: "📝", label: "Report their mistakes", get: "You look better by comparison", cost: "Their trust; snitches get noticed", targets: ["friend", "rival"] },
  { id: "rumor", kind: "sabotage", emoji: "🗣️", label: "Feed the office gossip a rumor", get: "They're busy defending themselves", cost: "If it's traced: HR, and the News", targets: ["friend", "rival", "manager"] },
];

const nameOf = (track: Track, who: Who) => (who === "manager" ? track.manager.name.split(" ")[0] : who === "friend" ? track.friend.name : track.rival.name);

/** What a grudge does when it comes due: never a surprise, always named. */
function revenge(track: Track, g: Grudge): { perf: number; manager: number; workMood: number; mood: number; line: string } {
  const n = nameOf(track, g.who);
  if (g.who === "manager") return { perf: -3, manager: -4, workMood: -8, mood: 0, line: `🧊 ${n} gave you the worst job in the building today. You know why.` };
  if (g.level >= 3) return { perf: -6, manager: -8, workMood: -6, mood: -5, line: `📸 ${n} reported you to ${nameOf(track, "manager")}, with timestamps. Payback.` };
  if (g.level === 2) return { perf: -2, manager: -8, workMood: -6, mood: 0, line: `🗣️ ${n} is telling everyone you take credit for other people's work.` };
  return { perf: -3, manager: 0, workMood: -3, mood: 0, line: `🙄 ${n} "forgot" to pass your work along. Petty, and on purpose.` };
}

/** Someone you crossed holds a grudge, or a worse one (up to 3); they strike in 2 to 5 days. */
function holdGrudge(s: CareerState, who: Who, today: string, rng: Rng) {
  s.grudges = s.grudges ?? [];
  const g = s.grudges.find((x) => x.who === who);
  if (g) g.level = Math.min(3, g.level + 1);
  else s.grudges.push({ who, level: 1, due: addDays(today, 2 + Math.floor(rng() * 4)) });
}

/** Making amends: helping or sharing the credit cools a grudge (sharing ends it). */
function amends(s: CareerState, who: Who, all: boolean) {
  s.grudges = (s.grudges ?? []).map((g) => (g.who === who ? { ...g, level: all ? 0 : g.level - 1 } : g)).filter((g) => g.level > 0);
}

export interface OfficeResult { effects: Effects; receipt: string; integrity: number; headline: string | null }

/** One office move, on a day you clocked in: at most one collaborate and one sabotage a workday. */
/** `crackdown`: an HR crackdown week at this employer (a city storylet, migration 0140): sabotage is traced twice as often. */
export function office(s: CareerState, action: OfficeAction, who: Who, ctx: Pick<CareerCtx, "energy">, today: string, rng: Rng, opts: { crackdown?: boolean } = {}): OfficeResult {
  const track = trackById(s.track)!;
  const def = OFFICE.find((o) => o.id === action);
  if (s.status !== "employed") throw new CareerError("not_employed");
  if (!def || !def.targets.includes(who)) throw new CareerError("bad_target");
  if (s.today?.day !== today) throw new CareerError("not_working");
  if (s.office?.day !== today) s.office = { day: today, collab: false, sabotage: false };
  if (s.office[def.kind]) throw new CareerError("office_used");
  const n = nameOf(track, who);
  const boss = nameOf(track, "manager");
  const guarded = (s.exposed ?? 0) >= CAREER.office.guarded;
  const warm = (d: number) => (guarded ? Math.round(d / 2) : d);
  const mood = (d: number) => { s.workMood = clamp((s.workMood ?? CAREER.office.moodStart) + d); };
  const out: OfficeResult = { effects: {}, receipt: "", integrity: 0, headline: null };
  const traced = (base: number) => rng() < Math.min(0.95, (base + CAREER.office.traced.per * Math.min(3, s.sabotages ?? 0)) * (opts.crackdown ? 2 : 1));

  if (action === "help") {
    if (ctx.energy < CAREER.office.helpEnergy) throw new CareerError("no_energy");
    s.trust[who] = clamp(s.trust[who] + warm(12));
    s.performance = clamp(s.performance + 1);
    amends(s, who, false);
    mood(3);
    out.effects.energy = -CAREER.office.helpEnergy;
    out.integrity = 3;
    out.receipt = who === "friend" ? `You stay late on ${n}'s pile. ${n} owes you one.` : `You help ${n} hit a deadline. ${n} looks suspicious, then grateful.`;
  } else if (action === "share") {
    s.trust[who] = clamp(s.trust[who] + warm(18));
    s.trust.manager = clamp(s.trust.manager + 3);
    s.performance = clamp(s.performance - 2);
    amends(s, who, true);
    mood(2);
    out.integrity = 4;
    out.receipt = `"${n} did half of that." ${boss} nods: a team player. ${n} won't forget it.`;
  } else if (action === "team") {
    if (s.team) throw new CareerError("team_busy");
    s.team = { with: who as Peer, due: s.nextReview };
    s.trust[who] = clamp(s.trust[who] + warm(5));
    out.integrity = 2;
    out.receipt = `You and ${n} pitch a joint project to ${boss}. It's judged at your next review.`;
  } else if (action === "credit") {
    s.sabotages = (s.sabotages ?? 0) + 1;
    s.performance = clamp(s.performance + 6);
    s.trust.manager = clamp(s.trust.manager + 4);
    s.trust[who] = clamp(s.trust[who] - 25);
    holdGrudge(s, who, today, rng);
    mood(-4);
    out.integrity = -6;
    if (traced(CAREER.office.traced.credit + (who === "friend" ? 0.1 : 0))) {
      s.exposed = (s.exposed ?? 0) + 1;
      s.trust.manager = clamp(s.trust.manager - 15);
      s.performance = clamp(s.performance - 6);
      out.integrity -= 4;
      out.receipt = `You present ${n}'s work as yours. ${n} has the drafts, and shows ${boss}. Awkward.`;
    } else {
      out.receipt = `You present ${n}'s work as yours. ${boss} is impressed. ${n} isn't, and knows.`;
    }
  } else if (action === "report") {
    s.sabotages = (s.sabotages ?? 0) + 1;
    s.performance = clamp(s.performance + 3);
    s.trust.manager = clamp(s.trust.manager + 3);
    s.trust[who] = clamp(s.trust[who] - 20);
    holdGrudge(s, who, today, rng);
    mood(-3);
    out.integrity = -4;
    out.receipt = `You walk ${boss} through ${n}'s mistakes. You look sharp. ${n} looks at you.`;
    if (rng() < 0.4) {
      const other: Peer = who === "friend" ? "rival" : "friend";
      s.trust[other] = clamp(s.trust[other] - 8);
      out.receipt += ` Word gets around: ${nameOf(track, other)} calls you a snitch.`;
    }
  } else {
    s.sabotages = (s.sabotages ?? 0) + 1;
    s.trust[who] = clamp(s.trust[who] - 15);
    s.rumor = { who, until: addDays(today, 5) };
    holdGrudge(s, who, today, rng);
    mood(-3);
    out.integrity = -8;
    if (traced(CAREER.office.traced.rumor)) {
      s.exposed = (s.exposed ?? 0) + 1;
      s.trust.manager = clamp(s.trust.manager - 20);
      if (s.warnings === 0) {
        s.warnings = 1;
        note(s, today, "warning", "HR traced an office rumor to you. A formal warning.");
      }
      out.integrity -= 4;
      out.receipt = `The rumor about ${n} spreads, then gets traced back to you. HR wants a word. Formal warning.`;
      out.headline = `BREAKING: sources at ${track.employer} say {name} started the rumor about a coworker that's all over Astoria. HR is "aware," we're told.`;
    } else {
      s.performance = clamp(s.performance + 2);
      out.receipt = `The rumor about ${n} is everywhere by lunch. Nobody knows where it started. ${n} is too busy to bother you.`;
      if (rng() < 0.5) out.headline = `Developing: a rumor about someone at ${track.employer} is all over Astoria. Nobody knows who started it. Yet.`;
    }
  }
  s.office[def.kind] = true;
  return out;
}

export function quit(s: CareerState, today: string) {
  if (s.status !== "employed") throw new CareerError("not_employed");
  s.status = "quit";
  s.endedOn = today;
  s.today = null;
  note(s, today, "quit", `Quit ${trackById(s.track)!.employer}.`);
}

/** The player's view of their job: never a task's hidden outcomes. */
export interface CareerView {
  id: string;
  track: TrackId;
  employer: string;
  place: string;
  title: string;
  level: number;
  levels: number;
  salary: number;
  status: CareerState["status"];
  performance: number;
  trust: Record<Who, number>;
  people: { manager: Track["manager"]; friend: Person; rival: Person };
  warnings: number;
  nextReview: string;
  daysToReview: number;
  workedThisWeek: number;
  remote: boolean;
  /** Today's workday, if started: each task with its options (label, get, cost), and what happened once answered. */
  today: {
    style: WorkStyle; done: boolean; summary: string[];
    tasks: { index: number; emoji: string; title: string; picked: string | null; result: string | null; perf: number; options: { id: string; label: string; get: string; cost: string }[] }[];
  } | null;
  canWork: boolean;
  review: CareerState["review"];
  next: { title: string; salary: number; missing: string[] } | null;
  log: CareerLog[];
  endedOn: string | null;
  /** Part 2: work mood, who's holding a grudge, today's office moves left, the joint project, how guarded people are. */
  workMood: number;
  grudges: { who: Who; level: number }[];
  officeLeft: { collab: boolean; sabotage: boolean } | null;
  team: { with: Peer; name: string } | null;
  guarded: boolean;
}

export function careerView(content: CareerContent, s: CareerState, today: string, ctx: Pick<CareerCtx, "skills" | "clout">): CareerView {
  const track = trackById(s.track)!;
  const nextLevel = track.levels[s.level];
  const t = s.today && s.today.day === today ? s.today : null;
  return {
    id: s.id, track: s.track, employer: track.employer, place: track.place, title: track.levels[s.level - 1].title,
    level: s.level, levels: track.levels.length, salary: salaryOf(s), status: s.status, performance: s.performance, trust: s.trust,
    people: { manager: track.manager, friend: track.friend, rival: track.rival }, warnings: s.warnings,
    nextReview: s.nextReview, daysToReview: Math.max(0, daysBetween(today, s.nextReview)), workedThisWeek: s.worked.length, remote: remote(s),
    today: t ? {
      style: t.style, done: t.done, summary: t.summary,
      tasks: t.tasks.map((x, index) => {
        const task = content.tasks.find((k) => k.id === x.id)!;
        return { index, emoji: task.emoji, title: names(task.title, x.names), picked: x.picked, result: x.text, perf: x.perf, options: task.options.map((o) => ({ id: o.id, label: names(o.label, x.names), get: names(o.get, x.names), cost: names(o.cost, x.names) })) };
      }),
    } : null,
    canWork: s.status === "employed" && !s.worked.includes(today),
    review: s.review,
    next: nextLevel ? { title: nextLevel.title, salary: nextLevel.salary, missing: missing(track, s.level + 1, ctx) } : null,
    log: s.log,
    endedOn: s.endedOn,
    workMood: s.workMood ?? CAREER.office.moodStart,
    grudges: (s.grudges ?? []).map((g) => ({ who: g.who, level: g.level })),
    officeLeft: t && s.status === "employed"
      ? { collab: !(s.office?.day === today && s.office.collab), sabotage: !(s.office?.day === today && s.office.sabotage) } : null,
    team: s.team ? { with: s.team.with, name: s.team.with === "friend" ? track.friend.name : track.rival.name } : null,
    guarded: (s.exposed ?? 0) >= CAREER.office.guarded,
  };
}

/** Each track as the Careers app lists it: where you'd start, what's missing, when you can apply. */
export interface TrackCard {
  id: TrackId; name: string; emoji: string; employer: string; place: string; blurb: string; keySkills: string[];
  manager: string; perks: Track["perks"];
  ladder: { title: string; salary: number; needs: string[] }[];
  start: number; missing: string[]; reapplyOn: string | null;
}
export function trackCards(ctx: CareerCtx, today: string): TrackCard[] {
  return TRACKS.map((t) => {
    const start = startLevel(t, ctx);
    return {
      id: t.id, name: t.name, emoji: t.emoji, employer: t.employer, place: t.place, blurb: t.blurb, keySkills: t.keySkills.map((k) => SKILL_NAMES[k]),
      manager: `${t.manager.emoji} ${t.manager.name} · ${t.manager.style}`, perks: t.perks,
      ladder: t.levels.map((l, i) => ({ title: l.title, salary: l.salary, needs: missing(t, i + 1, { skills: {}, clout: 0 }) })),
      start, missing: missing(t, start, ctx), reapplyOn: rehireOn(t.id, ctx, today),
    };
  });
}

/** The Careers app's screen. */
export interface CareerScreen {
  tracks: TrackCard[];
  canConnect: boolean;
  job: CareerView | null;
  energy: number;
  atPlace: string | null;
  /** What just happened, after an action. */
  receipt?: string;
}
export type CareerResult<T> = { ok: true; data: T } | { ok: false; error: string };
type R = Promise<CareerResult<CareerScreen>>;
export interface CareerApi {
  screen(): R;
  apply(track: TrackId, answer: Answer): R;
  start(style: WorkStyle): R;
  task(index: number, option: string): R;
  office(action: OfficeAction, who: Who): R;
  quit(): R;
}

/** The content's own rules (tests/careers.test.ts runs them on the task file). */
export function validateCareerContent(c: CareerContent): string[] {
  const out: string[] = [];
  const ids = new Set<string>();
  for (const t of c.tasks) {
    const at = `task ${t.id}`;
    if (ids.has(t.id)) out.push(`${at}: repeated id`);
    ids.add(t.id);
    if (!trackById(t.track)) out.push(`${at}: unknown track`);
    if (!t.title || t.title.length > 110) out.push(`${at}: title must be 1 to 110 characters`);
    if (t.minLevel < 1 || t.minLevel > 5) out.push(`${at}: minLevel 1 to 5`);
    if (t.options.length < 2 || t.options.length > 3) out.push(`${at}: 2 or 3 options`);
    for (const o of t.options) {
      if (!o.label || o.label.length > 40) out.push(`${at} ${o.id}: label 1 to 40 characters`);
      if (!o.get || o.get.length > 60 || !o.cost || o.cost.length > 60) out.push(`${at} ${o.id}: get and cost 1 to 60 characters`);
      if (!o.outcomes.length) out.push(`${at} ${o.id}: needs outcomes`);
      for (const x of o.outcomes) {
        if (!x.text || x.text.length > 220) out.push(`${at} ${o.id}: outcome text 1 to 220 characters`);
        if (Math.abs(x.perf) > 12) out.push(`${at} ${o.id}: perf within ±12`);
        for (const v of Object.values(x.trust ?? {})) if (Math.abs(v as number) > 20) out.push(`${at} ${o.id}: trust within ±20`);
        if (x.mood !== undefined && Math.abs(x.mood) > 10) out.push(`${at} ${o.id}: mood within ±10`);
      }
    }
  }
  for (const tr of TRACKS) {
    for (let l = 1; l <= tr.levels.length; l++) {
      const n = c.tasks.filter((t) => t.track === tr.id && t.minLevel <= l && !t.when && !t.slots).length;
      if (n < 3) out.push(`${tr.id}: level ${l} needs at least 3 tasks (has ${n})`);
    }
    const L = c.lines[tr.id];
    if (!L || !L.manager.high.length || !L.manager.mid.length || !L.manager.low.length || !L.friend.length || !L.rival.length) out.push(`${tr.id}: lines missing`);
  }
  return out;
}
