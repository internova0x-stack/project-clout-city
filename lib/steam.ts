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

// ---------------------------------------------------------------------------------------------------------------
// Steam checkout (step 3; docs/STEAM.md). Inside a Steam game, real-money items are paid through Steam's own checkout
// (ISteamMicroTxn): the server starts an order (InitTxn), Steam shows the player its overlay, the app hears the answer
// and the server finalizes it (FinalizeTxn). Then the same payment_grant the Stripe webhook uses unlocks the item.
// ---------------------------------------------------------------------------------------------------------------

/** Steam's checkout endpoints; the sandbox charges nothing (STEAM_MICROTXN_SANDBOX=1). */
export const microTxnBase = (sandbox: boolean) => `${PARTNER_API}/${sandbox ? "ISteamMicroTxnSandbox" : "ISteamMicroTxn"}`;

/** A product's Steam item id: a stable 32-bit number from its sku (FNV-1a), never 0. */
export function steamItemId(sku: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < sku.length; i++) { h ^= sku.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h || 1;
}

/** A new order id: unique per checkout, a positive integer Steam takes as uint64 (kept within JavaScript's safe range). */
export function newOrderId(now = Date.now(), rand = Math.random): string {
  return String(now * 1000 + Math.floor(rand() * 1000));
}

/** The purchase row's session for a Steam order (purchases.stripe_session_id holds both kinds). */
export const steamSession = (orderId: string) => `steam:${orderId}`;

/**
 * The price in the player's Steam wallet currency, in cents. Prices are set in US dollars (store_products); other
 * wallets pay the dollar price times the rate in game_settings 'steam_store', rounded up to .99. A currency without a
 * rate isn't offered (null).
 */
export function steamPrice(usdCents: number, currency: string, rates: Record<string, number>): number | null {
  const c = currency.toUpperCase();
  if (c === "USD") return usdCents;
  const rate = rates[c];
  if (!(rate > 0)) return null;
  return Math.max(99, Math.ceil((usdCents * rate) / 100) * 100 - 1);
}

type Post = (url: string, body: URLSearchParams) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;
const post: Post = (url, body) => fetch(url, { method: "POST", body }) as unknown as ReturnType<Post>;

type Answer = { ok: true; params: Record<string, unknown> } | { ok: false; error: string };

async function steamCall(fn: () => ReturnType<Post>): Promise<Answer> {
  try {
    const res = await fn();
    const body = (await res.json().catch(() => null)) as { response?: { result?: string; params?: Record<string, unknown>; error?: { errordesc?: string } } } | null;
    const r = body?.response;
    if (res.ok && r?.result === "OK") return { ok: true, params: r.params ?? {} };
    return { ok: false, error: r?.error?.errordesc ?? `steam_${res.status}` };
  } catch {
    return { ok: false, error: "steam_down" };
  }
}

/** The player's Steam wallet: its currency (and whether Steam lets them buy). */
export async function steamWallet(cfg: SteamConfig, steamId: string, sandbox: boolean, fetchImpl: Fetch = fetch as unknown as Fetch): Promise<{ ok: true; currency: string } | { ok: false; error: string }> {
  const r = await steamCall(() => fetchImpl(`${microTxnBase(sandbox)}/GetUserInfo/v2/?key=${encodeURIComponent(cfg.key)}&steamid=${steamId}`) as ReturnType<Post>);
  if (!r.ok) return r;
  const status = String(r.params.status ?? "");
  if (status && status !== "Active" && status !== "Trusted") return { ok: false, error: "wallet_locked" };
  return { ok: true, currency: String(r.params.currency ?? "USD") };
}

export interface SteamOrder { orderId: string; steamId: string; sku: string; name: string; amount: number; currency: string }

/** Starts the order; Steam then shows the player its checkout in the overlay. */
export function initTxn(cfg: SteamConfig, o: SteamOrder, sandbox: boolean, postImpl: Post = post): Promise<Answer> {
  const body = new URLSearchParams({
    key: cfg.key, orderid: o.orderId, steamid: o.steamId, appid: cfg.appId, itemcount: "1", language: "en",
    currency: o.currency.toUpperCase(), usersession: "client",
    "itemid[0]": String(steamItemId(o.sku)), "qty[0]": "1", "amount[0]": String(o.amount),
    "description[0]": `Clout City: ${o.name}`.slice(0, 128),
  });
  return steamCall(() => postImpl(`${microTxnBase(sandbox)}/InitTxn/v3/`, body));
}

/** Completes an order the player approved; only then is the money taken. */
export function finalizeTxn(cfg: SteamConfig, orderId: string, sandbox: boolean, postImpl: Post = post): Promise<Answer> {
  return steamCall(() => postImpl(`${microTxnBase(sandbox)}/FinalizeTxn/v2/`, new URLSearchParams({ key: cfg.key, orderid: orderId, appid: cfg.appId })));
}
