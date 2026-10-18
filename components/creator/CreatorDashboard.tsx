"use client";

// The creator page (/creator, spec section 21 step 3; migration 0089): a creator's own links and numbers. Counts
// only: never player names, chats or anything personal. Links are read-only here; only admins make them.

import { useEffect, useState } from "react";
import { HOLD_DAYS, creatorUrl, landsLabel, lengthLabel, payoutLine, type CreatorMe } from "@/lib/creators";
import { formatPrice } from "@/lib/store";
import { DailyBars } from "../studio/Insights";

const n = (x: number) => x.toLocaleString("en-US");
const money = (c: number) => (c < 0 ? `−${formatPrice(-c)}` : formatPrice(c));
const monthName = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

export function CreatorDashboard({ me, who, preview = false }: { me: CreatorMe | null; who: string; preview?: boolean }) {
  const [copied, setCopied] = useState<string | null>(null);
  // The site's address: set in env for production; otherwise this browser's, read after the first render so the
  // server's HTML matches.
  const [origin, setOrigin] = useState(process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") ?? "");
  useEffect(() => { if (!origin) setOrigin(window.location.origin); }, [origin]);
  const copy = async (key: string, text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(null), 1500); } catch { /* the text stays selectable */ }
  };
  const header = (
    <header className="studio-top">
      <div>
        <span className="studio-mark">Clout City</span>
        <h1 className="display-lg" style={{ margin: 0 }}>Creator page</h1>
      </div>
      <div className="row" style={{ gap: 8, flexWrap: "wrap", justifyContent: "flex-end", alignItems: "center" }}>
        <span className="meta">{preview ? "Preview: sample numbers" : `Signed in as ${who}`}</span>
        {!preview && <form action="/auth/signout" method="post"><button className="chip" type="submit">Log out</button></form>}
      </div>
    </header>
  );
  if (!me) {
    return (
      <main className="studio creator-page">
        {header}
        <section className="studio-card stack-8" style={{ maxWidth: 560 }}>
          <p className="title" style={{ margin: 0 }}>This email isn&apos;t on the creator list.</p>
          <p className="subtext" style={{ margin: 0 }}>Sign in with the email you gave your Clout City contact, or ask them which one we have for you.</p>
        </section>
      </main>
    );
  }
  const o = me.owed;
  const lengthText = me.months ? `for ${lengthLabel(me.months)} after each player signs up` : "for as long as each player plays";
  const live = me.links.filter((l) => l.status === "active");
  const retired = me.links.filter((l) => l.status === "retired");
  return (
    <main className="studio creator-page">
      {header}
      <div className="stack-16">
        <section className="studio-card creator-hello">
          <div className="stack-4">
            <p className="title" style={{ margin: 0 }}>Hey {me.name}.</p>
            <p className="subtext" style={{ margin: 0 }}>
              You earn {me.rate}% of what the players you bring in spend (after Stripe&apos;s fee and tax), {lengthText}.
              {me.giftCash > 0 && ` They get a C$${n(me.giftCash)} welcome gift for joining through you.`}
            </p>
          </div>
          <div className="creator-code">
            <span className="overline">Your code</span>
            <code className="aff-code creator-code-value">{me.code}</code>
            <button className="chip" onClick={() => void copy("code", me.code)}>{copied === "code" ? "Copied" : "Copy"}</button>
          </div>
        </section>
        {me.status === "paused" && (
          <div className="studio-note error"><span className="body-strong">Your links are paused: new clicks and sign-ups don&apos;t count right now. You still earn on players you already brought in.</span></div>
        )}

        <div className="studio-tiles aff-tiles">
          {([
            ["Payable", money(o.payableCents), "ready for the next payout"],
            ["Held", money(o.heldCents), `for ${HOLD_DAYS} days after each payment`],
            ["Paid to you", money(o.paidCents), "so far"],
            ["Earned in all", money(me.totals.earnedCents), `${n(me.totals.payers)} paying ${me.totals.payers === 1 ? "player" : "players"}`],
          ] as const).map(([label, value, sub]) => (
            <div key={label} className="studio-card studio-tile">
              <span className="overline">{label}</span>
              <span className="display-lg tabular">{value}</span>
              <span className="meta">{sub}</span>
            </div>
          ))}
        </div>
        <p className="meta" style={{ margin: 0 }}>
          {payoutLine(o.payableCents, me.nextPayout, formatPrice)} Earnings are held for {HOLD_DAYS} days so refunds can land first; a refunded payment takes its share back.
        </p>

        <div className="insights-charts">
          <DailyBars days={me.daily} pick={(d) => d.clicks} label="Clicks · 30 days" format={n} />
          <DailyBars days={me.daily} pick={(d) => d.signups} label="Sign-ups · 30 days" format={n} />
          <DailyBars days={me.daily} pick={(d) => d.commissionCents ?? 0} label="Earned · 30 days" format={(v) => formatPrice(v)} />
        </div>

        <section className="studio-card stack-12">
          <div className="row" style={{ justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
            <span className="overline">Your links</span>
            <span className="meta">All time · {n(me.totals.clicks)} clicks · {n(me.totals.signups)} sign-ups</span>
          </div>
          {live.length === 0 && <p className="meta" style={{ margin: 0 }}>No live links right now. Your Clout City contact makes them for you.</p>}
          {[...live, ...retired].map((l) => {
            const url = creatorUrl(origin, l.slug);
            return (
              <div key={l.slug} className={`creator-link${l.status === "retired" ? " retired" : ""}`}>
                <div className="stack-4" style={{ flex: 1, minWidth: 0 }}>
                  <span className="body-strong">{l.label}{l.status === "retired" && <span className="aff-tag held" style={{ marginLeft: 8 }}>Retired</span>}</span>
                  <code className="aff-code creator-url">{url}</code>
                  <span className="meta">Lands on {landsLabel(l.lands).toLowerCase()}{l.status === "retired" ? " · no longer counts new clicks" : ""}</span>
                </div>
                <dl className="creator-nums">
                  <div><dt>Clicks</dt><dd className="tabular">{n(l.clicks)}</dd></div>
                  <div><dt>Sign-ups</dt><dd className="tabular">{n(l.signups)}</dd></div>
                  <div><dt>Paying</dt><dd className="tabular">{n(l.payers)}</dd></div>
                  <div><dt>Earned</dt><dd className="tabular">{money(l.earnedCents)}</dd></div>
                </dl>
                {l.status === "active" && <button className="chip" onClick={() => void copy(l.slug, url)}>{copied === l.slug ? "Copied" : "Copy link"}</button>}
              </div>
            );
          })}
          <div className="creator-link">
            <div className="stack-4" style={{ flex: 1, minWidth: 0 }}>
              <span className="body-strong">Typed your code</span>
              <span className="meta">People who saw a video and entered <code className="aff-code">{me.code}</code> at sign-up</span>
            </div>
            <dl className="creator-nums">
              <div><dt>Sign-ups</dt><dd className="tabular">{n(me.byCode.signups)}</dd></div>
              <div><dt>Paying</dt><dd className="tabular">{n(me.byCode.payers)}</dd></div>
              <div><dt>Earned</dt><dd className="tabular">{money(me.byCode.earnedCents)}</dd></div>
            </dl>
          </div>
        </section>

        <div className="insights-two">
          <section className="studio-card stack-12">
            <span className="overline">Earned by month</span>
            {me.byMonth.length === 0 ? <p className="meta" style={{ margin: 0 }}>Nothing yet. Your first earnings show here when a player you brought in buys something.</p> : (
              <div className="aff-list">
                {me.byMonth.map((m) => (
                  <div key={m.month} className="aff-list-row">
                    <span style={{ flex: 1 }}>{monthName(m.month)}</span>
                    <span className="meta tabular">{n(m.payments)} {m.payments === 1 ? "payment" : "payments"}</span>
                    <span className="body-strong tabular">{money(m.earnedCents)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
          <section className="studio-card stack-12">
            <span className="overline">Payouts</span>
            {me.payouts.length === 0 ? <p className="meta" style={{ margin: 0 }}>No payouts yet. They go out at the start of a month once you have {formatPrice(5000)} payable.</p> : (
              <div className="aff-list">
                {me.payouts.map((p) => (
                  <div key={p.paidAt} className="aff-list-row">
                    <span style={{ flex: 1 }}>{monthName(p.period)}</span>
                    <span className="meta">{p.method}</span>
                    <span className="body-strong tabular">{money(p.totalCents)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <section className="studio-card stack-8">
          <span className="overline">The fine print</span>
          <ul className="creator-rules">
            <li>You see counts only. We never share who your players are, and they never see what you earn.</li>
            <li>Label every post #ad or with the platform&apos;s paid-partnership tag. 18+ audiences only.</li>
            <li>Don&apos;t promote the lotto, promise features that aren&apos;t built, or buy followers or installs.</li>
            <li>Your own purchases don&apos;t earn anything. Nice try, though.</li>
          </ul>
          {me.termsAt && <p className="meta" style={{ margin: 0 }}>Terms agreed on {new Date(`${me.termsAt}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })}.</p>}
        </section>
      </div>
    </main>
  );
}
