"use client";

import Link from "next/link";
import { useState } from "react";
import type { Place } from "@/lib/city";
import { Sheet } from "@/components/Sheet";
import { PlaceArt } from "@/components/city/PlaceArt";
import { LookPicker } from "@/components/demo/QuickPick";

// The guest map (owner, Nov 16: "there shouldn't be a sign-up/login modal. They should be allowed to explore. The
// sign-up/login should only pop up when they try to go to a location"): a tap on a place opens its card, as in the game,
// and only "Go" asks who they are: pick a look, then sign up or play without an account.

const CATEGORY: Record<Place["category"], string> = {
  food: "Food", nightlife: "Nightlife", parks: "Park", places: "Place", home: "Home", monument: "Sight", shopping: "Shop", campus: "Campus",
};

export function GuestPlaceCard({ place, daytime, onClose, onGo }: { place: Place | null; daytime: boolean; onClose: () => void; onGo: (p: Place) => void }) {
  const things = place ? place.actions.filter((a) => !a.storyUnlock).slice(0, 4) : [];
  return (
    <Sheet open={!!place} onClose={onClose} label={place?.name ?? "Place"}>
      {place && (
        <div className="stack-16">
          <PlaceArt place={place} daytime={daytime} />
          <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
            <span className="tag tag-neutral">{place.emoji} {CATEGORY[place.category]}</span>
            {place.tier && <span className="tag tag-neutral">{place.tier} dining</span>}
            {place.tags.some((t) => t.startsWith("job_")) && <span className="tag tag-positive">Hiring</span>}
          </div>
          <div>
            <h2 className="display-lg" style={{ margin: 0, paddingRight: 44 }}>{place.name}</h2>
            <p className="meta" style={{ margin: "4px 0 0" }}>{place.neighborhood}, Queens</p>
          </div>
          <div className="lola">
            <span className="lola-avatar" aria-hidden="true">💋</span>
            <p className="body" style={{ margin: 0 }}>{place.lore}<span className="meta" style={{ display: "block", marginTop: 4 }}>Lola Lowdown</span></p>
          </div>
          {things.length > 0 && (
            <div className="stack-8">
              <p className="label-caps" style={{ margin: 0 }}>What people do here</p>
              <ul className="guest-things">
                {things.map((a) => <li key={a.id}><b>{a.label}</b><span className="meta"> · {a.blurb}</span></li>)}
              </ul>
            </div>
          )}
          <button className="btn btn-taxi" onClick={() => onGo(place)}>Go to {place.name} ›</button>
        </div>
      )}
    </Sheet>
  );
}

/** "Who's going?": the guest's look, then Sign up (the account) or Play (the demo, starting at that place). */
export function GuestGoSheet({ place, onClose, onSignUp, onSignIn }: { place: Place | null; onClose: () => void; onSignUp: () => void; onSignIn: () => void }) {
  const [, setPicked] = useState(0);
  return (
    <Sheet open={!!place} onClose={onClose} label="Who's going?">
      {place && (
        <div className="stack-16">
          <div>
            <h2 className="display-lg" style={{ margin: 0, paddingRight: 44 }}>Who&apos;s going?</h2>
            <p className="meta" style={{ margin: "4px 0 0" }}>{place.emoji} To {place.name}. Pick a look; change anything later.</p>
          </div>
          <LookPicker onChange={() => setPicked((n) => n + 1)} />
          <div className="stack-8">
            <button className="btn btn-taxi" onClick={onSignUp}>Sign up free and go ›</button>
            <Link className="btn btn-secondary" style={{ textDecoration: "none" }} href={`/demo?at=${encodeURIComponent(place.id)}`}>Just play, no account</Link>
            <button className="btn-link guest-signin-link" onClick={onSignIn}>Already have an account? <b>Sign in</b></button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
