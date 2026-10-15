"use client";

// VIP mockup (owner, Oct 15: "Call it VIP, chat only"; side stories free for monthly and yearly members),
// development only. Built from the game's own classes so spacing and type match. Static; no payments.
// /preview/vip?s=1 (offer) · s=2 (side story, not a member) · s=3 (side story, member) · s=4 (player card)

import { useState } from "react";
import { ChevronLeftIcon } from "../icons";
import { Sheet } from "../Sheet";
import { RankChip } from "../game/Ranks";
import { RANKS } from "@/lib/ranks";

const PERKS = [
  { emoji: "💬", text: "Unlimited chat with anyone you meet" },
  { emoji: "📖", text: "Every side story free while you're a member" },
  { emoji: "👑", text: "A VIP badge on your player card" },
];

function Backdrop() {
  return <div style={{ position: "fixed", inset: 0, background: "var(--g-stage)" }} aria-hidden="true" />;
}

function Offer() {
  const [pick, setPick] = useState("yearly");
  const plans = [
    { id: "monthly", name: "VIP monthly", note: "Renews each month · cancel anytime", price: "$4.99", per: "/month" },
    { id: "yearly", name: "VIP yearly", note: "$3.33 a month, billed once a year", price: "$39.99", per: "/year", badge: "Save 33%" },
    { id: "forever", name: "Chat forever", note: "Unlimited chat for good · side stories not included", price: "$119.99", per: "" },
  ];
  const chosen = plans.find((p) => p.id === pick)!;
  return (
    <div className="modal-wrap" role="dialog" aria-label="VIP">
      <div className="scrim" />
      <div className="modal-card modal-light chat-pass">
        <span className="tag tag-gold">👑 VIP</span>
        <p className="display-md" style={{ margin: "12px 0 8px" }}>That&apos;s your 20 for today</p>
        <p className="body" style={{ margin: 0, color: "var(--text-2)" }}>Reactions are always free, and your 20 messages come back at midnight (New York).</p>
        <ul className="chat-pass-perks">
          {PERKS.map((p) => <li key={p.text}><span aria-hidden="true">{p.emoji}</span> {p.text}</li>)}
        </ul>
        <div className="stack-8" role="radiogroup" aria-label="Plan">
          {plans.map((p) => (
            <button key={p.id} role="radio" aria-checked={pick === p.id} className={`chat-plan${pick === p.id ? " on" : ""}`} onClick={() => setPick(p.id)}>
              <span><b>{p.name}{p.badge && <span className="chat-plan-badge">{p.badge}</span>}</b><small>{p.note}</small></span>
              <span className="chat-plan-price">{p.price}{p.per && <small>{p.per}</small>}</span>
            </button>
          ))}
        </div>
        <button className="btn btn-taxi" style={{ marginTop: 14, width: "100%" }}>{pick === "forever" ? "Get chat forever" : "Become a VIP"} · {chosen.price}{chosen.per}</button>
        <button className="chat-pass-later">Not now</button>
        <p className="meta" style={{ margin: "8px 0 0" }}>Real money, through Stripe. If a VIP plan ends, the daily limit comes back and side stories lock again.</p>
      </div>
    </div>
  );
}

function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="modal-wrap phone-wrap" role="dialog" aria-label="Phone">
      <div className="scrim" aria-hidden="true" />
      <div className="phone-device">
        <div className="phone-screen">
          <div className="phone-status light"><span>7:42 PM</span><span className="phone-pill" aria-hidden="true" /><span /></div>
          <div className="phone-app-screen">{children}</div>
        </div>
      </div>
    </div>
  );
}

const ARC = { emoji: "🗂️", title: "The Momager Files", teaser: "Sarah's mother kept a binder on everyone. Someone wants it back.", beats: ["Day 2 · The binder", "Day 4 · Page 17 is missing", "Day 6 · Who signed for it?"] };

function SideStory({ member }: { member: boolean }) {
  return (
    <PhoneFrame>
      <div className="stack-12">
        <div>
          <button className="phone-back"><ChevronLeftIcon size={20} /> Home</button>
          <h2 className="display-lg" style={{ margin: "4px 0 4px" }}>News</h2>
        </div>
        <p className="overline" style={{ margin: "8px 0 0" }}>Side stories</p>
        <div className="side-teaser stack-12">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
            <span className="title" style={{ minWidth: 0 }}>{ARC.emoji} {ARC.title}</span>
            <span className="tag tag-gold">{member ? "👑 Free with VIP" : "✨ Real cash"}</span>
          </div>
          <span className="subtext">{ARC.teaser}</span>
          {ARC.beats.map((b) => <span key={b} className="meta locked-row">{member ? "📖" : "🔒"} {b}</span>)}
          {member ? (
            <button className="btn btn-taxi btn-sm" style={{ width: "100%" }}>Read now · free with VIP</button>
          ) : (
            <div className="stack-8">
              <button className="btn btn-taxi btn-sm" style={{ width: "100%" }}>Unlock for $2.99</button>
              <button className="btn btn-secondary btn-sm" style={{ width: "100%" }}>👑 Free with VIP</button>
            </div>
          )}
        </div>
      </div>
    </PhoneFrame>
  );
}

function Card() {
  return (
    <Sheet open onClose={() => {}} label="Player">
      <div className="stack-16">
        <div className="row" style={{ gap: 12 }}>
          <span className="chat-avatar" style={{ width: 56, height: 56, fontSize: 26, border: "3px solid var(--taxi-400)" }} aria-hidden="true">🧘</span>
          <span style={{ minWidth: 0 }}>
            <span className="display-md" style={{ display: "block" }}>@tasha.b</span>
            <span className="meta" style={{ display: "block" }}>Pilates princess · Long Island City</span>
            <span className="row" style={{ gap: 6, marginTop: 6, flexWrap: "wrap" }}>
              <RankChip rank={RANKS[4]} />
              <span className="tag tag-gold">👑 VIP</span>
            </span>
          </span>
        </div>
        <div className="profile-kpis">
          <span className="profile-kpi"><b>🔥 2.1K</b><span>Clout</span></span>
          <span className="profile-kpi"><b>#128</b><span>In Queens</span></span>
          <span className="profile-kpi"><b>C$84,200</b><span>Net worth</span></span>
        </div>
        <p className="meta" style={{ margin: 0 }}>🏅 6 badges · In the city since Oct 2026 · VIP since Oct 2026</p>
      </div>
    </Sheet>
  );
}

export function VipMock({ screen }: { screen: number }) {
  return (
    <main className="game">
      <Backdrop />
      {screen === 2 ? <SideStory member={false} /> : screen === 3 ? <SideStory member /> : screen === 4 ? <Card /> : <Offer />}
    </main>
  );
}
