"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { REPORT_REASONS, chatTime, type ChatApi, type ChatStatus, type ChatSummary, type ChatThread, type ReportReason } from "@/lib/chat";
import { getStyle, type StyleId } from "@/lib/styles";

// C35: the Messages app in the Phone. 10 messages a day, a word filter on the
// server, Block and Report from each thread's ⋯ menu, and Report on a long press.

type Overlay = { kind: "menu" } | { kind: "block" } | { kind: "report"; messageId: number | null } | null;

export function MessagesApp({ api, openWith, onToast, onUnread }: {
  api: ChatApi;
  /** Open (or start) a thread with this player, e.g. from their profile card. */
  openWith?: { id: string; name: string; style: string } | null;
  onToast: (text: string) => void;
  onUnread?: (n: number) => void;
}) {
  const [list, setList] = useState<ChatSummary[] | null>(null);
  const [status, setStatus] = useState<ChatStatus | null>(null);
  const [open, setOpen] = useState<{ id: string; name: string; style: string } | null>(openWith ?? null);
  const [thread, setThread] = useState<ChatThread | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [reason, setReason] = useState<ReportReason>("harassment");
  const [note, setNote] = useState("");
  const bottom = useRef<HTMLDivElement>(null);
  const press = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadList = useCallback(async () => {
    const [l, s] = await Promise.all([api.list(), api.status()]);
    if (l.ok) {
      setList(l.data);
      onUnread?.(l.data.reduce((n, c) => n + c.unread, 0));
    } else setList([]);
    if (s.ok) setStatus(s.data);
  }, [api, onUnread]);
  const loadThread = useCallback(async (id: string) => {
    const t = await api.thread(id);
    if (t.ok) setThread(t.data);
  }, [api]);

  useEffect(() => { void loadList(); }, [loadList]);
  useEffect(() => { if (openWith) setOpen(openWith); }, [openWith]);
  // New messages arrive while a thread is open: check every few seconds.
  useEffect(() => {
    if (!open) return;
    setThread(null);
    void loadThread(open.id);
    const t = setInterval(() => void loadThread(open.id), 5000);
    return () => clearInterval(t);
  }, [open, loadThread]);
  useEffect(() => { bottom.current?.scrollIntoView({ block: "end" }); }, [thread?.messages.length]);

  const send = async () => {
    if (!open || !draft.trim() || busy) return;
    setBusy(true);
    const r = await api.send(open.id, draft);
    setBusy(false);
    if (!r.ok) return onToast(r.error);
    setDraft("");
    setStatus((s) => (s ? { ...s, left: r.data.left } : s));
    void loadThread(open.id);
  };
  const block = async (on: boolean) => {
    if (!open) return;
    const r = await api.block(open.id, on);
    setOverlay(null);
    if (!r.ok) return onToast(r.error);
    onToast(on ? `${open.name} is blocked. You won't see their messages.` : `${open.name} is unblocked.`);
    void loadThread(open.id);
    void loadList();
  };
  const report = async (messageId: number | null) => {
    if (!open) return;
    const r = await api.report(open.id, messageId, reason, note);
    setOverlay(null);
    setNote("");
    onToast(r.ok ? "Thanks. Our team will review it." : r.error);
  };
  const longPress = (id: number, mine: boolean) => ({
    onPointerDown: () => { if (!mine) press.current = setTimeout(() => setOverlay({ kind: "report", messageId: id }), 550); },
    onPointerUp: () => { if (press.current) clearTimeout(press.current); },
    onPointerLeave: () => { if (press.current) clearTimeout(press.current); },
    onContextMenu: (e: React.MouseEvent) => { if (!mine) { e.preventDefault(); setOverlay({ kind: "report", messageId: id }); } },
  });

  const left = status?.left ?? 0;
  const muted = !!status?.mutedUntil || !!status?.banned;
  const out = left <= 0;

  if (!open) {
    return (
      <div className="stack-12">
        {status && <span className="chat-left">{muted ? "Chat is paused for you" : `${left} of ${status.limit} left today`}</span>}
        {list === null && <p className="meta">Loading…</p>}
        {list?.length === 0 && (
          <div className="card stack-4">
            <p className="overline" style={{ margin: 0 }}>Quiet in Queens</p>
            <p className="body" style={{ margin: 0, color: "var(--text-2)" }}>No messages yet. Tap someone on the leaderboard to say hi. Ten a day, so make them count.</p>
          </div>
        )}
        {list?.map((c) => (
          <button key={c.with} className="chat-row" onClick={() => setOpen({ id: c.with, name: c.name, style: c.style })}>
            <span className="chat-avatar" aria-hidden="true">{getStyle(c.style as StyleId).emoji}</span>
            <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
              <span className="title" style={{ display: "block" }}>{c.name}</span>
              <span className="subtext chat-last">{c.blocked ? "Blocked" : `${c.lastMine ? "You: " : ""}${c.last ?? ""}`}</span>
            </span>
            <span className="chat-meta">
              <span className="meta">{chatTime(c.at)}</span>
              {c.unread > 0 && <span className="count-badge">{c.unread}</span>}
            </span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="chat-thread">
      <div className="chat-head">
        <button className="phone-back" onClick={() => { setOpen(null); setThread(null); void loadList(); }}>‹ Messages</button>
        <span className="title" style={{ flex: 1, textAlign: "center", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {getStyle(open.style as StyleId).emoji} {open.name}
        </span>
        <button className="icon-round chat-more" aria-label="More" onClick={() => setOverlay({ kind: "menu" })}>⋯</button>
      </div>

      <div className="chat-bubbles">
        {thread === null && <p className="meta">Loading…</p>}
        {thread?.blocked && <p className="meta chat-note">You blocked {open.name}. Their messages are hidden.</p>}
        {thread && !thread.blocked && thread.messages.length === 0 && (
          <p className="meta chat-note">Say hi to {open.name}. Be nice; it&apos;s a small city.</p>
        )}
        {thread?.messages.map((m) => (
          <div key={m.id} className={`bubble${m.mine ? " mine" : ""}`} {...longPress(m.id, m.mine)}>
            <span>{m.body}</span>
            <span className="bubble-time">{chatTime(m.at)}</span>
          </div>
        ))}
        <div ref={bottom} />
      </div>

      {thread?.blocked ? (
        <button className="btn btn-secondary" onClick={() => void block(false)}>Unblock {open.name}</button>
      ) : thread?.blockedMe ? (
        <p className="meta chat-note">You can&apos;t message {open.name}.</p>
      ) : (
        <div className="chat-dock">
          <span className="chat-left">{muted ? "Chat is paused for you" : `${left} of ${status?.limit ?? 10} left today`}</span>
          <div className="chat-composer">
            <input
              className="chat-input"
              value={draft}
              maxLength={500}
              disabled={out || muted}
              placeholder={muted ? "Chat is paused" : out ? "Back tomorrow." : `Message ${open.name}`}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void send(); }}
              aria-label="Message"
            />
            <button className="icon-round chat-send" disabled={out || muted || busy || !draft.trim()} onClick={() => void send()} aria-label="Send">↑</button>
          </div>
        </div>
      )}

      {overlay && (
        <div className="phone-overlay" onClick={() => setOverlay(null)}>
          <div className="phone-sheet stack-12" onClick={(e) => e.stopPropagation()}>
            {overlay.kind === "menu" && (
              <>
                <span className="title">{open.name}</span>
                <button className="btn btn-destructive" onClick={() => setOverlay({ kind: "block" })}>Block</button>
                <button className="btn btn-destructive" onClick={() => setOverlay({ kind: "report", messageId: null })}>Report</button>
                <button className="btn btn-ghost" onClick={() => setOverlay(null)}>Cancel</button>
              </>
            )}
            {overlay.kind === "block" && (
              <>
                <span className="title">Block {open.name}?</span>
                <span className="subtext">Their messages disappear right away and they can&apos;t message you. They won&apos;t be told.</span>
                <button className="btn btn-destructive" onClick={() => void block(true)}>Block</button>
                <button className="btn btn-ghost" onClick={() => setOverlay(null)}>Cancel</button>
              </>
            )}
            {overlay.kind === "report" && (
              <>
                <span className="title">{overlay.messageId ? "Report this message" : `Report ${open.name}`}</span>
                <span className="subtext">The conversation goes to our review team.</span>
                <div className="chip-row" role="group" aria-label="Reason" style={{ flexWrap: "wrap" }}>
                  {REPORT_REASONS.map((r) => (
                    <button key={r.id} className="chip" aria-pressed={reason === r.id} onClick={() => setReason(r.id)}>{r.label}</button>
                  ))}
                </div>
                <textarea className="chat-input" rows={2} maxLength={500} placeholder="Anything we should know? (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
                <button className="btn btn-destructive" onClick={() => void report(overlay.messageId)}>Send report</button>
                <button className="btn btn-ghost" onClick={() => setOverlay(null)}>Cancel</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
