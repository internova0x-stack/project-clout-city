"use client";

import { dmTopic, everyVisible, ring, useDoorbell, useMyId } from "@/lib/live";
import { CrownMark } from "../city/Common";
import { useCallback, useEffect, useRef, useState } from "react";
import { DAILY_LIMIT, REPORT_REASONS, chatTime, type ChatApi, type ChatStatus, type ChatSummary, type ChatThread, type ReportReason } from "@/lib/chat";
import { getStyle, type StyleId } from "@/lib/styles";
import { STATIONS, type Station, type StationThread } from "@/lib/cloutTv";
import type { CrushStatus, DatingApi } from "@/lib/dating";
import { CrushButton } from "../dating/Dating";
import { handle } from "@/lib/validation";

/** v0.5 crushes and date nights inside Messages (C40). */
export interface MessagesDating {
  api: DatingApi;
  /** Unseen reveals plus unanswered date invites. */
  alerts: number;
  /** Players I'm matched with, for the "Matched" tag. */
  matched: string[];
  onOpenDates: () => void;
  /** A crush changed (it may have just become mutual). */
  onCrushChange: () => void;
  /** Relationships (migration 0118): the "Us" row; dating shows the partner and streak. */
  us?: { line: string; alerts: number; onOpen: () => void };
}

// C35: the Messages app in the Phone. 20 messages a day (unlimited with a chat pass, migration 0047),
// a word filter on the server, Block and Report from each thread's ⋯ menu, and Report on a long press.

/** "17 of 20 left today", or "✨ Unlimited chat". */
export function messagesLeftLine(status: ChatStatus | null): string {
  if (!status) return "";
  if (status.mutedUntil || status.banned) return "Chat is paused for you";
  return status.unlimited ? "✨ Unlimited chat" : `${status.left} of ${status.limit} left today`;
}

type Overlay = { kind: "menu" } | { kind: "block" } | { kind: "report"; messageId: number | null } | null;

