"use client";

// Studio → Affiliates, step 2 (spec section 21; migration 0088): the Overview (totals, by day, top creators and
// links) and one affiliate's page (funnel, numbers over time, what their players bought, retention, commission
// history, and the players they brought in: admin-only, creators never see who their players are).

import { useEffect, useState } from "react";
import { HOLD_DAYS, PAYOUT_METHODS, PAYOUT_MIN_CENTS, PLATFORMS, costPer, keptAfterSpend, lengthLabel, methodLabel, payoutsCsv, platformLabel, type AffiliatesOverview, type Creator, type CreatorPage, type CreatorVideo, type Owed, type PayoutMethod, type PayoutsAdmin, type Platform, type VideoInput, type VideosAdmin } from "@/lib/creators";
import { share } from "@/lib/insights";
import { recentWhen } from "@/lib/recent";
import { formatPrice } from "@/lib/store";
import type { StudioApi } from "@/lib/studio";
import { DailyBars, ShareRow } from "./Insights";

const n = (x: number) => x.toLocaleString("en-US");
const money = (c: number) => (c < 0 ? `−${formatPrice(-c)}` : formatPrice(c));
const day = (at: string) => new Date(at.length === 10 ? `${at}T12:00:00Z` : at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: at.length === 10 ? "UTC" : undefined });
const STATE_LABEL = { held: "Held", payable: "Payable", paid: "Paid" } as const;

function Tiles({ tiles }: { tiles: [string, string, string][] }) {
  return (
    <div className="studio-tiles aff-tiles">
      {tiles.map(([label, value, sub]) => (
        <div key={label} className="studio-card studio-tile">
          <span className="overline">{label}</span>
          <span className="display-lg tabular">{value}</span>
          <span className="meta">{sub}</span>
        </div>
      ))}
    </div>
  );
}

/** Held, payable and paid, with the hold and the payout minimum spelled out. */
function OwedLine({ owed }: { owed: Owed }) {
  return (
    <p className="meta" style={{ margin: 0 }}>
      Commission becomes payable {HOLD_DAYS} days after each payment, so refunds land first. Payouts go out monthly once
      a creator has {formatPrice(PAYOUT_MIN_CENTS)} payable{owed.payableCents >= PAYOUT_MIN_CENTS ? "." : ` (${formatPrice(owed.payableCents)} so far).`}
    </p>
  );
}

