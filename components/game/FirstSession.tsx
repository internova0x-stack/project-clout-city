"use client";

import { CrownMark } from "../city/Common";
import { useEffect, useState } from "react";
import { ECONOMY, formatCash } from "@/lib/economy";
import { cliqueProgress } from "@/lib/invite";
import { getStyle } from "@/lib/styles";
import { INSTALL_GUIDES, PLATFORM_DEFAULT, detectInstallGuide, type InstallGuideId, type Platform } from "@/lib/install";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { Sheet } from "../Sheet";
import { handle } from "@/lib/validation";

// The first session after creation (Clarifications section 1, steps 10 to 14):
// the party, its completion card, the leaderboard, the invite prompt and the
// add-to-home-screen prompt.

const PARTY = ECONOMY.firstParty;
export const PARTY_VENUE = "Velvet Static";
/** Owner, Oct 27: the first party is Peyton Pastel's (lib/cast.ts), on tickets that "fell off" the coat check. */
export const PARTY_HOST = "Peyton Pastel";

/** C26: the first-task party, always "Happening now". */
export function PartySheet({
  open, onClose, onAttend, busy, error,
}: { open: boolean; onClose: () => void; onAttend: (withClique: boolean) => void; busy: boolean; error: string | null }) {
  return (
    <Sheet open={open} onClose={onClose} label={`Stolen tickets to celebrity influencer ${PARTY_HOST}'s party`}>
      <div className="stack-16">
        <div className="party-card">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="tag tag-event">🎟️ Stolen tickets</span>
            <span className="badge-new" style={{ background: "var(--neon-600)" }}>Happening now</span>
          </div>
          <p className="display-md" style={{ margin: "12px 0 4px" }}>Celebrity influencer {PARTY_HOST}&apos;s launch party (you&apos;re not invited)</p>
          <p className="subtext" style={{ margin: 0 }}>
            Your roommate&apos;s cousin works coat check at <strong style={{ color: "var(--text-1)" }}>{PARTY_VENUE}</strong> and
            &ldquo;found&rdquo; two tickets to the most pastel night in Queens. The name on them is Brittany. You are Brittany now.
          </p>
          <div className="row" style={{ gap: 6, marginTop: 12, flexWrap: "wrap" }}>
            <span className="tag tag-neutral">Entry {formatCash(PARTY.entry)}</span>
            <span className="tag tag-positive">+{formatCash(PARTY.cashReward)}</span>
            <span className="tag tag-neutral">🔥 +{PARTY.cloutReward}</span>
            <span className="tag tag-neutral">💪 +{PARTY.confidence}</span>
            <span className="tag tag-neutral">⚡ −{PARTY.energy}</span>
          </div>
        </div>
        {error && <p className="error-text" role="alert">{error}</p>}
        <button className="btn btn-taxi" disabled={busy} onClick={() => onAttend(true)}>Sneak in with the crew</button>
        <button className="btn btn-secondary" disabled={busy} onClick={() => onAttend(false)}>Sneak in solo</button>
        <p className="meta center" style={{ margin: 0 }}>The cousin&apos;s &ldquo;finder&apos;s fee&rdquo; is paid in virtual cash. Inviting is optional; getting in is the task.</p>
      </div>
    </Sheet>
  );
}

export function PartyDoneCard({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="modal-wrap" role="dialog" aria-modal="true" aria-label="Task complete">
      <div className="scrim" />
      <div className="modal-card reveal-card">
        <span className="tag tag-positive">Task complete</span>
        <p className="display-md" style={{ margin: "12px 0 8px" }}>You got in. Nobody checked.</p>
        <p className="body" style={{ margin: 0, color: "rgba(255,246,224,.85)" }}>Celebrity influencer {PARTY_HOST} took a selfie with you in the background. You&apos;re technically content now.</p>
        <p className="hud-number" style={{ margin: "14px 0 0", fontSize: 22 }}>
          <span style={{ color: "var(--green-500)" }}>+{formatCash(PARTY.cashReward - PARTY.entry)}</span>
          <span style={{ color: "rgba(255,246,224,.5)" }}> · </span>
          <span style={{ color: "var(--taxi-400)" }}>+{PARTY.cloutReward} clout</span>
        </p>
        <button className="btn btn-taxi" style={{ marginTop: 18 }} onClick={onContinue}>Continue ›</button>
      </div>
    </div>
  );
}

export interface Row { id?: string; rank: number; display_name: string; starting_style: string; clout: number; is_me: boolean }

