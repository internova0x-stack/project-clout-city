"use client";

import { useCallback, useEffect, useState } from "react";
import { formatCash } from "@/lib/economy";
import type { AssetAdmin, AssetAdminSale } from "@/lib/assetSales";
import { FLAG_COPY, type FlagRule } from "@/lib/playerEconomy";
import type { StudioApi } from "@/lib/studio";

// Phase 3 (migration 0153): Studio → Economy → Asset sales. The last 60 days of business and property sales, their flags
// (band edge, new-account buyers), traces, and Reverse within 7 days (the asset and the C$ go back; logged).

const stamp = (iso: string | null) => (iso ? new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "");
const STATUS: Record<AssetAdminSale["status"], string> = {
  offered: "Offered", declined: "Declined", expired: "Lapsed", cooling: "Cooling-off", cancelled: "Cancelled",
  failed: "Fell through", done: "Done", reversed: "Reversed",
};

export function AssetSalesAdmin({ api }: { api: StudioApi }) {
  const [data, setData] = useState<AssetAdmin | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const r = await api.assetSales!();
    if (r.ok) { setData(r.data); setError(null); } else setError(r.error);
  }, [api]);
  useEffect(() => { void load(); }, [load]);
  const reverse = async (id: number, reason: string) => {
    setBusy(true); setError(null);
    const r = await api.assetReverse!(id, reason);
    setBusy(false);
    if (r.ok) setData(r.data); else setError(r.error);
  };
  return (
    <section className="studio-card stack-8">
      <span className="overline">Asset sales · {data?.sales.length ?? 0} in 60 days</span>
      <p className="meta" style={{ margin: 0 }}>
        Businesses and houses sold between players: appraised, kept within the band, a 24-hour cooling-off, 10% to the city.
        Reverse a finished sale within {data?.reverseDays ?? 7} days if it was theft or an exploit: the asset goes back as it is now and
        the buyer gets the whole price back.
      </p>
      {error && <p className="error-text" style={{ margin: 0 }}>{error}</p>}
      {data && data.sales.length === 0 && <p className="meta" style={{ margin: 0 }}>No sales yet. Real estate moves slowly, even here.</p>}
      {data?.sales.map((s) => <SaleRow key={s.id} sale={s} busy={busy} onReverse={(reason) => void reverse(s.id, reason)} />)}
    </section>
  );
}

function SaleRow({ sale: s, busy, onReverse }: { sale: AssetAdminSale; busy: boolean; onReverse: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  const ratio = s.appraisal > 0 ? Math.round((s.price / s.appraisal) * 100) : 0;
  const young = (j?: string) => (j ? Math.floor((Date.now() - Date.parse(j)) / 86_400_000) : null);
  return (
    <div className="stack-4" style={{ borderTop: "1px solid var(--line, rgba(255,255,255,.08))", paddingTop: 8 }}>
      <span className="title">{s.emoji} {s.label}{s.kind === "business" && s.level ? ` · ${s.level}/3` : ""} · {STATUS[s.status]}</span>
      <span className="body">
        @{s.seller?.name ?? "deleted"} → @{s.buyer?.name ?? "deleted"}
        {s.buyer && ` (buyer's account ${young(s.buyer.joined)} days old)`}
      </span>
      <span className="meta">
        {formatCash(s.price)} for an appraisal of {formatCash(s.appraisal)} ({ratio}%) · fee {formatCash(s.fee)} · {stamp(s.settledAt ?? s.acceptedAt ?? s.offeredAt)}
        {s.reason && s.status !== "done" ? ` · ${s.reason}` : ""}
      </span>
      {(s.flags.length > 0 || s.traces) && (
        <span className="meta" style={{ color: "var(--warn, #FFB547)" }}>
          {[...s.flags.map((f) => `⚑ ${FLAG_COPY[f as FlagRule]?.title ?? f}`), ...(s.traces ? ["Carries traces (buyer was warned)"] : [])].join(" · ")}
        </span>
      )}
      {s.status === "reversed" && <span className="meta">Reversed {stamp(s.reversedAt)}{s.reverseReason ? ` · ${s.reverseReason}` : ""}</span>}
      {s.canReverse && (
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <input className="studio-input" style={{ flex: 1, minWidth: 160 }} value={reason} maxLength={300} placeholder="Why (for the record)" onChange={(e) => setReason(e.target.value)} />
          <button className="btn btn-taxi btn-sm" disabled={busy} onClick={() => onReverse(reason)}>Reverse</button>
        </div>
      )}
    </div>
  );
}
