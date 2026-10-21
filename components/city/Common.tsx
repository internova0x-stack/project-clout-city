"use client";

import { useEffect, useState } from "react";
import type { ShopItem } from "@/lib/city";
import { GARMENT } from "../avatar/garments";
import { formatCash } from "@/lib/economy";
import type { Gain } from "@/lib/cityState";

/** Effect chips for an action row (C37): price, ⚡ Energy, 🔥 clout, 🙂 Mood, 💪 Confidence. */
export function EffectChips({
  price, pay, energy, clout, mood, confidence, seconds,
}: { price?: number; pay?: number; energy?: number; clout?: number | null; mood?: number; confidence?: number; seconds?: number }) {
  return (
    <span className="fx-row">
      {!!seconds && <span className="fx fx-time">⏱ {seconds}s</span>}
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
    // Owner, Oct 14: long enough to read (about 4.5 s; the fade starts at 4 s, see .gain-toast).
    const t = setTimeout(onDone, 4500);
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
/**
 * An item's tile. Clothes draw their own garment shape in their own color, so two jackets never
 * share one emoji (#31); everything else uses its emoji.
 */
export function IconTile({ emoji, size = 52, item }: { emoji: string; size?: number; item?: ShopItem }) {
  const kind = item?.wear?.kind as keyof typeof GARMENT | undefined;
  return (
    <span className="icon-tile" style={{ width: size, height: size, fontSize: size * 0.5 }} aria-hidden="true">
      {kind && GARMENT[kind] ? (
        <svg viewBox="0 0 60 56" width={size * 0.7} height={size * 0.66} fill={item!.wear!.color} stroke="rgba(0,0,0,.25)" strokeWidth="1">{GARMENT[kind]}</svg>
      ) : emoji}
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

/**
 * #11 (owner, Oct 14): an action runs on a short timer before its rewards land: a ring that fills,
 * what you're doing, and the seconds left. Shown over everything; rewards come when it ends.
 */
export function ActionTimer({ doing }: { doing: { emoji: string; label: string; seconds: number; key: number } | null }) {
  const [t, setT] = useState(0);
  useEffect(() => {
    if (!doing) return;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / (doing.seconds * 1000));
      setT(k);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    setT(0);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [doing]);
  if (!doing) return null;
  const left = Math.max(0, Math.ceil(doing.seconds * (1 - t)));
  const r = 22;
  const c = 2 * Math.PI * r;
  return (
    <div className="action-timer" role="status" aria-live="polite" aria-label={`${doing.label}, ${left} seconds left`}>
      <span className="action-timer-ring">
        <svg viewBox="0 0 52 52" aria-hidden="true">
          <circle cx="26" cy="26" r={r} className="track" />
          <circle cx="26" cy="26" r={r} className="fill" strokeDasharray={c} strokeDashoffset={c * (1 - t)} />
        </svg>
        <span className="action-timer-emoji">{doing.emoji}</span>
      </span>
      <span className="action-timer-text">
        <b>{doing.label}…</b>
        <small>{left > 0 ? `${left}s left` : "Done"}</small>
      </span>
    </div>
  );
}

/** Clout Couture (migration 0103): the small crown by a Clout Crown owner's name, on the leaderboard and in chat. */
export function CrownMark() {
  return <span className="crown-mark" role="img" aria-label="Wears the Clout Crown" title="Wears the Clout Crown">👑</span>;
}
