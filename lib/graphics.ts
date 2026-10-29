// Low-graphics mode and the new-bodies preview (step 2 of the avatar upgrade; owner, Oct 21: "there should be a way to
// render lower graphics for lower end phones"). Both are per device, kept in localStorage; a URL parameter can set
// them for one visit (?graphics=low|high, ?bodies=new|old). Low graphics is on by itself on weak phones until the
// player chooses. The new bodies are on for everyone since stage 4's switch-on (migration 0101: every owned item has
// its template); a device can still go back to the old ones for a while (Studio → Shop, or ?bodies=old).

const KEY_LOW = "cc-graphics-low";
const KEY_BODIES = "cc-new-bodies";
const KEY_MAP = "cc-compact-map";

function read(key: string): string | null {
  try { return typeof localStorage === "undefined" ? null : localStorage.getItem(key); } catch { return null; }
}
function write(key: string, value: string | null) {
  try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch { /* private mode */ }
}
function param(name: string): string | null {
  if (typeof location === "undefined") return null;
  return new URLSearchParams(location.search).get(name);
}

/** A clearly weak phone: 2 GB of memory or less (Chrome reports it) or 2 cores or fewer. Kept strict on purpose:
 *  Safari reports 4 cores on fast iPhones, and anyone else can turn low graphics on in Settings. */
export function weakDevice(nav: { deviceMemory?: number; hardwareConcurrency?: number } | undefined = typeof navigator === "undefined" ? undefined : navigator as never): boolean {
  if (!nav) return false;
  return (nav.deviceMemory !== undefined && nav.deviceMemory <= 2) || (nav.hardwareConcurrency !== undefined && nav.hardwareConcurrency <= 2);
}

/** Is low-graphics mode on for this device? The player's choice wins; otherwise weak phones get it. */
export function lowGraphics(): boolean {
  const p = param("graphics");
  if (p === "low" || p === "high") return p === "low";
  const saved = read(KEY_LOW);
  if (saved !== null) return saved === "1";
  return weakDevice();
}
export function setLowGraphics(on: boolean) { write(KEY_LOW, on ? "1" : "0"); }

/** The new base bodies: on, unless this device chose the old ones. */
export function newBodies(): boolean {
  const p = param("bodies");
  if (p === "new" || p === "old") return p === "new";
  return read(KEY_BODIES) !== "0";
}
export function setNewBodies(on: boolean) { write(KEY_BODIES, on ? null : "0"); }

/**
 * The compact map (owner, Oct 29; lib/compactMap.ts): on for everyone (owner, Oct 29: "the map"). A device can go back to
 * the street map for a while with ?map=classic (kept), and return with ?map=compact.
 */
export function compactMap(): boolean {
  const p = param("map");
  if (p === "compact" || p === "classic") { write(KEY_MAP, p === "classic" ? "0" : null); return p === "compact"; }
  return read(KEY_MAP) !== "0";
}
export function setCompactMap(on: boolean) { write(KEY_MAP, on ? null : "0"); }

/** The renderer settings for the current mode: pixel ratio cap, shadows and antialiasing. */
export function renderQuality(): { pixelRatio: number; shadows: boolean; antialias: boolean } {
  const low = lowGraphics();
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  return low ? { pixelRatio: Math.min(dpr, 1), shadows: false, antialias: false } : { pixelRatio: Math.min(dpr, 1.75), shadows: true, antialias: true };
}
