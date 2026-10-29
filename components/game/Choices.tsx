"use client";

import { useState } from "react";
import { CHOICES, effectLine, integrityBand, integrityWord, type ChoiceCardView, type ChoiceLogEntry, type ChoiceMade, type Risk } from "@/lib/choices";
import { placeById } from "@/lib/city";
import { Sheet } from "../Sheet";

// Moral Choices (spec section 29): the situation card, its receipt, the Integrity reveal, a consequence coming back,
// and the record in the profile. Same format as Campaign Mode's situations (radio choices, then Decide): the server
// decides everything; this only asks and shows what came back.

const RISK: Record<Risk, string> = { low: "Low", medium: "Medium", high: "High" };
const AREA: Record<string, string> = {
  life: "Life in the city", transit: "On the move", gigs: "Gig life", work: "On the clock", school: "Campus",
  business: "Your business", home: "At home", nightlife: "After dark", dating: "Date night", money: "Money talks",
};

/** The meter, for the reveal, the stats panel and the profile. Private: only the player ever sees it. */
export function IntegrityMeter({ value, compact }: { value: number; compact?: boolean }) {
  const band = integrityBand(value);
  return (
    <div className={`integrity ${band}${compact ? " compact" : ""}`}>
      <div className="integrity-head">
        <span className="title">⚖️ Integrity <b>{value}</b></span>
        <span className="meta">{integrityWord(value)}</span>
      </div>
      <div className="integrity-bar" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} aria-label="Integrity">
        <span style={{ width: `${value}%` }} />
        <i style={{ left: `${CHOICES.low}%` }} /><i style={{ left: `${CHOICES.high}%` }} />
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
          <span className="overline">New: your Integrity</span>
          <IntegrityMeter value={made.integrity} />
          <p className="meta" style={{ margin: 0 }}>
            How the city sees you. Only you can see the number, but everyone you meet can feel it. Choices move it, and
            some come back later. Losing it is quick; earning it back takes twice as long.
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
              <div className="stack-8" role="radiogroup" aria-label="Your choice">
                {card.options.map((o) => (
                  <button key={o.id} role="radio" aria-checked={sel === o.id} className="camp-option radio" disabled={busy} onClick={() => setSel(o.id)}>
                    <span className="title">{o.label}</span>
                    <span className="camp-preview">
                      <span><b>You get</b> {o.get}</span>
                      <span><b>It costs</b> {o.cost}</span>
                      <span className={`camp-risk ${o.risk}`}><b>Risk</b> {RISK[o.risk]}: {o.riskWhy}{o.comesBack ? " · ⏳ may come back later" : ""}</span>
                    </span>
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
            <p className="choice-title">{entry.receipt}</p>
          </div>
          {line && <p className="choice-effects">{line}</p>}
          <p className="meta" style={{ margin: 0 }}>Because you chose <b>{entry.choice}</b>: “{entry.title}”</p>
          <button className="btn btn-taxi" onClick={onClose}>Okay</button>
        </div>
      )}
    </Sheet>
  );
}

/** The profile's record: Integrity, then every choice and what came back, newest first. */
export function ChoicesHistory({ integrity, log }: { integrity: number | null; log: ChoiceLogEntry[] }) {
  const [all, setAll] = useState(false);
  if (integrity === null && !log.length) return null;
  const rows = all ? log : log.slice(0, 5);
  return (
    <section className="stack-12">
      <h3 className="overline" style={{ margin: 0 }}>Your choices</h3>
      {integrity !== null && <IntegrityMeter value={integrity} />}
      <div className="stack-8">
        {rows.map((e) => (
          <div key={e.id} className={`choice-log${e.cameBack ? " back" : ""}`}>
            <span aria-hidden="true">{e.cameBack ? "↩️" : e.emoji}</span>
            <span style={{ minWidth: 0 }}>
              <span className="title" style={{ display: "block" }}>{e.cameBack ? e.receipt : e.choice}</span>
              <span className="meta" style={{ display: "block" }}>
                {e.cameBack ? `Came back from: ${e.choice}` : e.receipt}
              </span>
              {effectLine(e.effects) && <span className="meta choice-log-fx">{effectLine(e.effects)}</span>}
            </span>
          </div>
        ))}
      </div>
      {log.length > 5 && <button className="btn btn-ghost" onClick={() => setAll(!all)}>{all ? "Show fewer" : `Show all ${log.length}`}</button>}
    </section>
  );
}
