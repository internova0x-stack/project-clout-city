// What people say (content/dialogue/dialogue.json; lib/dialogue.ts picks). No secrets in it, so the game's bundle carries it.
import DIALOGUE_FILE from "../content/dialogue/dialogue.json";
import type { DialogueFile } from "./dialogue";

export const DIALOGUE = DIALOGUE_FILE as unknown as DialogueFile;
