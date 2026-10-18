"use client";

// Studio → Affiliates, step 2 (spec section 21; migration 0088): the Overview (totals, by day, top creators and
// links) and one affiliate's page (funnel, numbers over time, what their players bought, retention, commission
// history, and the players they brought in: admin-only, creators never see who their players are).

import { useEffect, useState } from "react";
import { HOLD_DAYS, PAYOUT_MIN_CENTS, lengthLabel, type AffiliatesOverview, type CreatorPage, type Owed } from "@/lib/creators";
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
