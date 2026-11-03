// The welcome back's one action (owner, Nov 3: "it has too much information which will lead to indecision. Pick the highest
// leverage action, based on the situation of the player"). Pure: GameShell gathers the situation, this picks ONE thing, first
// match down the ladder:
//   1 rent trouble (eviction, late, or due and short)      → Bills / a gig
//   2 a reward waiting to collect (Clout Pass)              → collect it
//   3 a 3+ day streak at risk late in the New York day       → finish today's five
//   4 a happening on right now                              → go to it
//   5 one step from done: a regular card one visit off, a skill 1-2 practice from its level, a goal 80%+ there
//   6 messages waiting                                       → reply
//   7 a new story chapter                                    → read it
//   8 otherwise: the next daily task, or a place to try
// Ties inside a rung go to the one that also clears a daily task (the "why" line says so). A kind the player put off with
// Later yesterday is skipped today, rent excepted.

export type WelcomeKind = "rent" | "reward" | "streak" | "happening" | "stamp" | "skill" | "goal" | "messages" | "story" | "task" | "new";

export type WelcomeTarget = "bills" | "gigs" | "pass" | "tasks" | "goals" | "skills" | "messages" | "story" | "pick";

export interface WelcomeAction {
  kind: WelcomeKind;
  emoji: string;
  title: string;
  /** Where, or what it is. */
  sub: string | null;
  /** What you get · what it costs. */
  detail: string | null;
  /** Why now, one line. */
  why: string | null;
  cta: string;
  target: WelcomeTarget;
}

export interface WelcomeSituation {
  rent: { title: string; line: string; canPay: boolean } | null;
  passReady: number;
  streak: { current: number; doneToday: boolean } | null;
  /** The New York hour, 0-23. */
  nyHour: number;
  tasks: { done: number; total: number; next: { title: string; place: string | null } | null; undonePlaces: string[] };
  pick: { why: "happening" | "stamp" | "new"; emoji: string; title: string; place: string; placeName: string; get: string | null; energy: number; note: string | null; here: boolean } | null;
  goal: { emoji: string; title: string; pct: number; left: string | null } | null;
  skill: { emoji: string; name: string; level: number; more: number; how: string; perk: boolean } | null;
  unread: number;
  story: { title: string; emoji: string; fresh: number } | null;
  /** Kinds the player put off yesterday with Later. */
  skipped: readonly WelcomeKind[];
}

export const WELCOME = { streakMin: 3, streakLateHour: 17, goalPct: 0.8, skillMore: 2 } as const;

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
/** A sentence ending in exactly one stop. */
const stop = (t: string) => `${t.replace(/[.!?]+$/, "")}.`;

/** Every rung that applies, best first (the first is the pick). */
export function welcomeLadder(s: WelcomeSituation): WelcomeAction[] {
  const out: WelcomeAction[] = [];
  const clearsTask = (place: string | null | undefined) => !!place && s.tasks.undonePlaces.includes(place);
  if (s.rent) {
    out.push({ kind: "rent", emoji: s.rent.canPay ? "🧾" : "💼", title: s.rent.title.replace(/^\p{Extended_Pictographic}\s*/u, ""), sub: null, detail: s.rent.line, why: null,
      cta: s.rent.canPay ? "Pay in Bills" : "Find a gig", target: s.rent.canPay ? "bills" : "gigs" });
  }
  if (s.passReady > 0) {
    out.push({ kind: "reward", emoji: "🎁", title: `${plural(s.passReady, "Clout Pass reward")} to collect`, sub: null,
      detail: "Yours already. One tap and they're in your pocket.", why: null, cta: "Collect", target: "pass" });
  }
  const left = s.tasks.total - s.tasks.done;
  if (s.streak && s.streak.current >= WELCOME.streakMin && !s.streak.doneToday && left > 0 && s.nyHour >= WELCOME.streakLateHour) {
    out.push({ kind: "streak", emoji: "🔥", title: `Keep your ${s.streak.current}-day streak alive`, sub: s.tasks.next ? `Next up: ${s.tasks.next.title}` : null,
      detail: `${s.tasks.done} of ${s.tasks.total} tasks done · ${left} to go`, why: "It resets at midnight.", cta: "Finish today's five", target: "tasks" });
  }
  const pick = s.pick;
  const pickAction = (kind: WelcomeKind, why: string | null): WelcomeAction => ({
    kind, emoji: pick!.emoji, title: pick!.title, sub: `at ${pick!.placeName}`,
    detail: [pick!.get, pick!.energy ? `⚡ ${pick!.energy} Energy` : null].filter(Boolean).join(" · ") || null,
    why: clearsTask(pick!.place) ? `${why ? `${why} ` : ""}It also clears a daily task.` : why,
    cta: pick!.here ? "Do it now" : "Let's go", target: "pick",
  });
  if (pick?.why === "happening") out.push(pickAction("happening", pick.note ? stop(pick.note) : "On right now."));
  // One step from done: the regular card, the skill, the goal; the one that also clears a task first.
  const close: (WelcomeAction & { doubles: boolean })[] = [];
  if (pick?.why === "stamp") close.push({ ...pickAction("stamp", pick.note ? stop(`One more visit: ${pick.note}`) : "One more visit to a reward."), doubles: clearsTask(pick.place) });
  if (s.skill && s.skill.more <= WELCOME.skillMore) {
    close.push({ kind: "skill", emoji: s.skill.emoji, title: `${s.skill.name} ${s.skill.level} → ${s.skill.level + 1}`, sub: s.skill.how,
      detail: `${plural(s.skill.more, "more practice")}${s.skill.perk ? " · opens a new perk" : ""}`, why: "So close you can taste it.", cta: "See how", target: "skills", doubles: false });
  }
  if (s.goal && s.goal.pct >= WELCOME.goalPct) {
    close.push({ kind: "goal", emoji: s.goal.emoji, title: s.goal.title, sub: s.goal.left ? `Left: ${s.goal.left}` : null,
      detail: `${Math.round(s.goal.pct * 100)}% there`, why: "The finish line is right there.", cta: "See the goal", target: "goals", doubles: false });
  }
  close.sort((a, b) => Number(b.doubles) - Number(a.doubles));
  for (const { doubles: _d, ...a } of close) out.push(a);
  if (s.unread > 0) {
    out.push({ kind: "messages", emoji: "💬", title: `${plural(s.unread, "new message")}`, sub: null, detail: "Someone's waiting on you.", why: null, cta: "Read them", target: "messages" });
  }
  if (s.story && s.story.fresh > 0) {
    out.push({ kind: "story", emoji: s.story.emoji, title: s.story.title, sub: `${plural(s.story.fresh, "new chapter")}`, detail: "+10 🔥 clout for reading", why: "Everyone will be talking about it.",
      cta: "Read it", target: "story" });
  }
  if (s.tasks.next) {
    out.push({ kind: "task", emoji: "✅", title: s.tasks.next.title, sub: null, detail: `${s.tasks.done} of ${s.tasks.total} daily tasks done`, why: null, cta: "Let's go", target: "tasks" });
  }
  if (pick?.why === "new") out.push(pickAction("new", "You've never done this. Everyone who matters has."));
  return out;
}

/** The one action to show, or null when there's nothing to suggest. */
export function pickWelcome(s: WelcomeSituation): WelcomeAction | null {
  const all = welcomeLadder(s);
  return all.find((a) => a.kind === "rent" || !s.skipped.includes(a.kind)) ?? all[0] ?? null;
}
