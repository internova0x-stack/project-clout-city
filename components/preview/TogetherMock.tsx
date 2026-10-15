"use client";

// v0.13 "Better Together" mockup (owner, Oct 15; docs/08 section 16), development only: the screens built
// from the app's own sheets, cards, rows, chips and buttons so spacing and type match the rest of the game.
// Static sample data; nothing here talks to the server. /preview/together?s=1..7

import { Sheet } from "../Sheet";
import { Avatar } from "../crew/Crew";
import { ChevronLeftIcon } from "../icons";

const PEOPLE = [
  { name: "tasha.b", style: "pilates_princess", tag: "Crew · here now" },
  { name: "dev.r", style: "arcade_nerd", tag: "Here now" },
  { name: "kai_beats", style: "bodega_drip", tag: "Crew" },
];

function Backdrop() {
  return <div style={{ position: "fixed", inset: 0, background: "var(--g-stage)" }} aria-hidden="true" />;
}

/** 1 · On a place card: do it together (Ditmars Library, studying). */
function TogetherSheet() {
  return (
    <Sheet open onClose={() => {}} label="Do it together">
      <div className="stack-16">
        <div className="stack-4" style={{ paddingRight: 44 }}>
          <h2 className="display-md" style={{ margin: 0 }}>Do it together</h2>
          <p className="subtext" style={{ margin: 0 }}>📚 Ditmars Library · study</p>
        </div>
        <div className="stack-4">
          <p className="overline" style={{ margin: 0 }}>Who · one person</p>
          {PEOPLE.map((p, i) => (
            <button key={p.name} className="list-row crew-pick" aria-pressed={i === 0}>
              <Avatar style={p.style} />
              <span style={{ flex: 1, textAlign: "left", minWidth: 0 }}>
                <span className="title" style={{ display: "block" }}>@{p.name}</span>
                <span className="meta">{p.tag}</span>
              </span>
              <span className={`crew-check${i === 0 ? " on" : ""}`} aria-hidden="true">✓</span>
            </button>
          ))}
        </div>
        <div className="crew-bonus">
          👯 <b>1.5× confidence and clout</b> for both of you when you&apos;re both here within 10 minutes.<br />
          Up to 5 together bonuses a day.
        </div>
        <button className="btn btn-taxi">Invite @tasha.b</button>
      </div>
    </Sheet>
  );
}

/** 2 · The invite, in Messages → Plans. */
function InviteCard() {
  return (
    <Sheet open onClose={() => {}} label="Plans">
      <div className="stack-16">
        <h2 className="display-md" style={{ margin: 0, paddingRight: 44 }}>Plans</h2>
        <div className="card date-invite stack-12">
          <div className="row" style={{ gap: 12 }}>
            <Avatar style="pilates_princess" size={48} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="overline" style={{ display: "block", color: "var(--neon-text)" }}>Together</span>
              <span className="title" style={{ display: "block" }}>@tasha.b wants to study together at Ditmars Library</span>
              <span className="meta" style={{ display: "block" }}>1.5× confidence and clout for both · free</span>
              <span className="meta" style={{ display: "block" }}>They&apos;re there now · expires at midnight</span>
            </span>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-ghost" style={{ flex: 1 }}>Not now</button>
            <button className="btn btn-green" style={{ flex: 1 }}>I&apos;m in</button>
          </div>
        </div>
        <p className="meta" style={{ margin: 0 }}>&ldquo;I&apos;m in&rdquo; opens Go there. Studying within 10 minutes of each other counts.</p>
      </div>
    </Sheet>
  );
}

