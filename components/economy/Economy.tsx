"use client";

import { useEffect, useState } from "react";
import { formatCash } from "@/lib/economy";
import {
  PLAYER_ECONOMY, historyLine, lockedLine,
  type EconomyApi, type EconomyRow, type EconomyState, type GiftCandidate, type GiftInbox, type IncomingGift,
} from "@/lib/playerEconomy";
import { handle } from "@/lib/validation";
import { Avatar } from "../crew/Crew";
import { ChevronRightIcon, CloseIcon } from "../icons";
import { Sheet } from "../Sheet";
import { Toggle } from "../Toggle";

// The Player Economy, phase 1 (migration 0151): gifting Shop items to friends, the incoming gift card, and Trades & gifts
// in the Bank. Built from the app's own sheets, cards, rows and chips.

export interface GiftItem { sku: string; name: string; emoji: string; price: number }

/** 🎁 Gift this: pick a friend, write a note, confirm. The giver pays the Shop price; no fee. */
export function GiftSheet({ item, api, cash, onClose, onSent }: {
  item: GiftItem | null;
  api: EconomyApi;
  cash: number;
  onClose: () => void;
  onSent: (to: string, cash: number) => void;
}) {
  const [people, setPeople] = useState<GiftCandidate[] | null>(null);
  const [state, setState] = useState<EconomyState | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [step, setStep] = useState<"who" | "confirm">("who");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSku, setLastSku] = useState<string | null>(null);
  if ((item?.sku ?? null) !== lastSku) {
    setLastSku(item?.sku ?? null);
    setTo(null); setNote(""); setStep("who"); setError(null);
  }
  useEffect(() => {
    if (!item) return;
    void api.candidates().then((r) => setPeople(r.ok ? r.data : []));
    void api.state().then((r) => r.ok && setState(r.data));
  }, [item, api]);
  const pick = people?.find((p) => p.id === to) ?? null;
  const locked = lockedLine(state);
  const roomLeft = state ? Math.max(0, state.week.cap - state.week.sent) : null;
  const send = async () => {
    if (!item || !to) return;
    setBusy(true); setError(null);
    const r = await api.send(to, item.sku, note.trim());
    setBusy(false);
    if (!r.ok) { setError(r.error); return; }
    onSent(to, r.data.cash);
  };
  return (
    <Sheet open={!!item} onClose={onClose} label="Gift this" tall>
      {item && (
        <div className="stack-16">
          <div className="stack-4" style={{ paddingRight: 44 }}>
            <span className="overline">🎁 Gift this</span>
            <h2 className="display-md" style={{ margin: 0 }}>{item.emoji} {item.name}</h2>
            <span className="meta">{formatCash(item.price)} · no fee on gifts · they can say no</span>
          </div>
          {locked ? (
            <div className="card stack-4"><p className="body" style={{ margin: 0 }}>{locked}</p></div>
          ) : step === "who" ? (
            <>
              <div className="stack-8" role="radiogroup" aria-label="Who it's for">
                <p className="overline" style={{ margin: 0 }}>For</p>
                {people === null && <p className="meta" style={{ margin: 0 }}>Finding your people…</p>}
                {people?.length === 0 && (
                  <div className="card stack-4">
                    <p className="body" style={{ margin: 0, color: "var(--text-2)" }}>
                      Gifts go to your Crew, your partner and people you&apos;ve chatted with. Make a friend first. The city recommends brunch.
                    </p>
                  </div>
                )}
                {people?.map((p) => (
                  <button key={p.id} role="radio" aria-checked={to === p.id} disabled={!p.canReceive}
                    className={`list-row crew-pick${to === p.id ? " on" : ""}`} onClick={() => setTo(p.id)}>
                    <Avatar style={p.style} />
                    <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                      <span className="title one-line" style={{ display: "block" }}>{handle(p.name)}</span>
                      <span className="meta one-line">{p.partner ? "💞 Your partner" : p.crew ? "Crew" : "You've chatted"}{p.canReceive ? "" : " · can't receive gifts yet"}</span>
                    </span>
                    {to === p.id && <span className="tag tag-event">Picked</span>}
                  </button>
                ))}
              </div>
              <input className="chat-input job-note ph-sensitive" value={note} maxLength={PLAYER_ECONOMY.gifts.messageMax}
                placeholder="A note (optional)" aria-label="A note with the gift" onChange={(e) => setNote(e.target.value)} />
              <button className="btn btn-taxi" disabled={!to} onClick={() => setStep("confirm")}>Next</button>
            </>
          ) : (
            <>
              <div className="card stack-8">
                <div className="ledger-row" style={{ padding: 0, border: 0 }}><span className="body">For</span><span className="body-strong">{handle(pick?.name ?? "")}</span></div>
                <div className="ledger-row" style={{ padding: 0, border: 0 }}><span className="body">You pay</span><span className="body-strong">{formatCash(item.price)}</span></div>
                <div className="ledger-row" style={{ padding: 0, border: 0 }}><span className="body">Bank after</span><span className={`body-strong${cash < item.price ? " money-neg" : ""}`}>{formatCash(Math.max(0, cash - item.price))}</span></div>
                {state && <div className="ledger-row" style={{ padding: 0, border: 0 }}><span className="body">Gifts left this week</span><span className="body-strong">{state.week.giftsLeft}</span></div>}
              </div>
              {note.trim() && <p className="subtext ph-sensitive" style={{ margin: 0 }}>&ldquo;{note.trim()}&rdquo;</p>}
              <p className="meta" style={{ margin: 0 }}>
                If they decline, it comes back to you. Gifts stay with them {PLAYER_ECONOMY.noResaleDays} days: no selling back, no regifting.
                {roomLeft !== null && roomLeft < item.price ? ` That's over your weekly limit (${formatCash(roomLeft)} left).` : ""}
              </p>
              {error && <p className="error-text" style={{ margin: 0 }}>{error}</p>}
              <button className="btn btn-taxi" disabled={busy || cash < item.price} onClick={() => void send()}>
                {busy ? "…" : cash < item.price ? `${formatCash(item.price - cash)} short` : `Send it · ${formatCash(item.price)}`}
              </button>
              <button className="btn btn-ghost" onClick={() => setStep("who")}>Back</button>
            </>
          )}
        </div>
      )}
    </Sheet>
  );
}

