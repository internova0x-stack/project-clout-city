// Careers' task file (content/careers/careers.json), for the server's actions and the preview's in-memory job. Import
// it only there: the file holds every task's outcomes, so a player's bundle never carries them.

import CONTENT from "../content/careers/careers.json";
import type { CareerContent } from "./careers";

export const CAREER_CONTENT = CONTENT as CareerContent;