export function AffiliatesOverviewView({ api, days, onOpen }: { api: StudioApi; days: number; onOpen: (id: string) => void }) {
  const [data, setData] = useState<AffiliatesOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let stop = false;
    void api.affiliatesOverview!(days).then((r) => { if (!stop) { if (r.ok) { setData(r.data); setError(null); } else setError(r.error); } });
    return () => { stop = true; };
  }, [api, days]);
  if (error) return <div className="studio-note error"><span className="body-strong">{error}</span></div>;
  if (!data) return <p className="meta">Loading…</p>;
  const t = data.totals;
  const period = days === 0 ? "All time" : `Last ${days} days`;
  return (
    <div className="stack-16">
      <Tiles tiles={[
        ["Clicks", n(t.clicks), period],
        ["Sign-ups", n(t.signups), `${share(t.signups, t.clicks)} of clicks`],
        ["Paying players", n(t.payers), `${share(t.payers, t.signups)} of sign-ups`],
        ["Revenue", money(t.revenueCents), "what their players paid"],
        ["Commission", money(t.commissionCents), `on ${money(t.netCents)} net`],
        ["Kept after commission", money(t.netCents - t.commissionCents), "net revenue minus commission"],
        ["Held", money(t.heldCents), `inside the ${HOLD_DAYS} days`],
        ["Payable", money(t.payableCents), `${money(t.paidCents)} paid so far`],
      ]} />
      <div className="insights-charts">
        <DailyBars days={data.daily} pick={(d) => d.signups} label="Sign-ups" format={n} />
        <DailyBars days={data.daily} pick={(d) => d.revenueCents} label="Revenue" format={(v) => formatPrice(v)} />
        <DailyBars days={data.daily} pick={(d) => d.commissionCents ?? 0} label="Commission" format={(v) => formatPrice(v)} />
        <DailyBars days={data.daily} pick={(d) => d.clicks} label="Clicks" format={n} />
      </div>
      <div className="insights-two">
        <div className="studio-card stack-12">
          <span className="overline">Top creators</span>
          {data.topCreators.length === 0 ? <p className="meta" style={{ margin: 0 }}>No creators yet.</p> : (
            <div className="aff-list">
              {data.topCreators.map((c, i) => (
                <button key={c.id} className="aff-list-row" onClick={() => onOpen(c.id)}>
                  <span className="meta tabular">{i + 1}</span>
                  <span className="body-strong" style={{ flex: 1 }}>{c.name}</span>
                  <span className="meta tabular">{n(c.signups)} sign-ups</span>
                  <span className="body-strong tabular">{money(c.revenueCents)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="studio-card stack-12">
          <span className="overline">Top links</span>
          {data.topLinks.length === 0 ? <p className="meta" style={{ margin: 0 }}>No links yet.</p> : (
            <div className="aff-list">
              {data.topLinks.map((l, i) => (
                <div key={l.id} className="aff-list-row">
                  <span className="meta tabular">{i + 1}</span>
                  <span style={{ flex: 1, minWidth: 0 }}><code className="aff-code">/c/{l.slug}</code> <span className="meta">{l.creator}</span></span>
                  <span className="meta tabular">{n(l.clicks)} clicks</span>
                  <span className="body-strong tabular">{n(l.signups)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function CreatorPageView({ api, id, days, onBack, onEdit }: { api: StudioApi; id: string; days: number; onBack: () => void; onEdit: () => void }) {
  const [data, setData] = useState<CreatorPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  useEffect(() => {
    let stop = false;
    void api.creatorPage!(id, days).then((r) => { if (!stop) { if (r.ok) { setData(r.data); setError(null); } else setError(r.error); } });
    return () => { stop = true; };
  }, [api, id, days]);
  const back = <button className="chip" style={{ alignSelf: "flex-start" }} onClick={onBack}>‹ All creators</button>;
  if (error) return <div className="stack-12">{back}<div className="studio-note error"><span className="body-strong">{error}</span></div></div>;
  if (!data) return <div className="stack-12">{back}<p className="meta">Loading…</p></div>;
  const { creator: c, owed, funnel: f } = data;
  const period = days === 0 ? "All time" : `Last ${days} days`;
  const revenue = data.daily.reduce((t, d) => t + d.revenueCents, 0);
  const players = all ? data.players : data.players.slice(0, 25);
  return (
    <div className="stack-16">
      {back}
      <div className="row" style={{ gap: 12, flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div className="stack-4">
          <h2 className="display-md" style={{ margin: 0 }}>{c.name}{c.status === "paused" && <span className="aff-tag paused" style={{ marginLeft: 8 }}>Paused</span>}</h2>
          <p className="meta" style={{ margin: 0 }}>
            {c.handle ? `${c.handle} · ` : ""}code <code className="aff-code">{c.code}</code> · {c.rate}% · {lengthLabel(c.months).toLowerCase()} per player
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={onEdit}>Edit rate, length, gift</button>
      </div>

      <Tiles tiles={[
        ["Revenue", money(revenue), period],
        ["Commission earned", money(owed.periodCents), `on ${money(owed.periodNetCents)} net`],
        ["Held", money(owed.heldCents), `inside the ${HOLD_DAYS} days`],
        ["Payable", money(owed.payableCents), `${money(owed.paidCents)} paid so far`],
      ]} />
      <OwedLine owed={owed} />

      <div className="insights-two">
        <div className="studio-card stack-12">
          <span className="overline">Funnel · {period.toLowerCase()}</span>
          <div className="insights-rows">
            <ShareRow label="Clicks" value={f.clicks} of={f.clicks} right={n(f.clicks)} />
            <ShareRow label="Sign-ups" value={f.signups} of={Math.max(f.clicks, f.signups)} right={`${n(f.signups)}${f.clicks ? ` · ${share(f.signups, f.clicks)}` : ""}`} />
            <ShareRow label="Moved in" value={f.movedIn} of={Math.max(1, f.signups)} />
            <ShareRow label="First purchase" value={f.payers} of={Math.max(1, f.signups)} />
            <ShareRow label="VIP" value={f.vip} of={Math.max(1, f.signups)} />
          </div>
          <p className="meta" style={{ margin: 0 }}>Sign-ups include players who typed the code, so they can be more than clicks.</p>
        </div>
        <div className="studio-card stack-12">
          <span className="overline">Coming back</span>
          <div className="insights-retention">
            {(["d1", "d7", "d30"] as const).map((k) => (
              <div key={k} className="insights-stat">
                <span className="meta">{k === "d1" ? "Next day" : k === "d7" ? "Day 7" : "Day 30"}</span>
                <span className="display-md tabular">{share(data.retention[k].returned, data.retention[k].cohort)}</span>
                <span className="meta tabular">{n(data.retention[k].returned)} of {n(data.retention[k].cohort)}</span>
              </div>
            ))}
          </div>
          <span className="overline" style={{ marginTop: 8 }}>What their players bought</span>
          {data.products.length === 0 ? <p className="meta" style={{ margin: 0 }}>Nothing yet.</p> : (
            <div className="insights-rows">
              {data.products.map((p) => <ShareRow key={p.sku} label={`${p.name} × ${n(p.count)}`} value={p.revenueCents} of={Math.max(1, revenue)} right={formatPrice(p.revenueCents)} />)}
            </div>
          )}
        </div>
      </div>

      <div className="insights-charts">
        <DailyBars days={data.daily} pick={(d) => d.clicks} label="Clicks" format={n} />
        <DailyBars days={data.daily} pick={(d) => d.signups} label="Sign-ups" format={n} />
        <DailyBars days={data.daily} pick={(d) => d.revenueCents} label="Revenue" format={(v) => formatPrice(v)} />
      </div>

      <div className="studio-card stack-12">
        <span className="overline">Commission history</span>
        {data.commissions.length === 0 ? <p className="meta" style={{ margin: 0 }}>No payments from their players yet.</p> : (
          <div className="insights-table-wrap">
            <table className="insights-table aff-table">
              <thead><tr>
                <th scope="col">Date</th><th scope="col">Player</th><th scope="col">What</th><th scope="col">Price</th><th scope="col">Stripe fee</th>
                <th scope="col">Tax</th><th scope="col">Net</th><th scope="col">Rate</th><th scope="col">Commission</th><th scope="col">State</th>
              </tr></thead>
              <tbody>
                {data.commissions.map((m) => (
                  <tr key={m.id} className={m.kind === "reversal" ? "aff-reversal" : undefined}>
                    <td>{day(m.at)}</td>
                    <td>{m.player ? `@${m.player}` : "–"}</td>
                    <td>{m.kind === "reversal" ? `Refund · ${m.name ?? m.sku}` : `${m.name ?? m.sku ?? "VIP"}${m.kind === "renewal" ? " (renewal)" : ""}`}</td>
                    <td className="tabular">{money(m.grossCents)}</td>
                    <td className="tabular" title={m.feeEstimated ? "Estimated: Stripe's fee couldn't be read" : undefined}>{m.kind === "reversal" ? "–" : `${money(m.feeCents)}${m.feeEstimated ? "*" : ""}`}</td>
                    <td className="tabular">{m.kind === "reversal" ? "–" : money(m.taxCents)}</td>
                    <td className="tabular">{money(m.netCents)}</td>
                    <td className="tabular">{m.rate}%</td>
                    <td className="tabular body-strong">{money(m.commissionCents)}</td>
                    <td><span className={`aff-tag ${m.state}`}>{STATE_LABEL[m.state]}</span>{m.state === "held" && <span className="meta"> until {day(m.payableOn)}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data.commissions.some((m) => m.feeEstimated) && <p className="meta" style={{ margin: 0 }}>* Stripe&apos;s fee couldn&apos;t be read for that payment, so it&apos;s estimated at 2.9% + 30¢.</p>}
      </div>

      <div className="studio-card stack-12">
        <div className="row" style={{ justifyContent: "space-between", gap: 8 }}>
          <span className="overline">Players they brought in ({n(data.players.length)})</span>
          <span className="meta">Admins only: creators see counts, never names.</span>
        </div>
        {data.players.length === 0 ? <p className="meta" style={{ margin: 0 }}>Nobody yet.</p> : (
          <div className="insights-table-wrap">
            <table className="insights-table aff-table">
              <thead><tr>
                <th scope="col">Player</th><th scope="col">Signed up</th><th scope="col">Through</th><th scope="col">Spent</th>
                <th scope="col">Commission</th><th scope="col">Last seen</th><th scope="col">Earns until</th>
              </tr></thead>
              <tbody>
                {players.map((p) => (
                  <tr key={p.id}>
                    <td className="body-strong">@{p.name}</td>
                    <td>{day(p.joinedAt)}</td>
                    <td>{p.how === "code" ? "Typed the code" : p.link ? <code className="aff-code">/c/{p.link}</code> : "Link"}</td>
                    <td className="tabular">{formatPrice(p.spendCents)}</td>
                    <td className="tabular">{money(p.commissionCents)}</td>
                    <td>{p.lastSeen ? recentWhen(p.lastSeen) : "never"}</td>
                    <td>{p.until ? day(p.until) : "For life"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data.players.length > players.length && <button className="chip" style={{ alignSelf: "center" }} onClick={() => setAll(true)}>Show all {n(data.players.length)}</button>}
      </div>
    </div>
  );
}

/**
 * Payouts by hand (migration 0090): what each creator is owed today, marking a payout as sent, the CSV for the bank
 * or PayPal run, and the history (a payout marked by mistake is undone, not deleted). Stripe Connect comes later.
 */
export function PayoutsView({ api, onOpen }: { api: StudioApi; onOpen: (id: string) => void }) {
  const [data, setData] = useState<PayoutsAdmin | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const [paying, setPaying] = useState<string | null>(null);
  const [undoing, setUndoing] = useState<number | null>(null);
  useEffect(() => {
    let stop = false;
    void api.payouts!().then((r) => { if (!stop) { if (r.ok) { setData(r.data); setError(null); } else setError(r.error); } });
    return () => { stop = true; };
  }, [api, nonce]);
  if (error && !data) return <div className="studio-note error"><span className="body-strong">{error}</span></div>;
  if (!data) return <p className="meta">Loading…</p>;
  const ready = data.due.filter((d) => d.payableCents >= data.minimumCents);
  const total = ready.reduce((t, d) => t + d.payableCents, 0);
  const csv = () => {
    const blob = new Blob([payoutsCsv(ready, data.today)], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `clout-city-payouts-${data.today}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const done = (message: string) => { setPaying(null); setUndoing(null); setOk(message); setError(null); setNonce((x) => x + 1); };
  return (
    <div className="stack-16">
      {error && <div className="studio-note error"><span className="body-strong">{error}</span></div>}
      {ok && <div className="studio-note ok"><span className="body-strong">{ok}</span><button className="chip" onClick={() => setOk(null)}>OK</button></div>}
      <div className="studio-tiles aff-tiles">
        {([
          ["Ready to pay", money(total), `${n(ready.length)} ${ready.length === 1 ? "creator" : "creators"} at ${formatPrice(data.minimumCents)} or more`],
          ["Below the minimum", money(data.due.filter((d) => d.payableCents > 0 && d.payableCents < data.minimumCents).reduce((t, d) => t + d.payableCents, 0)), "rolls over to next month"],
          ["Held", money(data.due.reduce((t, d) => t + d.heldCents, 0)), `inside the ${HOLD_DAYS} days`],
          ["Paid this year", money(data.history.filter((h) => !h.voidedAt && h.paidAt.slice(0, 4) === data.today.slice(0, 4)).reduce((t, h) => t + h.totalCents, 0)), ((k) => `${n(k)} ${k === 1 ? "payout" : "payouts"} in all`)(data.history.filter((h) => !h.voidedAt).length)],
        ] as const).map(([label, value, sub]) => (
          <div key={label} className="studio-card studio-tile"><span className="overline">{label}</span><span className="display-lg tabular">{value}</span><span className="meta">{sub}</span></div>
        ))}
      </div>

      <div className="studio-card stack-12">
        <div className="row" style={{ justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          <span className="overline">Owed today</span>
          <button className="btn btn-secondary btn-sm" disabled={ready.length === 0} onClick={csv}>Download CSV ({n(ready.length)})</button>
        </div>
        {data.due.length === 0 ? <p className="meta" style={{ margin: 0 }}>Nobody is owed anything yet.</p> : (
          <div className="insights-table-wrap">
            <table className="insights-table aff-table">
              <thead><tr><th scope="col">Creator</th><th scope="col">Email</th><th scope="col">Payable</th><th scope="col">Held</th><th scope="col">Next payable</th><th scope="col">Last paid</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {data.due.map((d) => (
                  <tr key={d.creatorId}>
                    <td><button className="linkish" onClick={() => onOpen(d.creatorId)}>{d.name}</button>{d.status === "paused" && <span className="aff-tag paused" style={{ marginLeft: 6 }}>Paused</span>}</td>
                    <td>{d.email ?? <span className="meta">no email</span>}</td>
                    <td className="tabular body-strong">{money(d.payableCents)}{d.payableCents > 0 && d.payableCents < data.minimumCents && <span className="aff-tag held">under {formatPrice(data.minimumCents)}</span>}</td>
                    <td className="tabular">{money(d.heldCents)}</td>
                    <td>{d.nextPayableOn ? day(d.nextPayableOn) : "–"}</td>
                    <td>{d.lastPaidAt ? day(d.lastPaidAt) : "never"}</td>
                    <td>{d.payableCents > 0 && <button className="chip" onClick={() => setPaying(paying === d.creatorId ? null : d.creatorId)}>{paying === d.creatorId ? "Cancel" : "Mark paid…"}</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {paying && <MarkPaid api={api} row={data.due.find((d) => d.creatorId === paying)!} minimum={data.minimumCents} onDone={done} onError={setError} />}
        <p className="meta" style={{ margin: 0 }}>
          Send the money first (bank or PayPal), then mark it paid here: it moves from Payable to Paid on the creator&apos;s page.
          Never type bank details here; a reference (your transfer number) is enough.
        </p>
      </div>

      <div className="studio-card stack-12">
        <span className="overline">Payout history</span>
        {data.history.length === 0 ? <p className="meta" style={{ margin: 0 }}>No payouts yet.</p> : (
          <div className="insights-table-wrap">
            <table className="insights-table aff-table">
              <thead><tr><th scope="col">Paid</th><th scope="col">Creator</th><th scope="col">Amount</th><th scope="col">Method</th><th scope="col">Reference</th><th scope="col">By</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {data.history.map((h) => (
                  <tr key={h.id} className={h.voidedAt ? "aff-retired" : undefined}>
                    <td>{day(h.paidAt)}</td>
                    <td>{h.name}</td>
                    <td className="tabular body-strong">{money(h.totalCents)}<span className="meta"> · {n(h.items)} {h.items === 1 ? "payment" : "payments"}</span></td>
                    <td>{methodLabel(h.method)}</td>
                    <td>{h.reference ?? "–"}{h.note && <span className="meta" style={{ display: "block" }}>{h.note}</span>}</td>
                    <td className="meta">{h.paidBy ?? "–"}</td>
                    <td>
                      {h.voidedAt ? <span className="meta">Undone: {h.voidReason}</span>
                        : undoing === h.id ? <UndoPayout api={api} id={h.id} onDone={done} onCancel={() => setUndoing(null)} onError={setError} />
                        : <button className="chip" onClick={() => setUndoing(h.id)}>Undo…</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="studio-card stack-8 aff-soon">
        <span className="overline">Coming soon: Stripe Connect</span>
        <p className="meta" style={{ margin: 0 }}>Creators onboard themselves (identity, tax forms, bank) and a payout becomes one Stripe transfer. Stripe also files their 1099s in the US. Until then, payouts go out by hand.</p>
      </div>
    </div>
  );
}

function MarkPaid({ api, row, minimum, onDone, onError }: { api: StudioApi; row: PayoutsAdmin["due"][number]; minimum: number; onDone: (m: string) => void; onError: (e: string) => void }) {
  const [method, setMethod] = useState<PayoutMethod>("bank_transfer");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const below = row.payableCents < minimum;
  const [anyway, setAnyway] = useState(false);
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    const r = await api.payoutMark!(row.creatorId, method, reference, note, anyway);
    setBusy(false);
    if (!r.ok) return onError(r.error);
    onDone(`Marked ${money(r.data.totalCents)} paid to ${row.name}.`);
  };
  return (
    <div className="aff-paybox stack-12">
      <p className="body-strong" style={{ margin: 0 }}>Mark {money(row.payableCents)} paid to {row.name}</p>
      <div className="aff-grid">
        <label className="stack-4"><span className="overline">How</span>
          <select className="studio-input" value={method} onChange={(e) => setMethod(e.target.value as PayoutMethod)}>
            {PAYOUT_METHODS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </label>
        <label className="stack-4"><span className="overline">Reference (optional)</span><input className="studio-input" value={reference} onChange={(e) => setReference(e.target.value)} maxLength={120} placeholder="Transfer or PayPal id" /></label>
        <label className="stack-4"><span className="overline">Note (optional)</span><input className="studio-input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="October payout" /></label>
      </div>
      {below && (
        <label className="check-row">
          <input type="checkbox" checked={anyway} onChange={(e) => setAnyway(e.target.checked)} />
          <span>Pay below the {formatPrice(minimum)} minimum (for example, closing the deal)</span>
        </label>
      )}
      <button className="btn btn-taxi btn-sm" style={{ alignSelf: "flex-start" }} disabled={busy || (below && !anyway)} onClick={() => void go()}>{busy ? "Marking…" : `I've sent ${money(row.payableCents)}`}</button>
    </div>
  );
}

function UndoPayout({ api, id, onDone, onCancel, onError }: { api: StudioApi; id: number; onDone: (m: string) => void; onCancel: () => void; onError: (e: string) => void }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    const r = await api.payoutVoid!(id, reason);
    setBusy(false);
    if (!r.ok) return onError(r.error);
    onDone("Payout undone. That money is payable again.");
  };
  return (
    <span className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
      <input className="studio-input" style={{ width: 180 }} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why? (logged)" maxLength={300} aria-label="Why undo" />
      <button className="chip" disabled={busy || !reason.trim()} onClick={() => void go()}>Undo</button>
      <button className="chip" onClick={onCancel}>Keep</button>
    </span>
  );
}

/**
 * The UGC engine's tracking (migration 0091): each paid video with its link, fee and post date next to what that
 * link brought in, and each creator's spend against their results (cost per paying player, kept after everything).
 */
export function VideosView({ api, creators, onOpen }: { api: StudioApi; creators: Creator[]; onOpen: (id: string) => void }) {
  const [data, setData] = useState<VideosAdmin | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const [editing, setEditing] = useState<CreatorVideo | "new" | null>(null);
  const [showRemoved, setShowRemoved] = useState(false);
  useEffect(() => {
    let stop = false;
    void api.videos!().then((r) => { if (!stop) { if (r.ok) { setData(r.data); setError(null); } else setError(r.error); } });
    return () => { stop = true; };
  }, [api, nonce]);
  if (error && !data) return <div className="studio-note error"><span className="body-strong">{error}</span></div>;
  if (!data) return <p className="meta">Loading…</p>;
  const done = (m: string) => { setEditing(null); setOk(m); setError(null); setNonce((x) => x + 1); };
  const spend = data.videos.reduce((t, v) => t + v.feeCents, 0);
  const linked = data.videos.filter((v) => v.payers !== null);
  const vSignups = linked.reduce((t, v) => t + (v.signups ?? 0), 0);
  const vPayers = linked.reduce((t, v) => t + (v.payers ?? 0), 0);
  const linkedSpend = linked.reduce((t, v) => t + v.feeCents, 0);
  const cpp = (c: number | null) => (c === null ? "–" : formatPrice(c));
  const rows = data.videos.filter((v) => showRemoved || v.status === "live");
  const status = async (v: CreatorVideo) => {
    const r = await api.videoStatus!(v.id, v.status === "live" ? "removed" : "live");
    if (!r.ok) return setError(r.error);
    done(v.status === "live" ? `Marked "${v.title}" removed. Its spend still counts.` : `"${v.title}" is live again.`);
  };
  return (
    <div className="stack-16">
      {error && <div className="studio-note error"><span className="body-strong">{error}</span></div>}
      {ok && <div className="studio-note ok"><span className="body-strong">{ok}</span><button className="chip" onClick={() => setOk(null)}>OK</button></div>}
      <div className="studio-tiles aff-tiles">
        {([
          ["Spent on videos", money(spend), `${n(data.videos.length)} ${data.videos.length === 1 ? "video" : "videos"} logged`],
          ["Sign-ups from video links", n(vSignups), `${cpp(costPer(linkedSpend, vSignups))} per sign-up`],
          ["Paying players", n(vPayers), `${cpp(costPer(linkedSpend, vPayers))} per paying player`],
          ["Kept after everything", money(data.creators.reduce((t, c) => t + keptAfterSpend(c.netCents, c.commissionCents, c.spendCents), 0)), "net revenue − commission − video fees"],
        ] as const).map(([label, value, sub]) => (
          <div key={label} className="studio-card studio-tile"><span className="overline">{label}</span><span className="display-lg tabular">{value}</span><span className="meta">{sub}</span></div>
        ))}
      </div>

      {editing ? (
        <VideoForm api={api} creators={creators} video={editing === "new" ? null : editing} onCancel={() => setEditing(null)} onSaved={done} onError={setError} />
      ) : null}

      <div className="studio-card stack-12">
        <div className="row" style={{ justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          <span className="overline">Videos</span>
          <span className="row" style={{ gap: 6 }}>
            {data.videos.some((v) => v.status === "removed") && <button className="chip" aria-pressed={showRemoved} onClick={() => setShowRemoved((x) => !x)}>Show removed</button>}
            {!editing && creators.length > 0 && <button className="btn btn-taxi btn-sm" onClick={() => setEditing("new")}>＋ Log a video</button>}
          </span>
        </div>
        {rows.length === 0 ? <p className="meta" style={{ margin: 0 }}>{creators.length ? "No videos logged yet. Log each paid video with its own link, so its results show here." : "Add a creator first."}</p> : (
          <div className="insights-table-wrap">
            <table className="insights-table aff-table">
              <thead><tr>
                <th scope="col">Posted</th><th scope="col">Video</th><th scope="col">Creator</th><th scope="col">Link</th><th scope="col">Fee</th>
                <th scope="col">Clicks</th><th scope="col">Sign-ups</th><th scope="col">Paying</th><th scope="col">Revenue</th><th scope="col">Per paying player</th>
                <th scope="col"><span className="sr-only">Actions</span></th>
              </tr></thead>
              <tbody>
                {rows.map((v) => (
                  <tr key={v.id} className={v.status === "removed" ? "aff-retired" : undefined}>
                    <td>{v.postedOn ? day(v.postedOn) : "–"}</td>
                    <td><span className="body-strong">{v.url ? <a href={v.url} target="_blank" rel="noreferrer">{v.title}</a> : v.title}</span>
                      <span className="meta" style={{ display: "block" }}>{platformLabel(v.platform)}{v.status === "removed" ? " · removed" : ""}{v.note ? ` · ${v.note}` : ""}</span></td>
                    <td><button className="linkish" onClick={() => onOpen(v.creatorId)}>{v.creator}</button></td>
                    <td>{v.slug ? <code className="aff-code">/c/{v.slug}</code> : <span className="meta">code only</span>}</td>
                    <td className="tabular">{money(v.feeCents)}</td>
                    <td className="tabular">{v.clicks === null ? "–" : n(v.clicks)}</td>
                    <td className="tabular">{v.signups === null ? "–" : n(v.signups)}</td>
                    <td className="tabular">{v.payers === null ? "–" : n(v.payers)}</td>
                    <td className="tabular">{v.revenueCents === null ? "–" : money(v.revenueCents)}</td>
                    <td className="tabular body-strong">{v.payers === null ? "–" : cpp(costPer(v.feeCents, v.payers))}</td>
                    <td><span className="row" style={{ gap: 4, flexWrap: "nowrap" }}>
                      <button className="chip" onClick={() => setEditing(v)}>Edit</button>
                      <button className="chip" onClick={() => void status(v)}>{v.status === "live" ? "Removed" : "Live again"}</button>
                    </span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="meta" style={{ margin: 0 }}>A video&apos;s numbers come from its own link, so give every paid video a link in the Links view. Videos without one (code only) count toward their creator below.</p>
      </div>

      <div className="studio-card stack-12">
        <span className="overline">Cost per creator · all time</span>
        <div className="insights-table-wrap">
          <table className="insights-table aff-table">
            <thead><tr>
              <th scope="col">Creator</th><th scope="col">Videos</th><th scope="col">Spent</th><th scope="col">Sign-ups</th><th scope="col">Paying</th>
              <th scope="col">Per sign-up</th><th scope="col">Per paying player</th><th scope="col">Revenue</th><th scope="col">Commission</th><th scope="col">Kept</th>
            </tr></thead>
            <tbody>
              {data.creators.map((c) => {
                const kept = keptAfterSpend(c.netCents, c.commissionCents, c.spendCents);
                return (
                  <tr key={c.creatorId}>
                    <td><button className="linkish" onClick={() => onOpen(c.creatorId)}>{c.name}</button></td>
                    <td className="tabular">{n(c.videos)}</td>
                    <td className="tabular">{money(c.spendCents)}</td>
                    <td className="tabular">{n(c.signups)}</td>
                    <td className="tabular">{n(c.payers)}</td>
                    <td className="tabular">{cpp(costPer(c.spendCents, c.signups))}</td>
                    <td className="tabular body-strong">{cpp(costPer(c.spendCents, c.payers))}</td>
                    <td className="tabular">{money(c.revenueCents)}</td>
                    <td className="tabular">{money(c.commissionCents)}</td>
                    <td className={`tabular body-strong${kept < 0 ? " aff-neg" : ""}`}>{money(kept)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="meta" style={{ margin: 0 }}>Kept = net revenue from their players (after Stripe&apos;s fee and tax) − their commission − what we paid for their videos. Red means they cost more than they brought in so far.</p>
      </div>
    </div>
  );
}

function VideoForm({ api, creators, video, onCancel, onSaved, onError }: { api: StudioApi; creators: Creator[]; video: CreatorVideo | null; onCancel: () => void; onSaved: (m: string) => void; onError: (e: string) => void }) {
  const [f, setF] = useState<VideoInput>(() => video
    ? { id: video.id, creatorId: video.creatorId, linkId: video.linkId, title: video.title, platform: video.platform, url: video.url ?? "", postedOn: video.postedOn ?? "", feeCents: video.feeCents, note: video.note ?? "" }
    : { creatorId: creators[0]?.id ?? "", linkId: null, title: "", platform: "tiktok", url: "", postedOn: new Date().toISOString().slice(0, 10), feeCents: 0, note: "" });
  const [fee, setFee] = useState(video ? (video.feeCents / 100).toFixed(2) : "");
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof VideoInput>(k: K, v: VideoInput[K]) => setF((x) => ({ ...x, [k]: v }));
  const links = creators.find((c) => c.id === f.creatorId)?.links ?? [];
  const feeCents = Math.round(Number(fee || 0) * 100);
  const save = async () => {
    setBusy(true);
    const r = await api.videoSave!({ ...f, feeCents });
    setBusy(false);
    if (!r.ok) return onError(r.error);
    onSaved(video ? `Saved "${f.title.trim()}".` : `Logged "${f.title.trim()}".`);
  };
  return (
    <div className="studio-card stack-12">
      <span className="overline">{video ? "Edit video" : "Log a video"}</span>
      <div className="aff-grid">
        <label className="stack-4"><span className="overline">Creator</span>
          <select className="studio-input" value={f.creatorId} onChange={(e) => setF((x) => ({ ...x, creatorId: e.target.value, linkId: null }))}>
            {creators.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="stack-4"><span className="overline">Its link</span>
          <select className="studio-input" value={f.linkId ?? ""} onChange={(e) => set("linkId", e.target.value ? Number(e.target.value) : null)}>
            <option value="">No link (code only)</option>
            {links.map((l) => <option key={l.id} value={l.id}>/c/{l.slug} · {l.label}{l.status === "retired" ? " (retired)" : ""}</option>)}
          </select>
        </label>
        <label className="stack-4"><span className="overline">Title</span><input className="studio-input" value={f.title} onChange={(e) => set("title", e.target.value)} maxLength={80} placeholder="Haunted Hell Gate tour" /></label>
        <label className="stack-4"><span className="overline">Platform</span>
          <select className="studio-input" value={f.platform} onChange={(e) => set("platform", e.target.value as Platform)}>
            {PLATFORMS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </label>
        <label className="stack-4"><span className="overline">Posted on</span><input className="studio-input" type="date" value={f.postedOn} onChange={(e) => set("postedOn", e.target.value)} /></label>
        <label className="stack-4"><span className="overline">Fee we paid ($)</span><input className="studio-input" type="number" min={0} step={0.01} value={fee} onChange={(e) => setFee(e.target.value)} placeholder="150.00" /></label>
        <label className="stack-4"><span className="overline">Video URL (optional)</span><input className="studio-input" type="url" value={f.url} onChange={(e) => set("url", e.target.value)} maxLength={300} placeholder="https://…" /></label>
        <label className="stack-4"><span className="overline">Note (optional)</span><input className="studio-input" value={f.note} onChange={(e) => set("note", e.target.value)} maxLength={300} placeholder="Brief: a date night gone wrong" /></label>
      </div>
      <div className="row" style={{ gap: 8 }}>
        <button className="btn btn-taxi btn-sm" disabled={busy || !f.title.trim() || !f.creatorId || feeCents < 0} onClick={() => void save()}>{busy ? "Saving…" : video ? "Save" : "Log video"}</button>
        <button className="btn btn-secondary btn-sm" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
