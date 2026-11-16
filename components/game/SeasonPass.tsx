"use client";

import { PASS_EMOJI, SEASON, challengeById, claimable, pace, daysLeft, rewardLabel, tierFor, type PassReward, type PassState, type StarterPackState, STARTER_PACK } from "@/lib/seasonPass";
import { itemBySku } from "@/lib/city";
import { useEffect, useState } from "react";

// The Clout Pass (Tasks → Pass) and the starter pack card (the Shop's top, the Pass tab's foot). lib/seasonPass.ts has the
// rules; the server claims and pays (season_claim_all, migration 0156).

const itemName = (sku: string) => itemBySku(sku)?.name;
const rewardEmoji = (r: PassReward) =>
  r.kind === "cash" ? "💵" : r.kind === "clout" ? "🔥" : r.kind === "badge" ? "🏅" : r.kind === "title" ? SEASON.title.emoji : itemBySku(r.sku)?.emoji ?? "🎁";

function Reward({ r, locked }: { r: PassReward; locked?: boolean }) {
  return (
    <span className="pass-reward" data-locked={locked || undefined}>
      <span aria-hidden>{rewardEmoji(r)}</span>
      <span>{rewardLabel(r, itemName)}</span>
    </span>
  );
}

/**
 * The Clout Pass on the home screen (owner, Nov 16: "I cannot find the entry point to the pass feature"): a ring with the
 * tier reached, the season and its days left; while rewards wait it glows and says how many. A tap opens Tasks → Pass.
 */
export function PassPill({ state, today, onOpen }: { state: PassState; today: string; onOpen: () => void }) {
  if (state.phase !== "on" && state.phase !== "claim") return null;
  const t = tierFor(state.xp, state.season);
  const ready = claimable(state);
  const n = ready.free.length + ready.paid.length;
  const pct = t.max ? 100 : Math.round((100 * t.into) / t.need);
  const left = daysLeft(today, state.season);
  return (
    <button className={`pill-glass glass-hud pass-pill${n ? " ready" : ""}`} onClick={onOpen}
      aria-label={`Clout Pass, level ${t.tier} of ${state.season.tiers.length}${n ? `, ${n} reward${n === 1 ? "" : "s"} to collect` : ""}`}>
      <span className="pass-ring" style={{ ["--p" as string]: `${pct}%` }} aria-hidden="true"><b>{t.tier}</b></span>
      <span className="pass-label" aria-hidden="true">
        <small>{PASS_EMOJI} {state.season.name}</small>
        {n ? `🎁 ${n} reward${n === 1 ? "" : "s"} to collect` : state.phase === "claim" ? "Claim before it closes" : `Level ${t.tier + (t.max ? 0 : 1)} next · ${left}d left`}
      </span>
      <span aria-hidden="true">›</span>
    </button>
  );
}

