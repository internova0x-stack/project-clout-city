"use client";

import { useState } from "react";
import { CLUB_EVENTS, HOME_LOCATIONS, PLACES, eventOpen, realMinutesUntilOpen, visitClout, type Place } from "@/lib/city";
import { cityMinutes } from "@/lib/cityClock";
import { actionAvailability, eventAvailability, type CityState } from "@/lib/cityState";
import { GAME_CONFIG } from "@/lib/config";
import { formatCash } from "@/lib/economy";
import { distanceMiles, type LatLng } from "@/lib/map/geo";
import { Glyph, glyphFor, tileBackground } from "../AppGlyph";
import { ChevronLeftIcon, ChevronRightIcon } from "../icons";
import { Sheet } from "../Sheet";
import { EffectChips, useGameNow } from "./Common";
import { PlaceArt } from "./PlaceArt";
import type { Regular } from "@/lib/cast";
import type { HuntResult } from "@/lib/hunts";
import { placeStory, type StoryFeed } from "@/lib/storyFeed";
import { ReasonBanner } from "../story/StoryBits";
import { ExclusiveEventCard, PostcardOffer, type MoneyHandlers } from "./Money";
import { DateStatusRow } from "../dating/Dating";
import { canDateAt, type DateNight } from "@/lib/dating";
import { crewActivities, type CrewOuting } from "@/lib/crew";
import { CrewProgress } from "../crew/Crew";
import type { StoreProduct } from "@/lib/store";
import { SHOP_CATEGORIES, type ShopCategory } from "@/lib/city";

const CATEGORY_LABEL: Record<Place["category"], string> = {
  food: "Food", nightlife: "Nightlife", parks: "Park", places: "Places", home: "Home", monument: "Monument", shopping: "Shopping", campus: "University",
};

export interface PlaceHandlers {
  busy: string | null;
  onAction: (placeId: string, actionId: string) => void;
  onAttendEvent: (eventId: string) => void;
  onOpenGigs: () => void;
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
  /** v0.6 treasure hunts (joined, unfinished): talking to a regular may be the next clue or question. */
  hunt?: { talk: (placeId: string) => Promise<HuntResult>; answer: (choice: number) => Promise<HuntResult> };
}

