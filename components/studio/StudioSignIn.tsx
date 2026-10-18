"use client";

import { AFTER_SIGNIN_COOKIE, AFTER_SIGNIN_MAX_AGE } from "@/lib/authNext";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Studio sign-in: an existing account only (admins sign up in the game first), by email code or Google.
 * The creator page (/creator) uses it too, and there a creator who doesn't play can make an account with the email
 * the Studio has for them.
 */
export function StudioSignIn({ dest = "/studio", title = "Story Studio", blurb, allowNew = false }: {
  dest?: "/studio" | "/creator";
  title?: string;
  blurb?: string;
  allowNew?: boolean;
} = {}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const back = () => {
    // If Supabase sends the link to the Site URL (the game) or the email's link has no "next", this
    // still brings the admin back here (lib/authNext.ts).
    document.cookie = `${AFTER_SIGNIN_COOKIE}=${dest}; path=/; max-age=${AFTER_SIGNIN_MAX_AGE}; samesite=lax${location.protocol === "https:" ? "; secure" : ""}`;
    return `${window.location.origin}/auth/callback?next=${dest}`;
  };

  async function send() {
    const supabase = getBrowserSupabase();
    if (!supabase) return setError("Accounts aren't switched on yet.");
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: allowNew, emailRedirectTo: back() } });
    setBusy(false);
    if (err) return setError(err.status === 429 ? "Wait a minute before asking for another code." : allowNew ? "That didn't send. Check the address and try again." : "No account with that email. Sign up in the game first.");
    setSent(true);
  }
  async function verify() {
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.replace(/\D/g, ""), type: "email" });
    setBusy(false);
    if (err) return setError("That code didn't work. It may have expired; ask for a new one.");
    router.refresh();
  }
  async function google() {
    const supabase = getBrowserSupabase();
    if (!supabase) return setError("Accounts aren't switched on yet.");
    const { error: err } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: back() } });
    if (err) setError("Google sign-in isn't switched on. Use email.");
  }

  return (
    <main className="studio studio-gate">
      <section className="studio-card stack-12">
        <span className="studio-mark">Clout City</span>
        <h1 className="display-lg" style={{ margin: 0 }}>{title}</h1>
        <p className="subtext" style={{ margin: 0 }}>{blurb ?? "For the story team. Sign in with the account you play with; an owner adds it to the admin list."}</p>
        {!sent ? (
          <>
            <input className="studio-input" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email" />
            <button className="btn btn-taxi" disabled={busy || !EMAIL.test(email.trim())} onClick={send}>{busy ? "Sending…" : "Email me a sign-in code"}</button>
            <button className="btn btn-secondary" disabled={busy} onClick={google}>Continue with Google</button>
          </>
        ) : (
          <>
            <p className="body" style={{ margin: 0 }}>Check {email.trim()}. Tap the link, or type the code here.</p>
            <input className="studio-input" inputMode="numeric" autoComplete="one-time-code" placeholder="6-digit code" value={code} onChange={(e) => setCode(e.target.value)} aria-label="Code" />
            <button className="btn btn-taxi" disabled={busy || code.replace(/\D/g, "").length < 6} onClick={verify}>{busy ? "Checking…" : "Sign in"}</button>
            <button className="chip" onClick={() => { setSent(false); setCode(""); }}>Use a different email</button>
          </>
        )}
        {error && <p className="meta reason" style={{ margin: 0 }}>{error}</p>}
      </section>
    </main>
  );
}