/** C27: the clout leaderboard, Queens or Crew. */
export function LeaderboardSheet({
  open, onClose, cta, myClout, onOpenPlayer, fetchRows, fetchCrowned,
}: {
  open: boolean; onClose: () => void; cta?: { label: string; onClick: () => void }; myClout: number;
  /** v0.5: tap a row to open that player's card (and message them). */
  onOpenPlayer?: (id: string) => void;
  /** Development previews: sample rows instead of the database. */
  fetchRows?: (scope: "queens" | "clique", myClout: number) => Promise<Row[]>;
  /** Clout Couture (migration 0103): Clout Crown owners, for the crown by their name. */
  fetchCrowned?: () => Promise<string[]>;
}) {
  const [scope, setScope] = useState<"queens" | "clique">("queens");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [crowned, setCrowned] = useState<ReadonlySet<string>>(new Set());
  // Once per opening (fetchCrowned is a fresh function on every render of the shell).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (open && fetchCrowned) void fetchCrowned().then((ids) => setCrowned(new Set(ids))).catch(() => undefined); }, [open]);
  const [me, setMe] = useState<{ rank: number; total: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    if (fetchRows) {
      setRows(null);
      void fetchRows(scope, myClout ?? 0).then((r) => {
        setRows(r);
        const m = r.find((x) => x.is_me);
        if (m) setMe({ rank: m.rank, total: r.length });
      });
      return;
    }
    const supabase = getBrowserSupabase();
    if (!supabase) return setRows([]);
    setRows(null);
    // leaderboard_people (0010) adds player ids for profile cards; older databases fall back.
    supabase.rpc("leaderboard_people", { p_scope: scope, p_limit: 50 }).then(({ data, error }) => {
      if (!error) return setRows((data as Row[]) ?? []);
      supabase.rpc("leaderboard", { p_scope: scope, p_limit: 50 }).then(({ data: d }) => setRows((d as Row[]) ?? []));
    });
    supabase.rpc("my_rank", { p_scope: scope }).then(({ data }) => {
      const r = Array.isArray(data) ? data[0] : data;
      if (r) setMe({ rank: Number(r.rank), total: Number(r.total) });
    });
  }, [open, scope, myClout]);

  return (
    <Sheet open={open} onClose={onClose} label="Leaderboard" tall>
      <div className="lb-sheet">
        <div className="stack-8" style={{ paddingRight: 44 }}>
          <h2 className="display-lg" style={{ margin: 0 }}>Leaderboard</h2>
          <p className="subtext" style={{ margin: 0 }}>In this city, clout is the only ranking that counts. Here&apos;s where you stand. Don&apos;t look too long.</p>
        </div>
        <div className="segmented" role="group" aria-label="Leaderboard scope">
          <button aria-pressed={scope === "queens"} onClick={() => setScope("queens")}>Queens</button>
          <button aria-pressed={scope === "clique"} onClick={() => setScope("clique")}>Crew</button>
        </div>
        <div className="card lb-summary">
          <span className="overline">{scope === "queens" ? "Queens leaderboard" : "Your crew"}</span>
          <span className="display-md">{me?.rank ? `You're #${me.rank.toLocaleString()}` : "Calculating your fame…"}</span>
          {me?.total ? <span className="meta">of {me.total.toLocaleString()} {me.total === 1 ? "player" : "players"}{onOpenPlayer ? " · tap a player to see their card" : ""}</span> : null}
        </div>
        <div className="card lb-list">
          {rows === null && <p className="meta" style={{ margin: 0 }}>Counting heads…</p>}
          {rows?.length === 0 && <p className="meta" style={{ margin: 0 }}>Nobody here yet. Invite your crew to fill the board.</p>}
          {rows?.map((r) => (
            <div
              key={`${r.rank}-${r.display_name}`}
              className={`lb-row${r.is_me ? " me" : ""}${r.id && onOpenPlayer && !r.is_me ? " tappable" : ""}`}
              role={r.id && onOpenPlayer && !r.is_me ? "button" : undefined}
              tabIndex={r.id && onOpenPlayer && !r.is_me ? 0 : undefined}
              onClick={() => r.id && !r.is_me && onOpenPlayer?.(r.id)}
            >
              <span className="meta lb-rank">{r.rank}</span>
              <span className="lb-avatar" aria-hidden="true">{getStyle(r.starting_style).emoji}</span>
              <span className="title lb-name">{handle(r.display_name)}{r.id && crowned.has(r.id) && <CrownMark />}{r.is_me ? " (you)" : ""}</span>
              <span className="hud-number lb-clout">🔥 {Number(r.clout).toLocaleString()}</span>
            </div>
          ))}
        </div>
        <p className="subtext" style={{ margin: 0 }}>
          Clout comes from tasks, being seen in the right places, and friends who join through your link. It&apos;s a ranking only, for now.
        </p>
        {cta && <button className="btn btn-taxi" onClick={cta.onClick}>{cta.label}</button>}
      </div>
    </Sheet>
  );
}

