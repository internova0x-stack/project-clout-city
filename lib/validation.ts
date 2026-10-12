// Shared input rules for the creator. Mirrors the database constraints.

import { GAME_CONFIG } from "./config.ts";

const NAME_CHARS = /^[A-Za-z0-9 ._'-]+$/;

export function cleanName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

/** Returns an error message for the player, or null when the name is fine. */
export function nameError(raw: string): string | null {
  const name = cleanName(raw);
  const { nameMinLength, nameMaxLength } = GAME_CONFIG.profile;
  if (name.length === 0) return "The city needs something to call you.";
  if (name.length < nameMinLength) return `At least ${nameMinLength} characters. Even Cher has four.`;
  if (name.length > nameMaxLength) return `${nameMaxLength} characters max. Save the rest for your bio.`;
  if (!NAME_CHARS.test(name)) return "Letters, numbers, spaces and . _ ' - only.";
  return null;
}
