"use client";

// Unlimited chat pricing mockup (owner, Oct 15: "$4.99/mo, $39.99/year, $119.99 forever"), development
// only: the real offer card's classes with three plans. Static; nothing here talks to Stripe.
// /preview/chatpass?s=1 (out of messages, yearly picked) · s=2 (from Settings, forever picked)

import { useState } from "react";
import { CHAT_PASS_PERKS, DAILY_MESSAGES } from "@/lib/meet";

const PLANS = [
  { id: "monthly", name: "Monthly", note: "Renews each month · cancel anytime", price: "$4.99", per: "/month" },
  { id: "yearly", name: "Yearly", note: "$3.33 a month, billed once a year", price: "$39.99", per: "/year", badge: "Save 33%" },
  { id: "forever", name: "Forever", note: "One payment, yours for good", price: "$119.99", per: "" },
];

export function ChatPassMock({ screen }: { screen: number }) {
  const out = screen !== 2;
  const [pick, setPick] = useState(screen === 2 ? "forever" : "yearly");
  const chosen = PLANS.find((p) => p.id === pick)!;
  return (
    <main className="game">
      <div style={{ position: "fixed", inset: 0, background: "var(--g-stage)" }} aria-hidden="true" />
      <div className="modal-wrap" role="dialog" aria-modal="true" aria-label="Unlimited chat">
        <div className="scrim" />
        <div className="modal-card modal-light chat-pass">
          <span className="tag tag-event">✨ Unlimited chat</span>
          <p className="display-md" style={{ margin: "12px 0 8px" }}>{out ? `That's your ${DAILY_MESSAGES} for today` : "Chat without counting"}</p>
          <p className="body" style={{ margin: 0, color: "var(--text-2)" }}>
            Reactions are always free{out ? `, and your ${DAILY_MESSAGES} messages come back at midnight (New York)` : `. Everyone gets ${DAILY_MESSAGES} messages a day`}.
          </p>
          <ul className="chat-pass-perks">
            {CHAT_PASS_PERKS.map((p) => <li key={p.text}><span aria-hidden="true">{p.emoji}</span> {p.text}</li>)}
          </ul>
          <div className="stack-8" role="radiogroup" aria-label="Plan">
            {PLANS.map((p) => (
              <button key={p.id} role="radio" aria-checked={pick === p.id} className={`chat-plan${pick === p.id ? " on" : ""}`} onClick={() => setPick(p.id)}>
                <span>
                  <b>{p.name}{p.badge && <span className="chat-plan-badge">{p.badge}</span>}</b>
                  <small>{p.note}</small>
                </span>
                <span className="chat-plan-price">{p.price}{p.per && <small>{p.per}</small>}</span>
              </button>
            ))}
          </div>
          <button className="btn btn-taxi" style={{ marginTop: 14, width: "100%" }}>Get unlimited chat · {chosen.price}{chosen.per}</button>
          <button className="chat-pass-later">Not now</button>
          <p className="meta" style={{ margin: "8px 0 0" }}>Real money, through Stripe. If a monthly or yearly plan ends, the daily limit comes back.</p>
        </div>
      </div>
    </main>
  );
}
