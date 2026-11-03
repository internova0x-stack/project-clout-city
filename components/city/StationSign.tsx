"use client";

import { useEffect } from "react";
import { CITY_ECONOMY, placeOpen, type Place } from "@/lib/city";

// The station sign (owner, Nov 3, the motion kit): walking into a place flips down a black subway-style sign with its name,
// its train lines and its hours, then a live strip with what's happening there now. It goes by itself after a few
// seconds, or on a tap, and never blocks the room behind it.

const LINE_COLORS: Record<string, [string, string]> = {
  N: ["#FCCC0A", "#14111A"], W: ["#FCCC0A", "#14111A"], 7: ["#B933AD", "#FFFFFF"], E: ["#0039A6", "#FFFFFF"],
};
const hourLabel = (h: number) => { const x = ((h % 24) + 24) % 24; return `${x % 12 === 0 ? 12 : x % 12} ${x < 12 ? "AM" : "PM"}`; };

export const SIGN_MS = 3400;

export function StationSign({ place, cityMinutes, happening, onDone }: {
  place: Place;
  cityMinutes: number;
  happening?: { emoji: string; title: string } | null;
  onDone: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onDone, SIGN_MS);
    return () => clearTimeout(t);
  }, [place.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const lines = (CITY_ECONOMY.travel.subway.lines[place.neighborhood] ?? "").split("/").filter(Boolean);
  const hours = place.hours
    ? placeOpen(place, cityMinutes) ? `open till ${hourLabel(place.hours.close)}` : `opens ${hourLabel(place.hours.open)}`
    : null;
  return (
    <button className="station-sign" onClick={onDone} aria-label={`${place.name}. Tap to close.`}>
      <span className="station-sign-plate">
        <span className="station-sign-stripe" aria-hidden="true" />
        <span className="station-sign-name">{place.name}</span>
        <span className="station-sign-sub">
          {lines.map((l) => {
            const [bg, fg] = LINE_COLORS[l] ?? ["#808183", "#FFFFFF"];
            return <span key={l} className="station-sign-bullet" style={{ background: bg, color: fg }} aria-hidden="true">{l}</span>;
          })}
          <span>{place.neighborhood}{hours ? ` · ${hours}` : ""}</span>
        </span>
      </span>
      {happening && (
        <span className="station-sign-now">
          <span className="life-live" aria-hidden="true" />
          <span><b>Happening now:</b> {happening.emoji} {happening.title}</span>
        </span>
      )}
    </button>
  );
}
