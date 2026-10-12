"use client";

import { useEffect, useState } from "react";
import type { ChatApi, PlayerCard } from "@/lib/chat";
import { ECONOMY } from "@/lib/economy";
import { getStyle, type StyleId } from "@/lib/styles";
import { Sheet } from "../Sheet";

/** C28: another player's profile card, opened from the leaderboard, with "Message". */
export function PlayerCardSheet({ playerId, api, onClose, onMessage }: {
  playerId: string | null; api: ChatApi; onClose: () => void;
  onMessage: (p: { id: string; name: string; style: string }) => void;
}) {
  const [card, setCard] = useState<PlayerCard | null | undefined>(undefined);
  useEffect(() => {
    if (!playerId) return;
    setCard(undefined);
    void api.card(playerId).then((r) => setCard(r.ok ? r.data : null));
  }, [playerId, api]);
  const style = card ? getStyle(card.style as StyleId) : null;
  const hood = card ? ECONOMY.homes.find((h) => h.id === card.homeId)?.neighborhood ?? "Queens" : "";
  return (
    <Sheet open={!!playerId} onClose={onClose} label="Player">
      {card === undefined ? (
        <p className="meta">Looking them up…</p>
      ) : card === null ? (
        <p className="body">That player isn&apos;t around anymore.</p>
      ) : (
        <div className="stack-16">
          <div className="row" style={{ gap: 12 }}>
            <span className="chat-avatar" style={{ width: 56, height: 56, fontSize: 26, border: "3px solid var(--taxi-400)" }} aria-hidden="true">{style?.emoji}</span>
            <span style={{ minWidth: 0 }}>
              <span className="display-md" style={{ display: "block" }}>{card.name}</span>
              <span className="meta" style={{ display: "block" }}>{style?.label} · {hood}</span>
            </span>
          </div>
          <div className="card row" style={{ justifyContent: "space-around" }}>
            <span style={{ textAlign: "center" }}><span className="hud-number" style={{ display: "block" }}>🔥 {card.clout.toLocaleString()}</span><span className="meta">Clout</span></span>
            <span style={{ textAlign: "center" }}><span className="hud-number" style={{ display: "block" }}>🏅 {card.badges}</span><span className="meta">Badges</span></span>
            <span style={{ textAlign: "center" }}>
              <span className="hud-number" style={{ display: "block" }}>{new Date(card.joined).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</span>
              <span className="meta">In the city since</span>
            </span>
          </div>
          {card.isMe ? (
            <p className="meta" style={{ margin: 0 }}>That&apos;s you. Looking good.</p>
          ) : (
            <button className="btn btn-taxi" onClick={() => onMessage({ id: card.id, name: card.name, style: card.style })}>
              {card.blocked ? "Blocked · open the chat" : `Message ${card.name}`}
            </button>
          )}
        </div>
      )}
    </Sheet>
  );
}
