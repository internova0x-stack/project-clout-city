"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ECONOMY, formatCash, formatCashShort, formatShort } from "@/lib/economy";
import type { StatKey, StatTip } from "@/lib/recent";
import type { ComingSoonKey } from "../ComingSoon";
import {
  BuildingIcon, ChampagneIcon, ChecklistIcon, ChevronDownIcon, ChevronUpIcon, DiamondIcon,
  HouseIcon, MapPinIcon, PersonIcon, PhoneIcon, ReceiptIcon, SpeakerIcon, SpeakerOffIcon, StoreIcon,
} from "../icons";

export type ChromeAction = ComingSoonKey | "invite" | "tab:home" | "tab:map" | "leaderboard";

export interface ChromeValues {
  clout: number;
  bank: number;
  dailyDone: number;
  dailyTotal: number;
  stats: { energy: number; mood: number; confidence: number };
  muted: boolean;
  online: number | null;
  eventsBadge: boolean;
  billsBadge?: boolean;
  /** v0.11: new tasks today (the first open of each New York day, cleared when tapped). */
  tasksBadge?: boolean;
  phoneBadge?: boolean;
}

const STAT_EMOJI: Record<StatKey, string> = { energy: "⚡", mood: "🙂", confidence: "💪" };
const statLevel = (v: number) => (v >= 60 ? "good" : v >= 30 ? "mid" : "low");
export type Tab = "home" | "map";

/**
 * The home-screen chrome (C1 to C5): persistent HUD, under-HUD pills, the fixed
 * side column, the collapsible stats panel and the bottom nav. Values the
 * economy will fill in later show "—" until v0.2.
 */
