"use client";

import { useEffect, useRef, useState } from "react";
import { PARTY_SUGGESTIONS, type PartyMessage } from "@/lib/partyRoom";
import { Sheet } from "../Sheet";

/**
 * v0.11 the event chat (spec section 10): a group chat for the people at the party, no daily limit
 * while it's on (the server spaces messages a little). Tappable positive openers keep it friendly;
 * tap a name to see their profile, report the message or block them. The word filter runs on the server.
 */
export function PartyChatSheet({
  open, onClose, title, here, messages, busy, onSend, onProfile, onReport, onBlock,
}: {
  open: boolean; onClose: () => void; title: string; here: number; messages: PartyMessage[]; busy: boolean;
  onSend: (body: string) => Promise<boolean>;
  onProfile?: (playerId: string) => void;
  onReport: (m: PartyMessage) => void;
  onBlock?: (m: PartyMessage) => void;
}) {
  const [draft, setDraft] = useState("");
  const [menu, setMenu] = useState<number | null>(null);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { if (open) end.current?.scrollIntoView({ block: "end" }); }, [open, messages.length]);
  const send = async (body: string) => {
    const text = body.trim();
    if (!text || busy) return;
    if (await onSend(text)) setDraft("");
  };
  return (
    <Sheet open={open} onClose={onClose} label="Party chat" tall>
      <div className="party-chat">
        <div className="stack-4" style={{ paddingRight: 44 }}>
          <p className="overline" style={{ margin: 0 }}>🎉 Party chat · {here} here</p>
          <h2 className="display-md" style={{ margin: 0 }}>{title}</h2>
          <p className="meta" style={{ margin: 0 }}>No message limit tonight. Be nice; the bouncer reads everything.</p>
        </div>
        <div className="party-msgs ph-sensitive" role="log" aria-live="polite">
          {messages.length === 0 && <p className="meta" style={{ textAlign: "center", margin: "24px 0" }}>Nobody's said anything yet. Be the first; it's a party.</p>}
          {messages.map((m) => (
            <div key={m.id} className={`party-msg${m.mine ? " mine" : ""}`}>
              {!m.mine && (
                <button className="party-msg-name" onClick={() => setMenu(menu === m.id ? null : m.id)} aria-expanded={menu === m.id}>{m.name}</button>
              )}
              <span className="party-msg-body">{m.body}</span>
              {menu === m.id && !m.mine && (
                <span className="party-msg-menu">
                  {onProfile && <button onClick={() => { setMenu(null); onProfile(m.from); }}>Profile</button>}
                  <button onClick={() => { setMenu(null); onReport(m); }}>Report</button>
                  {onBlock && <button onClick={() => { setMenu(null); onBlock(m); }}>Block</button>}
                </span>
              )}
            </div>
          ))}
          <div ref={end} />
        </div>
        <div className="party-suggest" aria-label="Quick messages">
          {PARTY_SUGGESTIONS.map((s) => (
            <button key={s} className="chip" disabled={busy} onClick={() => void send(s)}>{s}</button>
          ))}
        </div>
        <form className="row party-input" onSubmit={(e) => { e.preventDefault(); void send(draft); }}>
          <label className="field" style={{ flex: 1, minWidth: 0 }}>
            <input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={200} placeholder="Say something nice…" aria-label="Message the party" />
          </label>
          <button type="submit" className="btn btn-taxi btn-sm" disabled={busy || !draft.trim()}>{busy ? "…" : "Send"}</button>
        </form>
      </div>
    </Sheet>
  );
}
