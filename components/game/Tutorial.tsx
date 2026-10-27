"use client";

import { useEffect, useState } from "react";
import { LOLA_PORTRAIT, MAYOR_PAPA_DANI } from "@/lib/cast";

// The tutorial tooltips: Lola's hello (with Skip), then five (owner, Oct 17: no separate welcome pop-up) (Clarifications section 1;
// C15). One tooltip at a time, the rest of the screen dimmed, the target ringed.

// Owner, Oct 17: Lola Lowdown gives the tour (Mayor Papa-Dani says hello in one step, owner Oct 22), in her voice (owner, Oct 26: mostly TMZ, a
// little Shade Room; at most one slang term from content/culture/slang.json a line, tests/culture.test.ts checks).
export const TOUR = [
  // No target: Lola says hello first (owner, Oct 17), with the whole screen dimmed.
  { target: "welcome", text: "BREAKING 🚨 A new face just landed in New York, and sources tell me it's you. I'm Lola Lowdown 💋 I know everyone worth knowing, and now I know you. Let me show you around ✨" },
  { target: "clout", text: "That flame 🔥 is your clout: how much New York cares that you exist. Current status? Unconfirmed, babe. We're working on it 💅" },
  { target: "money", text: "Your money, sweetie 💸 Rent, fits and the occasional \"tip\" for a bouncer all come out of here, and rent comes around fast. The diamond 💎 is your net worth: everything you own, on the record." },
  { target: "map", text: "This is the map 🗺️ You're starting in Queens. The rest of New York stays locked 🔒 until you're interesting enough. Insiders say it won't take long 👀" },
  { target: "phone", text: "Your phone 📱 Updates, invites and my tea 🍵 land here first. Chile, keep it charged. You'll want to see what's coming." },
  // Owner, Oct 22: the Mayor welcomes every newcomer and points at his app (the Phone's Mayor app, migration 0105).
  { target: "phone", who: "mayor", text: "Welcome to Queens, neighbor! I'm Mayor Papa-Dani 🏛️ Something broken? A big idea? Need to kvetch about the rent? Write me in the Mayor app on your phone. I read every letter, and my team gets on it fast 🎉" },
  { target: "events", text: "Developing story 🚨 Two tickets to celebrity influencer Peyton Pastel's party just vanished from a coat check 🥂 Sources say they're in your pocket. Tap it before security does the math 👀" },
] as const;

interface Rect { x: number; y: number; w: number; h: number }

/** The screen the game is drawn in: the phone frame on desktop, the window on phones. */
function screenBox() {
  const d = document.querySelector<HTMLElement>(".device");
  const r = d?.getBoundingClientRect();
  return r && r.width < window.innerWidth ? { left: r.left, top: r.top, width: r.width, height: r.height } : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
}

