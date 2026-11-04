// Tea and the calendar's celebrations (components/Celebrate.tsx; owner, Nov 4).
//   the fifth piece of a Tea story   a takeover (it pays clout, Mood and the Tea card; the badge at the fifth story);
//                                     its button opens the Tea card. Once per story on this device (cc-tea-done).
//   a calendar event attended         a banner with what it paid (calendar_attend pays once, so it fires once)

import { CITY_ECONOMY } from "@/lib/city";
import { CALENDAR_KIND, type CalendarEvent } from "@/lib/calendar";
import type { TeaCard } from "@/lib/gossip";
import type { Celebration } from "../Celebrate";

const KEY = "cc-tea-done";
function teaOnce(storyId: string): boolean {
  try {
    const seen = JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[];
    if (seen.includes(storyId)) return false;
    localStorage.setItem(KEY, JSON.stringify([...seen, storyId].slice(-40)));
    return true;
  } catch { return true; }
}

/** The fifth piece: null when this device already celebrated that story. `weekDone`: it was the week's last story. */
export function teaCelebration(card: TeaCard, opts: { finished: number; weekDone: boolean; onRead: () => void }): Celebration | null {
  if (typeof window === "undefined" || !teaOnce(card.storyId)) return null;
  const { clout, mood, badgeAfter, pieces } = CITY_ECONOMY.gossip;
  const badge = opts.finished === badgeAfter;
  return {
    rung: 3, emoji: card.emoji || "🍵", tag: opts.weekDone ? "Tea · the whole week" : "Tea", num: `${pieces}/${pieces}`, art: "people",
    title: opts.weekDone ? "You heard everything" : "The whole story",
    line: card.title,
    rewards: [{ tone: "clout", text: `+${clout} 🔥` }, { text: `😊 +${mood} Mood` }, { text: "🍵 Tea card" },
      ...(badge ? [{ text: "☕ Spills the Tea badge" }] : [])],
    lola: opts.weekDone ? "Every story this week. Nobody in Astoria can say anything in front of you now." : "Five pieces. Lola wrote it up. Try to look surprised.",
    cta: "Read the tea", onCta: opts.onRead, twist: "chimes",
    share: `I got the whole story on "${card.title}" in Clout City.`,
  };
}

/** A calendar event attended: what it paid, from calendarReward (the same sum calendar_attend makes). */
export function calendarBanner(e: CalendarEvent, r: { clout: number; mood: number; dress: boolean; gift: "brought" | "forgot" | null }, onOpen?: () => void): Celebration {
  const k = CALENDAR_KIND[e.kind];
  return {
    rung: 2, emoji: k.emoji, tag: "On the calendar · you went", title: e.title, onCta: onOpen,
    rewards: [
      ...(r.clout ? [{ tone: "clout" as const, text: `${r.clout > 0 ? "+" : ""}${r.clout} 🔥` }] : []),
      ...(r.mood ? [{ text: `😊 +${r.mood} Mood` }] : []),
      ...(r.dress ? [{ text: `👗 Dressed +${e.dressCode!.clout}` }] : []),
      ...(r.gift === "brought" ? [{ text: "🎁 Gift given" }] : r.gift === "forgot" ? [{ text: `🎁 No gift −${e.gift!.penalty}` }] : []),
    ],
  };
}
