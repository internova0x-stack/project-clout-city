// The Content Engine, step 5: one character registry (docs/CONTENT-ENGINE.md section 9; owner, Oct 31: "go ahead").
// Everyone the game has invented, in one list with a role and a place: the regulars at places (lib/cast.ts), the Mayor,
// the celebrity cast and the wannabes, the bosses and coworkers of the three careers (lib/careers.ts) and Sir Barksley.
// What each one remembers about a player lives in content/characters/remembers.json (lib/characterMemory.ts): lines
// with conditions over the player's memory (migration 0138), like storylets, so the deli owner knows you got banned from
// the club and the bartender knows you just went official.
//
// Pure and safe to import anywhere: names, roles and places only.

import { CELEBRITIES, OFFICIALS, REGULARS, WANNABES } from "./cast.ts";
import { TRACKS } from "./careers.ts";
import { BARKSLEY } from "./barksley.ts";

export type CharacterKind = "regular" | "official" | "celebrity" | "wannabe" | "boss" | "coworker" | "pet";

export interface Character {
  id: string;
  name: string;
  kind: CharacterKind;
  emoji: string;
  /** Where they're found, if anywhere. */
  place?: string;
  /** "the owner", "Pivotly · your rival": shown after the name. */
  title: string;
}

/** A career person's id: "<track>-manager", "<track>-friend", "<track>-rival". */
export const careerPersonId = (track: string, who: "manager" | "friend" | "rival") => `${track}-${who}`;

export const CHARACTERS: Character[] = [
  ...REGULARS.map((r): Character => ({ id: r.id, name: r.name, kind: "regular", emoji: r.emoji, place: r.placeId, title: r.title })),
  ...OFFICIALS.map((o): Character => ({ id: o.id, name: o.name, kind: "official", emoji: "🏛️", title: o.title })),
  ...CELEBRITIES.map((c): Character => ({ id: c.id, name: c.name, kind: "celebrity", emoji: "⭐", title: c.type })),
  ...WANNABES.map((w): Character => ({ id: w.id, name: w.name, kind: "wannabe", emoji: "🤳", title: "wannabe" })),
  ...TRACKS.flatMap((t): Character[] => [
    { id: careerPersonId(t.id, "manager"), name: t.manager.name, kind: "boss", emoji: t.manager.emoji, place: t.place, title: `${t.employer} · the boss` },
    { id: careerPersonId(t.id, "friend"), name: t.friend.name, kind: "coworker", emoji: t.friend.emoji, place: t.place, title: `${t.employer} · work friend` },
    { id: careerPersonId(t.id, "rival"), name: t.rival.name, kind: "coworker", emoji: t.rival.emoji, place: t.place, title: `${t.employer} · rival` },
  ]),
  { id: "sir-barksley", name: BARKSLEY.name, kind: "pet", emoji: "🐕", place: BARKSLEY.placeId, title: "a billionaire's Pomeranian" },
];

export const characterById = (id: string): Character | undefined => CHARACTERS.find((c) => c.id === id);
export const charactersAt = (placeId: string): Character[] => CHARACTERS.filter((c) => c.place === placeId);
