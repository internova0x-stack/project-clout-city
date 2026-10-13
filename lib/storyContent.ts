// Reads story content (content/stories/*.json) on the server or in scripts only.
// Never import this from client code: arcs carry answer keys and correct answers.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Arc } from "./stories.ts";

export const STORY_DIR = join(process.cwd(), "content", "stories");

export function loadArcs(dir = STORY_DIR): Arc[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")) as Arc);
}

export function loadGenericChatter(dir = join(process.cwd(), "content")): Record<string, string[]> {
  return JSON.parse(readFileSync(join(dir, "chatter-generic.json"), "utf8"));
}
