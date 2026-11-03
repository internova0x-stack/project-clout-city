"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LOLA_PORTRAIT } from "@/lib/cast";
import { sfx, type SfxTwist } from "@/lib/sfx";
import { guardTaps } from "@/lib/tapGuard";
import { Confetti } from "./Confetti";

// Celebrations (owner, Nov 3: "yes build with the reward sounds"; the Achievement Screens artifact, round 3: "Use our design
// system… Use our font as well"). One ladder for every win, so the same kind of win always gets the same size:
//   rung 2  the banner: the HUD's white glass, a small burst of confetti, the jingle; it goes by itself (play never stops)
//   rung 3  the takeover: the light sheet card with an art band (stage, story or people), a white medal with the emoji and a
//           number, the heading, reward chips, Lola's line, Share and the red button; the fanfare (the music steps back)
//   rung 4  the legend: the same card with the number as the hero in the streak card's leaning Barlow; the anthem
// Any feature calls `celebrate({...})`; <CelebrationHost/> in GameShell shows one takeover at a time (more wait their turn),
// none while `hold` (a choice card, a trip, the first session). Rung 1 (the tick and coins) is the motion kit, not this.

export type CelebrationArt = "stage" | "story" | "people";
export interface Celebration {
  rung: 2 | 3 | 4;
  emoji: string;
  /** The small label: "Goal done", "Promoted", "New rank". */
  tag: string;
  title: string;
  line?: string;
  /** Rung 3: the number badge on the medal ("3", "12th"). Rung 4: the hero number ("365") and its unit. */
  num?: string;
  unit?: string;
  art?: CelebrationArt;
  rewards?: { tone?: "clout" | "cash"; text: string }[];
  /** Lola's one line (her voice: docs/culture/VOICE.md). */
  lola?: string;
  cta?: string;
  onCta?: () => void;
  /** What Share copies or sends. */
  share?: string;
  twist?: SfxTwist;
}

const EVENT = "cc-celebrate";
/** Shows a celebration (queued behind any already on screen). */
export function celebrate(c: Celebration) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<Celebration>(EVENT, { detail: c }));
}

const BANNER_MS = 3400;

export function CelebrationHost({ hold = false }: { hold?: boolean }) {
  const [banners, setBanners] = useState<Celebration[]>([]);
  const [cards, setCards] = useState<Celebration[]>([]);
  useEffect(() => {
    const on = (e: Event) => {
      const c = (e as CustomEvent<Celebration>).detail;
      if (c.rung === 2) setBanners((q) => [...q, c]);
      else setCards((q) => [...q, c]);
    };
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  // A card waiting: banners hold back too, so two things never fight for the top of the screen.
  const card = !hold ? cards[0] ?? null : null;
  const banner = !hold && !card ? banners[0] ?? null : null;
  const nextBanner = useCallback(() => setBanners((q) => q.slice(1)), []);
  const closeCard = useCallback(() => setCards((q) => q.slice(1)), []);
  return (
    <>
      {banner && <CelebrationBanner key={`${banner.title}-${banners.length}`} c={banner} onDone={nextBanner} />}
      {card && <CelebrationCard key={`${card.title}-${cards.length}`} c={card} onClose={closeCard} />}
    </>
  );
}

function Chips({ list }: { list?: Celebration["rewards"] }) {
  if (!list?.length) return null;
  return <span className="cel-chips">{list.map((r, i) => <span key={i} className={`fx${r.tone ? ` fx-${r.tone}` : ""}`} style={{ animationDelay: `${420 + i * 90}ms` }}>{r.text}</span>)}</span>;
}

function CelebrationBanner({ c, onDone }: { c: Celebration; onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    sfx.jingle();
    const a = setTimeout(() => setLeaving(true), BANNER_MS);
    const b = setTimeout(onDone, BANNER_MS + 380);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [onDone]);
  const tap = () => { guardTaps(); c.onCta?.(); setLeaving(true); setTimeout(onDone, 300); };
  return (
    <button className={`cel-banner${leaving ? " leaving" : ""}`} onClick={tap} aria-live="polite">
      <Confetti size="small" origin="top" />
      <span className="cel-banner-ico" aria-hidden="true">{c.emoji}</span>
      <span className="cel-banner-txt">
        <span className="overline">{c.tag}</span>
        <span className="cel-banner-title">{c.title}</span>
        <Chips list={c.rewards} />
      </span>
    </button>
  );
}

function CelebrationCard({ c, onClose }: { c: Celebration; onClose: () => void }) {
  const legend = c.rung === 4;
  const done = useRef(false);
  useEffect(() => { if (legend) sfx.anthem(); else sfx.fanfare(c.twist); }, [legend, c.twist]);
  const close = () => { if (done.current) return; done.current = true; guardTaps(); onClose(); };
  const go = () => { if (done.current) return; done.current = true; guardTaps(); onClose(); c.onCta?.(); };
  const share = async () => {
    const text = c.share ?? `${c.title} in Clout City.`;
    try { if (navigator.share) await navigator.share({ text }); else await navigator.clipboard.writeText(text); } catch { /* cancelled */ }
  };
  return (
    <div className="modal-wrap cel-wrap" role="dialog" aria-modal="true" aria-label={`${c.tag}: ${c.title}`}>
      <Confetti size={legend ? "big" : "small"} origin={legend ? "sides" : "top"} />
      <div className="cel-veil" onClick={close} />
      <div className={`modal-card cel-card${legend ? " legend" : ""}`}>
        <div className={`cel-art ${c.art ?? "stage"}`}>
          <span className="cel-rays" aria-hidden="true" />
          {legend ? (
            <>
              {c.unit && c.num && <span className="tag tag-pro cel-rare">{c.tag}</span>}
              <span className="cel-big"><span className="cel-big-n">{c.num ?? c.emoji}</span>{c.unit && <small>{c.unit}</small>}</span>
            </>
          ) : (
            <span className="cel-medal" aria-hidden="true">{c.emoji}{c.num && <span className="cel-num">{c.num}</span>}</span>
          )}
        </div>
        <div className="cel-body">
          <span className="tag tag-event cel-rise" style={{ animationDelay: legend ? "1.3s" : ".56s" }}>{legend ? `${c.emoji} Legend` : c.tag}</span>
          <span className="display-lg cel-rise" style={{ animationDelay: legend ? "1.4s" : ".65s" }}>{c.title}</span>
          {c.line && <p className="cel-line cel-rise" style={{ animationDelay: legend ? "1.5s" : ".74s" }}>{c.line}</p>}
          <Chips list={c.rewards} />
          {c.lola && (
            <span className="cel-lola cel-rise" style={{ animationDelay: "1.25s" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={LOLA_PORTRAIT} alt="Lola Lowdown" width={36} height={36} />
              <span>{c.lola}</span>
            </span>
          )}
          <span className="cel-acts cel-rise" style={{ animationDelay: legend ? "2s" : "1.4s" }}>
            <button className="btn btn-secondary" onClick={() => void share()}>Share</button>
            <button className="btn btn-taxi" onClick={go}>{c.cta ?? "Let's go"}</button>
          </span>
        </div>
      </div>
    </div>
  );
}
