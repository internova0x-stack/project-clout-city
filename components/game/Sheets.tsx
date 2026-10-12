"use client";

import { useEffect, useState } from "react";
import { CITY_ECONOMY, CLUB_EVENTS, eventOpen, placeById, realMinutesUntilOpen } from "@/lib/city";
import { cityMinutes } from "@/lib/cityClock";
import { eventAvailability, eventById, type CityState, type DailyTask } from "@/lib/cityState";
import { GAME_CONFIG } from "@/lib/config";
import { ECONOMY, formatCash } from "@/lib/economy";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { EffectChips, useGameNow } from "../city/Common";
import { Sheet } from "../Sheet";

const TASK_VERB: Record<DailyTask["kind"], string> = { visit: "Get seen at", eat: "Eat at", shift: "Work a shift at", hangout: "Hang out at", event: "Go to" };

function taskTitle(t: DailyTask): string {
  if (t.kind === "event") return `Go to ${eventById(t.action_id)?.name ?? "a club event"}`;
  return `${TASK_VERB[t.kind]} ${placeById(t.place_id)?.name ?? "a place"}`;
}

/** Midnight New York time, shown in the player's own time zone. */
function resetTimeLocal(): string {
  const now = new Date();
  const ny = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const toMidnight = (24 * 60 - (ny.getHours() * 60 + ny.getMinutes())) * 60_000;
  return new Date(now.getTime() + toMidnight).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/** Tasks/Goals (C9 Daily / Goals). */
export function TasksSheet({
  open, onClose, partyDone, onOpenParty, cliqueCount, city, onOpenPlace,
}: {
  open: boolean; onClose: () => void; partyDone: boolean; onOpenParty: () => void; cliqueCount: number;
  city: CityState | null; onOpenPlace: (placeId: string) => void;
}) {
  const [tab, setTab] = useState<"daily" | "goals">("daily");
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
        </div>
        {tab === "daily" ? (
          <div className="stack-12">
            {!partyDone && (
              <div className="select-card" style={{ cursor: "pointer" }} onClick={onOpenParty} role="button" tabIndex={0}>
                <span className="select-emoji" aria-hidden="true">🍾</span>
                <span className="title" style={{ display: "block" }}>You&apos;ve been invited to a party</span>
                <span className="subtext" style={{ display: "block" }}>First task. Pull up to Velvet Static in Long Island City.</span>
              </div>
            )}
            {city ? (
              <>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <span className="meta">{done} of {tasks.length} done · new list at {resetTimeLocal()}</span>
                  <span className="meta">All five: +{formatCash(CITY_ECONOMY.dailyTasks.bonus)}</span>
                </div>
                {tasks.map((t) => (
                  <div
                    key={t.id}
                    className="select-card multi"
                    aria-pressed={!!t.done_at}
                    role="button"
                    tabIndex={0}
                    style={{ cursor: t.done_at ? "default" : "pointer" }}
                    onClick={t.done_at ? undefined : () => onOpenPlace(t.place_id)}
                  >
                    <span className="select-emoji" aria-hidden="true">{t.kind === "event" ? "🍸" : placeById(t.place_id)?.emoji ?? "📍"}</span>
                    <span className="title" style={{ display: "block" }}>{taskTitle(t)}</span>
                    <span className="subtext" style={{ display: "block" }}>{t.done_at ? "Done. Paid." : `Pays ${formatCash(t.reward)} · ${placeById(t.place_id)?.neighborhood ?? "Queens"}`}</span>
                    {t.done_at && <span className="select-check" aria-hidden="true">✓</span>}
                  </div>
                ))}
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
              <span className="title" style={{ display: "block" }}>Build a clique of {cliqueSize}</span>
              <span className="subtext" style={{ display: "block" }}>{Math.min(cliqueCount, cliqueSize)} of {cliqueSize} friends joined through your link.</span>
            </div>
            {city && (
              <>
                <Goal emoji="🛍️" title="Make your first purchase" done={city.items.some((i) => i.acquired === "bought")} line="Anything from the Shop. Retail therapy counts as self-care." />
                <Goal emoji="💼" title="Collect your first gig payout" done={city.gigs.some((g) => g.collected_at)} line="Gigs live in your Phone. Bigger pay than a shift." />
                <Goal emoji="🔥" title="Reach 2,000 clout" done={city.player.clout >= 2000} line={`${city.player.clout.toLocaleString()} of 2,000. Strangers are starting to care.`} />
                <Goal emoji="🏡" title="Own a home" done={!!city.player.house_sku} line="No more rent. Your landlord will miss you. Financially." />
              </>
            )}
          </div>
        )}
      </div>
    </Sheet>
  );
}

function Goal({ emoji, title, line, done }: { emoji: string; title: string; line: string; done: boolean }) {
  return (
    <div className="select-card multi" aria-pressed={done}>
      <span className="select-emoji" aria-hidden="true">{emoji}</span>
      <span className="title" style={{ display: "block" }}>{title}</span>
      <span className="subtext" style={{ display: "block" }}>{line}</span>
      {done && <span className="select-check" aria-hidden="true">✓</span>}
    </div>
  );
}

/** Events (C26): the first-task party until it's done, then club events with real-minute countdowns. */
export function EventsSheet({
  open, onClose, partyDone, onOpenParty, city, busy, onAttend,
}: {
  open: boolean; onClose: () => void; partyDone: boolean; onOpenParty: () => void;
  city: CityState | null; busy: string | null; onAttend: (eventId: string) => void;
}) {
  const now = useGameNow(city?.clockOffsetSeconds ?? 0, 5000);
  const minutes = cityMinutes(now, GAME_CONFIG.cityClock);
  return (
    <Sheet open={open} onClose={onClose} label="Events">
      <div className="stack-16">
        <h2 className="display-lg" style={{ margin: 0, paddingRight: 44 }}>Events</h2>
        {!partyDone && (
          <button className="party-card" style={{ textAlign: "left", width: "100%" }} onClick={onOpenParty}>
            <span className="tag tag-event">🍸 Club event · Happening now</span>
            <span className="title" style={{ display: "block", marginTop: 8 }}>You&apos;ve been invited to a party</span>
            <span className="subtext" style={{ display: "block" }}>Velvet Static, Long Island City</span>
          </button>
        )}
        {city ? (
          CLUB_EVENTS.map((ev) => {
            const isOpen = eventOpen(ev, minutes);
            const av = eventAvailability(ev, isOpen, city);
            const went = city.attendedToday.includes(ev.id);
            return (
              <div key={ev.id} className="item-card">
                <span className="tag tag-event">🍸 Club event{isOpen ? " · Happening now" : ""}</span>
                <span className="title" style={{ display: "block" }}>{ev.name}</span>
                <span className="subtext">{ev.blurb}</span>
                <span className="meta">{placeById(ev.placeId)?.name} · {ev.startHour > 12 ? ev.startHour - 12 : ev.startHour} {ev.startHour >= 12 ? "PM" : "AM"} city time, {ev.hours} h</span>
                <EffectChips energy={CITY_ECONOMY.energy.eventCost} clout={ev.clout} mood={ev.mood} confidence={ev.confidence} />
                {went ? (
                  <span className="owned-chip">You went. Back tomorrow.</span>
                ) : (
                  <>
                    {!isOpen && <span className="meta">Doors open in {realMinutesUntilOpen(ev, minutes, GAME_CONFIG.cityClock.realHoursPerCityDay)} min</span>}
                    {isOpen && !av.ok && <span className="meta reason">{av.reason}</span>}
                    <button className="btn btn-green btn-sm" disabled={!av.ok || busy !== null} onClick={() => onAttend(ev.id)}>
                      {busy === `event:${ev.id}` ? "…" : formatCash(ev.entry)}
                    </button>
                  </>
                )}
              </div>
            );
          })
        ) : (
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

interface LedgerRow { id: number; currency: "cash" | "clout"; amount: number; kind: string; created_at: string }

const LABELS: Record<string, string> = {
  birth_lottery: "🎲 Birth lottery",
  rent: "🏠 First month's rent",
  party_entry: "🍸 Party entry",
  party_reward: "🍾 Party: you were seen",
  visit: "🍸 Night out",
  eat: "🍽️ Meal",
  shift: "💼 Shift pay",
  gig: "💼 Gig payout",
  event_entry: "🎟️ Club event",
  daily_task: "✅ Daily task",
  daily_bonus: "🏆 All five tasks",
  purchase: "🛍️ Shop",
  car_rental: "🚗 Car rental",
  sale: "🏷️ Sold an item",
  bill_rent: "🏠 Rent",
  bill_phone: "📱 Phone bill",
  bill_car_rental: "🚗 Car rental",
  bill_car_insurance: "🛡️ Car insurance",
};

/** Cash history from the ledger (used by the Bank sheet and the Phone's Bank app). */
export function LedgerList({ refreshKey }: { refreshKey: unknown }) {
  const [rows, setRows] = useState<LedgerRow[] | null>(null);
  useEffect(() => {
    const supabase = getBrowserSupabase();
    if (!supabase) return setRows([]);
    supabase
      .from("ledger")
      .select("id, currency, amount, kind, created_at")
      .eq("currency", "cash")
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => setRows((data as LedgerRow[]) ?? []));
  }, [refreshKey]);
  return (
    <div>
      {rows === null && <p className="meta">Loading…</p>}
      {rows?.length === 0 && <p className="meta">No transactions to show here.</p>}
      {rows?.map((r) => (
        <div key={r.id} className="ledger-row">
          <span>
            <span className="title" style={{ display: "block", fontSize: 15 }}>{LABELS[r.kind] ?? r.kind}</span>
            <span className="meta">{new Date(r.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
          </span>
          <span className={`body-strong ${r.amount > 0 ? "money-pos" : "money-neg"}`}>
            {r.amount > 0 ? "+" : "−"}{formatCash(Math.abs(r.amount))}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Bank balance → transaction history. */
export function BankSheet({ open, onClose, bank }: { open: boolean; onClose: () => void; bank: number }) {
  return (
    <Sheet open={open} onClose={onClose} label="Bank">
      <div className="stack-16">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline", paddingRight: 44 }}>
          <h2 className="display-lg" style={{ margin: 0 }}>Bank</h2>
          <span className="body-strong">{formatCash(bank)}</span>
        </div>
        <p className="subtext" style={{ margin: 0 }}>Virtual cash only. It can never be bought with real money.</p>
        {open && <LedgerList refreshKey={bank} />}
      </div>
    </Sheet>
  );
}
