"use client";

import { useEffect, useRef, useState } from "react";
import type { CityState } from "@/lib/cityState";
import { formatCash } from "@/lib/economy";
import type { LatLng } from "@/lib/map/geo";
import { formatMiles, milesBetween, TRAVEL_MODES, travelQuote, type TravelMode } from "@/lib/travel";
import type { MapApi } from "../map/CityMap";
import { Sheet } from "../Sheet";

export interface TripPlan { from: LatLng; to: LatLng; fromName: string; toName: string; toId: string }
export interface Trip extends TripPlan { mode: TravelMode; seconds: number; fare: number }

/**
 * v0.8 (#4): "Go there". Walk, subway, taxi or your own car, priced by distance band
 * (lib/travel.ts, public.travel in migration 0025).
 */
export function TravelSheet({ plan, state, busy, onClose, onGo }: {
  plan: TripPlan | null; state: CityState; busy: boolean; onClose: () => void; onGo: (mode: TravelMode) => void;
}) {
  const miles = plan ? milesBetween(plan.from, plan.to) : 0;
  const quotes = TRAVEL_MODES.map((m) => ({ ...m, q: travelQuote(m.id, miles, !!state.player.car_sku) }));
  const usable = (q: (typeof quotes)[number]["q"]) => !q.unavailable && state.player.bank_cash >= q.fare && state.player.energy >= q.energy;
  const [pick, setPick] = useState<TravelMode>("taxi");
  const [lastPlan, setLastPlan] = useState<TripPlan | null>(null);
  if (plan !== lastPlan) {
    setLastPlan(plan);
    // Default to the fastest way you can afford: car, then taxi, subway, walk.
    const first = (["car", "taxi", "subway", "walk"] as TravelMode[]).find((m) => usable(quotes.find((x) => x.id === m)!.q));
    if (first) setPick(first);
  }
  const chosen = quotes.find((x) => x.id === pick)!;
  return (
    <Sheet open={!!plan} onClose={onClose} label="Get there">
      {plan && (
        <div className="stack-12">
          <div>
            <h2 className="display-md" style={{ margin: 0, paddingRight: 44 }}>Get to {plan.toName}</h2>
            <p className="meta" style={{ margin: "4px 0 0" }}>{formatMiles(miles)} · from {plan.fromName}</p>
          </div>
          <div className="stack-8" role="radiogroup" aria-label="How to get there">
            {quotes.map(({ id, label, emoji, q }) => {
              const ok = usable(q);
              const why = q.unavailable ?? (state.player.bank_cash < q.fare ? `${formatCash(q.fare - state.player.bank_cash)} short` : state.player.energy < q.energy ? "Not enough Energy" : null);
              return (
                <button key={id} role="radio" aria-checked={pick === id} disabled={!ok} className={`travel-mode${pick === id ? " on" : ""}`} onClick={() => setPick(id)}>
                  <span className="travel-mode-emoji" aria-hidden="true">{emoji}</span>
                  <span className="travel-mode-text">
                    <b>{label}</b>
                    <small>{why ?? (q.energy ? `⚡ −${q.energy} · ${q.seconds} s` : `${q.seconds} s`)}</small>
                  </span>
                  <span className="travel-mode-price">{q.unavailable ? "—" : q.fare ? formatCash(q.fare) : "Free"}</span>
                </button>
              );
            })}
          </div>
          <button className="btn btn-taxi" disabled={busy || !usable(chosen.q)} onClick={() => onGo(pick)}>
            {busy ? "…" : `${pick === "walk" ? "Walk there" : pick === "car" ? "Drive there" : `Go by ${chosen.label.toLowerCase()}`}${chosen.q.fare ? ` · ${formatCash(chosen.q.fare)}` : ""}`}
          </button>
          <p className="meta" style={{ margin: 0, textAlign: "center" }}>Trips run on your own timer, never the city clock. Skip any time, free.</p>
        </div>
      )}
    </Sheet>
  );
}

const ICON: Record<TravelMode, string> = { walk: "🚶", subway: "🚇", taxi: "🚕", car: "🚗" };

/**
 * The trip, from helicopter height (owner, Oct 13: never street level): the camera frames both
 * ends, the ride moves across the map, and Skip ends it at once. Arrival already happened on the
 * server; this is only the show.
 */
export function TripView({ trip, map, onDone }: { trip: Trip; map: MapApi | null; onDone: () => void }) {
  const [t, setT] = useState(0);
  const [, setFrame] = useState(0);
  const done = useRef(false);
  const finish = () => { if (!done.current) { done.current = true; onDone(); } };
  useEffect(() => {
    map?.frameTrip(trip.from, trip.to);
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const lead = 700; // let the camera settle first
    const total = reduce ? 600 : trip.seconds * 1000;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const k = Math.min(1, Math.max(0, (now - start - lead) / total));
      setT(k);
      setFrame((f) => f + 1);
      if (k < 1) raf = requestAnimationFrame(tick);
      else setTimeout(finish, 350);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const a = map?.project(trip.from);
  const b = map?.project(trip.to);
  const at: LatLng = [trip.from[0] + (trip.to[0] - trip.from[0]) * t, trip.from[1] + (trip.to[1] - trip.from[1]) * t];
  const p = map?.project(at);
  const left = Math.max(0, Math.ceil(trip.seconds * (1 - t)));
  return (
    <div className="trip" role="dialog" aria-label={`On the way to ${trip.toName}`}>
      {a && b && (
        <svg className="trip-route" aria-hidden="true">
          <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
        </svg>
      )}
      {p && <span className={`trip-ride ${trip.mode}`} style={{ left: p.x, top: p.y }} aria-hidden="true">{ICON[trip.mode]}</span>}
      <div className="trip-bar" role="status">
        <b>{ICON[trip.mode]} {trip.mode === "walk" ? "Walking" : trip.mode === "car" ? "Driving" : trip.mode === "subway" ? "Subway" : "Taxi"} to {trip.toName}</b>
        <small>{t >= 1 ? "Arrived" : `Arriving in 0:${String(left).padStart(2, "0")}`}{trip.fare ? ` · ${formatCash(trip.fare)} paid` : ""}</small>
        <span className="trip-progress"><span style={{ width: `${Math.round(t * 100)}%` }} /></span>
      </div>
      <button className="trip-skip" onClick={finish}>Skip ›</button>
    </div>
  );
}
