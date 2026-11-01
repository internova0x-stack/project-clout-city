"use client";

import { LOLA_PORTRAIT } from "@/lib/cast";
import { placeById } from "@/lib/city";
import type { TodayPick } from "@/lib/placeLife";
import { Sheet } from "../Sheet";

// Today's pick (owner, Nov 1: "when a player logs in for the first time in a day… a pop up that shows an activity to be
// completed"): once a New York day, when nothing else is on screen, Lola points at one thing worth doing today (a happening
// on now, a regular card one visit from its reward, or a place to try). Go there or Later; never stacked on other prompts.

const WHY: Record<TodayPick["why"], { tag: string; lola: string }> = {
  happening: { tag: "Happening now", lola: "Drop everything. This is only on for a bit." },
  stamp: { tag: "One visit from a reward", lola: "You're one visit from being a real regular. Don't fumble it." },
  new: { tag: "Try something new", lola: "You've never done this. Everyone who matters has." },
};

export function DailyPickSheet({ pick, here, onGo, onClose }: { pick: TodayPick | null; here: boolean; onGo: () => void; onClose: () => void }) {
  const place = pick ? placeById(pick.place) : undefined;
  const why = pick ? WHY[pick.why] : null;
  return (
    <Sheet open={!!pick} onClose={onClose} label="Today's pick">
      {pick && place && why && (
        <div className="stack-16 daily-pick">
          <div className="daily-pick-lola">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={LOLA_PORTRAIT} alt="" width={40} height={40} />
            <span><span className="overline" style={{ display: "block" }}>Today in Queens</span><b>Lola:</b> {why.lola}</span>
          </div>
          <div className="daily-pick-card">
            <span className="daily-pick-tag">{pick.why === "happening" && <span className="life-live" aria-hidden="true" />}{why.tag}</span>
            <span className="daily-pick-emoji" aria-hidden="true">{pick.activity.emoji}</span>
            <p className="choice-title" style={{ margin: 0 }}>{pick.activity.title}</p>
            <p className="meta" style={{ margin: 0 }}>{place.emoji} {place.name}{pick.activity.energy ? ` · ⚡ ${pick.activity.energy}` : ""}</p>
            <p className="choice-intro" style={{ margin: 0 }}>{pick.activity.blurb}</p>
            {pick.note && <p className="daily-pick-note">{pick.why === "stamp" ? `🎟️ Next: ${pick.note}` : `🔥 ${pick.note}`}</p>}
          </div>
          <button className="btn btn-taxi" onClick={onGo}>{here ? "Do it now" : `Go to ${place.name}`}</button>
          <button className="btn btn-ghost" onClick={onClose}>Later</button>
        </div>
      )}
    </Sheet>
  );
}
