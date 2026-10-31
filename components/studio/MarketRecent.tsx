"use client";

import { useCallback, useEffect, useState } from "react";
import { formatCash } from "@/lib/economy";
import type { MarketAdmin, MarketRecentRow } from "@/lib/marketplace";
import type { StudioApi } from "@/lib/studio";

// Phase 2 (migration 0152): Studio → Economy → Recent trades. The week's Market numbers, the last 30 days of sales and swaps,
// and Reverse for a reported theft or exploit within the window: the pieces and C$ go back, and it's logged with your reason.

const stamp = (iso: string) => new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export function MarketRecent({ api }: { api: StudioApi }) {
  const [data, setData] = useState<MarketAdmin | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const r = await api.marketRecent!();
    if (r.ok) { setData(r.data); setError(null); } else setError(r.error);
  }, [api]);
  useEffect(() => { void load(); }, [load]);
  const reverse = async (row: MarketRecentRow, reason: string) => {
    setBusy(true); setError(null);
    const r = await api.marketReverse!(row.kind, row.id, reason);
    setBusy(false);
    if (r.ok) setData(r.data); else setError(r.error);
  };
  return (
    <section className="studio-card stack-8">
      <span className="overline">Recent trades</span>
      {error && <p className="error-text" style={{ margin: 0 }}>{error}</p>}
      {!data && !error && <p className="meta" style={{ margin: 0 }}>Loading…</p>}
      {data && (
        <>
          <div className="row" style={{ gap: 24, flexWrap: "wrap" }}>
            <span className="stack-4"><b className="display-md">{data.week.sales}</b><span className="meta">sales this week</span></span>
            <span className="stack-4"><b className="display-md">{data.week.trades}</b><span className="meta">swaps</span></span>
            <span className="stack-4"><b className="display-md">{data.week.listed}</b><span className="meta">listed now</span></span>
            <span className="stack-4"><b className="display-md">{formatCash(data.week.value)}</b><span className="meta">value moved</span></span>
            <span className="stack-4"><b className="display-md">{formatCash(data.week.fees)}</b><span className="meta">Market fees</span></span>
          </div>
          <p className="meta" style={{ margin: 0 }}>
            Reverse a sale or swap within {data.reversalDays} days of a reported theft or exploit: the pieces go back (their Shop value in C$ if one
            is gone) and the C$ goes back (never below zero; anything already spent is noted below). It&apos;s logged with your reason.
          </p>
          {data.last && (data.last.short > 0 || data.last.missing.length > 0) && (
            <p className="body" style={{ margin: 0 }}>
              Last reversal: {data.last.short > 0 ? `${formatCash(data.last.short)} couldn't be taken back (already spent). ` : ""}
              {data.last.missing.length > 0 ? `Gone, paid at Shop value: ${data.last.missing.map((m) => m.name).join(", ")}.` : ""}
            </p>
          )}
          {data.recent.length === 0 && <p className="meta" style={{ margin: 0 }}>No sales or swaps yet. Either nobody&apos;s trading or the Market is still switched off.</p>}
          {data.recent.map((r) => <Row key={`${r.kind}:${r.id}`} r={r} busy={busy} onReverse={(why) => void reverse(r, why)} />)}
        </>
      )}
    </section>
  );
}

function Row({ r, busy, onReverse }: { r: MarketRecentRow; busy: boolean; onReverse: (reason: string) => void }) {
  const [open, setOpen] = useState(false);
  const [why, setWhy] = useState("");
  return (
    <div className="stack-4" style={{ borderTop: "1px solid var(--line, rgba(255,255,255,.08))", paddingTop: 8 }}>
      <span className="title">{r.kind === "sale" ? "🏷️ Sale" : "🔁 Swap"} · @{r.from.name} → @{r.to.name}</span>
      <span className="body">{r.label}</span>
      <span className="meta">
        {stamp(r.at)} · {r.kind === "sale" ? `${formatCash(r.value)} (Shop ${formatCash(r.reference)})` : `${formatCash(r.value)} for ${formatCash(r.reference)}`}
        {r.fee ? ` · fee ${formatCash(r.fee)}` : ""}
        {r.status === "reversed" ? ` · reversed${r.reversal ? `: ${r.reversal.reason}` : ""}` : ""}
      </span>
      {r.reversible && !open && <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => setOpen(true)}>Reverse…</button>}
      {r.reversible && open && (
        <>
          <input className="studio-input" value={why} maxLength={300} placeholder="Why (a report, a ticket, what happened)" onChange={(e) => setWhy(e.target.value)} />
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-taxi btn-sm" disabled={busy || why.trim().length < 3} onClick={() => onReverse(why.trim())}>Reverse it</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </>
      )}
    </div>
  );
}
