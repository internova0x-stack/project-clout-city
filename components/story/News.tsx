"use client";

import type { PartyMention } from "@/lib/party";
import { SpottedCard } from "../city/Party";
import { PotWinNewsCard } from "../city/Lotto";
import type { LottoWin } from "@/lib/lotto";
import { useEffect, useMemo, useRef, useState } from "react";
import { NEWS_KIND_LABEL, splitNews, transitLive, transitUntil, type NewsItem } from "@/lib/news";
import { lineName } from "@/lib/travel";
import dynamic from "next/dynamic";
import { Sheet } from "../Sheet";
import { normalizeLook } from "@/lib/look";
import { GAME_CONFIG } from "@/lib/config";
import { badgeInfo, postCast, type FeedArc, type FeedBeat, type FeedPrediction, type StoryFeed } from "@/lib/storyFeed";

// The News app (C30 to C34): today's story, side stories, the archive, predictions
// with live results, reveals with Lola's roast, evidence cards and shadow guesses.

export interface NewsHandlers {
  busy: string | null;
  vote: (pid: string, option: string) => void;
  shadowGuess: (pid: string, option: string) => void;
  markSeen: (beatId: string) => void;
  /** Opening a blog post (migration 0117): pays clout once per post. */
  readPost?: (beatId: string) => void;
  completeTask: (taskId: string) => void;
  onUnlock: (arc: FeedArc) => void;
  /** Real-money state of a side story (price from the store catalog, and whether a payment is unlocking). */
  product?: (sku: string) => { price: string; pending: boolean } | null;
  /** Analytics: a beat was shared. */
  onShared?: () => void;
  /** VIP (migration 0052): members read every side story free; others can join from a locked story. */
  vip?: { member: boolean; onJoin: () => void };
}

/** v0.6 City News handed to the News app. */
export interface CityNews { items: NewsItem[]; today: string; focus?: string | null; onSeen?: (ids: string[]) => void }

