"use client";

import { conditionWhen, type ConditionNow } from "@/lib/cityConditions";

// Content Engine step 4 (migration 0140): News → City's "Around the city" card. What's happening to the whole city now
// (a heatwave, a brownout, an HR crackdown that players set off) and what starts in the next 48 hours. Prices, doors and
// place notes change by themselves; this says why.

export function ConditionsCard({ items }: { items: ConditionNow[] }) {
  if (!items.length) return null;
  const sorted = [...items].sort((a, b) => Number(b.now) - Number(a.now) || a.startsAt.localeCompare(b.startsAt));
  // One card each, like the rest of News → City, so every condition has room to breathe.
  return (
    <>
      {sorted.map((c) => (
        <div key={c.id} className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <span className="overline" style={{ display: "block" }}>🌆 {c.now ? "Around the city" : "Coming up"}</span>
          <span className="title" style={{ display: "block" }}>{c.emoji} {c.title}</span>
          <p className="body" style={{ margin: 0, lineHeight: 1.5 }}>{c.blurb}</p>
          <span className="meta" style={{ display: "block" }}>{conditionWhen(c)}{c.source === "reaction" ? " · because of what players did" : ""}</span>
        </div>
      ))}
    </>
  );
}
