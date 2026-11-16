import { isStyleId, type StyleId } from "./styles.ts";
import { normalizeLook, type Look } from "./look.ts";

/**
 * The look a guest picked on the map's "Who's going?" sheet (owner, Nov 16, option A: going anywhere needs an account)
 * waits on the device for the creator, whose Look step opens on it. Local storage, since the sign-in link may open in a
 * new tab; read once, then forgotten.
 */
export const GUEST_LOOK_KEY = "cc-guest-look";

export function keepGuestLook(look: Look) {
  try { localStorage.setItem(GUEST_LOOK_KEY, JSON.stringify(look)); } catch { /* private mode */ }
}

/** The guest's look (cleaned like a stored one), once, or null. */
export function takeGuestLook(): Look | null {
  try {
    const raw = localStorage.getItem(GUEST_LOOK_KEY);
    if (!raw) return null;
    localStorage.removeItem(GUEST_LOOK_KEY);
    const r = JSON.parse(raw) as { style?: unknown };
    return isStyleId(r?.style) ? normalizeLook(r, r.style as StyleId) : null;
  } catch { return null; }
}
