"use client";

import { useEffect, useMemo, useState } from "react";
import { GUEST_START, WAVE_1_PINS, type PlacePin } from "@/lib/places";
import { music, readLocalMuted } from "@/lib/music";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { CityMap } from "./map/CityMap";
import { SignUpSheet, type AuthMode } from "./SignUpSheet";
import { useCityClock } from "./useCityClock";

type Filter = "all" | PlacePin["category"];

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "✨ All" },
  { id: "nightlife", label: "🍸 Nightlife" },
  { id: "food", label: "🍔 Food" },
  { id: "parks", label: "🌳 Parks" },
  { id: "places", label: "🏢 Places" },
];

interface Arrival { display_name: string; arrived_at: string }

function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

// The guest screen (Clarifications section 1, step 1), laid out after the SF
// Life reference in Clout City's dark glass: a slim brand bar, live city pills
// with real numbers, map filter chips (C10), the live ticker (C22) and a
// sign-up card. Guests pan, zoom and filter freely; tapping a place opens sign-up.
export function GuestMap({ invited, authError }: { invited: boolean; authError: boolean }) {
  const { time, daytime } = useCityClock();
  const [auth, setAuth] = useState<AuthMode | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [residents, setResidents] = useState<number | null>(null);
  const [arrivals, setArrivals] = useState<Arrival[]>([]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    supabase.rpc("city_pulse").then(({ data }) => {
      const row = Array.isArray(data) ? data[0] : data;
      if (row && typeof row.residents === "number") setResidents(row.residents);
    });
    supabase.rpc("recent_arrivals", { p_limit: 8 }).then(({ data }) => {
      if (Array.isArray(data)) setArrivals(data as Arrival[]);
    });
  }, []);

  // The ticker rotates every 4 seconds (C22).
  useEffect(() => {
    if (arrivals.length < 2) return;
    const t = setInterval(() => setTick((n) => n + 1), 4000);
    return () => clearInterval(t);
  }, [arrivals.length]);

  const pins = useMemo(() => (filter === "all" ? WAVE_1_PINS : WAVE_1_PINS.filter((p) => p.category === filter)), [filter]);
  // The first tap on anything interactive opens sign-up and starts the music.
  const startMusic = () => {
    music().setMuted(readLocalMuted());
    music().start();
  };
  const signUp = () => {
    startMusic();
    setAuth("signup");
  };
  const arrival = arrivals.length ? arrivals[tick % arrivals.length] : null;

  return (
    <main className="game">
      <CityMap
        pins={pins}
        initialCenter={GUEST_START.at}
        initialZoom={GUEST_START.zoom}
        daytime={daytime}
        onPinTap={signUp}
        onLockedTap={signUp}
        attributionControl={false}
      />

      <div className="guest-top">
        <header className="guest-bar glass-hud">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/clout-city-logo-dark-simple.png" alt="Clout City NYC" width={649} height={299} className="guest-logo" />
          <span className="spacer" />
          <button className="btn btn-taxi guest-bar-btn" onClick={signUp}>Sign up</button>
          <button className="btn btn-secondary guest-bar-btn guest-login" onClick={() => { startMusic(); setAuth("login"); }}>Log in</button>
        </header>

        <div className="guest-pills" aria-label="Queens right now">
          <span className="pill-status glass-hud">📍 {GUEST_START.label} · {GUEST_START.tagline}</span>
          {time && <span className="pill-status glass-hud">{daytime ? "☀️" : "🌙"} {time} · {daytime ? "day" : "night"} in Queens</span>}
          {residents !== null && residents > 0 && (
            <span className="pill-status glass-hud"><span className="dot-green" aria-hidden="true" /> {residents.toLocaleString()} {residents === 1 ? "resident" : "residents"} in Queens</span>
          )}
          <span className="pill-status glass-hud">🗺️ {WAVE_1_PINS.length} spots on the map</span>
        </div>

        <div className="chip-row guest-chips" role="group" aria-label="Filter the map">
          {FILTERS.map((f) => (
            <button key={f.id} className="chip chip-map glass-hud" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="guest-bottom">
        {arrival && (
          <div className="ticker glass-hud" role="status" aria-live="polite">
            <span className="badge-live">Live</span>
            <span className="ticker-text" key={tick}>📍 <strong>@{arrival.display_name}</strong> just moved to Queens</span>
            <span className="meta ticker-time">{timeAgo(arrival.arrived_at)}</span>
          </div>
        )}
        <section className="guest-card glass-hud" aria-label="Join Clout City">
          <p className="body-strong" style={{ margin: 0 }}>
            Become the main character.{" "}
            <span style={{ fontWeight: 400, color: "var(--text-3)" }}>Free in your browser.</span>
          </p>
          {(authError || invited) && (
            <p className="subtext" style={{ margin: "6px 0 0", color: authError ? "var(--red-text)" : "var(--text-2)" }}>
              {authError ? "That sign-in link expired or was already used. Grab a fresh one." : "A friend saved you a spot. Claim your name before the city opens."}
            </p>
          )}
          <div className="row" style={{ gap: 8, marginTop: 12 }}>
            <button className="btn btn-taxi" style={{ flex: 3 }} onClick={signUp}>Sign up free</button>
            <button className="btn btn-secondary on-dark-secondary" style={{ flex: 1.2 }} onClick={() => { startMusic(); setAuth("login"); }}>Log in</button>
          </div>
          <p className="meta guest-foot">
            A parody · 18+ · <a href="/terms">Terms</a> · <a href="/privacy">Privacy</a> · No ad trackers
            <br />
            Map <a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a> ©{" "}
            <a href="https://www.openmaptiles.org/" target="_blank" rel="noreferrer">OpenMapTiles</a> ©{" "}
            <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>
          </p>
        </section>
      </div>

      <SignUpSheet open={auth !== null} mode={auth ?? "signup"} onClose={() => setAuth(null)} onSwitchMode={setAuth} invited={invited} />
    </main>
  );
}
