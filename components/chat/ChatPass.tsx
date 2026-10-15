"use client";

// Meeting players (owner, Oct 15): the unlimited chat offer, when the day's 20 messages run out (or
// from Settings). Monthly or forever, in the game's off-white and pink (owner: "match the off-white
// and pink theme"). Prices come from the catalog; only the Stripe webhook turns it on (migration 0047).

import { useState } from "react";
import { CHAT_PASS, CHAT_PASS_PERKS, DAILY_MESSAGES } from "@/lib/meet";
import { formatPrice, type StoreProduct } from "@/lib/store";

export function ChatPassCard({ products, out, busy, onBuy, onClose }: {
  products: StoreProduct[];
  /** True when shown because the day's messages ran out. */
  out: boolean;
  busy: string | null;
  onBuy: (sku: string) => void;
  onClose: () => void;
}) {
  const monthly = products.find((p) => p.sku === CHAT_PASS.monthly);
  const forever = products.find((p) => p.sku === CHAT_PASS.forever);
  const [pick, setPick] = useState<string>(forever ? CHAT_PASS.forever : CHAT_PASS.monthly);
  const chosen = pick === CHAT_PASS.monthly ? monthly : forever;
  const pending = monthly?.pending || forever?.pending;
  return (
    <div className="modal-wrap" role="dialog" aria-modal="true" aria-label="Unlimited chat">
      <div className="scrim" onClick={onClose} />
      <div className="modal-card modal-light chat-pass">
        <span className="tag tag-event">✨ Unlimited chat</span>
        <p className="display-md" style={{ margin: "12px 0 8px" }}>{out ? `That's your ${DAILY_MESSAGES} for today` : "Chat without counting"}</p>
        <p className="body" style={{ margin: 0, color: "var(--text-2)" }}>
          Reactions are always free{out ? `, and your ${DAILY_MESSAGES} messages come back at midnight (New York)` : `. Everyone gets ${DAILY_MESSAGES} messages a day`}.
        </p>
        <ul className="chat-pass-perks">
          {CHAT_PASS_PERKS.map((p) => <li key={p.text}><span aria-hidden="true">{p.emoji}</span> {p.text}</li>)}
        </ul>
        {!monthly && !forever ? (
          <p className="meta">Unlimited chat isn&apos;t on sale yet.</p>
        ) : (
          <div className="stack-8" role="radiogroup" aria-label="Plan">
            {monthly && (
              <button role="radio" aria-checked={pick === monthly.sku} className={`chat-plan${pick === monthly.sku ? " on" : ""}`} onClick={() => setPick(monthly.sku)}>
                <span><b>Monthly</b><small>Renews each month · cancel anytime</small></span>
                <span className="chat-plan-price">{formatPrice(monthly.priceCents, monthly.currency)}<small>/month</small></span>
              </button>
            )}
            {forever && (
              <button role="radio" aria-checked={pick === forever.sku} className={`chat-plan${pick === forever.sku ? " on" : ""}`} onClick={() => setPick(forever.sku)}>
                <span><b>Forever</b><small>One payment, yours for good</small></span>
                <span className="chat-plan-price">{formatPrice(forever.priceCents, forever.currency)}</span>
              </button>
            )}
          </div>
        )}
        {chosen && (
          <button className="btn btn-taxi" style={{ marginTop: 14, width: "100%" }} disabled={!!busy || !!pending} onClick={() => onBuy(chosen.sku)}>
            {pending ? "Unlocking…" : busy === `buy:${chosen.sku}` ? "Opening checkout…" : `Get unlimited chat · ${formatPrice(chosen.priceCents, chosen.currency)}${chosen.sku === CHAT_PASS.monthly ? "/month" : ""}`}
          </button>
        )}
        <button className="chat-pass-later" onClick={onClose}>Not now</button>
        <p className="meta" style={{ margin: "8px 0 0" }}>Real money, through Stripe. If a monthly plan ends, the daily limit comes back.</p>
      </div>
    </div>
  );
}