export function PassTab({ state, today, busy, price, onClaim, onBuy, starter }: {
  state: PassState;
  /** Today's New York date (for days left). */
  today: string;
  busy: boolean;
  /** The pass's price, from the store catalog ("$7.99"), or null before it loads. */
  price: string | null;
  onClaim: () => void;
  onBuy: () => void;
  starter?: { state: StarterPackState; price: string | null; onBuy: () => void } | null;
}) {
  const s = state.season;
  const { tier, into, need, max } = tierFor(state.xp, s);
  const ready = claimable(state);
  const readyCount = ready.free.length + ready.paid.length;
  const left = daysLeft(today, s);
  return (
    <div className="stack-16">
      <div className="pass-hero">
        <div className="pass-hero-kicker">Clout Pass · Season 1</div>
        <div className="pass-hero-title">{PASS_EMOJI} {s.name}</div>
        <div className="row" style={{ justifyContent: "space-between", marginTop: 14 }}>
          <span className="title">Level {tier} of {s.tiers.length}</span>
          <span className="pass-hero-meta">
            {state.phase === "soon" ? `Starts ${new Date(s.starts + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
              : state.phase === "on" ? `${left} day${left === 1 ? "" : "s"} left`
              : state.phase === "claim" ? "Claim what you earned" : "Season over"}
          </span>
        </div>
        <div className="pass-bar" role="progressbar" aria-valuemin={0} aria-valuemax={need} aria-valuenow={into} aria-label="XP to the next level">
          <span style={{ width: `${Math.round((into / need) * 100)}%` }} />
        </div>
        <div className="pass-hero-meta" style={{ marginTop: 6 }}>{max ? "Every tier reached" : `${into} / ${need} XP`}</div>
      </div>

      {state.phase === "on" && <PaceLine state={state} today={today} />}
      {state.phase === "on" && state.week && <WeekChallenges week={state.week} today={today} />}

      <HowItWorks season={s} price={price} />

      {readyCount > 0 && (
        <button className="btn btn-taxi" disabled={busy} onClick={onClaim}>
          {busy ? "Claiming…" : `Claim ${readyCount} reward${readyCount === 1 ? "" : "s"}`}
        </button>
      )}

      {!state.paid && state.phase === "on" && (
        <div className="pass-upsell">
          <div className="title">Unlock the paid row</div>
          <p className="subtext" style={{ margin: "4px 0 10px" }}>
            {s.tiers.length} exclusive outfits and furniture pieces, plus the {s.badge.emoji} {s.badge.name} badge. Looks only: nobody pays to win.
            XP you&apos;ve earned counts straight away. VIP members get it included.
          </p>
          <button className="btn btn-gold" disabled={busy || state.pending || !price} onClick={onBuy}>
            {state.pending ? "Unlocking…" : price ? `Get the Clout Pass · ${price}` : "Get the Clout Pass"}
          </button>
        </div>
      )}
      {state.paid && <p className="meta" style={{ margin: 0 }}>{state.vip ? "👑 Included with VIP." : "✅ Clout Pass unlocked."}</p>}

      {/* Owner, Nov 16 ("I don't understand the tier, free, clout pass"): say how a row works before the rows. */}
      <p className="pass-legend">
        Each level you reach unlocks <b>two rewards</b>. The left one is <b>free for everyone</b>; the right one is
        {state.paid ? " yours too, with your " : " only for people who buy the "}<b className="pass-legend-paid">Clout Pass</b>. Tap Claim to collect.
      </p>
      <div className="pass-grid" role="table" aria-label="Season rewards">
        <div className="pass-row pass-head" role="row">
          <span role="columnheader">Level</span><span role="columnheader">Free reward</span><span role="columnheader">{PASS_EMOJI} Pass reward</span>
        </div>
        {s.tiers.map((t) => {
          const reached = t.tier <= tier;
          const next = !max && t.tier === tier + 1;
          const freeDone = state.claimed.free.includes(t.tier);
          const paidDone = state.claimed.paid.includes(t.tier);
          return (
            <div key={t.tier} className="pass-row" role="row" data-reached={reached || undefined} data-next={next || undefined}>
              <span className="pass-tier" role="cell">
                {t.tier}
                <small>{reached ? "✓" : next ? `${need - into} to go` : `${(t.tier * s.xpPerTier).toLocaleString()} XP`}</small>
              </span>
              <span role="cell" className="pass-cell" data-done={freeDone || undefined}>
                {t.free.map((r, i) => <Reward key={i} r={r} />)}
                {freeDone && <span className="pass-check" aria-label="claimed">✓</span>}
              </span>
              <span role="cell" className="pass-cell pass-paid" data-done={paidDone || undefined}>
                {t.paid.map((r, i) => <Reward key={i} r={r} locked={!state.paid} />)}
                {paidDone ? <span className="pass-check" aria-label="claimed">✓</span> : !state.paid ? <span aria-label="locked">🔒</span> : null}
              </span>
            </div>
          );
        })}
      </div>
      {starter && starter.state.offer && <StarterPackCard state={starter.state} price={starter.price} busy={busy} onBuy={starter.onBuy} />}
    </div>
  );
}

/**
 * Will you finish (owner, Nov 16: stakes)? Green when your pace reaches Level 18 by the end, amber with the level you're
 * heading for when it doesn't, and what fixes it.
 */
function PaceLine({ state, today }: { state: PassState; today: string }) {
  const p = pace(state, today);
  const top = state.season.tiers.length;
  if (tierFor(state.xp, state.season).max) return <div className="pass-pace ok"><span aria-hidden="true">🏆</span><span><b>Every level reached</b>Collect what&apos;s waiting below.</span></div>;
  return p.onTrack ? (
    <div className="pass-pace ok"><span aria-hidden="true">✅</span><span><b>On track for Level {top}</b>Keep doing the weekly challenges{p.spare > 0 ? ` and you'll finish with ${p.spare} day${p.spare === 1 ? "" : "s"} to spare` : ""}.</span></div>
  ) : (
    <div className="pass-pace behind"><span aria-hidden="true">⏳</span><span><b>Behind: you&apos;re heading for Level {Math.max(1, p.heading)}</b>Finish this week&apos;s challenges to catch up before the season ends.</span></div>
  );
}

/** This week's three challenges (they expire Sunday night, New York time). */
function WeekChallenges({ week, today }: { week: NonNullable<PassState["week"]>; today: string }) {
  const end = Date.UTC(+week.from.slice(0, 4), +week.from.slice(5, 7) - 1, +week.from.slice(8, 10)) + 7 * 86_400_000;
  const now = Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10));
  const left = Math.max(1, Math.round((end - now) / 86_400_000));
  return (
    <div className="stack-8">
      <div className="pass-week-head">
        <span className="overline">This week&apos;s challenges</span>
        <span className="pass-week-left">Ends Sunday · {left} day{left === 1 ? "" : "s"} left</span>
      </div>
      {week.challenges.map((c) => {
        const def = challengeById(c.id);
        if (!def) return null;
        return (
          <div key={c.id} className="pass-ch" data-done={c.done || undefined}>
            <span className="pass-ch-emoji" aria-hidden="true">{def.emoji}</span>
            <span className="pass-ch-main">
              <b>{def.title}</b>
              <small>{c.done ? "Done ✓" : `${c.have} of ${def.need}`}</small>
              <span className="pass-ch-bar" aria-hidden="true"><span style={{ width: `${Math.round((c.have / def.need) * 100)}%` }} /></span>
            </span>
            <span className="pass-ch-xp">+{def.xp} XP</span>
          </div>
        );
      })}
      <p className="meta" style={{ margin: 0 }}>Miss them and they&apos;re gone on Sunday. Three new ones arrive Monday.</p>
    </div>
  );
}