/** Step 12: the invite pitch and the five-friend bonus. */
export function InvitePrompt({
  cliqueCount, invitedDuringParty, onRecruit, onLater,
}: { cliqueCount: number; invitedDuringParty: boolean; onRecruit: () => void; onLater: () => void }) {
  const { cliqueSize, cloutPerInvite, cliqueBonus } = ECONOMY.invites;
  const p = cliqueProgress(cliqueCount, cliqueSize);
  return (
    <div className="modal-wrap" role="dialog" aria-modal="true" aria-label="Invite your crew">
      <div className="scrim" />
      <div className="modal-card modal-light stack-12">
        <p className="display-md" style={{ margin: 0 }}>{invitedDuringParty ? "Invite more friends" : "Recruit your crew"}</p>
        <p className="body" style={{ margin: 0, color: "var(--text-2)" }}>
          Main characters need a supporting cast. Every friend who joins boosts your clout (+{cloutPerInvite}), and a full crew of {cliqueSize} earns
          a big bonus (+{cliqueBonus}).
        </p>
        {invitedDuringParty && (
          <div className="stack-4">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span className="meta">Your crew</span>
              <span className="body-strong">{p.shown} of {cliqueSize}</span>
            </div>
            <div style={{ height: 8, borderRadius: 999, background: "var(--chip-off)" }}>
              <div style={{ width: `${p.ratio * 100}%`, height: "100%", borderRadius: 999, background: "var(--taxi-400)" }} />
            </div>
          </div>
        )}
        <button className="btn btn-taxi" onClick={onRecruit}>{invitedDuringParty ? "Invite more friends" : "Recruit the crew"}</button>
        <button className="btn btn-ghost" onClick={onLater}>Later (lonely, but okay)</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 13: add to home screen (C17). Numbered steps for the player's own browser,
// with tabs for other devices; where the browser offers its install prompt
// (Chrome and Edge), "Install now" opens it in one tap.
// ---------------------------------------------------------------------------
interface InstallEvent extends Event { prompt: () => Promise<void> }

export function isStandalone(): boolean {
  return window.matchMedia?.("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
}

export function PwaPrompt({ onDone }: { onDone: () => void }) {
  // Browser details are read after mount, so the prompt also renders safely on the server.
  const [detected, setDetected] = useState<InstallGuideId>("ios-safari");
  const [guideId, setGuideId] = useState<InstallGuideId>("ios-safari");
  const [installEvent, setInstallEvent] = useState<InstallEvent | undefined>(undefined);
  useEffect(() => {
    const id = detectInstallGuide(navigator.userAgent);
    setDetected(id);
    setGuideId(id);
    setInstallEvent((window as unknown as { __ccInstall?: InstallEvent }).__ccInstall);
  }, []);
  const guide = INSTALL_GUIDES[guideId];
  const canOneTap = !!installEvent && guide.platform !== "iphone" && guideId === detected;

  return (
    <div className="modal-wrap" role="dialog" aria-modal="true" aria-label="Add Clout City to your home screen">
      <div className="scrim" />
      <div className="modal-card glass-light install-card">
        <div className="row" style={{ gap: 12, alignItems: "flex-start" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-192.png" alt="" width={40} height={40} style={{ borderRadius: 10, flex: "none" }} />
          <div>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Put Clout City on your home screen</p>
            <p className="subtext" style={{ margin: "2px 0 0" }}>So you never miss a party, a deal, or a chance to be seen. No app store needed.</p>
          </div>
        </div>

        <div className="segmented install-tabs" role="group" aria-label="Your device">
          {(["iphone", "android", "computer"] as Platform[]).map((p) => (
            <button
              key={p}
              aria-pressed={guide.platform === p}
              onClick={() => setGuideId(INSTALL_GUIDES[detected].platform === p ? detected : PLATFORM_DEFAULT[p])}
            >
              {p === "iphone" ? "iPhone" : p === "android" ? "Android" : "Computer"}
            </button>
          ))}
        </div>

        <p className="overline" style={{ margin: "14px 0 0" }}>
          {guideId === detected ? `In ${guide.browser}` : `On ${guide.platform === "iphone" ? "iPhone" : guide.platform === "android" ? "Android" : "a computer"}, in ${guide.browser}`}
        </p>
        <ol className="install-steps">
          {guide.steps.map((step, i) => (
            <li key={step.title}>
              <span className="n">{i + 1}</span>
              <span>
                <strong>{step.title}</strong>
                {step.glyph && <span className="install-glyph" aria-hidden="true">{step.glyph}</span>}
                <span className="meta" style={{ display: "block", marginTop: 2 }}>{step.help}</span>
              </span>
            </li>
          ))}
        </ol>
        {guide.note && <p className="meta install-note">{guide.note}</p>}

        <div className="row" style={{ gap: 8, marginTop: 16 }}>
          {canOneTap ? (
            <button
              className="btn btn-taxi"
              style={{ flex: 1 }}
              onClick={async () => {
                await installEvent!.prompt().catch(() => undefined);
                onDone();
              }}
            >
              Install now
            </button>
          ) : (
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onDone}>I installed it</button>
          )}
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onDone}>Not now</button>
        </div>
      </div>
    </div>
  );
}
