"use client";

// "Players don't know what to do" (owner, Oct 26): mockups of suggestions 2 to 6, development only, built from the game's
// own sheets, cards, rows and Lola's bubble. Static sample data; nothing talks to the server. /preview/onboarding?s=1..6
//   1 · The goal card (suggestion 2)          4 · "What now?" (suggestion 4)
//   2 · Unlocks on the Phone (suggestion 3)   5 · Tasks open on day one (suggestion 5)
//   3 · A new feature unlocks (suggestion 3)  6 · Shorter tour lines (suggestion 6)

import { LOLA_PORTRAIT } from "@/lib/cast";
import { Sheet } from "../Sheet";

function Backdrop() {
  return <div style={{ position: "fixed", inset: 0, background: "var(--g-stage)" }} aria-hidden="true" />;
}

function Lola({ size = 44 }: { size?: number }) {
  return <span className="lola-tip-head" style={{ width: size, height: size, position: "relative", flex: "none" }} aria-hidden="true">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={LOLA_PORTRAIT} alt="" width={size} height={size} /></span>;
}

function Bar({ value }: { value: number }) {
  return <div className="home-score-bar" aria-hidden="true"><i style={{ width: `${value}%`, background: "var(--neon-500)" }} /></div>;
}

/** 1 · Suggestion 2: the goal. Tapping the clout flame (or the rank chip) opens it. */
function GoalCard() {
  return (
    <Sheet open onClose={() => {}} label="Your goal" tall>
      <div className="stack-16">
        <div className="stack-4" style={{ paddingRight: 44 }}>
          <span className="overline">Your goal</span>
          <h2 className="display-md" style={{ margin: 0 }}>Become a Queens somebody</h2>
          <span className="meta">Clout opens the city. Every rank unlocks something new.</span>
        </div>
        <div className="card stack-8">
          <div className="row" style={{ gap: 10 }}>
            <span style={{ fontSize: 28 }} aria-hidden="true">🍜</span>
            <span style={{ flex: 1 }}>
              <span className="meta" style={{ display: "block" }}>You&apos;re</span>
              <b>Ramen Noodle Era</b>
            </span>
            <span aria-hidden="true">→</span>
            <span style={{ fontSize: 28 }} aria-hidden="true">🎓</span>
            <span style={{ flex: 1 }}>
              <span className="meta" style={{ display: "block" }}>Next</span>
              <b>Student Loan Survivor</b>
            </span>
          </div>
          <Bar value={62} />
          <span className="meta">🔥 62 of 100 clout · 38 to go</span>
        </div>
        <div className="stack-8">
          <p className="overline" style={{ margin: 0 }}>Fastest ways there</p>
          {[
            ["🥯", "Breakfast at Sal's Deli", "+12 clout · C$9 · 2 min walk"],
            ["💼", "Take a side gig", "+15 clout and C$120"],
            ["✅", "Finish today's 5 tasks", "+40 clout bonus"],
          ].map(([e, t, m]) => (
            <button key={t} className="list-row">
              <span style={{ fontSize: 24 }} aria-hidden="true">{e}</span>
              <span style={{ flex: 1, textAlign: "left" }}>
                <span className="title" style={{ display: "block" }}>{t}</span>
                <span className="meta">{m}</span>
              </span>
              <span className="btn btn-taxi btn-sm">Go</span>
            </button>
          ))}
        </div>
        <div className="card stack-4">
          <span className="body-strong" style={{ display: "block" }}>Coming up</span>
          <span className="meta" style={{ display: "block" }}>🎓 Rank 2 · 100 clout: Businesses and the Jobs board</span>
          <span className="meta" style={{ display: "block" }}>💼 Rank 3 · 500 clout: pro gigs and Sunnyside apartments</span>
          <span className="meta" style={{ display: "block" }}>💬 Rank 4 · 1,000 clout: club VIP floors and house parties</span>
        </div>
      </div>
    </Sheet>
  );
}

const APPS: [string, string, string | null][] = [
  ["📰", "News", null], ["💬", "Messages", null], ["💵", "Bank", null], ["💼", "Gigs", null],
  ["🍵", "Tea", null], ["🔑", "Apartments", null], ["🏪", "Businesses", "Rank 2"], ["🛋️", "Jobs", "Rank 2"],
  ["📻", "Radio", "Day 3"], ["📺", "Clout TV", "Day 3"], ["🎓", "Campus", "Rank 3"], ["🏛️", "Mayor", null],
];

