"use client";

import { useState } from "react";
import { CHOICES, effectLine, integrityBand, integrityWord, type ChoiceCardView, type ChoiceLogEntry, type ChoiceMade, type Risk } from "@/lib/choices";
import { placeById } from "@/lib/city";
import { Sheet } from "../Sheet";

// Moral Choices (spec section 29): the situation card, its receipt, the Halo ↔ Hustler reveal, a consequence coming back,
// and the record in the profile. Same format as Campaign Mode's situations (radio choices, then Decide): the server
// decides everything; this only asks and shows what came back.

const RISK: Record<Risk, string> = { low: "Low risk", medium: "Med risk", high: "High risk" };
const AREA: Record<string, string> = {
  life: "Life in the city", transit: "On the move", gigs: "Gig life", work: "On the clock", school: "Campus",
  business: "Your business", home: "Your building", nightlife: "After dark", dating: "Date night", money: "Money talks",
};

/**
 * The rep meter, 😇 Halo ↔ 💸 Hustler (owner, Oct 30): where you stand, never a score, and neither end is the bad one.
 * For the reveal and the profile. Private: only the player ever sees it.
 */
export function RepMeter({ value, compact }: { value: number; compact?: boolean }) {
  const band = integrityBand(value);
  const at = 100 - value; // Halo on the left
  return (
    <div className={`rep ${band}${compact ? " compact" : ""}`}>
      <div className="rep-ends">
        <span>😇 Halo</span>
        <b>{integrityWord(value)}</b>
        <span>Hustler 💸</span>
      </div>
      <div className="rep-bar" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={at} aria-valuetext={integrityWord(value)} aria-label="Halo or Hustler">
        <i style={{ left: `${100 - CHOICES.high}%` }} /><i style={{ left: `${100 - CHOICES.low}%` }} />
        <span style={{ left: `${at}%` }} />
      </div>
    </div>
  );
}

function Receipt({ made, onClose }: { made: ChoiceMade; onClose: () => void }) {
  const line = effectLine(made.effects);
  return (
    <div className="stack-16">
      <p className="choice-receipt">{made.receipt}</p>
      {line && <p className="choice-effects">{line}</p>}
      {made.first && (
        <div className="choice-reveal stack-8">
          <span className="overline">New: Halo or Hustler?</span>
          <RepMeter value={made.integrity} />
          <p className="meta" style={{ margin: 0 }}>
            Every choice nudges you one way. Halos get trusted, Hustlers get offers, and each is lucky at its own game. Only you see this.
          </p>
        </div>
      )}
      <button className="btn btn-taxi" onClick={onClose}>{made.first ? "Noted" : "Moving on"}</button>
    </div>
  );
}

/** The card: one situation, 2 to 4 choices with their preview, Decide. "Not now" puts it away for today. */
export function ChoiceSheet({ card, made, busy, onChoose, onSkip, onClose }: {
  card: ChoiceCardView | null; made: ChoiceMade | null; busy: boolean;
  onChoose: (option: string) => void; onSkip: () => void; onClose: () => void;
}) {
  const [sel, setSel] = useState<string | null>(null);
  const place = card?.place ? placeById(card.place) : undefined;
  const close = () => { setSel(null); onClose(); };
  return (
    <Sheet open={!!card} onClose={made ? close : onSkip} label="A choice">
      {card && (
        <div className="stack-16">
          <div className="choice-head">
            <span className="choice-icon" aria-hidden="true">{card.emoji}</span>
            <span className="overline">{AREA[card.area] ?? "A choice"}{place ? ` · ${place.name}` : ""}</span>
            <p className="choice-title">{card.title}</p>
          </div>
          {made ? <Receipt made={made} onClose={close} /> : (
            <>
              {/* Owner, Oct 30 ("too much text"): one line per choice; the picked one opens to show what it means. */}
              <div className="choice-options" role="radiogroup" aria-label="Your choice">
                {card.options.map((o) => (
                  <button key={o.id} role="radio" aria-checked={sel === o.id} className="choice-opt" disabled={busy} onClick={() => setSel(o.id)}>
                    <span className="choice-opt-row">
                      <span className="choice-opt-label">{o.label}</span>
                      {o.comesBack && <span className="choice-later" title="May come back later" aria-label="May come back later">⏳</span>}
                      <span className={`choice-risk ${o.risk}`}>{RISK[o.risk]}</span>
                    </span>
                    {sel === o.id && (
                      <span className="choice-opt-more">
                        <span><b>You get</b> {o.get}</span>
                        <span><b>It costs</b> {o.cost}</span>
                        <span><b>Risk</b> {o.riskWhy}</span>
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <button className="btn btn-taxi" disabled={busy || !sel} onClick={() => sel && onChoose(sel)}>Decide</button>
              <button className="btn btn-ghost" disabled={busy} onClick={onSkip}>Not now</button>
            </>
          )}
        </div>
      )}
    </Sheet>
  );
}

/** A consequence of an earlier choice has landed: what happened, naming the choice, and what it did. */
export function ChoiceBackSheet({ entry, onClose }: { entry: ChoiceLogEntry | null; onClose: () => void }) {
  const line = entry ? effectLine(entry.effects) : "";
  return (
    <Sheet open={!!entry} onClose={onClose} label="It came back">
      {entry && (
        <div className="stack-16">
          <div className="choice-head">
            <span className="choice-icon" aria-hidden="true">{entry.emoji}</span>
            <span className="overline">It came back</span>
          </div>
          <p className="choice-receipt">{entry.receipt}</p>
          {line && <p className="choice-effects">{line}</p>}
          <p className="meta" style={{ margin: 0 }}>Because you chose <b>{entry.choice}</b>: “{entry.title}”</p>
          <button className="btn btn-taxi" onClick={onClose}>Okay</button>
        </div>
      )}
    </Sheet>
  );
}