export function GameChrome({
  time,
  tab,
  onAction,
  invitePin = false,
  netWorthPin = false,
  values,
  onToggleSound,
  headline = null,
  me,
  tips,
  onTip,
}: {
  time: string;
  tab: Tab;
  onAction: (a: ChromeAction) => void;
  invitePin?: boolean;
  netWorthPin?: boolean;
  /** Live economy values; omitted for screens that don't have them yet. */
  values?: ChromeValues;
  onToggleSound?: () => void;
  /** v0.6 City News: the newest headline, alternating with live activity in the ticker (C22). */
  headline?: { text: string; onOpen: () => void } | null;
  /** v0.7 step 3: the avatar-head bubble beside the collapsed stats; it opens the profile. */
  me?: { head: ReactNode; rank?: number | null; onOpen: () => void };
  /** v0.7 step 3: one place per stat in the expanded panel, each a button. */
  tips?: Record<StatKey, StatTip | null>;
  onTip?: (placeId: string) => void;
}) {
  // Stats start collapsed (v0.7, owner Oct 13); the bubble and three mini bars stay in view.
  const [statsOpen, setStatsOpen] = useState(false);
  // The ticker swaps between the headline and who's online every five seconds.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!headline) return;
    const t = setInterval(() => setTick((n) => n + 1), 5000);
    return () => clearInterval(t);
  }, [headline]);
  const online = values?.online != null && values.online >= ECONOMY.playersOnlineThreshold;
  const showHeadline = !!headline && (!online || tick % 2 === 0);

  return (
    <>
      <header className="hud glass-hud" aria-label="Status bar">
        <div className="hud-cluster">
          <span className="hud-time hud-number" aria-label="City time">
            {time ? <>{time.split(" ")[0]}{time.includes(" ") && <small className="hud-ampm">{time.split(" ").slice(1).join(" ")}</small>}</> : "\u00a0"}
          </span>
          <button className="hud-btn" onClick={() => onAction("daily")} aria-label={values ? `Daily tasks, ${values.dailyDone} of ${values.dailyTotal} done` : "Daily tasks"}>
            <DailyRing done={values?.dailyDone ?? 0} total={values?.dailyTotal ?? 5} />
            <span className="hud-number">{values ? `${values.dailyDone}/${values.dailyTotal}` : "—/5"}</span>
          </button>
          <button
            className="hud-icon-btn"
            onClick={() => (onToggleSound ? onToggleSound() : onAction("sound"))}
            aria-label={values?.muted === false ? "Mute music" : "Play music"}
            aria-pressed={values ? !values.muted : undefined}
          >
            <span className="circle">{values && !values.muted ? <SpeakerIcon size={18} /> : <SpeakerOffIcon size={18} />}</span>
          </button>
        </div>
        <div className="hud-cluster">
          <button className="hud-btn hud-clout" data-tour="clout" onClick={() => onAction(values ? "leaderboard" : "clout")} aria-label="Clout score">
            <FlameFilled size={20} />
            <span className="hud-number">{values ? formatShort(values.clout) : "—"}</span>
          </button>
          <button className="hud-icon-btn" data-tour="money" onClick={() => onAction("networth")} aria-label="Net worth">
            <span className="circle"><DiamondIcon size={18} /></span>
            {netWorthPin && <span className="pin-dot" />}
          </button>
          <button className="hud-btn" data-tour="money" onClick={() => onAction("bank")} aria-label="Bank balance">
            <span className="hud-number">{values ? formatCashShort(values.bank) : "C$—"}</span>
          </button>
        </div>
      </header>

      <div className="under-hud">
        <button className="pill-glass glass-hud" style={{ position: "relative" }} onClick={() => onAction("invite")}>
          Invite your Crew
          {invitePin && <span className="pin-dot" style={{ top: -2, right: -2 }} />}
        </button>
        {showHeadline ? (
          <button className="pill-status glass-hud news-ticker" onClick={headline!.onOpen} key={`h${tick}`}>
            <span aria-hidden="true">📰</span> <span className="news-ticker-text">{headline!.text}</span>
          </button>
        ) : online && (
          <span className="pill-status glass-hud" role="status" key={`o${tick}`}>
            <span className="dot-green" aria-hidden="true" /> {values!.online!.toLocaleString()} {values!.online === 1 ? "person" : "people"} online
          </span>
        )}
      </div>

      {/* v0.11 (owner, Oct 14): stacked just above the bottom bar, TikTok-style: a round button and a label for each. */}
      <nav className="side-col" aria-label="Quick actions">
        <SideBtn label="Tasks" aria={values?.tasksBadge ? "Tasks and goals, new today" : "Tasks and goals"} dot={values?.tasksBadge} onClick={() => onAction("tasks")}><ChecklistIcon /></SideBtn>
        <SideBtn label="Events" aria="Events" dot={values?.eventsBadge} tour="events" onClick={() => onAction("events")}><ChampagneIcon /></SideBtn>
        <SideBtn label="Places" aria="Places" onClick={() => onAction("places")}><BuildingIcon /></SideBtn>
        <SideBtn label="Bills" aria="Bills" dot={values?.billsBadge} onClick={() => onAction("bills")}><ReceiptIcon /></SideBtn>
        <SideBtn label="Look" aria="Your look" onClick={() => onAction("look")}><PersonIcon /></SideBtn>
      </nav>

      {me && !statsOpen && (
        <button className="me-bubble" onClick={me.onOpen} aria-label="Your profile">
          <span className="me-bubble-head">{me.head}</span>
          {me.rank != null && <span className="me-bubble-rank">#{me.rank.toLocaleString()}</span>}
        </button>
      )}
      <section className={`stats glass-hud${statsOpen ? "" : " collapsed"}${me ? " with-bubble" : ""}${statsOpen && tips ? " with-tips" : ""}`} aria-label="Energy, mood and confidence">
        {statsOpen ? (
          <>
            <button className="stats-toggle" onClick={() => setStatsOpen(false)} aria-label="Collapse stats">
              <ChevronDownIcon size={18} />
            </button>
            {(["energy", "mood", "confidence"] as const).map((k) => {
              const label = k[0].toUpperCase() + k.slice(1);
              const v = values?.stats[k];
              const tip = tips?.[k];
              return (
                <div key={k} className="stat-block">
                  <div className="stat-row" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={v}>
                    <span className="label">{STAT_EMOJI[k]} {label}{tips && v !== undefined && <span className="stat-value">{v}</span>}</span>
                    <span className="stat-track" style={{ display: "block" }}>
                      {v !== undefined && <span className={`stat-fill ${statLevel(v)}`} style={{ display: "block", width: `${v}%` }} />}
                    </span>
                  </div>
                  {tip && onTip && (
                    <button className="stat-tip" onClick={() => onTip(tip.placeId)}>
                      <span className="stat-tip-emoji" aria-hidden="true">{tip.emoji}</span>
                      <span className="stat-tip-text">
                        <b>{tip.placeName}</b>
                        {tip.gig ? `Pays ${formatCash(tip.gig.pay)}` : `${tip.price > 0 ? formatCash(tip.price) : "Free"} · +${tip.gain} ${label}`}
                      </span>
                      <span className="stat-tip-go">{tip.gig ? "Open" : "Go"}</span>
                    </button>
                  )}
                </div>
              );
            })}
          </>
        ) : (
          <button className="stats-mini" onClick={() => setStatsOpen(true)} aria-label="Expand stats">
            {(["energy", "mood", "confidence"] as const).map((k) => (
              <span key={k} className="stat-track">
                {values && <span className={`stat-fill ${statLevel(values.stats[k])}`} style={{ display: "block", width: `${values.stats[k]}%` }} />}
              </span>
            ))}
            <ChevronUpIcon size={16} />
          </button>
        )}
      </section>

      <nav className="nav glass-hud" aria-label="Main">
        <button className="nav-tab" aria-current={tab === "home" ? "page" : undefined} onClick={() => onAction("tab:home")}>
          <HouseIcon /> Home
        </button>
        <button className="nav-tab" data-tour="map" aria-current={tab === "map" ? "page" : undefined} onClick={() => onAction("tab:map")}>
          <MapPinIcon /> Map
        </button>
        <button className="nav-tab" data-tour="phone" onClick={() => onAction("phone")}>
          <span style={{ position: "relative", display: "inline-flex" }}>
            <PhoneIcon />
            {values?.phoneBadge && <span className="pin-dot" style={{ top: -2, right: -4 }} />}
          </span>
          Phone
        </button>
        <button className="nav-tab" onClick={() => onAction("shop")}>
          <StoreIcon /> Shop
        </button>
      </nav>
    </>
  );
}

