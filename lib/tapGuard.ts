// Tap-through guard (owner, Nov 1: leaving a place opened Invite your Crew; closing the phone opened the Bank). When a layer
// closes (a sheet, the phone, a room's Map button), what was under the finger is revealed at once, and the second tap of a
// quick double tap, or a slow phone's late click, lands on it. For a moment after a close, clicks are swallowed.

const GUARD_MS = 600;
let until = 0;
let since = 0;
let installed = false;

/** Call when a layer closes: clicks in the next ~half second don't reach what's underneath. */
export function guardTaps(ms = GUARD_MS): void {
  if (now() >= until) since = now();
  until = Math.max(until, now() + ms);
  // Again after the next frame: a heavy screen (the map) may take a while to appear, and the guard runs from then.
  if (typeof requestAnimationFrame !== "undefined") requestAnimationFrame(() => requestAnimationFrame(() => { until = Math.max(until, now() + ms); }));
}

const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

/** True while a click would go through to what a closed layer revealed. */
export function tapsGuarded(at = now()): boolean {
  return at >= since && at < until;
}

/** Installs the one document-level listener (capture phase, before any React handler). Safe to call more than once. */
export function installTapGuard(): void {
  if (installed || typeof document === "undefined") return;
  installed = true;
  // Owner, Nov 3 (it still happened): drawing the map can hold the main thread for over a second, so a second tap's click
  // is handled late. Judge it by when the finger touched (the event's timeStamp, the same clock as performance.now), and
  // the window starts once the revealed screen has drawn (guardTaps re-arms on the next frame).
  document.addEventListener("click", (e) => {
    const at = e.timeStamp > 0 && e.timeStamp <= now() ? e.timeStamp : now();
    if (!tapsGuarded(at)) return;
    e.stopPropagation();
    e.preventDefault();
  }, true);
}
