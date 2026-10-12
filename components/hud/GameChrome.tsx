"use client";

import { useState } from "react";
import { ECONOMY, formatCash } from "@/lib/economy";
import type { ComingSoonKey } from "../ComingSoon";
import {
  BuildingIcon, ChampagneIcon, CheckIcon, ChecklistIcon, ChevronDownIcon, ChevronUpIcon, DiamondIcon,
  FlameIcon, HouseIcon, MapPinIcon, PersonIcon, PhoneIcon, ReceiptIcon, SpeakerIcon, SpeakerOffIcon, StoreIcon,
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
}

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
}: {
  time: string;
  tab: Tab;
  onAction: (a: ChromeAction) => void;
  invitePin?: boolean;
  netWorthPin?: boolean;
  /** Live economy values; omitted for screens that don't have them yet. */
  values?: ChromeValues;
  onToggleSound?: () => void;
}) {
  const [statsOpen, setStatsOpen] = useState(true);

  return (
    <>
      <header className="hud glass-dark" aria-label="Status bar">
        <div className="hud-cluster">
          <span className="hud-time" aria-label="City time">{time || " "}</span>
          <button className="hud-btn" onClick={() => onAction("daily")} aria-label="Daily tasks">
            <CheckIcon size={20} />
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
            <FlameIcon size={20} />
            <span className="hud-number">{values ? values.clout.toLocaleString() : "—"}</span>
          </button>
          <button className="hud-icon-btn" data-tour="money" onClick={() => onAction("networth")} aria-label="Net worth">
            <span className="circle"><DiamondIcon size={18} /></span>
            {netWorthPin && <span className="pin-dot" />}
          </button>
          <button className="hud-btn" data-tour="money" onClick={() => onAction("bank")} aria-label="Bank balance">
            <span className="hud-number">{values ? formatCash(values.bank) : "$—"}</span>
          </button>
        </div>
      </header>

      <div className="under-hud">
        <button className="pill-glass glass-dark" style={{ position: "relative" }} onClick={() => onAction("invite")}>
          Invite your Clique
          {invitePin && <span className="pin-dot" style={{ top: -2, right: -2 }} />}
        </button>
        {values?.online != null && values.online >= ECONOMY.playersOnlineThreshold && (
          <span className="pill-status glass-dark" role="status">
            <span className="dot-green" aria-hidden="true" /> {values.online.toLocaleString()} {values.online === 1 ? "person" : "people"} online
          </span>
        )}
      </div>

      <nav className="side-col glass-dark" aria-label="Quick actions">
        <button className="side-btn" onClick={() => onAction("tasks")} aria-label="Tasks and goals"><ChecklistIcon /></button>
        <button className="side-btn" data-tour="events" onClick={() => onAction("events")} aria-label="Events">
          <ChampagneIcon />
          {values?.eventsBadge && <span className="pin-dot" style={{ top: 6, right: 6 }} />}
        </button>
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
            {(["energy", "mood", "confidence"] as const).map((k) => {
              const label = k[0].toUpperCase() + k.slice(1);
              const v = values?.stats[k];
              return (
                <div key={k} className="stat-row" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={v}>
                  <span className="label">{label}</span>
                  <span className="stat-track" style={{ display: "block" }}>
                    {v !== undefined && <span className={`stat-fill ${statLevel(v)}`} style={{ display: "block", width: `${v}%` }} />}
                  </span>
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

      <nav className="nav glass-dark" aria-label="Main">
        <button className="nav-tab" aria-current={tab === "home" ? "page" : undefined} onClick={() => onAction("tab:home")}>
          <HouseIcon /> Home
        </button>
        <button className="nav-tab" data-tour="map" aria-current={tab === "map" ? "page" : undefined} onClick={() => onAction("tab:map")}>
          <MapPinIcon /> Map
        </button>
        <button className="nav-tab" data-tour="phone" onClick={() => onAction("phone")}>
          <PhoneIcon /> Phone
        </button>
        <button className="nav-tab" onClick={() => onAction("shop")}>
          <StoreIcon /> Shop
        </button>
      </nav>
    </>
  );
}
