// Where to land after an email link or Google (owner, Oct 15: a Studio sign-in link opened the game).
// Supabase drops a redirect it doesn't recognize and falls back to the Site URL, and the code
// email's link (/auth/confirm) carries no "next" at all. So the Studio also leaves this short-lived
// cookie, and the auth routes read it. The Studio and the creator page (/creator, migration 0089) are the known
// destinations; everything else is the game.

export const AFTER_SIGNIN_COOKIE = "cc_after_signin";
export const AFTER_SIGNIN_MAX_AGE = 60 * 60;

const DESTINATIONS = ["/studio", "/creator"] as const;

export function afterSignIn(next: string | null | undefined, cookie: string | null | undefined): string {
  for (const dest of DESTINATIONS) if (next === dest || cookie === dest) return dest;
  return "/create";
}