/** 2 · Suggestion 3: day one is simple. Later apps show a lock and when they open. */
function PhoneUnlocks() {
  return (
    <div className="modal-wrap" role="dialog" aria-label="Phone">
      <div className="scrim" />
      <div className="phone-device" style={{ margin: "40px auto 0" }}>
        <div className="phone-screen">
          <div className="phone-home">
            <div className="phone-clock">9:41</div>
            <div className="phone-city">Queens</div>
            <div className="phone-grid" style={{ marginTop: 24 }}>
              {APPS.map(([e, l, lock]) => (
                <button key={l} className="phone-app" style={{ opacity: lock ? 0.45 : 1 }}>
                  <span className="phone-icon" style={{ background: lock ? "rgba(255,255,255,.18)" : "linear-gradient(135deg,#FF2E88,#FFC21A)", position: "relative" }} aria-hidden="true">
                    {e}
                  </span>
                  <span>{l}{lock && <small style={{ display: "block", opacity: 0.85 }}>🔒 {lock}</small>}</span>
                </button>
              ))}
            </div>
            <p style={{ textAlign: "center", opacity: 0.8, fontSize: 13, marginTop: 16 }}>More apps open as you rank up and keep coming back.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/** 3 · Suggestion 3: something new opens, and Lola says what it's for. */
function UnlockReveal() {
  return (
    <div className="modal-wrap" role="dialog" aria-label="New">
      <div className="scrim" />
      <div className="modal-card modal-light stack-12" style={{ textAlign: "center" }}>
        <span className="tag tag-event" style={{ alignSelf: "center" }}>✨ New for you</span>
        <span style={{ fontSize: 56 }} aria-hidden="true">🏪</span>
        <h2 className="display-md" style={{ margin: 0 }}>Businesses are open</h2>
        <div className="row" style={{ gap: 10, textAlign: "left", alignItems: "flex-start" }}>
          <Lola />
          <p className="body" style={{ margin: 0, color: "var(--text-2)" }}>
            Student Loan Survivor, look at you 💅 Buy a little hustle, it earns while you sleep. Start with the coffee cart.
          </p>
        </div>
        <button className="btn btn-taxi">Show me</button>
        <button className="link-btn" style={{ alignSelf: "center" }}>Later</button>
      </div>
    </div>
  );
}

/** 4 · Suggestion 4: Lola's "What now?" button, always on the home screen, picks the best thing to do right now. */
function WhatNow() {
  return (
    <>
      <button className="pill-glass glass-hud" style={{ position: "fixed", left: 16, bottom: 210, display: "flex", gap: 8, alignItems: "center", zIndex: 5 }}>
        <Lola size={28} /> What now?
      </button>
      <Sheet open onClose={() => {}} label="What now?">
        <div className="stack-16">
          <div className="row" style={{ gap: 10, paddingRight: 44 }}>
            <Lola />
            <span className="body">Babe, rent&apos;s due tomorrow and you&apos;re C$80 short. Do this first:</span>
          </div>
          <div className="card stack-8">
            <span className="tag tag-event" style={{ alignSelf: "flex-start" }}>Best right now</span>
            <div className="row" style={{ gap: 10 }}>
              <span style={{ fontSize: 28 }} aria-hidden="true">💼</span>
              <span style={{ flex: 1 }}>
                <b style={{ display: "block" }}>Take the barista gig</b>
                <span className="meta">Pays C$120 · 3 min · covers the rent</span>
              </span>
            </div>
            <button className="btn btn-taxi">Go</button>
          </div>
          <div className="stack-8">
            <p className="overline" style={{ margin: 0 }}>Also good</p>
            {[["🥯", "Breakfast at Sal's", "+25 Energy · it's the first of today's tasks"], ["💬", "Reply to @tasha.b", "She asked you to the party Friday"]].map(([e, t, m]) => (
              <button key={t} className="list-row">
                <span style={{ fontSize: 22 }} aria-hidden="true">{e}</span>
                <span style={{ flex: 1, textAlign: "left" }}>
                  <span className="title" style={{ display: "block" }}>{t}</span>
                  <span className="meta">{m}</span>
                </span>
                <span className="meta">›</span>
              </button>
            ))}
          </div>
        </div>
      </Sheet>
    </>
  );
}

/** 5 · Suggestion 5: on day one the tasks open by themselves after the first party, with a line from Lola. */
function TasksDayOne() {
  return (
    <Sheet open onClose={() => {}} label="Today's tasks" tall>
      <div className="stack-16">
        <div className="row" style={{ gap: 10, paddingRight: 44 }}>
          <Lola />
          <span className="body">Your first day 🗽 Do these five and the city pays you. New list every morning.</span>
        </div>
        <div className="stack-8">
          {[
            ["🥯", "Get a bacon, egg and cheese at Sal's", "+C$30 · +10 clout", true],
            ["🐈", "Pet the deli cat", "+5 clout", false],
            ["🏃", "Run a lap in Astoria Park", "+C$20 · +8 clout", false],
            ["🍵", "Find a piece of gossip", "+15 clout", false],
            ["🎯", "Practice a skill", "+C$25", false],
          ].map(([e, t, m, done]) => (
            <div key={String(t)} className="list-row" style={{ opacity: done ? 0.55 : 1 }}>
              <span style={{ fontSize: 24 }} aria-hidden="true">{done ? "✅" : e}</span>
              <span style={{ flex: 1 }}>
                <span className="title" style={{ display: "block", textDecoration: done ? "line-through" : "none" }}>{t}</span>
                <span className="meta">{m}</span>
              </span>
              {!done && <span className="btn btn-taxi btn-sm">Go</span>}
            </div>
          ))}
        </div>
        <div className="crew-bonus">🎁 All five today: +C$150 and +40 clout.</div>
      </div>
    </Sheet>
  );
}

const TOUR_LINES: [string, string, string][] = [
  ["Welcome", "BREAKING 🚨 A new face just landed in New York, and sources tell me it's you. I'm Lola Lowdown 💋 I know everyone worth knowing, and now I know you. Let me show you around ✨",
    "Welcome to NYC 🗽 I'm Lola, I know everyone. Quick tour?"],
  ["Clout", "That flame 🔥 is your clout: how much New York cares that you exist. Current status? Unconfirmed, babe. We're working on it 💅",
    "🔥 Clout = how much the city cares. More clout, more doors open."],
  ["Money", "Your money, sweetie 💸 Rent, fits and the occasional \"tip\" for a bouncer all come out of here, and rent comes around fast. The diamond 💎 is your net worth: everything you own, on the record.",
    "💸 Your cash. Rent's due every week, so keep some handy."],
  ["Map", "This is the map 🗺️ You're starting in Queens. The rest of New York stays locked 🔒 until you're interesting enough. Insiders say it won't take long 👀",
    "🗺️ Tap a place to go. Queens first; the rest unlocks later."],
  ["Phone", "Your phone 📱 Updates, invites and my tea 🍵 land here first. Chile, keep it charged. You'll want to see what's coming.",
    "📱 Gigs, messages and my gossip live in here."],
];

/** 6 · Suggestion 6: the tour, one short line a step. The new card, then every line before and after. */
function ShortTour() {
  return (
    <>
      <div className="lola-tip" style={{ bottom: "auto", top: 90 }}>
        <div className="lola-tip-bubble">
          <p className="lola-tip-who">Lola Lowdown <span>· 2 of 6</span></p>
          <p className="lola-tip-text">🔥 Clout = how much the city cares. More clout, more doors open.</p>
          <button className="btn btn-taxi lola-tip-next">Next</button>
        </div>
        <div className="lola-tip-head" aria-hidden="true">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={LOLA_PORTRAIT} alt="" width={64} height={64} /><span className="lola-tip-kiss">💋</span></div>
      </div>
      <div className="card stack-12" style={{ position: "fixed", left: 12, right: 12, bottom: 16, maxHeight: "58vh", overflow: "auto", zIndex: 62, background: "#FFF8F2", color: "var(--text-1)" }}>
        <span className="overline">Every line, before → after</span>
        {TOUR_LINES.map(([k, before, after]) => (
          <div key={k} className="stack-4">
            <b style={{ color: "var(--text-1)" }}>{k}</b>
            <span className="meta" style={{ textDecoration: "line-through", display: "block", color: "var(--text-3)" }}>{before}</span>
            <span className="body" style={{ display: "block", color: "var(--text-1)", fontWeight: 600 }}>{after}</span>
          </div>
        ))}
      </div>
    </>
  );
}

export function OnboardingMock({ screen }: { screen: number }) {
  const S = [GoalCard, PhoneUnlocks, UnlockReveal, WhatNow, TasksDayOne, ShortTour][Math.max(0, Math.min(5, screen - 1))];
  return (
    <main className="game">
      <Backdrop />
      <S />
    </main>
  );
}
