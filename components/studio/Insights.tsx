"use client";

// Insights (owner, Oct 15; migration 0053): how many players, what they spend, how long they play,
// whether they come back and which features they use. Admin-only, read from admin_insights().

import { useEffect, useState } from "react";
import { ASPIRATIONS } from "@/lib/aspirations";
import { PRODUCT_LABEL, duration, share, type Insights, type InsightsDay } from "@/lib/insights";
import { RANKS } from "@/lib/ranks";
import { formatPrice } from "@/lib/store";
import type { Admin } from "@/lib/studio";

const PERIODS = [7, 30, 90] as const;
const n = (x: number) => x.toLocaleString("en-US");
const shortDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** Bars for one daily number, drawn to scale from zero, with the latest value and the period's peak. */
export function DailyBars<D extends { date: string } = InsightsDay>({ days, pick, label, format }: { days: D[]; pick: (d: D) => number; label: string; format: (v: number) => string }) {
  const values = days.map(pick);
  const max = Math.max(1, ...values);
  const total = values.reduce((a, b) => a + b, 0);
  const w = 300, h = 72, gap = 2;
  const bw = Math.max(1, (w - gap * (values.length - 1)) / Math.max(1, values.length));
  return (
    <div className="studio-card stack-8 insights-chart">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <span className="overline">{label}</span>
        <span className="meta tabular">peak {format(max === 1 && total === 0 ? 0 : max)}</span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} role="img" aria-label={`${label}, daily, peak ${format(max)}`} preserveAspectRatio="none">
        <line x1="0" x2={w} y1={h - 0.5} y2={h - 0.5} stroke="var(--divider)" />
        {values.map((v, i) => {
          const bh = v === 0 ? 0 : Math.max(2, (v / max) * (h - 4));
          return <rect key={days[i].date} x={i * (bw + gap)} y={h - bh} width={bw} height={bh} rx={Math.min(2, bw / 2)} fill={i === values.length - 1 ? "var(--neon-500)" : "var(--insights-bar)"} opacity={i === values.length - 1 ? 1 : 0.75}><title>{`${shortDate(days[i].date)}: ${format(v)}`}</title></rect>;
        })}
      </svg>
      <div className="row meta" style={{ justifyContent: "space-between" }}>
        <span>{days.length ? shortDate(days[0].date) : ""}</span>
        <span className="tabular">Today {format(values.at(-1) ?? 0)}</span>
      </div>
    </div>
  );
}

/** A horizontal bar for a share of a whole, labelled with the count and the share. Goes inside .insights-rows. */
export function ShareRow({ label, value, of, right }: { label: string; value: number; of: number; right?: string }) {
  const pct = of > 0 ? Math.min(100, (100 * value) / of) : 0;
  return (
    <>
      <span className="body insights-label">{label}</span>
      <span className="body-strong tabular insights-num">{right ?? `${n(value)} · ${share(value, of)}`}</span>
      <span className="insights-track" aria-hidden="true"><span style={{ width: `${pct}%` }} /></span>
    </>
  );
}

