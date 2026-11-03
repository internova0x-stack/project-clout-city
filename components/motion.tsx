"use client";

// The motion kit (owner, Nov 3: "go with your recommendations"; the Motion Lab artifact): small pieces every screen
// reuses instead of animating screens one at a time. Only transforms and opacity move, so cheap phones keep up, and
// players with "reduce motion" on get the end state at once.
//   * useCountUp: a number that counts to its new value instead of jumping.
//   * flyTo: coins fly from where the player last tapped to a HUD pill (RewardFly in GameChrome uses it).
//   * sparks: a small burst at a point (friendship hearts, streak dots).
//   * lastTap: where the player last touched the screen, the natural origin of a reward.

import { useEffect, useRef, useState } from "react";

export const reducedMotion = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

let tap: { x: number; y: number; at: number } | null = null;
let listening = false;
function listen() {
  if (listening || typeof window === "undefined") return;
  listening = true;
  window.addEventListener("pointerdown", (e) => { tap = { x: e.clientX, y: e.clientY, at: Date.now() }; }, { capture: true, passive: true });
}

/** Where the player last tapped in the last few seconds (a reward's button), else the middle of the screen. */
export function lastTap(withinMs = 6000): { x: number; y: number } {
  listen();
  if (tap && Date.now() - tap.at < withinMs) return { x: tap.x, y: tap.y };
  return { x: window.innerWidth / 2, y: window.innerHeight * 0.6 };
}

/** A number that counts from its last value to the new one (ease-out), only upward; drops and the first value jump. */
export function useCountUp(value: number | undefined, ms = 650, delay = 0): number | undefined {
  const [shown, setShown] = useState(value);
  const last = useRef(value);
  useEffect(() => {
    listen();
    const from = last.current;
    last.current = value;
    if (value === undefined || from === undefined || value <= from || reducedMotion()) { setShown(value); return; }
    let raf = 0;
    const t0 = performance.now() + delay;
    const step = (t: number) => {
      const k = Math.max(0, Math.min(1, (t - t0) / ms));
      const e = 1 - Math.pow(1 - k, 3);
      setShown(Math.round(from + (value - from) * e));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, ms, delay]);
  return shown;
}

const layer = () => {
  let el = document.getElementById("motion-layer");
  if (!el) {
    el = document.createElement("div");
    el.id = "motion-layer";
    el.setAttribute("aria-hidden", "true");
    document.body.appendChild(el);
  }
  return el;
};

/** Coins fly from `from` to the middle of `target`, then `onLand` (once, as the last one lands). */
export function flyTo(target: Element, opts: { from?: { x: number; y: number }; count: number; kind: "cash" | "clout"; label?: string; onLand?: () => void }) {
  if (reducedMotion() || typeof document === "undefined") { opts.onLand?.(); return; }
  const host = layer();
  const from = opts.from ?? lastTap();
  const tr = target.getBoundingClientRect();
  const x1 = tr.left + tr.width / 2 - 10, y1 = tr.top + tr.height / 2 - 10;
  if (opts.label) {
    const f = document.createElement("div");
    f.className = `motion-floater ${opts.kind}`;
    f.textContent = opts.label;
    f.style.left = `${from.x}px`;
    f.style.top = `${from.y - 18}px`;
    host.appendChild(f);
    f.animate([
      { transform: "translate(-50%,8px) scale(.6)", opacity: 0 },
      { transform: "translate(-50%,-14px) scale(1.08)", opacity: 1, offset: 0.3 },
      { transform: "translate(-50%,-44px) scale(1)", opacity: 0 },
    ], { duration: 1100, easing: "ease-out" }).onfinish = () => f.remove();
  }
  let landed = 0;
  for (let i = 0; i < opts.count; i++) {
    const c = document.createElement("div");
    c.className = `motion-coin ${opts.kind}`;
    host.appendChild(c);
    const x0 = from.x - 10 + (Math.random() - 0.5) * 70, y0 = from.y - 10 + (Math.random() - 0.5) * 20;
    const mx = (x0 + x1) / 2 + (Math.random() - 0.5) * 90, my = Math.min(y0, y1) - 30 - Math.random() * 50;
    const a = c.animate([
      { transform: `translate(${x0}px,${y0}px) scale(.3)`, opacity: 0 },
      { transform: `translate(${x0}px,${y0 - 26}px) scale(1)`, opacity: 1, offset: 0.18 },
      { transform: `translate(${mx}px,${my}px) scale(.9)`, offset: 0.6 },
      { transform: `translate(${x1}px,${y1}px) scale(.5)`, opacity: 0.9 },
    ], { duration: 820 + i * 30, delay: 120 + i * 50, easing: "cubic-bezier(.5,0,.3,1)", fill: "forwards" });
    a.onfinish = () => {
      c.remove();
      bump(target);
      if (++landed === opts.count) opts.onLand?.();
    };
  }
}

/** The shared "pop": a quick overshoot on any element. */
export function bump(el: Element | null | undefined) {
  if (!el || reducedMotion()) return;
  (el as HTMLElement).animate?.([{ transform: "scale(1)" }, { transform: "scale(1.16)", offset: 0.4 }, { transform: "scale(1)" }], { duration: 320, easing: "cubic-bezier(.3,1.6,.5,1)" });
}

const SPARK_COLORS = ["#FF2E88", "#FFC21A", "#FF6A3D", "#40B589"];

/** A small burst of sparks from the middle of `at`. */
export function sparks(at: Element | null | undefined, n = 12, spread = 50) {
  if (!at || reducedMotion() || typeof document === "undefined") return;
  const host = layer();
  const r = at.getBoundingClientRect();
  const x = r.left + r.width / 2, y = r.top + r.height / 2;
  for (let i = 0; i < n; i++) {
    const s = document.createElement("div");
    s.className = "motion-spark";
    s.style.background = SPARK_COLORS[i % SPARK_COLORS.length];
    s.style.left = `${x}px`;
    s.style.top = `${y}px`;
    host.appendChild(s);
    const ang = Math.random() * Math.PI * 2, d = spread * (0.6 + Math.random() * 0.8);
    s.animate([
      { transform: "translate(-50%,-50%) rotate(0)", opacity: 1 },
      { transform: `translate(calc(-50% + ${Math.cos(ang) * d}px), calc(-50% + ${Math.sin(ang) * d + 16}px)) rotate(${Math.random() * 360}deg)`, opacity: 0 },
    ], { duration: 650 + Math.random() * 300, easing: "cubic-bezier(.2,.8,.4,1)" }).onfinish = () => s.remove();
  }
}

/** How many coins a reward is worth on screen: more for more, never a swarm. */
export const coinsFor = (amount: number, kind: "cash" | "clout") =>
  Math.max(3, Math.min(kind === "cash" ? 10 : 7, Math.round(Math.log10(Math.max(1, amount)) * (kind === "cash" ? 3 : 2.6))));
