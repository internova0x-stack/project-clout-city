"use client";

import { useEffect, useRef, useState } from "react";
import { getBrowserSupabase } from "./supabase/client";

// Fewer server checks (owner, Oct 30: "pause timers in the background, live push for chat, party and visit rooms").
//
// everyVisible: like setInterval, but it skips while the game isn't on screen (another tab, the phone locked) and runs
// once as soon as the player is back, so nothing is stale and nothing ran for nobody.
//
// Doorbells: a Supabase Realtime broadcast on a topic ("thread:12", "party:3", "visit:7") that carries no data. Whoever
// changes something rings it; everyone listening fetches through their own signed-in calls at once, which keep every
// permission check. A slow backup check stays in case a ring is missed.

/** setInterval that pauses while the page is hidden and catches up once when it's shown. Returns a stop function. */
export function everyVisible(fn: () => void, ms: number): () => void {
  const hidden = () => typeof document !== "undefined" && document.visibilityState === "hidden";
  let missed = false;
  const id = setInterval(() => {
    if (hidden()) { missed = true; return; }
    fn();
  }, ms);
  const onShow = () => {
    if (!hidden() && missed) { missed = false; fn(); }
  };
  document.addEventListener("visibilitychange", onShow);
  return () => {
    clearInterval(id);
    document.removeEventListener("visibilitychange", onShow);
  };
}

/** Rings a doorbell: listeners on this topic re-fetch now. Fire and forget; a missed ring is caught by the backup check. */
export function ring(topic: string) {
  const supabase = getBrowserSupabase();
  if (!supabase) return;
  // This page may already listen on the topic: ring on that channel (one join per topic per client).
  const open = supabase.getChannels().find((c) => c.topic === `realtime:bell:${topic}`);
  if (open) { void open.send({ type: "broadcast", event: "ring", payload: {} }); return; }
  const channel = supabase.channel(`bell:${topic}`);
  channel.subscribe((status) => {
    if (status !== "SUBSCRIBED") return;
    void channel.send({ type: "broadcast", event: "ring", payload: {} }).finally(() => void supabase.removeChannel(channel));
  });
}

/** Listens on a doorbell while `topic` is set; `onRing` runs on every ring (from anyone, including other tabs). */
export function useDoorbell(topic: string | null, onRing: () => void) {
  const latest = useRef(onRing);
  latest.current = onRing;
  useEffect(() => {
    const supabase = getBrowserSupabase();
    if (!supabase || !topic) return;
    const channel = supabase.channel(`bell:${topic}`).on("broadcast", { event: "ring" }, () => latest.current()).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [topic]);
}

/** The signed-in player's id in the browser (null before it's known, or without accounts). */
export function useMyId(): string | null {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => setId(data.session?.user.id ?? null));
  }, []);
  return id;
}

/** A direct chat's doorbell: the same topic for both people (their ids, sorted). */
export const dmTopic = (a: string, b: string) => `dm:${[a, b].sort().join(":")}`;
