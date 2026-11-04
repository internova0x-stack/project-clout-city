"use client";

// Company health (migration 0161, lib/companies.ts): the employer's situation, the boss's weekly target with your part
// of it, and the shared health in the Careers app; every company on News → City's Business pages.

import { COMPANY, LEVEL_WORD, companyRules, type CompanyView } from "@/lib/companies";

function HealthBar({ c, small = false }: { c: CompanyView; small?: boolean }) {
  return (
    <span className={`co-bar ${c.level}${small ? " small" : ""}`} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={c.health}
      aria-label={`${c.name} health ${c.health} of 100, ${LEVEL_WORD[c.level]}`}>
      <span style={{ width: `${c.health}%` }} />
      <i style={{ left: `${COMPANY.levels.low}%` }} /><i style={{ left: `${COMPANY.levels.high}%` }} />
    </span>
  );
}

/** The Careers app's company card: what the business is going through, the boss's target this week, and what health does. */
export function CompanyCard({ c, mine }: { c: CompanyView; mine?: number }) {
  const rules = companyRules(c.health);
  const pct = Math.min(100, Math.round((c.progress / Math.max(1e-9, c.target)) * 100));
  const minePct = mine ? Math.min(pct, Math.max(1, Math.round((mine / Math.max(1e-9, c.target)) * 100))) : 0;
  return (
    <div className="card stack-12 co-card">
      <div className="co-head">
        <span className="co-logo" aria-hidden="true">{c.emoji}</span>
        <span className="co-name"><span className="title">{c.name}</span></span>
        <span className={`co-level ${c.level}`}>{LEVEL_WORD[c.level]} · {c.health}</span>
      </div>
      <p className="subtext" style={{ margin: 0 }}>{c.situation}{c.line ? ` ${c.line}` : ""}</p>
      <HealthBar c={c} />
      <div className="co-target">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <span className="meta">🎯 {c.boss}&apos;s target this week</span>
          <span className="meta">{c.daysLeft ? `${c.daysLeft} day${c.daysLeft === 1 ? "" : "s"} left` : "Closes tonight"}</span>
        </div>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
          <span><span className="co-num">{c.progressText}</span> <span className="meta">of {c.targetText} {c.unit}</span></span>
          <span className="meta">{pct}%</span>
        </div>
        <span className="co-prog" aria-hidden="true">
          <span className="them" style={{ width: `${pct - minePct}%` }} />
          {minePct > 0 && <span className="you" style={{ left: `${pct - minePct}%`, width: `${minePct}%` }} />}
        </span>
        <span className="meta">{mine ? "Red is your part this week. " : ""}Every workday adds to it. Hit it and the company grows; miss it and it slides.</span>
      </div>
      <ul className="co-effects">
        {rules.bonus > 0 && <li>💰 <b>Bonus season:</b> +{Math.round(rules.bonus * 100)}% of your wage on payday</li>}
        {rules.workMood > 0 && <li>😊 The office is in a good mood</li>}
        {c.level === "medium" && <li>💵 Normal pay, raises and promotions</li>}
        {rules.raisesFrozen && <li>🧊 <b>Raises frozen</b> until the numbers turn around</li>}
        {rules.workMood < 0 && <li>😬 The office is tense</li>}
        {rules.promotionsFrozen ? <li>⛔ <b>Hiring freeze:</b> promotions wait until it recovers</li>
          : rules.raisesFrozen ? <li>⚠️ Under {COMPANY.levels.freeze}, promotions freeze too</li> : null}
      </ul>
    </div>
  );
}

/** News → City: every company in the city, how it's doing and whether it hit last week's target. */
export function BusinessPages({ items }: { items: CompanyView[] }) {
  if (!items.length) return null;
  return (
    <div className="card stack-12">
      <span className="overline" style={{ display: "block" }}>📊 Business pages · Lola Lowdown</span>
      {items.map((c) => (
        <div key={c.track} className="co-row">
          <span className="co-row-emoji" aria-hidden="true">{c.emoji}</span>
          <span className="co-row-text">
            <span className="co-row-name">{c.name}</span>
            <span className="meta">{c.lastWeek ? (c.lastWeek.hit ? "▲ Hit its target" : "▼ Missed its target") : "New this week"}</span>
          </span>
          <span className="co-row-health">
            <span className={`co-level ${c.level}`}>{LEVEL_WORD[c.level]}</span>
            <HealthBar c={c} small />
          </span>
        </div>
      ))}
    </div>
  );
}
