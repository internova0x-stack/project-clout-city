// The Homecoming race ("Big Man on Campus" / "Queen Bee", owner Nov 4: "around being the big man/woman on campus… schooling
// as a balancing act that creates tension/tradeoffs"; docs/SCHOOL-RACE.md). An enrolled student declares for Homecoming King
// or Queen and has one semester (4 real weeks, New York) to dethrone the reigning royal: Rep against GPA against Energy.
// Pure, like lib/careers.ts and lib/campaignEngine.ts: every function takes the content, the state and a random source and
// changes the state it's given. The server runs it with a crypto random source (app/home/schoolActions.ts); the preview runs
// it in memory (lib/schoolSim.ts). Players only see `raceView`: no hidden traces, Dean heat or odds.

export type Rng = () => number;
export type Crown = "king" | "queen";
export type Activity = "class" | "study" | "party" | "club" | "work" | "hang" | "date" | "sleep";
export type CliqueId = "greek" | "theater" | "finance" | "athletes" | "influencers";
export type SquadId = "priya" | "marco" | "dee" | "tobi";
export type Slot = 0 | 1; // day, night

export class RaceError extends Error {
  code: string;
  constructor(code: string) { super(code); this.code = code; }
}
const fail = (code: string): never => { throw new RaceError(code); };
const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
const r2 = (n: number) => Math.round(n * 100) / 100;
const pick = <T>(rng: Rng, xs: readonly T[]): T => xs[Math.floor(rng() * xs.length)];

/** Tunable numbers (game_settings 'school_race' mirrors these; tests/schoolRace.test.ts keeps them sane). */
export const RACE = {
  weeks: 4,
  /** Under this GPA at Homecoming you're off the ballot. */
  eligibleGpa: 2.5,
  start: { gpa: 2.9, rep: 8, energy: 100, standing: 0 },
  /** What each slot does. GPA moves in grade points over the week, Rep 0-100. */
  acts: {
    class: { gpa: 0.06, rep: 0, energy: -10, mood: 0, cash: 0 },
    study: { gpa: 0.1, rep: -1, energy: -15, mood: -1, cash: 0 },
    party: { gpa: 0, rep: 7, energy: -20, mood: 3, cash: 0 },
    club: { gpa: 0, rep: 4, energy: -10, mood: 1, cash: 0 },
    work: { gpa: 0, rep: 0, energy: -10, mood: -1, cash: 80 },
    hang: { gpa: -0.08, rep: 6, energy: -5, mood: 3, cash: 0 },
    date: { gpa: 0, rep: 3, energy: -10, mood: 4, cash: 0 },
    sleep: { gpa: 0, rep: 0, energy: 35, mood: 1, cash: 0 },
  } as Record<Activity, { gpa: number; rep: number; energy: number; mood: number; cash: number }>,
  /** Low Energy (under this) halves what class and study give and cuts Rep gains by 40%. */
  tired: 25,
  /** A party the night before the Friday exam costs this much GPA on top. */
  examEve: 0.35,
  /** Friday's exam: the week's GPA swings by up to this, by how much you studied and slept. */
  exam: { swing: 0.3 },
  /** Rep fades this much a day with nothing social planned. */
  fade: 2,
  /** Homecoming: votes per clique, how your standing (−2..2) and Rep turn into your share, the rival's floor. */
  votes: { perClique: 140, rivalBase: 0.55 },
  /** The weekly budget lines (C$, steps of 50) and what each buys at the week's end. */
  budget: {
    step: 50, max: 1000,
    party: { rep: 0.04, complaint: 0.0008 }, look: { rep: 0.03 }, merch: { standing: 0.004 }, tutor: { gpa: 0.0005 }, squad: { morale: 0.05 },
  },
  /** The Dean's heat (hidden): at this, a traced thing comes out and you're off the ballot until cleared. */
  dean: { hearing: 60 },
  /** Strikes for a low GPA at the Friday verdict (careers' gentle ladder): a warning, then academic probation. */
  strikes: 2,
  rewards: { crown: 400, runnerUp: 80, week: 15 },
} as const;

