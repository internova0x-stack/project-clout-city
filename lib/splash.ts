// The launch splash waits for the first screen (owner, Nov 1: "the splash screen isn't staying for the duration"):
// the screen behind it (the welcome screen's home, the guest map) says when it has drawn, and SplashHold keeps the
// splash up until then (with a cap). Safe to call from anywhere: only the first call counts, and nothing listens
// outside `/`'s launch.
const EVENT = "cc-screen-ready";
let ready = false;

export function screenReady(): void {
  if (ready || typeof window === "undefined") return;
  ready = true;
  window.dispatchEvent(new Event(EVENT));
}

/** Calls `cb` once the first screen has drawn (at once if it already has). Returns a cleanup. */
export function whenScreenReady(cb: () => void): () => void {
  if (ready) { cb(); return () => {}; }
  const on = () => cb();
  window.addEventListener(EVENT, on, { once: true });
  return () => window.removeEventListener(EVENT, on);
}
