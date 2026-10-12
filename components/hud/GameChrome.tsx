"use client";

import { useState } from "react";
import type { ComingSoonKey } from "../ComingSoon";
import {
  BuildingIcon, ChampagneIcon, CheckIcon, ChecklistIcon, ChevronDownIcon, ChevronUpIcon, DiamondIcon,
  FlameIcon, HouseIcon, MapPinIcon, PersonIcon, PhoneIcon, ReceiptIcon, SpeakerOffIcon, StoreIcon,
} from "../icons";

export type ChromeAction = ComingSoonKey | "invite" | "tab:home" | "tab:map";
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
}: {
  time: string;
  tab: Tab;
  onAction: (a: ChromeAction) => void;
  invitePin?: boolean;
  netWorthPin?: boolean;
}) {
  const [statsOpen, setStatsOpen] = useState(true);

  return (
    <>
      <header className="hud glass-dark" aria-label="Status bar">
        <div className="hud-cluster">
          <span className="hud-time" aria-label="City time">{time || " "}</span>
          <button className="hud-btn" onClick={() => onAction("daily")} aria-label="Daily tasks: not open yet">
            <CheckIcon size={20} />
            <span className="hud-number">—/5</span>
          </button>
          <button className="hud-icon-btn" onClick={() => onAction("sound")} aria-label="Music: coming soon">
            <span className="circle"><SpeakerOffIcon size={18} /></span>
          </button>
        </div>
        <div className="hud-cluster">
          <button className="hud-btn hud-clout" onClick={() => onAction("clout")} aria-label="Clout score">
            <FlameIcon size={20} />
            <span className="hud-number">—</span>
          </button>
          <button className="hud-icon-btn" onClick={() => onAction("networth")} aria-label="Net worth">
            <span className="circle"><DiamondIcon size={18} /></span>
            {netWorthPin && <span className="pin-dot" />}
          </button>
          <button className="hud-btn" onClick={() => onAction("bank")} aria-label="Bank balance">
            <span className="hud-number">$—</span>
          </button>
        </div>
      </header>

      <div className="under-hud">
        <button className="pill-glass glass-dark" style={{ position: "relative" }} onClick={() => onAction("invite")}>
          Invite your Clique
          {invitePin && <span className="pin-dot" style={{ top: -2, right: -2 }} />}
        </button>
      </div>

      <nav className="side-col glass-dark" aria-label="Quick actions">
        <button className="side-btn" onClick={() => onAction("tasks")} aria-label="Tasks and goals"><ChecklistIcon /></button>
        <button className="side-btn" onClick={() => onAction("events")} aria-label="Events"><ChampagneIcon /></button>
        <button className="side-btn" onClick={() => onAction("places")} aria-label="Places"><BuildingIcon /></button>
        <button className="side-btn" onClick={() => onAction("bills")} aria-label="Bills"><ReceiptIcon /></button>
        <button className="side-btn" onClick={() => onAction("look")} aria-label="Your look"><PersonIcon /></button>
      </nav>

      <section className={`stats glass-dark${statsOpen ? "" : " collapsed"}`} aria-label="Energy, mood and confidence">
        {statsOpen ? (
          <>
            <button className="stats-toggle" onClick={() => setStatsOpen(false)} aria-label="Collapse stats">
              <ChevronDownIcon size={18} />
            </button>
            {["Energy", "Mood", "Confidence"].map((s) => (
              // No levels until the economy ships (v0.3): the bars show their empty track.
              <button key={s} className="stat-row" onClick={() => onAction("stats")} aria-label={`${s}: coming soon`}>
                <span className="label">{s}</span>
                <span className="stat-track" style={{ display: "block" }} />
              </button>
            ))}
          </>
        ) : (
          <button className="stats-mini" onClick={() => setStatsOpen(true)} aria-label="Expand stats">
            <span className="stat-track" />
            <span className="stat-track" />
            <span className="stat-track" />
            <ChevronUpIcon size={16} />
          </button>
        )}
      </section>

      <nav className="nav glass-dark" aria-label="Main">
        <button className="nav-tab" aria-current={tab === "home" ? "page" : undefined} onClick={() => onAction("tab:home")}>
          <HouseIcon /> Home
        </button>
        <button className="nav-tab" aria-current={tab === "map" ? "page" : undefined} onClick={() => onAction("tab:map")}>
          <MapPinIcon /> Map
        </button>
        <button className="nav-tab" onClick={() => onAction("phone")}>
          <PhoneIcon /> Phone
        </button>
        <button className="nav-tab" onClick={() => onAction("shop")}>
          <StoreIcon /> Shop
        </button>
      </nav>
    </>
  );
}
