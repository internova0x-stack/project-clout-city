"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { placeById } from "@/lib/city";
import { activeEffects, addDaysISO, dayDiff, nyTime, type Arc, type StoryEffect, type Status } from "@/lib/stories";
import { buildFeed, emptyStoryState } from "@/lib/storyFeedBuild";
import { nextWeekday, weekdayOf, type Review, type StudioApi, type StudioArc, type StudioMetrics, type StudioReport, type StudioResult } from "@/lib/studio";
import { formatPrice } from "@/lib/store";
import { NewsApp } from "../story/News";

// The Story Studio (/studio): a separate admin page, outside the game. Upload a
// story, approve or decline it (one approval), schedule its Day 1, pause or
// retire it or single beats, and read any day the way a player will.

const nyToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
const fmtDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

export function Studio({ initial, api, who, preview = false }: { initial: StudioArc[]; api: StudioApi; who: string; preview?: boolean }) {
  const [arcs, setArcs] = useState(initial);
  const [selected, setSelected] = useState<string | null>(initial.find((a) => a.type === "main")?.id ?? initial[0]?.id ?? null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ kind: "ok" | "error"; text: string; problems?: string[] } | null>(null);
  const [tab, setTab] = useState<"stories" | "reports" | "metrics">("stories");

  const apply = async (key: string, call: () => Promise<StudioResult>) => {
    setBusy(key);
    setNote(null);
    try {
      const r = await call();
      if (!r.ok) return setNote({ kind: "error", text: r.error, problems: r.problems });
      setArcs(r.arcs);
      if (r.message) setNote({ kind: "ok", text: r.message });
    } catch {
      setNote({ kind: "error", text: "The Studio glitched. Try again." });
    } finally {
      setBusy(null);
    }
  };

  const arc = arcs.find((a) => a.id === selected) ?? null;
  const mains = arcs.filter((a) => a.type === "main");
  const sidesOf = (id: string) => arcs.filter((a) => a.parent === id);

  return (
    <main className="studio">
      <header className="studio-top">
        <div>
          <span className="studio-mark">Clout City</span>
          <h1 className="display-lg" style={{ margin: 0 }}>Story Studio</h1>
        </div>
        <div className="row" style={{ gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <span className="meta">{preview ? "Preview: nothing is saved" : `Signed in as ${who}`}</span>
          {!preview && <form action="/auth/signout" method="post"><button className="chip" type="submit">Log out</button></form>}
        </div>
      </header>

      {(api.reports || api.metrics) && (
        <div className="segmented studio-tabs" role="group" aria-label="Studio">
          <button aria-pressed={tab === "stories"} onClick={() => setTab("stories")}>Stories</button>
          {api.reports && <button aria-pressed={tab === "reports"} onClick={() => setTab("reports")}>Reports</button>}
          {api.metrics && <button aria-pressed={tab === "metrics"} onClick={() => setTab("metrics")}>Metrics</button>}
        </div>
      )}
      {tab === "reports" && <Reports api={api} />}
      {tab === "metrics" && <Metrics api={api} />}

      {tab === "stories" && note && (
        <div className={`studio-note ${note.kind}`} role="status">
          <span className="body-strong">{note.text}</span>
          {note.problems && <ul>{note.problems.map((p) => <li key={p} className="meta">{p}</li>)}</ul>}
          <button className="chip" onClick={() => setNote(null)}>OK</button>
        </div>
      )}

      {tab === "stories" && <div className="studio-grid">
        <aside className="stack-12">
          <Upload busy={busy} onUpload={(json) => apply("upload", () => api.upload(json))} />
          <p className="overline" style={{ margin: "8px 0 0" }}>Stories</p>
          {mains.map((m) => (
            <div key={m.id} className="stack-8">
              <ArcRow a={m} active={m.id === selected} onPick={() => setSelected(m.id)} />
              {sidesOf(m.id).map((s) => <ArcRow key={s.id} a={s} parent={m} side active={s.id === selected} onPick={() => setSelected(s.id)} />)}
            </div>
          ))}
          {arcs.filter((a) => a.type === "side" && !mains.some((m) => m.id === a.parent)).map((s) => (
            <ArcRow key={s.id} a={s} side active={s.id === selected} onPick={() => setSelected(s.id)} />
          ))}
          {!arcs.length && <p className="subtext">No stories yet. Upload a story file to start.</p>}
        </aside>

        {arc ? (
          <ArcDetail key={arc.id} arc={arc} parent={arcs.find((a) => a.id === arc.parent) ?? null} api={api} busy={busy} apply={apply} />
        ) : (
          <section className="studio-card"><p className="subtext">Pick a story.</p></section>
        )}
      </div>}
    </main>
  );
}

/** The story day by the calendar, whatever its status (a paused story keeps counting). */
const calendarDay = (a: StudioArc) => (a.startAt && a.startAt <= nyToday() ? dayDiff(a.startAt, nyToday()) + 1 : null);

function stateLine(a: StudioArc, parent?: StudioArc | null): string {
  if (a.status === "retired") return "Retired";
  if (a.status === "paused") return calendarDay(a) ? `Paused · would be Day ${calendarDay(a)}` : "Paused";
  if (a.type === "side") return parent?.day ? `Runs with ${parent.title}` : parent?.startAt ? `Starts with ${parent.title}` : "Waits for its main story";
  if (a.day) return a.day > a.lastDay ? `Finished · in the archive` : `Live · Day ${a.day} of ${a.lastDay}`;
  if (a.startAt) return `Starts ${fmtDate(a.startAt)}`;
  return "Not scheduled";
}

function ReviewTag({ r }: { r: Review }) {
  return <span className={`tag studio-review ${r}`}>{r === "approved" ? "Approved" : r === "declined" ? "Declined" : "Needs review"}</span>;
}

function ArcRow({ a, parent, active, side = false, onPick }: { a: StudioArc; parent?: StudioArc; active: boolean; side?: boolean; onPick: () => void }) {
  return (
    <button className={`studio-arc${active ? " active" : ""}${side ? " side" : ""}`} onClick={onPick} aria-pressed={active}>
      <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
        <span className="title" style={{ display: "block" }}>{a.title || a.id}</span>
        <span className="meta" style={{ display: "block" }}>{side ? "Side story" : "Main story"} · {stateLine(a, parent)}</span>
      </span>
      <ReviewTag r={a.review} />
    </button>
  );
}

function Upload({ busy, onUpload }: { busy: string | null; onUpload: (json: string) => void }) {
  const [text, setText] = useState("");
  const [name, setName] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  return (
    <section className="studio-card stack-8">
      <span className="title">Add or update a story</span>
      <span className="subtext">A story file is JSON (see docs/STORIES.md). Files are checked first; nothing saves if there&apos;s a problem.</span>
      <input
        ref={file}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          setName(f.name);
          setText(await f.text());
          e.target.value = "";
        }}
      />
      <div className="row" style={{ gap: 8 }}>
        <button className="btn btn-secondary btn-sm" onClick={() => file.current?.click()}>Choose file</button>
        <span className="meta" style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{name ?? "or paste below"}</span>
      </div>
      <textarea className="studio-input" rows={4} value={text} onChange={(e) => { setText(e.target.value); setName(null); }} placeholder='{ "id": "my-story", "title": "…", "beats": [ … ] }' aria-label="Story JSON" />
      <button className="btn btn-taxi btn-sm" disabled={!text.trim() || busy !== null} onClick={() => onUpload(text)}>
        {busy === "upload" ? "Checking…" : "Check and save"}
      </button>
    </section>
  );
}

