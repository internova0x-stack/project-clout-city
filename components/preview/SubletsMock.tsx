"use client";

// Sublets phase 1 mockup (owner, Oct 26; docs/08 section 25), development only: the screens built from the app's
// own sheets, cards, rows, chips and buttons so spacing and type match the rest of the game. Static sample data;
// nothing here talks to the server. /preview/sublets?s=1..7

import { Sheet } from "../Sheet";
import { Avatar } from "../crew/Crew";
import { ChevronLeftIcon } from "../icons";

function Backdrop() {
  return <div style={{ position: "fixed", inset: 0, background: "var(--g-stage)" }} aria-hidden="true" />;
}

const LISTINGS = [
  { host: "kai_beats", style: "bodega_drip", home: "LIC high-rise", emoji: "🏙️", hood: "Long Island City", rent: 480, weeks: "2 to 6 weeks", rating: "4.9 · 7 stays", crew: "Crew first · 14h", skip: "No 3,000 clout rule" },
  { host: "dev.r", style: "arcade_nerd", home: "Sunnyside Gardens", emoji: "🌳", hood: "Sunnyside", rent: 340, weeks: "1 to 4 weeks", rating: "4.6 · 3 stays", crew: null, skip: "No 1,000 clout rule" },
  { host: "mira.q", style: "pilates_princess", home: "Jackson Heights 1BR", emoji: "🏢", hood: "Jackson Heights", rent: 260, weeks: "Up to 8 weeks", rating: "New host", crew: null, skip: null },
];

function Tabs({ on }: { on: 0 | 1 }) {
  return (
    <div className="segmented" role="group" aria-label="Apartments">
      <button aria-pressed={on === 0}>Rent</button>
      <button aria-pressed={on === 1}>Sublets</button>
    </div>
  );
}

/** 1 · Apartments → Sublets: rooms other players are letting out. */
function SubletList() {
  return (
    <Sheet open onClose={() => {}} label="Apartments" tall>
      <div className="stack-12">
        <h2 className="display-md" style={{ margin: 0, paddingRight: 44 }}>Apartments</h2>
        <Tabs on={1} />
        <p className="subtext" style={{ margin: 0 }}>A spare room in someone&apos;s place. Half the rent at most, no broker fee, no clout rule. Your own lease waits for you.</p>
        <button className="list-row">
          <span style={{ fontSize: 24 }} aria-hidden="true">🔑</span>
          <span style={{ flex: 1, textAlign: "left" }}>
            <span className="title" style={{ display: "block" }}>List your spare room</span>
            <span className="meta">You live in a 1BR or bigger? Let a room out.</span>
          </span>
        </button>
        {LISTINGS.map((l) => (
          <div key={l.host} className="card apt-card stack-8">
            <div className="row" style={{ gap: 12 }}>
              <span className="apt-emoji" aria-hidden="true">{l.emoji}</span>
              <span style={{ minWidth: 0 }}>
                <span className="title" style={{ display: "block" }}>Room in {l.home}</span>
                <span className="meta">{l.hood} · C${l.rent} a week · {l.weeks}</span>
              </span>
            </div>
            <div className="chip-row" style={{ gap: 6 }}>
              {l.crew && <span className="tag tag-event">{l.crew}</span>}
              {l.skip && <span className="tag tag-positive">{l.skip}</span>}
            </div>
            <div className="row" style={{ gap: 8 }}>
              <Avatar style={l.style} size={28} />
              <span className="meta" style={{ flex: 1 }}>@{l.host} · ⭐ {l.rating}</span>
              <button className="btn btn-taxi btn-sm">View</button>
            </div>
          </div>
        ))}
      </div>
    </Sheet>
  );
}

/** 2 · A listing: what it costs now, how long, a note to the host. */
function ListingDetail() {
  const l = LISTINGS[0];
  return (
    <Sheet open onClose={() => {}} label="Sublet" tall>
      <div className="stack-16">
        <button className="link-btn row" style={{ gap: 4 }}><ChevronLeftIcon size={16} /> Sublets</button>
        <div className="row" style={{ gap: 12 }}>
          <span className="apt-emoji" aria-hidden="true">{l.emoji}</span>
          <span style={{ minWidth: 0 }}>
            <h2 className="display-md" style={{ margin: 0 }}>Room in {l.home}</h2>
            <span className="meta">{l.hood} · 32nd floor · river view</span>
          </span>
        </div>
        <div className="row" style={{ gap: 10 }}>
          <Avatar style={l.style} />
          <span style={{ flex: 1 }}>
            <span className="title" style={{ display: "block" }}>Hosted by @{l.host}</span>
            <span className="meta">⭐ {l.rating} · &ldquo;Quiet after 2 AM. Mostly.&rdquo;</span>
          </span>
        </div>
        <div className="stack-4">
          <p className="overline" style={{ margin: 0 }}>How long</p>
          <div className="chip-row">
            {[2, 3, 4, 5, 6].map((w) => <button key={w} className="chip" aria-pressed={w === 4}>{w} weeks</button>)}
          </div>
        </div>
        <div className="card stack-4">
          <div className="row"><span className="body" style={{ flex: 1 }}>First week&apos;s rent</span><b>C$480</b></div>
          <div className="row"><span className="body" style={{ flex: 1 }}>Deposit (always comes back)</span><b>C$480</b></div>
          <div className="row"><span className="body-strong" style={{ flex: 1 }}>Due if they say yes</span><b>C$960</b></div>
          <span className="meta">Then C$480 each Monday, ahead. Your room share is held while you&apos;re away, no rent there.</span>
        </div>
        <div className="crew-bonus">🛏️ You get the second bed. 🤝 Hang out at home once a day for a little clout, both of you.</div>
        <label className="field"><input defaultValue="Neat, quiet, I bring bagels." aria-label="Note to the host" /></label>
        <button className="btn btn-taxi">Apply to @{l.host}</button>
        <p className="meta" style={{ margin: 0, textAlign: "center" }}>Nothing is charged until they accept.</p>
      </div>
    </Sheet>
  );
}

