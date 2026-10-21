"use client";

import { placeById } from "@/lib/city";
import { CALENDAR_KIND, calendarLive, calendarReward, dressedUp, upcoming, whenLine, type CalendarData, type CalendarEvent } from "@/lib/calendar";
import type { CityState } from "@/lib/cityState";
import { formatCash } from "@/lib/economy";
import { EffectChips } from "./Common";

// Culture pack C5 (owner, Oct 20): "On the calendar" in Events. Real New York dates: a neighbor's name-day invite, a
// block party, the NYE countdown, a parade. Be at the place while it's on and tap Go (calendar_attend, migration 0096).

export interface CalendarHandlers {
  data: CalendarData;
  busy: string | null;
  onAttend: (id: string) => void;
  onGoThere?: (placeId: string) => void;
}

export function CalendarSection({ city, nowMs, h }: { city: CityState; nowMs: number; h: CalendarHandlers }) {
  const list = upcoming(h.data.events, nowMs).slice(0, 6);
  if (!list.length) return null;
  return (
    <div className="stack-8">
      <p className="overline" style={{ margin: 0 }}>On the calendar</p>
      {list.map((e) => <CalendarCard key={e.id} e={e} city={city} nowMs={nowMs} h={h} />)}
    </div>
  );
}

function CalendarCard({ e, city, nowMs, h }: { e: CalendarEvent; city: CityState; nowMs: number; h: CalendarHandlers }) {
  const live = calendarLive(e, nowMs);
  const went = city.calendar?.attended.includes(e.id) ?? false;
  const here = city.player.at_place === e.place;
  const gifts = city.calendar?.gifts ?? 0;
  const dressed = dressedUp(city.items);
  const r = calendarReward(e, { dressed, gifts });
  const k = CALENDAR_KIND[e.kind];
  const place = placeById(e.place);
  return (
    <div className={`item-card${e.kind === "invite" ? " calendar-invite" : ""}`}>
      <span className={`tag ${live ? "tag-event" : "tag-neutral"}`}>{k.emoji} {k.label}{live ? " · Happening now" : ""}</span>
      <span className="title" style={{ display: "block" }}>{e.title}</span>
      {e.host && <span className="meta">From {e.host}</span>}
      <span className="subtext">{e.blurb}</span>
      <span className="meta">{place?.name ?? e.place} · {whenLine(e, nowMs)} New York time{e.entry ? ` · Entry ${formatCash(e.entry)}` : " · Free"}</span>
      {!went && e.dressCode && <span className="meta">👗 {e.dressCode.label}: {dressed ? `you're dressed for it (+${e.dressCode.clout} 🔥)` : `+${e.dressCode.clout} 🔥 if you do`}</span>}
      {!went && e.gift && <span className="meta">🎁 {e.gift.label}: {gifts > 0 ? "you have one" : `pick one up at Sal's or Schlep & Schmear, or lose ${e.gift.penalty} 🔥`}</span>}
      {!went && <EffectChips clout={r.clout} mood={r.mood} />}
      {went ? (
        <span className="owned-chip">You went. The neighborhood remembers.</span>
      ) : !city.calendar ? null : live && here ? (
        <button className="btn btn-taxi btn-sm" disabled={h.busy !== null} onClick={() => h.onAttend(e.id)}>
          {h.busy === `calendar:${e.id}` ? "…" : e.entry ? `Go · ${formatCash(e.entry)}` : "Go"}
        </button>
      ) : !here && h.onGoThere ? (
        <button className="btn btn-secondary btn-sm" onClick={() => h.onGoThere!(e.place)}>{live ? "Go there now" : "Go there"}</button>
      ) : (
        <span className="meta">It starts on its day and time. Come back then.</span>
      )}
    </div>
  );
}