export function InsightsTab({ load }: { load: (days: number) => Promise<Admin<Insights>> }) {
  const [days, setDays] = useState<number>(30);
  const [data, setData] = useState<Insights | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let stop = false;
    setError(null);
    void load(days).then((r) => { if (!stop) { if (r.ok) setData(r.data); else setError(r.error); } });
    return () => { stop = true; };
  }, [load, days]);
  if (error) return <div className="studio-note error"><span className="body-strong">{error}</span></div>;
  if (!data) return <p className="meta">Loading…</p>;
  const t = data.totals;
  const tiles: { label: string; value: string; sub: string }[] = [
    { label: "Players", value: n(t.players), sub: `${n(t.accounts)} accounts signed up · ${n(t.accounts - t.players)} never moved in` },
    { label: "New sign-ups", value: n(t.signupsPeriod), sub: `${n(t.signupsToday)} today · ${n(t.signups7)} in the last 7 days` },
    { label: "Active players", value: n(t.activeToday), sub: `today · ${n(t.active7)} this week · ${n(t.active30)} this month` },
    { label: `Revenue, last ${data.days} days`, value: formatPrice(t.revenuePeriodCents), sub: `${formatPrice(t.revenue7Cents)} this week · ${formatPrice(t.revenueCents)} all time` },
    { label: "Session length", value: duration(t.avgSessionSeconds), sub: `average · median ${duration(t.medianSessionSeconds)} · ${n(t.sessionsPeriod)} sessions` },
    { label: "Time per player per day", value: `${t.minutesPerActiveDay} min`, sub: `${t.sessionsPerActiveDay} sessions a day on days they play` },
    { label: "Paying players", value: n(t.payers), sub: `${share(t.payers, t.players)} of players · ${t.refunds} refund${t.refunds === 1 ? "" : "s"}` },
    { label: "VIP members", value: n(t.vipMembers), sub: `${n(t.chatForever)} with chat forever` },
  ];
  const ret = data.retention;
  const funnelTop = data.funnel[0]?.n ?? 0;
  const spendTotal = data.spending.reduce((a, s) => a + s.cents, 0);
  const rankTotal = data.ranks.reduce((a, r) => a + r.players, 0);
  return (
    <section className="stack-16">
      <div className="row" style={{ gap: 8, flexWrap: "wrap", justifyContent: "space-between", alignItems: "center" }}>
        <p className="meta" style={{ margin: 0 }}>New York days · as of {shortDate(data.today)}</p>
        <div className="row" style={{ gap: 6 }} role="group" aria-label="Period">
          {PERIODS.map((p) => <button key={p} className="chip" aria-pressed={days === p} onClick={() => setDays(p)}>Last {p} days</button>)}
        </div>
      </div>

      <div className="studio-tiles">
        {tiles.map((x) => (
          <div key={x.label} className="studio-card studio-tile">
            <span className="overline">{x.label}</span>
            <span className="display-lg tabular">{x.value}</span>
            <span className="meta">{x.sub}</span>
          </div>
        ))}
      </div>

      <div className="insights-charts">
        <DailyBars days={data.daily} pick={(d) => d.active} label="Active players" format={n} />
        <DailyBars days={data.daily} pick={(d) => d.signups} label="New sign-ups" format={n} />
        <DailyBars days={data.daily} pick={(d) => d.revenueCents} label="Revenue" format={(v) => formatPrice(v)} />
        <DailyBars days={data.daily} pick={(d) => d.avgSessionSeconds} label="Average session" format={duration} />
      </div>

      <div className="studio-card stack-12">
        <span className="overline">Coming back</span>
        <div className="insights-retention">
          {(["d1", "d7", "d30"] as const).map((k) => (
            <div key={k} className="insights-stat">
              <span className="meta">{k === "d1" ? "Next day" : k === "d7" ? "Day 7" : "Day 30"}</span>
              <span className="display-md tabular">{share(ret[k].returned, ret[k].cohort)}</span>
              <span className="meta tabular">{n(ret[k].returned)} of {n(ret[k].cohort)}</span>
            </div>
          ))}
        </div>
        {data.cohorts.length > 0 && (
          <div className="insights-table-wrap">
            <table className="insights-table">
              <thead><tr><th scope="col">Joined the week of</th><th scope="col">Players</th><th scope="col">Next day</th><th scope="col">Day 7</th><th scope="col">Day 30</th></tr></thead>
              <tbody>
                {data.cohorts.map((c) => (
                  <tr key={c.week}>
                    <td>{shortDate(c.week)}</td>
                    <td className="tabular">{n(c.size)}</td>
                    <td className="tabular">{c.d1Eligible ? share(c.d1, c.d1Eligible) : "–"}</td>
                    <td className="tabular">{c.d7Eligible ? share(c.d7, c.d7Eligible) : "–"}</td>
                    <td className="tabular">{c.d30Eligible ? share(c.d30, c.d30Eligible) : "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="meta" style={{ margin: 0 }}>A player counts as back when they open the game on exactly that day after joining. A dash means that week isn&apos;t old enough yet.</p>
      </div>

      <div className="insights-two">
        <div className="studio-card stack-8">
          <span className="overline">First steps, all time</span>
          <div className="insights-rows">{data.funnel.map((f) => <ShareRow key={f.step} label={f.step} value={f.n} of={funnelTop} />)}</div>
        </div>
        <div className="studio-card stack-8">
          <span className="overline">What players do, last {data.days} days</span>
          <div className="insights-rows">{[...data.features].sort((a, b) => b.players - a.players).map((f) => <ShareRow key={f.feature} label={f.feature} value={f.players} of={t.activePeriod} />)}</div>
          <p className="meta" style={{ margin: 0 }}>Share of the {n(t.activePeriod)} players active in the period. Businesses count every owner.</p>
        </div>
      </div>

      <div className="insights-two">
        <div className="studio-card stack-8">
          <span className="overline">Revenue by product, all time</span>
          {data.spending.length === 0 && <p className="meta" style={{ margin: 0 }}>No purchases yet.</p>}
          {data.spending.length > 0 && (
            <div className="insights-rows">
              {data.spending.map((s) => (
                <ShareRow key={s.type} label={PRODUCT_LABEL[s.type] ?? s.type} value={s.cents} of={spendTotal}
                  right={`${formatPrice(s.cents)} · ${n(s.count)} sold · ${n(s.buyers)} buyers`} />
              ))}
            </div>
          )}
          {data.topProducts.length > 0 && (
            <>
              <span className="overline" style={{ marginTop: 8 }}>Top products</span>
              {data.topProducts.map((p) => (
                <div key={p.sku} className="ledger-row" style={{ padding: "6px 0" }}>
                  <span className="body">{p.name}</span>
                  <span className="body-strong tabular">{formatPrice(p.cents)} · {n(p.count)}</span>
                </div>
              ))}
            </>
          )}
          <p className="meta" style={{ margin: 0 }}>Includes VIP renewals once Stripe sends invoice.paid (docs/SETUP.md). Refunded purchases don&apos;t count.</p>
        </div>
        <div className="studio-card stack-8">
          <span className="overline">Players by rank</span>
          <div className="insights-rows">
            {RANKS.map((r) => {
              const p = data.ranks.find((x) => x.level === r.level)?.players ?? 0;
              return <ShareRow key={r.level} label={`${r.emoji} ${r.title}`} value={p} of={rankTotal} />;
            })}
          </div>
          <p className="meta" style={{ margin: 0 }}>Typical player: C${n(Math.round(data.economy.medianCash))} cash, {n(Math.round(data.economy.medianClout))} clout (medians).</p>
        </div>
      </div>

      {data.careers && <CareerCard c={data.careers} />}
    </section>
  );
}

const TRACK_LABEL: Record<string, string> = { hospitality: "🍽️ Hospitality", tech: "💻 Tech", media: "🎬 Media", cityhall: "🏛️ City Hall", streaming: "🎮 Streaming", fashion: "👗 Fashion" };

/** Careers (migration 0143): jobs taken, kept two weeks, promoted, working now, and aspirations picked. */
function CareerCard({ c }: { c: NonNullable<Insights["careers"]> }) {
  const working = Object.values(c.working).reduce((a, b) => a + (b ?? 0), 0);
  const picked = Object.values(c.aspirations).reduce((a, b) => a + b, 0);
  return (
    <div className="insights-two">
      <div className="studio-card stack-8">
        <span className="overline">Careers, last {c.days} days</span>
        <div className="insights-retention">
          <div className="insights-stat"><span className="meta">Jobs taken</span><span className="display-md tabular">{n(c.hired)}</span><span className="meta">{n(working)} working now</span></div>
          <div className="insights-stat"><span className="meta">Kept 14 days</span><span className="display-md tabular">{c.cohort14 ? share(c.kept14, c.cohort14) : "–"}</span><span className="meta tabular">{n(c.kept14)} of {n(c.cohort14)}</span></div>
          <div className="insights-stat"><span className="meta">Promoted</span><span className="display-md tabular">{c.hired ? share(c.promoted, c.hired) : "–"}</span><span className="meta tabular">{n(c.promoted)} of {n(c.hired)}</span></div>
        </div>
        <div className="insights-rows">{Object.entries(c.working).map(([k, v]) => <ShareRow key={k} label={TRACK_LABEL[k] ?? k} value={v ?? 0} of={working} />)}</div>
        <p className="meta" style={{ margin: 0 }}>Kept 14 days counts jobs started at least two weeks ago. Promoted means at least one promotion (head starts don&apos;t count).</p>
      </div>
      <div className="studio-card stack-8">
        <span className="overline">Aspirations picked</span>
        {picked === 0 && <p className="meta" style={{ margin: 0 }}>No picks yet.</p>}
        <div className="insights-rows">
          {ASPIRATIONS.map((a) => <ShareRow key={a.id} label={`${a.emoji} ${a.name}`} value={c.aspirations[a.id] ?? 0} of={picked} />)}
        </div>
      </div>
    </div>
  );
}
