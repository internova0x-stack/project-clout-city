"use client";

import { CAMPAIGN } from "@/lib/campaign";
import { ExclusiveEventCard, type MoneyHandlers } from "../city/Money";
import { liveParty } from "@/lib/store";
import type { StoreProduct } from "@/lib/store";
import { useEffect, useState } from "react";
import { CITY_ECONOMY, CLUB_EVENTS, closedLine, eventOpen, eventToday, formatCountdown, placeById, placeOpen, realMinutesUntilOpen, realMsUntilOpen } from "@/lib/city";
import { cityMinutes } from "@/lib/cityClock";
import { eventAvailability, eventById, taskDoneLine, taskQuip, taskRewardLine, taskTitle, type CityState, type DailyTask } from "@/lib/cityState";
import { GOAL_COPY, type GoalsState } from "@/lib/goals";
import { GoalLadder, StreakRow, StreaksSection } from "./Goals";
import { GAME_CONFIG } from "@/lib/config";
import { ECONOMY, formatCash } from "@/lib/economy";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { describeEntry, sampleLedger, type LedgerEntry } from "@/lib/ledger";
import { CloutCard } from "../city/CloutCard";
import { EffectChips, useGameNow } from "../city/Common";
import type { StoryFeed } from "@/lib/storyFeed";
import { Sheet } from "../Sheet";
import { CalendarSection, type CalendarHandlers } from "../city/Calendar";
import { HuntTab } from "../hunt/Hunt";
import type { HuntState } from "@/lib/hunts";
import { LEVEL_AT, MAX_LEVEL, SKILLS, levelFor, levelProgress, type SkillState } from "@/lib/skills";

