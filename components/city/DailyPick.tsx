"use client";

import { LOLA_PORTRAIT } from "@/lib/cast";
import { placeById } from "@/lib/city";
import type { TodayPick } from "@/lib/placeLife";
import { CloseIcon } from "../icons";
import { guardTaps } from "@/lib/tapGuard";

// Today's pick (owner, Nov 1: "when a player logs in for the first time in a day… a pop up that shows an activity to be
// completed"; "make it a pop up instead of a modal"): once a New York day, when nothing else is on screen, a small card floats
// over the game (no scrim, the game stays live) with Lola pointing at one thing worth doing today: a happening on now, a
// regular card one visit from its reward, or a place to try. Go there, or ✕ / Later.

const WHY: Record<TodayPick["why"], { tag: string; lola: string }> = {
  happening: { tag: "Happening now", lola: "Drop everything. This is only on for a bit." },
  stamp: { tag: "One visit from a reward", lola: "You're one visit from being a real regular." },
  new: { tag: "Try something new", lola: "You've never done this. Everyone who matters has." },
};

export function DailyPickPopup({ pick, here, onGo, onClose }: { pick: TodayPick | null; here: boolean; onGo: () => void; onClose: () => void }) {
  const place = pick ? placeById(pick.place) : undefined;
  if (!pick || !place) return null;
  const why = WHY[pick.why];
  const close = () => { guardTaps(); onClose(); };
  return (
    <div className="daily-pop" role="dialog" aria-label="Today's pick">
      <button className="daily-pop-x" onClick={close} aria-label="Close"><CloseIcon size={14} /></button>
      <div className="daily-pop-lola">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={LOLA_PORTRAIT} alt="" width={32} height={32} />
        <span><b>Lola:</b> {why.lola}</span>
      </div>
      <div className="daily-pop-body">
        <span className="daily-pop-emoji" aria-hidden="true">{pick.activity.emoji}</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span className="daily-pick-tag">{pick.why === "happening" && <span className="life-live" aria-hidden="true" />}{why.tag}</span>
          <span className="daily-pop-title">{pick.activity.title}</span>
          <span className="meta" style={{ display: "block" }}>{place.emoji} {place.name}{pick.activity.energy ? ` · ⚡ ${pick.activity.energy}` : ""}</span>
          {pick.note && <span className="daily-pop-note">{pick.why === "stamp" ? `🎟️ ${pick.note}` : `🔥 ${pick.note}`}</span>}
        </span>
      </div>
      <div className="daily-pop-actions">
        <button className="btn btn-ghost btn-sm" onClick={close}>Later</button>
        <button className="btn btn-taxi btn-sm" style={{ flex: 1 }} onClick={() => { guardTaps(); onGo(); }}>{here ? "Do it now" : "Go there"}</button>
      </div>
    </div>
  );
}
