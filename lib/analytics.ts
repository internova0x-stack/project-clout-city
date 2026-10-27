"use client";

import posthog from "posthog-js";
import type { CityApi, CityResult, CityState } from "./cityState";
import { analyticsOff, missedRent, rentPaid, shopBought, taskEvents, type AnalyticsEvent, type EventProps, type Tracked } from "./analyticsEvents";

// PostHog analytics (owner, Oct 27). instrumentation-client.ts starts it; these helpers send nothing when it isn't
// running (no token, local previews, the Story Studio). Identity is the Supabase user id only: no emails, no names.

const on = () => typeof window !== "undefined" && posthog.__loaded && !analyticsOff(window.location.pathname);

export function track(event: AnalyticsEvent, props: EventProps = {}): void {
  if (on()) posthog.capture(event, props);
}
const send = (list: Tracked[]) => list.forEach((t) => track(t.event, t.props));

/** Once per signed-in user (the Supabase id), re-sent on each load in case the device changed hands. */
export function identify(userId: string): void {
  if (on() && posthog.get_distinct_id() !== userId) posthog.identify(userId);
}
export function resetAnalytics(): void {
  if (typeof window !== "undefined" && posthog.__loaded) posthog.reset();
}

/** A per-device "once" (first place visited, signup completed, rent missed): true the first time for this key. */
export function firstTime(key: string): boolean {
  try {
    if (localStorage.getItem(key)) return false;
    localStorage.setItem(key, "1");
    return true;
  } catch { return false; }
}

/**
 * The city's calls with analytics around them: the result is returned untouched, and each success is compared with
 * the state before it (tasks done, rent missed or paid, a first place, an event, a Shop purchase).
 */
export function trackedCity(api: CityApi): CityApi {
  let last: CityState | null = null;
  const after = (r: CityResult, extra?: (prev: CityState | null, next: CityState) => Tracked[]) => {
    if (!r.ok) return r;
    const prev = last;
    last = r.state;
    const id = r.state.player.id;
    send(taskEvents(prev, r.state));
    const seenKey = `cc-ph-rent-missed:${id}`;
    let seen: number[] = [];
    try { seen = JSON.parse(localStorage.getItem(seenKey) ?? "[]"); } catch { /* fine */ }
    const missed = missedRent(r.state, new Set(seen));
    if (missed.length) {
      send(missed);
      try { localStorage.setItem(seenKey, JSON.stringify([...seen, ...missed.map((m) => m.props.bill_id)].slice(-20))); } catch { /* fine */ }
    }
    if (extra) send(extra(prev, r.state));
    return r;
  };
  const firstPlace = (placeId: string, how: string) => (_: CityState | null, next: CityState): Tracked[] =>
    placeId !== "home" && firstTime(`cc-ph-first-place:${next.player.id}`) ? [{ event: "first_place_visited", props: { place_id: placeId, how } }] : [];
  const attended = (eventId: string, kind: string) => (): Tracked[] => [{ event: "event_attended", props: { event_id: eventId, kind } }];
  const wrapped: CityApi = {
    ...api,
    refresh: async () => after(await api.refresh()),
    doAction: async (placeId, actionId) => after(await api.doAction(placeId, actionId), firstPlace(placeId, "action")),
    attendEvent: async (eventId) => after(await api.attendEvent(eventId), attended(eventId, "club")),
    buyItem: async (sku, mode) => {
      const r = await api.buyItem(sku, mode);
      return after(r, (prev, next) => [shopBought(sku, mode, prev, next, r.ok ? r.gain?.cash : undefined)]);
    },
    payBill: async (billId) => {
      const bill = last?.bills.find((b) => b.id === billId);
      return after(await api.payBill(billId), (_, next) => rentPaid(bill, next));
    },
  };
  const pass = (r: CityResult) => after(r);
  for (const k of Object.keys(api) as (keyof CityApi)[]) {
    if (k in wrapped && wrapped[k] !== api[k]) continue;
    const f = api[k];
    if (typeof f !== "function") continue;
    // Every other call still keeps the "before" state current (tasks can finish anywhere).
    (wrapped as unknown as Record<string, unknown>)[k] = async (...a: unknown[]) => {
      const r = await (f as (...x: unknown[]) => Promise<CityResult>).apply(api, a);
      return r && typeof r === "object" && "ok" in r && "state" in r ? pass(r) : r;
    };
  }
  if (api.travel) {
    const travel = api.travel;
    wrapped.travel = async (placeId, mode) => after(await travel(placeId, mode), firstPlace(placeId, mode));
  }
  if (api.calendarAttend) {
    const cal = api.calendarAttend;
    wrapped.calendarAttend = async (eventId) => after(await cal(eventId), attended(eventId, "calendar"));
  }
  if (api.attendExclusiveEvent) {
    const ex = api.attendExclusiveEvent;
    wrapped.attendExclusiveEvent = async (eventId) => after(await ex(eventId), attended(eventId, "exclusive"));
  }
  return wrapped;
}
