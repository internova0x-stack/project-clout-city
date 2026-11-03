"use client";

import { LOLA_PORTRAIT } from "@/lib/cast";
import { formatCash } from "@/lib/economy";
import type { RepairMethod, RepairOffer } from "@/lib/streakRepair";

// Streak repair (migration 0158, owner Nov 3): a broken 3+ day streak can be put back, today only, four ways. Shown at the
// top of Tasks → Daily while the offer is open (and the welcome back picks it).

export function StreakRepairCard({ offer, busy, onRepair }: { offer: RepairOffer; busy: boolean; onRepair: (m: RepairMethod) => void }) {
  if (offer.earnPending) {
    return (
      <div className="repair-card earning" role="status">
        <span className="repair-head"><span aria-hidden="true">🔧</span> Repair in progress</span>
        <span className="repair-title">Finish today&apos;s five and your {offer.streak}-day streak lives</span>
        <span className="repair-sub">Miss tonight and it&apos;s gone for good. Or skip the work:</span>
        <div className="repair-opts">
          {offer.vip && <button className="btn btn-taxi btn-sm" disabled={busy} onClick={() => onRepair("vip")}>👑 VIP repair, free</button>}
          {offer.passes > 0 && <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => onRepair("pass")}>🎟️ Use a pass</button>}
          <button className="btn btn-secondary btn-sm" disabled={busy || offer.bank < offer.cash} onClick={() => onRepair("cash")}>Pay {formatCash(offer.cash)}</button>
        </div>
      </div>
    );
  }
  return (
    <div className="repair-card" role="group" aria-label="Repair your streak">
      <div className="repair-lola">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={LOLA_PORTRAIT} alt="" width={40} height={40} />
        <span><b>Lola:</b> Your {offer.streak}-day streak broke. I can fix it, just this once. Today only.</span>
      </div>
      <span className="repair-title">💔 Repair your {offer.streak}-day streak</span>
      <div className="repair-list">
        <button className="repair-opt primary" disabled={busy} onClick={() => onRepair("earn")}>
          <span className="repair-opt-emoji" aria-hidden="true">💪</span>
          <span className="repair-opt-text"><b>Earn it back</b><span>Finish all five of today&apos;s tasks. Free.</span></span>
        </button>
        {offer.vip && (
          <button className="repair-opt" disabled={busy} onClick={() => onRepair("vip")}>
            <span className="repair-opt-emoji" aria-hidden="true">👑</span>
            <span className="repair-opt-text"><b>VIP repair</b><span>Free, once a month. Back on right now.</span></span>
          </button>
        )}
        {offer.passes > 0 && (
          <button className="repair-opt" disabled={busy} onClick={() => onRepair("pass")}>
            <span className="repair-opt-emoji" aria-hidden="true">🎟️</span>
            <span className="repair-opt-text"><b>Use a guest-list pass</b><span>You have {offer.passes}. Back on right now.</span></span>
          </button>
        )}
        <button className="repair-opt" disabled={busy || offer.bank < offer.cash} onClick={() => onRepair("cash")}>
          <span className="repair-opt-emoji" aria-hidden="true">💸</span>
          <span className="repair-opt-text"><b>Pay {formatCash(offer.cash)}</b><span>{offer.bank < offer.cash ? `You have ${formatCash(offer.bank)}.` : "Back on right now."}</span></span>
        </button>
      </div>
      <span className="repair-fine">One repair every 30 days.</span>
    </div>
  );
}
