// Meeting players (owner, Oct 15; migration 0047): real players at the same place see each other in
// the room and on the place card, react for free, break the ice with a suggested line, and send up to
// 20 messages a day. Unlimited chat is monthly or forever (Stripe); when a membership ends the limit
// comes back. Dependency-free so tests can import it.

/** Someone at the same place now (place_presence). */
export interface HerePerson { id: string; name: string; style: string; look: unknown; crew: boolean; floor: number; clout: number; netWorth?: number }
export interface Presence { count: number; people: HerePerson[] }
/** place_counts: players at each place now, and the first three (crew first). */
export type PlaceCounts = Record<string, { count: number; names: { name: string; style: string }[] }>;

/** The free reactions (game_settings chat.reactions). */
export const REACTIONS = ["👋", "🔥", "😂", "💅", "🥂"] as const;
/** Daily messages without unlimited chat (game_settings chat.dailyLimit). */
export const DAILY_MESSAGES = 20;
/** How often the room asks who's here, and the map how many are where (ms). */
export const PRESENCE_POLL_MS = 10_000;
export const COUNTS_POLL_MS = 60_000;

/** Unlimited chat's two plans (store_products, prices from the catalog). */
export const CHAT_PASS = { monthly: "chat-unlimited-monthly", forever: "chat-unlimited-forever" } as const;
export const CHAT_PASS_PERKS = [
  { emoji: "💬", text: "Message anyone, as much as you like" },
  { emoji: "🧊", text: "Icebreakers never run out" },
  { emoji: "📌", text: "Keep chatting after you leave the place" },
];

const PLACE_LINES = [
  "First time at {place}, or are you a regular?",
  "Okay, who picked {place} tonight? Good call.",
  "What's good here at {place}? I need a recommendation.",
];
const TIME_LINES: Record<"morning" | "day" | "night", string[]> = {
  morning: ["Up early or haven't slept yet? No judgment.", "Coffee first, then networking. What's your order?"],
  day: ["Hiding from work too, or is this work?", "Perfect afternoon to be seen. Agree?"],
  night: ["That DJ is either a genius or completely lost.", "Big night or just getting started?"],
};
const STYLE_LINES = [
  "Your fit is doing a lot of work. Respect.",
  "Okay, where did you get that look? Asking for me.",
  "You look like you know everyone here. Do you?",
];

/** The city-clock part of the day, for icebreakers. */
export function partOfDay(hour: number): "morning" | "day" | "night" {
  return hour >= 5 && hour < 11 ? "morning" : hour >= 11 && hour < 18 ? "day" : "night";
}

/**
 * Three suggested openers: one about the place, one about the time, one about their look. `seed`
 * turns them so two players don't always get the same lines. Positive by design.
 */
export function icebreakers(placeName: string | null, hour: number, seed = 0): string[] {
  const pick = <T,>(list: readonly T[], n: number) => list[Math.abs(n) % list.length];
  const out = [
    placeName ? pick(PLACE_LINES, seed).replace("{place}", placeName) : "Fancy seeing you here.",
    pick(TIME_LINES[partOfDay(hour)], seed >> 1),
    pick(STYLE_LINES, seed >> 2),
  ];
  return out.filter((x, i) => out.indexOf(x) === i);
}

/** "Tasha", "Tasha and Dev", "Tasha, Dev and Kai" (and "+2 more"). */
export function hereLine(names: string[], count: number): string {
  const shown = names.slice(0, 3);
  const more = count - shown.length;
  const list = shown.length <= 1 ? shown.join("") : `${shown.slice(0, -1).join(", ")} and ${shown.at(-1)}`;
  return more > 0 ? `${list} +${more} more` : list;
}

/** Crowded places (owner, Oct 15): how often one of the people taking turns walks out and another walks in. */
export const ROTATE_MS = 45_000;

/**
 * Who stands in the room when more players are here than it holds (lib/rooms.ts playerSlots): the
 * people you just opened (most recent first), then crew, then everyone else taking turns. The turn
 * window moves one place each `turn`, so one walks out and one walks in; the rest go in a fixed order
 * (by id, crew too) so the room doesn't reshuffle every time the list is refreshed. Everyone not picked is
 * still in the Here now list.
 */
export function pickInView(people: { id: string; crew: boolean }[], slots: number, pinned: string[] = [], turn = 0): string[] {
  if (slots <= 0) return [];
  const here = new Set(people.map((p) => p.id));
  const out: string[] = [];
  for (const id of pinned) if (here.has(id) && !out.includes(id) && out.length < slots) out.push(id);
  for (const id of people.filter((p) => p.crew).map((p) => p.id).sort()) if (!out.includes(id) && out.length < slots) out.push(id);
  const rest = people.map((p) => p.id).filter((id) => !out.includes(id)).sort();
  const room = slots - out.length;
  if (rest.length <= room) return [...out, ...rest];
  const start = ((turn % rest.length) + rest.length) % rest.length;
  for (let i = 0; i < room; i++) out.push(rest[(start + i) % rest.length]);
  return out;
}

/** "50 players here · 6 in the room" (the true count, which can be more than the list holds). */
export function hereCountLine(count: number, inView: number): string {
  const who = `${count.toLocaleString("en-US")} ${count === 1 ? "player" : "players"}`;
  return count > inView ? `${who} · ${inView} in the room` : who;
}