/** One row per action, then any club events held here (C37, C26). */
export function ActionList({ place, state, handlers, compact = false }: { place: Place; state: CityState; handlers: PlaceHandlers; compact?: boolean }) {
  const now = useGameNow(state.clockOffsetSeconds, 5000);
  const minutes = cityMinutes(now, GAME_CONFIG.cityClock);
  const events = CLUB_EVENTS.filter((e) => e.placeId === place.id);
  const { mood, confidence } = state.player;
  const world = placeStory(handlers.story ?? null, place);
  const storyTasks = (handlers.story?.tasks ?? []).filter((t) => t.do.place === place.id && !t.done);
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
        return (
          <div key={a.id} className="action-row">
            <div style={{ minWidth: 0, flex: 1 }}>
              <span className="title" style={{ display: "block" }}>{a.label}</span>
              {!compact && <span className="subtext" style={{ display: "block" }}>{a.blurb}</span>}
              {a.kind === "gigs" ? (
                <span className="meta">Today&apos;s offers, in your Phone</span>
              ) : (
                <EffectChips price={paid || undefined} pay={a.pay} energy={a.energy} clout={clout} mood={usedToday ? 0 : a.mood} confidence={usedToday ? 0 : a.confidence} />
              )}
              {paid !== (a.price ?? 0) && <span className="meta">Usually {formatCash(a.price ?? 0)} · {world.price?.reason}</span>}
              {task && <span className="meta" style={{ color: "var(--neon-text)", display: "block" }}>📰 Story task: {task.label} · +{task.clout} 🔥</span>}
              {!av.ok && <span className="meta reason">{av.reason}</span>}
              {av.ok && av.note && <span className="meta">{av.note}</span>}
            </div>
            <button
              className={"btn btn-taxi btn-sm"}
              disabled={!av.ok || handlers.busy !== null}
              onClick={() => (a.kind === "gigs" ? handlers.onOpenGigs() : handlers.onAction(place.id, a.id))}
            >
              {handlers.busy === key ? "…" : a.kind === "gigs" ? "Open" : spends ? formatCash(paid) : a.kind === "shift" ? "Work" : "Go"}
            </button>
          </div>
        );
      })}
      {events.map((ev) => {
        const open = eventOpen(ev, minutes);
        const av = eventAvailability(ev, open, state);
        const wait = realMinutesUntilOpen(ev, minutes, GAME_CONFIG.cityClock.realHoursPerCityDay);
        return (
          <div key={ev.id} className="action-row">
            <div style={{ minWidth: 0, flex: 1 }}>
              <span className="tag tag-event" style={{ marginBottom: 4 }}>{place.category === "campus" ? "🎓 Campus event" : "🍸 Club event"}{open ? " · Happening now" : ""}</span>
              <span className="title" style={{ display: "block" }}>{ev.name}</span>
              {!compact && <span className="subtext" style={{ display: "block" }}>{ev.blurb}</span>}
              <EffectChips price={ev.entry} energy={20} clout={ev.clout} mood={ev.mood} confidence={ev.confidence} />
              {!open && !state.attendedToday.includes(ev.id) && <span className="meta">Doors open in {wait} min</span>}
              {open && !av.ok && <span className="meta reason">{av.reason}</span>}
              {!open && state.attendedToday.includes(ev.id) && <span className="meta">You went today. Back tomorrow.</span>}
              {handlers.dating && !compact && (
                <button className="btn btn-secondary btn-sm date-btn" onClick={() => handlers.dating!.onMakeDate({ kind: "event", target: ev.id, price: ev.entry })}>
                  🌙 Make it a date
                </button>
              )}
            </div>
            <button className="btn btn-taxi btn-sm" disabled={!av.ok || handlers.busy !== null} onClick={() => handlers.onAttendEvent(ev.id)}>
              {handlers.busy === `event:${ev.id}` ? "…" : formatCash(ev.entry)}
            </button>
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
            {ev.attendable && !ev.cancelled && (
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

/** v0.6: the regular stands on the illustration with a speech-bubble label; each tap says the
 * next line, in a bubble just below the picture so the place stays visible. For a player on a
 * treasure hunt, the first tap asks the regular about it: at the right place that's the clue,
 * and sometimes a question to answer right there in the bubble. */
type HuntLine = { say: string; question?: { q: string; choices: string[] }; note?: string; tone?: "hint" | "found" };

function PlaceArtWithRegular({ place, daytime, talk, hunt }: { place: Place; daytime: boolean; talk?: PlaceHandlers["regular"]; hunt?: PlaceHandlers["hunt"] }) {
  const [n, setN] = useState(-1);
  const [huntLine, setHuntLine] = useState<HuntLine | null>(null);
  const [asking, setAsking] = useState(false);
  const first = talk?.(place, 0) ?? null;
  const said = first && n >= 0 ? talk!(place, n) : null;
  const firstName = first?.regular.name.split(" ")[0] ?? "";
  const onTap = async () => {
    // Ask about the hunt on the first tap, and again after a "stop in first" hint.
    if (!hunt || (n >= 0 && huntLine?.tone !== "hint") || (huntLine && huntLine.tone !== "hint")) { setHuntLine(null); setN((x) => x + 1); return; }
    setAsking(true);
    const r = await hunt.talk(place.id);
    setAsking(false);
    if (r.ok && r.line) { setN(-1); return setHuntLine(r.line); }
    if (!r.ok && r.code === "visit_first") {
      return setHuntLine({ say: `${firstName} has something for your hunt.`, note: "Do something here first, then ask again.", tone: "hint" });
    }
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
  return (
    <div className="stack-8">
      <div className="place-art-wrap">
        <PlaceArt place={place} daytime={daytime} />
        {first && (
          <button className="regular-tag" onClick={() => void onTap()} disabled={asking} aria-label={`Talk to ${first.regular.name}, ${first.regular.title}`}>
            <span className="regular-face" aria-hidden="true">{first.regular.emoji}</span>
            <span>{asking ? "…" : n < 0 && !huntLine ? `💬 ${firstName}` : "Tap for more"}</span>
          </button>
        )}
      </div>
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
      {said && !huntLine && (
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
  return (
    <Sheet open={!!place} onClose={onClose} label={place?.name ?? "Place"}>
      {place && (
        <div className="stack-16">
          <PlaceArtWithRegular key={place.id} place={place} daytime={daytime} talk={handlers.regular} hunt={handlers.hunt} />
          <StoryBanners place={place} story={handlers.story ?? null} />
          <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
            <span className={`tag tag-neutral`}>{place.emoji} {CATEGORY_LABEL[place.category]}</span>
            {place.tier && <span className="tag tag-neutral">{place.tier} dining</span>}
            {place.tags.some((t) => t.startsWith("job_")) && <span className="tag tag-positive">Hiring</span>}
          </div>
          <div>
            <h2 className="display-lg" style={{ margin: 0, paddingRight: 44 }}>{place.name}</h2>
            <p className="meta" style={{ margin: "4px 0 0" }}>{place.neighborhood} · {distanceMiles(from, place.at).toFixed(1)} mi from home</p>
          </div>
          <div className="lola">
            <span className="lola-avatar" aria-hidden="true">💋</span>
            <p className="body" style={{ margin: 0 }}>{place.lore}<span className="meta" style={{ display: "block", marginTop: 4 }}>Lola Lowdown</span></p>
          </div>
          {handlers.dating?.dates.filter((d) => d.placeId === place.id).map((d) => (
            <DateStatusRow key={d.id} me={handlers.dating!.me} date={d} bonus={handlers.dating!.bonus} />
          ))}
          <ActionList place={place} state={state} handlers={handlers} />
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
              {handlers.crew && crewActivities(place).length > 0 && (
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
          {handlers.money?.products.filter((p) => p.event?.placeId === place.id).map((p) => (
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
          {place.depth === "full" && (
            <button className="btn btn-taxi" onClick={() => onGoInside(place)}>Go inside</button>
          )}
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
  place, state, handlers, onBack, room,
}: {
  place: Place;
  state: CityState;
  handlers: PlaceHandlers;
  onBack: () => void;
  room: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="layer interior">
      {room}
      <button className="pill-glass glass-hud interior-back" onClick={onBack}>
        <ChevronLeftIcon size={18} /> Map
      </button>
      <section className={`interior-panel${open ? " open" : ""}`} aria-label={`${place.name} actions`}>
        <button className="interior-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <span className="display-sm">{place.emoji} {place.name}</span>
          <span className="meta">{open ? "Hide" : "All actions"}</span>
        </button>
        {open ? (
          <ActionList place={place} state={state} handlers={handlers} compact />
        ) : (
          <p className="meta" style={{ margin: "4px 0 0" }}>Tap the floor to walk. Tap a label to use it.</p>
        )}
      </section>
    </div>
  );
}

/** Every open place, nearest first, with what it costs or pays. */
export function PlacesSheet({
  open, onClose, from, onPick, state, story = null,
}: { open: boolean; onClose: () => void; from: LatLng; onPick: (p: Place) => void; state: CityState | null; story?: StoryFeed | null }) {
  const rows = visiblePlaces(story).map((p) => ({ p, d: distanceMiles(from, p.at) })).sort((a, b) => a.d - b.d);
  return (
    <Sheet open={open} onClose={onClose} label="Places">
      <div className="stack-16">
        <h2 className="display-lg" style={{ margin: 0, paddingRight: 44 }}>Places</h2>
        <p className="subtext" style={{ margin: 0 }}>Queens and Long Island City. More of the city opens soon.</p>
        <div>
          {rows.map(({ p, d }) => {
            const price = Math.min(...p.actions.map((a) => a.price ?? Infinity));
            const pay = Math.max(0, ...p.actions.map((a) => a.pay ?? 0));
            const cost = pay ? `Pays ${formatCash(pay)}` : Number.isFinite(price) ? `From ${formatCash(price)}` : p.actions.some((a) => a.kind === "gigs") ? "Gigs board" : "Free";
            const visited = (state?.visitsToday[p.id] ?? 0) > 0;
            return (
              <button key={p.id} className="list-row" onClick={() => onPick(p)}>
                <span className="map-pin-tile" aria-hidden="true" style={{ width: 40, height: 40, borderRadius: 12, background: tileBackground(glyphFor(p)) }}><Glyph name={glyphFor(p)} size={24} /></span>
                <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                  <span className="title" style={{ display: "block" }}>{p.name}</span>
                  <span className="meta">{p.neighborhood} · {d.toFixed(1)} mi{visited ? " · Visited today" : ""}</span>
                </span>
                <span className="body-strong" style={{ whiteSpace: "nowrap", fontSize: 14 }}>{cost}</span>
                <ChevronRightIcon size={18} />
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