function ArcDetail({ arc, parent, api, busy, apply }: {
  arc: StudioArc; parent: StudioArc | null; api: StudioApi; busy: string | null;
  apply: (key: string, call: () => Promise<StudioResult>) => Promise<void>;
}) {
  const [reviewNote, setReviewNote] = useState(arc.reviewNote ?? "");
  const today = nyToday();
  const weekday = arc.startWeekday ?? "sunday";
  const [start, setStart] = useState(arc.startAt ?? nextWeekday(addDaysISO(today, 1), weekday));
  const live = arc.day !== null && arc.day <= arc.lastDay;
  const started = calendarDay(arc) !== null;
  const finale = start ? addDaysISO(start, arc.lastDay - 1) : null;
  const totalVotes = Object.values(arc.votes ?? {}).reduce((n, v) => n + v, 0);

  return (
    <section className="stack-16">
      <div className="studio-card stack-8">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <h2 className="display-md" style={{ margin: 0 }}>{arc.title || arc.id}</h2>
            <span className="meta">{arc.id} · {arc.type === "main" ? "Main story" : `Side story of ${parent?.title ?? arc.parent}`} · {arc.tier === "premium" ? `Premium (${arc.sku})` : "Free"} · {arc.lastDay} days</span>
          </div>
          <ReviewTag r={arc.review} />
        </div>
        <span className="body-strong">{stateLine(arc, parent)}{totalVotes ? ` · ${totalVotes.toLocaleString()} votes` : ""}</span>
      </div>

      {/* 1. One approval */}
      <div className="studio-card stack-8">
        <span className="overline">1 · Review</span>
        <span className="subtext">
          {arc.review === "approved" ? `Approved${arc.reviewedAt ? ` on ${new Date(arc.reviewedAt).toLocaleDateString()}` : ""}. ` : arc.review === "declined" ? "Declined. Upload a fixed file to send it back for review. " : "Waiting for a yes or no. "}
          One approval puts it on the schedule. Changing the file sends it back here.
        </span>
        <textarea className="studio-input" rows={2} value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} placeholder="Note for the writers (required to decline)" aria-label="Review note" />
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-taxi btn-sm" disabled={busy !== null || arc.review === "approved"} onClick={() => apply("review", () => api.review(arc.id, "approved", reviewNote))}>Approve</button>
          <button className="btn btn-secondary btn-sm" disabled={busy !== null || arc.review === "declined" || !reviewNote.trim() || live} onClick={() => apply("review", () => api.review(arc.id, "declined", reviewNote))}>Decline</button>
          {arc.review !== "draft" && !live && <button className="chip" disabled={busy !== null} onClick={() => apply("review", () => api.review(arc.id, "draft", reviewNote))}>Back to review</button>}
        </div>
      </div>

      {/* 2. Schedule */}
      <div className="studio-card stack-8">
        <span className="overline">2 · Schedule</span>
        {arc.type === "side" ? (
          <span className="subtext">Side stories run alongside {parent?.title ?? "their main story"}, day for day. Schedule the main story.</span>
        ) : live || started ? (
          <span className="subtext">{live ? "Live since" : "Started"} {fmtDate(arc.startAt!)}; the finale is {fmtDate(addDaysISO(arc.startAt!, arc.lastDay - 1))}. A live story can be paused or retired below, not moved.</span>
        ) : (
          <>
            <span className="subtext">Day 1 is a {weekday[0].toUpperCase() + weekday.slice(1)} (New York time). Beats go out at midnight; votes close at the times in the file.</span>
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              <input className="studio-input" type="date" value={start} min={today} onChange={(e) => setStart(e.target.value)} aria-label="Day 1" style={{ width: "auto" }} />
              <button className="chip" onClick={() => setStart(nextWeekday(addDaysISO(today, 1), weekday))}>Next {weekday[0].toUpperCase() + weekday.slice(1)}</button>
            </div>
            {start && weekdayOf(start) !== weekday && <span className="meta reason">That&apos;s a {weekdayOf(start)}. This story starts on a {weekday}.</span>}
            {finale && <span className="meta">Day 1 {fmtDate(start)} → finale {fmtDate(finale)}</span>}
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              <button className="btn btn-taxi btn-sm" disabled={busy !== null || arc.review !== "approved" || !start} onClick={() => apply("schedule", () => api.schedule(arc.id, start))}>
                {arc.startAt ? "Move Day 1" : "Schedule"}
              </button>
              {arc.startAt && <button className="btn btn-secondary btn-sm" disabled={busy !== null} onClick={() => apply("schedule", () => api.schedule(arc.id, null))}>Unschedule</button>}
            </div>
            {arc.review !== "approved" && <span className="meta">Approve it first.</span>}
          </>
        )}
      </div>

      {/* 3. Run */}
      <div className="studio-card stack-8">
        <span className="overline">3 · Run</span>
        <span className="subtext">Pausing hides the story and its effects on the city until you resume. Retiring ends it for good.</span>
        <div className="segmented" role="group" aria-label="Story status">
          {(["active", "paused", "retired"] as Status[]).map((s) => (
            <button key={s} aria-pressed={arc.status === s} disabled={busy !== null || arc.status === s} onClick={() => apply("status", () => api.status(arc.id, s))}>
              {s === "active" ? "Running" : s === "paused" ? "Paused" : "Retired"}
            </button>
          ))}
        </div>
      </div>

      {/* Beats */}
      <div className="studio-card stack-8">
        <span className="overline">Beats</span>
        <div className="studio-beats">
          {(arc.beats ?? []).map((b) => (
            <div key={b.id} className={`studio-beat${arc.day !== null && b.day <= arc.day ? " out" : ""}`}>
              <span className="hud-number studio-beat-day">D{b.day}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span className="title" style={{ display: "block" }}>{b.headline}</span>
                <span className="meta">
                  {b.id}
                  {b.prediction ? ` · prediction ${b.prediction}${arc.votes?.[b.prediction] ? `: ${arc.votes[b.prediction].toLocaleString()} votes` : ""}` : ""}
                  {arc.day !== null && b.day <= arc.day ? " · released" : ""}
                </span>
              </span>
              <select className="studio-input" value={b.status} disabled={busy !== null} aria-label={`Status of ${b.id}`}
                onChange={(e) => apply("beat", () => api.beatStatus(arc.id, b.id, e.target.value as Status))} style={{ width: "auto" }}>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="retired">Retired</option>
              </select>
            </div>
          ))}
        </div>
      </div>

      {arc.type === "main" && <PlayerPreview arc={arc} api={api} />}
    </section>
  );
}

