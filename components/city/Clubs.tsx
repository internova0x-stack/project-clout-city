"use client";

// #19 clubs (owner, Oct 14): the VIP door and the line on a club's card that says what's downstairs and
// upstairs. The server checks every rule (migration 0046 enter_vip, vip_seen and travel's door rule).

import { formatCash } from "@/lib/economy";
import { clubDoor } from "@/lib/cityState";
import type { Place } from "@/lib/city";

/** "🚻 Restroom downstairs · 🥂 VIP upstairs, free from 5,000 clout" and the door rule, for a club's card. */
export function clubLines(place: Place, clout: number): string[] {
  if (!place.club) return [];
  const { doorClout, vip } = clubDoor(place);
  const lines: string[] = [];
  if (doorClout) lines.push(clout >= doorClout ? `🕶️ The bouncer knows your name (${doorClout.toLocaleString("en-US")} clout at the door)` : `🔒 ${doorClout.toLocaleString("en-US")} clout at the door · you have ${clout.toLocaleString("en-US")}`);
  lines.push(vip
    ? `🚻 Restroom downstairs · 🥂 VIP upstairs: ${clout >= vip.freeClout ? "you're on the list" : `free from ${vip.freeClout.toLocaleString("en-US")} clout, or ${formatCash(vip.cover)} for the night`}`
    : "🚻 Restroom downstairs, where the real gossip is");
  return lines;
}

/** The VIP rope: pay the cover for tonight, or stay downstairs. */
export function VipCoverCard({ place, cover, freeClout, cash, busy, onPay, onClose }: {
  place: Place; cover: number; freeClout: number; cash: number; busy: boolean; onPay: () => void; onClose: () => void;
}) {
  const short = cash < cover;
  return (
    <div className="modal-wrap" role="dialog" aria-modal="true" aria-label={`VIP at ${place.name}`}>
      <div className="scrim" onClick={onClose} />
      <div className="modal-card reveal-card">
        <span className="tag tag-event">🥂 VIP upstairs</span>
        <p className="display-md" style={{ margin: "12px 0 8px" }}>{formatCash(cover)} for the night</p>
        <p className="body" style={{ margin: 0, color: "rgba(255,246,224,.85)" }}>
          The person with the rope says it&apos;s free from {freeClout.toLocaleString("en-US")} clout. Until then, the cover gets you
          in until midnight, and up there getting seen counts double.
        </p>
        {short && <p className="meta" style={{ margin: "10px 0 0", color: "var(--pink-300, #FF9FCB)" }}>{formatCash(cover - cash)} short</p>}
        <div className="row" style={{ gap: 8, marginTop: 18 }}>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>Not tonight</button>
          <button className="btn btn-taxi" style={{ flex: 1 }} disabled={short || busy} onClick={onPay}>Pay {formatCash(cover)}</button>
        </div>
      </div>
    </div>
  );
}
