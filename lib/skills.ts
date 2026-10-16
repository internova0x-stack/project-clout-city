// Skills (owner, Oct 16; after a reference game's Skills tab): nine skills from 0 to 10, trained by
// doing things around the city. Each counted activity is 1 practice; a level needs the practice
// below. Skills you don't use for a week slowly get rusty. Safe to import anywhere.

export type SkillId = "cooking" | "charisma" | "fitness" | "smarts" | "music" | "hustle" | "dance" | "gossip" | "photography";

export interface SkillDef { id: SkillId; emoji: string; name: string; how: string }

export const SKILLS: readonly SkillDef[] = [
  { id: "cooking", emoji: "🍳", name: "Cooking", how: "Cook at home" },
  { id: "charisma", emoji: "😎", name: "Charisma", how: "Chat, react, date, plan with your crew" },
  { id: "fitness", emoji: "💪", name: "Fitness", how: "Gyms, parks, walking places" },
  { id: "smarts", emoji: "📚", name: "Smarts", how: "Study at the library or on campus" },
  { id: "music", emoji: "🎸", name: "Music", how: "Open mics, lounge sets, live nights" },
  { id: "hustle", emoji: "💼", name: "Hustle", how: "Shifts, gigs, jobs, your businesses" },
  { id: "dance", emoji: "💃", name: "Dance", how: "Club nights and dance floors" },
  { id: "gossip", emoji: "🍵", name: "Gossip", how: "Listen in, find tea" },
  { id: "photography", emoji: "📸", name: "Photography", how: "Monuments, rooftops, postcards" },
];

export const MAX_LEVEL = 10;
/** Total practice needed for each level (index = level). */
export const LEVEL_AT = [0, 3, 8, 15, 25, 40, 60, 85, 115, 150, 200] as const;

/** Rust (as in the reference): after 7 days without practice, about a level every 20 days, never more than 2 under your best. */
export const RUST = { afterDays: 7, daysPerLevel: 20, maxBelowBest: 2 } as const;

export function levelFor(practice: number): number {
  let l = 0;
  while (l < MAX_LEVEL && practice >= LEVEL_AT[l + 1]) l++;
  return l;
}

/** How far into the current level, 0 to 1 (1 at the top level). */
export function levelProgress(practice: number): number {
  const l = levelFor(practice);
  if (l >= MAX_LEVEL) return 1;
  return (practice - LEVEL_AT[l]) / (LEVEL_AT[l + 1] - LEVEL_AT[l]);
}

export interface SkillState { id: SkillId; level: number; best: number; practice: number; rusty: boolean }

export const RUST_LINE = `Skills you don't use for ${RUST.afterDays} days slowly get rusty (about a level every ${RUST.daysPerLevel} days), never more than ${RUST.maxBelowBest} levels under your best. Using a skill stops it.`;