/** The home screen's prompt when a gift is waiting (like the Crew and Together prompts). */
export function GiftPrompt({ inbox, onOpen, onDismiss }: { inbox: GiftInbox; onOpen: () => void; onDismiss: () => void }) {
  const g = inbox.incoming[0];
  if (!g) return null;
  return (
    <div className="story-prompt crew-prompt" role="status">
      <button className="story-prompt-main" onClick={onOpen}>
        <span className="story-prompt-tile" aria-hidden="true">🎁</span>
        <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
          <span className="overline" style={{ display: "block", color: "rgba(20,17,26,.7)" }}>{inbox.incoming.length > 1 ? `${inbox.incoming.length} gifts` : "A gift"}</span>
          <span className="title one-line" style={{ display: "block", color: "var(--night-900)" }}>{handle(g.fromName)} sent you something</span>
        </span>
        <ChevronRightIcon size={18} />
      </button>
      <button className="story-prompt-close" onClick={onDismiss} aria-label="Dismiss"><CloseIcon size={14} /></button>
    </div>
  );
}

function GiftCard({ gift, busy, onAnswer }: { gift: IncomingGift; busy: boolean; onAnswer: (accept: boolean) => void }) {
  const days = Math.max(0, Math.ceil((Date.parse(gift.expiresAt) - Date.now()) / 86_400_000));
  return (
    <div className="card date-invite stack-12">
      <div className="row" style={{ gap: 12 }}>
        <Avatar style={gift.fromStyle} size={48} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span className="overline" style={{ display: "block", color: "var(--neon-text)" }}>🎁 From {handle(gift.fromName)}</span>
          <span className="title" style={{ display: "block" }}>{gift.name}</span>
          <span className="meta" style={{ display: "block" }}>Worth {formatCash(gift.value)} · yours to keep, not to flip for {PLAYER_ECONOMY.noResaleDays} days</span>
          <span className="meta" style={{ display: "block" }}>{days <= 1 ? "Goes back tomorrow" : `Goes back in ${days} days`} if you don&apos;t answer</span>
        </span>
      </div>
      {gift.message && <p className="subtext ph-sensitive" style={{ margin: 0 }}>&ldquo;{gift.message}&rdquo;</p>}
      <div className="row" style={{ gap: 8 }}>
        <button className="btn btn-ghost" style={{ flex: 1 }} disabled={busy} onClick={() => onAnswer(false)}>No thanks</button>
        <button className="btn btn-green" style={{ flex: 1 }} disabled={busy} onClick={() => onAnswer(true)}>Accept</button>
      </div>
    </div>
  );
}

