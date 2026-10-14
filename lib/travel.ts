import { CITY_ECONOMY } from "./city.ts";
import type { LatLng } from "./map/geo.ts";

/**
 * Travel (v0.8, #4): how far, which distance band, and what each way of getting there costs.
 * Mirrors public.travel() (migration 0025), which charges the same numbers.
 */
export type TravelMode = "walk" | "subway" | "taxi" | "car";
export const TRAVEL_MODES: { id: TravelMode; label: string; emoji: string }[] = [
  { id: "walk", label: "Walk", emoji: "🚶" },
  { id: "subway", label: "Subway", emoji: "🚇" },
  { id: "taxi", label: "Taxi", emoji: "🚕" },
  { id: "car", label: "Your car", emoji: "🚗" },
];

/** Straight-line miles between two points (haversine). */
export function milesBetween([lat1, lng1]: LatLng, [lat2, lng2]: LatLng): number {
  const r = 3958.8;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(a));
}

/** 0: under 0.5 mi, 1: 0.5 to 2, 2: 2 to 5, 3: over 5. */
export function distanceBand(miles: number): 0 | 1 | 2 | 3 {
  const [a, b, c] = CITY_ECONOMY.travel.bandsMiles;
  return miles < a ? 0 : miles < b ? 1 : miles < c ? 2 : 3;
}

export interface TravelQuote {
  mode: TravelMode;
  /** Cash, in C$. */
  fare: number;
  energy: number;
  seconds: number;
  /** Why it can't be used, when it can't. */
  unavailable?: string;
}

/** #13: seconds a trip takes, by mode and real miles (0 to 60). */
export function tripSeconds(mode: TravelMode, miles: number): number {
  const t = CITY_ECONOMY.travel.time[mode];
  return Math.min(t.max, Math.round(t.base + t.perMile * miles));
}

/** #13: what skipping the rest of a trip costs, by seconds left (the server charges the same). */
export function skipCost(secondsLeft: number): number {
  const s = CITY_ECONOMY.travel.skip;
  return secondsLeft <= 0 ? 0 : Math.max(s.min, Math.ceil(secondsLeft / s.secondsPerCash));
}

export function travelQuote(mode: TravelMode, miles: number, hasCar: boolean): TravelQuote {
  const t = CITY_ECONOMY.travel;
  const band = distanceBand(miles);
  const seconds = tripSeconds(mode, miles);
  switch (mode) {
    case "walk": {
      const energy = t.walk.energy[band];
      return energy == null
        ? { mode, fare: 0, energy: 0, seconds: 0, unavailable: "Too far to walk" }
        : { mode, fare: 0, energy, seconds };
    }
    case "subway": return { mode, fare: t.subway.fare, energy: 0, seconds };
    case "taxi": return { mode, fare: t.taxi.fare[band], energy: 0, seconds };
    case "car": return hasCar
      ? { mode, fare: 0, energy: 0, seconds }
      : { mode, fare: 0, energy: 0, seconds: 0, unavailable: "Buy or rent one in the Shop" };
  }
}

/** "0.4 mi", "1.4 mi", "12 mi". */
export const formatMiles = (m: number) => `${m < 10 ? m.toFixed(1) : Math.round(m)} mi`;