export function NewsApp({ feed, handlers, focusBeat, city, spotted = [], jackpots = [] }: {
  feed: StoryFeed | null; handlers: NewsHandlers; focusBeat?: string | null; city?: CityNews;
  /** v0.9: "Spotted at" lines from parties the player went to (empty when they opted out). */
  spotted?: PartyMention[];
  /** Lucky Star's last pot wins (migration 0041), for Lola's card in the City tab. */
  jackpots?: LottoWin[];
}) {
  const storyLive = (feed?.arcs ?? []).some((a) => a.type === "main" && !a.finished);
  // Story and City are the feed's two tabs; the Archive opens from the header.
  const [feedTab, setFeedTab] = useState<"today" | "city">(city?.focus || (!storyLive && city?.items.length) ? "city" : "today");
  const [inArchive, setInArchive] = useState(false);
  const tab = inArchive ? "archive" : feedTab;
  const [reading, setReading] = useState<string | null>(null);
  const live = (feed?.arcs ?? []).filter((a) => a.type === "main" && !a.finished);
  const archive = (feed?.arcs ?? []).filter((a) => a.type === "main" && a.finished);
  const sides = (parent: string) => (feed?.arcs ?? []).filter((a) => a.type === "side" && a.parent === parent);

  // Reading the City tab marks its items seen, so none comes back as a card on the home screen (owner, Oct 22).
  const cityIds = (city?.items ?? []).map((i) => i.id).join(",");
  useEffect(() => {
    if (tab === "city" && cityIds) city?.onSeen?.(cityIds.split(","));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, cityIds]);

  // Opening the app marks today's released beats as read (clears NEW after a moment).
  const unseen = useMemo(() => live.flatMap((a) => a.beats.filter((b) => !b.seen).map((b) => b.id)), [live]);
  useEffect(() => {
    if (!unseen.length) return;
    const t = setTimeout(() => unseen.forEach((id) => handlers.markSeen(id)), 2500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unseen.join(",")]);

  useEffect(() => {
    if (focusBeat) document.getElementById(`beat-${focusBeat}`)?.scrollIntoView({ block: "start" });
  }, [focusBeat]);
  // The feed runs oldest first, so opening it lands on the newest released beat.
  const latestRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!focusBeat && feedTab === "today" && !inArchive) latestRef.current?.scrollIntoView({ block: "start" });
  }, [focusBeat, feedTab, inArchive]);

  const cityNews = city ? splitNews(city.items, city.today) : { recent: [], archive: [] };
  if (!feed && !city) return <Quiet text="The newsroom is still setting up. Stories arrive with the next update of the city." />;

  const readingArc = archive.find((a) => a.id === reading);
  return (
    <div className="stack-12">
      <div className="row news-header" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <h2 className="display-lg" style={{ margin: "4px 0 0" }}>{inArchive ? "Archive" : "News"}</h2>
        <button className="chip" aria-pressed={inArchive} onClick={() => { setInArchive((x) => !x); setReading(null); }}>
          {inArchive ? "‹ Back to news" : "🗂️ Archive"}
        </button>
      </div>
      {!inArchive && city && (
        <div className="segmented" role="group" aria-label="News feed">
          <button aria-pressed={feedTab === "today"} onClick={() => setFeedTab("today")}>Story</button>
          <button aria-pressed={feedTab === "city"} onClick={() => setFeedTab("city")}>City</button>
        </div>
      )}
      {tab === "city" ? (
        cityNews.recent.length === 0 && spotted.length === 0 && jackpots.length === 0 ? (
          <Quiet text="Slow news week. Even the celebrities are napping. Check back tomorrow." />
        ) : (
          <div className="stack-12">
            {jackpots.slice(0, 1).map((w) => <PotWinNewsCard key={w.wonAt} w={w} />)}
            {spotted.map((m) => <SpottedCard key={m.eventId} m={m} />)}
            {cityNews.recent.map((i) => <CityNewsCard key={i.id} item={i} today={city!.today} focus={city!.focus === i.id} />)}
          </div>
        )
      ) : !feed ? (
        <Quiet text="No story running right now. Lola's sharpening her nails and her pencils. The next one drops on a Sunday, babe." />
      ) : tab === "today" ? (
        live.length === 0 ? (
          <Quiet text="No story running right now. Lola's sharpening her nails and her pencils. The next one drops on a Sunday, babe." />
        ) : (
          live.map((arc) => (
            <div key={arc.id} className="stack-12">
              <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
                <span className="title">{arc.emoji} {arc.title}</span>
                <span className="meta">Day {arc.day} of {arc.lastDay}</span>
              </div>
              {/* Owner, Oct 18: every beat in order; released ones in full, then tomorrow's headline, then the rest locked. */}
              {arc.beats.map((b, i) => (
                <div key={b.id} ref={i === arc.beats.length - 1 && !focusBeat ? latestRef : undefined}>
                  <BeatCard arc={arc} beat={b} feed={feed} handlers={handlers} />
                </div>
              ))}
              <UpcomingBeats arc={arc} today={feed.today} />
              <SideArcs arcs={sides(arc.id)} feed={feed} handlers={handlers} />
            </div>
          ))
        )
      ) : readingArc ? (
        <div className="stack-12">
          <button className="phone-back" onClick={() => setReading(null)}>‹ Archive</button>
          <span className="title">{readingArc.emoji} {readingArc.title}</span>
          {readingArc.beats.map((b) => (
            <ArchiveBeat key={b.id} arc={readingArc} beat={b} feed={feed} handlers={handlers} />
          ))}
          <SideArcs arcs={sides(readingArc.id)} feed={feed} handlers={handlers} />
        </div>
      ) : archive.length === 0 && cityNews.archive.length === 0 ? (
        <Quiet text="Nothing in the archive yet. Finished stories and last week's city news land here." />
      ) : (
        <>
        {cityNews.archive.length > 0 && (
          <div className="stack-8">
            <p className="overline" style={{ margin: 0 }}>City news</p>
            {cityNews.archive.slice(0, 30).map((i) => <CityNewsCard key={i.id} item={i} today={city!.today} />)}
          </div>
        )}
        {archive.length > 0 && <p className="overline" style={{ margin: "8px 0 0" }}>Stories</p>}
        {archive.map((a) => (
          <button key={a.id} className="list-row" onClick={() => setReading(a.id)}>
            <span className="icon-tile" style={{ width: 40, height: 40, fontSize: 20 }} aria-hidden="true">{a.emoji ?? "📰"}</span>
            <span style={{ flex: 1, textAlign: "left" }}>
              <span className="title" style={{ display: "block" }}>{a.title}</span>
              <span className="meta">{a.lastDay} beats · {a.predictions.length} predictions</span>
            </span>
          </button>
        ))}
        </>
      )}
    </div>
  );
}

