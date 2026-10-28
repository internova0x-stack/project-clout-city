"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { ECONOMY } from "@/lib/economy";
import { DEFAULT_BUILD, randomLook, type Look } from "@/lib/look";
import { getStyle, STYLE_IDS, type StyleId } from "@/lib/styles";
import { ShuffleIcon } from "@/components/icons";

const Avatar3D = dynamic(() => import("@/components/avatar/Avatar3D"), { ssr: false });

// Demo mode's one-tap start (owner, Oct 28): instead of the four-step creator, the guest picks one of four ready-made
// New Yorkers and is in. The name is made up, the cash is a birth-lottery roll and the home is the room share; Shuffle
// changes the face, never the character. Nothing here is saved.

interface Archetype { id: string; title: string; style: StyleId; body: Look["body"]; handles: string[] }

const ARCHETYPES: Archetype[] = [
  { id: "influencer", title: "The Wannabe Influencer", style: "influencer_soft_glam", body: "curvy", handles: ["ContentPending", "LinkInBio", "SoftLaunchQueen"] },
  { id: "finance", title: "The Finance Bro", style: "midtown_finance", body: "straight", handles: ["BullishBrad", "VestedInterest", "CircleBackChad"] },
  { id: "artist", title: "The Struggling Artist", style: "thrift_store_icon", body: "curvy", handles: ["RentIsArt", "ThriftedAndBroke", "GalleryPending"] },
  { id: "philosopher", title: "The Bodega Philosopher", style: "bodega_drip", body: "straight", handles: ["DeliCatWhisperer", "BaconEggCheese", "CornerStoreSage"] },
];

export interface QuickCharacter { name: string; look: Look; cash: number; homeId: string; traits: string[] }

function lookFor(a: Archetype): Look {
  const base = randomLook(Math.random, STYLE_IDS);
  const hair = a.body === "curvy" ? (base.hair === "short" || base.hair === "buzz" ? "long" : base.hair) : base.hair === "long" ? "short" : base.hair;
  // No hat or glasses: the face and hair are the character.
  return { ...base, style: a.style, body: a.body, build: DEFAULT_BUILD[a.body], hair, covering: "none", glasses: "none", fit: null };
}

function finish(a: Archetype, look: Look): QuickCharacter {
  const { min, max, step } = ECONOMY.birthLottery;
  const cash = min + step * Math.floor(Math.random() * ((max - min) / step + 1));
  const handle = a.handles[Math.floor(Math.random() * a.handles.length)];
  return { name: `${handle}_${1000 + Math.floor(Math.random() * 9000)}`, look, cash, homeId: "astoria_share", traits: [] };
}

export function QuickPick({ onPick }: { onPick: (c: QuickCharacter) => void }) {
  const [pick, setPick] = useState(ARCHETYPES[0]);
  const [looks, setLooks] = useState<Record<string, Look>>(() => Object.fromEntries(ARCHETYPES.map((a) => [a.id, lookFor(a)])));
  const look = looks[pick.id];

  return (
    <main style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column", background: "#FFE3CC" }}>
      <section className="stage" style={{ flex: "1 1 42%", minHeight: 220 }}>
        <div className="row" style={{ position: "absolute", zIndex: 2, top: 12, left: 16, right: 16, alignItems: "flex-start", justifyContent: "flex-end" }}>
          <button className="icon-round" aria-label="Shuffle face" onClick={() => setLooks((l) => ({ ...l, [pick.id]: lookFor(pick) }))}>
            <ShuffleIcon size={18} />
          </button>
        </div>
        <Avatar3D look={look} framing="full" />
      </section>
      <section className="creator-sheet">
        <div style={{ overflowY: "auto", padding: "24px 20px 8px", flex: 1 }} className="stack-16">
          <div className="stack-4">
            <p className="title" style={{ margin: 0 }}>Who are you today?</p>
            <p className="meta" style={{ margin: 0, fontSize: 13 }}>Pick one and jump in. You&apos;ll make your own when you sign up.</p>
          </div>
          <div className="trait-grid" role="radiogroup" aria-label="Characters">
            {ARCHETYPES.map((a) => {
              const st = getStyle(a.style);
              return (
                <button key={a.id} role="radio" aria-checked={pick.id === a.id} className="select-card single" onClick={() => setPick(a)}>
                  <span className="select-emoji" aria-hidden="true">{st.emoji}</span>
                  <span className="title" style={{ display: "block" }}>{a.title}</span>
                  <span className="subtext" style={{ display: "block" }}>{st.blurb}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="creator-cta">
          <button className="btn btn-taxi" onClick={() => onPick(finish(pick, look))}>Play as {pick.title.replace(/^The /, "the ")} ›</button>
        </div>
      </section>
    </main>
  );
}
