// The underworld's job file (content/underworld/jobs.json), for the server's actions and the preview's memory. Import it
// only there: the file holds every job's odds, so a player's bundle never carries them.

import CONTENT from "../content/underworld/jobs.json";
import type { UnderworldContent } from "./underworld";

export const UNDERWORLD_CONTENT = CONTENT as unknown as UnderworldContent;
