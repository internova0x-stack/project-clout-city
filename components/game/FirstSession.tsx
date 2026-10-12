"use client";

import { useEffect, useState } from "react";
import { ECONOMY, formatCash } from "@/lib/economy";
import { cliqueProgress } from "@/lib/invite";
import { getStyle } from "@/lib/styles";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { Sheet } from "../Sheet";

// The first session after creation (Clarifications section 1, steps 10 to 14):
// the party, its completion card, the leaderboard, the invite prompt and the
// add-to-home-screen prompt.

const PARTY = ECONOMY.firstParty;
export const PARTY_VENUE = "Velvet Static";

/** C26: the first-task party, always "Happening now". */
export function PartySheet({
  open, onClose, onAttend, busy, error,
}: { open: boolean; onClose: () => void; onAttend: (withClique: boolean) => void; busy: boolean; error: string | null }) {
  return (
    <Sheet open={open} onClose={onClose} label="You've been invited to a party">
      <div className="stack-16">
        <div className="party-card">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="tag tag-event">🍸 Club event</span>
            <span className="badge-new" style={{ background: "var(--neon-600)" }}>Happening now</span>
          </div>
          <p className="display-md" style={{ margin: "12px 0 4px" }}>You&apos;ve been invited to a party</p>
          <p className="subtext" style={{ margin: 0 }}>
            <strong style={{ color: "var(--text-1)" }}>{PARTY_VENUE}</strong>, Long Island City. Somebody put your name on the list.
            Nobody knows who. Don&apos;t ask questions.
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
        <button className="btn btn-taxi" disabled={busy} onClick={() => onAttend(true)}>Bring the clique</button>
        <button className="btn btn-secondary" disabled={busy} onClick={() => onAttend(false)}>Pull up solo</button>
        <p className="meta center" style={{ margin: 0 }}>Entry is paid in virtual cash. Inviting is optional; showing up is the task.</p>
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
        <p className="display-md" style={{ margin: "12px 0 8px" }}>You were seen.</p>
        <p className="body" style={{ margin: 0, color: "rgba(255,246,224,.85)" }}>Nobody knows who you are, but they saw you. That&apos;s a start.</p>
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

interface Row { rank: number; display_name: string; starting_style: string; clout: number; is_me: boolean }

/** C27: the clout leaderboard, Queens or Clique. */
export function LeaderboardSheet({
  open, onClose, cta, myClout,
}: { open: boolean; onClose: () => void; cta?: { label: string; onClick: () => void }; myClout: number }) {
  const [scope, setScope] = useState<"queens" | "clique">("queens");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [me, setMe] = useState<{ rank: number; total: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    const supabase = getBrowserSupabase();
    if (!supabase) return setRows([]);
    setRows(null);
    supabase.rpc("leaderboard", { p_scope: scope, p_limit: 50 }).then(({ data }) => setRows((data as Row[]) ?? []));
    supabase.rpc("my_rank", { p_scope: scope }).then(({ data }) => {
      const r = Array.isArray(data) ? data[0] : data;
      if (r) setMe({ rank: Number(r.rank), total: Number(r.total) });
    });
  }, [open, scope, myClout]);

  return (
    <Sheet open={open} onClose={onClose} label="Leaderboard" tall>
      <div className="stack-16">
        <div className="stack-4" style={{ paddingRight: 44 }}>
          <h2 className="display-lg" style={{ margin: 0 }}>Leaderboard</h2>
          <p className="subtext" style={{ margin: 0 }}>In this city, clout is the only ranking that counts. Here&apos;s where you stand. Don&apos;t look too long.</p>
        </div>
        <div className="segmented" role="group" aria-label="Leaderboard scope">
          <button aria-pressed={scope === "queens"} onClick={() => setScope("queens")}>Queens</button>
          <button aria-pressed={scope === "clique"} onClick={() => setScope("clique")}>Clique</button>
        </div>
        <div className="card stack-8">
          <p className="overline" style={{ margin: 0 }}>{scope === "queens" ? "Queens leaderboard" : "Your clique"}</p>
          <p className="display-md" style={{ margin: 0 }}>{me?.rank ? `You're #${me.rank.toLocaleString()}` : "Calculating your fame…"}</p>
          <div className="stack-4">
            {rows === null && <p className="meta" style={{ margin: 0 }}>Counting heads…</p>}
            {rows?.length === 0 && <p className="meta" style={{ margin: 0 }}>Nobody here yet. Invite your clique to fill the board.</p>}
            {rows?.map((r) => (
              <div key={`${r.rank}-${r.display_name}`} className={`lb-row${r.is_me ? " me" : ""}`}>
                <span className="meta" style={{ width: 28 }}>{r.rank}</span>
                <span className="lb-avatar" aria-hidden="true">{getStyle(r.starting_style).emoji}</span>
                <span className="title" style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {r.display_name}{r.is_me ? " (you)" : ""}
                </span>
                <span className="hud-number" style={{ color: "var(--taxi-500)" }}>{Number(r.clout).toLocaleString()}</span>
              </div>
            ))}
          </div>
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
    <div className="modal-wrap" role="dialog" aria-modal="true" aria-label="Invite your clique">
      <div className="scrim" />
      <div className="modal-card modal-light stack-12">
        <p className="display-md" style={{ margin: 0 }}>{invitedDuringParty ? "Invite more friends" : "Recruit your clique"}</p>
        <p className="body" style={{ margin: 0, color: "var(--text-2)" }}>
          Main characters need a supporting cast. Every friend who joins boosts your clout (+{cloutPerInvite}), and a full clique of {cliqueSize} earns
          a big bonus (+{cliqueBonus}).
        </p>
        {invitedDuringParty && (
          <div className="stack-4">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span className="meta">Your clique</span>
              <span className="body-strong">{p.shown} of {cliqueSize}</span>
            </div>
            <div style={{ height: 8, borderRadius: 999, background: "var(--chip-off)" }}>
              <div style={{ width: `${p.ratio * 100}%`, height: "100%", borderRadius: 999, background: "var(--taxi-400)" }} />
            </div>
          </div>
        )}
        <button className="btn btn-taxi" onClick={onRecruit}>{invitedDuringParty ? "Invite more friends" : "Recruit the clique"}</button>
        <button className="btn btn-ghost" onClick={onLater}>Later (lonely, but okay)</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 13: add to home screen. Android uses the browser's install prompt;
// iOS gets the Share -> Add to Home Screen instructions (C17).
// ---------------------------------------------------------------------------
interface InstallEvent extends Event { prompt: () => Promise<void> }

export function isStandalone(): boolean {
  return window.matchMedia?.("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
}

export function PwaPrompt({ onDone }: { onDone: () => void }) {
  const [ios] = useState(() => /iphone|ipad|ipod/i.test(navigator.userAgent));
  const installEvent = (window as unknown as { __ccInstall?: InstallEvent }).__ccInstall;

  return (
    <div className="modal-wrap" role="dialog" aria-modal="true" aria-label="Add Clout City to your home screen">
      <div className="scrim" />
      <div className="modal-card glass-light install-card">
        <div className="row" style={{ gap: 12, alignItems: "flex-start" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-192.png" alt="" width={40} height={40} style={{ borderRadius: 10, flex: "none" }} />
          <div>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Put Clout City on your home screen</p>
            <p className="subtext" style={{ margin: "2px 0 0" }}>So you never miss a party, a deal, or a chance to be seen.</p>
          </div>
        </div>
        {ios ? (
          <ol className="install-steps">
            <li><span className="n">1</span><span><strong>Tap Share ⎋</strong><span className="meta" style={{ display: "block" }}>The square with the arrow, at the bottom of Safari.</span></span></li>
            <li><span className="n">2</span><span><strong>Add to Home Screen ⊞</strong><span className="meta" style={{ display: "block" }}>Yes, it&apos;s two taps. Fame takes effort.</span></span></li>
          </ol>
        ) : null}
        <div className="row" style={{ gap: 8, marginTop: 16 }}>
          {!ios && installEvent ? (
            <button
              className="btn btn-taxi"
              style={{ flex: 1 }}
              onClick={async () => {
                await installEvent.prompt().catch(() => undefined);
                onDone();
              }}
            >
              Add to home screen
            </button>
          ) : (
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onDone}>{ios ? "I installed it" : "Got it"}</button>
          )}
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onDone}>Not now</button>
        </div>
        {!ios && !installEvent && (
          <p className="meta" style={{ margin: "8px 0 0" }}>Open your browser menu and choose &quot;Add to Home screen&quot; or &quot;Install app&quot;.</p>
        )}
      </div>
    </div>
  );
}
