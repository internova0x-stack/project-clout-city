"use client";

import { useEffect, useRef, useState } from "react";
import { CITY_ECONOMY, CLUB_EVENTS, HOME_LOCATIONS, PLACES, boroughOf, eventOpen, formatCountdown, isHub, isStation, realMsUntilOpen, visitClout, type Place } from "@/lib/city";
import { cityMinutes } from "@/lib/cityClock";
import { actionAvailability, barDrinkAvailability, boostUsed, eventAvailability, groceryAvailability, hasBar, isSupermarket, taskRewardLine, taskTitle, tasksAt, type CityState, type DailyTask } from "@/lib/cityState";
import { GAME_CONFIG } from "@/lib/config";
import { actionSeconds, OTHER_SECONDS } from "@/lib/actionTime";
import { formatCash } from "@/lib/economy";
import { distanceMiles, type LatLng } from "@/lib/map/geo";
import { Glyph, glyphFor, tileBackground } from "../AppGlyph";
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, ChevronUpIcon } from "../icons";
import { Sheet } from "../Sheet";
import { EffectChips, SheetTitle, useGameNow } from "./Common";
import { PlaceArt } from "./PlaceArt";
import { callName, type Regular } from "@/lib/cast";
import type { HuntResult } from "@/lib/hunts";
import { placeStory, type StoryFeed } from "@/lib/storyFeed";
import { ReasonBanner } from "../story/StoryBits";
import { ExclusiveEventCard, PostcardOffer, type MoneyHandlers } from "./Money";
import { DateStatusRow } from "../dating/Dating";
import { clubLines } from "./Clubs";
import { RankChip } from "../game/Ranks";
import { rankFor } from "@/lib/ranks";
import { hereCountLine, hereLine, type HerePerson, type PlaceCounts } from "@/lib/meet";
import { getStyle, type StyleId } from "@/lib/styles";
import { canDateAt, type DateNight } from "@/lib/dating";
import { crewActivities, type CrewOuting } from "@/lib/crew";
import { CrewProgress } from "../crew/Crew";
import { liveParty, type StoreProduct } from "@/lib/store";
import { TOGETHER, canDoTogether, type TogetherPlan } from "@/lib/together";
import { handle } from "@/lib/validation";
import { BOROUGHS, type BoroughId } from "@/lib/map/boroughs";
import { GATE_RULE, gateProgress, gateRule, type BoroughGate } from "@/lib/boroughGates";
import { SHOP_CATEGORIES, type ShopCategory } from "@/lib/city";
import { LOTTO_GAMES, isLottoPlace, topPrize } from "@/lib/lotto";

const CATEGORY_LABEL: Record<Place["category"], string> = {
  food: "Food", nightlife: "Nightlife", parks: "Park", places: "Places", home: "Home", monument: "Monument", shopping: "Shopping", campus: "University",
};

export interface PlaceHandlers {
  busy: string | null;
  onAction: (placeId: string, actionId: string) => void;
  onAttendEvent: (eventId: string) => void;
  onOpenGigs: () => void;
  /** v0.8 a drink at the bar (clubs and the lounge, migration 0026). */
  onBarDrink?: (placeId: string) => void;
  /** v0.10 neighborhood gossip (migration 0035): Listen in here, and pieces a regular tells. */
  gossip?: {
    listen: (placeId: string) => void;
    /** Ask the regular: a piece of gossip they tell, or null for their usual line. */
    hear: (placeId: string) => Promise<{ text: string; note: string; next?: string | null; nextPlace?: string | null } | null>;
    /** Owner, Oct 14: the "Next lead" line opens that place on the map. */
    openPlace?: (placeId: string) => void;
  };
  /** Meeting players (migration 0047): how many players are at a place now, and the first few. */
  here?: (placeId: string) => PlaceCounts[string] | undefined;
  /** v0.10 Lucky Star Lotto's counter (migration 0032). */
  onOpenLotto?: (placeId: string) => void;
  /**
   * v0.14 On Air: the stations' own buttons. "shoutout" and "billboard" open the Radio and Clout TV
   * apps' forms (there, on arrival); "watch" opens the Big Screen's photo (from anywhere).
   */
  onStation?: (what: "shoutout" | "billboard" | "watch") => void;
  /** v0.8 grocery bundles at supermarkets (migration 0027). */
  onBuyGroceries?: (placeId: string, bundleId: string) => void;
  /** The story world (v0.4): closures, prices, story events and tasks. */
  story?: StoryFeed | null;
  onAttendStoryEvent?: (eventId: string) => void;
  /** An overheard line for this place (NPC chatter). */
  chatter?: (place: Place) => { who: string; line: string } | null;
  /** v0.6: the regular who's always here, and what they say on tap number n (lib/cast.ts). */
  regular?: (place: Place, n: number) => { regular: Regular; line: string } | null;
  /** v0.5 real-money products shown on cards: postcards at monuments, exclusive events at their venue. */
  money?: { products: StoreProduct[]; nowMs: number; h: MoneyHandlers };
  /** Shopping places open the Shop on their category. */
  onOpenShop?: (category: ShopCategory) => void;
  /** v0.5 date nights (C41): "Make it a date" on dining places and club events, and tonight's status. */
  dating?: {
    me: string;
    dates: DateNight[];
    bonus: { mood: number; clout: number };
    onMakeDate: (spot: { kind: "place" | "event"; target: string; price: number }) => void;
  };
  /** Crew outings: "Bring the crew" on any place with a crew activity, and tonight's progress. */
  crew?: { outings: CrewOuting[]; onBring: (place: Place) => void };
  /** v0.13 together bonuses (migration 0050): 👯 next to studying and nights out, and today's plans. */
  together?: { plans: TogetherPlan[]; onTogether: (placeId: string, actionId: string) => void; onAnswer?: (id: number, yes: boolean) => void; busy?: string | null };
  /** v0.6 treasure hunts (joined, unfinished): talking to a regular may be the next clue or question. */
  hunt?: { talk: (placeId: string) => Promise<HuntResult>; answer: (choice: number) => Promise<HuntResult> };
  /** v0.8 travel (#4): where the player is; away from a place its actions are a preview with "Go there". */
  travel?: { isHere: (placeId: string) => boolean; onGoThere: (place: Place) => void; from: { at: LatLng; name: string } };
}