/** 3 · The host lists their spare room. */
function ListRoom() {
  return (
    <Sheet open onClose={() => {}} label="List your spare room" tall>
      <div className="stack-16">
        <div className="stack-4" style={{ paddingRight: 44 }}>
          <h2 className="display-md" style={{ margin: 0 }}>List your spare room</h2>
          <p className="subtext" style={{ margin: 0 }}>🏙️ LIC high-rise · your rent C$1,050 a week</p>
        </div>
        <div className="stack-8">
          <p className="overline" style={{ margin: 0 }}>Weekly rent</p>
          <div className="row" style={{ gap: 12 }}>
            <input type="range" min={263} max={525} defaultValue={480} style={{ flex: 1 }} aria-label="Weekly rent" />
            <b>C$480</b>
          </div>
          <span className="meta">Up to C$525, half your rent. That&apos;s the law. Well, ours.</span>
        </div>
        <div className="stack-4">
          <p className="overline" style={{ margin: 0 }}>Stays of</p>
          <div className="chip-row">
            {[1, 2, 3, 4, 6, 8].map((w) => <button key={w} className="chip" aria-pressed={w >= 2 && w <= 6}>{w}w</button>)}
          </div>
          <span className="meta">2 to 6 weeks. Renewable if you both want.</span>
        </div>
        <div className="crew-bonus">👯 Your crew sees it first for 24 hours, then everyone in the city.</div>
        <div className="card stack-4">
          <span className="body-strong" style={{ display: "block" }}>What you get</span>
          <span className="meta" style={{ display: "block" }}>C$480 every Monday, paid ahead. A one-week deposit is held by the game and goes back to them in full.</span>
          <span className="meta" style={{ display: "block" }}>They sleep in the second bed and can&apos;t move your furniture.</span>
        </div>
        <button className="btn btn-taxi">List it</button>
      </div>
    </Sheet>
  );
}

/** 4 · The host's applications. */
function Applications() {
  const apps = [
    { name: "you.nyc", style: "bodega_drip", tag: "⭐ New · 9 days in the city", note: "Neat, quiet, I bring bagels.", weeks: 4 },
    { name: "lenny.g", style: "midtown_finance", tag: "⭐ 4.2 · 2 stays", note: "I work nights. You won't see me.", weeks: 6 },
  ];
  return (
    <Sheet open onClose={() => {}} label="Your listing" tall>
      <div className="stack-16">
        <div className="stack-4" style={{ paddingRight: 44 }}>
          <h2 className="display-md" style={{ margin: 0 }}>Your spare room</h2>
          <p className="subtext" style={{ margin: 0 }}>Listed · C$480 a week · crew only for 14 more hours</p>
        </div>
        <p className="overline" style={{ margin: 0 }}>2 applications</p>
        {apps.map((a) => (
          <div key={a.name} className="card stack-8">
            <div className="row" style={{ gap: 10 }}>
              <Avatar style={a.style} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span className="title" style={{ display: "block" }}>@{a.name}</span>
                <span className="meta">{a.tag} · {a.weeks} weeks</span>
              </span>
            </div>
            <span className="body" style={{ color: "var(--text-2)" }}>&ldquo;{a.note}&rdquo;</span>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn btn-secondary btn-sm" style={{ flex: 1 }}>Decline</button>
              <button className="btn btn-taxi btn-sm" style={{ flex: 1 }}>Accept</button>
            </div>
          </div>
        ))}
        <button className="link-btn" style={{ alignSelf: "center" }}>Take the listing down</button>
      </div>
    </Sheet>
  );
}

