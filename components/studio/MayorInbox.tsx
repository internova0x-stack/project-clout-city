"use client";

import { useCallback, useEffect, useState } from "react";
import { MAYOR, kindOf, type LetterStatus, type MailbagFilter, type StudioLetter, type StudioMailbag } from "@/lib/mayor";
import { placeById } from "@/lib/city";
import { MAYOR_PAPA_DANI } from "@/lib/cast";
import type { StudioApi } from "@/lib/studio";

// Contact the Mayor (migration 0105): Mayor's Inbox, every letter players send from the Phone's Mayor app. Open a
// letter to mark it read; write back as the Mayor (the player sees it in the app) and mark it done once it's handled.

const STATUS: Record<LetterStatus, { label: string; cls: string }> = {
  new: { label: "New", cls: "draft" },
  read: { label: "Read", cls: "approved" },
  done: { label: "Done", cls: "declined" },
};
const FILTERS: { id: MailbagFilter; label: string }[] = [{ id: "open", label: "To do" }, { id: "new", label: "New" }, { id: "all", label: "All" }];
const stamp = (iso: string) => new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export function MayorInboxTab({ api }: { api: StudioApi }) {
  const [filter, setFilter] = useState<MailbagFilter>("open");
  const [bag, setBag] = useState<StudioMailbag | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    const r = await api.mailbag!(filter);
    if (r.ok) { setBag(r.data); setError(null); } else setError(r.error);
  }, [api, filter]);
  useEffect(() => { setBag(null); void load(); }, [load]);
  const act = async (id: number, status: LetterStatus, reply: string | null) => {
    setError(null);
    const r = await api.letter!(id, status, reply, filter);
    if (r.ok) setBag(r.data); else setError(r.error);
    return r.ok;
  };
  return (
    <section className="stack-12">
      <section className="studio-card stack-8">
        <div className="row" style={{ justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          <div className="stack-4">
            <h2 className="display-md row" style={{ margin: 0, gap: 10 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={MAYOR_PAPA_DANI.portrait} alt="" width={40} height={40} style={{ borderRadius: "50%" }} /> Mayor&apos;s Inbox
            </h2>
            <p className="meta" style={{ margin: 0 }}>
              Letters players send from the Phone&apos;s Mayor app: bugs, ideas, complaints and love letters. A reply goes to the
              player&apos;s Mayor app, signed by {MAYOR.name}, so write it in his voice: warm, upbeat, and only promise what&apos;s really fixed.
            </p>
          </div>
          <div className="row" style={{ gap: 6 }}>
            {FILTERS.map((f) => (
              <button key={f.id} className="chip" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
                {f.label}{bag && f.id === "new" ? ` (${bag.counts.new})` : bag && f.id === "open" ? ` (${bag.counts.new + bag.counts.read})` : ""}
              </button>
            ))}
          </div>
        </div>
      </section>
      {error && <div className="studio-note error"><span className="body-strong">{error}</span></div>}
      {bag === null && !error && <p className="meta">Loading…</p>}
      {bag?.letters.length === 0 && <section className="studio-card"><p className="subtext" style={{ margin: 0 }}>No letters here. The city is quiet, or happy.</p></section>}
      {bag?.letters.map((l) => <LetterCard key={l.id} l={l} onAct={act} />)}
    </section>
  );
}

function LetterCard({ l, onAct }: { l: StudioLetter; onAct: (id: number, status: LetterStatus, reply: string | null) => Promise<boolean> }) {
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const run = async (status: LetterStatus, text: string | null) => {
    setBusy(true);
    const ok = await onAct(l.id, status, text);
    setBusy(false);
    if (ok && text) setReply("");
  };
  const k = kindOf(l.kind);
  const place = l.context.place ? placeById(l.context.place)?.name ?? l.context.place : null;
  return (
    <article className="studio-card stack-8">
      <div className="row" style={{ justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <span className="title">{k.emoji} {k.label}</span>
        <span className={`tag studio-review ${STATUS[l.status].cls}`}>{STATUS[l.status].label}</span>
      </div>
      <span className="body" style={{ whiteSpace: "pre-wrap" }}>{l.message}</span>
      <span className="meta">
        From {l.player.name} · {stamp(l.at)}{place ? ` · at ${place}` : ""}{l.context.device ? ` · ${l.context.device}` : ""}
      </span>
      {l.reply && (
        <div className="studio-note stack-4">
          <span className="overline">Replied{l.repliedAt ? ` ${stamp(l.repliedAt)}` : ""}</span>
          <span className="body">{l.reply}</span>
        </div>
      )}
      <label className="stack-4">
        <span className="overline">{l.reply ? "Write a new reply (replaces the one above)" : `Reply as ${MAYOR.name}`}</span>
        <textarea className="studio-input" rows={3} maxLength={MAYOR.replyMax} value={reply} onChange={(e) => setReply(e.target.value)}
          placeholder="Thanks for writing in! My team fixed it in today's update." />
      </label>
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <button className="btn btn-night btn-sm" disabled={busy || !reply.trim()} onClick={() => void run("done", reply)}>Reply and mark done</button>
        {l.status === "new" && <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void run("read", null)}>Mark read</button>}
        {l.status !== "done" && <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void run("done", null)}>Done, no reply</button>}
        {l.status === "done" && <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void run("read", null)}>Reopen</button>}
      </div>
    </article>
  );
}
