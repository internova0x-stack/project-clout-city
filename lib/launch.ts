// The launch screen's words and timing (components/LaunchScreen.tsx). Safe to import anywhere.

/** Satirical one-liners while the city loads. They never promise a feature. */
export const LAUNCH_LINES = [
  "Hailing a cab that isn't coming…",
  "Polishing the Unisphere…",
  "Convincing the bouncer you're on the list…",
  "Waiting for the N train. Still.",
  "Breaking up Two Bros over the last slice…",
  "Finding parking in Astoria…",
  "Charging your clout…",
  "Telling Queens you've arrived…",
] as const;

/** Pick the line for this launch (changes every launch, not every second). */
export const launchLine = (seed: number) => LAUNCH_LINES[Math.abs(Math.floor(seed)) % LAUNCH_LINES.length];
