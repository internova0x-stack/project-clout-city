"use client";

import { LOOK_LABEL, lookBadge } from "@/lib/style";
import dynamic from "next/dynamic";
import { nyerLabel, type Look } from "@/lib/look";
import type { Outfit } from "@/lib/styles";
import { formatCash, formatShort } from "@/lib/economy";
import { recentLine, recentWhen, type RecentItem } from "@/lib/recent";
import { RankClimb } from "./Ranks";
import { Sheet } from "../Sheet";
import { ProfileVip } from "../store/Membership";

const Avatar3D = dynamic(() => import("../avatar/Avatar3D"), { ssr: false });

/**
 * Your profile (v0.7 step 3): the avatar edge to edge at the top of the sheet, then the numbers
 * that matter, badges, collections and crew, and "Recently", which other players see too.
 */
export function ProfileSheet({
  open, onClose, look, outfit, name, subtitle, looks, clout, rank, netWorth, bestRank, badges, collections, crew, recent,
  onOpenCollection, onOpenNetWorth, onOpenLeaderboard, vip,
}: {
  open: boolean;
  onClose: () => void;
  look: Look;
  outfit?: Outfit;
  name: string;
  subtitle: string;
  /** Migration 0100: the style lines worn as a full look (3+ pieces), shown under the name. */
  looks?: string[];
  clout: number;
  rank: number | null;
  netWorth: number;
  /** v0.12: the highest rank reached (migration 0048), for "Best: …". */
  bestRank?: number;
  badges: { id: string; emoji: string; name: string }[];
  collections: { postcards: { owned: number; total: number } | null; huntCards: number };
  crew: string[];
  /** Absent until migration 0020 is applied. */
  recent?: RecentItem[];
  onOpenCollection?: () => void;
  onOpenNetWorth?: () => void;
  onOpenLeaderboard?: () => void;
  /** Membership (owner, Oct 18): the VIP badge (or "Go VIP") under your name; hidden without payments. */
  vip?: { on: boolean; until?: string | null; onOpen: () => void; loading?: boolean };
}) {
  const lines = (recent ?? []).map((r) => ({ r, line: recentLine(r) })).filter((x) => x.line);
  const { postcards, huntCards } = collections;
  return (
    <Sheet open={open} onClose={onClose} label="Your profile" hero>
      <div className="stack-16">
        <div className="profile-hero">
          {open && <Avatar3D look={look} outfit={outfit} framing="full" label={`${name}'s character`} />}
        </div>
        <div>
          <h2 className="display-md profile-name">{name}</h2>
          <p className="body profile-sub">{subtitle}</p>
          {nyerLabel(look.nyer) && <p className="meta profile-sub" style={{ margin: 0 }}>{nyerLabel(look.nyer)}</p>}
          {!!looks?.length && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", marginTop: 6 }}>
              {looks.map((l) => <span key={l} className="tag">{lookBadge(`look-${l}`)?.emoji} Full {LOOK_LABEL[l] ?? l} look</span>)}
            </div>
          )}
          {/* While membership loads, its space is kept so nothing below jumps when it arrives (owner, Oct 22). */}
          {vip && <div style={{ textAlign: "center", visibility: vip.loading ? "hidden" : undefined }} aria-hidden={vip.loading || undefined}>
            <ProfileVip vip={vip.on} until={vip.until} onOpen={vip.onOpen} /></div>}
        </div>
        {/* One page, no tabs (owner, Oct 30): skills live on the home screen; no choices or Halo ↔ Hustler meter here. */}
        {/* Player ranks (owner, Oct 15): the title, and how far to the next one by clout or money. */}
        <RankClimb clout={clout} netWorth={netWorth} best={bestRank} />
        <div className="profile-kpis">
          <button className="profile-kpi" onClick={onOpenLeaderboard}><b>🔥 {formatShort(clout)}</b><span>Clout</span></button>
          <button className="profile-kpi" onClick={onOpenLeaderboard}><b>{rank ? `#${rank.toLocaleString()}` : "—"}</b><span>In Queens</span></button>
          <button className="profile-kpi" onClick={onOpenNetWorth}><b>{formatCash(netWorth)}</b><span>Net worth</span></button>
        </div>
        <div className="stack-8">
          <p className="overline" style={{ margin: 0 }}>Badges</p>
          {badges.length ? (
            <div className="profile-badges">
              {badges.map((b) => <span key={b.id} className="profile-badge" title={b.name} role="img" aria-label={b.name}>{b.emoji}</span>)}
            </div>
          ) : (
            <p className="meta" style={{ margin: 0 }}>None yet. Stories and hunts hand them out.</p>
          )}
        </div>
        <div className="stack-8">
          <p className="overline" style={{ margin: 0 }}>Collections · Crew</p>
          <div className="profile-tiles">
            <button className="profile-tile" onClick={onOpenCollection} disabled={!onOpenCollection}>
              <b>{postcards ? `📮 ${postcards.owned} of ${postcards.total}` : `🗺️ ${huntCards}`}</b>
              {postcards ? `postcards · 🗺️ ${huntCards} hunt ${huntCards === 1 ? "card" : "cards"}` : `hunt ${huntCards === 1 ? "card" : "cards"}`}
            </button>
            <div className="profile-tile">
              <b>👯 {crew.length ? `Crew of ${crew.length + 1}` : "No crew yet"}</b>
              <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{crew.length ? crew.join(", ") : "Invite friends to start one"}</span>
            </div>
          </div>
        </div>
        {recent && (
          <div className="stack-4">
            <p className="overline" style={{ margin: 0 }}>Recently</p>
            {lines.length ? (
              <div>
                {lines.map(({ r, line }) => (
                  <div key={`${r.kind}:${r.ref}`} className="profile-recent">
                    <span aria-hidden="true">{line!.emoji}</span><span>{line!.text}</span><span>{recentWhen(r.at)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="meta" style={{ margin: 0 }}>Nothing yet. Go be seen somewhere.</p>
            )}
            <p className="meta" style={{ margin: 0 }}>Other players can see this on your card.</p>
          </div>
        )}
        <form action="/auth/signout" method="post">
          <button className="btn btn-secondary" type="submit">Log out</button>
        </form>
      </div>
    </Sheet>
  );
}
