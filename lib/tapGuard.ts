// Tap-through guard (owner, Nov 1: leaving a place opened Invite your Crew; closing the phone opened the Bank). When a layer
// closes (a sheet, the phone, a room's Map button), what was under the finger is revealed at once, and the second tap of a
// quick double tap, or a slow phone's late click, lands on it. For a moment after a close, clicks are swallowed.

const GUARD_MS = 450;
let until = 0;
let installed = false;

/** Call when a layer closes: clicks in the next ~half second don't reach what's underneath. */
export function guardTaps(ms = GUARD_MS): void {
  until = Math.max(until, now() + ms);
}

const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

/** True while a click would go through to what a closed layer revealed. */
export function tapsGuarded(at = now()): boolean {
  return at < until;
}

/** Installs the one document-level listener (capture phase, before any React handler). Safe to call more than once. */
export function installTapGuard(): void {
  if (installed || typeof document === "undefined") return;
  installed = true;
  document.addEventListener("click", (e) => {
    if (!tapsGuarded()) return;
    e.stopPropagation();
    e.preventDefault();
  }, true);
}
