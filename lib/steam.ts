// Steam (owner, Oct 30; docs/STEAM.md). The Steam app (desktop/) gets a Web API auth ticket from the Steam client for
// STEAM_IDENTITY; the server checks it with Steam's ISteamUserAuth/AuthenticateUserTicket using the publisher Web API
// key and learns who the player is. Pure helpers plus that one call (fetch is injected so tests run without Steam).
// Server only: the key is never sent to a browser.

/** The identity string the app's ticket is made for; the server checks the same one. */
export const STEAM_IDENTITY = "cloutcity";

const PARTNER_API = "https://partner.steam-api.com";

export interface SteamConfig { appId: string; key: string }

/** The App ID and publisher Web API key from the environment, or null when Steam isn't set up yet. */
export function steamConfig(env: Record<string, string | undefined> = process.env): SteamConfig | null {
  const appId = env.STEAM_APP_ID?.trim() ?? "";
  const key = env.STEAM_WEB_API_KEY?.trim() ?? "";
  return /^[0-9]+$/.test(appId) && key ? { appId, key } : null;
}

/** A ticket as the app sends it: hex, of a sane length. */
export function validTicket(t: unknown): t is string {
  return typeof t === "string" && t.length >= 32 && t.length <= 4096 && t.length % 2 === 0 && /^[0-9a-fA-F]+$/.test(t);
}

/** A 64-bit Steam id as 17 digits. */
export const validSteamId = (s: unknown): s is string => typeof s === "string" && /^[0-9]{17}$/.test(s);

export type SteamCheck = { ok: true; steamId: string } | { ok: false; error: "not_set_up" | "bad_ticket" | "banned" | "steam_down" };

type Fetch = (url: string) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

/**
 * Checks a ticket with Steam. A ticket is good when Steam says OK for our app; a publisher ban refuses the player.
 * Family-shared copies (owner differs from player) sign in as the player.
 */
export async function verifySteamTicket(ticket: string, cfg: SteamConfig | null, fetchImpl: Fetch = fetch as unknown as Fetch): Promise<SteamCheck> {
  if (!cfg) return { ok: false, error: "not_set_up" };
  if (!validTicket(ticket)) return { ok: false, error: "bad_ticket" };
  const url = `${PARTNER_API}/ISteamUserAuth/AuthenticateUserTicket/v1/?key=${encodeURIComponent(cfg.key)}&appid=${cfg.appId}&ticket=${ticket}&identity=${STEAM_IDENTITY}`;
  let body: unknown;
  try {
    const res = await fetchImpl(url);
    if (!res.ok) return { ok: false, error: res.status >= 500 ? "steam_down" : "bad_ticket" };
    body = await res.json();
  } catch {
    return { ok: false, error: "steam_down" };
  }
  const p = (body as { response?: { params?: { result?: string; steamid?: string; publisherbanned?: boolean } } })?.response?.params;
  if (!p || p.result !== "OK" || !validSteamId(p.steamid)) return { ok: false, error: "bad_ticket" };
  if (p.publisherbanned) return { ok: false, error: "banned" };
  return { ok: true, steamId: p.steamid };
}

/** The address a Steam-made account is stored under (never mailed: Supabase needs one). */
export const steamEmail = (steamId: string) => `steam-${steamId}@users.cloutcity.app`;

/** What the player sees when Steam sign-in fails. */
export function steamError(code: string | undefined): string {
  switch (code) {
    case "not_set_up": return "Steam sign-in isn't switched on yet.";
    case "banned": return "This Steam account can't play Clout City.";
    case "steam_down": return "Steam isn't answering. Try again in a minute.";
    case "steam_taken": return "This Steam account is already linked to another Clout City account.";
    default: return "Steam sign-in didn't work. Restart the game and try again.";
  }
}
