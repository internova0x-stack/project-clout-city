"use client";

import type { NewsItem } from "@/lib/news";
import { mainArc, type StoryFeed } from "@/lib/storyFeed";
import { ChevronRightIcon, CloseIcon } from "../icons";

/** C16: why a price or an opening changed. Closures get a hazard band; price changes a neon tint. */
export function ReasonBanner({ kind, text, meta }: { kind: "closed" | "price" | "info"; text: string; meta?: string }) {
  const emoji = kind === "closed" ? "🚨" : kind === "price" ? "📈" : "📰";
  return (
    <div className={`reason-banner ${kind}`} role="status">
      <span aria-hidden="true">{emoji}</span>
      <span className="body-strong" style={{ flex: 1 }}>{text}</span>
      {meta && <span className="meta">{meta}</span>}
    </div>
  );
}

/** C6: the home-screen story prompt, for the first story and each new beat. */
export function StoryPrompt({ feed, dismissed, onOpen, onDismiss }: {
  feed: StoryFeed | null; dismissed: string[]; onOpen: (beatId: string) => void; onDismiss: (key: string) => void;
}) {
  const arc = mainArc(feed);
  if (!arc) return null;
  const unseen = arc.beats.filter((b) => !b.seen);
  const latest = arc.beats[arc.beats.length - 1];
  if (!latest) return null;
  const first = arc.beats.every((b) => !b.seen);
  const closesTonight = arc.predictions.find((p) => p.state === "open" && !p.myVote && new Date(p.closesAt).toDateString() === new Date().toDateString());
  const key = closesTonight ? `vote:${closesTonight.id}` : `beat:${latest.id}`;
  if (dismissed.includes(key) || (!unseen.length && !closesTonight)) return null;
  const title = first ? arc.prompt ?? arc.title : closesTonight && !unseen.length ? `Voting closes tonight: ${closesTonight.question}` : latest.headline;
  return (
    <div className="story-prompt" role="status">
      <button className="story-prompt-main" onClick={() => onOpen(closesTonight && !unseen.length ? closesTonight.beatId : latest.id)}>
        <span className="story-prompt-tile" aria-hidden="true">🔍</span>
        <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
          <span className="overline" style={{ display: "block", color: "rgba(20,17,26,.7)" }}>{first ? "New story" : closesTonight && !unseen.length ? "Call it" : `Day ${latest.day} · ${arc.title}`}</span>
          <span className="title" style={{ display: "block", color: "var(--night-900)" }}>{title}</span>
        </span>
        <ChevronRightIcon size={18} />
      </button>
      <button className="story-prompt-close" onClick={() => onDismiss(key)} aria-label="Dismiss"><CloseIcon size={14} /></button>
    </div>
  );
}

/** v0.6: the newest City News headline on the home screen (C6 layout), at most once per session. */
export function NewsPrompt({ item, onOpen, onDismiss }: { item: NewsItem; onOpen: () => void; onDismiss: () => void }) {
  return (
    <div className="story-prompt news-prompt" role="status">
      <button className="story-prompt-main" onClick={onOpen}>
        <span className="story-prompt-tile" aria-hidden="true">{item.kind === "column" ? "💌" : "📰"}</span>
        <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
          <span className="overline" style={{ display: "block", color: "rgba(20,17,26,.7)" }}>{item.kind === "column" ? "Ask Lola" : "City news"}</span>
          <span className="title" style={{ display: "block", color: "var(--night-900)" }}>{item.headline}</span>
        </span>
        <ChevronRightIcon size={18} />
      </button>
      <button className="story-prompt-close" onClick={onDismiss} aria-label="Dismiss"><CloseIcon size={14} /></button>
    </div>
  );
}
