"use client";

// Daily tasks 2.0 (docs/08-new-features-spec.md section 19; owner, Oct 18): the goal card and streak on the Daily tab,
// the ladder on the Goals tab, and the reveals when a goal or a streak day pays.

import { GOALS, GOAL_COPY, NEXT_CHAPTER, addDay, chapters, goalById, goalProgress, partLine, streakMilestones, type GoalsState, type StreakReward } from "@/lib/goals";
import { isStreakMilestone, milestoneName } from "@/lib/streakMilestones";
import type { Celebration } from "../Celebrate";
import { RANKS } from "@/lib/ranks";
import { itemBySku } from "@/lib/city";

const pct = (x: number) => `${Math.round(Math.max(0, Math.min(1, x)) * 100)}%`;

type DayState = "done" | "frozen" | "today" | "missed" | "future";

const nyToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
/** The Monday of a New York date's week. */
const mondayOf = (day: string) => addDay(day, -((new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7));

/** What each day looks like on the streak's calendar. */
function dayStates(goals: GoalsState, today = nyToday()): (day: string) => DayState {
  const full = new Set(goals.streak.days ?? []);
  const { startedOn, lastDay } = goals.streak;
  return (day) => {
    if (full.has(day)) return "done";
    if (day > today) return "future";
    if (day === today) return "today";
    // A missed day inside the live run was forgiven (the week's freeze).
    if (startedOn && lastDay && day > startedOn && day < lastDay) return "frozen";
    return "missed";
  };
}

const DAY_MARK: Record<DayState, string> = { done: "🔥", frozen: "🧊", today: "", missed: "", future: "" };

function WeekStrip({ goals }: { goals: GoalsState }) {
  const today = nyToday();
  const mon = mondayOf(today);
  const state = dayStates(goals, today);
  return (
    <span className="streak-week" aria-label="This week">
      {["M", "T", "W", "T", "F", "S", "S"].map((l, i) => {
        const d = addDay(mon, i);
        const st = state(d);
        return (
          <span key={d} className={`streak-day ${st}`} title={`${d}: ${st}`}>
            <span className="streak-day-dot">{DAY_MARK[st]}</span>
            <span className="streak-day-label">{l}</span>
          </span>
        );
      })}
    </span>
  );
}

const REWARD_WORDS: Record<StreakReward, string> = {
  clout: `+${GOALS.streak.day3Clout} clout`,
  collectible: "a collectible you can't buy",
  pass: "a guest-list pass",
};

/** The streak on the Daily tab (owner, Oct 18: minimal): this week's dates, a flame on each full day. Tap for more. */
export function StreakRow({ goals, onOpen }: { goals: GoalsState; onOpen?: () => void }) {
  const today = nyToday();
  const mon = mondayOf(today);
  const full = new Set(goals.streak.days ?? []);
  return (
    <button className="streak-dates" onClick={onOpen} aria-label={`${goals.streak.current}-day streak. See streaks`}>
      <span className="streak-dates-row">
        {Array.from({ length: 7 }, (_, i) => {
          const d = addDay(mon, i);
          const done = full.has(d);
          return (
            <span key={d} className={`streak-date${done ? " done" : ""}${d === today ? " today" : ""}`}>
              {done ? "🔥" : Number(d.slice(8))}
            </span>
          );
        })}
      </span>
      <span className="streak-dates-foot">
        <span>{goals.streak.current ? `🔥 ${goals.streak.current}-day streak` : "Clear all five to start a streak"}</span>
        <span className="streak-dates-more">See streaks ›</span>
      </span>
    </button>
  );
}

/** The Streaks section: the run, this week, the last five weeks, the reward track and the stash. */
export function StreaksSection({ goals, owned, onBack }: { goals: GoalsState; owned: (sku: string) => boolean; onBack: () => void }) {
  const s = goals.streak;
  const today = nyToday();
  const state = dayStates(goals, today);
  const start = addDay(mondayOf(today), -28);
  const weeks = Array.from({ length: 5 }, (_, w) => Array.from({ length: 7 }, (_, d) => addDay(start, w * 7 + d)));
  const paid = new Map((s.rewards ?? []).map((r) => [r.day, r]));
  const track = streakMilestones(Math.max(28, s.next.day + 14)).filter((m) => m.day >= Math.min(s.current, 3) || paid.has(m.day)).slice(0, 6);
  const fullThisMonth = (s.days ?? []).length;
  return (
    <div className="stack-16 streaks">
      <button className="streaks-back" onClick={onBack}>‹ Tasks</button>
      <div className={`streaks-hero${s.current ? " on" : ""}`}>
        <span className="streaks-hero-flame" aria-hidden="true">🔥</span>
        <span className="streaks-hero-num">{s.current}</span>
        <span className="streaks-hero-label">{s.current === 1 ? "day streak" : "day streak"}</span>
        <span className="streaks-hero-sub">
          {s.today ? "Today's five: done. Unbothered. 💅" : s.current ? "Today's five aren't done yet. Don't let it go cold." : "Clear all five daily tasks to light it."}
        </span>
        <span className="streaks-stats">
          <span><b>{s.best}</b> best</span>
          <span><b>{fullThisMonth}</b> full days, 5 weeks</span>
          <span><b>{s.frozenThisWeek ? "Used" : "Ready"}</b> 🧊 freeze</span>
        </span>
      </div>

      <section className="stack-8">
        <p className="overline" style={{ margin: 0 }}>This week</p>
        <WeekStrip goals={goals} />
      </section>

      <section className="stack-8">
        <p className="overline" style={{ margin: 0 }}>Last five weeks</p>
        <div className="streaks-cal" role="grid" aria-label="Last five weeks">
          {["M", "T", "W", "T", "F", "S", "S"].map((l, i) => <span key={`h${i}`} className="streaks-cal-head">{l}</span>)}
          {weeks.flat().map((d) => {
            const st = state(d);
            return <span key={d} className={`streaks-cal-day ${st}`} title={d}>{st === "done" ? "🔥" : st === "frozen" ? "🧊" : Number(d.slice(8))}</span>;
          })}
        </div>
        <p className="meta" style={{ margin: 0 }}>🔥 all five done · 🧊 a missed day the weekly freeze covered</p>
      </section>

      <section className="stack-8">
        <p className="overline" style={{ margin: 0 }}>Reward track</p>
        {track.map((m) => {
          const got = paid.get(m.day);
          const next = !got && m.day === s.next.day;
          const it = got?.sku ? itemBySku(got.sku) : undefined;
          return (
            <div key={m.day} className={`streak-milestone${got ? " got" : next ? " next" : ""}`}>
              <span className="streak-milestone-day">Day {m.day}</span>
              <span className="streak-milestone-what">
                {m.reward === "clout" ? "💥" : m.reward === "pass" ? "🎟️" : it?.emoji ?? "🏆"} {m.reward === "collectible" && it ? it.name : REWARD_WORDS[m.reward]}
              </span>
              <span className="streak-milestone-state">{got ? "Got it ✓" : next ? `${m.day - s.current} to go` : ""}</span>
            </div>
          );
        })}
      </section>

      <section className="stack-8">
        <p className="overline" style={{ margin: 0 }}>Your stash</p>
        <div className="streak-stash">
          <span className="streak-stash-item"><span aria-hidden="true">🎟️</span><b>{goals.passes.held}</b><span>guest-list pass{goals.passes.held === 1 ? "" : "es"}</span></span>
          {GOALS.streak.collectibles.map((sku) => {
            const it = itemBySku(sku);
            const have = owned(sku);
            return (
              <span key={sku} className={`streak-stash-item${have ? "" : " locked"}`}>
                <span aria-hidden="true">{have ? it?.emoji ?? "🏆" : "❔"}</span>
                <span>{have ? it?.name : "Keep the streak going"}</span>
              </span>
            );
          })}
        </div>
      </section>

      <div className="card stack-4 streaks-rules">
        <p className="overline" style={{ margin: 0 }}>How streaks work</p>
        <p className="body" style={{ margin: 0, color: "var(--text-2)" }}>
          Clear all five daily tasks in a day (New York time) and the streak grows. Miss one day a week and we&apos;ll freeze it for you. Miss two and it&apos;s back to zero, but your best stays on the record.
          Day 3 pays {GOALS.streak.day3Clout} clout, then every 7 days brings a collectible you can&apos;t buy or a guest-list pass, in turns.
        </p>
      </div>
    </div>
  );
}

/** The Goals tab: every chapter, done ones ticked, the current one with its bar, locked ones behind their clout. */
export function GoalLadder({ goals, clout }: { goals: GoalsState; clout: number }) {
  const done = new Set(goals.done);
  return (
    <div className="stack-12">
      {chapters().map((ch) => {
        const rank = RANKS.find((r) => r.clout === ch.unlock);
        const locked = clout < ch.unlock && !ch.goals.some((g) => done.has(g.id));
        const finished = ch.goals.every((g) => done.has(g.id));
        return (
          <section key={ch.unlock} className={`goal-chapter${locked ? " locked" : ""}`}>
            <p className="overline goal-chapter-head">
              <span>{rank ? `${rank.emoji} ${rank.title}` : `${ch.unlock.toLocaleString("en-US")} clout`}</span>
              <span>{finished ? "Done ✓" : locked ? `🔒 Unlocks at ${ch.unlock.toLocaleString("en-US")} clout` : `${ch.goals.filter((g) => done.has(g.id)).length} of ${ch.goals.length}`}</span>
            </p>
            {ch.goals.map((g) => {
              const copy = GOAL_COPY[g.id];
              const isDone = done.has(g.id);
              const current = goals.goal?.id === g.id;
              const p = current ? goalProgress(goals.goal!.parts) : 0;
              return (
                <div key={g.id} className={`select-card multi goal-row${current ? " current" : ""}`} aria-pressed={isDone}>
                  <span className="select-emoji" aria-hidden="true">{copy.emoji}</span>
                  <span className="title" style={{ display: "block" }}>{copy.title}</span>
                  <span className="subtext" style={{ display: "block" }}>
                    {isDone ? `Done. +${g.reward.toLocaleString("en-US")} clout banked.` : locked ? `+${g.reward.toLocaleString("en-US")} clout · ${copy.line}` : `${copy.line} · +${g.reward.toLocaleString("en-US")} clout`}
                  </span>
                  {current && (
                    <span className="goal-row-progress">
                      <span className="goal-bar"><span style={{ width: pct(p) }} /></span>
                      <span className="goal-parts">{goals.goal!.parts.map((x) => <span key={x.unit}>{partLine(x)}</span>)}</span>
                    </span>
                  )}
                  {isDone && <span className="select-check" aria-hidden="true">✓</span>}
                </div>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}

/** What just paid: a finished goal, or a streak day's reward. */
export type GoalsReveal =
  | { kind: "goal"; id: string; next: string | null }
  | { kind: "streak"; day: number; reward: StreakReward; sku?: string }
  /** A round-number streak day with no reward of its own (30, 50, 100…): confetti and a line (owner, Nov 3). */
  | { kind: "milestone"; day: number };

/** Compares two goals states for what just paid (the first one found). */
export function revealBetween(before: GoalsState | null, after: GoalsState, collectibleOwned: (sku: string) => boolean): GoalsReveal | null {
  if (!before) return null;
  const fresh = after.done.find((id) => !before.done.includes(id));
  if (fresh) return { kind: "goal", id: fresh, next: after.goal?.id ?? null };
  const day = after.streak.current;
  if (day > before.streak.current) {
    if (day === 3) return { kind: "streak", day, reward: "clout" };
    if (day % GOALS.streak.every === 0) {
      if ((day / GOALS.streak.every) % 2 === 0 && after.passes.held > before.passes.held) return { kind: "streak", day, reward: "pass" };
      const sku = [...GOALS.streak.collectibles].reverse().find((x) => collectibleOwned(x));
      if ((day / GOALS.streak.every) % 2 === 1) return { kind: "streak", day, reward: "collectible", sku };
    }
    if (isStreakMilestone(day)) return { kind: "milestone", day };
  }
  return null;
}

/**
 * A goals reveal as a celebration (components/Celebrate.tsx): a goal done is a banner; a streak reward or a round-number day
 * is a takeover; 100 days and every hundred after, and a year, are legends.
 */
export function goalsCelebration(reveal: GoalsReveal, onOpenGoals?: () => void): Celebration {
  if (reveal.kind === "goal") {
    const copy = GOAL_COPY[reveal.id] ?? GOAL_COPY[NEXT_CHAPTER];
    const next = reveal.next ? GOAL_COPY[reveal.next] : null;
    const reward = goalById(reveal.id)?.reward ?? 0;
    return { rung: 2, emoji: copy.emoji, tag: "Goal done", title: copy.title,
      rewards: [{ tone: "clout", text: `+${reward.toLocaleString("en-US")} 🔥` }, ...(next ? [{ text: `Next: ${next.title}` }] : [])], onCta: onOpenGoals };
  }
  const day = reveal.day;
  const share = `A ${day}-day streak in Clout City.`;
  if (reveal.kind === "milestone" && day >= 100) {
    return { rung: 4, emoji: "🔥", tag: `${milestoneName(day)} straight`, num: String(day), unit: "days in a row", title: day >= 365 ? "A whole year" : `${milestoneName(day)} straight`,
      line: day >= 365 ? "All five, every day, for a year. The subway has been on time less often than you." : `${day} days in a row. Your landlord wishes you were this reliable with rent.`,
      art: "story", share, cta: "Keep going" };
  }
  if (reveal.kind === "milestone") {
    return { rung: 3, emoji: "🔥", num: String(day), tag: `${day}-day streak`, title: `${milestoneName(day)} straight`, art: "story",
      line: `${day} days in a row. Your landlord wishes you were this reliable with rent.`, lola: "Consistency is the new main character energy.", share, cta: "Keep going" };
  }
  const base = { rung: 3 as const, emoji: "🔥", num: String(day), tag: `${day}-day streak`, art: "story" as const, share, cta: "Love that" };
  if (reveal.reward === "pass") {
    return { ...base, emoji: "🎟️", title: "A guest-list pass", line: "One night past any club door, or up to a VIP floor you can\u2019t reach yet.",
      rewards: [{ text: "🎟️ +1 guest pass" }], lola: "The bouncer will pretend he always knew you." };
  }
  if (reveal.reward === "collectible") {
    const it = reveal.sku ? itemBySku(reveal.sku) : undefined;
    return { ...base, emoji: it?.emoji ?? "🏆", title: it?.name ?? "A collectible", line: "Not sold anywhere. Ever. It\u2019s in your Possessions.",
      rewards: [{ text: `${it?.emoji ?? "🏆"} Yours to keep` }], lola: "Put it somewhere guests will trip over it." };
  }
  return { ...base, title: "Three days straight", line: "Three full days in a row.", rewards: [{ tone: "clout", text: `+${GOALS.streak.day3Clout} 🔥` }],
    lola: "Consistency is the new main character energy." };
}