/** One row per action, then any club events held here (C37, C26). */
export function ActionList({ place, state, handlers, compact = false, preview }: {
  place: Place; state: CityState; handlers: PlaceHandlers; compact?: boolean;
  /** #7 (owner, Oct 14): on the place card, rows only show what things cost; everything happens inside. A tap goes in. */
  preview?: { onTap?: () => void };
}) {
  // Every second: closed doors count down live to opening (owner, Oct 15).
  const now = useGameNow(state.clockOffsetSeconds, 1000);
  const minutes = cityMinutes(now, GAME_CONFIG.cityClock);
  const events = CLUB_EVENTS.filter((e) => e.placeId === place.id);
  const { mood, confidence } = state.player;
  const world = placeStory(handlers.story ?? null, place);
  const storyTasks = (handlers.story?.tasks ?? []).filter((t) => t.do.place === place.id && !t.done);
  // v0.8: no spending before arriving. Away from the place, every row is a preview.
  const away = !!handlers.travel && !handlers.travel.isHere(place.id);
  const pill = (text: string) => (
    <button className="btn btn-secondary btn-sm preview-pill" disabled={!preview?.onTap} onClick={preview?.onTap} aria-label={`${text}. ${preview?.onTap ? "Go inside to do it" : "Go there to do it"}`}>{text}</button>
  );
  return (
    <div className="stack-8">
      {place.actions.filter((a) => !a.storyUnlock || world.unlocked.includes(a.id)).map((a) => {
        const base = actionAvailability(place.id, { ...a, price: Math.round((a.price ?? 0) * (world.price?.appliesTo === "visit_price" ? world.price.multiplier : 1)) }, state);
        // Story closures win; restrictions allow only listed actions (World State stacking rules).
        const av = world.closed ? { ok: false as const, reason: world.closed.reason }
          : world.restricted && !world.restricted.allow.includes(a.id) ? { ok: false as const, reason: world.restricted.reason }
          : base;
        const paid = Math.round((a.price ?? 0) * (world.price?.appliesTo === "visit_price" ? world.price.multiplier : 1));
        const task = storyTasks.find((t) => t.do.action === a.id);
        const usedToday = (state.visitsToday[place.id] ?? 0) > 0;
        // Clout always comes from the base price, never a story-raised one.
        const clout = a.clout ?? ((a.kind === "visit" || a.kind === "eat") && !usedToday ? visitClout(a.price ?? 0, mood, confidence) : null);
        const key = `${place.id}:${a.id}`;
        const spends = (a.price ?? 0) > 0;
        const daily = tasksAt(state, place.id).find((t) => t.action_id === a.id);
        return (
          <div key={a.id} className="action-row">
            <div style={{ minWidth: 0, flex: 1 }}>
              <span className="title" style={{ display: "block" }}>{a.label}</span>
              {daily && <TaskTick t={daily} />}
              {!compact && <span className="subtext" style={{ display: "block" }}>{a.blurb}</span>}
              {a.kind === "gigs" ? (
                <span className="meta">Today&apos;s offers, in your Phone</span>
              ) : (
                <EffectChips price={paid || undefined} pay={a.pay} energy={a.energy} clout={clout} mood={boostUsed(place.id, a.id, state) ? 0 : a.mood} confidence={boostUsed(place.id, a.id, state) ? 0 : a.confidence} seconds={actionSeconds(a)} />
              )}
              {paid !== (a.price ?? 0) && <span className="meta">Usually {formatCash(a.price ?? 0)} · {world.price?.reason}</span>}
              {(() => {
                const tp = handlers.together?.plans.find((x) => x.place === place.id && x.action === a.id);
                // An invite to you: answer it here (owner, Oct 15: the invited player had no way to say yes).
                if (tp && !tp.mine && tp.status === "pending") return (
                  <span className="together-ask">
                    <span className="meta" style={{ color: "var(--neon-text)" }}>👯 {handle(tp.withName)} wants to do this with you · {TOGETHER.multiplier}×</span>
                    {handlers.together?.onAnswer && (
                      <span className="row" style={{ gap: 6 }}>
                        <button className="chip together-yes" disabled={!!handlers.together.busy} onClick={() => handlers.together!.onAnswer!(tp.id, true)}>Yes, let&apos;s go</button>
                        <button className="chip" disabled={!!handlers.together.busy} onClick={() => handlers.together!.onAnswer!(tp.id, false)}>Not now</button>
                      </span>
                    )}
                  </span>
                );
                if (tp) return <span className="meta" style={{ color: "var(--neon-text)", display: "block" }}>👯 With {handle(tp.withName)} · {tp.status === "pending" ? "waiting for their yes" : `${TOGETHER.multiplier}× when you both do it`}</span>;
                return handlers.together && !preview && canDoTogether(place, a.id)
                  ? <button className="linkish together-link" onClick={() => handlers.together!.onTogether(place.id, a.id)}>👯 Do it together · {TOGETHER.multiplier}×</button>
                  : null;
              })()}
              {task && <span className="meta" style={{ color: "var(--neon-text)", display: "block" }}>📰 Story task: {task.label} · +{task.clout} 🔥</span>}
              {!av.ok && <span className="meta reason">{av.reason}</span>}
              {av.ok && av.note && <span className="meta">{av.note}</span>}
            </div>
            {preview ? pill(a.kind === "gigs" ? "Gigs" : spends ? formatCash(paid) : a.pay ? `+${formatCash(a.pay)}` : "Free") : away && a.kind !== "gigs" ? (
              <span className="lock-chip">On arrival</span>
            ) : (
              <button
                className={"btn btn-taxi btn-sm"}
                disabled={!av.ok || handlers.busy !== null}
                onClick={() => (a.kind === "gigs" ? handlers.onOpenGigs() : handlers.onAction(place.id, a.id))}
              >
                {handlers.busy === key ? "…" : a.kind === "gigs" ? "Open" : spends ? formatCash(paid) : a.kind === "shift" ? "Work" : "Go"}
              </button>
            )}
          </div>
        );
      })}
      {handlers.gossip && !world.closed && (
        <div className="action-row">
          <div style={{ minWidth: 0, flex: 1 }}>
            <span className="title" style={{ display: "block" }}>👂 Listen in</span>
            {tasksAt(state, place.id).filter((t) => t.action_id === "gossip-overheard").map((t) => <TaskTick key={t.id} t={t} />)}
            {!compact && <span className="subtext" style={{ display: "block" }}>Eavesdropping is free. Getting caught is not.</span>}
            <span className="fx-row"><span className="fx fx-pay">Free</span><span className="fx">🍵 Gossip for the Tea app</span></span>
          </div>
          {preview ? pill("Free") : away ? <span className="lock-chip">On arrival</span> : (
            <button className="btn btn-green btn-sm" disabled={handlers.busy !== null} onClick={() => handlers.gossip!.listen(place.id)}>
              {handlers.busy === `listen:${place.id}` ? "…" : "Listen"}
            </button>
          )}
        </div>
      )}
      {handlers.onOpenLotto && state.lotto && isLottoPlace(place.tags) && !world.closed && (() => {
        const l = state.lotto;
        const free = l.freeToday - l.freeUsed;
        return (
          <div className="action-row">
            <div style={{ minWidth: 0, flex: 1 }}>
              <span className="title" style={{ display: "block" }}>🌟 Scratch cards</span>
              {!compact && <span className="subtext" style={{ display: "block" }}>Five games, {formatCash(LOTTO_GAMES[0].price)} to {formatCash(LOTTO_GAMES[LOTTO_GAMES.length - 1].price)}. Top prize {formatCash(topPrize(LOTTO_GAMES[LOTTO_GAMES.length - 1]))}.</span>}
              <span className="fx-row">
                {free > 0 && <span className="fx fx-pay">🎟️ {free} free today</span>}
                <span className="fx">{l.bought} of {CITY_ECONOMY.lotto.buyPerDay} bought</span>
                {l.unscratched.length > 0 && <span className="fx fx-clout">{l.unscratched.length} to scratch</span>}
              </span>
            </div>
            {preview ? pill(`From ${formatCash(LOTTO_GAMES[0].price)}`) : away ? <span className="lock-chip">On arrival</span> : (
              <button className="btn btn-taxi btn-sm" disabled={handlers.busy !== null} onClick={() => handlers.onOpenLotto!(place.id)}>Play</button>
            )}
          </div>
        );
      })()}
      {handlers.onStation && isStation(place) && !world.closed && STATION_ROWS.filter((r) => place.tags.includes(r.tag)).map((r) => (
        <div className="action-row" key={r.what}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <span className="title" style={{ display: "block" }}>{r.title}</span>
            {!compact && <span className="subtext" style={{ display: "block" }}>{r.blurb}</span>}
          </div>
          {preview && !r.anywhere ? pill(r.button) : away && !r.anywhere ? <span className="lock-chip">On arrival</span> : (
            <button className={`btn ${r.anywhere ? "btn-secondary" : "btn-taxi"} btn-sm`} onClick={() => handlers.onStation!(r.what)}>{r.button}</button>
          )}
        </div>
      ))}
      {handlers.onBuyGroceries && isSupermarket(place.tags) && !world.closed && CITY_ECONOMY.groceries.bundles.map((b) => {
        const av = groceryAvailability(b, state);
        const room = CITY_ECONOMY.groceries.fridgeMax - (state.player.fridge_meals ?? 0);
        return (
          <div key={b.id} className="action-row">
            <div style={{ minWidth: 0, flex: 1 }}>
              <span className="title" style={{ display: "block" }}>{b.emoji} {b.label}</span>
              {!compact && <span className="subtext" style={{ display: "block" }}>{b.blurb}</span>}
              <span className="fx-row">
                <span className="fx fx-cost">−{formatCash(b.price)}</span>
                <span className="fx">🧊 +{b.meals} meals</span>
              </span>
              <span className="meta" style={{ display: "block" }}>
                {formatCash(Math.round(b.price / b.meals))} a meal{av.ok ? ` · room for ${room} more in your fridge` : ""}
              </span>
              {!av.ok && <span className="meta reason" style={{ display: "block" }}>{av.reason}</span>}
            </div>
            {preview ? pill(formatCash(b.price)) : away ? <span className="lock-chip">On arrival</span> : (
              <button className="btn btn-taxi btn-sm" disabled={!av.ok || handlers.busy !== null} onClick={() => handlers.onBuyGroceries!(place.id, b.id)}>
                {handlers.busy === `groceries:${b.id}` ? "…" : formatCash(b.price)}
              </button>
            )}
          </div>
        );
      })}
      {handlers.onBarDrink && hasBar(place.tags) && !world.closed && (() => {
        const av = barDrinkAvailability(state);
        const { price, energy } = CITY_ECONOMY.barDrink;
        return (
          <div className="action-row">
            <div style={{ minWidth: 0, flex: 1 }}>
              <span className="title" style={{ display: "block" }}>🍸 A drink at the bar</span>
              {!compact && <span className="subtext" style={{ display: "block" }}>Overpriced, ice-heavy, and it works. Nobody posts a bar receipt.</span>}
              <EffectChips price={price} energy={-energy} seconds={OTHER_SECONDS.drink} />
              <span className="meta" style={{ display: "block" }}>No clout · as many as you can afford</span>
              {!av.ok && <span className="meta reason" style={{ display: "block" }}>{av.reason}</span>}
            </div>
            {preview ? pill(formatCash(price)) : away ? <span className="lock-chip">On arrival</span> : (
              <button className="btn btn-taxi btn-sm" disabled={!av.ok || handlers.busy !== null} onClick={() => handlers.onBarDrink!(place.id)}>
                {handlers.busy === `drink:${place.id}` ? "…" : formatCash(price)}
              </button>
            )}
          </div>
        );
      })()}
      {events.map((ev) => {
        const open = eventOpen(ev, minutes);
        const av = eventAvailability(ev, open, state);
        const wait = formatCountdown(realMsUntilOpen(ev, now, GAME_CONFIG.cityClock.realHoursPerCityDay));
        return (
          <div key={ev.id} className="action-row">
            <div style={{ minWidth: 0, flex: 1 }}>
              <span className="tag tag-event" style={{ marginBottom: 4 }}>{place.category === "campus" ? "🎓 Campus event" : "🍸 Club event"}{open ? " · Happening now" : ""}</span>
              <span className="title" style={{ display: "block" }}>{ev.name}</span>
              {tasksAt(state, place.id).filter((t) => t.kind === "event" && t.action_id === ev.id).map((t) => <TaskTick key={t.id} t={t} />)}
              {!compact && <span className="subtext" style={{ display: "block" }}>{ev.blurb}</span>}
              <EffectChips price={ev.entry} energy={20} clout={ev.clout} mood={ev.mood} confidence={ev.confidence} seconds={OTHER_SECONDS.event} />
              {!open && !state.attendedToday.includes(ev.id) && <span className="meta" style={{ display: "block" }}>Doors open in <b className="tabular">{wait}</b>. Come back then, or wait here.</span>}
              {open && !av.ok && <span className="meta reason">{av.reason}</span>}
              {!open && state.attendedToday.includes(ev.id) && <span className="meta">You went today. Back tomorrow.</span>}
              {handlers.dating && !compact && (
                <button className="btn btn-secondary btn-sm date-btn" onClick={() => handlers.dating!.onMakeDate({ kind: "event", target: ev.id, price: ev.entry })}>
                  🌙 Make it a date
                </button>
              )}
            </div>
            {/* Owner, Oct 14: say why an event can't be joined yet, rather than a faded price. */}
            {!open && !state.attendedToday.includes(ev.id) ? (
              <span className="lock-chip tabular" role="timer" aria-label={`Doors open in ${wait}`}>🕒 {wait}</span>
            ) : preview ? pill(formatCash(ev.entry)) : away ? <span className="lock-chip">On arrival</span> : (
              <button className="btn btn-taxi btn-sm" disabled={!av.ok || handlers.busy !== null} onClick={() => handlers.onAttendEvent(ev.id)}>
                {handlers.busy === `event:${ev.id}` ? "…" : formatCash(ev.entry)}
              </button>
            )}
          </div>
        );
      })}
      {world.events.map((ev) => {
        const went = state.attendedToday.includes(ev.id);
        const task = (handlers.story?.tasks ?? []).find((t) => t.do.event === ev.id && !t.done);
        return (
          <div key={ev.id} className="action-row">
            <div style={{ minWidth: 0, flex: 1 }}>
              <span className="tag tag-event" style={{ marginBottom: 4 }}>📰 Story event{ev.cancelled ? " · Cancelled" : ev.attendable ? " · Today" : " · Announced"}</span>
              <span className="title" style={{ display: "block", textDecoration: ev.cancelled ? "line-through" : undefined }}>{ev.name}</span>
              {!compact && <span className="subtext" style={{ display: "block" }}>{ev.cancelled ? "Cancelled: police activity." : ev.blurb}</span>}
              {ev.attendable && !ev.cancelled && <EffectChips energy={ev.energy} clout={ev.clout} mood={ev.mood} />}
              {task && <span className="meta" style={{ color: "var(--neon-text)", display: "block" }}>📰 Story task: {task.label} · +{task.clout} 🔥</span>}
            </div>
            {ev.attendable && !ev.cancelled && preview && pill("Free")}
            {ev.attendable && !ev.cancelled && !preview && (
              <button className="btn btn-taxi btn-sm" disabled={went || handlers.busy !== null || !handlers.onAttendStoryEvent} onClick={() => handlers.onAttendStoryEvent?.(ev.id)}>
                {handlers.busy === `story:${ev.id}` ? "…" : went ? "Went" : "Free"}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** v0.11 (spec section 11): a daily task done here, as a checkbox that ticks when it's done. */
function TaskTick({ t }: { t: DailyTask }) {
  return (
    <span className={`task-tick${t.done_at ? " done" : ""}`}>
      <span className="task-box" aria-hidden="true">{t.done_at ? "✓" : ""}</span>
      <span>{t.done_at ? "Daily task done" : `Daily task · ${taskRewardLine(t)}`}</span>
      <span className="sr-only">{t.done_at ? ", ticked" : ", not done yet"}</span>
    </span>
  );
}

/** Every daily task at this place, ticked when done: shown even while the actions are folded away. */
export function PlaceTasks({ place, state }: { place: Place; state: CityState }) {
  const tasks = tasksAt(state, place.id);
  if (!tasks.length) return null;
  return (
    <ul className="place-tasks" aria-label="Daily tasks here">
      {tasks.map((t) => (
        <li key={t.id} className={t.done_at ? "done" : ""}>
          <span className="task-box" aria-hidden="true">{t.done_at ? "✓" : ""}</span>
          <span className="place-task-title">{taskTitle(t)}</span>
          <span className="meta">{t.done_at ? "Done" : taskRewardLine(t)}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * v0.11 (spec section 11): a place's actions start folded away (the card stays short), with what's
 * here in one line and today's tasks ticked; one tap opens the full list.
 */
/** v0.14 On Air: what each station offers on its card (owner, Oct 16: "Send Radio Shoutout", "Get on Billboard"). */
const STATION_ROWS: { tag: "radio" | "tv"; what: "shoutout" | "billboard" | "watch"; name: string; title: string; blurb: string; button: string; anywhere?: boolean }[] = [
  { tag: "radio", what: "shoutout", name: "Send Radio Shoutout", title: "🎙️ Send Radio Shoutout", blurb: "One a day. DJ Sharm Almight reads one on The Wake-Up Call at 9 a.m.", button: "Send" },
  { tag: "tv", what: "billboard", name: "Get on Billboard", title: "📸 Get on Billboard", blurb: "Your photo, forty feet tall over Astoria for three hours. The owner picks.", button: "Upload" },
  { tag: "tv", what: "watch", name: "On the Big Screen", title: "📺 On the Big Screen now", blurb: "See who made it.", button: "Watch", anywhere: true },
];

function ActionsSection({ place, state, handlers, enterable, onGoInside }: { place: Place; state: CityState; handlers: PlaceHandlers; enterable: boolean; onGoInside?: () => void }) {
  const [open, setOpen] = useState(false);
  const world = placeStory(handlers.story ?? null, place);
  const names = [
    ...place.actions.filter((a) => !a.storyUnlock || world.unlocked.includes(a.id)).map((a) => a.label),
    ...(handlers.gossip && !world.closed ? ["Listen in"] : []),
    ...(handlers.onOpenLotto && state.lotto && isLottoPlace(place.tags) && !world.closed ? ["Scratch cards"] : []),
    ...(handlers.onStation && isStation(place) && !world.closed ? STATION_ROWS.filter((r) => place.tags.includes(r.tag) && !r.anywhere).map((r) => r.name) : []),
    ...(handlers.onBuyGroceries && isSupermarket(place.tags) && !world.closed ? ["Groceries"] : []),
    ...(handlers.onBarDrink && hasBar(place.tags) && !world.closed ? ["A drink"] : []),
    ...CLUB_EVENTS.filter((e) => e.placeId === place.id).map((e) => e.name),
    ...world.events.map((e) => e.name),
  ];
  return (
    <section className={`actions-fold${open ? " open" : ""}`} aria-label={`Things to do at ${place.name}`}>
      <button className="actions-fold-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span style={{ minWidth: 0, flex: 1, textAlign: "left" }}>
          <span className="title" style={{ display: "block" }}>Things to do here · {names.length}</span>
          {!open && <span className="meta actions-fold-sum">{names.join(" · ")}</span>}
        </span>
        <ChevronDownIcon size={20} className="actions-fold-chev" />
      </button>
      {!open && <PlaceTasks place={place} state={state} />}
      {open && <ActionList place={place} state={state} handlers={handlers} preview={enterable ? { onTap: onGoInside } : undefined} />}
    </section>
  );
}

/** v0.6: the regular stands on the illustration with a speech-bubble label; each tap says the
 * next line, in a bubble just below the picture so the place stays visible. For a player on a
 * treasure hunt, the first tap asks the regular about it: at the right place that's the clue,
 * and sometimes a question to answer right there in the bubble. */
type HuntLine = { say: string; question?: { q: string; choices: string[] }; note?: string; tone?: "hint" | "found" };

function PlaceArtWithRegular({ place, daytime, talk, hunt, gossip }: { place: Place; daytime: boolean; talk?: PlaceHandlers["regular"]; hunt?: PlaceHandlers["hunt"]; gossip?: PlaceHandlers["gossip"] }) {
  return (
    <RegularTalk place={place} talk={talk} hunt={hunt} gossip={gossip}
      frame={(tag) => (
        <div className="place-art-wrap">
          <PlaceArt place={place} daytime={daytime} />
          {tag}
        </div>
      )} />
  );
}

/**
 * The place's regular in conversation: the hunt first (clue or question), then a piece of gossip, then
 * their everyday lines. Shared by the place card's picture and the room (#20, owner Oct 14: tapping the
 * regular inside, e.g. Sal at the deli, says the same things). `nonce` changes start a new tap.
 */
export function RegularTalk({ place, talk, hunt, gossip, frame, nonce }: {
  place: Place; talk?: PlaceHandlers["regular"]; hunt?: PlaceHandlers["hunt"]; gossip?: PlaceHandlers["gossip"];
  /** Wraps the tappable name tag (the card puts it on the picture); omitted inside a room, where the avatar is tapped. */
  frame?: (tag: React.ReactNode) => React.ReactNode;
  nonce?: number;
}) {
  const [n, setN] = useState(-1);
  const [huntLine, setHuntLine] = useState<HuntLine | null>(null);
  const [tea, setTea] = useState<{ text: string; note: string; next?: string | null; nextPlace?: string | null } | null>(null);
  // v0.10: after the hunt (it comes first), the regular's first line may be a piece of gossip.
  const askGossip = async (): Promise<boolean> => {
    if (!gossip) return false;
    setAsking(true);
    const g = await gossip.hear(place.id);
    setAsking(false);
    if (g) { setTea(g); setN(-1); return true; }
    return false;
  };
  const [asking, setAsking] = useState(false);
  const first = talk?.(place, 0) ?? null;
  const said = first && n >= 0 ? talk!(place, n) : null;
  const firstName = first ? callName(first.regular.name) : "";
  const onTap = async () => {
    const fresh = n < 0 && !huntLine && !tea;
    // Ask about the hunt on the first tap, and again after a "stop in first" hint.
    if (!hunt || (n >= 0 && huntLine?.tone !== "hint") || (huntLine && huntLine.tone !== "hint")) {
      setHuntLine(null);
      if (fresh && (await askGossip())) return;
      setTea(null);
      setN((x) => x + 1);
      return;
    }
    setAsking(true);
    const r = await hunt.talk(place.id);
    setAsking(false);
    if (r.ok && r.line) { setN(-1); return setHuntLine(r.line); }
    if (!r.ok && r.code === "visit_first") {
      return setHuntLine({ say: `${firstName} has something for your hunt.`, note: "Do something here first, then ask again.", tone: "hint" });
    }
    if (fresh && (await askGossip())) return;
    setN(0);
  };
  const onAnswer = async (i: number) => {
    if (!hunt || !huntLine?.question) return;
    setAsking(true);
    const r = await hunt.answer(i);
    setAsking(false);
    if (!r.ok) return setHuntLine({ ...huntLine, note: r.error });
    if (!r.correct) return setHuntLine({ ...huntLine, note: "Not quite. They'll ask again in 10 minutes." });
    setHuntLine({ say: r.line?.say ?? "That's it.", tone: r.reward ? "found" : undefined, note: r.reward ? "🗺️ Treasure found! It's in your Collection." : undefined });
  };
  // Inside a room the regular's avatar is the button: each tap there bumps `nonce`.
  const tapRef = useRef(onTap);
  tapRef.current = onTap;
  useEffect(() => { if (nonce) void tapRef.current(); }, [nonce]);
  const tag = first ? (
    <button className="regular-tag" onClick={() => void onTap()} disabled={asking} aria-label={`Talk to ${first.regular.name}, ${first.regular.title}`}>
      <span className="regular-face" aria-hidden="true">{first.regular.emoji}</span>
      <span>{asking ? "…" : n < 0 && !huntLine && !tea ? `💬 ${firstName}` : "Tap for more"}</span>
    </button>
  ) : null;
  if (!frame && !huntLine && !tea && !(first && n >= 0)) return null;
  return (
    <div className="stack-8">
      {frame ? frame(tag) : null}
      {huntLine && (
        <div className={`regular-bubble hunt-bubble${huntLine.tone === "found" ? " found" : ""}`} role="status">
          <span className="meta" style={{ display: "block" }}>🗺️ {first!.regular.name} · {first!.regular.title}</span>
          {huntLine.tone === "hint" ? huntLine.say : <>&ldquo;{huntLine.say}&rdquo;</>}
          {huntLine.question && (
            <div className="stack-8" style={{ marginTop: 10 }}>
              <span className="title" style={{ display: "block" }}>{huntLine.question.q}</span>
              <div className="hunt-choices">
                {huntLine.question.choices.map((c, i) => (
                  <button key={c} className="btn btn-secondary btn-sm" disabled={asking} onClick={() => void onAnswer(i)}>{c}</button>
                ))}
              </div>
            </div>
          )}
          {huntLine.note && <span className="meta hunt-note" style={{ display: "block" }}>{huntLine.note}</span>}
        </div>
      )}
      {tea && !huntLine && (
        <div className="regular-bubble tea-bubble" role="status">
          <span className="meta" style={{ display: "block" }}>🍵 {first!.regular.name} · {first!.regular.title}</span>
          &ldquo;{tea.text}&rdquo;
          <span className="meta hunt-note" style={{ display: "block" }}>{tea.note}</span>
          {/* Owner, Oct 14: say what this is, and take the player there when tapped. */}
          {tea.next && (tea.nextPlace && gossip?.openPlace
            ? <button className="tea-next tea-lead" style={{ marginTop: 8 }} onClick={() => gossip.openPlace!(tea.nextPlace!)}>Next lead: {tea.next} · Show on map ›</button>
            : <span className="tea-next" style={{ marginTop: 8 }}>Next lead: {tea.next}</span>)}
        </div>
      )}
      {said && !huntLine && !tea && (
        <div className="regular-bubble" role="status">
          <span className="meta" style={{ display: "block" }}>{first!.regular.name} · {first!.regular.title}</span>
          &ldquo;{said.line}&rdquo;
        </div>
      )}
    </div>
  );
}

/** C37: the location card, opened from a pin or the Places list. */
export function LocationSheet({
  place, state, daytime, handlers, onClose, onGoInside, from,
}: {
  place: Place | null;
  state: CityState;
  daytime: boolean;
  handlers: PlaceHandlers;
  onClose: () => void;
  onGoInside: (p: Place) => void;
  from: LatLng;
}) {
  // v0.8: without travel (guest map, before migration 0025) every place counts as here.
  const here = !!place && (!handlers.travel || handlers.travel.isHere(place.id));
  return (
    <Sheet open={!!place} onClose={onClose} label={place?.name ?? "Place"}>
      {place && (
        <div className="stack-16">
          <PlaceArtWithRegular key={place.id} place={place} daytime={daytime} talk={handlers.regular} hunt={handlers.hunt} gossip={handlers.gossip} />
          <StoryBanners place={place} story={handlers.story ?? null} />
          <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
            <span className={`tag tag-neutral`}>{place.emoji} {CATEGORY_LABEL[place.category]}</span>
            {place.tier && <span className="tag tag-neutral">{place.tier} dining</span>}
            {place.tags.some((t) => t.startsWith("job_")) && <span className="tag tag-positive">Hiring</span>}
          </div>
          <div>
            {here && <span className="here-chip" style={{ marginBottom: 6 }}>📍 You&apos;re here</span>}
            <h2 className="display-lg" style={{ margin: 0, paddingRight: 44 }}>{place.name}</h2>
            <p className="meta" style={{ margin: "4px 0 0" }}>
              {place.neighborhood}{here ? "" : ` · ${distanceMiles(handlers.travel?.from.at ?? from, place.at).toFixed(1)} mi from ${handlers.travel ? "you" : "home"}`}
            </p>
          </div>
          <div className="lola">
            <span className="lola-avatar" aria-hidden="true">💋</span>
            <p className="body" style={{ margin: 0 }}>{place.lore}<span className="meta" style={{ display: "block", marginTop: 4 }}>Lola Lowdown</span></p>
          </div>
          {/* Meeting players: who's inside right now (0064: you count too once you're in; the names are others). */}
          {(() => {
            const h = handlers.here?.(place.id);
            return h && h.count > 0 ? (
              <p className="here-line" style={{ margin: 0 }}><span className="dot-green" aria-hidden="true" /> <b>{h.count} here now</b> · {hereLine([...(here && h.names.length === h.count - 1 ? ["You"] : []), ...h.names.map((n) => n.name)], h.count)}</p>
            ) : null;
          })()}
          {/* #19 clubs: what's downstairs and upstairs, and the door rule. */}
          {place.club && (
            <ul className="club-lines">
              {clubLines(place, state.player.clout).map((l) => <li key={l}>{l}</li>)}
            </ul>
          )}
          {handlers.dating?.dates.filter((d) => d.placeId === place.id).map((d) => (
            <DateStatusRow key={d.id} me={handlers.dating!.me} date={d} bonus={handlers.dating!.bonus} />
          ))}
          <ActionsSection place={place} state={state} handlers={handlers} enterable={!!place.template && place.template !== "apartment"} onGoInside={here ? () => onGoInside(place) : undefined} />
          {!here && (
            <div className="stack-4">
              {/* #19 the exclusive club's door rule: the server refuses the trip too (migration 0046). */}
              {(place.club?.doorClout ?? 0) > state.player.clout ? (
                <>
                  <button className="btn btn-taxi" disabled>🔒 {(place.club!.doorClout!).toLocaleString("en-US")} clout to get in</button>
                  <p className="meta" style={{ margin: 0, textAlign: "center" }}>The bouncer checks clout like it&apos;s a passport. Come back with more.</p>
                </>
              ) : (
                <>
                  <button className="btn btn-taxi" onClick={() => handlers.travel!.onGoThere(place)}>Go there ›</button>
                  <p className="meta" style={{ margin: 0, textAlign: "center" }}>{place.template && place.template !== "apartment" ? "Everything here happens inside. Go there, then step in." : "Actions unlock when you arrive."}</p>
                </>
              )}
            </div>
          )}
          {here && !!place.template && place.template !== "apartment" && (
            <button className="btn btn-taxi" onClick={() => onGoInside(place)}>Go inside</button>
          )}
          {handlers.crew?.outings.filter((o) => o.placeId === place.id).map((o) => <CrewProgress key={o.id} outing={o} />)}
          {((handlers.dating && canDateAt(place)) || (handlers.crew && crewActivities(place).length > 0)) && (
            <div className="row" style={{ gap: 8 }}>
              {handlers.dating && canDateAt(place) && (
                <button
                  className="btn btn-secondary social-btn"
                  onClick={() => handlers.dating!.onMakeDate({ kind: "place", target: place.id, price: place.actions.find((a) => a.kind === "eat")?.price ?? 0 })}
                >
                  🌙 Make it a date
                </button>
              )}
              {/* #19: no crew outing where the bouncer would turn you away. */}
              {handlers.crew && crewActivities(place).length > 0 && (place.club?.doorClout ?? 0) <= state.player.clout && (
                <button className="btn btn-secondary social-btn crew-btn" onClick={() => handlers.crew!.onBring(place)}>
                  👯 Bring the crew
                </button>
              )}
            </div>
          )}
          {place.opensShop && handlers.onOpenShop && (
            <button className="btn btn-secondary" onClick={() => handlers.onOpenShop!(place.opensShop!)}>
              🛍️ Open the Shop · {SHOP_CATEGORIES.find((c) => c.id === place.opensShop)?.label}
            </button>
          )}
          {(() => {
            // C39: the postcard is offered right after a visit (any visit today); the Collection keeps it after that.
            const pc = place.postcard ? handlers.money?.products.find((p) => p.sku === place.postcard) : undefined;
            return pc && (state.visitsToday[place.id] ?? 0) > 0 ? <PostcardOffer p={pc} h={handlers.money!.h} /> : null;
          })()}
          {handlers.money?.products.filter((p) => p.event?.placeId === place.id && liveParty(p, handlers.money!.nowMs)).map((p) => (
            <ExclusiveEventCard key={p.sku} p={p} nowMs={handlers.money!.nowMs} h={handlers.money!.h} compact />
          ))}
          {(() => {
            const c = handlers.regular?.(place, 0) ? null : handlers.chatter?.(place);
            return c ? (
              <div className="chatter-row">
                <span aria-hidden="true">💬</span>
                <span className="body" style={{ margin: 0 }}><span className="meta" style={{ display: "block" }}>Overheard · {c.who}</span>&ldquo;{c.line}&rdquo;</span>
              </div>
            ) : null;
          })()}
        </div>
      )}
    </Sheet>
  );
}

function StoryBanners({ place, story }: { place: Place; story: StoryFeed | null }) {
  const w = placeStory(story, place);
  if (!w.closed && !w.restricted && !w.price && !w.notes.length) return null;
  return (
    <div className="stack-4">
      {w.closed && <ReasonBanner kind="closed" text={w.closed.reason} />}
      {w.restricted && <ReasonBanner kind="closed" text={w.restricted.reason} />}
      {w.price && <ReasonBanner kind="price" text={`${w.price.appliesTo === "visit_price" ? "Visits" : "Prices"} +${Math.round((w.price.multiplier - 1) * 100)}%: ${w.price.reason.charAt(0).toLowerCase()}${w.price.reason.slice(1)}`} />}
      {w.notes.map((n) => <ReasonBanner key={n} kind="info" text={n} />)}
    </div>
  );
}

/** C38 (3D): the walkable interior. Tap things in the room, or open the actions list. */
export function InteriorScene({
  place, state, handlers, onBack, room, talkNonce = 0, here,
}: {
  place: Place;
  state: CityState;
  handlers: PlaceHandlers;
  onBack: () => void;
  room: React.ReactNode;
  /** #20: bumped each time the player taps the place's regular in the room. */
  talkNonce?: number;
  /**
   * Meeting players (owner, Oct 15): the real players here now (crew first), how many in all, who stands
   * in the room (crowded places: the rest are in the list) and the floor you're on.
   */
  here?: { people: HerePerson[]; count: number; inView: string[]; floor: number; onOpen: (id: string) => void };
}) {
  const [open, setOpen] = useState(false);
  const [allHere, setAllHere] = useState(false);
  const [mini, setMini] = useState(false);
  // Someone talks (a regular's line, a hunt clue): bring the panel back so it's read.
  useEffect(() => { if (talkNonce) setMini(false); }, [talkNonce]);
  return (
    <div className="layer interior">
      {room}
      <button className="pill-glass glass-hud interior-back" onClick={onBack}>
        <ChevronLeftIcon size={18} /> Map
      </button>
      {/* Owner, Oct 15: who's here sits under the top HUD, right-aligned, not on the activity card. */}
      {here && here.count > 0 && (
        <div className="pill-glass glass-hud here-hud">
          <span className="here-stack" aria-hidden="true">
            {here.people.slice(0, 3).map((p) => <span key={p.id} className="here-face">{getStyle(p.style as StyleId).emoji}</span>)}
          </span>
          <span className="here-hud-count"><b>{here.count.toLocaleString("en-US")}</b> here</span>
          <button className="here-hud-btn" onClick={() => setAllHere(true)}>View People</button>
        </div>
      )}
      {/* Outside the panel: a sheet inside it sat under the nav bar (owner, Oct 15). */}
      {here && <HereList open={allHere} here={here} placeName={place.name} onClose={() => setAllHere(false)} />}
      {mini ? (
        // Owner, Oct 15: the panel needs a way out of the way. Minimized, it's one small pill.
        <button className="interior-mini pill-glass glass-hud" onClick={() => setMini(false)} aria-label={`Show ${place.name} actions`}>
          <span className="one-line">{place.emoji} {place.name}</span>
          <ChevronUpIcon size={16} />
        </button>
      ) : (
      <section className={`interior-panel${open ? " open" : ""}`} aria-label={`${place.name} actions`}>
        <div className="interior-head-row">
          <button className="interior-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
            <span className="display-sm">{place.emoji} {place.name}</span>
            <span className={`panel-toggle${open ? " hide" : ""}`}>{open ? "Hide" : "All actions"}</span>
          </button>
          <button className="icon-round interior-min" onClick={() => { setOpen(false); setMini(true); }} aria-label="Minimize">
            <ChevronDownIcon size={18} />
          </button>
        </div>
        <RegularTalk place={place} talk={handlers.regular} hunt={handlers.hunt} gossip={handlers.gossip} nonce={talkNonce} />
        {open ? (
          <ActionList place={place} state={state} handlers={handlers} compact />
        ) : (
          <>
            <p className="meta" style={{ margin: "4px 0 0" }}>Tap the floor to walk, tap things to use them, or 💬 to talk.</p>
            <PlaceTasks place={place} state={state} />
          </>
        )}
      </section>
      )}
    </div>
  );
}

/** Every open place, nearest first, with what it costs or pays. */
/** Where the stations sit in the Places list (0-based): 4th and 5th. */
const STATIONS_AT = 3;

export function PlacesSheet({
  open, onClose, from, onPick, state, story = null, here, openBoroughs: openSet, gates = null,
}: {
  open: boolean; onClose: () => void; from: LatLng; onPick: (p: Place) => void; state: CityState | null; story?: StoryFeed | null;
  here?: (placeId: string) => PlaceCounts[string] | undefined;
  /** Owner, Oct 17: one tab per borough; a borough that hasn't opened shows its places locked, with what it takes. */
  openBoroughs?: Set<BoroughId>; gates?: BoroughGate[] | null;
}) {
  const all = visiblePlaces(story).map((p) => ({ p, d: distanceMiles(from, p.at) })).sort((a, b) => a.d - b.d);
  // Owner, Oct 17: every borough is a tab; all but Queens stay locked until they open.
  const tabs = BOROUGHS;
  const [tab, setTab] = useState<BoroughId>("queens");
  const isOpen = (id: BoroughId) => !openSet || openSet.has(id);
  const inTab = all.filter((r) => boroughOf(r.p) === tab);
  // The Hub first, the two stations 4th and 5th, everything else nearest first (owner, Oct 16).
  const rows = [...inTab.filter((r) => isHub(r.p)), ...inTab.filter((r) => !isStation(r.p) && !isHub(r.p))];
  rows.splice(Math.min(STATIONS_AT, rows.length), 0, ...inTab.filter((r) => isStation(r.p)));
  const locked = !isOpen(tab);
  const gate = gates?.find((g) => g.id === tab) ?? null;
  const borough = BOROUGHS.find((b) => b.id === tab)!;
  return (
    <Sheet open={open} onClose={onClose} label="Places">
      <div className="stack-16">
        <h2 className="display-lg" style={{ margin: 0, paddingRight: 44 }}>Places</h2>
        {tabs.length > 1 && (
          <div className="segmented borough-tabs" role="group" aria-label="Boroughs">
            {tabs.map((b) => (
              <button key={b.id} aria-pressed={tab === b.id} onClick={(e) => { setTab(b.id); e.currentTarget.scrollIntoView({ behavior: "smooth", inline: "nearest", block: "nearest" }); }} aria-label={isOpen(b.id) ? b.name : `${b.name}, locked`}>
                {!isOpen(b.id) && <span className="borough-tab-lock" aria-hidden="true">🔒</span>}{b.name}
              </button>
            ))}
          </div>
        )}
        {rows.length === 0 ? (
          <div className="places-empty">
            <span className="places-empty-emoji" aria-hidden="true">🚧</span>
            <p className="title" style={{ margin: 0 }}>{borough.name} is still getting dressed</p>
            <p className="body" style={{ margin: 0, color: "var(--text-2)" }}>{borough.empty ?? "No places here yet. Come back when you're famous."}</p>
            <p className="meta" style={{ margin: 0 }}>Opens after Brooklyn.</p>
          </div>
        ) : locked ? (
          <div className="places-locked-head">
            <p className="overline" style={{ margin: 0 }}>🔒 {rows.length} places waiting</p>
            <p className="meta" style={{ margin: 0 }}>{gateRule(gate ?? { target: GATE_RULE.target, daysNeeded: GATE_RULE.days })}</p>
            {gate && <p className="places-locked-progress">{gateProgress(gate)}</p>}
          </div>
        ) : (
          <p className="subtext" style={{ margin: 0 }}>{tab === "queens" ? "Queens and Long Island City, nearest first." : "Nearest first."}</p>
        )}
        <div>
          {rows.map(({ p, d }) => {
            const price = Math.min(...p.actions.map((a) => a.price ?? Infinity));
            const pay = Math.max(0, ...p.actions.map((a) => a.pay ?? 0));
            const cost = pay ? `Pays ${formatCash(pay)}` : Number.isFinite(price) ? `From ${formatCash(price)}` : p.actions.some((a) => a.kind === "gigs") ? "Gigs board" : "Free";
            const visited = (state?.visitsToday[p.id] ?? 0) > 0;
            const count = here?.(p.id)?.count ?? 0;
            return (
              <button key={p.id} className={`list-row${locked ? " places-locked-row" : ""}`} onClick={() => onPick(p)}>
                <span className="map-pin-tile" aria-hidden="true" style={{ width: 40, height: 40, borderRadius: 12, background: tileBackground(glyphFor(p)) }}><Glyph name={glyphFor(p)} size={24} /></span>
                <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                  <span className="places-name">
                    <span className="title">{p.name}</span>
                    {/* Where the people are (owner, Oct 16): real players there right now, next to the name (place_counts, never NPCs). */}
                    {!locked && count > 0 && (
                      <span className="places-here" aria-label={`${count} ${count === 1 ? "player" : "players"} here`}>
                        <span className="places-here-dot" aria-hidden="true" />{count}
                      </span>
                    )}
                  </span>
                  <span className="meta">{p.neighborhood}{locked ? "" : ` · ${d.toFixed(1)} mi${visited ? " · Visited today" : ""}`}</span>
                </span>
                {locked ? <span aria-hidden="true">🔒</span> : <span className="body-strong" style={{ whiteSpace: "nowrap", fontSize: 14 }}>{cost}</span>}
                {!locked && <ChevronRightIcon size={18} />}
              </button>
            );
          })}
        </div>
      </div>
    </Sheet>
  );
}

export function homeLocation(homeId: string | null): LatLng {
  return (homeId && HOME_LOCATIONS[homeId]) || HOME_LOCATIONS.astoria_studio;
}

/** Story places (location wave 2) appear once their arc has started. */
export function visiblePlaces(story: StoryFeed | null): Place[] {
  return PLACES.filter((p) => !p.story || (story?.startedArcs ?? []).includes(p.story));
}

/**
 * Crowded places (owner, Oct 15): everyone here, by where they are. Tapping someone opens their card,
 * and someone on this floor walks into the room.
 */
function HereList({ open, here, placeName, onClose }: {
  open: boolean;
  here: { people: HerePerson[]; count: number; inView: string[]; floor: number; onOpen: (id: string) => void };
  placeName: string;
  onClose: () => void;
}) {
  const groups = [
    { title: "In the room", people: here.people.filter((p) => here.inView.includes(p.id)) },
    { title: "Around this floor", people: here.people.filter((p) => p.floor === here.floor && !here.inView.includes(p.id)) },
    { title: "Downstairs", people: here.people.filter((p) => p.floor < here.floor) },
    { title: "Upstairs", people: here.people.filter((p) => p.floor > here.floor) },
  ].filter((g) => g.people.length);
  const unlisted = here.count - here.people.length;
  return (
    <Sheet open={open} onClose={onClose} label={`Everyone at ${placeName}`}>
      <SheetTitle>Everyone here</SheetTitle>
      <p className="meta" style={{ margin: "4px 0 0" }}>{hereCountLine(here.count, here.inView.length)} · at {placeName} now</p>
      {groups.map((g) => (
        <section key={g.title}>
          <p className="overline" style={{ margin: "16px 0 6px" }}>{g.title} · {g.people.length}</p>
          {g.people.map((p) => (
            <button key={p.id} className="here-row" onClick={() => { here.onOpen(p.id); onClose(); }}>
              <span className="here-face" aria-hidden="true">{getStyle(p.style as StyleId).emoji}</span>
              <span className="here-row-name">{p.name}{p.crew && <span className="meta"> · 👯 crew</span>}</span>
              <span className="meta">{p.clout.toLocaleString("en-US")} clout</span>
            </button>
          ))}
        </section>
      ))}
      {unlisted > 0 && <p className="meta" style={{ margin: "14px 0 4px", textAlign: "center" }}>…and {unlisted.toLocaleString("en-US")} more coming and going</p>}
    </Sheet>
  );
}
