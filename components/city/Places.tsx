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
import { PlaceArtMV } from "./PlaceArtMV";

const CATEGORY_LABEL: Record<Place["category"], string> = { food: "Food", nightlife: "Nightlife", parks: "Park", places: "Places", home: "Home" };

export interface PlaceHandlers {
  busy: string | null;
  onAction: (placeId: string, actionId: string) => void;
  onAttendEvent: (eventId: string) => void;
  onOpenGigs: () => void;
}

/** One row per action, then any club events held here (C37, C26). */
export function ActionList({ place, state, handlers, compact = false }: { place: Place; state: CityState; handlers: PlaceHandlers; compact?: boolean }) {
  const now = useGameNow(state.clockOffsetSeconds, 5000);
  const minutes = cityMinutes(now, GAME_CONFIG.cityClock);
  const events = CLUB_EVENTS.filter((e) => e.placeId === place.id);
  const { mood, confidence } = state.player;
  return (
    <div className="stack-8">
      {place.actions.map((a) => {
        const av = actionAvailability(place.id, a, state);
        const usedToday = (state.visitsToday[place.id] ?? 0) > 0;
        const clout = (a.kind === "visit" || a.kind === "eat") && !usedToday ? visitClout(a.price ?? 0, mood, confidence) : null;
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
                <EffectChips price={a.price} pay={a.pay} energy={a.energy} clout={clout} mood={usedToday ? 0 : a.mood} confidence={usedToday ? 0 : a.confidence} />
              )}
              {!av.ok && <span className="meta reason">{av.reason}</span>}
              {av.ok && av.note && <span className="meta">{av.note}</span>}
            </div>
            <button
              className={"btn btn-taxi btn-sm"}
              disabled={!av.ok || handlers.busy !== null}
              onClick={() => (a.kind === "gigs" ? handlers.onOpenGigs() : handlers.onAction(place.id, a.id))}
            >
              {handlers.busy === key ? "…" : a.kind === "gigs" ? "Open" : spends ? formatCash(a.price!) : a.kind === "shift" ? "Work" : "Go"}
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
              <span className="tag tag-event" style={{ marginBottom: 4 }}>🍸 Club event{open ? " · Happening now" : ""}</span>
              <span className="title" style={{ display: "block" }}>{ev.name}</span>
              {!compact && <span className="subtext" style={{ display: "block" }}>{ev.blurb}</span>}
              <EffectChips price={ev.entry} energy={20} clout={ev.clout} mood={ev.mood} confidence={ev.confidence} />
              {!open && !state.attendedToday.includes(ev.id) && <span className="meta">Doors open in {wait} min</span>}
              {open && !av.ok && <span className="meta reason">{av.reason}</span>}
              {!open && state.attendedToday.includes(ev.id) && <span className="meta">You went today. Back tomorrow.</span>}
            </div>
            <button className="btn btn-taxi btn-sm" disabled={!av.ok || handlers.busy !== null} onClick={() => handlers.onAttendEvent(ev.id)}>
              {handlers.busy === `event:${ev.id}` ? "…" : formatCash(ev.entry)}
            </button>
          </div>
        );
      })}
    </div>
  );
}

/** C37: the location card, opened from a pin or the Places list. */
export function LocationSheet({
  place, state, daytime, handlers, onClose, onGoInside, from, artStyle = "flat",
}: {
  place: Place | null;
  state: CityState;
  daytime: boolean;
  handlers: PlaceHandlers;
  onClose: () => void;
  onGoInside: (p: Place) => void;
  from: LatLng;
  /** "mv" previews the Monument Valley-style illustrations (not yet the default). */
  artStyle?: "flat" | "mv";
}) {
  return (
    <Sheet open={!!place} onClose={onClose} label={place?.name ?? "Place"}>
      {place && (
        <div className="stack-16">
          {artStyle === "mv" ? <PlaceArtMV place={place} daytime={daytime} /> : <PlaceArt place={place} daytime={daytime} />}
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
          <ActionList place={place} state={state} handlers={handlers} />
          {place.depth === "full" && (
            <button className="btn btn-taxi" onClick={() => onGoInside(place)}>Go inside</button>
          )}
        </div>
      )}
    </Sheet>
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
  open, onClose, from, onPick, state,
}: { open: boolean; onClose: () => void; from: LatLng; onPick: (p: Place) => void; state: CityState | null }) {
  const rows = PLACES.map((p) => ({ p, d: distanceMiles(from, p.at) })).sort((a, b) => a.d - b.d);
  return (
    <Sheet open={open} onClose={onClose} label="Places">
      <div className="stack-16">
        <h2 className="display-lg" style={{ margin: 0, paddingRight: 44 }}>Places</h2>
        <p className="subtext" style={{ margin: 0 }}>Queens, wave 1. More of the city opens soon.</p>
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
