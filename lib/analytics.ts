"use client";

import type { PostHog } from "posthog-js";
import type { CityApi, CityResult, CityState } from "./cityState";
import { analyticsOff, missedRent, rentPaid, shopBought, taskEvents, type AnalyticsEvent, type EventProps, type Tracked } from "./analyticsEvents";

// PostHog analytics (owner, Oct 27). instrumentation-client.ts calls startAnalytics(); these helpers send nothing when it
// isn't running (no token, local previews, the Story Studio). Identity is the Supabase user id only: no emails, no names.
// Speed on cheap phones (owner, Nov 1): PostHog (300 KB) downloads only once this device has accepted the banner, so a
// player who hasn't answered, or said no, never loads it. The answer is kept in `cc-consent` (and PostHog's own key from
// before, read once).

const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
const CONSENT_KEY = "cc-consent";

let ph: PostHog | null = null;
let starting: Promise<PostHog | null> | null = null;
/** Calls made while PostHog is still downloading (the first page's events), sent once it's ready. */
let queue: ((p: PostHog) => void)[] = [];

const running = () => typeof window !== "undefined" && !!token && !analyticsOff(window.location.pathname);
const on = () => running() && !!ph?.__loaded;
const later = (fn: (p: PostHog) => void) => {
  if (on()) fn(ph!);
  else if (starting && queue.length < 50) queue.push(fn);
};

function storedConsent(): Consent {
  try {
    const mine = localStorage.getItem(CONSENT_KEY);
    if (mine === "granted" || mine === "denied") return mine;
    // Answered before Nov 1: PostHog kept it under its own name, in local storage or a cookie.
    const name = `__ph_opt_in_out_${token}`;
    const old = localStorage.getItem(name) ?? document.cookie.split("; ").find((c) => c.startsWith(`${name}=`))?.slice(name.length + 1) ?? null;
    if (old !== null) {
      const v = decodeURIComponent(old).replace(/"/g, "");
      const c: Consent = ["1", "true", "yes"].includes(v) ? "granted" : "denied";
      localStorage.setItem(CONSENT_KEY, c);
      return c;
    }
  } catch { /* storage blocked: ask */ }
  return "pending";
}

function load(): Promise<PostHog | null> {
  if (!running()) return Promise.resolve(null);
  starting ??= import("posthog-js").then(({ default: posthog }) => {
    posthog.init(token!, {
      api_host: host || "https://us.i.posthog.com",
      defaults: "2026-08-30",
      autocapture: true,
      capture_pageview: "history_change",
      person_profiles: "identified_only",
      opt_out_capturing_by_default: true,
      opt_out_persistence_by_default: true,
      session_recording: {
        maskAllInputs: true,
        maskTextSelector: ".ph-sensitive",
      },
      // Moving into the Studio inside one tab still sends nothing.
      before_send: (e) => (analyticsOff(window.location.pathname) ? null : e),
    });
    if (posthog.get_explicit_consent_status() !== "granted") posthog.opt_in_capturing();
    ph = posthog;
    const q = queue;
    queue = [];
    q.forEach((fn) => fn(posthog));
    return posthog;
  }).catch(() => null);
  return starting;
}

/** Starts PostHog on this page if the device has accepted analytics (instrumentation-client.ts). */
export function startAnalytics(): void {
  if (running() && storedConsent() === "granted") void load();
}

export function track(event: AnalyticsEvent, props: EventProps = {}): void {
  later((p) => p.capture(event, props));
}
const send = (list: Tracked[]) => list.forEach((t) => track(t.event, t.props));

/** Once per signed-in user (the Supabase id), re-sent on each load in case the device changed hands. */
export function identify(userId: string): void {
  later((p) => { if (p.get_distinct_id() !== userId) p.identify(userId); });
}
export function resetAnalytics(): void {
  later((p) => p.reset());
}

/** Consent (GDPR/ePrivacy): "pending" until the player answers the banner; null when analytics isn't running. */
export type Consent = "granted" | "denied" | "pending";
export function consentStatus(): Consent | null {
  if (!running()) return null;
  return storedConsent();
}
/** Accept turns on analytics and session replay; reject (or turning it off later) stops both and forgets this device. */
export function setConsent(granted: boolean): void {
  if (!running()) return;
  try { localStorage.setItem(CONSENT_KEY, granted ? "granted" : "denied"); } catch { /* this visit only */ }
  if (granted) {
    void load().then((p) => { if (!p) return; p.opt_in_capturing(); p.startSessionRecording(); });
  } else if (ph) {
    ph.stopSessionRecording();
    ph.opt_out_capturing();
  }
  window.dispatchEvent(new Event("cc-consent"));
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
