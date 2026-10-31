"use client";

import { conditionWhen, type ConditionNow } from "@/lib/cityConditions";

// Content Engine step 4 (migration 0140): News → City's "Around the city" card. What's happening to the whole city now
// (a heatwave, a brownout, an HR crackdown that players set off) and what starts in the next 48 hours. Prices, doors and
// place notes change by themselves; this says why.

export function ConditionsCard({ items }: { items: ConditionNow[] }) {
  if (!items.length) return null;
  const sorted = [...items].sort((a, b) => Number(b.now) - Number(a.now) || a.startsAt.localeCompare(b.startsAt));
  return (
    <div className="card stack-8">
      <span className="overline" style={{ display: "block" }}>🌆 Around the city</span>
      {sorted.map((c) => (
        <div key={c.id} className="stack-4">
          <span className="body-strong" style={{ display: "block" }}>{c.emoji} {c.title}{c.now ? "" : " · coming up"}</span>
          <span className="body" style={{ display: "block", margin: 0 }}>{c.blurb}</span>
          <span className="meta" style={{ display: "block" }}>{conditionWhen(c)}{c.source === "reaction" ? " · because of what players did" : ""}</span>
        </div>
      ))}
    </div>
  );
}