/** 3 · Go there, riding together (a crewmate at the same place). */
function RideTogether() {
  return (
    <Sheet open onClose={() => {}} label="Get there">
      <div className="stack-12">
        <div>
          <h2 className="display-md" style={{ margin: 0, paddingRight: 44 }}>Get to Ditmars Library</h2>
          <p className="meta" style={{ margin: "4px 0 0" }}>1.8 mi · from Grind &amp; Gossip</p>
        </div>
        <div className="stack-8" role="radiogroup" aria-label="How to get there">
          <button role="radio" aria-checked={false} className="travel-mode">
            <span className="travel-mode-emoji" aria-hidden="true">🚇</span>
            <span className="travel-mode-text"><b>Subway</b><small>22 s</small></span>
            <span className="travel-mode-price">C$6</span>
          </button>
          <button role="radio" aria-checked className="travel-mode on">
            <span className="travel-mode-emoji" aria-hidden="true">🚕</span>
            <span className="travel-mode-text"><b>Taxi</b><small>21 s</small></span>
            <span className="travel-mode-price">C$35</span>
          </button>
        </div>
        <button className="list-row crew-pick together-ride" aria-pressed>
          <Avatar style="pilates_princess" />
          <span style={{ flex: 1, textAlign: "left", minWidth: 0 }}>
            <span className="title" style={{ display: "block" }}>Ride with @tasha.b</span>
            <span className="meta">Here with you · split the fare, arrive together</span>
          </span>
          <span className="crew-check on" aria-hidden="true">✓</span>
        </button>
        <button className="btn btn-taxi">Go by taxi together · C$18 each</button>
        <p className="meta" style={{ margin: 0, textAlign: "center" }}>They get a ride request and pay their half when they accept.</p>
      </div>
    </Sheet>
  );
}

