"use client";

import { useEffect, useState } from "react";
import { CHAPTERS, chapterOpen, chapterSteps, rewardText, stepOpen, type GuideState, type GuideStep } from "@/lib/guide";

// The Guide (migration 0170, lib/guide.ts; owner Nov 20). The pill under "Invite your Crew" names the one recommended step;
// GuideFlow plays it: Lola's tip, the explainer cards, then "Show me": a glow on the real button while the player does it.
// GameShell sees it done (guide_state) and pays it (guide_claim) with a celebration banner. GuideApp is the Phone's Guide app
// (owner, Nov 20: "Create an app for the guide"): every chapter and step, and the way back to a step put off or skipped.

const FACE = { lola: "/cast/lola-lowdown.webp", barksley: "/cast/sir-barksley.webp" } as const;
const WHO = { lola: "Lola says", barksley: "Sir Barksley (via Dmitri)" } as const;

export function GuidePill({ step, onOpen }: { step: GuideStep; onOpen: () => void }) {
  return (
    <button className="pill-glass glass-hud guide-pill" onClick={onOpen} aria-label={`Guide, step ${step.id}: ${step.tip}`}>
      <img src={FACE.lola} alt="" />
      <b>Guide {step.id}</b>
      <span>{step.tip}</span>
    </button>
  );
}

/** The first visible element for a step's targets ("text:Map" = a visible button whose words are exactly "Map"). */
export function findTarget(targets: string[]): HTMLElement | null {
  for (const t of targets) {
    const list: HTMLElement[] = t.startsWith("text:")
      ? [...document.querySelectorAll<HTMLElement>("button")].filter((b) => b.innerText.trim() === t.slice(5))
      : [...document.querySelectorAll<HTMLElement>(t)];
    // Wholly on screen, so the ring never points off the edge (a map pin half past it).
    // A tab you're already on isn't the way there ("tap your bed" at home just shows the hint).
    const el = list.find((e) => { const r = e.getBoundingClientRect(); return e.getAttribute("aria-current") !== "page" && r.width > 4 && r.height > 4 && r.left >= 4 && r.right <= innerWidth - 4 && r.top >= 4 && r.bottom <= innerHeight - 4 && getComputedStyle(e).visibility !== "hidden"; });
    if (el) return el;
  }
  return null;
}

export type GuidePhase = "tip" | "cards" | "show";

export function GuideFlow({ step, phase, onPhase, onClose, onSkip }: {
  step: GuideStep; phase: GuidePhase; onPhase: (p: GuidePhase) => void; onClose: () => void;
  /** Optional steps: "Skip this one" takes it off the pill for good (on this device). */
  onSkip?: () => void;
}) {
  const [card, setCard] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const who = step.who ?? "lola";
  useEffect(() => setCard(0), [step.id, phase]);
  // "Show me": follow the target while it moves (sheets slide, the map pans); it may appear once a screen opens.
  useEffect(() => {
    if (phase !== "show") return;
    const tick = () => setRect(findTarget(step.targets)?.getBoundingClientRect() ?? null);
    tick();
    const id = setInterval(tick, 400);
    return () => clearInterval(id);
  }, [phase, step.targets]);

  if (phase === "tip") {
    return (
      <div className="guide-lola" role="dialog" aria-label={`Guide step ${step.id}`}>
        <img src={FACE[who]} alt="" />
        <div style={{ minWidth: 0 }}>
          <div className="guide-who">{WHO[who]}</div>
          <div className="guide-line">{step.tip}</div>
          <div className="meta" style={{ marginBottom: 10 }}>Step {step.id} · {rewardText(step.reward)}</div>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-taxi guide-btn" onClick={() => onPhase("cards")}>Show me how</button>
            <button className="btn btn-secondary guide-btn" onClick={onClose}>Later</button>
          </div>
          {step.optional && onSkip && <button className="guide-skip" onClick={onSkip}>Not for me: skip this one</button>}
        </div>
      </div>
    );
  }
  if (phase === "cards") {
    const c = step.cards[card];
    const last = card === step.cards.length - 1;
    return (
      <div className="guide-scrim" onClick={onClose}>
        <div className="guide-sheet" role="dialog" aria-label={step.tag} onClick={(e) => e.stopPropagation()}>
          <div className="guide-art" aria-hidden="true">{c.art}</div>
          <div className="overline guide-eyebrow">{step.tag} · {card + 1} of {step.cards.length}</div>
          <h3 className="display-md" style={{ margin: "4px 0 8px" }}>{c.t}</h3>
          <p className="body" style={{ margin: "0 0 14px", color: "var(--text-2)" }}>{c.b}</p>
          <div className="guide-dots" aria-hidden="true">{step.cards.map((_, i) => <i key={i} className={i === card ? "on" : ""} />)}</div>
          <div className="row" style={{ gap: 8, justifyContent: "flex-end" }}>
            {card > 0 && <button className="btn btn-secondary guide-btn" onClick={() => setCard(card - 1)}>Back</button>}
            <button className="btn btn-taxi guide-btn" onClick={() => (last ? onPhase("show") : setCard(card + 1))}>{last ? "Show me" : "Next"}</button>
          </div>
        </div>
      </div>
    );
  }
  // Show me: a ring around the real button (taps go through to it) and Lola's hint beside it.
  const hintTop = rect ? (rect.top > innerHeight / 2 ? Math.max(12, rect.top - 74) : rect.bottom + 14) : innerHeight * 0.32;
  return (
    <>
      {rect && <div className="guide-ring" aria-hidden="true" style={{ left: rect.left - 5, top: rect.top - 5, width: rect.width + 10, height: rect.height + 10 }} />}
      {rect && <div className="guide-finger" aria-hidden="true" style={{ left: rect.left + rect.width / 2 - 8, top: rect.bottom - 8 }}>👆</div>}
      <div className="guide-hint" role="status" style={{ top: hintTop }}>
        <img src={FACE[who]} alt="" />
        <span style={{ flex: 1, minWidth: 0 }}>{step.hint}</span>
        <button className="guide-x" onClick={onClose} aria-label="Close the hint">✕</button>
      </div>
    </>
  );
}

