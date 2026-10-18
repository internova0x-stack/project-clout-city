"use client";

// Push notifications (owner, Oct 18): Lola's ask after the first party, and Settings → Notifications.
import { useEffect, useState } from "react";
import { PUSH_CATEGORIES } from "@/lib/push";
import { Toggle } from "../Toggle";
import { currentEndpoint, disablePush, enablePush, pushSupport, type PushApi, type PushPrefs } from "@/lib/pushClient";

/** Lola asks once after the first party (and again three days after "Not now"). */
export function PushPrompt({ api, onDone, onToast }: { api: PushApi; onDone: () => void; onToast: (t: string) => void }) {
  const [busy, setBusy] = useState(false);
  const support = pushSupport();
  const turnOn = async () => {
    setBusy(true);
    const r = await enablePush(api).finally(() => setBusy(false));
    await api.asked();
    onToast(r.ok ? "🔔 Notifications on. Lola will only text when it matters. Mostly." : r.error);
    onDone();
  };
  const later = async () => { await api.asked(); onDone(); };
  return (
    <div className="modal-wrap" role="dialog" aria-modal="true" aria-label="Turn on notifications">
      <div className="scrim" onClick={() => void later()} />
      <div className="modal-card reveal-card push-ask">
        <span className="tag tag-event">🔔 Lola here</span>
        <p className="display-md" style={{ margin: "12px 0 8px" }}>Want a heads-up?</p>
        <p className="body" style={{ margin: 0, color: "rgba(255,246,224,.85)" }}>
          When someone texts you, your crush says yes, rent&apos;s due or your streak is about to die. Four a day, tops,
          plus chats. Never at 3 AM. I have manners.
        </p>
        {support === "needs-install" && (
          <p className="meta" style={{ margin: "10px 0 0", color: "rgba(255,246,224,.75)" }}>On iPhone: add Clout City to your Home Screen first, then turn them on in Settings.</p>
        )}
        <div className="row" style={{ gap: 8, marginTop: 18 }}>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => void later()}>Not now</button>
          <button className="btn btn-taxi" style={{ flex: 1 }} disabled={busy || support === "needs-install" || support === "unsupported"} onClick={() => void turnOn()}>Turn on</button>
        </div>
      </div>
    </div>
  );
}

/** Should Lola ask now? Never asked, or asked over three days ago; nothing subscribed; the browser can ask. */
export function shouldAskPush(prefs: PushPrefs | null, now = Date.now()): boolean {
  if (!prefs || prefs.devices > 0) return false;
  if (prefs.askedAt && now - Date.parse(prefs.askedAt) < 3 * 86_400_000) return false;
  const s = pushSupport();
  return s === "ask" || s === "needs-install";
}

/** Settings → Notifications: this device on or off, the six categories, and a test. */
export function PushSettings({ api, onToast }: { api: PushApi; onToast?: (t: string) => void }) {
  const [prefs, setPrefs] = useState<PushPrefs | null>(null);
  const [here, setHere] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void api.prefs().then((r) => r.ok && setPrefs(r.data));
    void currentEndpoint().then((e) => setHere(!!e)).catch(() => setHere(false));
  }, [api]);
  const support = pushSupport();
  const toggleDevice = async () => {
    setBusy(true);
    const r = here ? await disablePush(api) : await enablePush(api);
    setBusy(false);
    if (!r.ok) return onToast?.(r.error);
    setHere(!here);
    void api.prefs().then((p) => p.ok && setPrefs(p.data));
    onToast?.(here ? "Notifications off on this device." : "🔔 Notifications on.");
  };
  const toggle = async (id: string) => {
    if (!prefs) return;
    const off = prefs.off.includes(id) ? prefs.off.filter((x) => x !== id) : [...prefs.off, id];
    setPrefs({ ...prefs, off });
    const r = await api.setOff(off);
    if (!r.ok) onToast?.(r.error);
  };
  const test = async () => {
    setBusy(true);
    const r = await api.test().finally(() => setBusy(false));
    onToast?.(r.ok ? "Test sent. Check your notifications." : r.error);
  };
  return (
    <div className="stack-8 push-settings">
      <div className="list-row static">
        <span style={{ flex: 1 }}>
          <span className="title" style={{ display: "block" }}>Notifications</span>
          <span className="meta">
            {support === "needs-install" ? "On iPhone, add Clout City to your Home Screen first."
              : support === "unsupported" ? "This browser can't do notifications."
              : support === "blocked" ? "Blocked in your browser settings."
              : "4 a day at most, plus chats. Quiet from 10 PM to 9 AM."}
          </span>
        </span>
        <Toggle on={!!here} label="Notifications on this device" disabled={busy || here === null || support === "unsupported" || support === "needs-install" || support === "blocked"} onChange={() => void toggleDevice()} />
      </div>
      {prefs && (here || prefs.devices > 0) && (
        <>
          {PUSH_CATEGORIES.map((c) => (
            <div key={c.id} className="list-row static push-cat">
              <span aria-hidden="true" className="push-cat-emoji">{c.emoji}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span className="title" style={{ display: "block" }}>{c.label}</span>
                <span className="meta">{c.line}</span>
              </span>
              <Toggle on={!prefs.off.includes(c.id)} label={c.label} onChange={() => void toggle(c.id)} />
            </div>
          ))}
          <button className="btn btn-secondary" disabled={busy} onClick={() => void test()}>Send a test notification</button>
        </>
      )}
    </div>
  );
}