/** Daily tasks: a ring that fills as tasks get done; the tick appears only when all are done. */
function DailyRing({ done, total, size = 22 }: { done: number; total: number; size?: number }) {
  const complete = total > 0 && done >= total;
  const r = 9;
  const c = 2 * Math.PI * r;
  const frac = total > 0 ? Math.min(1, done / total) : 0;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className={`daily-ring${complete ? " complete" : ""}`}>
      {complete ? (
        <>
          <circle cx="12" cy="12" r="10.5" fill="var(--done-green)" />
          <path d="m7.8 12.4 2.9 2.9 5.5-5.8" fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : (
        <>
          <circle cx="12" cy="12" r={r} fill="none" stroke="currentColor" strokeOpacity={0.22} strokeWidth={3} />
          {frac > 0 && (
            <circle cx="12" cy="12" r={r} fill="none" stroke="var(--done-green)" strokeWidth={3} strokeLinecap="round"
              strokeDasharray={`${c * frac} ${c}`} transform="rotate(-90 12 12)" />
          )}
        </>
      )}
    </svg>
  );
}

/** Clout: a solid flame (a warm gradient with a light core). */
function FlameFilled({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <linearGradient id="hud-flame" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFC21A" />
          <stop offset="1" stopColor="#FF6A3D" />
        </linearGradient>
      </defs>
      <path d="M12 2.5c.6 2.7 2.2 4.9 4.2 6.6 2.1 1.8 3.3 3.8 3.3 6.1a7.5 7.5 0 1 1-15 0c0-1.5.5-2.9 1.4-3.9.3 1.6 1.4 2.7 2.8 2.7A2.6 2.6 0 0 0 11.3 11c0-1.2-.4-1.9-.9-2.9-1-2-.2-3.9 1.6-5.6z" fill="url(#hud-flame)" />
      <path d="M12.2 13.2c1.6 1.3 2.6 2.5 2.6 4a2.8 2.8 0 0 1-5.6 0c0-1.3.9-2.6 3-4z" fill="#FFF1C2" opacity={0.9} />
    </svg>
  );
}

function SideBtn({ label, aria, dot, tour, onClick, children }: { label: string; aria: string; dot?: boolean; tour?: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button className="side-btn" data-tour={tour} onClick={onClick} aria-label={aria}>
      <span className="side-ico glass-hud">
        {children}
        {dot && <span className="pin-dot" style={{ top: 2, right: 2 }} />}
      </span>
      <span className="side-lbl" aria-hidden="true">{label}</span>
    </button>
  );
}
