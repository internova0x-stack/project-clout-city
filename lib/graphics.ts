// Low-graphics mode and the new-bodies preview (step 2 of the avatar upgrade; owner, Oct 21: "there should be a way to
// render lower graphics for lower end phones"). Both are per device, kept in localStorage; a URL parameter can set
// them for one visit (?graphics=low|high, ?bodies=new|old). Low graphics is on by itself on weak phones until the
// player chooses. The new bodies are on for everyone since stage 4's switch-on (migration 0101: every owned item has
// its template); a device can still go back to the old ones for a while (Studio → Shop, or ?bodies=old).

const KEY_LOW = "cc-graphics-low";
const KEY_BODIES = "cc-new-bodies";
/** Speed on cheap phones (owner, Nov 1): set by the map when its frames come too slowly (`frameWatch`). */
const KEY_AUTO = "cc-graphics-auto";

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
  return read(KEY_AUTO) === "1" || weakDevice();
}
export function setLowGraphics(on: boolean) { write(KEY_LOW, on ? "1" : "0"); }
/** The phone struggled with full graphics: low graphics from now on, unless the player chose (Settings wins). */
export function setAutoLowGraphics() { write(KEY_AUTO, "1"); }

/**
 * Watches the time between animation frames and says once whether this phone is too slow for full graphics: after a
 * settling time, the middle of `samples` frames slower than `slowMs` (about 22 frames a second). Gaps over a second
 * (the tab hidden, a pause) don't count. Returns "slow" once, "ok" once it has seen enough fast frames, else null.
 */
export function frameWatch(opts: { settleMs?: number; samples?: number; slowMs?: number } = {}) {
  const { settleMs = 4000, samples = 90, slowMs = 45 } = opts;
  let first = -1, last = -1, done = false;
  const gaps: number[] = [];
  return (now: number): "slow" | "ok" | null => {
    if (done) return null;
    if (first < 0) first = now;
    const gap = last < 0 ? 0 : now - last;
    last = now;
    if (now - first < settleMs || gap <= 0 || gap > 1000) return null;
    gaps.push(gap);
    if (gaps.length < samples) return null;
    done = true;
    const mid = [...gaps].sort((a, b) => a - b)[Math.floor(gaps.length / 2)];
    return mid > slowMs ? "slow" : "ok";
  };
}

/** The new base bodies: on, unless this device chose the old ones. */
export function newBodies(): boolean {
  const p = param("bodies");
  if (p === "new" || p === "old") return p === "new";
  return read(KEY_BODIES) !== "0";
}
export function setNewBodies(on: boolean) { write(KEY_BODIES, on ? null : "0"); }

/** The renderer settings for the current mode: pixel ratio cap, shadows and antialiasing. */
export function renderQuality(): { pixelRatio: number; shadows: boolean; antialias: boolean } {
  const low = lowGraphics();
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  return low ? { pixelRatio: Math.min(dpr, 1), shadows: false, antialias: false } : { pixelRatio: Math.min(dpr, 1.75), shadows: true, antialias: true };
}
