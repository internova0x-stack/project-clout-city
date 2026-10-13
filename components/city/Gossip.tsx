"use client";

import { useState } from "react";
import { CITY_ECONOMY, placeById } from "@/lib/city";
import { regularAt } from "@/lib/cast";
import { TOPIC_LABEL, foundCount, hintLine, type GossipStoryView, type TeaCard } from "@/lib/gossip";
import { ChevronLeftIcon } from "../icons";
import { Sheet } from "../Sheet";

/**
 * v0.10 neighborhood gossip (spec section 8). The Tea app on the Phone: this week's stories with
 * their progress; a story's found pieces in full (shareable with the crew, once each) and blurred
 * hints for the rest. Five pieces and Lola spills: the Tea card.
 */
export function TeaApp({ stories, cards, busy, onHome, onShare, onOpenCard }: {
  stories: GossipStoryView[]; cards: TeaCard[]; busy: boolean; onHome: () => void;
  onShare?: (storyId: string, piece: number) => void; onOpenCard: (c: TeaCard) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [tab, setTab] = useState<"live" | "done">("live");
  const story = stories.find((s) => s.id === open);
  if (story) return <StoryView story={story} busy={busy} onBack={() => setOpen(null)} onShare={onShare} onOpenCard={() => { const c = cards.find((x) => x.storyId === story.id); if (c) onOpenCard(c); }} />;
  const live = stories.filter((s) => !s.done);
  return (
    <div className="tea-app">
      <button className="phone-back" onClick={onHome}><ChevronLeftIcon size={20} /> Home</button>
      <h2 className="display-lg tea-title">🍵 Tea</h2>
      <p className="subtext" style={{ margin: "4px 0 0" }}>What Astoria&apos;s whispering. Find all five pieces and Lola spills the rest.</p>
      <div className="segmented tea-tabs" role="group" aria-label="Tea">
        <button aria-pressed={tab === "live"} onClick={() => setTab("live")}>This week</button>
        <button aria-pressed={tab === "done"} onClick={() => setTab("done")}>Finished · {cards.length}</button>
      </div>
      {tab === "live" ? (
        live.length ? (
          <div className="stack-12">
            {live.map((s) => {
              const n = foundCount(s);
              const first = s.pieces[0];
              const start = !first.found && first.place ? placeById(first.place)?.name : null;
              return (
                <button key={s.id} className="tea-story" onClick={() => setOpen(s.id)}>
                  <span className="row" style={{ justifyContent: "space-between", gap: 8 }}>
                    <span className="tag tea-tag">{TOPIC_LABEL[s.topic]}</span>
                    <span className="meta">Until {shortDay(s.endsOn)}</span>
                  </span>
                  <span className="display-sm tea-story-title">{s.emoji} {s.title}</span>
                  <span className="subtext">{s.teaser}</span>
                  <Progress n={n} />
                  <span className="meta">{n === 0 ? (start ? `Not started · start at ${start}` : "Not started") : n === 4 ? "4 of 5 · one more and Lola spills" : `${n} of 5 pieces`}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="meta" style={{ margin: 0 }}>{stories.length ? "You've heard it all this week. New tea on Monday." : "Quiet week. New tea on Monday."}</p>
        )
      ) : cards.length ? (
        <div className="tea-grid">
          {cards.map((c) => <TeaMini key={c.storyId} c={c} onOpen={() => onOpenCard(c)} />)}
        </div>
      ) : (
        <p className="meta" style={{ margin: 0 }}>Finish a story and Lola&apos;s full write-up lands here, and in your Collection.</p>
      )}
    </div>
  );
}

function StoryView({ story, busy, onBack, onShare, onOpenCard }: {
  story: GossipStoryView; busy: boolean; onBack: () => void; onShare?: (storyId: string, piece: number) => void; onOpenCard: () => void;
}) {
  return (
    <div className="tea-app">
      <button className="phone-back" onClick={onBack}><ChevronLeftIcon size={20} /> Tea</button>
      <h2 className="display-md tea-title">{story.emoji} {story.title}</h2>
      <Progress n={foundCount(story)} />
      <span className="meta" style={{ display: "block", marginTop: 6 }}>{TOPIC_LABEL[story.topic]} · findable until {shortDay(story.endsOn)}</span>
      {story.done && <button className="btn btn-secondary" style={{ width: "100%", marginTop: 12 }} onClick={onOpenCard}>🍵 Read Lola&apos;s Tea card</button>}
      <div className="stack-8" style={{ marginTop: 12 }}>
        {story.pieces.map((p) => p.found ? (
          <div key={p.n} className="tea-piece">
            <span className="tea-piece-src">
              <span>{p.via === "crew" ? "From your crew" : p.source === "regular" ? `${regularAt(p.place)?.name ?? "The regular"} · ${placeById(p.place)?.name ?? ""}` : `Overheard · ${placeById(p.place)?.name ?? ""}`}</span>
              {onShare && p.via !== "crew" && (p.shared
                ? <span className="meta">Shared ✓</span>
                : <button className="tea-share" disabled={busy} onClick={() => onShare(story.id, p.n)}>Share with crew</button>)}
            </span>
            <p className="body" style={{ margin: "6px 0 0" }}>{p.text}</p>
          </div>
        ) : (
          <div key={p.n} className="tea-piece missing" aria-label={`Piece ${p.n + 1} not found yet. ${hintLine(p, p.place ? placeById(p.place)?.name : undefined)}`}>
            <p className="body tea-blur" aria-hidden="true">Someone said something about someone, and it was a lot.</p>
            <span className="tea-hint">{p.source === "regular" ? "🗣️" : "👂"} {hintLine(p, p.place ? placeById(p.place)?.name : undefined)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Progress({ n }: { n: number }) {
  return (
    <span className="tea-progress" aria-label={`${n} of ${CITY_ECONOMY.gossip.pieces} pieces`}>
      {Array.from({ length: CITY_ECONOMY.gossip.pieces }, (_, i) => <i key={i} className={i < n ? "on" : ""} />)}
    </span>
  );
}

const shortDay = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

/** Lola's write-up: the Tea card, in full. */
export function TeaCardView({ c }: { c: TeaCard }) {
  return (
    <article className="tea-card">
      <span className="tag tea-card-tag">🍵 Lola Lowdown · Tea</span>
      <h3 className="tea-card-headline">{c.headline}</h3>
      <p className="tea-card-body">{c.body}</p>
      <span className="meta tea-card-foot">{c.emoji} {c.title} · {TOPIC_LABEL[c.topic]}</span>
    </article>
  );
}

export function TeaMini({ c, onOpen }: { c: TeaCard; onOpen: () => void }) {
  return (
    <button className="tea-mini" onClick={onOpen}>
      <span className="meta">{c.emoji} {TOPIC_LABEL[c.topic]} · {new Date(c.earnedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
      <b>{c.headline}</b>
    </button>
  );
}

/** The fifth piece: Lola spills. Or any Tea card, reopened from the Tea app or the Collection. */
export function TeaRevealSheet({ card, fresh, finished, onClose }: { card: TeaCard | null; fresh: boolean; finished: number; onClose: () => void }) {
  const { clout, mood, badgeAfter } = CITY_ECONOMY.gossip;
  return (
    <Sheet open={!!card} onClose={onClose} label="Tea card">
      {card && (
        <div className="stack-16 tea-reveal">
          {fresh && <p className="overline" style={{ margin: 0, textAlign: "center" }}>Five of five · Lola spills</p>}
          <TeaCardView c={card} />
          {fresh && (
            <>
              <span className="fx-row" style={{ justifyContent: "center", marginTop: 0 }}>
                <span className="fx fx-clout">🔥 +{clout} clout</span>
                <span className="fx">😊 +{mood} Mood</span>
                <span className="fx">🍵 Tea card kept</span>
              </span>
              <p className="meta" style={{ margin: 0, textAlign: "center", lineHeight: 1.5 }}>
                {finished >= badgeAfter ? "☕ Spills the Tea badge earned. Every new story adds a card." : `Finish ${badgeAfter} stories for the ☕ Spills the Tea badge · ${finished} of ${badgeAfter}`}
              </p>
            </>
          )}
          <button className="btn btn-secondary" onClick={onClose}>Done</button>
        </div>
      )}
    </Sheet>
  );
}
