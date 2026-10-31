"use client";

import { useEffect, useState } from "react";
import { CHOICES, bailCost, effectLine, integrityBand, integrityWord, lolaRepLine, type BlotterItem, type ChoiceCardView, type ChoiceLogEntry, type ChoiceMade } from "@/lib/choices";
import { placeById } from "@/lib/city";
import { LOLA_PORTRAIT } from "@/lib/cast";
import { Sheet } from "../Sheet";

// Moral Choices (spec section 29): the situation card, its receipt, the Halo ↔ Hustler reveal, a consequence coming back,
// and the record in the profile. Same format as Campaign Mode's situations (radio choices, then Decide): the server
// decides everything; this only asks and shows what came back.

const AREA: Record<string, string> = {
  life: "Life in the city", transit: "On the move", gigs: "Gig life", work: "On the clock", school: "Campus",
  business: "Your business", home: "Your building", nightlife: "After dark", dating: "Date night", money: "Money talks", fame: "The climb",
};

/**
 * The rep meter, 😇 Halo ↔ 💸 Hustler (owner, Oct 30): where you stand, never a score, and neither end is the bad one.
 * Shown only as the nudge after a choice (owner, Oct 30: "Have it as a nudge for now"): the dot slides from where you
 * were (`from`) to where the choice put you. Private: only the player ever sees it.
 */
export function RepMeter({ value, from, compact }: { value: number; from?: number; compact?: boolean }) {
  const [shown, setShown] = useState(from ?? value);
  useEffect(() => {
    const t = setTimeout(() => setShown(value), 350);
    return () => clearTimeout(t);
  }, [value]);
  const band = integrityBand(shown);
  const at = 100 - shown; // Halo on the left
  return (
    <div className={`rep ${band}${compact ? " compact" : ""}`}>
      <div className="rep-ends">
        <span>😇 Halo</span>
        <b>{integrityWord(shown)}</b>
        <span>Hustler 💸</span>
      </div>
      <div className="rep-bar" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={at} aria-valuetext={integrityWord(shown)} aria-label="Halo or Hustler">
        <i style={{ left: `${100 - CHOICES.high}%` }} /><i style={{ left: `${100 - CHOICES.low}%` }} />
        <span style={{ left: `${at}%` }} />
      </div>
    </div>
  );
}

function Receipt({ made, onClose }: { made: ChoiceMade; onClose: () => void }) {
  // The nudge shows the Halo ↔ Hustler move, so the line of numbers leaves it out.
  const line = effectLine({ ...made.effects, integrity: undefined });
  const moved = made.effects.integrity ?? 0;
  // Option 2: Lola says so when the choice tipped you into an end (or back to the middle). Not on the very first choice.
  const lola = made.first ? null : lolaRepLine(made.integrity - moved, made.integrity, made.receipt.length);
  return (
    <div className="stack-16">
      <p className="choice-receipt">{made.receipt}</p>
      {line && <p className="choice-effects">{line}</p>}
      <div className="choice-reveal stack-8">
        <RepMeter value={made.integrity} from={made.integrity - moved} compact={!made.first} />
        {lola && (
          <p className="choice-lola">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={LOLA_PORTRAIT} alt="" width={28} height={28} />
            <span><b>Lola:</b> {lola}</span>
          </p>
        )}
        {made.first && (
          <p className="meta" style={{ margin: 0 }}>Every choice nudges you. Only you see this.</p>
        )}
      </div>
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
            {/* Owner, Oct 30 ("too much text"): after deciding, only the emoji stays; the situation was just read. */}
            {!made && <span className="overline">{AREA[card.area] ?? "A choice"}{place ? ` · ${place.name}` : ""}</span>}
            {!made && card.intro && <p className="choice-intro">{card.intro}</p>}
            {!made && <p className="choice-title">{card.title}</p>}
          </div>
          {made ? <Receipt made={made} onClose={close} /> : (
            <>
              {/* Owner, Oct 30 ("too much text"): one line per choice; the picked one opens to show what it means. */}
              <div className="choice-options" role="radiogroup" aria-label="Your choice">
                {card.options.map((o) => (
                  <button key={o.id} role="radio" aria-checked={sel === o.id} className="choice-opt" disabled={busy} onClick={() => setSel(o.id)}>
                    {/* Owner, Oct 30: no risk labels or "may come back" hints; players learn from what happens. */}
                    <span className="choice-opt-row">
                      <span className="choice-opt-label">{o.label}</span>
                    </span>
                    {sel === o.id && (
                      <span className="choice-opt-more">
                        <span><b>You get</b> {o.get}</span>
                        <span><b>It costs</b> {o.cost}</span>
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
          <p className="meta" style={{ margin: 0 }}>Because you chose <b>{entry.choice}</b>.</p>
          <button className="btn btn-taxi" onClick={onClose}>Okay</button>
        </div>
      )}
    </Sheet>
  );
}

/**
 * The holding bench at the 114½ Precinct (migration 0132, police played for laughs): no travel or actions until the time
 * is up, or bail is paid (C$150 an hour left). Sgt. Bev keeps it light.
 */
export function HoldingSheet({ open, until, busy, onBail, onClose }: {
  open: boolean; until: string | null; busy: boolean; onBail: () => void; onClose: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, [open]);
  const left = until ? Math.max(0, Date.parse(until) - now) : 0;
  const mins = Math.ceil(left / 60_000);
  const time = mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
  return (
    <Sheet open={open && left > 0} onClose={onClose} label="Holding">
      {until && (
        <div className="stack-16">
          <div className="choice-head">
            <span className="choice-icon" aria-hidden="true">🚔</span>
            <span className="overline">The 114½ Precinct</span>
            <p className="choice-title">You&apos;re on the bench for {time}.</p>
          </div>
          <p className="choice-receipt"><b>Sgt. Bev:</b> &quot;Sit tight, there&apos;s a vending machine and it mostly works. Or pay the bail and we never speak of this.&quot;</p>
          <div className="stack-8 sheet-actions">
            <button className="btn btn-taxi" disabled={busy} onClick={onBail}>Pay bail C${bailCost(until, now).toLocaleString("en-US")}</button>
            <button className="btn btn-ghost" disabled={busy} onClick={onClose}>Wait it out</button>
          </div>
        </div>
      )}
    </Sheet>
  );
}

/** News → City: Lola's Blotter, the week's public headlines from players' choices. */
export function BlotterCard({ items }: { items: BlotterItem[] }) {
  if (!items.length) return null;
  return (
    <div className="card blotter" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <span className="overline" style={{ display: "block" }}>🚨 Lola&apos;s Blotter</span>
      {items.slice(0, 5).map((i, n) => (
        <p key={i.id} className="body" style={{ margin: 0, lineHeight: 1.5, ...(n ? { borderTop: "1px solid rgba(20,17,26,.1)", paddingTop: 12 } : {}) }}>{i.text}</p>
      ))}
    </div>
  );
}
