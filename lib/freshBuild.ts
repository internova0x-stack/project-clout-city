// Stale builds (owner, Oct 15: travel failed with "The city glitched" in the installed app but
// worked in the browser). An installed app can stay open for days; after a deploy its server
// actions no longer exist on the server. On resume it checks /api/version and reloads when the
// build changed, and an action that fails because the build changed reloads too. Player state is
// on the server, so a reload loses nothing.

export const BUILD = process.env.NEXT_PUBLIC_BUILD ?? "dev";

let reloading = false;
export function reloadForNewBuild() {
  if (reloading || typeof window === "undefined") return;
  reloading = true;
  window.location.reload();
}

/** A server action that failed because this page is an older (or newer) build than the server. */
export function isStaleBuild(e: unknown): boolean {
  const err = e as { name?: string; message?: string } | null;
  if (!err) return false;
  if (err.name === "UnrecognizedActionError" || err.name === "ChunkLoadError") return true;
  const m = String(err.message ?? "");
  return /Server Action .* was not found|Failed to find Server Action|Loading chunk .* failed|older or newer deployment/i.test(m);
}

/** Asks the server which build it runs; reloads when it isn't ours. */
export async function checkBuild(): Promise<void> {
  if (BUILD === "dev") return;
  try {
    const r = await fetch("/api/version", { cache: "no-store" });
    if (!r.ok) return;
    const { build } = (await r.json()) as { build?: string };
    if (build && build !== "dev" && build !== BUILD) reloadForNewBuild();
  } catch { /* offline: try again next time */ }
}
