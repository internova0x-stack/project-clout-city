// Streak milestones (owner, Nov 3: "add the confetti for milestones"): the days a streak earns a confetti moment, both when it
// is reached (the streak reveal) and in the next day's welcome back. Pure.

/** 3, then every full week to 35 (the weekly rewards), then round numbers: 50, 75, 100, 150, 200, 250, 300, 365, then every 100. */
export function isStreakMilestone(day: number): boolean {
  if (!Number.isInteger(day) || day < 3) return false;
  if (day === 3 || (day % 7 === 0 && day <= 35)) return true;
  if ([30, 50, 75, 100, 150, 200, 250, 300, 365].includes(day)) return true;
  return day > 365 && day % 100 === 0;
}

/** A milestone's name for the badge ("1 month", "100 days", "1 year"). */
export function milestoneName(day: number): string {
  if (day === 365) return "1 year";
  if (day === 30) return "1 month";
  if (day % 7 === 0 && day <= 35) return `${day / 7} ${day === 7 ? "week" : "weeks"}`;
  return `${day} days`;
}

/** Big milestones get the big burst. */
export function milestoneSize(day: number): "small" | "big" {
  return day >= 30 && (day % 7 !== 0 || day > 35) ? "big" : "small";
}
