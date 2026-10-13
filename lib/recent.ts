import { CLUB_EVENTS, itemBySku, placeById, type Place } from "./city.ts";

/**
 * v0.7 step 3: a profile's "Recently" (migration 0020, player_card.recent). Public by owner decision
 * (Oct 13), so the server sends only public moments; this turns each into one line.
 */
export interface RecentItem {
  kind: "visit" | "event" | "purchase" | "hunt" | "party";
  /** visit: "place:day"; event: "event:day"; purchase: the item's sku; hunt: the hunt's id. */
  ref: string;
  at: string;
  /** Hunts only: the week's theme. */
  theme?: string | null;
}

export function recentLine(item: RecentItem): { emoji: string; text: string } | null {
  const id = item.ref.split(":")[0];
  switch (item.kind) {
    case "visit": {
      const p = placeById(id);
      return p ? { emoji: p.emoji, text: `Stopped by ${p.name}` } : null;
    }
    case "event": {
      const ev = CLUB_EVENTS.find((e) => e.id === id);
      return ev ? { emoji: "🍾", text: `Pulled up to ${ev.name}` } : null;
    }
    case "purchase": {
      const it = itemBySku(item.ref);
      return it ? { emoji: it.emoji, text: `Bought: ${it.name}` } : null;
    }
    case "hunt":
      return { emoji: "🗺️", text: item.theme ? `Finished the hunt: ${item.theme}` : "Finished a treasure hunt" };
    case "party":
      return { emoji: "🎉", text: "Survived their first party" };
    default:
      return null;
  }
}

/** "Just now", "3h", "Yesterday", then the weekday, then the date. */
export function recentWhen(at: string, now: Date = new Date()): string {
  const t = new Date(at);
  const mins = Math.max(0, Math.round((now.getTime() - t.getTime()) / 60000));
  if (mins < 60) return mins < 2 ? "Just now" : `${mins}m`;
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(t, now)) return `${Math.round(mins / 60)}h`;
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (sameDay(t, y)) return "Yesterday";
  if (mins < 7 * 24 * 60) return t.toLocaleDateString("en-US", { weekday: "short" });
  return t.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export type StatKey = "energy" | "mood" | "confidence";
export interface StatTip {
  stat: StatKey; placeId: string; placeName: string; emoji: string; price: number; gain: number;
  /** v0.7: with enough Confidence and clout, the Confidence row points to an open pro gig or big break instead. */
  gig?: { id: number; pay: number };
}

/**
 * The expanded stats panel suggests one place per stat (v0.7 step 3): the cheapest action the
 * player can afford that raises it, the bigger gain breaking ties. Story-locked actions are skipped.
 */
export function statTips(places: readonly Place[], cash: number): Record<StatKey, StatTip | null> {
  const gainOf = (stat: StatKey, a: Place["actions"][number]) =>
    stat === "energy" ? -a.energy : stat === "mood" ? a.mood ?? 0 : a.confidence ?? 0;
  const pick = (stat: StatKey): StatTip | null => {
    let best: StatTip | null = null;
    for (const p of places) {
      for (const a of p.actions) {
        const gain = gainOf(stat, a);
        const price = a.price ?? 0;
        if (a.storyUnlock || gain <= 0 || price > cash) continue;
        if (!best || price < best.price || (price === best.price && gain > best.gain)) {
          best = { stat, placeId: p.id, placeName: p.name, emoji: p.emoji, price, gain };
        }
      }
    }
    return best;
  };
  return { energy: pick("energy"), mood: pick("mood"), confidence: pick("confidence") };
}
