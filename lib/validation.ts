// Shared input rules for the creator. Mirrors the database constraints.

import { GAME_CONFIG } from "./config.ts";

// Usernames are @handles: letters, numbers, _ and . only. Names claimed before usernames
// (which may have spaces) stay valid in the database; only new ones follow this rule.
const USERNAME = /^[A-Za-z0-9_.]+$/;

/** What the player typed, minus spaces at the ends and a leading @. */
export function cleanName(raw: string): string {
  return raw.trim().replace(/^@+/, "");
}

/** Returns an error message for the player, or null when the username is fine. */
export function nameError(raw: string): string | null {
  const name = cleanName(raw);
  const { nameMinLength, nameMaxLength } = GAME_CONFIG.profile;
  if (name.length === 0) return "The city needs something to call you.";
  if (/\s/.test(name)) return "No spaces in a username. Try big_sal or bigsal.";
  if (!USERNAME.test(name)) return "Letters, numbers, _ and . only.";
  if (name.length < nameMinLength) return `At least ${nameMinLength} characters. Even Cher has four.`;
  if (name.length > nameMaxLength) return `${nameMaxLength} characters max. Save the rest for your bio.`;
  return null;
}

/** How a player's name is shown: @bigsal for usernames; older names with spaces as they are. */
export function handle(name: string | null | undefined): string {
  if (!name) return "";
  return USERNAME.test(name) ? `@${name}` : name;
}
