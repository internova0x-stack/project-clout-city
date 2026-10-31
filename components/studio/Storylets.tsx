"use client";

import { useCallback, useEffect, useState } from "react";
import { effectLine } from "@/lib/choices";
import { FAMILY_LABEL, sampleFill, storyletWhen, whenLines, type StoryletAction, type StudioStorylet, type StudioStorylets } from "@/lib/storyletWeeks";
import type { StudioApi } from "@/lib/studio";
import type { ConditionEffect, StudioCondition } from "@/lib/cityConditions";
import { LEARNING, pct, type StudioLearning } from "@/lib/cardLearning";
import type { StudioUnderworldJob } from "@/lib/underworldWeeks";

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
      {api.conditions && <ConditionsSection api={api} />}
      {api.underworldJobs && <UnderworldJobsSection api={api} />}
      {api.learning && <LearningSection api={api} />}
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

// ---- Content Engine step 4 (migration 0140): city conditions ----

const condWhen = (iso: string) => new Date(iso).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", timeZone: "America/New_York" });

function effectText(e: ConditionEffect): string {
  if (e.type === "price_multiplier") return `${(e.tags ?? []).join(", ")} ${e.applies_to === "event_entry" ? "entry" : e.applies_to === "shop_price" ? "Shop prices" : "visits"} ×${e.multiplier}: “${e.reason}”`;
  if (e.type === "availability") return `${(e.tags ?? []).join(", ")} ${e.state}: “${e.reason}”`;
  return `Note at ${e.place}: “${e.note}”`;
}

