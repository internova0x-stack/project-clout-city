"use client";

import { useEffect, useState } from "react";
import { formatCash } from "@/lib/economy";
import type { Gain } from "@/lib/cityState";

/** Effect chips for an action row (C37): price, ⚡ Energy, 🔥 clout, 🙂 Mood, 💪 Confidence. */
export function EffectChips({
  price, pay, energy, clout, mood, confidence,
}: { price?: number; pay?: number; energy?: number; clout?: number | null; mood?: number; confidence?: number }) {
  return (
    <span className="fx-row">
      {!!price && <span className="fx fx-cost">−{formatCash(price)}</span>}
      {!!pay && <span className="fx fx-pay">+{formatCash(pay)}</span>}
      {!!energy && <span className="fx">⚡ {energy > 0 ? "−" : "+"}{Math.abs(energy)}</span>}
      {clout != null && clout > 0 && <span className="fx fx-clout">🔥 +{clout}</span>}
      {!!mood && <span className="fx">🙂 +{mood}</span>}
      {!!confidence && <span className="fx">💪 +{confidence}</span>}
    </span>
  );
}

/** A short-lived reward line under the HUD after an action. */
export function GainToast({ gain, message, onDone }: { gain: Gain | null; message?: string | null; onDone: () => void }) {
  const [key, setKey] = useState(0);
  useEffect(() => {
    if (!gain && !message) return;
    setKey((k) => k + 1);
    const t = setTimeout(onDone, 2600);
    return () => clearTimeout(t);
  }, [gain, message, onDone]);
  if (!gain && !message) return null;
  const parts: string[] = [];
  if (gain) {
    const base = (gain.cash ?? 0) - (gain.taskCash ?? 0);
    if (gain.clout) parts.push(`🔥 +${gain.clout}`);
    if (base) parts.push(`${base > 0 ? "+" : "−"}${formatCash(Math.abs(base))}`);
    if (gain.energy) parts.push(`⚡ ${gain.energy > 0 ? "+" : "−"}${Math.abs(gain.energy)}`);
    if (gain.mood) parts.push(`🙂 +${gain.mood}`);
    if (gain.confidence) parts.push(`💪 +${gain.confidence}`);
    if (gain.taskCash) parts.push(`✅ Task +${formatCash(gain.taskCash)}`);
  }
  return (
    <div key={key} className="gain-toast glass-hud" role="status">
      {message ?? (parts.length ? parts.join("   ") : "Done.")}
    </div>
  );
}

/** 52 pt white icon tile (C23). */
export function IconTile({ emoji, size = 52 }: { emoji: string; size?: number }) {
  return (
    <span className="icon-tile" style={{ width: size, height: size, fontSize: size * 0.5 }} aria-hidden="true">
      {emoji}
    </span>
  );
}

export function Stars({ rating }: { rating: number }) {
  return (
    <span className="stars" aria-label={`${rating} of 4 stars`}>
      {[1, 2, 3, 4].map((i) => (
        <span key={i} className={i <= rating ? "on" : ""} aria-hidden="true">★</span>
      ))}
    </span>
  );
}

export function SheetTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline", paddingRight: 44, gap: 12 }}>
      <h2 className="display-lg" style={{ margin: 0 }}>{children}</h2>
      {right && <span className="body-strong" style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{right}</span>}
    </div>
  );
}

/** "now" on the game clock, ticking each second (for countdowns). */
export function useGameNow(offsetSeconds: number, every = 1000): number {
  const [now, setNow] = useState(() => Date.now() + offsetSeconds * 1000);
  useEffect(() => {
    setNow(Date.now() + offsetSeconds * 1000);
    const t = setInterval(() => setNow(Date.now() + offsetSeconds * 1000), every);
    return () => clearInterval(t);
  }, [offsetSeconds, every]);
  return now;
}

export function formatCountdown(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}:${String(sec).padStart(2, "0")}`;
}
