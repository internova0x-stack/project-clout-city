// Aspirations (owner, Oct 31: "Let careers be the entry point to choosing archetypes"; the Jobs and Careers spec's
// archetypes, sections 1A and 2.2, with the owner's additions). The Careers app opens with a welcome screen ("What's your
// aspiration?"); the pick is the player's life path, separate from the creator's looks and traits. Four lead to a career
// today, one to campaigns, one to the fame path and one to home life. Changeable once every 30 days (migration 0143).
//
// Pure: the careers engine, the server, the preview and the Careers app read it.

import type { TrackId } from "./careers.ts";

export type AspirationId = "corporate" | "influencer" | "streamer" | "celebrity" | "hustler" | "public" | "home";

export interface Aspiration {
  id: AspirationId;
  emoji: string;
  name: string;
  tagline: string;
  /** Careers that start one level higher (if the player meets that level's skills). */
  tracks: TrackId[];
  /** Careers coming later, shown as "coming soon" on the card. */
  later: string[];
  /** What the aspiration gives, in plain words for the card. */
  perks: string[];
}

export const ASPIRATIONS: Aspiration[] = [
  {
    id: "corporate", emoji: "💼", name: "Corporate Bro / Corporate Girlie",
    tagline: "Lanyard on, calendar full, three meetings about the meeting.",
    tracks: ["tech"], later: ["Finance", "Law"],
    perks: ["Tech jobs start one level higher"],
  },
  {
    id: "influencer", emoji: "🤳", name: "Budding Influencer",
    tagline: "312 followers and a ring light. The algorithm just hasn't met you yet.",
    tracks: ["media"], later: ["Fashion"],
    perks: ["Media jobs start one level higher"],
  },
  {
    id: "streamer", emoji: "🎮", name: "Streamer",
    tagline: "Chat is your family. Chat is also why you haven't slept.",
    tracks: ["media"], later: ["Streaming"],
    perks: ["Media jobs start one level higher", "Screen time pays half again in clout"],
  },
  {
    id: "celebrity", emoji: "🌟", name: "Future Celebrity",
    tagline: "No 9-to-5. Just parties, red ropes and the right people seeing you.",
    tracks: ["media"], later: [],
    perks: ["Climb choices come up twice as often", "Media jobs start one level higher"],
  },
  {
    id: "hustler", emoji: "💸", name: "Hustler",
    tagline: "Three side hustles and a fourth that's 'in development.'",
    tracks: ["hospitality"], later: ["Real Estate"],
    perks: ["Hospitality jobs start one level higher"],
  },
  {
    id: "public", emoji: "🏛️", name: "Public Servant",
    tagline: "You want to fix the city. Or at least get your name on a plaque.",
    tracks: ["cityhall"], later: [],
    perks: ["City Hall jobs start one level higher", "Campaigns you manage start 3 points up across the city"],
  },
  {
    id: "home", emoji: "🏡", name: "Stay-at-home Spouse",
    tagline: "Home CEO. The house is the brand, the brunch is the content.",
    tracks: [], later: [],
    perks: ["Having people over pays a quarter more clout", "Works best with a partner (date someone in the game)"],
  },
];

export const ASPIRE = {
  /** A new pick at most every this many days (owner, Oct 31). */
  changeDays: 30,
  /** Degrees (owner, Oct 31: passed exams count until Campus Life has a graduation): 3 exams passed at C or better. */
  degreeExams: 3,
  /** Head starts: one level for the aspiration's careers, one for a degree, never above this level. */
  headStartMax: 3,
  streamerScreen: 1.5,
  celebrityClimb: 2,
  publicCampaign: 3,
  homeHosting: 1.25,
} as const;

export const aspirationById = (id: string | null | undefined): Aspiration | undefined => ASPIRATIONS.find((a) => a.id === id);

/** The name the player sees. */
export const aspirationName = (id: AspirationId): string => aspirationById(id)!.name;

/** Extra starting levels for a career: the aspiration's own, and a degree. */
export function headStart(track: TrackId, a: { aspiration?: AspirationId | null; degree?: boolean }): number {
  return (a.aspiration && aspirationById(a.aspiration)?.tracks.includes(track) ? 1 : 0) + (a.degree ? 1 : 0);
}

/** When the player may pick again (null: now). */
export function changeOn(chosenAt: string | null | undefined, today: string): string | null {
  if (!chosenAt) return null;
  const d = new Date(`${chosenAt.slice(0, 10)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + ASPIRE.changeDays);
  const on = d.toISOString().slice(0, 10);
  return on > today ? on : null;
}

/** What the server returns (aspiration_state). */
export interface AspirationState { aspiration: AspirationId | null; chosenAt: string | null; degree: boolean; exams: number }
