// Invite codes: 6 characters from an alphabet without look-alikes (no 0/O, 1/I/L).
// The database generates codes with the same alphabet (supabase/migrations).

export const INVITE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const INVITE_CODE_LENGTH = 6;

/** Normalizes user-typed or URL codes. Returns null when the code can't be valid. */
export function normalizeInviteCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const code = raw.trim().toUpperCase();
  if (code.length !== INVITE_CODE_LENGTH) return null;
  for (const ch of code) {
    if (!INVITE_ALPHABET.includes(ch)) return null;
  }
  return code;
}

/** The invite link; from a place ("Bring the crew", "Make it a date"), it opens that place (owner, Oct 15). */
export function inviteUrl(origin: string, code: string, placeId?: string | null): string {
  const base = `${origin.replace(/\/+$/, "")}/i/${code}`;
  return placeId ? `${base}?at=${encodeURIComponent(placeId)}` : base;
}

/** "2 of 5" progress toward the clique bonus, capped at the bonus size. */
export function cliqueProgress(count: number, bonusSize: number) {
  const joined = Math.max(0, Math.floor(count));
  return {
    joined,
    shown: Math.min(joined, bonusSize),
    ratio: Math.min(1, joined / bonusSize),
    complete: joined >= bonusSize,
  };
}