/** 5 · The subtenant's sublet, on top of Apartments. */
function MySublet() {
  return (
    <Sheet open onClose={() => {}} label="Apartments" tall>
      <div className="stack-12">
        <h2 className="display-md" style={{ margin: 0, paddingRight: 44 }}>Apartments</h2>
        <Tabs on={1} />
        <div className="card stack-12">
          <span className="tag tag-positive" style={{ alignSelf: "flex-start" }}>🏠 Subletting</span>
          <div className="row" style={{ gap: 12 }}>
            <span className="apt-emoji" aria-hidden="true">🏙️</span>
            <span style={{ minWidth: 0 }}>
              <span className="title" style={{ display: "block" }}>Room in @kai_beats&apos;s LIC high-rise</span>
              <span className="meta">Week 2 of 4 · ends Sun, Nov 15</span>
            </span>
          </div>
          <div className="stack-4">
            <div className="row"><span className="body" style={{ flex: 1 }}>Next rent · Mon</span><b>C$480</b></div>
            <div className="row"><span className="body" style={{ flex: 1 }}>Deposit held</span><b>C$480</b></div>
            <div className="row"><span className="body" style={{ flex: 1 }}>Your room share</span><b>Held, no rent</b></div>
          </div>
          <button className="list-row">
            <span style={{ fontSize: 24 }} aria-hidden="true">🤝</span>
            <span style={{ flex: 1, textAlign: "left" }}>
              <span className="title" style={{ display: "block" }}>Roommate hang</span>
              <span className="meta">Both home? +10 clout each, once a day.</span>
            </span>
          </button>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-secondary btn-sm" style={{ flex: 1 }}>Leave early</button>
            <button className="btn btn-taxi btn-sm" style={{ flex: 1 }}>Ask to renew</button>
          </div>
          <span className="meta">Leaving early? Your deposit comes back in full. You go home to your room share.</span>
        </div>
      </div>
    </Sheet>
  );
}

/** 6 · The host gives notice: 7 days. */
function GiveNotice() {
  return (
    <Sheet open onClose={() => {}} label="Hosting" tall>
      <div className="stack-16">
        <div className="stack-4" style={{ paddingRight: 44 }}>
          <span className="tag tag-event" style={{ alignSelf: "flex-start" }}>🔑 Hosting</span>
          <h2 className="display-md" style={{ margin: 0 }}>@you.nyc is in your spare room</h2>
          <p className="subtext" style={{ margin: 0 }}>Week 2 of 4 · C$480 a week to you</p>
        </div>
        <div className="card stack-8">
          <span className="title">Notice given</span>
          <div className="row" style={{ gap: 8 }}>
            {Array.from({ length: 7 }, (_, i) => (
              <span key={i} style={{ flex: 1, height: 8, borderRadius: 4, background: i < 2 ? "var(--night-900)" : "var(--chip-off)" }} />
            ))}
          </div>
          <span className="meta">5 days left. They move out Sat, Oct 31 and get their deposit back. No rent after that.</span>
          <button className="btn btn-secondary btn-sm">Take back the notice</button>
        </div>
        <div className="card stack-4">
          <span className="body-strong" style={{ display: "block" }}>Rate @you.nyc</span>
          <div className="row together-stars" style={{ gap: 4 }} role="radiogroup" aria-label="Rating">
            {[1, 2, 3, 4, 5].map((n) => <button key={n} role="radio" aria-checked={n === 4} className={n <= 4 ? "on" : ""}>★</button>)}
          </div>
          <span className="meta">Both of you rate when it ends. Ratings show on listings and applications.</span>
        </div>
      </div>
    </Sheet>
  );
}

/** 7 · Player cards: the sublet line (each side can hide theirs). */
function CardLines() {
  return (
    <Sheet open onClose={() => {}} label="Player">
      <div className="stack-16">
        {[
          { name: "you.nyc", style: "bodega_drip", line: "🏠 Subletting from @kai_beats", hood: "Long Island City" },
          { name: "kai_beats", style: "arcade_nerd", line: "🔑 Hosting @you.nyc", hood: "Long Island City" },
        ].map((c) => (
          <div key={c.name} className="row" style={{ gap: 12 }}>
            <Avatar style={c.style} size={56} />
            <span style={{ minWidth: 0 }}>
              <span className="display-md" style={{ display: "block" }}>@{c.name}</span>
              <span className="meta" style={{ display: "block" }}>{c.hood}</span>
              <span className="partner-line" style={{ marginTop: 6 }}>{c.line}</span>
            </span>
          </div>
        ))}
        <p className="meta" style={{ margin: 0 }}>A switch in the sublet card hides your line. The other person decides theirs.</p>
      </div>
    </Sheet>
  );
}

export function SubletsMock({ screen }: { screen: number }) {
  const S = [SubletList, ListingDetail, ListRoom, Applications, MySublet, GiveNotice, CardLines][Math.max(0, Math.min(6, screen - 1))];
  return (
    <main className="game">
      <Backdrop />
      <S />
    </main>
  );
}
