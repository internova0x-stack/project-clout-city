"use client";

import { useEffect, useState } from "react";
import { GAME_CONFIG } from "@/lib/config";
import { whenScreenReady } from "@/lib/splash";
import { AppLoading } from "./AppLoading";

// Owner, Oct 24: the splash flashed for a split second when the server was quick. Owner, Nov 1: "the splash screen isn't
// staying for the duration": it now stays until the screen behind it has drawn (the welcome screen's home with the
// player in it, or the guest map; lib/splash.ts), at least GAME_CONFIG.splashMinMs from launch and splashShownMs on
// screen (an iPhone launch image or a slow download eats the launch time), at most splashMaxMs; then it fades out.
export function SplashHold() {
  const [phase, setPhase] = useState<"on" | "out" | "gone">("on");
  useEffect(() => {
    const shown = performance.now();
    let drawn = false, timedOut = false, fading = false;
    const timers: number[] = [];
    const fade = () => {
      if (fading) return;
      fading = true;
      setPhase("out");
      timers.push(window.setTimeout(() => setPhase("gone"), 400));
    };
    const tryFade = () => {
      if (!drawn && !timedOut) return;
      const wait = Math.max(0, GAME_CONFIG.splashMinMs - performance.now(), GAME_CONFIG.splashShownMs - (performance.now() - shown));
      timers.push(window.setTimeout(fade, wait));
    };
    const stop = whenScreenReady(() => { drawn = true; tryFade(); });
    timers.push(window.setTimeout(() => { timedOut = true; tryFade(); }, GAME_CONFIG.splashMaxMs));
    return () => { stop(); timers.forEach((t) => window.clearTimeout(t)); };
  }, []);
  if (phase === "gone") return null;
  return <div className={`splash-hold${phase === "out" ? " out" : ""}`} aria-hidden={phase === "out"}><AppLoading /></div>;
}