/** What the Clout Pass is: open the first time, folded after (remembered on this device). */
function HowItWorks({ season: s, price }: { season: PassState["season"]; price: string | null }) {
  const KEY = "cc-pass-how-seen";
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try { if (!localStorage.getItem(KEY)) { setOpen(true); localStorage.setItem(KEY, "1"); } } catch { /* stays folded */ }
  }, []);
  const steps: [string, string, React.ReactNode][] = [
    ["📅", "Do the weekly challenges", <>Three new ones every Monday, worth most of the XP. They&apos;re gone on Sunday night.</>],
    ["🎯", "Play like you already do", <>Daily tasks <b>+{s.xp.daily_task} XP</b>, all five in a day <b>+{s.xp.daily_bonus}</b>, each goal <b>+{s.xp.goal}</b>.</>],
    ["🪜", "Climb the levels", <>Every {s.xpPerTier} XP is a new level with a free reward. Level {s.tiers.length} gives the {s.title.emoji} &ldquo;{s.title.name}&rdquo; title by your name, never given again.</>],
    ["✨", "The Clout Pass adds the good stuff", <>One payment for the season{price ? ` (${price})` : ""}, or free with VIP: an exclusive outfit or furniture piece on every level. Looks only. XP you already have counts.</>],
    ["⏳", "It's a season", <>Ends {new Date(s.ends + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}. You get {s.claimDays} more days to claim, then a new season starts.</>],
  ];
  return (
    <div className="pass-how">
      <button className="pass-how-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span>What&apos;s the Clout Pass?</span>
        <span aria-hidden className="pass-how-chev">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <ol className="pass-how-steps">
          {steps.map(([e, t, d]) => (
            <li key={t}>
              <span className="pass-how-emoji" aria-hidden>{e}</span>
              <span><b className="title">{t}</b><span className="subtext" style={{ display: "block" }}>{d}</span></span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** The starter pack offer: shown while the player's first 14 days last and it isn't owned. */
export function StarterPackCard({ state, price, busy, onBuy }: { state: StarterPackState; price: string | null; busy: boolean; onBuy: () => void }) {
  if (!state.offer && !state.owned) return null;
  const ends = state.endsAt ? Math.max(0, Math.ceil((Date.parse(state.endsAt) - Date.now()) / 86_400_000)) : null;
  return (
    <div className="pack-card">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
        <span className="title">{STARTER_PACK.badge.emoji} {STARTER_PACK.name}</span>
        {state.offer && ends !== null && <span className="meta">{ends} day{ends === 1 ? "" : "s"} left</span>}
      </div>
      <p className="subtext" style={{ margin: "4px 0 10px" }}>
        Look like you&apos;ve lived here for years. One time only, for new New Yorkers.
      </p>
      <div className="pack-items">
        {STARTER_PACK.items.map((sku) => (
          <span key={sku} className="pack-item"><span aria-hidden>{itemBySku(sku)?.emoji}</span>{itemBySku(sku)?.name}</span>
        ))}
        <span className="pack-item"><span aria-hidden>{STARTER_PACK.badge.emoji}</span>{STARTER_PACK.badge.name} badge</span>
      </div>
      {state.owned ? (
        <p className="meta" style={{ margin: "10px 0 0" }}>✅ Yours. Find the pieces in Your Look and Arrange your home.</p>
      ) : (
        <button className="btn btn-gold" style={{ marginTop: 12, width: "100%" }} disabled={busy || state.pending || !price} onClick={onBuy}>
          {state.pending ? "Unlocking…" : price ? `Get it · ${price}` : "Get it"}
        </button>
      )}
    </div>
  );
}