export function MessagesApp({ api, openWith, onToast, onUnread, dating, crew, onOutOfMessages, stations }: {
  api: ChatApi;
  /** Open (or start) a thread with this player, e.g. from their profile card. */
  openWith?: { id: string; name: string; style: string } | null;
  onToast: (text: string) => void;
  onUnread?: (n: number) => void;
  dating?: MessagesDating;
  crew?: { alerts: number; onOpen: () => void };
  /** Meeting players: the unlimited chat offer, when the day's messages run out. */
  onOutOfMessages?: () => void;
  /** v0.14 texts from Real Clout FM and Clout TV (read-only threads). */
  stations?: { threads: StationThread[]; onRead: (station: Station) => void };
}) {
  const [station, setStation] = useState<Station | null>(null);
  const [list, setList] = useState<ChatSummary[] | null>(null);
  const [status, setStatus] = useState<ChatStatus | null>(null);
  const [open, setOpen] = useState<{ id: string; name: string; style: string } | null>(openWith ?? null);
  const [thread, setThread] = useState<ChatThread | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [reason, setReason] = useState<ReportReason>("harassment");
  const [note, setNote] = useState("");
  const [crush, setCrush] = useState<CrushStatus | null>(null);
  const [crushBusy, setCrushBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const press = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clout Couture (migration 0103): a crown by the names of Clout Crown owners.
  const [crowned, setCrowned] = useState<ReadonlySet<string>>(new Set());
  const loadList = useCallback(async () => {
    const [l, s, k] = await Promise.all([api.list(), api.status(), api.crowned?.()]);
    if (k?.ok) setCrowned(new Set(k.data));
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
  // New messages while a thread is open arrive on its doorbell at once (lib/live.ts); a slow check backs it up.
  useEffect(() => {
    if (!open) return;
    setThread(null);
    void loadThread(open.id);
    const t = everyVisible(() => void loadThread(open.id), 30_000);
    return () => t();
  }, [open, loadThread]);
  const me = useMyId();
  useDoorbell(open && me ? dmTopic(me, open.id) : null, () => { if (open) void loadThread(open.id); });
  useEffect(() => { bottom.current?.scrollIntoView({ block: "end" }); }, [thread?.messages.length]);
  // The crush button shows once the chat is two-way (or they're in the crew); re-check as replies arrive.
  const theirs = thread?.messages.filter((m) => !m.mine).length ?? 0;
  const mine = thread?.messages.filter((m) => m.mine).length ?? 0;
  const twoWay = theirs > 0 && mine > 0;
  const datingApi = dating?.api;
  useEffect(() => {
    setCrush(null);
    if (!open || !datingApi) return;
    void datingApi.crushStatus(open.id).then((r) => r.ok && setCrush(r.data));
  }, [open, datingApi, twoWay]);
  const toggleCrush = async (on: boolean) => {
    if (!open || !dating) return;
    setCrushBusy(true);
    const r = await dating.api.crush(open.id, on);
    setCrushBusy(false);
    if (!r.ok) return onToast(r.error);
    setCrush(r.data);
    onToast(!on ? "Crush taken back. Nobody ever knew." : r.data.matched ? "It's mutual 👀" : "Crush saved. They'll only find out if it's mutual.");
    dating.onCrushChange();
  };

  const send = async () => {
    if (!open || !draft.trim() || busy) return;
    setBusy(true);
    const r = await api.send(open.id, draft);
    setBusy(false);
    if (!r.ok) {
      if (r.error === DAILY_LIMIT && onOutOfMessages) return onOutOfMessages();
      return onToast(r.error);
    }
    setDraft("");
    if (me) ring(dmTopic(me, open.id));
    setStatus((s) => (s ? { ...s, left: r.data.left ?? s.left } : s));
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
  const out = !status?.unlimited && left <= 0;

  const stationThread = station ? stations?.threads.find((t) => t.station === station) : null;
  if (stationThread) {
    const st = STATIONS[stationThread.station];
    return (
      <div className="chat-thread">
        <div className="chat-head station-head">
          <button className="phone-back" onClick={() => setStation(null)}>‹ Messages</button>
          <span className="title one-line">{st.name}</span>
          <span aria-hidden="true" />
        </div>
        <div className="chat-bubbles ph-sensitive">
          <div className="station-card">
            <span className="station-card-icon" aria-hidden="true">{st.emoji}</span>
            <span className="title">{st.name}</span>
            <span className="meta">The station texts you when you&apos;re on. Replies don&apos;t reach it.</span>
          </div>
          {stationThread.messages.map((m) => (
            <div key={m.id} className="bubble station"><span>{m.body}</span><span className="bubble-time">{chatTime(m.at)}</span></div>
          ))}
        </div>
      </div>
    );
  }

  if (!open) {
    return (
      <div className="stack-12">
        {status && <span className="chat-left">{messagesLeftLine(status)}</span>}
        {stations?.threads.map((t) => {
          const last = t.messages[t.messages.length - 1];
          return (
            <button key={t.station} className="chat-row date-row" onClick={() => { setStation(t.station); if (t.unread) stations.onRead(t.station); }}>
              <span className="chat-avatar" aria-hidden="true">{STATIONS[t.station].emoji}</span>
              <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                <span className="title" style={{ display: "block" }}>{STATIONS[t.station].name}</span>
                <span className="subtext chat-last ph-sensitive">{last?.body ?? ""}</span>
              </span>
              <span className="chat-meta">
                {last && <span className="meta">{chatTime(last.at)}</span>}
                {t.unread > 0 && <span className="count-badge">{t.unread}</span>}
              </span>
            </button>
          );
        })}
        {crew && (
          <button className="chat-row date-row" onClick={crew.onOpen}>
            <span className="chat-avatar" aria-hidden="true">👯</span>
            <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
              <span className="title" style={{ display: "block" }}>Crew plans</span>
              <span className="subtext chat-last ph-sensitive">{crew.alerts > 0 ? "Your crew wants you out tonight" : "Tonight's outings with your crew"}</span>
            </span>
            <span className="chat-meta">{crew.alerts > 0 && <span className="count-badge">{crew.alerts}</span>}</span>
          </button>
        )}
        {dating?.us && (
          <button className="chat-row date-row" onClick={dating.us.onOpen}>
            <span className="chat-avatar" aria-hidden="true">💞</span>
            <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
              <span className="title" style={{ display: "block" }}>Us</span>
              <span className="subtext chat-last ph-sensitive">{dating.us.line}</span>
            </span>
            <span className="chat-meta">{dating.us.alerts > 0 && <span className="count-badge">{dating.us.alerts}</span>}</span>
          </button>
        )}
        {dating && (
          <button className="chat-row date-row" onClick={dating.onOpenDates}>
            <span className="chat-avatar" aria-hidden="true">🌙</span>
            <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
              <span className="title" style={{ display: "block" }}>Date nights</span>
              <span className="subtext chat-last ph-sensitive">{dating.alerts > 0 ? "Something's waiting for you" : "Crushes, matches and tonight's plans"}</span>
            </span>
            <span className="chat-meta">{dating.alerts > 0 && <span className="count-badge">{dating.alerts}</span>}</span>
          </button>
        )}
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
              <span className="title" style={{ display: "block" }}>
                {handle(c.name)}{crowned.has(c.with) && <CrownMark />}{dating?.matched.includes(c.with) && !c.blocked && <span className="tag matched-tag">Matched</span>}
              </span>
              <span className="subtext chat-last ph-sensitive">{c.blocked ? "Blocked" : `${c.lastMine ? "You: " : ""}${c.last ?? ""}`}</span>
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
        <span style={{ flex: 1, minWidth: 0, textAlign: "center" }}>
          <span className="title one-line" style={{ display: "block" }}>{getStyle(open.style as StyleId).emoji} {handle(open.name)}{crowned.has(open.id) && <CrownMark />}</span>
          {crush?.matched && <span className="tag matched-tag" style={{ margin: 0 }}>💗 Matched</span>}
        </span>
        {crush && !thread?.blocked && <CrushButton status={crush} busy={crushBusy} onToggle={(on) => void toggleCrush(on)} showCount={false} />}
        <button className="icon-round chat-more" aria-label="More" onClick={() => setOverlay({ kind: "menu" })}>⋯</button>
      </div>

      <div className="chat-bubbles ph-sensitive">
        {thread === null && <p className="meta">Loading…</p>}
        {thread?.blocked && <p className="meta chat-note">You blocked {open.name}. Their messages are hidden.</p>}
        {thread && !thread.blocked && thread.messages.length === 0 && (
          <p className="meta chat-note">Say hi to {open.name}. Be nice; it&apos;s a small city.</p>
        )}
        {thread?.messages.map((m) => (
          <div key={m.id} className={`bubble${m.mine ? " mine" : ""}${m.kind === "reaction" ? " reaction" : ""}`} {...longPress(m.id, m.mine)}>
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
          <span className="chat-left">{messagesLeftLine(status)}</span>
          {out && !muted && onOutOfMessages && (
            <button className="btn btn-taxi btn-sm" onClick={onOutOfMessages}>✨ Get unlimited chat</button>
          )}
          <div className="chat-composer">
            <input
              className="chat-input"
              value={draft}
              maxLength={500}
              disabled={out || muted}
              placeholder={muted ? "Chat is paused" : out ? "Out of messages until midnight." : `Message ${open.name}`}
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
                <span className="title">{handle(open.name)}</span>
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