/** Reads any day of a story the way a player will, with what changes in the city that day. */
function PlayerPreview({ arc, api }: { arc: StudioArc; api: StudioApi }) {
  const [content, setContent] = useState<Arc[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [day, setDay] = useState(Math.min(Math.max(arc.day ?? 1, 1), arc.lastDay));
  const [evening, setEvening] = useState(false);
  const [owner, setOwner] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const r = await api.content(arc.id);
    setLoading(false);
    if (r.ok) setContent(r.arcs);
    else setError(r.error);
  };

  const view = useMemo(() => {
    if (!content) return null;
    const today = nyToday();
    const start = addDaysISO(today, -(day - 1));
    const starts = { [arc.id]: start };
    const now = nyTime(start, day, evening ? "23:00" : "12:00");
    const st = { ...emptyStoryState(), seen: content.flatMap((a) => a.beats.map((b) => b.id)), skus: owner ? content.map((a) => a.sku ?? "").filter(Boolean) : [] };
    const live = content.map((a) => ({ ...a, status: "active" as const }));
    return {
      feed: buildFeed(live, starts, now, st),
      effects: activeEffects(live.filter((a) => a.type === "main"), today, starts),
    };
  }, [content, day, evening, owner, arc.id]);

  const noop = () => {};
  return (
    <div className="studio-card stack-12">
      <span className="overline">Preview as a player</span>
      {!content ? (
        <>
          <span className="subtext">See the News app and the city on any day, before anyone else does. Answers stay hidden until their reveal, as in the game.</span>
          <button className="btn btn-secondary btn-sm" onClick={load} disabled={loading}>{loading ? "Loading…" : "Open preview"}</button>
          {error && <span className="meta reason">{error}</span>}
        </>
      ) : (
        <>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            {Array.from({ length: arc.lastDay + 1 }, (_, i) => i + 1).map((d) => (
              <button key={d} className="chip" aria-pressed={d === day} onClick={() => setDay(d)}>{d > arc.lastDay ? "After" : `Day ${d}`}</button>
            ))}
          </div>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <button className="chip" aria-pressed={evening} onClick={() => setEvening((v) => !v)}>{evening ? "🌙 11 PM" : "☀️ Noon"}</button>
            <button className="chip" aria-pressed={owner} onClick={() => setOwner((v) => !v)}>{owner ? "Owns side stories" : "Free player"}</button>
          </div>
          <div className="studio-preview">
            <div className="phone-device studio-phone">
              <div className="phone-screen">
                <div className="phone-status light"><span>Day {Math.min(day, arc.lastDay + 1)}</span><span className="phone-pill" aria-hidden="true" /><span aria-hidden="true">▂▄▆ 🔋</span></div>
                <div className="phone-app-screen">
                  {view && <NewsApp key={`${day}-${evening}-${owner}`} feed={view.feed} handlers={{ busy: null, vote: noop, shadowGuess: noop, markSeen: noop, completeTask: noop, onUnlock: noop }} />}
                </div>
              </div>
            </div>
            <div className="stack-8" style={{ flex: 1, minWidth: 0 }}>
              <span className="title">In the city that day</span>
              {view && view.effects.length === 0 && <span className="subtext">Nothing changes in the city.</span>}
              {view?.effects.map((e, i) => (
                <div key={i} className="studio-effect">
                  <span className="meta">D{e.day} · {e.beat}</span>
                  <span className="body">{describeEffect(e.effect)}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const placesWith = (tags?: string[]) => (tags ?? []).join(", ").replace(/_/g, " ");
const placeName = (id?: string) => (id ? placeById(id)?.name ?? id : "");

export function describeEffect(e: StoryEffect): string {
  switch (e.type) {
    case "price_multiplier":
      return `Prices ×${e.multiplier} (${e.applies_to?.replace("_", " ")}) at ${placesWith(e.tags)}: “${e.reason}”${e.expires_day ? ` until Day ${e.expires_day}` : ""}`;
    case "availability":
      return e.sku
        ? `${e.state === "open" ? "On sale" : e.state}: ${e.sku}${e.reason ? ` (“${e.reason}”)` : ""}${e.expires_day ? ` until Day ${e.expires_day}` : ""}`
        : `${e.state === "closed" ? "Closed" : e.state === "restricted" ? "Restricted" : "Open"}: ${placesWith(e.tags)} (“${e.reason}”)${e.expires_day ? ` until Day ${e.expires_day}` : ""}`;
    case "chatter_topic":
      return `NPCs talk about ${e.topic} (${e.phase})`;
    case "task_injection":
      return `Story tasks today: ${(e.add ?? []).map((t) => t.split(":").pop()).join(", ")}`;
    case "place_state":
      return [
        e.spawn_event && `Event at ${placeName(e.place)}: ${e.spawn_event}`,
        e.cancel_event && `Cancelled: ${e.cancel_event}`,
        e.unlock_action && `New action at ${placeName(e.place)}: ${e.unlock_action}`,
        e.note && `${placeName(e.place)} card note: “${e.note}”`,
      ].filter(Boolean).join(" · ") || `Change at ${placeName(e.place)}`;
    case "flag":
      return `Flag set: ${e.set}`;
    default:
      return e.type;
  }
}

// ---------------------------------------------------------------------------
// Reports: the chat review queue (Clarifications 10.6)
// ---------------------------------------------------------------------------
const REASON: Record<StudioReport["reason"], string> = { harassment: "Harassment", spam: "Spam", inappropriate: "Inappropriate", other: "Other" };

function Reports({ api }: { api: StudioApi }) {
  const [status, setStatus] = useState<"open" | "all">("open");
  const [rows, setRows] = useState<StudioReport[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const load = useCallback(async () => {
    const r = await api.reports!(status);
    if (r.ok) { setRows(r.data); setError(null); } else setError(r.error);
  }, [api, status]);
  useEffect(() => { setRows(null); void load(); }, [load]);
  const act = async (id: number, action: "dismiss" | "warn" | "mute" | "ban") => {
    if (action === "ban" && !window.confirm("Ban this player? They lose access to the game.")) return;
    setBusy(id);
    const r = await api.reportAction!(id, action);
    setBusy(null);
    if (!r.ok) return setError(r.error);
    void load();
  };
  return (
    <section className="stack-12">
      <div className="row" style={{ gap: 8 }}>
        <button className="chip" aria-pressed={status === "open"} onClick={() => setStatus("open")}>Open</button>
        <button className="chip" aria-pressed={status === "all"} onClick={() => setStatus("all")}>All</button>
      </div>
      {error && <div className="studio-note error"><span className="body-strong">{error}</span></div>}
      {rows === null && !error && <p className="meta">Loading…</p>}
      {rows?.length === 0 && <section className="studio-card"><p className="subtext" style={{ margin: 0 }}>Nothing to review. Queens is behaving, for once.</p></section>}
      {rows?.map((r) => (
        <article key={r.id} className="studio-card stack-8">
          <div className="row" style={{ justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
            <span className="title">{REASON[r.reason]}: {r.reporter.name} reported {r.reported.name}</span>
            <span className={`tag studio-review ${r.status === "open" ? "draft" : r.status === "dismissed" ? "approved" : "declined"}`}>{r.status}</span>
          </div>
          <span className="meta">
            {new Date(r.at).toLocaleString()} · {r.reported.name} has {r.reported.reports} report{r.reported.reports === 1 ? "" : "s"}
            {r.reported.warned ? " · warned before" : ""}{r.reported.mutedUntil ? " · muted" : ""}{r.reported.banned ? " · banned" : ""}
          </span>
          {r.note && <span className="body">“{r.note}”</span>}
          <div className="studio-transcript">
            {r.messages.length === 0 && <span className="meta">No messages in this conversation.</span>}
            {r.messages.map((m) => (
              <div key={m.id} className={`studio-line${m.reported ? " flagged" : ""}`}>
                <span className="body-strong">{m.from}</span> <span className="body">{m.body}</span>
                <span className="meta"> · {new Date(m.at).toLocaleString()}</span>
              </div>
            ))}
          </div>
          {r.status === "open" && (
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              <button className="btn btn-secondary btn-sm" disabled={busy !== null} onClick={() => void act(r.id, "dismiss")}>Dismiss</button>
              <button className="btn btn-secondary btn-sm" disabled={busy !== null} onClick={() => void act(r.id, "warn")}>Warn</button>
              <button className="btn btn-destructive btn-sm" disabled={busy !== null} onClick={() => void act(r.id, "mute")}>Mute from chat</button>
              <button className="btn btn-destructive btn-sm" disabled={busy !== null} onClick={() => void act(r.id, "ban")}>Ban</button>
            </div>
          )}
        </article>
      ))}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Metrics: the success metrics (Clarifications 8)
// ---------------------------------------------------------------------------
const pct = (n: number, d: number) => (d > 0 ? `${Math.round((100 * n) / d)}%` : "—");
const PRODUCT: Record<string, string> = { side_arc: "Side stories", exclusive_event: "Exclusive events", collector_item: "Collector fashion", postcard: "Postcards" };

function Metrics({ api }: { api: StudioApi }) {
  const [m, setM] = useState<StudioMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { void api.metrics!().then((r) => (r.ok ? setM(r.data) : setError(r.error))); }, [api]);
  if (error) return <div className="studio-note error"><span className="body-strong">{error}</span></div>;
  if (!m) return <p className="meta">Loading…</p>;
  const revenue = Object.values(m.purchases).reduce((n, p) => n + p.cents, 0);
  const tiles: { label: string; value: string; sub: string; goal?: string }[] = [
    { label: "Day-1 return", value: pct(m.day1Returned, m.day1Cohort), sub: `${m.day1Returned.toLocaleString()} of ${m.day1Cohort.toLocaleString()} came back the next day`, goal: "Goal 35–40%" },
    { label: "First task done", value: pct(m.firstTask, m.players), sub: `${m.firstTask.toLocaleString()} of ${m.players.toLocaleString()} players` },
    { label: "Sent an invite", value: pct(m.invited, m.players), sub: `${m.invitesJoined.toLocaleString()} friends joined through a link` },
    { label: "Players", value: m.players.toLocaleString(), sub: `${m.newThisWeek.toLocaleString()} new this week · ${m.activeToday.toLocaleString()} active today` },
    { label: "Story readers", value: m.readers.toLocaleString(), sub: `${m.beatOpens.toLocaleString()} beat opens` },
    { label: "Predictions", value: m.votes.toLocaleString(), sub: `from ${m.voters.toLocaleString()} players` },
    { label: "Revenue (test mode)", value: formatPrice(revenue), sub: `${m.refunds} refund${m.refunds === 1 ? "" : "s"}` },
    { label: "Chat", value: m.messagesToday.toLocaleString(), sub: `messages today · ${m.openReports} open report${m.openReports === 1 ? "" : "s"}` },
  ];
  return (
    <section className="stack-16">
      <div className="studio-tiles">
        {tiles.map((t) => (
          <div key={t.label} className="studio-card studio-tile">
            <span className="overline">{t.label}</span>
            <span className="display-lg tabular">{t.value}</span>
            <span className="meta">{t.sub}</span>
            {t.goal && <span className="meta" style={{ color: "var(--text-2)" }}>{t.goal}</span>}
          </div>
        ))}
      </div>
      <div className="studio-card stack-8">
        <span className="overline">Purchases by product</span>
        {Object.keys(PRODUCT).map((k) => {
          const p = m.purchases[k] ?? { count: 0, cents: 0 };
          return (
            <div key={k} className="ledger-row" style={{ padding: "6px 0" }}>
              <span className="body">{PRODUCT[k]}</span>
              <span className="body-strong tabular">{p.count.toLocaleString()} · {formatPrice(p.cents)}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
