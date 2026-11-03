"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// A burst of confetti over the screen (owner, Nov 3: streak milestones). One canvas, about two seconds, then gone; nothing
// for players who ask for reduced motion. Colors are the design system's taxi, neon, green and blue.

const COLORS = ["#FFC21A", "#FF2E88", "#40B589", "#2F7BEA", "#FF6A3D", "#9FDCFF"];

/** `origin` (owner, Nov 3, celebrations): "center" bursts from the middle (streaks), "top" puffs from under the HUD (the
 * banner), "sides" fires up from both bottom corners (the legend). */
export function Confetti({ size = "small", origin = "center", onDone }: { size?: "small" | "big"; origin?: "center" | "top" | "sides"; onDone?: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  // Drawn on document.body: a card's transform and overflow would clip it otherwise.
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => setHost(document.body), []);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { onDone?.(); return; }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = window.innerWidth, h = window.innerHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.scale(dpr, dpr);
    const n = origin === "top" ? 46 : size === "big" ? 220 : 110;
    const bursts = size === "big" ? [w * 0.2, w * 0.5, w * 0.8] : [w * 0.5];
    const bits = Array.from({ length: n }, (_, i) => {
      let x0 = bursts[i % bursts.length], y0 = h * 0.42, a = -Math.PI / 2 + (Math.random() - 0.5) * 1.6, v = 7 + Math.random() * 9;
      if (origin === "top") { y0 = Math.min(150, h * 0.2); a = -Math.PI / 2 + (Math.random() - 0.5) * 2.6; v = 3 + Math.random() * 5; }
      if (origin === "sides") { const left = i % 2 === 0; x0 = left ? -8 : w + 8; y0 = h * 0.82; a = left ? -Math.PI / 3 - Math.random() * 0.5 : -Math.PI * 2 / 3 + Math.random() * 0.5; v = 13 + Math.random() * 9; }
      return { x: x0, y: y0, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.4,
        w: 6 + Math.random() * 6, h: 3 + Math.random() * 4, c: COLORS[i % COLORS.length], round: i % 4 === 0 };
    });
    const t0 = performance.now(), life = size === "big" ? 2600 : 2000;
    let raf = 0, last = t0;
    // Time-based, so a slow phone sees the same burst, only in fewer frames.
    const frame = (now: number) => {
      const t = now - t0, k = Math.min(4, (now - last) / 16.7);
      last = now;
      ctx.clearRect(0, 0, w, h);
      ctx.globalAlpha = Math.max(0, 1 - Math.max(0, t - life * 0.6) / (life * 0.4));
      for (const b of bits) {
        b.vy += 0.28 * k; b.vx *= 0.99 ** k; b.vy *= 0.99 ** k; b.x += b.vx * k; b.y += b.vy * k; b.r += b.vr * k;
        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.r); ctx.fillStyle = b.c;
        if (b.round) { ctx.beginPath(); ctx.arc(0, 0, b.h, 0, Math.PI * 2); ctx.fill(); }
        else ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h * Math.abs(Math.cos(b.r * 2)) + 1);
        ctx.restore();
      }
      if (t < life) raf = requestAnimationFrame(frame); else onDone?.();
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host]);
  return host ? createPortal(<canvas ref={ref} className="confetti" aria-hidden="true" />, host) : null;
}
