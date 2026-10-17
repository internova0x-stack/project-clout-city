"use client";

import { useEffect, useState } from "react";
import AvatarHead from "../avatar/AvatarHead";
import { LOLA_LOOK } from "@/lib/cast";

// The welcome screen and the tutorial tooltips (Lola's hello, then five) (Clarifications section 1;
// C15). One tooltip at a time, the rest of the screen dimmed, the target ringed.

// Owner, Oct 17: Lola Lowdown gives the tour, in her voice (the spicy urban gossip blogger).
export const TOUR = [
  // No target: Lola says hello first (owner, Oct 17), with the whole screen dimmed.
  { target: "welcome", text: "Hey there, welcome to NYC: the city that never sleeps, and never stops talking. I'm Lola Lowdown. I know everyone worth knowing, and now I know you. Let me give you a quick tour." },
  { target: "clout", text: "That flame is your clout: how much this city cares that you exist. Right now? Not a lot, babe. We'll fix that." },
  { target: "money", text: "Your coins, honey. Rent, fits and the occasional \"tip\" for a bouncer all come out of here. The diamond is your net worth: everything you own that you can casually drop in conversation." },
  { target: "map", text: "This is the map. You're starting in Queens, and the rest of the city stays locked till you're interesting enough. I've seen worse glow-ups. Barely." },
  { target: "phone", text: "Your phone. Updates, gossip and the fam asking if you've \"made it yet.\" My tea comes through here too, so keep it charged." },
  { target: "events", text: "Breaking news: somebody invited YOU to a party. I'm as shocked as you are. Tap it and RSVP before they change their mind." },
] as const;

export function WelcomeModal({ onStart, onSkip }: { onStart: () => void; onSkip: () => void }) {
  return (
    <div className="modal-wrap" role="dialog" aria-modal="true" aria-label="Welcome to New York">
      <div className="scrim" />
      <div className="modal-card reveal-card" style={{ textAlign: "left" }}>
        <p className="overline" style={{ color: "rgba(255,246,224,.6)", margin: 0 }}>Welcome to New York</p>
        <p className="display-md" style={{ margin: "8px 0 10px" }}>Population: 8 million. People who matter: not you. Yet.</p>
        <p className="body" style={{ margin: 0, color: "rgba(255,246,224,.85)" }}>
          You&apos;re here to become the main character. Here&apos;s a quick tour before the city eats you alive.
        </p>
        <button className="btn btn-taxi" style={{ marginTop: 20 }} onClick={onStart}>Let&apos;s go</button>
        <button className="btn btn-ghost" style={{ color: "rgba(255,246,224,.7)" }} onClick={onSkip}>Skip tour (bold of you)</button>
      </div>
    </div>
  );
}

interface Rect { x: number; y: number; w: number; h: number }

/** The screen the game is drawn in: the phone frame on desktop, the window on phones. */
function screenBox() {
  const d = document.querySelector<HTMLElement>(".device");
  const r = d?.getBoundingClientRect();
  return r && r.width < window.innerWidth ? { left: r.left, top: r.top, width: r.width, height: r.height } : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
}

export function TourTooltip({ index, onNext }: { index: number; onNext: () => void }) {
  const step = TOUR[index];
  const [rect, setRect] = useState<Rect | null>(null);

  useEffect(() => {
    const measure = () => {
      const els = [...document.querySelectorAll<HTMLElement>(`[data-tour="${step.target}"]`)];
      if (!els.length) return setRect(null);
      const rs = els.map((e) => e.getBoundingClientRect());
      const box = screenBox();
      // Keep the ring inside the screen even for targets touching the top edge.
      const x = Math.max(2, Math.min(...rs.map((r) => r.left)) - box.left - 6);
      const y = Math.max(2, Math.min(...rs.map((r) => r.top)) - box.top - 6);
      setRect({ x, y, w: Math.max(...rs.map((r) => r.right)) - box.left - x + 6, h: Math.max(...rs.map((r) => r.bottom)) - box.top - y + 6 });
    };
    // Measure now, after the layout settles, and whenever the visible screen changes (#41).
    measure();
    const raf = requestAnimationFrame(measure);
    const late = setTimeout(measure, 350);
    const vv = window.visualViewport;
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    vv?.addEventListener("resize", measure);
    vv?.addEventListener("scroll", measure);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(late);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
      vv?.removeEventListener("resize", measure);
      vv?.removeEventListener("scroll", measure);
    };
  }, [step.target]);

  const last = index === TOUR.length - 1;
  return (
    <div className="tour" role="dialog" aria-modal="true" aria-label={`Tour, step ${index + 1} of ${TOUR.length}`}>
      {/* The hole: everything but the target is dimmed; the last step only advances by tapping it. */}
      {rect && <div className={`tour-hole${last ? " pulse" : ""}`} style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }} />}
      {!rect && <div className="tour-dim" />}
      {/* Blockers around the hole; on the last step the hole itself stays tappable. */}
      {rect && (
        <>
          <div className="tour-block" style={{ left: 0, top: 0, right: 0, height: rect.y }} />
          <div className="tour-block" style={{ left: 0, top: rect.y + rect.h, right: 0, bottom: 0 }} />
          <div className="tour-block" style={{ left: 0, top: rect.y, width: rect.x, height: rect.h }} />
          <div className="tour-block" style={{ left: rect.x + rect.w, top: rect.y, right: 0, height: rect.h }} />
          {!last && <div className="tour-block" style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }} />}
        </>
      )}
      {/* Lola in the bottom-right corner, her line in a chat bubble (owner, Oct 17). */}
      <div className="lola-tip" key={index}>
        <div className="lola-tip-bubble">
          <p className="lola-tip-who">Lola Lowdown <span>· {index + 1} of {TOUR.length}</span></p>
          <p className="lola-tip-text">{step.text}</p>
          {!last && <button className="btn btn-taxi lola-tip-next" onClick={onNext}>Next</button>}
          {last && <p className="lola-tip-hint">Tap the glowing button 👆</p>}
        </div>
        <div className="lola-tip-head" aria-hidden="true">
          <AvatarHead look={LOLA_LOOK} size={64} />
          <span className="lola-tip-kiss">💋</span>
        </div>
      </div>
    </div>
  );
}
