"use client";

import { useEffect, useState } from "react";
import { GAME_CONFIG } from "@/lib/config";
import { AppLoading } from "./AppLoading";

// Owner, Oct 24: the splash flashed for a split second when the server was quick. This keeps it over the first screen
// until GAME_CONFIG.splashMinMs after the app opened (counted from the page's start), then fades it out.
export function SplashHold() {
  const [phase, setPhase] = useState<"on" | "out" | "gone">("on");
  useEffect(() => {
    const wait = Math.max(0, GAME_CONFIG.splashMinMs - performance.now());
    const a = window.setTimeout(() => setPhase("out"), wait);
    const b = window.setTimeout(() => setPhase("gone"), wait + 400);
    return () => { window.clearTimeout(a); window.clearTimeout(b); };
  }, []);
  if (phase === "gone") return null;
  return <div className={`splash-hold${phase === "out" ? " out" : ""}`} aria-hidden={phase === "out"}><AppLoading /></div>;
}
