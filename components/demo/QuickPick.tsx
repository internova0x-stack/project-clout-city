"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { ECONOMY } from "@/lib/economy";
import { BODIES, DEFAULT_BUILD, SKIN_TONES, randomLook, type Look } from "@/lib/look";
import { getStyle, STYLE_IDS, type StyleId } from "@/lib/styles";
import { ShuffleIcon } from "@/components/icons";

const Avatar3D = dynamic(() => import("@/components/avatar/Avatar3D"), { ssr: false });

// Demo mode's one-tap start (owner, Oct 28): instead of the four-step creator, the guest picks one of four ready-made
// New Yorkers (Male | Female flips any of them, owner Oct 28) and is in. The name is made up, the cash is a birth-lottery roll and the home is the room share; Shuffle
// changes the face, never the character. Nothing here is saved.

interface Archetype {
  id: string; title: string; style: StyleId; body: Look["body"]; handles: string[];
  /** The other gender's title and names, where the default's don't fit (a woman isn't a Finance Bro). */
  switched?: { title: string; handles: string[] };
}

const ARCHETYPES: Archetype[] = [
  // Wears New Money since the looks were renamed (owner, Oct 30); the id stays for analytics.
  { id: "influencer", title: "The Overnight Millionaire", style: "influencer_soft_glam", body: "curvy", handles: ["RichSinceTuesday", "JustGotTheBag", "LinkInBio"] },
  { id: "finance", title: "The Finance Bro", style: "midtown_finance", body: "straight", handles: ["BullishBrad", "VestedInterest", "CircleBackChad"],
    switched: { title: "The Finance Girlie", handles: ["GirlBossGains", "HedgeFundHer", "PowerSuitPending"] } },
  { id: "artist", title: "The Struggling Artist", style: "thrift_store_icon", body: "curvy", handles: ["RentIsArt", "ThriftedAndBroke", "GalleryPending"] },
  { id: "philosopher", title: "The Bodega Philosopher", style: "bodega_drip", body: "straight", handles: ["DeliCatWhisperer", "BaconEggCheese", "CornerStoreSage"] },
];

/** The title and names for the gender on screen. */
const named = (a: Archetype, body: Look["body"]) => (body !== a.body && a.switched ? a.switched : a);

export interface QuickCharacter { name: string; look: Look; cash: number; homeId: string; traits: string[] }

/** A new face for the character; a gender switch keeps the face's colours. */
function lookFor(a: Archetype, body: Look["body"] = a.body, keep?: Look): Look {
  const base = keep ?? randomLook(Math.random, STYLE_IDS);
  const hair = body === "curvy" ? (base.hair === "short" || base.hair === "buzz" ? "long" : base.hair) : base.hair === "long" ? "short" : base.hair;
  // No hat or glasses: the face and hair are the character. Owner, Oct 28: the ready-made characters are light-skinned.
  return { ...base, style: a.style, body, build: DEFAULT_BUILD[body], hair, skin: SKIN_TONES[1], covering: "none", glasses: "none", fit: null };
}

function finish(a: Archetype, look: Look): QuickCharacter {
  const { min, max, step } = ECONOMY.birthLottery;
  const cash = min + step * Math.floor(Math.random() * ((max - min) / step + 1));
  const { handles } = named(a, look.body);
  const handle = handles[Math.floor(Math.random() * handles.length)];
  return { name: `${handle}_${1000 + Math.floor(Math.random() * 9000)}`, look, cash, homeId: "astoria_share", traits: [] };
}

export function QuickPick({ onPick }: { onPick: (c: QuickCharacter) => void }) {
  const [pick, setPick] = useState(ARCHETYPES[0]);
  // One switch for every card (so a Female pick never shows "The Finance Bro" beside it).
  const [looks, setLooks] = useState<Record<string, Look>>(() => Object.fromEntries(ARCHETYPES.map((a) => [a.id, lookFor(a, ARCHETYPES[0].body)])));
  const look = looks[pick.id];

  return (
    <main className="creator-main">
      <section className="stage" style={{ flex: "1 1 42%", minHeight: 220 }}>
        <div className="row" style={{ position: "absolute", zIndex: 2, top: 12, left: 16, right: 16, alignItems: "flex-start", justifyContent: "flex-end" }}>
          <button className="icon-round" aria-label="Shuffle face" onClick={() => setLooks((l) => ({ ...l, [pick.id]: lookFor(pick, l[pick.id].body) }))}>
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
          <div className="binary" role="group" aria-label="Presenting as">
            {BODIES.map((o) => (
              <button key={o.id} aria-pressed={look.body === o.id}
                onClick={() => setLooks((l) => (l[pick.id].body === o.id ? l : Object.fromEntries(ARCHETYPES.map((a) => [a.id, lookFor(a, o.id, l[a.id])]))))}>{o.label}</button>
            ))}
          </div>
          <div className="trait-grid" role="radiogroup" aria-label="Characters">
            {ARCHETYPES.map((a) => {
              const st = getStyle(a.style);
              return (
                <button key={a.id} role="radio" aria-checked={pick.id === a.id} className="select-card single" onClick={() => setPick(a)}>
                  <span className="select-emoji" aria-hidden="true">{st.emoji}</span>
                  <span className="title" style={{ display: "block" }}>{named(a, looks[a.id].body).title}</span>
                  <span className="subtext" style={{ display: "block" }}>{st.blurb}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="creator-cta">
          <button className="btn btn-taxi" onClick={() => onPick(finish(pick, look))}>Play as {named(pick, look.body).title.replace(/^The /, "the ")} ›</button>
        </div>
      </section>
    </main>
  );
}
