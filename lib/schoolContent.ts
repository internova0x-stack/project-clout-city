// The Homecoming race's content (content/school/race.json), for the server's actions and the preview's in-memory race.
// Import it only there: the file holds every card's hidden odds and later consequences, so a player's bundle never carries them.

import CONTENT from "../content/school/race.json";
import type { RaceContent } from "./schoolRace";

export const RACE_CONTENT = CONTENT as unknown as RaceContent;