/** Midnight New York time, shown in the player's own time zone. */
function resetTimeLocal(): string {
  const now = new Date();
  const ny = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const toMidnight = (24 * 60 - (ny.getHours() * 60 + ny.getMinutes())) * 60_000;
  return new Date(now.getTime() + toMidnight).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/** Migration 0063: the skill task's level and progress toward the next level. */
function TaskSkill({ id, skills }: { id: string; skills: SkillState[] }) {
  const def = SKILLS.find((d) => d.id === id);
  if (!def) return null;
  const s = skills.find((k) => k.id === id) ?? { id: def.id, level: 0, best: 0, practice: 0, rusty: false };
  const at = levelFor(s.practice);
  const top = at >= MAX_LEVEL;
  const into = s.practice - LEVEL_AT[at];
  const need = top ? 0 : LEVEL_AT[at + 1] - LEVEL_AT[at];
  const part = s.level < MAX_LEVEL && !s.rusty ? levelProgress(s.practice) : 0;
  return (
    <span className="task-skill">
      <span className="task-skill-head">
        <span>{def.name} · Level {s.level}{s.rusty && s.best > s.level ? " 🧊" : ""}</span>
        <span>{top ? "Maxed out" : `${into}/${need} to Level ${at + 1}`}</span>
      </span>
      {/* The profile's ten-segment level bar, the current level part-filled by its progress. */}
      <span className="skill-bar" role="meter" aria-label={`${def.name} level`} aria-valuemin={0} aria-valuemax={MAX_LEVEL} aria-valuenow={s.level}>
        {Array.from({ length: MAX_LEVEL }, (_, i) => (
          <span key={i} className={i < s.level ? "on" : i < s.best ? "best" : ""}>
            {i === s.level && part > 0 && <i style={{ width: `${Math.round(part * 100)}%` }} />}
          </span>
        ))}
      </span>
    </span>
  );
}

/** Tasks/Goals (C9 Daily / Goals). */
export function TasksSheet({
  open, onClose, partyDone, onOpenParty, cliqueCount, city, onOpenPlace, story = null, onStoryTask, hunt, tab: initialTab, skills = [], onCook, goals = null, onOpenSkills, campaign, pass,
}: {
  open: boolean; onClose: () => void; partyDone: boolean; onOpenParty: () => void; cliqueCount: number;
  city: CityState | null; onOpenPlace: (placeId: string) => void;
  story?: StoryFeed | null; onStoryTask?: (task: StoryFeed["tasks"][number]) => void;
  /** v0.6 treasure hunts (migration 0018): the Hunt tab. */
  hunt?: { state: HuntState; style: string; busy: boolean; onJoin: () => void };
  tab?: "daily" | "goals" | "hunt" | "streaks" | "pass";
  /** The Clout Pass (migration 0156): its own tab, with a dot while a reward waits. */
  pass?: { node: React.ReactNode; ready: number } | null;
  /** Migration 0063: the player's skills, for the skill task's level and progress. */
  skills?: SkillState[];
  /** The cooking task opens the kitchen instead of a place. */
  onCook?: () => void;
  /** Daily tasks 2.0 (migrations 0073, 0074): the suggested goal, the streak and passes. */
  goals?: GoalsState | null;
  /** Owner, Oct 23: the skill task links to the Skills sheet. */
  onOpenSkills?: (skill: string) => void;
  /** Campaign Mode (owner, Oct 29): this week's two campaign tasks, under the five; tapping one opens the campaign. */
  campaign?: { tasks: { id: string; title: string; tag: string; how: string; isDone: boolean }[]; onOpen: (task: string) => void } | null;
}) {
  const [tab, setTab] = useState<"daily" | "goals" | "hunt" | "streaks" | "pass">(initialTab ?? "daily");
  useEffect(() => { if (open && initialTab) setTab(initialTab); }, [open, initialTab]);
  const { cliqueSize } = ECONOMY.invites;
  const tasks = city?.tasks ?? [];
  const done = tasks.filter((t) => t.done_at).length;
  return (
    <Sheet open={open} onClose={onClose} label="Tasks and goals">
      <div className="stack-16">
        <h2 className="display-lg" style={{ margin: 0, paddingRight: 44 }}>Tasks</h2>
        <div className="segmented" role="group" aria-label="Tasks">
          <button aria-pressed={tab === "daily"} onClick={() => setTab("daily")}>Daily</button>
          <button aria-pressed={tab === "goals"} onClick={() => setTab("goals")}>Goals</button>
          {hunt && <button aria-pressed={tab === "hunt"} onClick={() => setTab("hunt")}>Hunt{hunt.state.hunt && !hunt.state.hunt.completedAt ? " 🗺️" : ""}</button>}
          {pass && <button aria-pressed={tab === "pass"} onClick={() => setTab("pass")}>Pass{pass.ready > 0 ? " 🎁" : ""}</button>}
        </div>
        {tab === "pass" && pass ? (
          pass.node
        ) : tab === "streaks" && goals ? (
          <StreaksSection goals={goals} owned={(sku) => !!city?.items.some((i) => i.sku === sku)} onBack={() => setTab("daily")} />
        ) : tab === "hunt" && hunt ? (
          <HuntTab state={hunt.state} style={hunt.style} busy={hunt.busy} onJoin={hunt.onJoin} onOpenPlace={onOpenPlace} />
        ) : tab === "daily" ? (
          <div className="stack-12">
            {!partyDone && (
              <div className="select-card" style={{ cursor: "pointer" }} onClick={onOpenParty} role="button" tabIndex={0}>
                <span className="select-emoji" aria-hidden="true">🎟️</span>
                <span className="title" style={{ display: "block" }}>Use the stolen tickets to celebrity influencer Peyton Pastel&apos;s party</span>
                <span className="subtext" style={{ display: "block" }}>First task. Velvet Static, Long Island City. You&apos;re Brittany tonight.</span>
              </div>
            )}
            {/* Owner, Oct 18: five tasks a day, no more. A story's task shows on its place's action instead (Places). */}
            {city ? (
              <>
                {goals && partyDone && <StreakRow goals={goals} onOpen={() => setTab("streaks")} />}
                <p className="meta" style={{ margin: 0 }}>
                  {tasks.length > 0 && done === tasks.length
                    ? "All five done. Unbothered. Moisturized. Paid. 💅"
                    : `${done} of ${tasks.length} done. Clear all five: +${formatCash(CITY_ECONOMY.dailyTasks.bonus)} 💸 · fresh list at ${resetTimeLocal()}`}
                </p>
                {tasks.map((t) => (
                  <div
                    key={t.id}
                    className="select-card multi"
                    aria-pressed={!!t.done_at}
                    role="button"
                    tabIndex={0}
                    style={{ cursor: t.done_at ? "default" : "pointer" }}
                    onClick={t.done_at ? undefined : () => (t.kind === "cook" && onCook ? onCook() : onOpenPlace(t.place_id))}
                  >
                    <span className="select-emoji" aria-hidden="true">{t.skill ? SKILLS.find((d) => d.id === t.skill)?.emoji ?? "⭐" : t.kind === "event" ? "🍸" : t.kind === "gossip" ? "🍵" : placeById(t.place_id)?.emoji ?? "📍"}</span>
                    <span className="title" style={{ display: "block" }}>{taskTitle(t)}</span>
                    <span className="subtext" style={{ display: "block" }}>{t.done_at ? taskDoneLine(t) : taskQuip(t)}</span>
                    {!t.done_at && (
                      <span className="task-meta">
                        <span>{taskRewardLine(t)} · {t.kind === "gossip" ? "Gossip · " : ""}{t.kind === "cook" ? "Your kitchen" : placeById(t.place_id)?.neighborhood ?? "Queens"}</span>
                        {t.goal && GOAL_COPY[t.goal] && <span className="task-goal">🎯 {GOAL_COPY[t.goal].toward}</span>}
                        {placeById(t.place_id)?.hours && <TaskHours placeId={t.place_id} offsetSeconds={city.clockOffsetSeconds} />}
                      </span>
                    )}
                    {t.skill && <TaskSkill id={t.skill} skills={skills} />}
                    {t.skill && onOpenSkills && (
                      <button className="task-skills-link" onClick={(e) => { e.stopPropagation(); onOpenSkills(t.skill!); }}>See skills ›</button>
                    )}
                    {t.done_at && <span className="select-check" aria-hidden="true">✓</span>}
                  </div>
                ))}
                {campaign && campaign.tasks.length > 0 && (
                  <>
                    <p className="overline" style={{ margin: "8px 0 0" }}>🗳️ Campaign · +{CAMPAIGN.taskClout} 🔥 each at End Week</p>
                    {campaign.tasks.map((t) => (
                      <div key={t.id} className="select-card multi" aria-pressed={t.isDone} role="button" tabIndex={0} style={{ cursor: "pointer" }} onClick={() => campaign.onOpen(t.id)}>
                        <span className="select-emoji" aria-hidden="true">🗳️</span>
                        <span className="title" style={{ display: "block" }}>{t.title}</span>
                        <span className="task-meta"><span>{t.isDone ? "On the calendar. Pays at End Week." : `👉 ${t.how}`}</span></span>
                        {t.isDone && <span className="select-check" aria-hidden="true">✓</span>}
                      </div>
                    ))}
                  </>
                )}
              </>
            ) : (
              partyDone && (
                <div className="card hazard-edge stack-4" style={{ paddingLeft: 22 }}>
                  <p className="overline" style={{ margin: 0 }}>Coming soon</p>
                  <p className="body" style={{ margin: 0, color: "var(--text-2)" }}>Five daily tasks, paid in cash, reset at midnight New York time. The to-do list is still being argued over.</p>
                </div>
              )
            )}
          </div>
        ) : (
          <div className="stack-12">
            <div className="select-card multi" aria-pressed={cliqueCount >= cliqueSize}>
              <span className="select-emoji" aria-hidden="true">👯</span>
              <span className="title" style={{ display: "block" }}>Build a crew of {cliqueSize}</span>
              <span className="subtext" style={{ display: "block" }}>{Math.min(cliqueCount, cliqueSize)} of {cliqueSize} friends joined through your link. Fame is a group project.</span>
            </div>
            {city && goals ? (
              <GoalLadder goals={goals} clout={city.player.clout} />
            ) : city && (
              <p className="meta" style={{ margin: 0 }}>Your goals are loading. Lola is pretending she doesn&apos;t already know them.</p>
            )}
          </div>
        )}
      </div>
    </Sheet>
  );
}


/** Events (C26): the first-task party until it's done, then club events with real-minute countdowns. */
/** C2: a task at a place that's shut right now says when it opens (owner, Oct 20: tasks may use places with hours). */
function TaskHours({ placeId, offsetSeconds }: { placeId: string; offsetSeconds: number }) {
  const minutes = cityMinutes(useGameNow(offsetSeconds, 1000), GAME_CONFIG.cityClock);
  const place = placeById(placeId);
  if (!place || placeOpen(place, minutes)) return null;
  return <span className="meta">🕒 {closedLine(place, minutes, GAME_CONFIG.cityClock.realHoursPerCityDay)}</span>;
}

export function EventsSheet({
  open, onClose, partyDone, onOpenParty, city, busy, onAttend, exclusive, onGoThere, calendar,
}: {
  /** C5 (migration 0096): events on real New York dates, first in the list. */
  calendar?: CalendarHandlers;
  open: boolean; onClose: () => void; partyDone: boolean; onOpenParty: () => void;
  city: CityState | null; busy: string | null; onAttend: (eventId: string) => void;
  /** #12: head to a venue before its doors open. */
  onGoThere?: (placeId: string) => void;
  /** v0.5 exclusive events (real cash), promoted first (Clarifications 9). */
  exclusive?: { products: StoreProduct[]; nowMs: number; h: MoneyHandlers };
}) {
  const now = useGameNow(city?.clockOffsetSeconds ?? 0, 1000);
  const minutes = cityMinutes(now, GAME_CONFIG.cityClock);
  return (
    <Sheet open={open} onClose={onClose} label="Events">
      <div className="stack-16">
        <h2 className="display-lg" style={{ margin: 0, paddingRight: 44 }}>Events</h2>
        {!partyDone && (
          <button className="party-card" style={{ textAlign: "left", width: "100%" }} onClick={onOpenParty}>
            <span className="tag tag-event">🎟️ Stolen tickets · Happening now</span>
            <span className="title" style={{ display: "block", marginTop: 8 }}>Celebrity influencer Peyton Pastel&apos;s launch party (you&apos;re not invited)</span>
            <span className="subtext" style={{ display: "block" }}>Velvet Static, Long Island City</span>
          </button>
        )}
        {city && calendar && <CalendarSection city={city} nowMs={now} h={calendar} />}
        {city ? (() => {
          // #12 (owner, Oct 14): open events first, then by how soon their doors open.
          const club = CLUB_EVENTS.filter((e) => eventToday(e)).sort((x, y) => {
            const ox = eventOpen(x, minutes), oy = eventOpen(y, minutes);
            if (ox !== oy) return ox ? -1 : 1;
            return realMinutesUntilOpen(x, minutes, GAME_CONFIG.cityClock.realHoursPerCityDay) - realMinutesUntilOpen(y, minutes, GAME_CONFIG.cityClock.realHoursPerCityDay);
          });
          const cards: React.ReactNode[] = club.map((ev) => {
            const isOpen = eventOpen(ev, minutes);
            const av = eventAvailability(ev, isOpen, city);
            const went = city.attendedToday.includes(ev.id);
            const wait = formatCountdown(realMsUntilOpen(ev, now, GAME_CONFIG.cityClock.realHoursPerCityDay));
            const here = city.player.at_place === ev.placeId;
            return (
              <div key={ev.id} className="item-card">
                <span className="tag tag-event">🍸 Club event{isOpen ? " · Happening now" : ""}</span>
                <span className="title" style={{ display: "block" }}>{ev.name}</span>
                <span className="subtext">{ev.blurb}</span>
                <span className="meta">{placeById(ev.placeId)?.name} · {ev.startHour > 12 ? ev.startHour - 12 : ev.startHour} {ev.startHour >= 12 ? "PM" : "AM"} city time, {ev.hours} h</span>
                <EffectChips energy={CITY_ECONOMY.energy.eventCost} clout={ev.clout} mood={ev.mood} confidence={ev.confidence} />
                {went ? (
                  <span className="owned-chip">You went. Back tomorrow.</span>
                ) : !isOpen ? (
                  <>
                    <span className="wait-chip tabular" role="timer">🕒 Opens in {wait} · Entry {formatCash(ev.entry)}</span>
                    {!here && onGoThere && <button className="btn btn-secondary btn-sm" onClick={() => onGoThere(ev.placeId)}>Go there and wait</button>}
                  </>
                ) : (
                  <>
                    {!av.ok && <span className="meta reason">{av.reason}</span>}
                    <button className="btn btn-taxi btn-sm" disabled={!av.ok || busy !== null} onClick={() => onAttend(ev.id)}>
                      {busy === `event:${ev.id}` ? "…" : formatCash(ev.entry)}
                    </button>
                  </>
                )}
              </div>
            );
          });
          // Exclusive (real-money) parties sit somewhere from 3rd to 7th, the same spot all day for a player.
          const day = new Date(now).toISOString().slice(0, 10);
          (exclusive?.products.filter((p) => liveParty(p, exclusive.nowMs)) ?? []).forEach((p, k) => {
            const seed = [...`${city.player.id}:${day}:${p.sku}`].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
            const at = Math.min(cards.length, 2 + (seed % 5)) + k;
            cards.splice(Math.min(at, cards.length), 0, <ExclusiveEventCard key={p.sku} p={p} nowMs={exclusive!.nowMs} h={exclusive!.h} />);
          });
          return cards;
        })() : (
          partyDone && (
            <div className="card hazard-edge stack-4" style={{ paddingLeft: 22 }}>
              <p className="overline" style={{ margin: 0 }}>Coming soon</p>
              <p className="body" style={{ margin: 0, color: "var(--text-2)" }}>No more parties tonight. Even Queens needs a night off. Club events open soon.</p>
            </div>
          )
        )}
      </div>
    </Sheet>
  );
}

/** Loads the cash history: ledger_feed() (0023) names each row; before it, the bare ledger. */
function useLedger(refreshKey: unknown): LedgerEntry[] | null {
  const [rows, setRows] = useState<LedgerEntry[] | null>(null);
  useEffect(() => {
    // /preview runs without a player: sample rows there (development only).
    if (process.env.NODE_ENV !== "production" && window.location.pathname.startsWith("/preview")) return setRows(sampleLedger());
    const supabase = getBrowserSupabase();
    if (!supabase) return setRows([]);
    void (async () => {
      const feed = await supabase.rpc("ledger_feed", { p_limit: 50 });
      if (!feed.error) return setRows((feed.data as LedgerEntry[]) ?? []);
      const { data } = await supabase.from("ledger").select("id, amount, kind, ref, created_at").eq("currency", "cash")
        .order("created_at", { ascending: false }).limit(50);
      setRows(((data ?? []) as { id: number; amount: number; kind: string; ref: string; created_at: string }[]).map((r) => ({ ...r, at: r.created_at })));
    })();
  }, [refreshKey]);
  return rows;
}

/** Cash history (#29): each row says where and what. */
/** The Bank shows this many transactions, then "View more" adds as many again (owner, Oct 22). */
const LEDGER_PAGE = 10;

export function LedgerList({ rows }: { rows: LedgerEntry[] | null }) {
  const [shown, setShown] = useState(LEDGER_PAGE);
  return (
    <div>
      {rows === null && <p className="meta">Loading…</p>}
      {rows?.length === 0 && <p className="meta">No transactions yet. Spend something; it&apos;s good for the economy.</p>}
      {rows?.slice(0, shown).map((r) => {
        const d = describeEntry(r);
        return (
          <div key={r.id} className="ledger-row">
            <span className="ledger-emoji" aria-hidden="true">{d.emoji}</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="title" style={{ display: "block", fontSize: 15 }}>{d.title}</span>
              <span className="meta" style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {[d.detail, new Date(r.at).toLocaleDateString(undefined, { month: "short", day: "numeric" })].filter(Boolean).join(" · ")}
              </span>
            </span>
            <span className={`body-strong ${r.amount > 0 ? "money-pos" : "money-neg"}`}>
              {r.amount > 0 ? "+" : "−"}{formatCash(Math.abs(r.amount))}
            </span>
          </div>
        );
      })}
      {rows && rows.length > shown && (
        <button className="btn btn-secondary ledger-more" type="button" onClick={() => setShown((n) => n + LEDGER_PAGE)}>
          View more ({rows.length - shown})
        </button>
      )}
    </div>
  );
}

/** The Bank (#28): the virtual card with the balance, this week's in and out, then the history. */
export function BankView({ balance, handle }: { balance: number; handle: string }) {
  const rows = useLedger(balance);
  const weekAgo = Date.now() - 7 * 24 * 3_600_000;
  const week = (rows ?? []).filter((r) => Date.parse(r.at) >= weekAgo);
  const cashIn = week.filter((r) => r.amount > 0).reduce((a, r) => a + r.amount, 0);
  const cashOut = week.filter((r) => r.amount < 0).reduce((a, r) => a - r.amount, 0);
  return (
    <div className="stack-16">
      <CloutCard handle={handle} balance={formatCash(balance)} />
      <div className="bank-week">
        <span><b className="money-pos">+{formatCash(cashIn)}</b>In this week</span>
        <span><b className="money-neg">−{formatCash(cashOut)}</b>Out this week</span>
      </div>
      <p className="subtext" style={{ margin: 0 }}>Virtual cash only. It can never be bought with real money.</p>
      <LedgerList rows={rows} />
    </div>
  );
}

/** Bank balance → transaction history. */
export function BankSheet({ open, onClose, bank, handle = "" }: { open: boolean; onClose: () => void; bank: number; handle?: string }) {
  return (
    <Sheet open={open} onClose={onClose} label="Bank">
      <div className="stack-16">
        <h2 className="display-lg" style={{ margin: 0, paddingRight: 44 }}>Bank</h2>
        {open && <BankView balance={bank} handle={handle} />}
      </div>
    </Sheet>
  );
}
