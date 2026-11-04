"use client";

import { useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/sfx";
import { guardTaps } from "@/lib/tapGuard";
import { Confetti } from "./Confetti";
import { useCountUp } from "./motion";
import type { Celebration } from "./Celebrate";

// Results screens (owner, Nov 4: "an end of week (careers), end of campaign, results treatment"; the Results Screens artifact:
// "trim, simplify, and space out", "keep the text under the money amount and the performance progress in both the
// success/fail treatments", the You keep pills on every one). One card for a win and a near miss alike: the colour stays
// on a miss (mobile games frame a loss as "so close", never grey), with how close you came and what you keep.
//   art band: the medal (an emoji or a face), a stamp (PROMOTED, WARNING…), the tag, the title, the amount counting up
//             from zero with its unit, and the week in one line
//   then: a bar against the line you needed, the You keep pills and one button.
// Shown by CelebrationHost like any takeover (`celebrate({ rung: 3, result: {...} })`), one at a time.

export interface ResultSpec {
  tone: "win" | "warn" | "lose";
  /** An image (a face) instead of the emoji medal. */
  face?: string;
  stamp?: { text: string; tone: "good" | "warn" | "bad" };
  /** The hero number, counted up from 0 ("C$" before it unless `plain`). */
  amount?: number;
  plain?: boolean;
  /** A word instead of a number (an exam grade: "B+"). */
  big?: string;
  unit?: string;
  /** The week (or the night) in one line, under the amount. */
  story?: string;
  meter?: { label: string; have: number; need: number; max?: number; say?: string };
  keep?: string[];
}

export function ResultCard({ c, onClose }: { c: Celebration & { result: ResultSpec }; onClose: () => void }) {
  const r = c.result;
  const good = r.tone === "win";
  const done = useRef(false);
  const [to, setTo] = useState(0);
  const shown = useCountUp(to, 900, 0) ?? 0;
  const [fill, setFill] = useState(0);
  useEffect(() => {
    // A win plays the fanfare; a near miss only the stamp's soft thud, never a sad trombone.
    if (good) sfx.fanfare(c.twist ?? (r.stamp ? "stamp" : "register"));
    else sfx.tick();
    const a = setTimeout(() => setTo(r.amount ?? 0), 700);
    const b = setTimeout(() => setFill(r.meter ? r.meter.have : 0), 1100);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [good, c.twist, r.amount, r.meter, r.stamp]);
  const close = () => { if (done.current) return; done.current = true; guardTaps(); onClose(); };
  const go = () => { if (done.current) return; done.current = true; guardTaps(); onClose(); c.onCta?.(); };
  const max = r.meter ? Math.max(r.meter.max ?? 100, r.meter.have, r.meter.need) : 100;
  const pct = (n: number) => `${Math.max(0, Math.min(100, (n / max) * 100))}%`;
  const keep = r.keep ?? [];
  return (
    <div className="modal-wrap cel-wrap" role="dialog" aria-modal="true" aria-label={`${c.tag}: ${c.title}`}>
      {good && <Confetti size="small" origin="top" />}
      <div className="cel-veil" onClick={close} />
      <div className="modal-card cel-card res-card">
        <div className={`res-art ${r.tone}`}>
          {good && <span className="cel-rays" aria-hidden="true" />}
          {r.stamp && <span className={`res-stamp ${r.stamp.tone}`}>{r.stamp.text}</span>}
          {r.face
            // eslint-disable-next-line @next/next/no-img-element
            ? <img className="res-face" src={r.face} alt="" />
            : <span className={`cel-medal res-medal${good ? "" : " calm"}`} aria-hidden="true">{c.emoji}</span>}
          <span className="overline res-tag">{c.tag}</span>
          <span className="res-title">{c.title}</span>
          {r.big !== undefined
            ? <span className={`res-num${good ? " good" : ""}`}>{r.big}</span>
            : r.amount !== undefined && <span className={`res-num${good ? " good" : ""}`}>{r.plain ? "" : "C$"}{shown.toLocaleString("en-US")}</span>}
          {r.unit && <span className="res-unit">{r.unit}</span>}
          {r.story && <p className="res-story">{r.story}</p>}
        </div>
        <div className="res-body">
          {r.meter && (
            <div className={`res-meter${good ? " good" : ""}`}>
              <span className="res-meter-top"><span>{r.meter.label}</span><b>{r.meter.have} / {r.meter.need}</b></span>
              <span className="res-track">
                <span className="res-fill" style={{ width: pct(fill) }} />
                <span className="res-goal" style={{ left: pct(r.meter.need) }} data-label={r.meter.need} />
              </span>
              {r.meter.say && <span className="res-say">{r.meter.say}</span>}
            </div>
          )}
          {keep.length > 0 && (
            <span className="res-keep">
              <span className="overline">You keep</span>
              {keep.map((k, i) => <span key={k} className="res-k" style={{ animationDelay: `${1.5 + i * 0.12}s` }}>✓ {k}</span>)}
            </span>
          )}
          <button className="btn btn-taxi res-cta" onClick={go}>{c.cta ?? "Nice"}</button>
        </div>
      </div>
    </div>
  );
}
