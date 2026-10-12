"use client";

import { useState } from "react";
import { GIG_TITLES } from "@/lib/city";
import { activeGig, gigAvailability, gigReady, type CityState, type GigOffer } from "@/lib/cityState";
import { formatCash } from "@/lib/economy";
import { LedgerList } from "../game/Sheets";
import { ChevronLeftIcon, CloseIcon } from "../icons";
import { formatCountdown, useGameNow } from "./Common";

type App = "gigs" | "bank" | "settings" | "news" | "messages";

const APPS: { id: App; label: string; emoji: string; bg: string; soon?: boolean }[] = [
  { id: "news", label: "News", emoji: "📰", bg: "linear-gradient(160deg,#FF2E88,#B0135A)", soon: true },
  { id: "messages", label: "Messages", emoji: "💬", bg: "linear-gradient(160deg,#5BE07A,#2E8B63)", soon: true },
  { id: "bank", label: "Bank", emoji: "💵", bg: "linear-gradient(160deg,#6CD4A6,#1F6B4A)" },
  { id: "gigs", label: "Gigs", emoji: "💼", bg: "linear-gradient(160deg,#FFC21A,#E8692E)" },
  { id: "settings", label: "Settings", emoji: "⚙️", bg: "linear-gradient(160deg,#9AA0AA,#4F4A56)" },
];

const TIER_TAG: Record<GigOffer["tier"], { label: string; cls: string }> = {
  side: { label: "Side gig", cls: "tag-neutral" },
  pro: { label: "Pro gig", cls: "tag-pro" },
  big: { label: "Big break", cls: "tag-event" },
};