export const ACTIVITIES: readonly { id: Activity; emoji: string; name: string; get: string; cost: string; needs?: "club" | "date" | "work" }[] = [
  { id: "class", emoji: "🎓", name: "Class", get: "+GPA", cost: "−10 Energy" },
  { id: "study", emoji: "📚", name: "Study", get: "++GPA", cost: "−15 Energy" },
  { id: "party", emoji: "🎉", name: "Party", get: "++Rep", cost: "−20 Energy" },
  { id: "club", emoji: "🎭", name: "Club", get: "+Rep with your clique", cost: "−10 Energy", needs: "club" },
  { id: "work", emoji: "💼", name: "Work shift", get: "+C$80", cost: "−10 Energy", needs: "work" },
  { id: "hang", emoji: "🛋️", name: "Hang out", get: "++Rep · +Mood", cost: "−GPA · −5 Energy" },
  { id: "date", emoji: "💞", name: "Date", get: "+Rep · +Mood", cost: "−10 Energy", needs: "date" },
  { id: "sleep", emoji: "😴", name: "Sleep", get: "+35 Energy", cost: "Nothing" },
];

/** Rep tiers; the top one is the crown's own phrase (owner, Nov 4: "Big woman on campus isn't a phrase used"). */
export function tierOf(rep: number, crown: Crown): string {
  if (rep >= 95) return crown === "queen" ? "Queen Bee" : "Big Man on Campus";
  if (rep >= 80) return crown === "queen" ? "It Girl" : "It Person";
  if (rep >= 60) return "Popular";
  if (rep >= 40) return "Known";
  if (rep >= 20) return "Familiar Face";
  return "Nobody";
}

// ---------------------------------------------------------------------------------------------------------------
// Content (content/school/*.json; the cards' odds and later consequences are hidden, so only the server and preview read it)
// ---------------------------------------------------------------------------------------------------------------

export interface Person { id: string; name: string; role: string; age?: number; vibe?: string }
export interface Rival extends Person { crown: Crown; campus: string; entrance: string; taunts: string[]; win: string; loss: string }
export interface Clique { id: CliqueId; emoji: string; name: string; lead: string; rivalSide: boolean; likes: Activity[]; dislikes?: CliqueId }
export interface Effects { gpa?: number; rep?: number; energy?: number; mood?: number; cash?: number; standing?: Partial<Record<CliqueId, number>>; squad?: Partial<Record<SquadId, { morale?: number; loyalty?: number }>>; dean?: number; meter?: number; eligible?: false; rivalRep?: number }
export interface CardOption { id: string; label: string; get: string; cost: string; effects: Effects; receipt: string; later?: { week: number; chance: number; card: string } }
export interface Card { id: string; emoji: string; over: string; title: string; options: CardOption[]; week?: number; slot?: { day: number; slot: Slot }; laterOnly?: boolean }
export interface InboxMsg { id: string; from: string; week: number; subject: string; body: string; options: CardOption[] }
export interface RaceContent { cliques: Clique[]; squad: (Person & { id: SquadId; wants: string })[]; rivals: Rival[]; people: Person[]; cards: Card[]; inbox: InboxMsg[] }

// ---------------------------------------------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------------------------------------------

