"use client";

import { useState } from "react";
import { QUEENS_CENTER, WAVE_1_PINS } from "@/lib/places";
import { GameChrome } from "./hud/GameChrome";
import { CityMap } from "./map/CityMap";
import { SignUpSheet } from "./SignUpSheet";
import { useCityClock } from "./useCityClock";

// Step 1 of first-time play: the guest map. Pan and zoom freely; the first tap
// on anything interactive opens sign-up (Clarifications section 1).
export function GuestMap({ invited, authError }: { invited: boolean; authError: boolean }) {
  const { time, daytime } = useCityClock();
  const [signUp, setSignUp] = useState(false);
  const [introOpen, setIntroOpen] = useState(true);
  const open = () => setSignUp(true);

  return (
    <main className="game">
      <CityMap pins={WAVE_1_PINS} initialCenter={QUEENS_CENTER} daytime={daytime} onPinTap={open} onLockedTap={open} />
      <GameChrome time={time} tab="map" onAction={open} />

      {introOpen && (
        <div
          className="glass-dark"
          style={{
            position: "absolute", zIndex: 18, left: 12, right: 12, bottom: "calc(88px + var(--safe-bottom))",
            borderRadius: "var(--r-lg)", padding: 16, textAlign: "center", boxShadow: "var(--elev-2)", animation: "rise-in .4s ease-out",
          }}
        >
          <div className="wordmark" style={{ fontSize: 30, lineHeight: "32px" }}>
            CLOUT CITY<small>NYC</small>
          </div>
          <div className="tagline-bar" style={{ marginTop: 10 }}>Tap in. Blow up.</div>
          <p className="subtext" style={{ color: "rgba(255,246,224,.8)", margin: "10px 0 12px" }}>
            {authError
              ? "That sign-in link expired or was already used. Grab a fresh one."
              : invited
                ? "A friend saved you a spot. Explore Queens, then claim your name."
                : "Early access. Explore Queens, then claim your name before the city opens."}
          </p>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-taxi" style={{ flex: 3 }} onClick={open}>Tap in ›</button>
            <button className="btn btn-ghost on-dark" style={{ flex: 1, color: "rgba(255,246,224,.7)" }} onClick={() => setIntroOpen(false)}>
              Look around
            </button>
          </div>
        </div>
      )}

      <SignUpSheet open={signUp} onClose={() => setSignUp(false)} invited={invited} />
    </main>
  );
}