function ConditionsSection({ api }: { api: StudioApi }) {
  const [list, setList] = useState<StudioCondition[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => { void api.conditions!().then((r) => (r.ok ? setList(r.data) : setError(r.error))); }, [api]);
  const act = async (id: string, action: StoryletAction) => {
    setBusy(id); setError(null);
    const r = await api.conditionSet!(id, action);
    setBusy(null);
    if (r.ok) setList(r.data); else setError(r.error);
  };
  return (
    <section className="stack-8">
      <span className="title">🌆 City conditions</span>
      <span className="subtext">
        Things that happen to the whole city for a while: weather, outages, festivals from the weekly routine (live 24 hours
        after they arrive unless you veto them), and reactions that fire when players together cross a line (an HR crackdown
        after a week of office sabotage). Prices, doors and place notes change by themselves while one is on.
      </span>
      {error && <span className="meta error-text">{error}</span>}
      {list?.length === 0 && <section className="studio-card"><p className="subtext" style={{ margin: 0 }}>Nothing on or coming. The weekly routine adds content/conditions/&lt;Monday&gt;.json.</p></section>}
      {list?.map((c) => (
        <article key={c.id} className="studio-card stack-8">
          <div className="row" style={{ justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
            <span className="body-strong" style={{ minWidth: 0 }}>{c.emoji} {c.title}</span>
            <span className={`tag studio-review ${STATUS[c.status]}`}>{c.on ? "On now" : storyletWhen(c)}</span>
          </div>
          <span className="body">{c.blurb}</span>
          <span className="meta">{condWhen(c.starts_at)} → {condWhen(c.ends_at)} · {c.source === "reaction" ? `fired by the city (${c.rule})` : "weekly"}</span>
          {c.effects.map((e, i) => <span key={i} className="meta" style={{ display: "block" }}>• {effectText(e)}</span>)}
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            {c.status !== "vetoed" && <button className="btn btn-secondary btn-sm" disabled={busy === c.id} onClick={() => void act(c.id, "veto")}>{c.on ? "End it now" : "Veto"}</button>}
            {c.status === "scheduled" && <button className="btn btn-secondary btn-sm" disabled={busy === c.id} onClick={() => void act(c.id, "pause")}>Pause</button>}
            {c.status === "paused" && <button className="btn btn-secondary btn-sm" disabled={busy === c.id} onClick={() => void act(c.id, "restore")}>Restore</button>}
            {c.status === "vetoed" && !c.on && <button className="btn btn-secondary btn-sm" disabled={busy === c.id} onClick={() => void act(c.id, "restore")}>Undo veto</button>}
            {c.status === "scheduled" && <button className="btn btn-secondary btn-sm" disabled={busy === c.id} onClick={() => void act(c.id, "now")}>Approve now</button>}
          </div>
        </article>
      ))}
    </section>
  );
}

// ---- The underworld, part 2 (migration 0150): each week's new jobs for Pablo ----

const REP_TIER: Record<number, string> = { 0: "Errand Kid", 15: "Corner Regular", 35: "Known Face", 60: "Pablo's Guy", 90: "Street Legend" };

function UnderworldJobsSection({ api }: { api: StudioApi }) {
  const [list, setList] = useState<StudioUnderworldJob[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => { void api.underworldJobs!().then((r) => (r.ok ? setList(r.data) : setError(r.error))); }, [api]);
  const act = async (id: string, action: StoryletAction) => {
    setBusy(id); setError(null);
    const r = await api.underworldJobSet!(id, action);
    setBusy(null);
    if (r.ok) setList(r.data); else setError(r.error);
  };
  return (
    <section className="stack-8">
      <span className="title">🧳 Pablo&apos;s jobs</span>
      <span className="subtext">
        New jobs for Pablo&apos;s back room from the weekly routine. Each joins his pool 24 hours after it arrives unless you veto it.
        Only players Pablo has invited see them, and only once their Street Rep reaches the job&apos;s tier.
      </span>
      {error && <span className="meta error-text">{error}</span>}
      {list?.length === 0 && <section className="studio-card"><p className="subtext" style={{ margin: 0 }}>None yet. The weekly routine adds content/underworld-weeks/&lt;Monday&gt;.json.</p></section>}
      {list?.map((j) => (
        <article key={j.id} className="studio-card stack-8">
          <div className="row" style={{ justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
            <span className="body-strong" style={{ minWidth: 0 }}>{j.job.emoji} {j.job.title}</span>
            <span className={`tag studio-review ${STATUS[j.status]}`}>{storyletWhen(j)}</span>
          </div>
          <span className="meta">Week of {fmtWeek(j.week)} · {REP_TIER[j.job.minRep] ?? `Street Rep ${j.job.minRep}`}+{j.job.crew ? ` · ${j.job.crew}'s job` : ""}</span>
          {j.job.options.map((o) => <span key={o.id} className="meta" style={{ display: "block" }}>• <b>{o.label}</b>: gets {o.get}; costs {o.cost} (C${o.pay[0]}–{o.pay[1]})</span>)}
          <span className="meta">📰 If caught: “{j.job.headline.replace("{name}", "@player")}”</span>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            {j.status !== "vetoed" && <button className="btn btn-secondary btn-sm" disabled={busy === j.id} onClick={() => void act(j.id, "veto")}>Veto</button>}
            {j.status === "scheduled" && <button className="btn btn-secondary btn-sm" disabled={busy === j.id} onClick={() => void act(j.id, "pause")}>Pause</button>}
            {j.status === "paused" && <button className="btn btn-secondary btn-sm" disabled={busy === j.id} onClick={() => void act(j.id, "restore")}>Restore</button>}
            {j.status === "scheduled" && <button className="btn btn-secondary btn-sm" disabled={busy === j.id} onClick={() => void act(j.id, "now")}>Approve now</button>}
          </div>
        </article>
      ))}
    </section>
  );
}

// ---- Content Engine step 6 (migration 0141): what works ----

const FILTERS = [
  { id: "all", label: "All" }, { id: "up", label: "Shown more" }, { id: "down", label: "Shown less" }, { id: "retired", label: "Retired" }, { id: "mine", label: "Set by you" },
] as const;

function LearningSection({ api }: { api: StudioApi }) {
  const [data, setData] = useState<StudioLearning | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [more, setMore] = useState(false);
  useEffect(() => { void api.learning!().then((r) => (r.ok ? setData(r.data) : setError(r.error))); }, [api]);
  const set = async (card: string, s: { weight: number; retired: boolean } | "auto") => {
    setBusy(card); setError(null);
    const r = await api.learningSet!(card, s);
    setBusy(null);
    if (r.ok) setData(r.data); else setError(r.error);
  };
  const rows = (data?.rows ?? []).filter((r) =>
    filter === "up" ? !r.retired && r.weight > 1 : filter === "down" ? !r.retired && r.weight < 1 : filter === "retired" ? r.retired : filter === "mine" ? r.setBy === "admin" : true);
  const shown = more ? rows : rows.slice(0, 15);
  return (
    <section className="stack-8">
      <span className="title">📈 What works</span>
      <span className="subtext">
        Every card's last {LEARNING.windowDays} days: how often players made a choice instead of closing it, and how evenly they
        split between the options. Once a day the game shows the strongest cards more and the weakest less, and retires cards
        most players close (after {LEARNING.retire.minShown} showings). Your setting on a card always wins until you hand it
        back.
      </span>
      {data && <span className="meta">{data.lastRun ? `Last worked out ${data.lastRun}.` : "Not worked out yet: it runs once a day once cards have been shown."} A card needs {LEARNING.minShown} showings before it moves.</span>}
      {error && <span className="meta error-text">{error}</span>}
      <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
        {FILTERS.map((f) => <button key={f.id} className="chip" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>{f.label}</button>)}
      </div>
      {data && rows.length === 0 && <section className="studio-card"><p className="subtext" style={{ margin: 0 }}>Nothing here yet.</p></section>}
      {shown.map((r) => (
        <article key={r.card} className="studio-card" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div className="row" style={{ justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
            <span className="body-strong" style={{ minWidth: 0 }}>{r.emoji} {sampleFill(r.title, r.slots)}</span>
            <span className={`tag studio-review ${r.retired ? "declined" : r.weight > 1 ? "approved" : "draft"}`}>
              {r.retired ? "Retired" : `×${r.weight.toFixed(2)}`}{r.setBy === "admin" ? " · you" : ""}
            </span>
          </div>
          <span className="meta">
            {r.shown ? `Shown ${r.shown} · chose ${pct(r.engage)} · closed ${pct(r.skipRate)} · split ${pct(r.split)}` : "Not shown in the last 4 weeks"}
          </span>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <button className="btn btn-secondary btn-sm" disabled={busy === r.card} onClick={() => void set(r.card, { weight: 1.5, retired: false })}>Show more</button>
            <button className="btn btn-secondary btn-sm" disabled={busy === r.card} onClick={() => void set(r.card, { weight: 0.5, retired: false })}>Show less</button>
            {r.retired
              ? <button className="btn btn-secondary btn-sm" disabled={busy === r.card} onClick={() => void set(r.card, { weight: 1, retired: false })}>Restore</button>
              : <button className="btn btn-secondary btn-sm" disabled={busy === r.card} onClick={() => void set(r.card, { weight: r.weight, retired: true })}>Retire</button>}
            {r.setBy === "admin" && <button className="btn btn-secondary btn-sm" disabled={busy === r.card} onClick={() => void set(r.card, "auto")}>Back to automatic</button>}
          </div>
        </article>
      ))}
      {rows.length > 15 && <button className="btn btn-secondary btn-sm" onClick={() => setMore(!more)}>{more ? "Show fewer" : `Show all ${rows.length}`}</button>}
    </section>
  );
}