/** One City News item: Lola's byline, the kind, the day and the full text. */
function CityNewsCard({ item, today, focus = false }: { item: NewsItem; today: string; focus?: boolean }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => { if (focus) ref.current?.scrollIntoView({ block: "start" }); }, [focus]);
  const when = item.day === today ? "Today" : new Date(`${item.day}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  return (
    <article ref={ref} className={`card stack-8 news-card news-${item.kind}${focus ? " focus" : ""}`} id={`news-${item.id}`}>
      <div className="row" style={{ justifyContent: "space-between", gap: 8 }}>
        <span className={`tag ${item.kind === "column" ? "tag-event" : "tag-neutral"}`}>{NEWS_KIND_LABEL[item.kind]}</span>
        <span className="meta">{when}</span>
      </div>
      <h3 className="title" style={{ margin: 0, fontSize: 18, lineHeight: 1.25 }}>{item.headline}</h3>
      <p className="body" style={{ margin: 0, color: "var(--text-2)" }}>{item.body}</p>
      {/* C4: a transit update names its line; a delay that's on now says so, and the subway takes longer. */}
      {item.transit ? (
        <p className="meta" style={{ margin: 0 }}>
          🚇 {lineName(item.transit.line).replace(/^the /, "The ")}
          {item.transit.delay ? ` · trips +${item.transit.delay} s ${transitUntil(item.transit)}` : ` · ${transitUntil(item.transit)}`}
          {transitLive(item, Date.now()) && <b style={{ color: "#B4561A" }}> · Live now</b>}
        </p>
      ) : <Byline />}
    </article>
  );
}

/** What's coming (migration 0085): tomorrow's headline as a teaser, every later beat locked by its day. */
function UpcomingBeats({ arc, today }: { arc: FeedArc; today: string }) {
  const up = arc.upcoming ?? [];
  if (!up.length) return null;
  const when = (day: number) => {
    const d = new Date(`${today}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + day - arc.day);
    return day === arc.day + 1 ? "Tomorrow" : d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
  };
  const next = up.filter((b) => b.headline);
  const later = up.filter((b) => !b.headline);
  return (
    <div className="stack-8">
      {next.map((b) => (
        <article key={b.id} className="beat-card beat-teaser" aria-label={`Day ${b.day}, coming ${when(b.day)}`}>
          <div className="row beat-head" style={{ justifyContent: "space-between" }}>
            <span className="overline">Next · {when(b.day)}</span>
            <span className="meta">Day {b.day} of {arc.lastDay}</span>
          </div>
          <h3 className="display-md beat-headline">{b.headline}</h3>
          <div className="beat-teaser-lines" aria-hidden="true"><span /><span /><span /></div>
          <p className="meta" style={{ margin: 0 }}>🔒 Unlocks at midnight, New York time. Lola is still fact-checking. Barely.</p>
        </article>
      ))}
      {later.length > 0 && (
        <div className="beat-locked-list" aria-label="Later beats">
          {later.map((b) => (
            <div key={b.id} className="beat-locked-row">
              <span aria-hidden="true">🔒</span>
              <span className="title">Day {b.day}</span>
              <span className="meta">{when(b.day)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Quiet({ text }: { text: string }) {
  return (
    <div className="card stack-4">
      <p className="overline" style={{ margin: 0 }}>Quiet in Queens</p>
      <p className="body" style={{ margin: 0, color: "var(--text-2)" }}>{text}</p>
    </div>
  );
}

const AvatarHead = dynamic(() => import("../avatar/AvatarHead"), { ssr: false });

/** Owner, Oct 22: the post's key characters as avatar heads; tapping one shows their bio. */
function StoryCast({ arc, ids }: { arc: FeedArc; ids: string[] }) {
  const people = postCast(arc, ids);
  const [open, setOpen] = useState<string | null>(null);
  if (!people.length) return null;
  const who = people.find((c) => c.id === open);
  return (
    <section className="story-cast" aria-label="Characters">
      <span className="overline">Characters</span>
      <div className="story-cast-row">
        {people.map((c) => (
          <button key={c.id} type="button" className="story-cast-person" aria-pressed={open === c.id} onClick={() => setOpen(open === c.id ? null : c.id)}>
            <span className="story-cast-face"><AvatarHead look={normalizeLook(c.look, c.style)} size={44} /></span>
            <span className="story-cast-name">{c.name}</span>
          </button>
        ))}
      </div>
      {who && (
        <div className="story-cast-bio" role="status">
          <span className="title">{who.name}</span>
          <span className="meta">{who.role}</span>
          <p className="body" style={{ margin: 0 }}>{who.bio}</p>
        </div>
      )}
    </section>
  );
}

const Byline = () => (
  <div className="row" style={{ gap: 8 }}>
    <span className="lola-avatar" style={{ width: 24, height: 24, fontSize: 13 }} aria-hidden="true">💋</span>
    <span className="meta" style={{ whiteSpace: "nowrap" }}>Lola Lowdown</span>
  </div>
);

/** C30: a beat card, with its evidence, prediction and any reveals it carries. */
export function BeatCard({ arc, beat, feed, handlers, hideBody = false }: { arc: FeedArc; beat: FeedBeat; feed: StoryFeed; handlers: NewsHandlers; hideBody?: boolean }) {
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [postOpen, setPostOpen] = useState(false);
  const shareTask = feed.tasks.find((t) => t.do.share === beat.id);
  const evidenceTask = feed.tasks.find((t) => t.do.evidence === beat.id);
  const prediction = arc.predictions.find((p) => p.beatId === beat.id);
  const reveals = arc.predictions.filter((p) => p.revealBeat === beat.id && p.state === "revealed");
  const share = async () => {
    const text = `${beat.headline} · ${arc.title} on Clout City`;
    try {
      if (navigator.share) await navigator.share({ title: arc.title, text, url: window.location.origin });
      else await navigator.clipboard?.writeText(`${text} ${window.location.origin}`);
    } catch {
      return; // cancelled share sheet
    }
    handlers.onShared?.();
    if (shareTask && !shareTask.done) handlers.completeTask(shareTask.id);
  };
  return (
    <article id={`beat-${beat.id}`} className="beat-card">
      <div className="row beat-head" style={{ justifyContent: "space-between" }}>
        <span className="overline">{arc.title}</span>
        <span className="row" style={{ gap: 6 }}>
          {!beat.seen && <span className="badge-new">New</span>}
          <span className="meta">Day {beat.day} of {arc.lastDay}</span>
        </span>
      </div>
      {beat.previously && (
        <div className="beat-prev">
          <span className="overline">Previously</span>
          <p className="subtext" style={{ margin: 0 }}><em>{beat.previously}</em></p>
        </div>
      )}
      <h3 className="display-md beat-headline">{beat.headline}</h3>
      {!hideBody && (beat.post ? (
        // Owner, Oct 22: stories read like a blog. The card is the title and a teaser; the post is behind Read more.
        <>
          {beat.body && <p className="body beat-body">{beat.body}</p>}
          <button className="link-btn beat-more" type="button" onClick={() => {
            setPostOpen(true);
            if (beat.read === false) handlers.readPost?.(beat.id);
          }}>Read the full post{beat.read === false && handlers.readPost ? ` · +${GAME_CONFIG.storyReadClout} 🔥` : ""} ›</button>
        </>
      ) : (
        <>
          {beat.body && <p className="body beat-body">{beat.body}</p>}
          {beat.hook && <p className="title beat-hook">{beat.hook}</p>}
        </>
      ))}
      {beat.post && (
        <Sheet open={postOpen} onClose={() => setPostOpen(false)} label={beat.headline} tall>
          <article className="blog-post">
            <span className="overline">{arc.emoji} {arc.title} · Day {beat.day} of {arc.lastDay}</span>
            <h2 className="display-lg blog-title">{beat.headline}</h2>
            <Byline />
            {beat.post.split(/\n\s*\n/).map((para, i) => <p key={i} className="body blog-para">{para.trim()}</p>)}
            {beat.hook && <p className="title beat-hook">{beat.hook}</p>}
            <button className="btn btn-night btn-sm" onClick={share}>↗ Share{shareTask && !shareTask.done ? ` · +${shareTask.clout} 🔥` : ""}</button>
            <StoryCast arc={arc} ids={beat.cast ?? []} />
          </article>
        </Sheet>
      )}
      {beat.cardNote && <p className="meta" style={{ margin: 0 }}>🗳️ {beat.cardNote}</p>}
      <div className="row beat-foot" style={{ justifyContent: "space-between" }}>
        <Byline />
        <button className="btn btn-night btn-sm" onClick={share}>↗ Share{shareTask && !shareTask.done ? ` · +${shareTask.clout} 🔥` : ""}</button>
      </div>
      {beat.evidence && (
        evidenceOpen ? (
          <EvidenceCard evidence={beat.evidence} />
        ) : (
          <button className="btn btn-secondary btn-sm" style={{ width: "100%" }} onClick={() => {
            setEvidenceOpen(true);
            if (evidenceTask && !evidenceTask.done) handlers.completeTask(evidenceTask.id);
          }}>
            🔎 Open evidence{evidenceTask && !evidenceTask.done ? ` · +${evidenceTask.clout} 🔥` : ""}
          </button>
        )
      )}
      {prediction && <PredictionCard p={prediction} arc={arc} feed={feed} handlers={handlers} />}
      {!hideBody && reveals.map((p) => <RevealCard key={p.id} p={p} feed={feed} />)}
    </article>
  );
}

/** C33: evidence, styled as the document or post it is. */
function EvidenceCard({ evidence }: { evidence: { title: string; kind: string; lines: string[] } }) {
  return (
    <div className="evidence-card stack-4">
      <span className="overline">Evidence · {evidence.title}</span>
      {evidence.lines.map((l, i) => <p key={i} className={i === 0 ? "title" : "body"} style={{ margin: 0 }}>{l}</p>)}
    </div>
  );
}

function closeLine(p: FeedPrediction): string {
  const closes = new Date(p.closesAt);
  const ny = (d: Date) => d.toLocaleDateString("en-US", { timeZone: "America/New_York" });
  if (ny(closes) === ny(new Date())) return "Closes tonight";
  return `Closes ${closes.toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" })}`;
}

/** C31: a prediction, with live results once you vote. */
export function PredictionCard({ p, arc, feed, handlers }: { p: FeedPrediction; arc: FeedArc; feed: StoryFeed; handlers: NewsHandlers }) {
  const [changing, setChanging] = useState(false);
  const [shadowing, setShadowing] = useState(false);
  const open = p.state === "open";
  const voted = !!p.myVote;
  const total = p.results?.total ?? 0;
  const pct = (id: string) => (total ? Math.round(((p.results?.counts[id] ?? 0) / total) * 100) : 0);
  const showResults = !!p.results && (!open || (voted && !changing));
  const canShadow = arc.finished && !voted && !p.shadowGuess;
  const busy = handlers.busy !== null;
  return (
    <div className={`prediction-card stack-8${open ? " open" : ""}`}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span className="overline" style={{ color: open ? "var(--neon-text)" : undefined }}>Call it · {p.id}</span>
        <span className="meta">{open ? closeLine(p) : p.state === "closed" ? "Voting closed. The truth drops soon." : "Revealed"}</span>
      </div>
      <span className="title">{p.question}</span>
      {open && (!voted || changing) ? (
        <div className="stack-4">
          {p.options.map((o) => (
            <button key={o.id} className="select-card" aria-pressed={p.myVote === o.id} disabled={busy}
              onClick={() => { handlers.vote(p.id, o.id); setChanging(false); }} style={{ padding: "12px 14px" }}>
              <span className="title" style={{ fontSize: 15 }}>{o.label}</span>
              {p.myVote === o.id && <span className="info-badge" style={{ position: "absolute", right: 10, top: 10 }}>Your pick</span>}
            </button>
          ))}
          <span className="meta">Right answers earn +{p.reward.clout} clout{p.reward.badge ? ` and the ${badgeInfo(feed, p.reward.badge)?.name ?? "badge"}` : ""}.</span>
        </div>
      ) : canShadow && shadowing ? (
        <div className="stack-4">
          <span className="meta">Shadow guess: no clout, just bragging rights (and a badge if you're right).</span>
          {p.options.map((o) => (
            <button key={o.id} className="select-card" disabled={busy} onClick={() => { handlers.shadowGuess(p.id, o.id); setShadowing(false); }} style={{ padding: "12px 14px" }}>
              <span className="title" style={{ fontSize: 15 }}>{o.label}</span>
            </button>
          ))}
        </div>
      ) : showResults ? (
        <div className="stack-4">
          {p.options.map((o) => {
            const mine = p.myVote === o.id || p.shadowGuess === o.id;
            const right = p.correct === o.id;
            return (
              <div key={o.id} className="result-row">
                <div className="result-bar"><span style={{ width: `${pct(o.id)}%` }} className={mine ? "mine" : ""} /></div>
                <span className="result-label">{right ? "✓ " : mine && p.correct ? "✗ " : ""}{o.label}{mine ? " · you" : ""}</span>
                <span className="body-strong tabular">{pct(o.id)}%</span>
              </div>
            );
          })}
          <span className="meta">{total.toLocaleString()} votes in Queens</span>
        </div>
      ) : (
        <span className="meta">{arc.finished ? "" : "Voting closed before you got here. The truth drops soon."}</span>
      )}
      {open && voted && !changing && <button className="btn btn-ghost btn-sm" onClick={() => setChanging(true)}>Change vote</button>}
      {canShadow && !shadowing && <button className="btn btn-night btn-sm" style={{ width: "100%" }} onClick={() => setShadowing(true)}>Make a shadow guess</button>}
    </div>
  );
}

/** C32: the truth, your pick and Lola's roast. */
function RevealCard({ p, feed }: { p: FeedPrediction; feed: StoryFeed }) {
  const answer = p.options.find((o) => o.id === p.correct)?.label ?? "";
  const mine = p.options.find((o) => o.id === p.myVote)?.label;
  const right = !!p.myVote && p.myVote === p.correct;
  const badge = p.reward.badge ? badgeInfo(feed, p.reward.badge) : null;
  return (
    <div className="reveal-card stack-8">
      <span className="overline" style={{ color: "var(--taxi-400)" }}>The truth · {p.id}</span>
      <span className="display-xl" style={{ color: "#fff", lineHeight: 1.05 }}>{answer}</span>
      {mine ? (
        <span className="body" style={{ color: "rgba(255,246,224,.85)" }}>{right ? "✓" : "✗"} You picked {mine}. {right ? "Lola is impressed. Lola is never impressed." : p.roast ?? ""}</span>
      ) : (
        <span className="body" style={{ color: "rgba(255,246,224,.7)" }}>You didn&apos;t vote on this one.</span>
      )}
      {right && (
        <div className="row" style={{ gap: 10 }}>
          <span className="hud-number" style={{ color: "var(--taxi-400)" }}>+{p.reward.clout} clout</span>
          {badge && <span className="achievement" title={badge.name}>{badge.emoji}</span>}
          {badge && <span className="meta" style={{ color: "#fff" }}>{badge.name}</span>}
        </div>
      )}
    </div>
  );
}

/** Archive: beats in order; the reveal stays behind its own beat until you open it. */
function ArchiveBeat({ arc, beat, feed, handlers }: { arc: FeedArc; beat: FeedBeat; feed: StoryFeed; handlers: NewsHandlers }) {
  const isReveal = arc.predictions.some((p) => p.revealBeat === beat.id);
  const [open, setOpen] = useState(!isReveal);
  if (open) return <BeatCard arc={arc} beat={beat} feed={feed} handlers={handlers} />;
  return (
    <div className="beat-card stack-8">
      <span className="overline">Day {beat.day} · the reveal</span>
      <span className="body" style={{ color: "var(--text-2)" }}>This beat reveals the answers. Make your shadow guesses above first, if you like.</span>
      <button className="btn btn-night btn-sm" style={{ width: "100%" }} onClick={() => setOpen(true)}>Read the reveal</button>
    </div>
  );
}

/** C34: side stories, locked as teasers until bought. */
function SideArcs({ arcs, feed, handlers }: { arcs: FeedArc[]; feed: StoryFeed; handlers: NewsHandlers }) {
  if (!arcs.length) return null;
  return (
    <div className="stack-8">
      <p className="overline" style={{ margin: "8px 0 0" }}>Side stories</p>
      {arcs.map((a) => (a.entitled ? (
        <div key={a.id} className="stack-12">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginTop: 8 }}>
            <span className="title" style={{ minWidth: 0 }}>{a.emoji} {a.title}</span>
            {handlers.vip?.member && <span className="tag tag-gold">👑 Free with VIP</span>}
          </div>
          {[...a.beats].reverse().map((b) => <BeatCard key={b.id} arc={a} beat={b} feed={feed} handlers={handlers} />)}
        </div>
      ) : (
        <div key={a.id} className="side-teaser stack-12">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
            <span className="title" style={{ minWidth: 0 }}>{a.emoji} {a.title}</span>
            <span className="tag tag-gold">✨ Real cash</span>
          </div>
          <span className="subtext">{a.teaser}</span>
          {a.beats.map((b) => <span key={b.id} className="meta locked-row">🔒 {b.headline}</span>)}
          {(() => {
            const p = a.sku ? handlers.product?.(a.sku) : null;
            if (p?.pending) return <button className="btn btn-taxi btn-sm" style={{ width: "100%" }} disabled>Unlocking… payment received</button>;
            return (
              <div className="stack-8">
                <button className="btn btn-taxi btn-sm" style={{ width: "100%" }} disabled={handlers.busy === `buy:${a.sku}`} onClick={() => handlers.onUnlock(a)}>
                  {handlers.busy === `buy:${a.sku}` ? "Opening checkout…" : p ? `Unlock for ${p.price}` : "Unlock"}
                </button>
                {handlers.vip && !handlers.vip.member && (
                  <button className="btn btn-secondary btn-sm" style={{ width: "100%" }} onClick={handlers.vip.onJoin}>👑 Free with VIP</button>
                )}
              </div>
            );
          })()}
        </div>
      )))}
    </div>
  );
}

