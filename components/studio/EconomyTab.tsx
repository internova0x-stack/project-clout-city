"use client";

import { useCallback, useEffect, useState } from "react";
import { formatCash } from "@/lib/economy";
import { FLAG_COPY, PHASE_COPY, type EconomyAdmin, type EconomyFlag, type EconomyPhase, type FlagOutcome } from "@/lib/playerEconomy";
import type { StudioApi } from "@/lib/studio";
import { Toggle } from "../Toggle";
import { MarketRecent } from "./MarketRecent";
// Phase 3 (migration 0153).
import { AssetSalesAdmin } from "./AssetSalesAdmin";

// The Player Economy (migration 0151): Studio → Economy. The phase switches, this week's numbers, the automatic flags to
// review, and accounts whose trading is frozen. Plain words for the owner; nothing here moves anyone's money.

const stamp = (iso: string) => new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const OUTCOME: Record<FlagOutcome, string> = { cleared: "Cleared", noted: "Noted, keep watching", frozen: "Trading frozen" };

export function EconomyTab({ api }: { api: StudioApi }) {
  const [data, setData] = useState<EconomyAdmin | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const r = await api.economy!();
    if (r.ok) { setData(r.data); setError(null); } else setError(r.error);
  }, [api]);
  useEffect(() => { void load(); }, [load]);
  const act = async (p: Promise<{ ok: true; data: EconomyAdmin } | { ok: false; error: string }>) => {
    setBusy(true); setError(null);
    const r = await p;
    setBusy(false);
    if (r.ok) setData(r.data); else setError(r.error);
  };
  const s = data?.settings;
  const open = data?.flags.filter((f) => f.status === "open") ?? [];
  const done = data?.flags.filter((f) => f.status !== "open") ?? [];
  return (
    <section className="stack-12">
      <section className="studio-card stack-8">
        <h2 className="display-md" style={{ margin: 0 }}>Player economy</h2>
        <p className="meta" style={{ margin: 0 }}>
          Players can give each other Shop items and hire each other through the Jobs board. Never cash, never real money. Every
          gift and job is logged, capped each week and checked for patterns that look like one account feeding another.
        </p>
        {error && <p className="error-text" style={{ margin: 0 }}>{error}</p>}
        {!data && !error && <p className="meta">Loading…</p>}
      </section>
      {data && s && (
        <>
          <section className="studio-card stack-8">
            <span className="overline">Phases</span>
            {(Object.keys(PHASE_COPY) as EconomyPhase[]).map((id) => (
              <div key={id} className="row" style={{ justifyContent: "space-between", gap: 12 }}>
                <span className="stack-4" style={{ minWidth: 0 }}>
                  <span className="title">{PHASE_COPY[id].title}</span>
                  <span className="meta">{PHASE_COPY[id].line}{PHASE_COPY[id].built ? "" : " Not built yet: switching it on does nothing until it ships."}</span>
                </span>
                <Toggle on={!!s.phases[id]} label={PHASE_COPY[id].title} disabled={busy} onChange={() => void act(api.economySet!(id, !s.phases[id]))} />
              </div>
            ))}
          </section>
          <section className="studio-card stack-8">
            <span className="overline">This week (from {data.week.start})</span>
            <div className="row" style={{ gap: 24, flexWrap: "wrap" }}>
              <span className="stack-4"><b className="display-md">{data.week.gifts}</b><span className="meta">gifts</span></span>
              <span className="stack-4"><b className="display-md">{data.week.jobs}</b><span className="meta">jobs paid</span></span>
              <span className="stack-4"><b className="display-md">{formatCash(data.week.value)}</b><span className="meta">value moved</span></span>
              <span className="stack-4"><b className="display-md">{formatCash(data.week.fees)}</b><span className="meta">city fees (gone for good)</span></span>
            </div>
            <p className="meta" style={{ margin: 0 }}>
              The rules: accounts {s.unlock.minAccountDays}+ days old at Rank {s.unlock.minRank}+; a {Math.round(s.fees.job * 100)}% fee on job pay
              ({Math.round(s.fees.asset * 100)}% on asset sales later), none on gifts; each player sends and receives at most {formatCash(s.weeklyCap.min)} a week
              (or half their usual weekly earnings, if that&apos;s more); gifts can&apos;t be resold for {s.noResaleDays} days; only {formatCash(s.worthCap.weekly)} a week
              of what players pay each other counts toward rank.
            </p>
          </section>
          <section className="studio-card stack-8">
            <span className="overline">To review · {open.length}</span>
            {open.length === 0 && <p className="meta" style={{ margin: 0 }}>Nothing flagged. The city is behaving. Suspicious.</p>}
            {open.map((f) => <FlagRow key={f.id} flag={f} busy={busy} onReview={(o, note) => void act(api.economyFlag!(f.id, o, note))} />)}
          </section>
          {/* Phase 2 (migration 0152): sales and swaps, with Reverse. */}
          {api.marketRecent && <MarketRecent api={api} />}
          {/* Phase 3 (migration 0153): business and property sales. */}
          {api.assetSales && <AssetSalesAdmin api={api} />}
          <section className="studio-card stack-8">
            <span className="overline">Frozen accounts · {data.frozen.length}</span>
            {data.frozen.length === 0 && <p className="meta" style={{ margin: 0 }}>None. A frozen account can still play; it just can&apos;t give, receive or take jobs.</p>}
            {data.frozen.map((p) => (
              <div key={p.id} className="row" style={{ justifyContent: "space-between", gap: 12 }}>
                <span className="stack-4" style={{ minWidth: 0 }}>
                  <span className="title">@{p.name}</span>
                  <span className="meta">Since {stamp(p.at)}{p.reason ? ` · ${p.reason}` : ""}</span>
                </span>
                <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void act(api.economyFreeze!(p.id, false, "Unfrozen in the Studio"))}>Unfreeze</button>
              </div>
            ))}
          </section>
          {done.length > 0 && (
            <section className="studio-card stack-8">
              <span className="overline">Reviewed lately</span>
              {done.map((f) => (
                <div key={f.id} className="stack-4">
                  <span className="title">{FLAG_COPY[f.rule]?.title ?? f.rule} · {f.players.map((p) => `@${p.name}`).join(" & ")}</span>
                  <span className="meta">{f.outcome ? OUTCOME[f.outcome] : "Reviewed"}{f.note ? ` · ${f.note}` : ""}{f.reviewedAt ? ` · ${stamp(f.reviewedAt)}` : ""}</span>
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </section>
  );
}

function FlagRow({ flag, busy, onReview }: { flag: EconomyFlag; busy: boolean; onReview: (o: FlagOutcome, note: string) => void }) {
  const [note, setNote] = useState("");
  const copy = FLAG_COPY[flag.rule] ?? { title: flag.rule, line: "" };
  const detail = Object.entries(flag.detail ?? {}).map(([k, v]) => `${k}: ${typeof v === "number" && k !== "transfers" && k !== "jobs" ? formatCash(v) : v}`).join(" · ");
  return (
    <div className="stack-8" style={{ borderTop: "1px solid var(--line, rgba(255,255,255,.08))", paddingTop: 8 }}>
      <span className="title">{copy.title}</span>
      <span className="meta">{copy.line}</span>
      <span className="body">{flag.players.map((p) => `@${p.name}${p.frozen ? " (frozen)" : ""}, joined ${new Date(p.joined).toLocaleDateString()}`).join(" · ")}</span>
      <span className="meta">{stamp(flag.createdAt)}{detail ? ` · ${detail}` : ""}</span>
      <input className="studio-input" value={note} maxLength={300} placeholder="A note for the record (optional)" onChange={(e) => setNote(e.target.value)} />
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => onReview("cleared", note)}>Looks fine</button>
        <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => onReview("noted", note)}>Keep watching</button>
        <button className="btn btn-taxi btn-sm" disabled={busy} onClick={() => onReview("frozen", note)}>Freeze their trading</button>
      </div>
    </div>
  );
}
