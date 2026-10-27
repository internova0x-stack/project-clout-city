"use client";

import { useState } from "react";
import { BARKSLEY, barksleyUpdate, type BarksleyChoice } from "@/lib/barksley";
import { Sheet } from "../Sheet";

// Sir Barksley (owner, Oct 27): the billionaire's depressed dog in Astoria Park and Dmitri, his walker. The first time
// (Starter Week) Dmitri explains and the player picks how to console him; later visits get Dmitri's update of the day.

function Face({ size }: { size: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="barksley-face" src={BARKSLEY.portrait} alt="" width={size} height={size} />;
}

export function BarksleySheet({ open, onClose, first, today }: { open: boolean; onClose: () => void; first: boolean; today: string }) {
  const [picked, setPicked] = useState<BarksleyChoice | null>(null);
  const close = () => { setPicked(null); onClose(); };
  return (
    <Sheet open={open} onClose={close} label={BARKSLEY.name}>
      <div className="stack-16">
        <div className="row" style={{ gap: 14, paddingRight: 44 }}>
          <Face size={84} />
          <span style={{ minWidth: 0 }}>
            <span className="overline" style={{ display: "block" }}>{first ? "Starter Week" : "Astoria Park"}</span>
            <span className="display-md" style={{ display: "block" }}>{BARKSLEY.name}</span>
            <span className="meta">A billionaire&apos;s Pomeranian, and {BARKSLEY.walker}, his walker</span>
          </span>
        </div>
        {(first ? BARKSLEY.intro : [barksleyUpdate(today)]).map((line) => (
          <p key={line} className="barksley-line"><b>{BARKSLEY.walker}:</b> {line}</p>
        ))}
        {!picked ? (
          <div className="stack-8">
            <p className="overline" style={{ margin: 0 }}>{first ? "How do you console him?" : "Keep him company"}</p>
            {BARKSLEY.choices.map((c) => (
              <button key={c.id} className="list-row barksley-choice" onClick={() => setPicked(c)}>
                <span aria-hidden="true">{c.emoji}</span>
                <span className="title" style={{ flex: 1, textAlign: "left" }}>{c.label}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="stack-12">
            <p className="body" style={{ margin: 0 }}>{picked.reply}</p>
            <p className="barksley-line"><b>{BARKSLEY.walker}:</b> {picked.walker}</p>
            <button className="btn btn-taxi" onClick={close}>{first ? "Consoled 🐕" : "Bye, Sir Barksley"}</button>
          </div>
        )}
      </div>
    </Sheet>
  );
}

/** On the park card: Sir Barksley's bench. */
export function BarksleyRow({ onOpen, today }: { onOpen: () => void; today: string }) {
  return (
    <button className="list-row barksley-row" onClick={onOpen}>
      <Face size={44} />
      <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
        <span className="title" style={{ display: "block" }}>🐕 {BARKSLEY.name} is on his bench</span>
        <span className="meta one-line" style={{ display: "block" }}>{BARKSLEY.walker}: {barksleyUpdate(today)}</span>
      </span>
      <span aria-hidden="true">›</span>
    </button>
  );
}