export interface RaceState {
  v: 1;
  id: string;
  campus: string;
  crown: Crown;
  rival: string;
  /** Monday the semester starts (New York) and the day after the last day played. */
  startOn: string;
  playedTo: string;
  week: number;
  phase: "running" | "over";
  gpa: number;
  rep: number;
  energy: number;
  rivalRep: number;
  strikes: number;
  eligible: boolean;
  standing: Record<CliqueId, number>;
  squad: Record<SquadId, { morale: number; loyalty: number; out: boolean }>;
  /** This week's plan: 7 days × [day, night]. Past days are locked. */
  plan: Activity[][];
  budget: { party: number; look: number; merch: number; tutor: number; squad: number };
  /** The open card (a clash or a choice coming due), one at a time. */
  pending: string[];
  inbox: { id: string; status: "new" | "answered" | "expired"; option?: string; at: string }[];
  /** Hidden: what comes back later, and the Dean's heat. */
  traces: { card: string; week: number; chance: number }[];
  dean: number;
  /** The Friday verdicts and the log. */
  verdicts: { week: number; gpa: number; rep: number; repGained: number; eligible: boolean; strike: boolean }[];
  log: { week: number; text: string }[];
  result: { you: number; rival: number; cliques: { id: CliqueId; you: number; rival: number }[]; ending: "crown" | "dirty" | "runnerup" | "ineligible" } | null;
  seen: string[];
}

export interface StartInput { id: string; campus: string; crown: Crown; startOn: string; job: boolean; dating: boolean }

const PLAN0: Activity[][] = [["class", "club"], ["class", "hang"], ["class", "study"], ["class", "party"], ["class", "sleep"], ["work", "party"], ["sleep", "study"]];

