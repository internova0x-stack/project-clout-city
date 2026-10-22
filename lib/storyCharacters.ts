import { loadArcs } from "./storyContent.ts";
import type { Arc } from "./stories.ts";
import type { StoryFeed } from "./storyFeed.ts";

// Story characters (owner, Oct 22): avatar heads and bios at the end of each blog post. They come from the story files
// in content/stories on the server (arc `characters`, each post's `cast`), not from the stored story, so a story that's
// already in the Studio or live picks them up without a re-upload. A side story without its own list uses its main's.

let cache: Arc[] | null = null;
function arcs(): Arc[] {
  if (!cache) { try { cache = loadArcs(); } catch { cache = []; } }
  return cache;
}

export function withCharacters(feed: StoryFeed, files: Arc[] = arcs()): StoryFeed {
  const byId = new Map(files.map((a) => [a.id, a]));
  return {
    ...feed,
    arcs: feed.arcs.map((arc) => {
      const file = byId.get(arc.id);
      const characters = arc.characters ?? file?.characters ?? (file?.parent_arc_id ? byId.get(file.parent_arc_id)?.characters : undefined);
      if (!file || !characters?.length) return arc;
      return {
        ...arc,
        characters,
        beats: arc.beats.map((b) => b.cast || b.locked ? b : { ...b, cast: file.beats.find((x) => x.id === b.id)?.news[0]?.cast }),
      };
    }),
  };
}
