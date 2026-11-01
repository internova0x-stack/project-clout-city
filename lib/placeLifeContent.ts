// Living places' content with its odds (content/places/life.json). Imported only by the server (app/home/placeLifeActions.ts)
// and the preview's memory (lib/placeLifeSim.ts): players get `lifeView`, never the outcomes.
import LIFE_FILE from "../content/places/life.json";
import type { LifeContent } from "./placeLife.ts";

export const LIFE_CONTENT = LIFE_FILE as unknown as LifeContent;
