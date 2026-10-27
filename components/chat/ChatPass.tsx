"use client";

import Link from "next/link";
// VIP (owner, Oct 15; migration 0052, approved mockup): the offer when the day's 20 messages run out, or
// from Settings. VIP monthly or yearly (unlimited chat, every side story, a badge) or chat forever
// (unlimited chat only). Prices come from the catalog; only the Stripe webhook turns it on.

import { useState } from "react";
import { CHAT_PASS, DAILY_MESSAGES, VIP_PERKS } from "@/lib/meet";
import { formatPrice, type StoreProduct } from "@/lib/store";

/** VIP monthly, VIP yearly or chat forever. Yearly's badge and per-month line come from the catalog prices. */
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
  // The yearly plan leads (the approved mockup).
  const first = [yearly, monthly, forever].find(Boolean);
  const [pick, setPick] = useState<string | undefined>(first?.sku);
  const plans = [
    monthly && { p: monthly, name: "VIP monthly", note: "Renews automatically every month · cancel anytime", per: "/month", every: "month" },
    yearly && {
      p: yearly, name: "VIP yearly", per: "/year",
      note: `${formatPrice(Math.round(yearly.priceCents / 12), yearly.currency)} a month, billed yearly · renews automatically`, every: "year",
      badge: monthly && yearly.priceCents < monthly.priceCents * 12 ? `Save ${Math.round((1 - yearly.priceCents / (monthly.priceCents * 12)) * 100)}%` : undefined,
    },
    forever && { p: forever, name: "Chat forever", note: "One payment, no renewal · side stories not included", per: "" },
  ].filter(Boolean) as { p: StoreProduct; name: string; note: string; per: string; badge?: string; every?: string }[];
  const chosen = plans.find((x) => x.p.sku === pick) ?? plans[0];
  const pending = plans.some((x) => x.p.pending);
  const label = chosen?.p.sku === CHAT_PASS.forever ? "Get chat forever" : "Become a VIP";
  return (
    <div className="modal-wrap" role="dialog" aria-modal="true" aria-label="VIP">
      <div className="scrim" onClick={onClose} />
      <div className="modal-card modal-light chat-pass">
        <span className="tag tag-gold">👑 VIP</span>
        <p className="display-md" style={{ margin: "12px 0 8px" }}>{out ? `That's your ${DAILY_MESSAGES} for today` : "Become a VIP"}</p>
        <p className="body" style={{ margin: 0, color: "var(--text-2)" }}>
          Reactions are always free{out ? `, and your ${DAILY_MESSAGES} messages come back at midnight (New York)` : `. Everyone gets ${DAILY_MESSAGES} messages a day`}.
        </p>
        <ul className="chat-pass-perks">
          {VIP_PERKS.map((p) => <li key={p.text}><span aria-hidden="true">{p.emoji}</span> {p.text}</li>)}
        </ul>
        {plans.length === 0 ? (
          <p className="meta">VIP isn&apos;t on sale yet.</p>
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
        {/* FTC / California auto-renewal law (owner, Oct 27): the renewal and how to cancel, right above the button. */}
        {chosen && (
          <p className="meta chat-pass-terms">
            {chosen.every
              ? <>Renews automatically every {chosen.every} at {formatPrice(chosen.p.priceCents, chosen.p.currency)} until you cancel. Cancel anytime in Settings → Membership; cancelling stops the next renewal and VIP runs to the end of what you paid for.</>
              : <>One payment of {formatPrice(chosen.p.priceCents, chosen.p.currency)}. It never renews.</>}
            {" "}<Link href="/terms">Terms</Link>
          </p>
        )}
        {chosen && (
          <button className="btn btn-taxi" style={{ marginTop: 18, width: "100%" }} disabled={!!busy || pending} onClick={() => onBuy(chosen.p.sku)}>
            {pending ? "Unlocking…" : busy === `buy:${chosen.p.sku}` ? "Opening checkout…" : `${label} · ${formatPrice(chosen.p.priceCents, chosen.p.currency)}${chosen.per}`}
          </button>
        )}
        <button className="chat-pass-later" onClick={onClose}>Not now</button>
        <p className="meta chat-pass-foot">Real money, through Stripe. If a VIP plan ends, the daily limit comes back and side stories lock again.</p>
      </div>
    </div>
  );
}
