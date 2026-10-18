"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CITY_ECONOMY, placeById } from "@/lib/city";
import { TOPIC_LABEL, windowLine } from "@/lib/gossip";
import { InsightsTab } from "./Insights";
import { PlayersTab } from "./Players";
import { AffiliatesTab } from "./Affiliates";
import { ShoutoutsTab } from "./Shoutouts";
import { BigScreenTab } from "./BigScreen";
import { StoryPreview, describeEffect } from "./StoryPreview";
import { StoryBuilder, clearDraft, loadDraft } from "./StoryBuilder";
import { newArc } from "@/lib/storyBuilder";
import { activeEffects, addDaysISO, dayDiff, nyTime, type Arc, type StoryEffect, type Status } from "@/lib/stories";
import { buildFeed, emptyStoryState } from "@/lib/storyFeedBuild";
import { STAGE_LABEL, beatText, nextWeekday, storyStage, weekdayOf, type BeatText, type CastLine, type ContentDraft, type GossipAdmin, type GossipFileCheck, type HuntAdmin, type NewsAdminItem, type Review, type SetupCheckRow, type StudioApi, type StudioArc, type StudioMetrics, type StudioReport, type StudioResult } from "@/lib/studio";
import { formatPrice } from "@/lib/store";
import { NewsApp } from "../story/News";
import { handle } from "@/lib/validation";
import { REGULARS, regularAt } from "@/lib/cast";
import { getStyle, STYLE_IDS, type StyleId } from "@/lib/styles";
import { NEWS_KIND_LABEL } from "@/lib/news";

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
  const [tab, setTab] = useState<"stories" | "reports" | "shoutouts" | "bigscreen" | "players" | "affiliates" | "insights" | "metrics" | "cast" | "news" | "hunts" | "gossip" | "calendar" | "setup">("stories");

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

  // The story builder (owner, Oct 17): a new story, or a saved one opened to edit.
  const [builder, setBuilder] = useState<{ initial: Arc; isNew: boolean } | null>(null);
  const [checksHost, setChecksHost] = useState<HTMLElement | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [newDraft, setNewDraft] = useState<{ arc: Arc; at: number } | null>(null);
  useEffect(() => { setNewDraft(loadDraft("new")); }, [builder]);
  const openBuilder = async (id: string | null) => {
    if (!id) return setBuilder({ initial: loadDraft("new")?.arc ?? newArc("main"), isNew: true });
    setBusy("open");
    const r = await api.content(id);
    setBusy(null);
    const found = r.ok ? r.arcs.find((a) => a.id === id) : null;
    if (!found) return setNote({ kind: "error", text: r.ok ? "That story is gone." : r.error });
    setBuilder({ initial: loadDraft(id)?.arc ?? found, isNew: false });
  };
  const saveBuilt = async (json: string, id: string) => {
    let saved = false;
    await apply("upload", async () => { const r = await api.upload(json); saved = r.ok; return r; });
    if (saved) {
      clearDraft(builder?.isNew ? "new" : id);
      setBuilder(null);
      setSelected(id);
    }
  };

  const arc = arcs.find((a) => a.id === selected) ?? null;
  const mains = arcs.filter((a) => a.type === "main");
  const sidesOf = (id: string) => arcs.filter((a) => a.parent === id);
  const orphans = arcs.filter((a) => a.type === "side" && !mains.some((m) => m.id === a.parent));
  // Owner, Oct 17: the order of stories is the Studio's to set. Mains move among mains, side stories within their main.
  const moveArc = (id: string, by: -1 | 1) => {
    // [mains, each main's sides in the same order, side stories without a main], as ids.
    const groups = [mains, ...mains.map((m) => sidesOf(m.id)), orphans].map((g) => g.map((a) => a.id));
    const group = groups.find((g) => g.includes(id))!;
    const i = group.indexOf(id), j = i + by;
    if (j < 0 || j >= group.length) return;
    [group[i], group[j]] = [group[j], group[i]];
    const ids = [...groups[0].flatMap((m) => [m, ...groups[1 + mains.findIndex((x) => x.id === m)]]), ...groups[groups.length - 1]];
    apply("reorder", () => api.reorder!(ids));
  };
  const mover = (g: StudioArc[], a: StudioArc) => api.reorder && (g.length > 1 || a.type === "main") ? (
    <span className="studio-arc-move" title={g.length === 1 ? "The only main story. Its side stories stay under it; they move among themselves." : undefined}>
      <button className="chip" aria-label={`Move ${a.title || a.id} up`} disabled={busy !== null || g[0].id === a.id} onClick={() => moveArc(a.id, -1)}>↑</button>
      <button className="chip" aria-label={`Move ${a.title || a.id} down`} disabled={busy !== null || g[g.length - 1].id === a.id} onClick={() => moveArc(a.id, 1)}>↓</button>
    </span>
  ) : null;

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

      {(api.reports || api.metrics || api.insights || api.castLines || api.newsList) && (
        <div className="segmented studio-tabs" role="group" aria-label="Studio">
          <button aria-pressed={tab === "stories"} onClick={() => setTab("stories")}>Stories</button>
          {api.reports && <button aria-pressed={tab === "reports"} onClick={() => setTab("reports")}>Reports</button>}
          {api.shoutouts && <button aria-pressed={tab === "shoutouts"} onClick={() => setTab("shoutouts")}>Shoutouts</button>}
          {api.bigScreen && <button aria-pressed={tab === "bigscreen"} onClick={() => setTab("bigscreen")}>Big Screen</button>}
          {api.huntList && api.newsList && <button aria-pressed={tab === "calendar"} onClick={() => setTab("calendar")}>Calendar</button>}
          {api.newsList && <button aria-pressed={tab === "news"} onClick={() => setTab("news")}>News</button>}
          {api.huntList && <button aria-pressed={tab === "hunts"} onClick={() => setTab("hunts")}>Hunts</button>}
          {api.gossipList && <button aria-pressed={tab === "gossip"} onClick={() => setTab("gossip")}>Gossip</button>}
          {api.castLines && <button aria-pressed={tab === "cast"} onClick={() => setTab("cast")}>Cast</button>}
          {api.players && <button aria-pressed={tab === "players"} onClick={() => setTab("players")}>Players</button>}
          {api.affiliates && <button aria-pressed={tab === "affiliates"} onClick={() => setTab("affiliates")}>Affiliates</button>}
          {api.insights && <button aria-pressed={tab === "insights"} onClick={() => setTab("insights")}>Insights</button>}
          {api.metrics && <button aria-pressed={tab === "metrics"} onClick={() => setTab("metrics")}>Launch goals</button>}
          {api.setupCheck && <button aria-pressed={tab === "setup"} onClick={() => setTab("setup")}>Setup</button>}
        </div>
      )}
      {tab === "reports" && <Reports api={api} />}
      {tab === "shoutouts" && api.shoutouts && <ShoutoutsTab api={api} />}
      {tab === "bigscreen" && api.bigScreen && <BigScreenTab api={api} />}
      {tab === "players" && api.players && <PlayersTab api={api} />}
      {tab === "affiliates" && api.affiliates && <AffiliatesTab api={api} preview={preview} />}
      {tab === "insights" && api.insights && <InsightsTab load={api.insights} />}
      {tab === "metrics" && <Metrics api={api} />}
      {tab === "setup" && <SetupTab api={api} />}
      {tab === "cast" && <CastTab api={api} />}
      {tab === "news" && <NewsTab api={api} />}
      {tab === "hunts" && <HuntsTab api={api} />}
      {tab === "gossip" && <GossipTab api={api} />}
      {tab === "calendar" && <CalendarTab api={api} arcs={arcs} onOpen={setTab} />}

      {tab === "stories" && note && (
        <div className={`studio-note ${note.kind}`} role="status">
          <span className="body-strong">{note.text}</span>
          {note.problems && <ul>{note.problems.map((p) => <li key={p} className="meta">{p}</li>)}</ul>}
          <button className="chip" onClick={() => setNote(null)}>OK</button>
        </div>
      )}

      {tab === "stories" && <div className="studio-grid">
        <aside className="stack-12">
          <button className="btn btn-taxi builder-create" disabled={busy !== null} onClick={() => openBuilder(null)}>＋ Create story</button>
          {showUpload
            ? <Upload busy={busy} onUpload={(json) => apply("upload", () => api.upload(json))} />
            : <button className="studio-link" onClick={() => setShowUpload(true)}>or upload a story file</button>}
          <p className="overline" style={{ margin: "8px 0 0" }}>Stories</p>
          {newDraft && !builder && (
            <button className="studio-arc builder-draft-row" onClick={() => openBuilder(null)}>
              <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                <span className="title" style={{ display: "block" }}>{newDraft.arc.title || "Untitled story"}</span>
                <span className="meta" style={{ display: "block" }}>{newDraft.arc.type === "main" ? "Main story" : "Side story"} · Draft in the builder, on this device</span>
              </span>
              <span className="tag studio-review draft">Draft</span>
            </button>
          )}
          {mains.map((m) => (
            <div key={m.id} className="stack-8">
              <div className="studio-arc-line"><ArcRow a={m} active={m.id === selected} onPick={() => setSelected(m.id)} />{mover(mains, m)}</div>
              {sidesOf(m.id).map((s) => (
                <div key={s.id} className="studio-arc-line"><ArcRow a={s} parent={m} side active={s.id === selected} onPick={() => setSelected(s.id)} />{mover(sidesOf(m.id), s)}</div>
              ))}
            </div>
          ))}
          {orphans.map((s) => (
            <div key={s.id} className="studio-arc-line"><ArcRow a={s} side active={s.id === selected} onPick={() => setSelected(s.id)} />{mover(orphans, s)}</div>
          ))}
          {!arcs.length && <p className="subtext">No stories yet. Create one, or upload a story file.</p>}
          {builder && <div ref={setChecksHost} />}
        </aside>

        {builder ? (
          <StoryBuilder key={builder.initial.id || "new"} initial={builder.initial} isNew={builder.isNew} arcs={arcs} api={api} busy={busy} checksHost={checksHost}
            onSave={saveBuilt} onClose={() => setBuilder(null)} />
        ) : arc ? (
          <ArcDetail key={arc.id} arc={arc} parent={arcs.find((a) => a.id === arc.parent) ?? null} sides={sidesOf(arc.id)} api={api} busy={busy} apply={apply} onOpenBuilder={() => openBuilder(arc.id)} />
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

/** One status per story (owner, Oct 18): live or not, at a glance. */
function StageTag({ a, parent }: { a: StudioArc; parent?: StudioArc | null }) {
  const st = storyStage(a, parent);
  return <span className={`tag studio-review stage-${st}`}>{st === "live" ? "● " : ""}{STAGE_LABEL[st]}</span>;
}

function ArcRow({ a, parent, active, side = false, onPick }: { a: StudioArc; parent?: StudioArc; active: boolean; side?: boolean; onPick: () => void }) {
  return (
    <button className={`studio-arc${active ? " active" : ""}${side ? " side" : ""}`} onClick={onPick} aria-pressed={active}>
      <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
        <span className="title" style={{ display: "block" }}>{a.title || a.id}</span>
        <span className="meta" style={{ display: "block" }}>{side ? "Side story" : "Main story"} · {stateLine(a, parent)}</span>
      </span>
      <StageTag a={a} parent={parent} />
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

function ArcDetail({ arc, parent, sides = [], api, busy, apply, onOpenBuilder }: {
  arc: StudioArc; parent: StudioArc | null; sides?: StudioArc[]; api: StudioApi; busy: string | null;
  apply: (key: string, call: () => Promise<StudioResult>) => Promise<void>; onOpenBuilder: () => void;
}) {
  const [reviewNote, setReviewNote] = useState(arc.reviewNote ?? "");
  const today = nyToday();
  const weekday = arc.startWeekday ?? "sunday";
  const [start, setStart] = useState(arc.startAt ?? nextWeekday(addDaysISO(today, 1), weekday));
  const live = arc.day !== null && arc.day <= arc.lastDay;
  const started = calendarDay(arc) !== null;
  const finale = start ? addDaysISO(start, arc.lastDay - 1) : null;
  const totalVotes = Object.values(arc.votes ?? {}).reduce((n, v) => n + v, 0);
  // The story's full content, loaded when a beat is first opened (and again after an edit).
  const [openBeat, setOpenBeat] = useState<string | null>(null);
  const [full, setFull] = useState<Arc | null>(null);
  const [fullError, setFullError] = useState<string | null>(null);
  useEffect(() => {
    if (!openBeat || full) return;
    let gone = false;
    api.content(arc.id).then((r) => {
      if (gone) return;
      if (r.ok) setFull(r.arcs.find((a) => a.id === arc.id) ?? null);
      else setFullError(r.error);
    });
    return () => { gone = true; };
  }, [openBeat, full, api, arc.id]);
  const toggleBeat = (id: string) => setOpenBeat((o) => (o === id ? null : id));
  const [confirmLive, setConfirmLive] = useState(false);
  const sidesWaiting = sides.filter((x) => x.review === "draft").length;

  return (
    <section className="stack-16">
      <div className="studio-card stack-8">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <h2 className="display-md" style={{ margin: 0 }}>{arc.title || arc.id}</h2>
            <span className="meta">{arc.id} · {arc.type === "main" ? "Main story" : `Side story of ${parent?.title ?? arc.parent}`} · {arc.tier === "premium" ? `Premium (${arc.sku})` : "Free"} · {arc.lastDay} day{arc.lastDay === 1 ? "" : "s"}</span>
          </div>
          <StageTag a={arc} parent={parent} />
        </div>
        <span className="body-strong">{stateLine(arc, parent)}{totalVotes ? ` · ${totalVotes.toLocaleString()} votes` : ""}</span>
        <div className="row" style={{ gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button className="btn btn-secondary btn-sm" disabled={busy !== null || live} onClick={onOpenBuilder}>Open in builder</button>
          <span className="meta">{live ? "Live stories can't be rebuilt mid-run; edit a beat's words below." : "Edit the whole story. Saving a change sends it back for review."}</span>
        </div>
      </div>

      {/* Go live now (owner, Oct 18): one press from a finished story to players, today as Day 1. */}
      {arc.type === "main" && api.goLive && !live && !started && arc.status !== "retired" && (
        <div className="studio-card studio-golive stack-8">
          <span className="overline">Go live now</span>
          <span className="subtext">
            Approves it{sidesWaiting ? ` and its ${sidesWaiting} side ${sidesWaiting === 1 ? "story" : "stories"} waiting for review` : ""}{arc.status === "paused" ? ", resumes it" : ""} and makes today, {fmtDate(today)}, Day 1. Players see Day 1 on their next refresh;
            Day 2 goes out at midnight New York time.
            {weekdayOf(today) !== weekday ? ` It's written to start on a ${weekday}; today is a ${weekdayOf(today)}.` : ""}
          </span>
          {confirmLive ? (
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              <button className="btn btn-taxi btn-sm" disabled={busy !== null} onClick={() => { setConfirmLive(false); void apply("golive", () => api.goLive!(arc.id)); }}>
                {busy === "golive" ? "Going live…" : "Yes, go live today"}
              </button>
              <button className="btn btn-secondary btn-sm" disabled={busy !== null} onClick={() => setConfirmLive(false)}>Cancel</button>
            </div>
          ) : (
            <div><button className="btn btn-taxi btn-sm" disabled={busy !== null} onClick={() => setConfirmLive(true)}>Go live now</button></div>
          )}
        </div>
      )}

      {/* 1. One approval */}
      <div className="studio-card stack-8">
        <span className="overline">1 · Review</span>
        <span className="subtext">
          {arc.review === "approved" ? `Approved${arc.reviewedAt ? ` on ${new Date(arc.reviewedAt).toLocaleDateString()}` : ""}. ` : arc.review === "declined" ? "Declined. Upload a fixed file to send it back for review. " : "Waiting for a yes or no. "}
          {live || started ? "" : arc.type === "main" ? "Approving doesn't put it live: give it a Day 1 below, or Go live now. " : `Once approved, it runs with ${parent?.title ?? "its main story"}. `}Changing the file sends it back here.
        </span>
        <textarea className="studio-input" rows={2} value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} placeholder="Note for the writers (required to decline)" aria-label="Review note" />
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-taxi btn-sm" disabled={busy !== null || arc.review === "approved"} onClick={() => apply("review", () => api.review(arc.id, "approved", reviewNote))}>Approve</button>
          <button className="btn btn-secondary btn-sm" disabled={busy !== null || arc.review === "declined" || !reviewNote.trim() || live} onClick={() => apply("review", () => api.review(arc.id, "declined", reviewNote))}>Decline</button>
          {arc.review !== "draft" && !live && <button className="chip" disabled={busy !== null} onClick={() => apply("review", () => api.review(arc.id, "draft", reviewNote))}>{arc.startAt && arc.type === "main" ? "Back to review (clears Day 1)" : "Back to review"}</button>}
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

      {/* Beats: tap one to read it; edit its words (owner, Oct 17). */}
      <div className="studio-card stack-8">
        <span className="overline">Beats</span>
        <span className="subtext">Tap a beat to read it. Editing changes its words only; days, effects and answers stay as the file has them.</span>
        <div className="studio-beats">
          {(arc.beats ?? []).map((b) => (
            <div key={b.id} className={`studio-beat-wrap${openBeat === b.id ? " open" : ""}`}>
              <div className={`studio-beat${arc.day !== null && b.day <= arc.day ? " out" : ""}`}>
                <button className="studio-beat-open" onClick={() => toggleBeat(b.id)} aria-expanded={openBeat === b.id}>
                  <span className="hud-number studio-beat-day">D{b.day}</span>
                  <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                    <span className="title" style={{ display: "block" }}>{b.headline}</span>
                    <span className="meta">
                      {b.id}
                      {b.prediction ? ` · prediction ${b.prediction}${arc.votes?.[b.prediction] ? `: ${arc.votes[b.prediction].toLocaleString()} votes` : ""}` : ""}
                      {arc.day !== null && b.day <= arc.day ? " · released" : ""}
                    </span>
                  </span>
                  <span className="studio-beat-chevron" aria-hidden="true">{openBeat === b.id ? "▴" : "▾"}</span>
                </button>
                <select className="studio-input" value={b.status} disabled={busy !== null} aria-label={`Status of ${b.id}`}
                  onChange={(e) => apply("beat", () => api.beatStatus(arc.id, b.id, e.target.value as Status))} style={{ width: "auto" }}>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="retired">Retired</option>
                </select>
              </div>
              {openBeat === b.id && (
                <BeatPanel key={`${b.id}-${arc.updatedAt}`} beat={full?.beats.find((x) => x.id === b.id) ?? null} error={fullError} released={arc.day !== null && b.day <= arc.day}
                  busy={busy} canEdit={!!api.beatEdit}
                  onSave={(t) => apply("beat-edit", async () => { const r = await api.beatEdit!(arc.id, b.id, t); if (r.ok) setFull(null); return r; })} />
              )}
            </div>
          ))}
        </div>
      </div>

      {arc.type === "main" && <PlayerPreview arc={arc} api={api} />}
    </section>
  );
}

/** One beat, as players read it, with its words editable (the rest of the beat stays as the file has it). */
function BeatPanel({ beat, error, released, busy, canEdit, onSave }: {
  beat: Arc["beats"][number] | null; error: string | null; released: boolean; busy: string | null; canEdit: boolean;
  onSave: (t: BeatText) => void;
}) {
  const [draft, setDraft] = useState<BeatText | null>(null);
  if (error) return <div className="studio-beat-panel"><span className="meta reason">{error}</span></div>;
  if (!beat) return <div className="studio-beat-panel"><span className="subtext">Loading…</span></div>;
  const t = draft ?? beatText(beat);
  const set = (f: (x: BeatText) => void) => setDraft(() => { const x = structuredClone(t); f(x); return x; });
  const field = (label: string, value: string, onChange: (v: string) => void, rows = 1) => (
    <label className="stack-4">
      <span className="overline">{label}</span>
      {rows > 1
        ? <textarea className="studio-input" rows={rows} value={value} onChange={(e) => onChange(e.target.value)} />
        : <input className="studio-input" value={value} onChange={(e) => onChange(e.target.value)} />}
    </label>
  );
  if (!draft) {
    return (
      <div className="studio-beat-panel stack-12">
        {beat.news.map((n, i) => (
          <div key={i} className="stack-4">
            {n.previously && <span className="meta">Previously: {n.previously}</span>}
            <span className="title">{n.headline}</span>
            {n.hook && <span className="body-strong">{n.hook}</span>}
            {n.body && <p className="body" style={{ margin: 0, whiteSpace: "pre-wrap" }}>{n.body}</p>}
          </div>
        ))}
        {beat.card_note && <span className="meta">Card note: {beat.card_note}</span>}
        {beat.evidence && (
          <div className="studio-beat-evidence stack-4">
            <span className="overline">Evidence · {beat.evidence.kind}</span>
            <span className="title">{beat.evidence.title}</span>
            {beat.evidence.lines.map((l, i) => <span key={i} className="body">{l}</span>)}
          </div>
        )}
        {beat.prediction && (
          <div className="stack-4">
            <span className="overline">Prediction {beat.prediction.id}</span>
            <span className="title">{beat.prediction.question}</span>
            {beat.prediction.options.map((o) => (
              <span key={o.id} className="body">{o.id === beat.prediction!.correct ? "✓ " : "· "}{o.label}{o.id === beat.prediction!.correct ? " (the answer)" : ""}</span>
            ))}
            <span className="meta">Closes Day {beat.prediction.closes_at.day} at {beat.prediction.closes_at.time} · revealed in {beat.prediction.reveal_beat} · {beat.prediction.reward.clout} clout</span>
          </div>
        )}
        {beat.effects.length > 0 && (
          <div className="stack-4">
            <span className="overline">In the city</span>
            {beat.effects.map((e, i) => <span key={i} className="body">{describeEffect(e)}</span>)}
          </div>
        )}
        {canEdit && (
          <div className="row" style={{ gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setDraft(beatText(beat))}>Edit words</button>
            {released && <span className="meta">Already out: players see the new words the next time they open it.</span>}
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="studio-beat-panel stack-12">
      {t.news.map((n, i) => (
        <div key={i} className="stack-8">
          {t.news.length > 1 && <span className="overline">News item {i + 1}</span>}
          {field("Headline", n.headline, (v) => set((x) => { x.news[i].headline = v; }))}
          {field("Hook", n.hook ?? "", (v) => set((x) => { x.news[i].hook = v; }))}
          {field("Story", n.body ?? "", (v) => set((x) => { x.news[i].body = v; }), 6)}
          {(beat.news[i].previously !== undefined || n.previously) && field("Previously", n.previously ?? "", (v) => set((x) => { x.news[i].previously = v; }), 2)}
        </div>
      ))}
      {field("Card note", t.card_note ?? "", (v) => set((x) => { x.card_note = v; }))}
      {t.evidence && (
        <>
          {field("Evidence title", t.evidence.title, (v) => set((x) => { x.evidence!.title = v; }))}
          {field("Evidence (one line each)", t.evidence.lines.join("\n"), (v) => set((x) => { x.evidence!.lines = v.split("\n"); }), 5)}
        </>
      )}
      {t.prediction && (
        <>
          {field("Prediction question", t.prediction.question, (v) => set((x) => { x.prediction!.question = v; }))}
          {t.prediction.options.map((o, i) => (
            <div key={o.id}>{field(`Option ${o.id}${o.id === beat.prediction?.correct ? " (the answer)" : ""}`, o.label, (v) => set((x) => { x.prediction!.options[i].label = v; }))}</div>
          ))}
          {Object.keys(t.prediction.roasts ?? {}).map((k) => (
            <div key={k}>{field(`Roast for ${k}`, t.prediction!.roasts![k], (v) => set((x) => { x.prediction!.roasts![k] = v; }), 2)}</div>
          ))}
        </>
      )}
      <div className="row" style={{ gap: 8 }}>
        <button className="btn btn-taxi btn-sm" disabled={busy !== null} onClick={() => onSave(t)}>{busy === "beat-edit" ? "Saving…" : "Save"}</button>
        <button className="btn btn-secondary btn-sm" disabled={busy !== null} onClick={() => setDraft(null)}>Cancel</button>
      </div>
    </div>
  );
}

/** Reads any day of a story the way a player will: loads the story and its side stories, then StoryPreview. */
function PlayerPreview({ arc, api }: { arc: StudioArc; api: StudioApi }) {
  const [content, setContent] = useState<Arc[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const r = await api.content(arc.id);
    setLoading(false);
    if (r.ok) setContent(r.arcs);
    else setError(r.error);
  };

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
        <StoryPreview content={content} arcId={arc.id} lastDay={arc.lastDay} startDay={arc.day} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reports: the chat review queue (Clarifications 10.6)
// ---------------------------------------------------------------------------
const REASON: Record<StudioReport["reason"], string> = { harassment: "Harassment", spam: "Spam", inappropriate: "Inappropriate", other: "Other" };

/**
 * Setup check (owner, Oct 14): when news, hunts or payments don't show up, this says which key,
 * migration or webhook is missing. It runs the news and hunt import too. Secrets are never shown.
 */
function SetupTab({ api }: { api: StudioApi }) {
  const [rows, setRows] = useState<SetupCheckRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const check = useCallback(async () => {
    if (!api.setupCheck) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api.setupCheck();
      if (r.ok) setRows(r.data); else setError(r.error);
    } catch {
      setError("The check glitched. Try again.");
    } finally {
      setBusy(false);
    }
  }, [api]);
  useEffect(() => { void check(); }, [check]);
  const groups = [...new Set((rows ?? []).map((r) => r.group))];
  const fails = (rows ?? []).filter((r) => r.state === "fail").length;
  return (
    <section className="studio-card stack-12">
      <div className="row" style={{ justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <div className="stack-4">
          <h2 className="display-md" style={{ margin: 0 }}>Setup check</h2>
          <p className="meta" style={{ margin: 0 }}>What the live game needs, checked from this deployment. Fix the red lines from the top down.</p>
        </div>
        <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void check()}>{busy ? "Checking…" : "Check again"}</button>
      </div>
      {error && <p className="studio-note error">{error}</p>}
      {rows && <p className="meta" style={{ margin: 0 }}>{fails ? `${fails} thing${fails === 1 ? "" : "s"} to fix.` : "Everything checked out."}</p>}
      {groups.map((g) => (
        <div key={g} className="stack-8">
          <h3 className="overline" style={{ margin: 0 }}>{g}</h3>
          <ul className="setup-rows">
            {(rows ?? []).filter((r) => r.group === g).map((r) => (
              <li key={r.label} className={`setup-row ${r.state}`}>
                <span aria-hidden="true">{r.state === "ok" ? "✅" : r.state === "warn" ? "⚠️" : "❌"}</span>
                <div className="setup-text"><b>{r.label}</b><span className="meta">{r.detail}</span></div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

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
            <span className="title">{REASON[r.reason]}: {handle(r.reporter.name)} reported {handle(r.reported.name)}</span>
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

/** v0.6: the regulars' lines. New lines wait for approval; approved ones go live at once, paused ones vanish. */
function CastTab({ api }: { api: StudioApi }) {
  const [rows, setRows] = useState<CastLine[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [npc, setNpc] = useState(REGULARS[0].id);
  const [text, setText] = useState("");
  const [kind, setKind] = useState<"line" | "update">("line");
  const [week, setWeek] = useState("");
  const load = useCallback(async () => {
    const r = await api.castLines!();
    if (r.ok) { setRows(r.data); setError(null); } else setError(r.error);
  }, [api]);
  useEffect(() => { void load(); }, [load]);
  const monday = (d: string) => !d || new Date(`${d}T12:00:00`).getDay() === 1;
  const add = async () => {
    if (!monday(week)) return setError("A week starts on a Monday. Pick a Monday, or leave it empty for every week.");
    setBusy(true);
    const r = await api.castAdd!(npc, text, kind, week || null);
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setText("");
    void load();
  };
  const set = async (id: number, status: CastLine["status"]) => {
    setBusy(true);
    const r = await api.castStatus!(id, status);
    setBusy(false);
    if (!r.ok) return setError(r.error);
    void load();
  };
  const name = (id: string) => REGULARS.find((r) => r.id === id)?.name ?? id;
  return (
    <section className="stack-12">
      <section className="studio-card stack-8">
        <span className="title">Add a line</span>
        <p className="meta" style={{ margin: 0 }}>
          Regulars say their everyday lines (in the app) plus anything approved here. Use a week for personal updates and cast news;
          leave it empty for a line that runs every week. New lines wait for approval.
        </p>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <select className="studio-input" value={npc} onChange={(e) => setNpc(e.target.value)} aria-label="Regular">
            {REGULARS.map((r) => <option key={r.id} value={r.id}>{r.name} ({r.title})</option>)}
          </select>
          <select className="studio-input" value={kind} onChange={(e) => setKind(e.target.value as "line" | "update")} aria-label="Kind">
            <option value="line">Line</option>
            <option value="update">Personal update</option>
          </select>
          <input className="studio-input" type="date" value={week} onChange={(e) => setWeek(e.target.value)} aria-label="Week of (a Monday)" />
        </div>
        <textarea className="studio-input" rows={2} maxLength={240} value={text} onChange={(e) => setText(e.target.value)} placeholder="Did you hear the streamer got banned again?" />
        <div><button className="btn btn-taxi btn-sm" disabled={busy || text.trim().length < 3} onClick={() => void add()}>Send for review</button></div>
      </section>
      {error && <div className="studio-note error"><span className="body-strong">{error}</span></div>}
      {rows === null && !error && <p className="meta">Loading…</p>}
      {rows?.length === 0 && <section className="studio-card"><p className="subtext" style={{ margin: 0 }}>No Studio lines yet. Regulars are running on their everyday lines.</p></section>}
      {rows?.map((l) => (
        <article key={l.id} className="studio-card stack-4">
          <div className="row" style={{ justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
            <span className="title">{name(l.npc)}{l.kind === "update" ? " · update" : ""}{l.weekOf ? ` · week of ${l.weekOf}` : " · every week"}</span>
            <span className={`tag studio-review ${l.status === "approved" ? "approved" : l.status === "paused" ? "declined" : "draft"}`}>{l.status === "review" ? "needs review" : l.status}</span>
          </div>
          <span className="body">&ldquo;{l.line}&rdquo;</span>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            {l.status !== "approved" && <button className="btn btn-taxi btn-sm" disabled={busy} onClick={() => void set(l.id, "approved")}>Approve</button>}
            {l.status === "approved" && <button className="btn btn-destructive btn-sm" disabled={busy} onClick={() => void set(l.id, "paused")}>Pause</button>}
            {l.status !== "review" && <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void set(l.id, "review")}>Back to review</button>}
          </div>
        </article>
      ))}
    </section>
  );
}

/** v0.6 City News: upload a week, approve it (or single items), pause, move to another day. */
function NewsTab({ api }: { api: StudioApi }) {
  const [rows, setRows] = useState<NewsAdminItem[] | null>(null);
  const [error, setError] = useState<{ text: string; problems?: string[] } | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [json, setJson] = useState("");
  const load = useCallback(async () => {
    const r = await api.newsList!();
    if (r.ok) { setRows(r.data); } else setError({ text: r.error });
  }, [api]);
  useEffect(() => { void load(); }, [load]);
  const go = async (call: () => Promise<{ ok: boolean; error?: string; problems?: string[] }>, done?: string) => {
    setBusy(true); setError(null); setOk(null);
    const r = await call();
    setBusy(false);
    if (!r.ok) return setError({ text: r.error ?? "Something went wrong.", problems: r.problems });
    if (done) setOk(done);
    void load();
  };
  const upload = () => go(async () => {
    const r = await api.newsUpload!(json);
    if (r.ok) setJson("");
    return r.ok ? { ok: true } : { ok: false, error: r.error, problems: r.problems };
  }, "Week checked and saved. New and changed items wait for approval below.");
  const pending = rows?.filter((r) => r.status === "review") ?? [];
  const approveAll = () => go(async () => {
    for (const r of pending) { const x = await api.newsStatus!(r.id, "approved"); if (!x.ok) return x; }
    return { ok: true };
  }, `Approved ${pending.length} item${pending.length === 1 ? "" : "s"}.`);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const days = [...new Set((rows ?? []).map((r) => r.day))];
  return (
    <section className="stack-12">
      <section className="studio-card stack-8">
        <span className="title">Upload a week</span>
        <p className="meta" style={{ margin: 0 }}>
          Paste a week file from <code>content/news/</code> (or choose it). It&apos;s checked first: a Monday week, known cast, one Lola column, hunts on Mondays.
          Items publish on their day once approved; re-uploading an unchanged item keeps it approved.
        </p>
        <input type="file" accept="application/json,.json" className="studio-input" aria-label="Week file"
          onChange={async (e) => { const f = e.target.files?.[0]; if (f) setJson(await f.text()); }} />
        <textarea className="studio-input" rows={4} value={json} onChange={(e) => setJson(e.target.value)} placeholder={'{ "week": "2026-10-19", "items": [ … ] }'} />
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-taxi btn-sm" disabled={busy || !json.trim()} onClick={() => void upload()}>Check and save</button>
          {pending.length > 0 && <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void approveAll()}>Approve all {pending.length} waiting</button>}
        </div>
      </section>
      {ok && <div className="studio-note ok" role="status"><span className="body-strong">{ok}</span></div>}
      {error && (
        <div className="studio-note error" role="alert">
          <span className="body-strong">{error.text}</span>
          {error.problems && <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>{error.problems.map((p) => <li key={p} className="meta">{p}</li>)}</ul>}
        </div>
      )}
      {rows === null && !error && <p className="meta">Loading…</p>}
      {rows?.length === 0 && <section className="studio-card"><p className="subtext" style={{ margin: 0 }}>No news yet. Upload this week&apos;s file to start the feed.</p></section>}
      {days.map((day) => (
        <div key={day} className="stack-8">
          <p className="overline" style={{ margin: "6px 0 0" }}>
            {new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
            {day === today ? " · today" : day < today ? " · published" : ""}
          </p>
          {rows!.filter((r) => r.day === day).map((r) => (
            <article key={r.id} className="studio-card stack-4">
              <div className="row" style={{ justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <span className="meta">{NEWS_KIND_LABEL[r.kind]} · {r.id}</span>
                <span className={`tag studio-review ${r.status === "approved" ? "approved" : r.status === "paused" ? "declined" : "draft"}`}>{r.status === "review" ? "needs review" : r.status}</span>
              </div>
              <span className="title" style={{ display: "block" }}>{r.headline}</span>
              <p className="body">{r.body}</p>
              <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                {r.status !== "approved" && <button className="btn btn-taxi btn-sm" disabled={busy} onClick={() => void go(() => api.newsStatus!(r.id, "approved"))}>Approve</button>}
                {r.status === "approved" && <button className="btn btn-destructive btn-sm" disabled={busy} onClick={() => void go(() => api.newsStatus!(r.id, "paused"))}>Pause</button>}
                {r.status !== "review" && <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void go(() => api.newsStatus!(r.id, "review"))}>Back to review</button>}
                <label className="meta row" style={{ gap: 6 }}>Move to
                  <input type="date" className="studio-input" style={{ width: "auto" }} value={r.day} disabled={busy}
                    onChange={(e) => e.target.value && void go(() => api.newsReschedule!(r.id, e.target.value))} />
                </label>
              </div>
            </article>
          ))}
        </div>
      ))}
    </section>
  );
}

/**
 * v0.6 treasure hunts: upload a week (checked first), skim all eight tracks, read one in full
 * (answers marked), then approve. Pause hides a hunt at once; players keep their progress.
 */
/**
 * v0.10 gossip (migration 0034): automatic. Week files in content/gossip go live on their Monday
 * without anyone approving them; this tab is the back office view: every week in full, the file
 * checks, who's playing, and Pause or Hold with a note when something needs a change.
 */
function GossipTab({ api }: { api: StudioApi }) {
  const [rows, setRows] = useState<GossipAdmin[] | null>(null);
  const [files, setFiles] = useState<GossipFileCheck[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<string | null>(null);
  const load = useCallback(async () => {
    const r = await api.gossipList!();
    if (r.ok) { setRows(r.data.weeks); setFiles(r.data.files); } else setError(r.error);
  }, [api]);
  useEffect(() => { void load(); }, [load]);
  const go = async (call: () => Promise<{ ok: boolean; error?: string }>, done: string) => {
    setBusy(true); setError(null); setOk(null);
    const r = await call();
    setBusy(false);
    if (!r.ok) return setError(r.error ?? "Something went wrong.");
    setOk(done);
    void load();
  };
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const shortDay = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const plus = (d: string, n: number) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  const failing = files.filter((f) => !f.ok);
  return (
    <section className="stack-12">
      <section className="studio-card stack-8">
        <span className="title">Gossip runs itself</span>
        <p className="meta" style={{ margin: 0 }}>
          Each week file in <code>content/gossip/</code> goes live on its Monday and stays findable for {CITY_ECONOMY.gossip.liveDays} days. You don&apos;t need to
          approve anything. Read it here; <b>Pause</b> hides a week at once, and <b>Hold</b> keeps it off until the file is fixed (your note goes to the writer).
          Files that fail the checks never go live.
        </p>
      </section>
      {ok && <div className="studio-note ok" role="status"><span className="body-strong">{ok}</span></div>}
      {error && <div className="studio-note error" role="alert"><span className="body-strong">{error}</span></div>}
      {failing.map((f) => (
        <div key={f.file} className="studio-note error" role="alert">
          <span className="body-strong">{f.file} won&apos;t go live until it passes its checks:</span>
          <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>{f.problems.map((p) => <li key={p} className="meta">{p}</li>)}</ul>
        </div>
      ))}
      {rows === null && !error && <p className="meta">Loading…</p>}
      {rows?.length === 0 && <section className="studio-card"><p className="subtext" style={{ margin: 0 }}>No gossip weeks yet. The weekly drafting routine adds a file to content/gossip.</p></section>}
      {rows?.map((w) => {
        const ends = plus(w.week, CITY_ECONOMY.gossip.liveDays - 1);
        const state = w.status === "paused" ? "Paused" : w.status === "review" ? "Held" : today < w.week ? `Goes live ${shortDay(w.week)}` : today <= ends ? "Live now" : "Ended";
        const cls = w.status === "approved" ? (today <= ends ? "approved" : "draft") : w.status === "paused" ? "declined" : "draft";
        return (
          <article key={w.week} className="studio-card stack-12">
            <div className="row" style={{ justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
              <div>
                <span className="meta">Week of {shortDay(w.week)} · findable until {shortDay(ends)}</span>
                <span className="title" style={{ display: "block" }}>🍵 {w.data.stories.length} stories</span>
              </div>
              <span className={`tag studio-review ${cls}`}>{state}</span>
            </div>
            {w.status === "review" && w.note && <div className="studio-note error" role="status"><span><span className="body-strong">Held: </span>{w.note}</span></div>}
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              {w.status !== "approved" && <button className="btn btn-taxi btn-sm" disabled={busy} onClick={() => void go(() => api.gossipStatus!(w.week, "approved"), "Back on. It runs on its dates.")}>Let it run</button>}
              {w.status !== "paused" && <button className="btn btn-destructive btn-sm" disabled={busy} onClick={() => void go(() => api.gossipStatus!(w.week, "paused"), "Paused. Players no longer see its stories; what they found is kept.")}>Pause</button>}
            </div>
            {w.status === "approved" && (
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <input className="studio-input" style={{ flex: "1 1 240px" }} placeholder="Hold with a note: what should change?" value={notes[w.week] ?? ""}
                  onChange={(e) => setNotes({ ...notes, [w.week]: e.target.value })} aria-label="Note for the writer" />
                <button className="btn btn-secondary btn-sm" disabled={busy || !(notes[w.week] ?? "").trim()}
                  onClick={() => void go(() => api.gossipStatus!(w.week, "review", notes[w.week]), "Held with your note. It goes live again once the file changes.").then(() => setNotes({ ...notes, [w.week]: "" }))}>Hold</button>
              </div>
            )}
            {w.data.stories.map((s) => {
              const key = `${w.week}:${s.id}`;
              return (
                <div key={s.id} className="stack-8 hunt-read">
                  <button className="list-row" style={{ textAlign: "left" }} onClick={() => setOpen(open === key ? null : key)} aria-expanded={open === key}>
                    <span aria-hidden="true">{s.emoji}</span>
                    <span style={{ flex: 1 }}>
                      <span className="body-strong" style={{ display: "block" }}>{s.title} <span className="meta">· {TOPIC_LABEL[s.topic]}</span></span>
                      <span className="meta">{w.started[s.id] ?? 0} started · {w.finished[s.id] ?? 0} finished · {open === key ? "hide" : "read it all"}</span>
                    </span>
                  </button>
                  {open === key && (
                    <>
                      <p className="body" style={{ margin: 0 }}><i>{s.teaser}</i></p>
                      {s.pieces.map((p, i) => (
                        <div key={i} className="stack-4">
                          <span className="meta" style={{ display: "block" }}>
                            Piece {i + 1} · {p.source === "regular" ? `${regularAt(p.place)?.name ?? "the regular"} at ` : p.source === "restroom" ? "🚻 Restroom at " : "Listen in at "}{placeById(p.place)?.name ?? p.place}
                            {p.hours ? ` · ${windowLine(p.hours)}` : ""}
                          </span>
                          <span className="body" style={{ display: "block" }}>{p.text}</span>
                        </div>
                      ))}
                      <span className="overline" style={{ display: "block", marginTop: 4 }}>Lola&apos;s Tea card</span>
                      <span className="body-strong" style={{ display: "block" }}>{s.tea.headline}</span>
                      <span className="body" style={{ display: "block" }}>{s.tea.body}</span>
                    </>
                  )}
                </div>
              );
            })}
          </article>
        );
      })}
    </section>
  );
}

function HuntsTab({ api }: { api: StudioApi }) {
  const [rows, setRows] = useState<HuntAdmin[] | null>(null);
  const [error, setError] = useState<{ text: string; problems?: string[] } | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [json, setJson] = useState("");
  const [open, setOpen] = useState<Record<string, StyleId>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const load = useCallback(async () => {
    const r = await api.huntList!();
    if (r.ok) setRows(r.data); else setError({ text: r.error });
  }, [api]);
  useEffect(() => { void load(); }, [load]);
  const go = async (call: () => Promise<{ ok: boolean; error?: string; problems?: string[] }>, done?: string) => {
    setBusy(true); setError(null); setOk(null);
    const r = await call();
    setBusy(false);
    if (!r.ok) return setError({ text: r.error ?? "Something went wrong.", problems: r.problems });
    if (done) setOk(done);
    void load();
  };
  const upload = () => go(async () => {
    const r = await api.huntUpload!(json);
    if (r.ok) setJson("");
    return r.ok ? { ok: true } : { ok: false, error: r.error, problems: r.problems };
  }, "Hunt checked and saved. Skim the tracks, read one in full, then approve it.");
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  return (
    <section className="stack-12">
      <section className="studio-card stack-8">
        <span className="title">Upload a hunt</span>
        <p className="meta" style={{ margin: 0 }}>
          Paste a hunt file from <code>content/hunts/</code> (or choose it). It&apos;s checked first: a Monday week, real places with a regular,
          none touched by a story that week, at least one free or cheap step, all eight tracks, exactly one right answer per question.
          It runs Monday to Sunday once approved; re-uploading it unchanged keeps it approved.
        </p>
        <input type="file" accept="application/json,.json" className="studio-input" aria-label="Hunt file"
          onChange={async (e) => { const f = e.target.files?.[0]; if (f) setJson(await f.text()); }} />
        <textarea className="studio-input" rows={4} value={json} onChange={(e) => setJson(e.target.value)} placeholder={'{ "week": "2026-10-26", "id": "…", "tracks": { … } }'} />
        <div className="row" style={{ gap: 8 }}>
          <button className="btn btn-taxi btn-sm" disabled={busy || !json.trim()} onClick={() => void upload()}>Check and save</button>
        </div>
      </section>
      {ok && <div className="studio-note ok" role="status"><span className="body-strong">{ok}</span></div>}
      {error && (
        <div className="studio-note error" role="alert">
          <span className="body-strong">{error.text}</span>
          {error.problems && <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>{error.problems.map((p) => <li key={p} className="meta">{p}</li>)}</ul>}
        </div>
      )}
      {rows === null && !error && <p className="meta">Loading…</p>}
      {rows?.length === 0 && <section className="studio-card"><p className="subtext" style={{ margin: 0 }}>No hunts yet. Upload next week&apos;s file by Sunday.</p></section>}
      {rows?.map((h) => {
        const end = new Date(`${h.week}T12:00:00Z`); end.setUTCDate(end.getUTCDate() + 6);
        const live = today >= h.week && today <= end.toISOString().slice(0, 10);
        const style = open[h.id] ?? STYLE_IDS[0];
        const t = h.data.tracks[style];
        const max = Math.max(1, ...h.atStep);
        return (
          <article key={h.id} className="studio-card stack-12">
            <div className="row" style={{ justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
              <div>
                <span className="meta">Week of {new Date(`${h.week}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}{live ? " · running now" : h.week > today ? " · upcoming" : " · ended"}</span>
                <span className="title" style={{ display: "block" }}>🗺️ {h.data.theme}</span>
              </div>
              <span className={`tag studio-review ${h.status === "approved" ? "approved" : h.status === "paused" ? "declined" : "draft"}`}>{h.status === "review" ? "needs review" : h.status}</span>
            </div>
            <p className="body" style={{ margin: 0 }}>{h.data.intro}</p>
            <p className="meta" style={{ margin: 0 }}>Route: {h.data.places.map((id, i) => `${i + 1}. ${placeById(id)?.name ?? id} (${regularAt(id)?.name ?? "?"})`).join(" → ")}</p>
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              {h.status !== "approved" && <button className="btn btn-taxi btn-sm" disabled={busy} onClick={() => void go(() => api.huntStatus!(h.id, "approved"), "Approved. It runs Monday to Sunday of its week.")}>Approve</button>}
              {h.status === "approved" && <button className="btn btn-destructive btn-sm" disabled={busy} onClick={() => void go(() => api.huntStatus!(h.id, "paused"), "Paused. Players no longer see it; their progress is kept.")}>Pause</button>}
              {h.status !== "review" && <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void go(() => api.huntStatus!(h.id, "review"))}>Back to review</button>}
            </div>
            {h.status === "review" && h.note && <div className="studio-note error" role="status"><span><span className="body-strong">Sent back: </span>{h.note}</span></div>}
            {h.status !== "approved" && (
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <input className="studio-input" style={{ flex: "1 1 240px" }} placeholder="Send back with a note: what should change?" value={notes[h.id] ?? ""}
                  onChange={(e) => setNotes({ ...notes, [h.id]: e.target.value })} aria-label="Note for the writer" />
                <button className="btn btn-secondary btn-sm" disabled={busy || !(notes[h.id] ?? "").trim()}
                  onClick={() => void go(() => api.huntStatus!(h.id, "review", notes[h.id]), "Sent back with your note. Re-upload the fixed file to review it again.").then(() => setNotes({ ...notes, [h.id]: "" }))}>Send back</button>
              </div>
            )}
            {h.joined > 0 && (
              <div className="stack-4">
                <span className="meta">{h.joined} joined · {h.completed} found it ({Math.round((100 * h.completed) / h.joined)}%) · still on each step:</span>
                {h.atStep.map((n, i) => (
                  <div key={i} className="row" style={{ gap: 8 }}>
                    <span className="meta" style={{ width: 52 }}>Step {i + 1}</span>
                    <span className="gig-progress" style={{ flex: 1 }}><span style={{ width: `${(100 * n) / max}%` }} /></span>
                    <span className="meta" style={{ width: 36, textAlign: "right" }}>{n}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="stack-4">
              <span className="overline">Skim the eight tracks</span>
              {STYLE_IDS.map((sid) => {
                const x = h.data.tracks[sid];
                const fin = x.steps[x.steps.length - 1].question!;
                return (
                  <button key={sid} className={`list-row${sid === style ? " selected" : ""}`} style={{ textAlign: "left" }} onClick={() => setOpen({ ...open, [h.id]: sid })}>
                    <span aria-hidden="true">{x.emoji}</span>
                    <span style={{ flex: 1 }}>
                      <span className="body-strong" style={{ display: "block" }}>{x.treasure} <span className="meta">· {getStyle(sid).label}</span></span>
                      <span className="meta">Finale: {fin.q} → {fin.choices[fin.answer]}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="stack-8">
              <span className="overline">Read in full: {getStyle(style).label}</span>
              <p className="body" style={{ margin: 0 }}><b>{t.emoji} {t.treasure}.</b> {t.lore}</p>
              {t.steps.map((st, i) => (
                <div key={i} className="stack-4 hunt-read">
                  <span className="meta">Step {i + 1} · {regularAt(h.data.places[i])?.name} at {placeById(h.data.places[i])?.name}</span>
                  <span className="body">&ldquo;{st.say}&rdquo;</span>
                  {st.question && (
                    <>
                      <span className="body-strong">Q: {st.question.q}</span>
                      <span className="meta">{st.question.choices.map((c, j) => (j === st.question!.answer ? `✓ ${c}` : c)).join(" · ")}</span>
                      <span className="body">&ldquo;{st.then}&rdquo;</span>
                    </>
                  )}
                </div>
              ))}
            </div>
          </article>
        );
      })}
    </section>
  );
}

/** Keys sorted, so a file and the database's copy of it compare equal. */
function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (v && typeof v === "object") return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`).join(",")}}`;
  return JSON.stringify(v);
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * v0.6 content calendar: week by week, the stories running, the hunt and the news (spec section
 * 2, "see the hunt and news calendar"). Week files committed to content/ (by the weekly drafting
 * routine) load with one tap; they still wait for approval in the Hunts and News tabs.
 */
function CalendarTab({ api, arcs, onOpen }: { api: StudioApi; arcs: StudioArc[]; onOpen: (t: "hunts" | "news" | "gossip") => void }) {
  const [hunts, setHunts] = useState<HuntAdmin[] | null>(null);
  const [gossip, setGossip] = useState<GossipAdmin[]>([]);
  const [news, setNews] = useState<NewsAdminItem[] | null>(null);
  const [drafts, setDrafts] = useState<ContentDraft[]>([]);
  const [error, setError] = useState<{ text: string; problems?: string[] } | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const [h, n, d] = await Promise.all([api.huntList!(), api.newsList!(), api.drafts ? api.drafts() : Promise.resolve({ ok: true as const, data: [] })]);
    if (h.ok) setHunts(h.data); else setError({ text: h.error });
    if (n.ok) setNews(n.data); else setError({ text: n.error });
    if (d.ok) setDrafts(d.data);
    if (api.gossipList) { const g = await api.gossipList(); if (g.ok) setGossip(g.data.weeks); }
  }, [api]);
  useEffect(() => { void load(); }, [load]);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const monday = addDaysISO(today, -((new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7));
  const weeks = [...new Set([
    ...Array.from({ length: 6 }, (_, i) => addDaysISO(monday, 7 * (i - 1))),
    ...drafts.map((d) => d.week).filter((w) => w >= monday),
  ])].sort();
  const loadDraft = async (d: ContentDraft) => {
    setBusy(true); setError(null); setOk(null);
    const r = d.kind === "hunt" ? await api.huntUpload!(d.json) : await api.newsUpload!(d.json);
    setBusy(false);
    if (!r.ok) return setError({ text: `${d.file}: ${r.error}`, problems: r.problems });
    setOk(`Loaded ${d.file}. It waits for your approval in the ${d.kind === "hunt" ? "Hunts" : "News"} tab.`);
    void load();
  };
  const huntDraftLoaded = (d: ContentDraft, h?: HuntAdmin) => {
    try { return !!h && stable(h.data) === stable(JSON.parse(d.json)); } catch { return false; }
  };
  const newsDraftLoaded = (d: ContentDraft) => {
    try {
      const ids = ((JSON.parse(d.json) as { items?: { id: string }[] }).items ?? []).map((i) => i.id);
      return ids.length > 0 && ids.every((id) => news?.some((n) => n.id === id));
    } catch { return false; }
  };
  return (
    <section className="stack-12">
      <p className="meta" style={{ margin: 0 }}>
        Each week: the stories running, the hunt (Monday to Sunday) and the news by day. Files the weekly drafting routine commits to
        <code> content/</code> show a Load button once merged; loading only uploads them, and they still wait for your approval.
      </p>
      {ok && <div className="studio-note ok" role="status"><span className="body-strong">{ok}</span></div>}
      {error && (
        <div className="studio-note error" role="alert">
          <span className="body-strong">{error.text}</span>
          {error.problems && <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>{error.problems.map((p) => <li key={p} className="meta">{p}</li>)}</ul>}
        </div>
      )}
      {(hunts === null || news === null) && !error && <p className="meta">Loading…</p>}
      {hunts && news && weeks.map((w) => {
        const end = addDaysISO(w, 6);
        const hunt = hunts.find((h) => h.week === w);
        const huntDraft = drafts.find((d) => d.kind === "hunt" && d.week === w);
        const newsDraft = drafts.find((d) => d.kind === "news" && d.week === w);
        const stories = arcs.filter((a) => a.startAt && a.status === "active" && a.startAt <= end && addDaysISO(a.startAt, Math.max(0, a.lastDay - 1)) >= w);
        const when = w === monday ? " · this week" : w === addDaysISO(monday, 7) ? " · next week" : w < monday ? " · last week" : "";
        const soon = w === monday || w === addDaysISO(monday, 7);
        return (
          <article key={w} className={`studio-card stack-8${w < monday ? " calendar-past" : ""}`}>
            <span className="title">Week of {fmtDate(w)}{when}</span>
            <div className="calendar-row">
              <span className="overline">Story</span>
              <span className="body">{stories.length ? stories.map((a) => `${a.title}${a.review !== "approved" ? " (not approved)" : ""}`).join(" · ") : <span className="meta">No story running</span>}</span>
            </div>
            <div className="calendar-row">
              <span className="overline">Hunt</span>
              <span className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                {hunt ? (
                  <button className="chip" onClick={() => onOpen("hunts")}>🗺️ {hunt.data.theme} · {hunt.status === "review" ? "needs review" : hunt.status}{hunt.joined ? ` · ${hunt.joined} joined` : ""}</button>
                ) : (
                  <span className={soon ? "meta reason" : "meta"}>{soon ? "⚠️ No hunt yet" : "No hunt yet"}</span>
                )}
                {huntDraft && !huntDraftLoaded(huntDraft, hunt) && w >= monday && (
                  <button className="btn btn-taxi btn-sm" disabled={busy} onClick={() => void loadDraft(huntDraft)}>Load hunt: {huntDraft.label}</button>
                )}
              </span>
            </div>
            {api.gossipList && (() => {
              const g = gossip.find((x) => x.week === w);
              return (
                <div className="calendar-row">
                  <span className="overline">Gossip</span>
                  <span className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                    {g ? (
                      <button className="chip" onClick={() => onOpen("gossip")}>🍵 {g.data.stories.length} stories · {g.status === "approved" ? "goes live on its own" : g.status === "review" ? "held" : "paused"}</button>
                    ) : (
                      <span className={soon ? "meta reason" : "meta"}>{soon ? "⚠️ No gossip yet" : "No gossip yet"}</span>
                    )}
                  </span>
                </div>
              );
            })()}
            <div className="calendar-row">
              <span className="overline">News</span>
              <span className="stack-8">
                <span className="calendar-days">
                  {DAYS.map((d, i) => {
                    const items = news.filter((n) => n.day === addDaysISO(w, i));
                    const waiting = items.filter((n) => n.status === "review").length;
                    const live = items.filter((n) => n.status === "approved").length;
                    return (
                      <button key={d} className={`calendar-day${waiting ? " waiting" : live ? " live" : ""}`} onClick={() => onOpen("news")}
                        title={items.map((n) => `${n.headline} (${n.status})`).join("\n") || "Nothing scheduled"}>
                        <span className="meta">{d}</span>
                        <span className="body-strong">{items.length || "–"}</span>
                      </button>
                    );
                  })}
                </span>
                {newsDraft && !newsDraftLoaded(newsDraft) && w >= monday && (
                  <button className="btn btn-taxi btn-sm" style={{ alignSelf: "start" }} disabled={busy} onClick={() => void loadDraft(newsDraft)}>Load news: {newsDraft.label}</button>
                )}
              </span>
            </div>
          </article>
        );
      })}
    </section>
  );
}
