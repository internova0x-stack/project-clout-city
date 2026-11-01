"use client";

import { claimable, daysLeft, rewardLabel, tierFor, type PassReward, type PassState, type StarterPackState, STARTER_PACK } from "@/lib/seasonPass";
import { itemBySku } from "@/lib/city";

// The Clout Pass (Tasks → Pass) and the starter pack card (the Shop's top, the Pass tab's foot). lib/seasonPass.ts has the
// rules; the server claims and pays (season_claim_all, migration 0156).

const itemName = (sku: string) => itemBySku(sku)?.name;
const rewardEmoji = (r: PassReward) =>
  r.kind === "cash" ? "💵" : r.kind === "clout" ? "🔥" : r.kind === "badge" ? "🏅" : itemBySku(r.sku)?.emoji ?? "🎁";

function Reward({ r, locked }: { r: PassReward; locked?: boolean }) {
  return (
    <span className="pass-reward" data-locked={locked || undefined}>
      <span aria-hidden>{rewardEmoji(r)}</span>
      <span>{rewardLabel(r, itemName)}</span>
    </span>
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
        <div className="meta" style={{ opacity: 0.85 }}>CLOUT PASS · SEASON 1</div>
        <div className="display-md" style={{ margin: "2px 0 4px" }}>💘 {s.name}</div>
        <p className="subtext" style={{ margin: 0, opacity: 0.9 }}>{s.tagline}</p>
        <div className="row" style={{ justifyContent: "space-between", marginTop: 12 }}>
          <span className="title">Tier {tier} of {s.tiers.length}</span>
          <span className="meta">
            {state.phase === "soon" ? `Starts ${new Date(s.starts + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}`
              : state.phase === "on" ? `${left} day${left === 1 ? "" : "s"} left`
              : state.phase === "claim" ? "Season over: claim what you earned" : "Season over"}
          </span>
        </div>
        <div className="pass-bar" role="progressbar" aria-valuemin={0} aria-valuemax={need} aria-valuenow={into} aria-label="XP to the next tier">
          <span style={{ width: `${Math.round((into / need) * 100)}%` }} />
        </div>
        <div className="meta" style={{ marginTop: 4 }}>
          {max ? "Every tier reached. Icon behavior." : `${into} / ${need} XP to tier ${tier + 1}`}
          {state.today > 0 ? ` · +${state.today} XP today` : ""}
        </div>
      </div>

      <p className="subtext" style={{ margin: 0 }}>
        Earn XP from what you already do: <b>+{s.xp.daily_task}</b> per daily task, <b>+{s.xp.daily_bonus}</b> for all five in a day,
        <b> +{s.xp.goal}</b> per goal.
      </p>

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

      <div className="pass-grid" role="table" aria-label="Season rewards">
        <div className="pass-row pass-head" role="row">
          <span role="columnheader">Tier</span><span role="columnheader">Free</span><span role="columnheader">Clout Pass</span>
        </div>
        {s.tiers.map((t) => {
          const reached = t.tier <= tier;
          const freeDone = state.claimed.free.includes(t.tier);
          const paidDone = state.claimed.paid.includes(t.tier);
          return (
            <div key={t.tier} className="pass-row" role="row" data-reached={reached || undefined}>
              <span className="pass-tier" role="cell">{t.tier}</span>
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
