"use client";

import { useEffect, useState } from "react";
import { MAYOR_MAMA_MANDEE } from "@/lib/cast";
import { LETTER_KINDS, MAYOR, MAYOR_WELCOME, kindOf, letterProblem, type LetterKind, type LetterStatus, type MayorApi, type MayorState } from "@/lib/mayor";

// Contact the Mayor (migration 0105): the Phone's feedback app. Pick what it's about, write the letter, send; your
// letters below, with the office's reply when there is one.

const STATUS: Record<LetterStatus, { label: string; cls: string }> = {
  new: { label: "Sent", cls: "tag-neutral" },
  read: { label: "Read by the office", cls: "tag-pro" },
  done: { label: "Handled", cls: "tag-event" },
};
const when = (iso: string) => new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });

export function MayorApp({ api, onToast, onSeen }: { api: MayorApi; onToast: (text: string) => void; onSeen?: () => void }) {
  const [state, setState] = useState<MayorState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<LetterKind | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    void api.state().then((r) => {
      if (!live) return;
      if (!r.ok) return setError(r.error);
      setState(r.data);
      // Opening the app shows the replies: they count as seen (the dot on the app goes).
      if (r.data.unseen > 0) void api.seen().then(() => onSeen?.());
    });
    return () => { live = false; };
  }, [api, onSeen]);

  const problem = message.trim() ? letterProblem(message) : null;
  const ready = !!kind && !letterProblem(message) && !busy && (state?.left ?? 0) > 0;
  const send = async () => {
    if (!ready || !kind) return;
    setBusy(true);
    setError(null);
    const r = await api.write(kind, message);
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setState(r.data);
    setMessage("");
    setKind(null);
    onToast(`Letter sent to ${MAYOR.name}. His team reads every one.`);
  };
  const unseenIds = new Set(state && state.unseen > 0 ? state.letters.filter((l) => l.reply).slice(0, state.unseen).map((l) => l.id) : []);

  return (
    <div className="stack-16 mayor-app">
      <div className="mayor-hero stack-8">
        <div className="row" style={{ gap: 10 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="mayor-portrait" src={MAYOR_MAMA_MANDEE.portrait} alt={MAYOR.name} width={56} height={56} />
          <div className="stack-4">
            <span className="title" style={{ display: "block" }}>A welcome from {MAYOR.name}</span>
            <span className="meta" style={{ display: "block" }}>{MAYOR.office}, City Hall</span>
          </div>
        </div>
        {MAYOR_WELCOME.map((p) => <p key={p} className="body mayor-para">{p}</p>)}
        <span className="body-strong mayor-sign" style={{ display: "block" }}>— {MAYOR.name}</span>
      </div>

      <form className="stack-12" onSubmit={(e) => { e.preventDefault(); void send(); }}>
        <div className="stack-8">
          <span className="overline">What&apos;s it about?</span>
          <div className="row mayor-kinds" role="radiogroup" aria-label="What's it about?">
            {LETTER_KINDS.map((k) => (
              <button key={k.id} type="button" role="radio" aria-checked={kind === k.id} className="chip" aria-pressed={kind === k.id} onClick={() => setKind(k.id)}>
                {k.emoji} {k.label}
              </button>
            ))}
          </div>
        </div>
        <label className="stack-4">
          <span className="row" style={{ justifyContent: "space-between" }}>
            <span className="overline">Your letter</span>
            <span className={`meta${message.trim().length > MAYOR.messageMax ? " radio-problem" : ""}`}>{message.trim().length}/{MAYOR.messageMax}</span>
          </span>
          <span className={`field radio-area${problem ? " error" : ""}`}>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} placeholder={kind ? kindOf(kind).placeholder : "Dear Mayor Mama-Mandee, …"} aria-label="Your letter" />
          </span>
          {problem && <span className="meta radio-problem">{problem}</span>}
        </label>
        {error && <p className="body radio-problem" style={{ margin: 0 }}>{error}</p>}
        <button type="submit" className="btn btn-night" disabled={!ready}>{busy ? "Sending…" : "Send to the Mayor"}</button>
        {state && (
          <p className="meta" style={{ margin: 0 }}>
            {state.left > 0 ? `${state.left} of ${MAYOR.dailyMax} letters left today. ` : "That's today's letters. Write again tomorrow. "}
            Only the Clout City team reads them; other players never see your letters.
          </p>
        )}
      </form>

      {state && state.letters.length > 0 && (
        <section className="stack-8">
          <span className="overline">Your letters</span>
          {state.letters.map((l) => (
            <article key={l.id} className="card stack-8 mayor-letter">
              <div className="row" style={{ justifyContent: "space-between", gap: 8 }}>
                <span className="meta">{kindOf(l.kind).emoji} {kindOf(l.kind).label} · {when(l.at)}</span>
                <span className={`tag ${STATUS[l.status].cls}`}>{STATUS[l.status].label}</span>
              </div>
              <span className="body">{l.message}</span>
              {l.reply && (
                <div className="mayor-reply stack-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="mayor-portrait mayor-portrait-sm" src={MAYOR_MAMA_MANDEE.portrait} alt="" width={28} height={28} />
                  <span className="overline" style={{ display: "block" }}>{unseenIds.has(l.id) ? "New · " : ""}{MAYOR.name} replied{l.repliedAt ? ` · ${when(l.repliedAt)}` : ""}</span>
                  <span className="body" style={{ display: "block" }}>{l.reply}</span>
                </div>
              )}
            </article>
          ))}
        </section>
      )}
      {!state && !error && <p className="meta">Opening the mail…</p>}
    </div>
  );
}
