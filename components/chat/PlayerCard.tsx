"use client";

import { useEffect, useState } from "react";
import type { ChatApi, PlayerCard } from "@/lib/chat";
import { ECONOMY, formatCash, formatShort } from "@/lib/economy";
import { getStyle, type StyleId } from "@/lib/styles";
import { Sheet } from "../Sheet";
import type { DatingApi } from "@/lib/dating";
import { CrushButton } from "../dating/Dating";
import { handle } from "@/lib/validation";
import { recentLine, recentWhen } from "@/lib/recent";

/** C28: another player's profile card, opened from the leaderboard, with "Message". */
export function PlayerCardSheet({ playerId, api, onClose, onMessage, dating, onToast }: {
  playerId: string | null; api: ChatApi; onClose: () => void;
  onMessage: (p: { id: string; name: string; style: string }) => void;
  /** v0.5: the crush button (C40) on people you're connected to. */
  dating?: { api: DatingApi; onCrushChange: () => void };
  onToast?: (text: string) => void;
}) {
  const [card, setCard] = useState<PlayerCard | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const toggle = async (on: boolean) => {
    if (!card || !dating) return;
    setBusy(true);
    const r = await dating.api.crush(card.id, on);
    setBusy(false);
    if (!r.ok) return onToast?.(r.error);
    setCard({ ...card, crush: r.data });
    onToast?.(!on ? "Crush taken back. Nobody ever knew." : r.data.matched ? "It's mutual 👀" : "Crush saved. They'll only find out if it's mutual.");
    dating.onCrushChange();
  };
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
              <span className="display-md" style={{ display: "block" }}>{handle(card.name)}</span>
              <span className="meta" style={{ display: "block" }}>{style?.label} · {hood}</span>
            </span>
          </div>
          <div className="profile-kpis">
            <span className="profile-kpi"><b>🔥 {formatShort(card.clout)}</b><span>Clout</span></span>
            <span className="profile-kpi"><b>{card.rank != null ? `#${card.rank.toLocaleString()}` : "—"}</b><span>In Queens</span></span>
            <span className="profile-kpi"><b>{card.netWorth != null ? formatCash(card.netWorth) : "—"}</b><span>Net worth</span></span>
          </div>
          <p className="meta" style={{ margin: 0 }}>
            🏅 {card.badges} {card.badges === 1 ? "badge" : "badges"} · In the city since {new Date(card.joined).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
          </p>
          {card.recent && card.recent.some((r) => recentLine(r)) && (
            <div className="stack-4">
              <p className="overline" style={{ margin: 0 }}>Recently</p>
              <div>
                {card.recent.map((r) => {
                  const line = recentLine(r);
                  return line && (
                    <div key={`${r.kind}:${r.ref}`} className="profile-recent">
                      <span aria-hidden="true">{line.emoji}</span><span>{line.text}</span><span>{recentWhen(r.at)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {dating && card.crush && !card.blocked && (card.crush.eligible || card.crush.crushed) && (
            <p className="meta" style={{ margin: 0 }}>
              {card.crush.matched ? `💗 Matched with ${card.name}` : card.crush.crushed ? "Crush saved" : "Tap the heart to mark a crush"} · {card.crush.count} of {card.crush.max} crushes. They only find out if it&apos;s mutual.
            </p>
          )}
          {card.isMe ? (
            <p className="meta" style={{ margin: 0 }}>That&apos;s you. Looking good.</p>
          ) : (
            <div className="row" style={{ gap: 10 }}>
              <button className="btn btn-taxi" style={{ flex: 1 }} onClick={() => onMessage({ id: card.id, name: card.name, style: card.style })}>
                {card.blocked ? "Blocked · open the chat" : `Message ${card.name}`}
              </button>
              {dating && card.crush && !card.blocked && <CrushButton status={card.crush} busy={busy} onToggle={(on) => void toggle(on)} showCount={false} />}
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}
