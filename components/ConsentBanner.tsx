"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { consentStatus, setConsent, type Consent } from "@/lib/analytics";
import { Toggle } from "./Toggle";

// Consent (owner, Oct 27; GDPR/ePrivacy): PostHog sends and stores nothing until the player answers. The banner asks
// once per device; Settings → Privacy choices changes the answer.

function useConsent(): [Consent | null, (c: Consent | null) => void] {
  const [c, setC] = useState<Consent | null>(null);
  useEffect(() => {
    // PostHog starts in instrumentation-client.ts; give it a moment on slow devices.
    const read = () => setC(consentStatus());
    read();
    const t = setTimeout(read, 1500);
    window.addEventListener("cc-consent", read);
    return () => { clearTimeout(t); window.removeEventListener("cc-consent", read); };
  }, []);
  return [c, setC];
}

export function ConsentBanner() {
  const [c] = useConsent();
  if (c !== "pending") return null;
  return (
    <div className="consent-banner" role="dialog" aria-label="Cookies and analytics">
      <p className="body" style={{ margin: 0 }}>
        🍪 We&apos;d like to use cookies to see how people play and to record game sessions, so we can fix what&apos;s
        confusing. What you type and your chats are never recorded. <Link href="/privacy">Privacy policy</Link>
      </p>
      <div className="row" style={{ gap: 8 }}>
        <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => setConsent(false)}>Reject</button>
        <button className="btn btn-taxi btn-sm" style={{ flex: 1 }} onClick={() => setConsent(true)}>Accept</button>
      </div>
    </div>
  );
}

/** Settings → Privacy choices: the same answer, changeable any time. Hidden when analytics isn't running. */
export function ConsentSwitch({ onToast }: { onToast?: (t: string) => void }) {
  const [c] = useConsent();
  if (c === null) return null;
  const on = c === "granted";
  return (
    <div className="list-row static">
      <span style={{ flex: 1 }}>
        <span className="title" style={{ display: "block" }}>Analytics and session replay</span>
        <span className="meta">Helps us fix what&apos;s confusing. Typing and chats are never recorded.</span>
      </span>
      <Toggle on={on} label="Analytics and session replay" onChange={() => {
        setConsent(!on);
        onToast?.(on ? "Analytics off. Nothing more is sent from this device." : "Analytics on. Thanks, it helps.");
      }} />
    </div>
  );
}