/** C29: the Phone, with the Gigs, Bank and Settings apps (News and Messages arrive later). */
export function PhoneModal({
  open, onClose, time, state, busy, onAccept, onCollect, muted, onToggleSound, initialApp,
}: {
  open: boolean;
  onClose: () => void;
  time: string;
  state: CityState | null;
  busy: string | null;
  onAccept: (id: number) => void;
  onCollect: (id: number) => void;
  muted: boolean;
  onToggleSound: () => void;
  initialApp?: App | null;
}) {
  const [app, setApp] = useState<App | null>(initialApp ?? null);
  const [lastInitial, setLastInitial] = useState(initialApp);
  if (initialApp !== lastInitial) {
    setLastInitial(initialApp);
    setApp(initialApp ?? null);
  }
  const now = useGameNow(state?.clockOffsetSeconds ?? 0);
  if (!open) return null;
  const ready = state ? activeGig(state) : undefined;
  const payoutReady = !!ready && gigReady(ready, now);

  return (
    <div className="modal-wrap phone-wrap" role="dialog" aria-modal="true" aria-label="Phone">
      <div className="scrim" onClick={onClose} aria-hidden="true" />
      <button className="icon-round phone-close" onClick={onClose} aria-label="Close phone"><CloseIcon size={18} /></button>
      <div className="phone-device">
        <div className="phone-screen">
          <div className={`phone-status${app ? " light" : ""}`}>
            <span>{time}</span>
            <span className="phone-pill" aria-hidden="true" />
            <span aria-hidden="true">▂▄▆ 🔋</span>
          </div>
          {app === null ? (
            <div className="phone-home">
              <div className="phone-clock">{time.replace(/ [AP]M$/, "") || "9:41"}</div>
              <div className="phone-city">Queens</div>
              <div className="phone-grid">
                {APPS.map((a) => (
                  <button key={a.id} className="phone-app" onClick={() => setApp(a.id)}>
                    <span className="phone-icon" style={{ background: a.bg }} aria-hidden="true">
                      {a.emoji}
                      {a.id === "gigs" && payoutReady && <span className="pin-dot" style={{ top: -3, right: -3 }} />}
                    </span>
                    <span>{a.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="phone-app-screen">
              <button className="phone-back" onClick={() => setApp(null)}><ChevronLeftIcon size={20} /> Home</button>
              <h2 className="display-lg" style={{ margin: "4px 0 12px" }}>{APPS.find((a) => a.id === app)!.label}</h2>
              {app === "gigs" && (state ? <GigsApp state={state} now={now} busy={busy} onAccept={onAccept} onCollect={onCollect} /> : <Soon text="Gigs open with the city." />)}
              {app === "bank" && (
                <div className="stack-12">
                  {state && <div className="card"><span className="meta">Balance</span><span className="display-md" style={{ display: "block" }}>{formatCash(state.player.bank_cash)}</span></div>}
                  <LedgerList refreshKey={state?.player.bank_cash} />
                </div>
              )}
              {app === "settings" && (
                <div className="stack-12">
                  <div className="list-row static">
                    <span style={{ flex: 1 }}><span className="title" style={{ display: "block" }}>Music</span><span className="meta">Lo-fi city loop</span></span>
                    <button className="chip" aria-pressed={!muted} onClick={onToggleSound}>{muted ? "Off" : "On"}</button>
                  </div>
                  <form action="/auth/signout" method="post"><button className="btn btn-secondary" type="submit">Log out</button></form>
                </div>
              )}
              {app === "news" && <Soon text="Lola Lowdown is still fact-checking. Barely. The News app opens soon." />}
              {app === "messages" && <Soon text="The group chat is on mute until the city is ready to gossip. Messages arrive soon." />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Soon({ text }: { text: string }) {
  return (
    <div className="card hazard-edge stack-4" style={{ paddingLeft: 22 }}>
      <p className="overline" style={{ margin: 0 }}>Coming soon</p>
      <p className="body" style={{ margin: 0, color: "var(--text-2)" }}>{text}</p>
    </div>
  );
}

const blurbFor = (g: GigOffer) => GIG_TITLES[g.tier].find((t) => t.title === g.title)?.blurb ?? "";

/** C36: today's offers and the active gig. */
function GigsApp({ state, now, busy, onAccept, onCollect }: { state: CityState; now: number; busy: string | null; onAccept: (id: number) => void; onCollect: (id: number) => void }) {
  const active = activeGig(state);
  const offers = state.gigs.filter((g) => !g.accepted_at && g.ny_date === state.today);
  const done = state.gigs.filter((g) => g.collected_at && g.ny_date === state.today);
  return (
    <div className="stack-12">
      {active && (() => {
        const total = active.wait_minutes * 60_000;
        const left = new Date(active.ready_at!).getTime() - now;
        const pct = Math.min(100, Math.max(0, ((total - left) / total) * 100));
        const ready = left <= 0;
        return (
          <div className="gig-card active">
            <span className={`tag ${TIER_TAG[active.tier].cls}`}>{TIER_TAG[active.tier].label} · In progress</span>
            <span className="title" style={{ display: "block" }}>{active.title}</span>
            <div className="gig-progress"><span style={{ width: `${pct}%` }} /></div>
            {ready ? (
              <button className="btn btn-green btn-sm" disabled={busy !== null} onClick={() => onCollect(active.id)}>
                {busy === `gig:${active.id}` ? "…" : `Collect ${formatCash(active.pay)}`}
              </button>
            ) : (
              <span className="meta">⏱ {formatCountdown(left)} left · pays {formatCash(active.pay)}</span>
            )}
          </div>
        );
      })()}
      {offers.length === 0 && !active && <p className="subtext">No offers left today. New ones land after midnight.</p>}
      {offers.map((g) => {
        const av = gigAvailability(g, state);
        const locked = state.player.confidence < g.confidence_req;
        return (
          <div key={g.id} className={`gig-card${locked ? " locked" : ""}`}>
            <span className={`tag ${TIER_TAG[g.tier].cls}`}>{locked ? "🔒 " : ""}{TIER_TAG[g.tier].label}</span>
            <span className="title" style={{ display: "block" }}>{g.title}</span>
            <span className="subtext">{blurbFor(g)}</span>
            <span className="meta gig-meta">
              <span className="money-pos">{formatCash(g.pay)}</span> · ⚡ −{g.energy} · ⏱ {g.wait_minutes >= 60 ? `${g.wait_minutes / 60} h` : `${g.wait_minutes} min`}
            </span>
            {!av.ok && <span className="meta reason">{av.reason}</span>}
            <button className="btn btn-green btn-sm" disabled={!av.ok || busy !== null} onClick={() => onAccept(g.id)}>
              {busy === `gig:${g.id}` ? "…" : "Take the gig"}
            </button>
            <span className="meta">Expires at midnight.</span>
          </div>
        );
      })}
      {done.length > 0 && <p className="meta">Paid today: {done.map((g) => formatCash(g.pay)).join(", ")}</p>}
    </div>
  );
}
