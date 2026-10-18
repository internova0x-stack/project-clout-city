// Push notifications in the browser (owner, Oct 18): register the service worker (public/sw.js), ask permission,
// subscribe this device with the game's public VAPID key and hand the subscription to the server (push_subscribe,
// migration 0078). The rules for what gets sent live on the server (lib/push.ts).

export interface PushPrefs { off: string[]; devices: number; askedAt: string | null }
export type PushResult<T> = { ok: true; data: T } | { ok: false; error: string };

/** The push screens' server calls (app/home/pushActions.ts; the preview's in-memory version). */
export interface PushApi {
  prefs(): Promise<PushResult<PushPrefs>>;
  subscribe(sub: { endpoint: string; p256dh: string; auth: string }, tz: string): Promise<PushResult<null>>;
  unsubscribe(endpoint: string): Promise<PushResult<null>>;
  setOff(off: string[]): Promise<PushResult<PushPrefs>>;
  asked(): Promise<PushResult<PushPrefs>>;
  test(): Promise<PushResult<null>>;
}

export type PushSupport = "unsupported" | "needs-install" | "blocked" | "ask" | "granted";

/** What this browser can do: iPhones only get push once the game is on the Home Screen (iOS 16.4+). */
export function pushSupport(): PushSupport {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("Notification" in window)) {
    const ios = typeof navigator !== "undefined" && /iPhone|iPad|iPod/.test(navigator.userAgent);
    return ios ? "needs-install" : "unsupported";
  }
  if (!("PushManager" in window)) return "unsupported";
  if (Notification.permission === "denied") return "blocked";
  return Notification.permission === "granted" ? "granted" : "ask";
}

const key = () => process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function urlBase64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function registration(): Promise<ServiceWorkerRegistration> {
  return (await navigator.serviceWorker.getRegistration("/")) ?? navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

/** This device's current subscription endpoint, if it has one. */
export async function currentEndpoint(): Promise<string | null> {
  if (pushSupport() !== "granted") return null;
  const sub = await (await registration()).pushManager.getSubscription();
  return sub?.endpoint ?? null;
}

/** Asks permission (from a tap), subscribes this device and saves it. */
export async function enablePush(api: PushApi): Promise<PushResult<null>> {
  if (!key()) return { ok: false, error: "Notifications aren't switched on for this game yet." };
  const support = pushSupport();
  if (support === "needs-install") return { ok: false, error: "On iPhone, add Clout City to your Home Screen first, then turn notifications on there." };
  if (support === "unsupported") return { ok: false, error: "This browser can't do notifications. Try Chrome, Safari or the installed app." };
  if (support === "blocked") return { ok: false, error: "Notifications are blocked for Clout City in your browser settings." };
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, error: "No notifications, then. You can turn them on later in Settings." };
  const reg = await registration();
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToBytes(key()) }));
  const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) return { ok: false, error: "Your browser didn't give us a subscription. Try again." };
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York";
  return api.subscribe({ endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth }, tz);
}

/** Turns this device off. */
export async function disablePush(api: PushApi): Promise<PushResult<null>> {
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return { ok: true, data: null };
  await sub.unsubscribe().catch(() => {});
  return api.unsubscribe(sub.endpoint);
}