/** 4 · Both studied: the together bonus. */
function BonusCard() {
  return (
    <div className="modal-wrap" role="dialog" aria-label="Together bonus">
      <div className="scrim" />
      <div className="modal-card modal-light stack-12">
        <span className="tag tag-event">👯 Together bonus</span>
        <p className="display-md" style={{ marginBottom: 0 }}>You studied with @tasha.b</p>
        <div>
          <div className="list-row static"><span style={{ flex: 1 }}>Confidence</span><b>+8 <span className="meta">(5 × 1.5)</span></b></div>
          <div className="list-row static"><span style={{ flex: 1 }}>Clout</span><b>+15 <span className="meta">(10 × 1.5)</span></b></div>
        </div>
        <p className="meta" style={{ margin: 0 }}>They got the same. 4 of 5 together bonuses left today.</p>
        <button className="btn btn-taxi">Nice</button>
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

/** 5 · Jobs app: find work. */
function JobsWork() {
  return (
    <PhoneFrame>
      <div className="stack-12">
        <div>
          <button className="phone-back"><ChevronLeftIcon size={20} /> Home</button>
          <h2 className="display-lg" style={{ margin: "4px 0 4px" }}>Jobs</h2>
          <p className="subtext" style={{ margin: 0 }}>Make yourself useful. Get paid, get rated, get clout.</p>
        </div>
        <div className="row" style={{ gap: 8 }} role="tablist">
          <button className="chip" aria-pressed>Find work</button>
          <button className="chip" aria-pressed={false}>Hire someone</button>
        </div>
        <div className="card stack-8">
          <div className="row" style={{ gap: 12 }}>
            <Avatar style="pilates_princess" size={44} />
            <span style={{ minWidth: 0 }}>
              <span className="title" style={{ display: "block" }}>Decorate my high-rise</span>
              <span className="meta">@nina.nyc · Long Island City · ⭐ 4.9</span>
            </span>
          </div>
          <div><span className="tag tag-event">🛋️ Interior decorator</span></div>
          <span className="subtext">&ldquo;Make it look like I have taste. 30 minutes, go.&rdquo;</span>
          <span className="biz-price"><b>C$2,500</b> + 25 clout · held until they approve</span>
          <button className="btn btn-taxi">Take the job</button>
        </div>
        <div className="card stack-8">
          <div className="row" style={{ gap: 12 }}>
            <Avatar style="arcade_nerd" size={44} />
            <span style={{ minWidth: 0 }}>
              <span className="title" style={{ display: "block" }}>Run my tills</span>
              <span className="meta">@dev.r · 4 businesses · ⭐ 4.7</span>
            </span>
          </div>
          <div><span className="tag tag-neutral">💼 Business manager</span></div>
          <span className="biz-price"><b>12%</b> of what you collect · about C$4,300 a day</span>
          <button className="btn btn-secondary">Apply</button>
        </div>
      </div>
    </PhoneFrame>
  );
}

/** 6 · Jobs app: hire someone. */
function JobsHire() {
  return (
    <PhoneFrame>
      <div className="stack-12">
        <div>
          <button className="phone-back"><ChevronLeftIcon size={20} /> Home</button>
          <h2 className="display-lg" style={{ margin: "4px 0 4px" }}>Jobs</h2>
          <p className="subtext" style={{ margin: 0 }}>Post a job; real players take it.</p>
        </div>
        <div className="row" style={{ gap: 8 }} role="tablist">
          <button className="chip" aria-pressed={false}>Find work</button>
          <button className="chip" aria-pressed>Hire someone</button>
        </div>
        <div className="stack-8" role="radiogroup" aria-label="Job">
          <button role="radio" aria-checked className="travel-mode on">
            <span className="travel-mode-emoji" aria-hidden="true">🛋️</span>
            <span className="travel-mode-text"><b>Interior decorator</b><small>Arranges your home · you approve or undo</small></span>
          </button>
          <button role="radio" aria-checked={false} className="travel-mode">
            <span className="travel-mode-emoji" aria-hidden="true">💼</span>
            <span className="travel-mode-text"><b>Business manager</b><small>Collects your tills · never touches your cash</small></span>
          </button>
        </div>
        <div className="stack-8">
          <p className="overline" style={{ margin: 0 }}>Pay</p>
          <div className="option-chips together-pay">
            {["C$500", "C$1,000", "C$2,500", "C$5,000"].map((x, i) => <button key={x} className="chip" aria-pressed={i === 2}>{x}</button>)}
          </div>
          <p className="meta" style={{ margin: "4px 0 0" }}>Held by the city and paid when you approve (or after 24 hours). Plus 25 clout for them.</p>
        </div>
        <button className="btn btn-taxi">Post the job · C$2,500</button>
        <div className="card stack-4">
          <span className="overline">Your jobs</span>
          <div className="list-row static">
            <Avatar style="arcade_nerd" size={36} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="title" style={{ display: "block", fontSize: 15 }}>@dev.r is decorating</span>
              <span className="meta">18 minutes left</span>
            </span>
            <span className="tag tag-event">Live</span>
          </div>
        </div>
      </div>
    </PhoneFrame>
  );
}

/** 7 · The decorator finished: keep it or undo, and rate. */
function ApproveCard() {
  return (
    <div className="modal-wrap" role="dialog" aria-label="Decorating done">
      <div className="scrim" />
      <div className="modal-card modal-light stack-12">
        <span className="tag tag-event">🛋️ Decorating done</span>
        <div className="row" style={{ gap: 12 }}>
          <Avatar style="arcade_nerd" size={44} />
          <span style={{ minWidth: 0 }}>
            <span className="title" style={{ display: "block" }}>@dev.r rearranged your place</span>
            <span className="meta">14 pieces moved · 26 minutes</span>
            <span className="meta" style={{ display: "block" }}>⭐ 4.8 · hired 12 times</span>
          </span>
        </div>
        <div className="stack-4">
          <p className="overline" style={{ margin: 0 }}>Rate the job</p>
          <div className="row together-stars" style={{ gap: 4 }} role="radiogroup" aria-label="Rating">
            {[1, 2, 3, 4, 5].map((n) => <button key={n} role="radio" aria-checked={n === 5} className={n <= 5 ? "on" : ""}>★</button>)}
          </div>
        </div>
        <p className="meta" style={{ margin: 0 }}>Keep it and they get C$2,500 and 25 clout. Undo puts every piece back, free.</p>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn btn-secondary" style={{ flex: 1 }}>Undo it all</button>
          <button className="btn btn-taxi" style={{ flex: 1 }}>Keep it</button>
        </div>
      </div>
    </div>
  );
}

export function TogetherMock({ screen }: { screen: number }) {
  const S = [TogetherSheet, InviteCard, RideTogether, BonusCard, JobsWork, JobsHire, ApproveCard][Math.max(0, Math.min(6, screen - 1))];
  return (
    <main className="game">
      <Backdrop />
      <S />
    </main>
  );
}
