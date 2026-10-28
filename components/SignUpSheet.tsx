"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { track } from "@/lib/analytics";
import { GAME_CONFIG } from "@/lib/config";
import { normalizeInviteCode } from "@/lib/invite";
import { normalizeCreatorCode } from "@/lib/creators";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { isStandalone } from "./game/FirstSession";
import { MailIcon } from "./icons";
import { Sheet } from "./Sheet";
import { AFTER_SIGNIN_COOKIE } from "@/lib/authNext";
import { isAdult, validBirthdate } from "@/lib/age";
import { AgeBlockedNote, BirthdateField, useAgeBlocked, type PartialBirthdate } from "./AgeGate";

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}
const readInviteCookie = () => normalizeInviteCode(readCookie(GAME_CONFIG.invite.cookieName));

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** "signin" (owner, Oct 28): one door for both. A known email gets its link at once; a new one goes on to sign-up's
 *  date-of-birth step and becomes an account there. */
export type AuthMode = "signup" | "login" | "signin";

// Sign-up and log-in in one: email magic link (no password) plus the age screen (Clarifications sections 1 and 13;
// Milestones v0.1): a date of birth since Oct 27 (lib/age.ts), asked on its own step after the email; under 18 is
// turned away and the device remembers it.
// v0.11 (spec section 11): in the installed app the 6-digit code is the main way in, because an
// email link opens the browser, not the app. The same email carries both.
export function SignUpSheet({
  open,
  onClose,
  invited,
  mode = "signup",
  onSwitchMode,
  creator,
  gift,
}: {
  open: boolean;
  onClose: () => void;
  invited?: boolean;
  mode?: AuthMode;
  onSwitchMode?: (mode: AuthMode) => void;
  /** The creator whose link brought this guest (spec section 21), and their welcome gift in words. */
  creator?: string;
  gift?: string | null;
}) {
  const signin = mode === "signin";
  const login = mode === "login" || signin;
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [dob, setDob] = useState<PartialBirthdate>({});
  const [blocked, block] = useAgeBlocked();
  const dobDone = !!(dob.year && dob.month && dob.day);
  // Sign-up is two steps (owner, Oct 27): the email (or Google), then the date of birth. Nothing is sent until the
  // date of birth passes, so no email ever leaves the device for someone under 18.
  const [method, setMethod] = useState<"email" | "google" | null>(null);
  const [stage, setStage] = useState<"form" | "sent">("form");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  // Creator code (spec section 21): for people who saw a video rather than tapped a link. Optional.
  const [creatorCode, setCreatorCode] = useState("");
  const [showCreatorCode, setShowCreatorCode] = useState(false);
  const typedCreator = normalizeCreatorCode(creatorCode);
  const creatorCodeBad = creatorCode.trim() !== "" && !typedCreator;
  // Read after mount so the server render matches the first client render.
  const [inApp, setInApp] = useState(false);
  useEffect(() => setInApp(isStandalone()), []);

  const canSend = EMAIL.test(email.trim()) && !busy && (login || !creatorCodeBad);

  /** Sign-up only: a real date that's 18+ goes on; under 18 closes sign-up on this device. */
  function ageOk(): boolean {
    if (login) return true;
    if (!validBirthdate(dob)) { setError("That date doesn't look right. Check your date of birth."); return false; }
    if (!isAdult(dob)) { block(); return false; }
    return true;
  }

  async function send() {
    setError(null);
    if (!ageOk()) return;
    const supabase = getBrowserSupabase();
    if (!supabase) {
      setError("Accounts aren't switched on yet. Check back very soon.");
      return;
    }
    setBusy(true);
    if (!login) track("signup_started", { method: "email", invited: !!readInviteCookie(), via_creator: !!(readCookie(GAME_CONFIG.creator.cookieName) || typedCreator), installed_app: inApp });
    // A game sign-in lands in the game, even after a Studio sign-in attempt on this browser.
    document.cookie = `${AFTER_SIGNIN_COOKIE}=; path=/; max-age=0`;
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        // Log in never creates an account, so the 18+ confirmation is always given at sign-up.
        shouldCreateUser: !login,
        // Kept on the account, so the invite and age confirmation survive even
        // if the email is opened on another device.
        data: {
          age_confirmed: true,
          age_check: "birthdate",
          invite_code: readInviteCookie(),
          ...(login ? {} : { creator_link: readCookie(GAME_CONFIG.creator.cookieName), creator_code: typedCreator }),
        },
      },
    });
    setBusy(false);
    if (err) {
      const noAccount = login && /signups? not allowed|not found|user/i.test(err.message);
      // Sign in: a new email carries on as a sign-up, at the date of birth, with the address kept.
      if (signin && noAccount && onSwitchMode) {
        setMethod("email");
        onSwitchMode("signup");
        return;
      }
      setError(
        err.status === 429
          ? `Easy, tiger. Wait a minute before asking for another ${inApp ? "code" : "link"}.`
          : noAccount
            ? "No account with that email yet. Sign up instead?"
            : "That didn't send. Check the address and try again.",
      );
      return;
    }
    setStage("sent");
  }

  async function google() {
    setError(null);
    const supabase = getBrowserSupabase();
    if (!supabase) return setError("Accounts aren't switched on yet. Check back very soon.");
    if (!ageOk()) return;
    // OAuth can't carry metadata, so the 18+ confirmation rides along in a short-lived cookie.
    if (!login) document.cookie = `${GAME_CONFIG.ageCookieName}=1; path=/; max-age=3600; samesite=lax`;
    if (!login) track("signup_started", { method: "google", invited: !!readInviteCookie(), via_creator: !!(readCookie(GAME_CONFIG.creator.cookieName) || typedCreator), installed_app: inApp });
    if (!login && typedCreator) document.cookie = `${GAME_CONFIG.creator.codeCookieName}=${typedCreator}; path=/; max-age=3600; samesite=lax`;
    setBusy(true);
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (err) {
      setBusy(false);
      setError(/provider is not enabled|unsupported provider/i.test(err.message) ? "Google sign-in isn't switched on yet. Use email for now." : "Google didn't answer. Try email instead.");
    }
  }

  async function verifyCode() {
    const supabase = getBrowserSupabase();
    const token = code.replace(/\D/g, "");
    if (!supabase || token.length < 6) return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.verifyOtp({ email: email.trim(), token, type: "email" });
    setBusy(false);
    if (err) {
      setError(inApp ? "That code didn't work. It may have expired; start over for a new one." : "That code didn't work. It may have expired; ask for a new link.");
      return;
    }
    router.push("/create");
    router.refresh();
  }

  return (
    <Sheet open={open} onClose={onClose} label={signin ? "Sign in" : login ? "Log in" : "Sign up"}>
      {!login && blocked ? (
        <div className="stack-16">
          <div className="stack-4" style={{ paddingTop: 4, paddingRight: 40 }}>
            <p className="overline">Sign up</p>
            <h2 className="display-lg" style={{ margin: 0 }}>Not yet</h2>
          </div>
          <AgeBlockedNote />
          {onSwitchMode && (
            <button type="button" className="btn btn-ghost" onClick={() => { setError(null); onSwitchMode("login"); }}>
              Already have an account? Log in
            </button>
          )}
        </div>
      ) : !login && method && stage === "form" ? (
        <form
          className="stack-16"
          onSubmit={(e) => {
            e.preventDefault();
            if (!dobDone || busy) return;
            void (method === "google" ? google() : send());
          }}
        >
          <div className="stack-4" style={{ paddingTop: 4, paddingRight: 40 }}>
            <p className="overline">Almost there</p>
            <h2 className="display-lg" style={{ margin: 0 }}>When&apos;s your birthday?</h2>
            <p className="subtext" style={{ margin: "4px 0 0" }}>We ask everyone. We don&apos;t keep it.</p>
          </div>
          <BirthdateField value={dob} onChange={(v) => { setDob(v); setError(null); }} />
          <p className="meta" style={{ marginBottom: 0 }}>
            By signing up you agree to the{" "}
            <a href="/terms" target="_blank" rel="noreferrer" style={{ fontWeight: 600 }}>Terms</a> and{" "}
            <a href="/privacy" target="_blank" rel="noreferrer" style={{ fontWeight: 600 }}>Privacy Policy</a>.
          </p>
          {error && <p className="error-text" role="alert">{error}</p>}
          <button type="submit" className={method === "google" ? "btn btn-secondary" : "btn btn-taxi"} disabled={!dobDone || busy}>
            {method === "google" ? <><GoogleMark /> Continue with Google</> : busy ? "Sending…" : inApp ? "Email me a code ›" : "Send my magic link ›"}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => { setError(null); setMethod(null); }}>
            ‹ Back
          </button>
        </form>
      ) : stage === "form" ? (
        <form
          className="stack-16"
          onSubmit={(e) => {
            e.preventDefault();
            if (!canSend) return;
            if (login) void send();
            else { setError(null); setMethod("email"); }
          }}
        >
          <div className="stack-4" style={{ paddingTop: 4, paddingRight: 40 }}>
            <p className="overline">{signin ? "Sign in" : login ? "Welcome back" : creator ? `${creator} sent you` : invited ? "You've been invited" : "Early access"}</p>
            <h2 className="display-lg" style={{ margin: 0 }}>{signin ? "Your spot in Queens" : login ? "Back to Queens" : "Claim your spot in Queens"}</h2>
            <p className="subtext" style={{ margin: "4px 0 0" }}>
              {signin
                ? `Enter your email. Been here before? We'll send your ${inApp ? "6-digit code" : "magic link"}. New? We'll get you set up.`
                : inApp
                ? login
                  ? "Enter your email and we'll send a 6-digit code. Type it here; no leaving the app."
                  : "Sign up with your email. We'll send a 6-digit code: no password, no velvet rope."
                : login
                  ? "Enter your email and we'll send a magic link. The city kept your spot warm. Mostly."
                  : "Sign up with your email. We'll send a magic link: no password, no velvet rope."}
              {!login && creator && gift && <> Your welcome gift: {gift}.</>}
            </p>
          </div>

          <label className="field" htmlFor="signup-email">
            <MailIcon size={18} style={{ color: "var(--text-3)" }} />
            <input
              id="signup-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-label="Email address"
              required
            />
          </label>


          {!login && !creator && (showCreatorCode ? (
            <div className="stack-4">
              <label className="field" htmlFor="signup-creator">
                <span aria-hidden="true" style={{ fontSize: 16 }}>🎬</span>
                <input
                  id="signup-creator"
                  autoCapitalize="characters"
                  autoComplete="off"
                  placeholder="Creator code (optional)"
                  maxLength={20}
                  value={creatorCode}
                  onChange={(e) => setCreatorCode(e.target.value)}
                  aria-label="Creator code"
                  aria-invalid={creatorCodeBad}
                />
              </label>
              <p className={creatorCodeBad ? "error-text" : "meta"} style={{ margin: 0 }}>
                {creatorCodeBad ? "Codes are 3 to 16 letters and numbers." : "Saw us in a video? The code on screen gets you a welcome gift."}
              </p>
            </div>
          ) : (
            <button type="button" className="linkish" style={{ alignSelf: "flex-start" }} onClick={() => setShowCreatorCode(true)}>
              Got a creator code?
            </button>
          ))}

          {error && <p className="error-text" role="alert">{error}</p>}

          <button type="submit" className="btn btn-taxi" disabled={!canSend}>
            {signin ? (busy ? "Checking…" : "Continue ›") : !login ? "Continue ›" : busy ? "Sending…" : inApp ? "Email me a code ›" : "Send my magic link ›"}
          </button>
          <div className="or-divider"><span>or</span></div>
          <button type="button" className="btn btn-secondary" disabled={busy || (!login && creatorCodeBad)} onClick={() => (login ? void google() : (setError(null), setMethod("google")))}>
            <GoogleMark /> Continue with Google
          </button>
          {onSwitchMode && !signin && (
            <button type="button" className="btn btn-ghost" onClick={() => { setError(null); onSwitchMode(login ? "signup" : "login"); }}>
              {login ? "New here? Sign up free" : "Already have an account? Log in"}
            </button>
          )}
        </form>
      ) : (
        <div className="stack-16">
          <div className="stack-4" style={{ paddingTop: 4, paddingRight: 40 }}>
            <p className="overline">Check your inbox</p>
            <h2 className="display-lg" style={{ margin: 0 }}>{inApp ? "Type your code" : "Your link is on its way"}</h2>
            <p className="subtext" style={{ margin: "4px 0 0" }}>
              {inApp
                ? <>We emailed a 6-digit code to <strong>{email.trim()}</strong>. Copy it from your inbox and type it below.</>
                : <>We sent a sign-in link to <strong>{email.trim()}</strong>. Tap it on this phone or any other device.</>}
            </p>
          </div>

          <form
            className="stack-8"
            onSubmit={(e) => {
              e.preventDefault();
              void verifyCode();
            }}
          >
            {!inApp && <p className="meta" style={{ margin: 0 }}>Got a 6-digit code in the email instead? Type it here.</p>}
            <div className="row">
              <label className={`field${inApp ? " field-code" : ""}`} style={{ flex: 1 }}>
                <input
                  autoFocus={inApp}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  maxLength={8}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  aria-label="Six-digit code"
                  style={{ letterSpacing: "0.2em" }}
                />
              </label>
              <button type="submit" className="btn btn-night" style={{ width: 96 }} disabled={busy || code.replace(/\D/g, "").length < 6}>
                {busy ? "…" : "Enter"}
              </button>
            </div>
          </form>

          {error && <p className="error-text" role="alert">{error}</p>}
          {inApp && <p className="meta" style={{ margin: "4px 0 0" }}>The email has a link too, but it opens your browser instead of the app. The code keeps you here.</p>}

          <button className="btn btn-ghost" onClick={() => { setStage("form"); setMethod(null); setCode(""); setError(null); }}>
            Wrong email? Start over
          </button>
        </div>
      )}
    </Sheet>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
