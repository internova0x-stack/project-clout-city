"use client";

// Meeting players (owner, Oct 15): the unlimited chat offer, when the day's 20 messages run out (or
// from Settings). Monthly, yearly or forever, in the game's off-white and pink (owner: "match the off-white
// and pink theme"). Prices come from the catalog; only the Stripe webhook turns it on (migrations 0047, 0051).

import { useState } from "react";
import { CHAT_PASS, CHAT_PASS_PERKS, DAILY_MESSAGES } from "@/lib/meet";
import { formatPrice, type StoreProduct } from "@/lib/store";

/** Monthly, yearly or forever (owner, Oct 15; migration 0051). Yearly's badge and per-month line come from the catalog prices. */
export function ChatPassCard({ products, out, busy, onBuy, onClose }: {
  products: StoreProduct[];
  /** True when shown because the day's messages ran out. */
  out: boolean;
  busy: string | null;
  onBuy: (sku: string) => void;
  onClose: () => void;
}) {
  const monthly = products.find((p) => p.sku === CHAT_PASS.monthly);
  const yearly = products.find((p) => p.sku === CHAT_PASS.yearly);
  const forever = products.find((p) => p.sku === CHAT_PASS.forever);
  // Out of messages: lead with the yearly plan; from Settings: forever (the approved mockup).
  const first = (out ? [yearly, monthly, forever] : [forever, yearly, monthly]).find(Boolean);
  const [pick, setPick] = useState<string | undefined>(first?.sku);
  const plans = [
    monthly && { p: monthly, name: "Monthly", note: "Renews each month · cancel anytime", per: "/month" },
    yearly && {
      p: yearly, name: "Yearly", per: "/year",
      note: `${formatPrice(Math.round(yearly.priceCents / 12), yearly.currency)} a month, billed once a year`,
      badge: monthly && yearly.priceCents < monthly.priceCents * 12 ? `Save ${Math.round((1 - yearly.priceCents / (monthly.priceCents * 12)) * 100)}%` : undefined,
    },
    forever && { p: forever, name: "Forever", note: "One payment, yours for good", per: "" },
  ].filter((x): x is { p: StoreProduct; name: string; note: string; per: string; badge?: string } => !!x);
  const chosen = plans.find((x) => x.p.sku === pick) ?? plans[0];
  const pending = plans.some((x) => x.p.pending);
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
        {plans.length === 0 ? (
          <p className="meta">Unlimited chat isn&apos;t on sale yet.</p>
        ) : (
          <div className="stack-8" role="radiogroup" aria-label="Plan">
            {plans.map((x) => (
              <button key={x.p.sku} role="radio" aria-checked={chosen?.p.sku === x.p.sku} className={`chat-plan${chosen?.p.sku === x.p.sku ? " on" : ""}`} onClick={() => setPick(x.p.sku)}>
                <span>
                  <b>{x.name}{x.badge && <span className="chat-plan-badge">{x.badge}</span>}</b>
                  <small>{x.note}</small>
                </span>
                <span className="chat-plan-price">{formatPrice(x.p.priceCents, x.p.currency)}{x.per && <small>{x.per}</small>}</span>
              </button>
            ))}
          </div>
        )}
        {chosen && (
          <button className="btn btn-taxi" style={{ marginTop: 14, width: "100%" }} disabled={!!busy || pending} onClick={() => onBuy(chosen.p.sku)}>
            {pending ? "Unlocking…" : busy === `buy:${chosen.p.sku}` ? "Opening checkout…" : `Get unlimited chat · ${formatPrice(chosen.p.priceCents, chosen.p.currency)}${chosen.per}`}
          </button>
        )}
        <button className="chat-pass-later" onClick={onClose}>Not now</button>
        <p className="meta" style={{ margin: "8px 0 0" }}>Real money, through Stripe. If a monthly or yearly plan ends, the daily limit comes back.</p>
      </div>
    </div>
  );
}
