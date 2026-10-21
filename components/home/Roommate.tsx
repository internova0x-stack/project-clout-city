"use client";

import { useState } from "react";
import { Sheet } from "../Sheet";
import { ChevronRightIcon, CloseIcon } from "../icons";
import { fillRoommateLine, roommateNoteFor, weekdayOf, type Roommate } from "@/lib/culture";

// Culture pack C3 (owner, Oct 20): the roommate in the shared apartment. The first time the player is home they
// introduce themselves (with the player's half of the rent and their own rent day); after that, a note a day.
// Both are remembered on this device only: seeing the intro again on a new phone is harmless.

const metKey = (id: string) => `cc_roommate_met_${id}`;
const NOTE_KEY = "cc_roommate_note_seen";
const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode: shows again */ } };

/** Whether they've introduced themselves on this device. */
export function roommateMet(r: Roommate): boolean {
  return typeof window !== "undefined" && read(metKey(r.id)) === "1";
}

/** Whether the home card has something to say today (the intro, or today's unread note). */
export function roommateCardDue(r: Roommate | null, today: string): boolean {
  if (!r || typeof window === "undefined") return false;
  return read(metKey(r.id)) !== "1" || read(NOTE_KEY) !== today;
}

export function RoommateCard({ roommate: r, rent, rentDue, today, onDone }: {
  roommate: Roommate; rent: string; rentDue: string | null; today: string; onDone: () => void;
}) {
  const met = read(metKey(r.id)) === "1";
  const [open, setOpen] = useState(false);
  const day = rentDue ? weekdayOf(rentDue) : "rent day";
  const first = r.name.split(" ")[0];
  const finish = () => {
    write(metKey(r.id), "1");
    write(NOTE_KEY, today);
    setOpen(false);
    onDone();
  };
  return (
    <>
      <div className="story-prompt news-prompt" role="status">
        <button className="story-prompt-main" onClick={() => (met ? finish() : setOpen(true))}>
          <span className="story-prompt-tile" aria-hidden="true">{met ? "📝" : "🛏️"}</span>
          <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
            <span className="overline" style={{ display: "block", color: "rgba(20,17,26,.7)" }}>{met ? `${first}'s note on the fridge` : "Your roommate"}</span>
            <span className="title" style={{ display: "block", color: "var(--night-900)" }}>{met ? roommateNoteFor(r, today) : `Meet ${first}`}</span>
          </span>
          {!met && <ChevronRightIcon size={18} />}
        </button>
        <button className="story-prompt-close" onClick={finish} aria-label="Dismiss"><CloseIcon size={14} /></button>
      </div>
      <Sheet open={open} onClose={finish} label={`Meet ${first}`}>
        <div className="stack-16">
          <div>
            <p className="overline" style={{ margin: 0 }}>Your roommate</p>
            <h2 className="display-lg" style={{ margin: "4px 0 0" }}>🛏️ {r.name}</h2>
            <p className="meta" style={{ margin: "4px 0 0" }}>{r.personality}</p>
          </div>
          {r.intro.map((l) => <p key={l} className="body" style={{ margin: 0 }}>“{fillRoommateLine(l, rent, day)}”</p>)}
          <div className="lola">
            <span className="lola-avatar" aria-hidden="true">💋</span>
            <p className="body" style={{ margin: 0 }}>{fillRoommateLine(r.lola, rent, day)}<span className="meta" style={{ display: "block", marginTop: 4 }}>Lola Lowdown</span></p>
          </div>
          <button className="btn btn-taxi" onClick={finish}>Nice to meet you, {first}</button>
        </div>
      </Sheet>
    </>
  );
}