/** Where a [data-tour] target sits on screen (with a margin), kept up to date as the screen changes. */
function useTargetRect(target: string): Rect | null {
  const [rect, setRect] = useState<Rect | null>(null);
  useEffect(() => {
    const measure = () => {
      const els = [...document.querySelectorAll<HTMLElement>(`[data-tour="${target}"]`)];
      if (!els.length) return setRect(null);
      const rs = els.map((e) => e.getBoundingClientRect());
      const box = screenBox();
      // Keep the ring inside the screen even for targets touching the top edge.
      const x = Math.max(2, Math.min(...rs.map((r) => r.left)) - box.left - 6);
      const y = Math.max(2, Math.min(...rs.map((r) => r.top)) - box.top - 6);
      // ...and its right and bottom edges too (the side column touches the right edge).
      const right = Math.min(box.width - 6, Math.max(...rs.map((r) => r.right)) - box.left + 6);
      const bottom = Math.min(box.height - 6, Math.max(...rs.map((r) => r.bottom)) - box.top + 6);
      setRect({ x, y, w: right - x, h: bottom - y });
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
  }, [target]);
  return rect;
}

export function TourTooltip({ index, onNext, onSkip }: { index: number; onNext: () => void; onSkip?: () => void }) {
  const step = TOUR[index];
  const rect = useTargetRect(step.target);
  const mayor = "who" in step && step.who === "mayor";

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
      <div className={`lola-tip${mayor ? " mayor" : ""}`} key={index}>
        <div className="lola-tip-bubble">
          <p className="lola-tip-who">{mayor ? MAYOR_PAPA_DANI.name : "Lola Lowdown"} <span>· {index + 1} of {TOUR.length}</span></p>
          <p className="lola-tip-text">{step.text}</p>
          {!last && <button className="btn btn-taxi lola-tip-next" onClick={onNext}>{index === 0 ? "Let's go" : "Next"}</button>}
          {index === 0 && onSkip && <button className="lola-tip-skip" onClick={onSkip}>Skip tour (bold of you)</button>}
          {last && <p className="lola-tip-hint">Tap the glowing button 👆</p>}
        </div>
        {mayor ? (
          <div className="lola-tip-head mayor-tip-head" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={MAYOR_PAPA_DANI.portrait} alt="" width={64} height={64} />
          </div>
        ) : (
          <div className="lola-tip-head" aria-hidden="true">
{/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={LOLA_PORTRAIT} alt="" width={64} height={64} />
            <span className="lola-tip-kiss">💋</span>
          </div>
        )}
      </div>
    </div>
  );
}

/** Owner, Oct 17: new players didn't know what to do. Lola's nudge toward the daily tasks (lib/city.ts dailyTasks). */
export const DAILY_HINT_TEXT = "Psst 👀 these are your daily tasks: five little errands that each pay, plus a bonus if you clear all five 💸 A new list drops every day. Check in daily, babe 💅";

/**
 * Shown once, 30 seconds after the first session ends if the daily tasks haven't been opened. The task counter in
 * the HUD is ringed and tappable (it opens the tasks), Lola's bubble just above it; "Got it" or a tap
 * anywhere else dismisses it.
 */
export function DailyTasksHint({ onOpen, onDismiss }: { onOpen: () => void; onDismiss: () => void }) {
  const rect = useTargetRect("tasks");
  // The counter up top (owner, Oct 23): Lola sits at the bottom; a target low on the screen puts her just above it.
  const above = rect && rect.y > screenBox().height / 2 ? { bottom: Math.max(16, screenBox().height - rect.y + 10) } : undefined;
  return (
    <div className="tour" role="dialog" aria-label="Your daily tasks">
      {rect ? (
        <>
          <div className="tour-hole pulse" style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }} />
          <div className="tour-block" onClick={onDismiss} style={{ left: 0, top: 0, right: 0, height: rect.y }} />
          <div className="tour-block" onClick={onDismiss} style={{ left: 0, top: rect.y + rect.h, right: 0, bottom: 0 }} />
          <div className="tour-block" onClick={onDismiss} style={{ left: 0, top: rect.y, width: rect.x, height: rect.h }} />
          <div className="tour-block" onClick={onDismiss} style={{ left: rect.x + rect.w, top: rect.y, right: 0, height: rect.h }} />
          <button className="tour-block daily-hint-target" onClick={onOpen} aria-label="Open your daily tasks" style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }} />
        </>
      ) : <div className="tour-dim" onClick={onDismiss} />}
      <div className="lola-tip daily-hint" style={above}>
        <div className="lola-tip-bubble">
          <p className="lola-tip-who">Lola Lowdown</p>
          <p className="lola-tip-text">{DAILY_HINT_TEXT}</p>
          <button className="btn btn-taxi lola-tip-next" onClick={onOpen}>Show me</button>
          <button className="lola-tip-skip" onClick={onDismiss}>Got it</button>
        </div>
        <div className="lola-tip-head" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOLA_PORTRAIT} alt="" width={64} height={64} />
          <span className="lola-tip-kiss">💋</span>
        </div>
      </div>
    </div>
  );
}
