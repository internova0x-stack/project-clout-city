// Your Scene's moves (content/scene/moves.json; lib/scene.ts). Imported by the server (app/home/sceneActions.ts) and the
// preview's memory (lib/sceneSim.ts). Nothing secret is in it, but players get views from the server, which applies the
// `when` rules against their memory.
import MOVES_FILE from "../content/scene/moves.json";
import HATERS_FILE from "../content/scene/haters.json";
import type { Hater, SceneMove } from "./scene.ts";

export const SCENE_MOVES = (MOVES_FILE as unknown as { moves: SceneMove[] }).moves;
export const sceneMove = (id: string) => SCENE_MOVES.find((m) => m.id === id);
export const SCENE_HATERS = (HATERS_FILE as unknown as { haters: Hater[] }).haters;