export function startRace(content: RaceContent, input: StartInput): RaceState {
  const rival = content.rivals.find((r) => r.crown === input.crown && r.campus === input.campus) ?? content.rivals.find((r) => r.crown === input.crown) ?? fail("no_rival");
  const standing = Object.fromEntries(content.cliques.map((c) => [c.id, c.rivalSide ? -1 : 0])) as Record<CliqueId, number>;
  const squad = Object.fromEntries(content.squad.map((s) => [s.id, { morale: 70, loyalty: 60, out: false }])) as RaceState["squad"];
  const plan = PLAN0.map((d) => d.map((a) => (a === "work" && !input.job ? "study" : a))) as Activity[][];
  return {
    v: 1, id: input.id, campus: input.campus, crown: input.crown, rival: rival.id, startOn: input.startOn, playedTo: input.startOn,
    week: 1, phase: "running", gpa: RACE.start.gpa, rep: RACE.start.rep, energy: RACE.start.energy, rivalRep: 96, strikes: 0, eligible: true,
    standing, squad, plan, budget: { party: 0, look: 0, merch: 0, tutor: 0, squad: 0 }, pending: [], inbox: [], traces: [], dean: 0,
    verdicts: [], log: [], result: null, seen: [],
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------------------------------------------

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);
/** The Monday on or after `day` (a semester starts on one). */
export function nextMonday(day: string): string {
  const dow = new Date(`${day}T12:00:00Z`).getUTCDay(); // 0 Sun … 6 Sat
  return addDays(day, dow === 1 ? 0 : (8 - dow) % 7 || 7);
}
/** Where `day` falls: week 1-4 and the day index 0 (Mon) … 6 (Sun); week 0 before the start. */
export function weekDay(s: Pick<RaceState, "startOn">, day: string) {
  const n = daysBetween(s.startOn, day);
  return { week: n < 0 ? 0 : Math.floor(n / 7) + 1, day: ((n % 7) + 7) % 7 };
}
const HOMECOMING_DAY = 5; // Saturday of week 4

// ---------------------------------------------------------------------------------------------------------------
// The player's moves
// ---------------------------------------------------------------------------------------------------------------

/** Changing a slot: only today's and later days this week, and only what the player can do. */
export function setSlot(s: RaceState, today: string, day: number, slot: Slot, act: Activity, can: { club: boolean; date: boolean; work: boolean }) {
  if (s.phase !== "running") fail("over");
  const at = weekDay(s, today);
  if (at.week === s.week && day < at.day) fail("past");
  const need = ACTIVITIES.find((a) => a.id === act)?.needs;
  if (need && !can[need]) fail(`needs_${need}`);
  if (s.week === RACE.weeks && day >= HOMECOMING_DAY) fail("homecoming");
  s.plan[day][slot] = act;
}

export function setBudget(s: RaceState, b: Partial<RaceState["budget"]>) {
  for (const k of Object.keys(b) as (keyof RaceState["budget"])[]) {
    const v = b[k] ?? 0;
    if (v < 0 || v > RACE.budget.max || v % RACE.budget.step) fail("bad_budget");
    s.budget[k] = v;
  }
}

function applyEffects(s: RaceState, e: Effects, pay: Payout[], ref: string) {
  if (e.gpa) s.gpa = r2(clamp(s.gpa + e.gpa, 0, 4));
  if (e.rep) s.rep = clamp(Math.round(s.rep + e.rep));
  if (e.energy) s.energy = clamp(s.energy + e.energy);
  if (e.rivalRep) s.rivalRep = clamp(s.rivalRep + e.rivalRep);
  if (e.dean) s.dean = clamp(s.dean + e.dean);
  for (const [c, d] of Object.entries(e.standing ?? {})) s.standing[c as CliqueId] = clamp((s.standing[c as CliqueId] ?? 0) + (d ?? 0), -2, 2);
  for (const [q, d] of Object.entries(e.squad ?? {})) {
    const m = s.squad[q as SquadId]; if (!m) continue;
    m.morale = clamp(m.morale + (d?.morale ?? 0)); m.loyalty = clamp(m.loyalty + (d?.loyalty ?? 0));
    if (m.loyalty <= 10) m.out = true;
  }
  if (e.eligible === false) s.eligible = false;
  if (e.cash) pay.push({ kind: e.cash > 0 ? "school_cash" : "school_spend", currency: "cash", amount: e.cash, ref: `${s.id}:${ref}` });
  if (e.mood) pay.push({ kind: "school_mood", currency: "mood", amount: e.mood, ref: `${s.id}:${ref}:mood` });
  if (e.meter) pay.push({ kind: "school_meter", currency: "meter", amount: e.meter, ref: `${s.id}:${ref}:meter` });
}

export interface Payout { kind: string; currency: "cash" | "clout" | "mood" | "meter"; amount: number; ref: string }

/** Answering the open card (a clash or a choice). */
export function choose(content: RaceContent, s: RaceState, cardId: string, optionId: string, rng: Rng): { receipt: string; payouts: Payout[] } {
  if (s.pending[0] !== cardId) fail("not_pending");
  const card = content.cards.find((c) => c.id === cardId) ?? fail("unknown");
  const o = card.options.find((x) => x.id === optionId) ?? fail("unknown");
  const pay: Payout[] = [];
  applyEffects(s, o.effects, pay, `card:${cardId}`);
  if (o.later && rng() < o.later.chance) s.traces.push({ card: o.later.card, week: Math.min(RACE.weeks, s.week + o.later.week), chance: 1 });
  s.pending.shift();
  s.seen.push(cardId);
  s.log.push({ week: s.week, text: `${card.emoji} ${o.label}` });
  return { receipt: o.receipt, payouts: pay };
}

export function reply(content: RaceContent, s: RaceState, msgId: string, optionId: string, rng: Rng): Payout[] {
  const m = s.inbox.find((x) => x.id === msgId && x.status === "new") ?? fail("not_open");
  const msg = content.inbox.find((x) => x.id === msgId) ?? fail("unknown");
  const o = msg.options.find((x) => x.id === optionId) ?? fail("unknown");
  const pay: Payout[] = [];
  applyEffects(s, o.effects, pay, `mail:${msgId}`);
  if (o.later && rng() < o.later.chance) s.traces.push({ card: o.later.card, week: Math.min(RACE.weeks, s.week + o.later.week), chance: 1 });
  m.status = "answered"; m.option = optionId;
  return pay;
}

// ---------------------------------------------------------------------------------------------------------------
// Playing the days: each New York day plays its two slots once (catch-up on read, like careers' reviews)
// ---------------------------------------------------------------------------------------------------------------

export function refresh(content: RaceContent, s: RaceState, today: string, rng: Rng): { payouts: Payout[]; changed: boolean } {
  const pay: Payout[] = [];
  let changed = false;
  while (s.phase === "running" && daysBetween(s.playedTo, today) > 0 && !s.pending.length) {
    playDay(content, s, s.playedTo, rng, pay);
    s.playedTo = addDays(s.playedTo, 1);
    changed = true;
  }
  const at = weekDay(s, today);
  // A new week starts on its Monday, before any of its slots play: the planner, mail and Monday's clash are that week's.
  if (s.phase === "running" && !s.pending.length && at.week > s.week && at.week <= RACE.weeks && s.playedTo === today) { newWeek(content, s, pay); changed = true; }
  // Today's clash shows as the day starts (before its slots play).
  if (s.phase === "running" && at.week >= 1 && !s.pending.length) {
    const due = content.cards.find((c) => c.week === s.week && c.slot && c.slot.day === at.day && !s.seen.includes(c.id) && !c.laterOnly);
    if (due) { s.pending.push(due.id); changed = true; }
    const trace = s.traces.find((t) => t.week <= s.week);
    if (trace && !s.pending.length) { s.pending.push(trace.card); s.traces = s.traces.filter((t) => t !== trace); changed = true; }
  }
  // Mail for the week arrives on its first day.
  for (const m of content.inbox) if (m.week <= s.week && !s.inbox.some((x) => x.id === m.id)) { s.inbox.push({ id: m.id, status: "new", at: today }); changed = true; }
  return { payouts: pay, changed };
}

function playDay(content: RaceContent, s: RaceState, day: string, rng: Rng, pay: Payout[]) {
  const at = weekDay(s, day);
  if (at.week < 1) return;
  if (at.week > s.week) newWeek(content, s, pay);
  if (s.week === RACE.weeks && at.day === HOMECOMING_DAY) { homecoming(content, s, rng, pay); return; }
  const slots = s.plan[at.day];
  let social = false;
  slots.forEach((a, slot) => {
    const A = RACE.acts[a];
    const tired = s.energy < RACE.tired;
    let gpa = A.gpa * (tired && (a === "class" || a === "study") ? 0.5 : 1);
    if (at.day === 3 && slot === 1 && a === "party") gpa -= RACE.examEve;
    const rep = A.rep * (tired && A.rep > 0 ? 0.6 : 1);
    s.gpa = r2(clamp(s.gpa + gpa, 0, 4));
    s.rep = clamp(Math.round(s.rep + rep));
    s.energy = clamp(s.energy + A.energy);
    if (A.mood) pay.push({ kind: "school_mood", currency: "mood", amount: A.mood, ref: `${s.id}:${day}:${slot}:mood` });
    if (A.cash) pay.push({ kind: "school_cash", currency: "cash", amount: A.cash, ref: `${s.id}:${day}:${slot}` });
    if (a === "party" || a === "hang" || a === "club" || a === "date") social = true;
    const clique = content.cliques.find((c) => c.likes.includes(a));
    if (clique && A.rep > 0 && rng() < 0.35) s.standing[clique.id] = clamp(s.standing[clique.id] + 1, -2, 2);
    if (a === "hang") for (const q of Object.values(s.squad)) q.loyalty = clamp(q.loyalty + 1);
  });
  if (!social) s.rep = clamp(s.rep - RACE.fade);
  // The rival plays too: a little Rep back every day, more if you're closing in.
  s.rivalRep = clamp(s.rivalRep + (s.rep > s.rivalRep - 20 ? 1 : 0) - (rng() < 0.2 ? 1 : 0));
  if (at.day === 4) friday(s, rng, pay);
}

/** Friday: the exam swings GPA by how the week went, then the verdict (a strike under the line). */
function friday(s: RaceState, rng: Rng, pay: Payout[]) {
  const week = s.plan.flat();
  const study = week.filter((a) => a === "study" || a === "class").length;
  const sleep = week.filter((a) => a === "sleep").length;
  const swing = RACE.exam.swing * ((study - 6) / 6 + (sleep - 2) / 6 + (rng() - 0.5) * 0.6);
  s.gpa = r2(clamp(s.gpa + swing, 0, 4));
  const tutor = s.budget.tutor * RACE.budget.tutor.gpa;
  s.gpa = r2(clamp(s.gpa + tutor, 0, 4));
  const ok = s.gpa >= RACE.eligibleGpa;
  const strike = !ok;
  if (strike) s.strikes = Math.min(RACE.strikes, s.strikes + 1); else if (s.strikes) s.strikes -= 1;
  const prev = s.verdicts[s.verdicts.length - 1]?.rep ?? RACE.start.rep;
  s.verdicts.push({ week: s.week, gpa: s.gpa, rep: s.rep, repGained: s.rep - prev, eligible: ok && s.eligible, strike });
  pay.push({ kind: "school_week", currency: "clout", amount: RACE.rewards.week, ref: `${s.id}:week:${s.week}` });
}

/** A new week: the budget lands, the plan carries over (minus past cards), mail and clashes refresh. */
function newWeek(content: RaceContent, s: RaceState, pay: Payout[]) {
  const b = s.budget;
  const spend = b.party + b.look + b.merch + b.tutor + b.squad;
  if (spend) pay.push({ kind: "school_spend", currency: "cash", amount: -spend, ref: `${s.id}:budget:${s.week}` });
  s.rep = clamp(Math.round(s.rep + b.party * RACE.budget.party.rep + b.look * RACE.budget.look.rep));
  if (b.party) s.dean = clamp(s.dean + b.party * RACE.budget.party.complaint * 100);
  for (const c of Object.keys(s.standing) as CliqueId[]) if (b.merch && !content.cliques.find((x) => x.id === c)?.rivalSide) s.standing[c] = clamp(s.standing[c] + b.merch * RACE.budget.merch.standing, -2, 2);
  for (const q of Object.values(s.squad)) q.morale = clamp(q.morale + b.squad * RACE.budget.squad.morale - 4);
  for (const m of s.inbox) if (m.status === "new") m.status = "expired";
  s.week += 1;
  if (s.dean >= RACE.dean.hearing && s.eligible) { s.eligible = false; s.log.push({ week: s.week, text: "🏛️ The Dean opened a hearing. You're off the ballot until it's cleared." }); }
}

/** Saturday of week 4: the votes, clique by clique. */
function homecoming(content: RaceContent, s: RaceState, rng: Rng, pay: Payout[]) {
  const cliques = content.cliques.map((c) => {
    const st = s.standing[c.id];
    const share = clamp(0.5 + st * 0.18 + (s.rep - s.rivalRep) / 200 + (rng() - 0.5) * 0.06, 0.05, 0.95);
    const you = Math.round(RACE.votes.perClique * share);
    return { id: c.id, you, rival: RACE.votes.perClique - you };
  });
  const you = cliques.reduce((a, c) => a + c.you, 0), rival = cliques.reduce((a, c) => a + c.rival, 0);
  const eligible = s.eligible && s.gpa >= RACE.eligibleGpa;
  const dirty = s.log.some((l) => l.text.startsWith("💸")) || s.dean >= 30;
  const ending = !eligible ? "ineligible" : you > rival ? (dirty ? "dirty" : "crown") : "runnerup";
  s.result = { you: eligible ? you : 0, rival, cliques, ending };
  s.phase = "over";
  if (ending === "crown" || ending === "dirty") pay.push({ kind: "school_crown", currency: "clout", amount: RACE.rewards.crown, ref: `${s.id}:crown` });
  else pay.push({ kind: "school_crown", currency: "clout", amount: RACE.rewards.runnerUp, ref: `${s.id}:runnerup` });
}

// ---------------------------------------------------------------------------------------------------------------
// What the player sees
// ---------------------------------------------------------------------------------------------------------------

export interface RaceView {
  id: string; campus: string; crown: Crown; week: number; weeks: number; phase: RaceState["phase"]; today: number;
  gpa: number; rep: number; energy: number; tier: string; eligible: boolean; strikes: number;
  rival: { id: string; name: string; tier: string; lead: number; win: string; loss: string };
  plan: Activity[][]; locked: number;
  budget: RaceState["budget"];
  pending: { id: string; emoji: string; over: string; title: string; options: { id: string; label: string; get: string; cost: string }[] } | null;
  inbox: { id: string; from: Person; subject: string; body: string; status: string; at: string; options: { id: string; label: string; get: string; cost: string }[]; sent?: string }[];
  squad: (Person & { id: SquadId; morale: number; loyalty: number; out: boolean })[];
  allies: { id: CliqueId; emoji: string; name: string; lead: string; standing: number; rivalSide: boolean }[];
  verdict: RaceState["verdicts"][number] | null;
  result: RaceState["result"];
  log: RaceState["log"];
}

export function raceView(content: RaceContent, s: RaceState, today: string): RaceView {
  const rival = content.rivals.find((r) => r.id === s.rival)!;
  const at = weekDay(s, today);
  const person = (id: string) => (id === "rival" ? rival : undefined) ?? content.squad.find((p) => p.id === id) ?? content.rivals.find((p) => p.id === id) ?? content.people.find((p) => p.id === id) ?? { id, name: id, role: "" };
  // Cards and mail say {rival}: the reigning royal's first name.
  const first = rival.name.split(" ")[0];
  const fill = (x: string) => x.split("{Rival}").join(first).split("{rival}").join(first);
  const card = s.pending[0] ? content.cards.find((c) => c.id === s.pending[0]) : null;
  return {
    id: s.id, campus: s.campus, crown: s.crown, week: s.week, weeks: RACE.weeks, phase: s.phase, today: at.day,
    gpa: s.gpa, rep: s.rep, energy: s.energy, tier: tierOf(s.rep, s.crown), eligible: s.eligible && s.gpa >= RACE.eligibleGpa, strikes: s.strikes,
    rival: { id: rival.id, name: rival.name, tier: tierOf(s.rivalRep, s.crown), lead: Math.max(0, s.rivalRep - s.rep), win: rival.win, loss: rival.loss },
    plan: s.plan, locked: at.week === s.week ? at.day : 0, budget: s.budget,
    pending: card ? { id: card.id, emoji: card.emoji, over: fill(card.over), title: fill(card.title), options: card.options.map(({ id, label, get, cost }) => ({ id, label: fill(label), get: fill(get), cost: fill(cost) })) } : null,
    inbox: s.inbox.map((x) => { const m = content.inbox.find((y) => y.id === x.id)!;
      return { id: x.id, from: person(m.from), subject: fill(m.subject), body: fill(m.body), status: x.status, at: x.at, options: m.options.map(({ id, label, get, cost }) => ({ id, label: fill(label), get: fill(get), cost: fill(cost) })), sent: m.options.find((o) => o.id === x.option)?.label }; }),
    squad: content.squad.map((p) => ({ ...p, wants: fill(p.wants), ...s.squad[p.id] })),
    allies: content.cliques.map((c) => ({ id: c.id, emoji: c.emoji, name: c.name, lead: fill(c.lead), standing: s.standing[c.id], rivalSide: c.rivalSide })),
    verdict: s.verdicts[s.verdicts.length - 1] ?? null,
    result: s.phase === "over" ? s.result : null,
    log: s.log.map((l) => ({ ...l, text: fill(l.text) })),
  };
}
