"use client";

import { useCallback, useEffect, useState } from "react";
import { effectLine } from "@/lib/choices";
import { FAMILY_LABEL, sampleFill, storyletWhen, whenLines, type StoryletAction, type StudioStorylet, type StudioStorylets } from "@/lib/storyletWeeks";
import type { StudioApi } from "@/lib/studio";

// Content Engine step 3 (migration 0139): Studio → Storylets. Each week's new cards arrive here and go live 24 hours
// later by themselves (owner, Oct 31: automatic with a veto window). Veto one and it never shows; pause it to decide
// later. Names in the text are sample fills: each player sees their own coworker, boss or place.

const STATUS: Record<StudioStorylet["status"], string> = { scheduled: "draft", live: "approved", paused: "draft", vetoed: "declined" };
const fmtWeek = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString([], { month: "short", day: "numeric", timeZone: "UTC" });

export function StoryletsTab({ api }: { api: StudioApi }) {
  const [data, setData] = useState<StudioStorylets | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(async () => {
    const r = await api.storylets!();
    if (r.ok) { setData(r.data); setError(null); } else setError(r.error);
  }, [api]);
  useEffect(() => { void load(); }, [load]);
  const act = async (id: string, action: StoryletAction) => {
    setBusy(id); setError(null);
    const r = await api.storyletSet!(id, action);
    setBusy(null);
    if (r.ok) setData(r.data); else setError(r.error);
  };
  const weeks = [...new Set((data?.cards ?? []).map((c) => c.week))];
  const waiting = (data?.cards ?? []).filter((c) => c.status === "scheduled" || c.status === "paused").length;
  return (
    <section className="stack-12">
      <section className="studio-card stack-8">
        <h2 className="display-md" style={{ margin: 0 }}>Storylets</h2>
        <span className="subtext">
          New situation cards from the weekly routine. Each one goes live {data?.window_hours ?? 24} hours after it arrives,
          unless you veto it. The names shown are examples: every player sees their own coworker, boss or place, and only
          players whose history fits get the card.
        </span>
        {data && !data.autopilot && <span className="meta">⏸️ Autopilot is off for storylets: new cards wait here until you restore them (Calendar → Autopilot).</span>}
        {data && <span className="meta">{waiting ? `${waiting} waiting for their window` : "Nothing waiting."}</span>}
        {error && <span className="meta error-text">{error}</span>}
      </section>
      {data?.cards.length === 0 && <section className="studio-card"><p className="subtext" style={{ margin: 0 }}>No storylets yet. The weekly routine adds content/storylets/&lt;Monday&gt;.json.</p></section>}
      {weeks.map((w) => (
        <section key={w} className="stack-8">
          <span className="title">Week of {fmtWeek(w)}</span>
          {data!.cards.filter((c) => c.week === w).map((c) => <StoryletCard key={c.id} s={c} busy={busy === c.id} act={(a) => void act(c.id, a)} />)}
        </section>
      ))}
    </section>
  );
}

function StoryletCard({ s, busy, act }: { s: StudioStorylet; busy: boolean; act: (a: StoryletAction) => void }) {
  const [open, setOpen] = useState(false);
  const c = s.card;
  const fam = FAMILY_LABEL[s.family];
  const fill = (t: string) => sampleFill(t, c.slots);
  return (
    <article className="studio-card stack-8">
      <div className="row" style={{ justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
        <span className="body-strong" style={{ minWidth: 0 }}>{c.emoji} {fill(c.title)}</span>
        <span className={`tag studio-review ${STATUS[s.status]}`}>{storyletWhen(s)}</span>
      </div>
      <span className="meta">{fam.emoji} {fam.title} · {c.chainOnly ? "Follow-up only" : whenLines(c.when).join(" · ")}</span>
      {open && (
        <div className="stack-8">
          {c.options.map((o) => (
            <div key={o.id} className="stack-4" style={{ borderLeft: "3px solid var(--line, #ddd)", paddingLeft: 10 }}>
              <span className="body-strong" style={{ display: "block" }}>{fill(o.label)}</span>
              <span className="meta" style={{ display: "block" }}>You get: {fill(o.get)} · It costs: {fill(o.cost)}</span>
              {o.outcomes.map((x, i) => (
                <span key={i} className="meta" style={{ display: "block" }}>
                  {o.outcomes.length > 1 ? `${Math.round((x.weight / o.outcomes.reduce((n, y) => n + y.weight, 0)) * 100)}%: ` : ""}
                  {fill(x.text)} <b>{effectLine(x.effects ?? {})}</b>
                  {x.later && <> ↩︎ {Math.round(x.later.chance * 100)}% in {x.later.afterDays.join("–")} days: {fill(x.later.text)} <b>{effectLine(x.later.effects ?? {})}</b></>}
                  {x.later?.headline && <> 📰 {fill(x.later.headline)}</>}
                </span>
              ))}
            </div>
          ))}
        </div>
      )}
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <button className="btn btn-secondary btn-sm" onClick={() => setOpen(!open)}>{open ? "Hide choices" : "See choices and outcomes"}</button>
        {s.status !== "vetoed" && <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => act("veto")}>Veto</button>}
        {(s.status === "scheduled" || s.status === "live") && <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => act("pause")}>Pause</button>}
        {s.status === "paused" && <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => act("restore")}>Restore</button>}
        {s.status === "vetoed" && <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => act("restore")}>Undo veto</button>}
        {s.status === "scheduled" && <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => act("now")}>Go live now</button>}
      </div>
    </article>
  );
}