/** Gifts waiting for an answer, and the ones you sent lately. */
export function GiftInboxSheet({ open, inbox, busy, onClose, onAnswer }: {
  open: boolean; inbox: GiftInbox | null; busy: boolean; onClose: () => void; onAnswer: (id: number, accept: boolean) => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} label="Gifts" tall>
      <div className="stack-16">
        <div className="stack-4" style={{ paddingRight: 44 }}>
          <h2 className="display-md" style={{ margin: 0 }}>Gifts</h2>
          <span className="meta">Declined gifts go back to whoever sent them. No hard feelings. Some hard feelings.</span>
        </div>
        {inbox?.incoming.map((g) => <GiftCard key={g.id} gift={g} busy={busy} onAnswer={(a) => onAnswer(g.id, a)} />)}
        {inbox && inbox.incoming.length === 0 && (
          <div className="card stack-4">
            <p className="overline" style={{ margin: 0 }}>Nothing waiting</p>
            <p className="body" style={{ margin: 0, color: "var(--text-2)" }}>Send one from the Shop: tap 🎁 on anything you could see a friend in.</p>
          </div>
        )}
        {!!inbox?.sent.length && (
          <div className="stack-8">
            <p className="overline" style={{ margin: 0 }}>You sent</p>
            {inbox.sent.map((g) => (
              <div key={g.id} className="list-row static">
                <Avatar style={g.toStyle} size={36} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="title one-line">{g.name}</span>
                  <span className="meta one-line">To {handle(g.toName)} · {g.status === "pending" ? "waiting" : g.status === "accepted" ? "accepted 🎉" : g.status === "declined" ? "declined, it came back" : "expired, it came back"}</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Sheet>
  );
}

/** Phone → Bank → Trades & gifts: this week's limits and everything sent and received. */
export function TradesAndGifts({ api, onOpenGifts }: { api: EconomyApi; onOpenGifts?: () => void }) {
  const [state, setState] = useState<EconomyState | null>(null);
  const [rows, setRows] = useState<EconomyRow[] | null>(null);
  useEffect(() => {
    void api.state().then((r) => r.ok && setState(r.data));
    void api.history().then((r) => setRows(r.ok ? r.data : []));
  }, [api]);
  const locked = lockedLine(state);
  return (
    <section className="stack-8" aria-label="Trades and gifts">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span className="overline">🎁 Trades &amp; gifts</span>
        {onOpenGifts && <button className="chip chip-sm" onClick={onOpenGifts}>Gifts</button>}
      </div>
      {locked && <p className="meta" style={{ margin: 0 }}>{locked}</p>}
      {state && !locked && (
        <div className="bank-week">
          <span><b>{formatCash(Math.max(0, state.week.cap - state.week.sent))}</b>Left to send this week</span>
          <span><b>{formatCash(Math.max(0, state.week.cap - state.week.received))}</b>Left to receive</span>
        </div>
      )}
      {!!state?.uncounted && (
        <p className="meta" style={{ margin: 0 }}>
          {formatCash(state.uncounted)} you earned from players doesn&apos;t count toward your net worth: only {formatCash(PLAYER_ECONOMY.worthCap.weekly)} a week does. Ranks are earned, not wired.
        </p>
      )}
      {rows === null ? <p className="meta">Loading…</p> : rows.length === 0 ? (
        <p className="meta" style={{ margin: 0 }}>Nothing yet. Gifts and Jobs board pay show up here for both sides.</p>
      ) : (
        <div className="card stack-4">
          {rows.map((r) => {
            const l = historyLine(r);
            return (
              <div key={r.id} className="ledger-row">
                <span style={{ minWidth: 0 }}>
                  <span className="body one-line" style={{ display: "block" }}>{l.emoji} {l.title}</span>
                  <span className="meta">{new Date(r.at).toLocaleDateString([], { month: "short", day: "numeric" })}{l.note ? ` · ${l.note}` : ""}</span>
                </span>
                <span className={`body-strong${r.status === "reversed" ? "" : r.direction === "received" ? " money-pos" : ""}`}>{l.amount}</span>
              </div>
            );
          })}
        </div>
      )}
      <p className="subtext" style={{ margin: 0 }}>No cash transfers, ever: value moves only as Shop items and job pay. Nothing here turns into real money.</p>
    </section>
  );
}

/** The Jobs app's open-board switch: strangers who opted in too can see your jobs. */
export function OpenBoardRow({ api }: { api: EconomyApi }) {
  const [state, setState] = useState<EconomyState | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { void api.state().then((r) => r.ok && setState(r.data)); }, [api]);
  if (!state) return null;
  return (
    <div className="list-row static">
      <span style={{ flex: 1, minWidth: 0 }}>
        <span className="title" style={{ display: "block" }}>Open board</span>
        <span className="meta">{state.open ? "Strangers on the open board see your jobs, and you see theirs." : "Only your Crew, partner and chats see your jobs."}</span>
      </span>
      <Toggle on={state.open} label="Open board" disabled={busy} onChange={() => {
        setBusy(true);
        void api.setOpen(!state.open).then((r) => { setBusy(false); if (r.ok) setState(r.data); });
      }} />
    </div>
  );
}
