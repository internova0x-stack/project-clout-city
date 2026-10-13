// Week files committed to content/hunts and content/news (by the weekly drafting routine or by
// hand), for the Studio calendar's one-tap load. Server only: hunt files carry the answers, so
// only the Studio's admin-checked actions call this. next.config.ts ships the files with /studio.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { ContentDraft } from "./studio";

export async function readContentDrafts(): Promise<ContentDraft[]> {
  const out: ContentDraft[] = [];
  for (const kind of ["hunt", "news"] as const) {
    const dir = path.join(process.cwd(), "content", kind === "hunt" ? "hunts" : "news");
    const files = (await readdir(dir).catch(() => [] as string[])).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f));
    for (const file of files) {
      const json = await readFile(path.join(dir, file), "utf8");
      let label = "Unreadable file";
      try {
        const d = JSON.parse(json) as { theme?: string; items?: unknown[] };
        label = kind === "hunt" ? d.theme ?? "A hunt" : `${d.items?.length ?? 0} news items`;
      } catch { /* the Studio's checks will say what's wrong on load */ }
      out.push({ kind, week: file.slice(0, 10), file: `content/${kind === "hunt" ? "hunts" : "news"}/${file}`, json, label });
    }
  }
  return out.sort((a, b) => a.week.localeCompare(b.week) || a.kind.localeCompare(b.kind));
}
