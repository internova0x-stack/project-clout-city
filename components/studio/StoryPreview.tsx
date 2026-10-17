"use client";

import { useMemo, useState } from "react";
import { placeById } from "@/lib/city";
import { activeEffects, addDaysISO, nyTime, type Arc, type StoryEffect } from "@/lib/stories";
import { buildFeed, emptyStoryState } from "@/lib/storyFeedBuild";
import { NewsApp } from "../story/News";

// The Studio's "Preview as a player" (a saved story, or a draft in the story builder): the News app on any day,
// noon or 11 PM, free player or side-story owner, next to what the story changes in the city that day.

const nyToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());

/** content: the main story and its side stories. arcId: the main story. */
export function StoryPreview({ content, arcId, lastDay, startDay = null }: { content: Arc[]; arcId: string; lastDay: number; startDay?: number | null }) {
  const [day, setDay] = useState(Math.min(Math.max(startDay ?? 1, 1), Math.max(lastDay, 1)));
  const [evening, setEvening] = useState(false);
  const [owner, setOwner] = useState(false);

  const view = useMemo(() => {
    const today = nyToday();
    const start = addDaysISO(today, -(day - 1));
    const starts = { [arcId]: start };
    const now = nyTime(start, day, evening ? "23:00" : "12:00");
    const st = { ...emptyStoryState(), seen: content.flatMap((a) => a.beats.map((b) => b.id)), skus: owner ? content.map((a) => a.sku ?? "").filter(Boolean) : [] };
    const live = content.map((a) => ({ ...a, status: "active" as const }));
    return {
      feed: buildFeed(live, starts, now, st),
      effects: activeEffects(live.filter((a) => a.type === "main"), today, starts),
    };
  }, [content, day, evening, owner, arcId]);

  const noop = () => {};
  return (
    <>
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        {Array.from({ length: lastDay + 1 }, (_, i) => i + 1).map((d) => (
          <button key={d} className="chip" aria-pressed={d === day} onClick={() => setDay(d)}>{d > lastDay ? "After" : `Day ${d}`}</button>
        ))}
      </div>
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <button className="chip" aria-pressed={evening} onClick={() => setEvening((v) => !v)}>{evening ? "🌙 11 PM" : "☀️ Noon"}</button>
        <button className="chip" aria-pressed={owner} onClick={() => setOwner((v) => !v)}>{owner ? "Owns side stories" : "Free player"}</button>
      </div>
      <div className="studio-preview">
        <div className="phone-device studio-phone">
          <div className="phone-screen">
            <div className="phone-status light"><span>Day {Math.min(day, lastDay + 1)}</span><span className="phone-pill" aria-hidden="true" /><span aria-hidden="true">▂▄▆ 🔋</span></div>
            <div className="phone-app-screen">
              <NewsApp key={`${day}-${evening}-${owner}`} feed={view.feed} handlers={{ busy: null, vote: noop, shadowGuess: noop, markSeen: noop, completeTask: noop, onUnlock: noop }} />
            </div>
          </div>
        </div>
        <div className="stack-8" style={{ flex: 1, minWidth: 0 }}>
          <span className="title">In the city that day</span>
          {view.effects.length === 0 && <span className="subtext">Nothing changes in the city.</span>}
          {view.effects.map((e, i) => (
            <div key={i} className="studio-effect">
              <span className="meta">D{e.day} · {e.beat}</span>
              <span className="body">{describeEffect(e.effect)}</span>
            </div>
          ))}
        </div>
      </div>
    </>
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