/** The Phone's Guide app: what's next, Starter Week while it runs, then every chapter with its steps. Any open step can be
 *  played from here, a skipped optional one included. */
export function GuideApp({ state, current, onPlay, starter }: {
  state: GuideState; current: GuideStep | null; onPlay: (s: GuideStep) => void;
  starter?: { done: number; total: number; onOpen: () => void };
}) {
  const live = CHAPTERS.filter((c) => c.live);
  const done = live.filter((c) => state.chapters.includes(c.n)).length;
  return (
    <div className="stack-12">
      {current ? (
        <div className="guide-next">
          <img src={FACE[current.who ?? "lola"]} alt="" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="guide-who">Next up · Step {current.id}</div>
            <div className="guide-line">{current.tip}</div>
            <div className="meta" style={{ marginBottom: 10 }}>{rewardText(current.reward)}</div>
            <button className="btn btn-taxi guide-btn" onClick={() => onPlay(current)}>Show me how</button>
          </div>
        </div>
      ) : (
        <p className="meta" style={{ margin: 0 }}>Nothing new right now. More opens as your rank and days go up.</p>
      )}
      <p className="meta" style={{ margin: 0 }}>{done} of {live.length} chapters done.</p>
      {starter && (
        <button className="guide-step" onClick={starter.onOpen}>
          <span className="guide-step-n">🗓️</span>
          <span style={{ flex: 1, minWidth: 0 }}>Starter Week missions<span className="meta" style={{ display: "block" }}>{starter.done} of {starter.total} done</span></span>
        </button>
      )}
      {CHAPTERS.map((c) => {
        const steps = chapterSteps(c.n);
        const open = chapterOpen(c, state);
        const paid = steps.filter((s) => state.paid.includes(s.id)).length;
        return (
          <section key={c.n} className="guide-chapter">
            <div className="row" style={{ gap: 8 }}>
              <span className="title" style={{ flex: 1 }}>{state.chapters.includes(c.n) ? "🏅 " : ""}Chapter {c.n}: {c.title}</span>
              {c.live ? <span className="meta">{paid}/{steps.length}</span> : <span className="tag tag-neutral">Coming soon</span>}
            </div>
            {c.live && !open && <span className="meta">🔒 Opens {c.day ? `on day ${c.day}` : `at Rank ${c.rank}`}.</span>}
            {c.live && open && (
              <ul className="guide-steps">
                {steps.map((s) => {
                  const isPaid = state.paid.includes(s.id);
                  const later = !isPaid && !stepOpen(s, state);
                  const skipped = !isPaid && !!state.skipped?.includes(s.id);
                  return (
                    <li key={s.id}>
                      <button className={`guide-step${s.id === current?.id ? " is-next" : ""}`} onClick={() => onPlay(s)} disabled={isPaid || later}>
                        <span className="guide-step-n">{isPaid ? "✓" : later ? "🔒" : s.id}</span>
                        <span style={{ flex: 1, minWidth: 0 }}>{s.tip}<span className="meta" style={{ display: "block" }}>
                          {later ? (s.opens?.rank ? `Opens at Rank ${s.opens.rank}` : `Opens on day ${s.opens?.day}`) : rewardText(s.reward)}
                          {s.optional && !later ? (skipped ? " · skipped" : " · optional") : ""}
                        </span></span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {c.live && <span className="meta">{c.need ? `Any ${c.need} of these finish it` : "Finish it"}: the &quot;{c.badge}&quot; badge, {rewardText(c.reward)}{c.item ? ` and ${c.item.name}` : ""}.{state.chapters.includes(c.n) ? " ✓ Collected." : ""}</span>}
          </section>
        );
      })}
    </div>
  );
}
