"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { GAME_CONFIG } from "@/lib/config";
import { normalizeInviteCode } from "@/lib/invite";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { MailIcon } from "./icons";
import { Sheet } from "./Sheet";

function readInviteCookie(): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${GAME_CONFIG.invite.cookieName}=([^;]*)`));
  return normalizeInviteCode(match ? decodeURIComponent(match[1]) : null);
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Sign-up and log-in in one: email magic link (no password) plus the 18+
// confirmation (Clarifications sections 1 and 13; Milestones v0.1).
export function SignUpSheet({ open, onClose, invited }: { open: boolean; onClose: () => void; invited?: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [adult, setAdult] = useState(false);
  const [stage, setStage] = useState<"form" | "sent">("form");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");

  const canSend = EMAIL.test(email.trim()) && adult && !busy;

  async function send() {
    setError(null);
    const supabase = getBrowserSupabase();
    if (!supabase) {
      setError("Accounts aren't switched on yet. Check back very soon.");
      return;
    }
    setBusy(true);
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        shouldCreateUser: true,
        // Kept on the account, so the invite and age confirmation survive even
        // if the email is opened on another device.
        data: { age_confirmed: true, invite_code: readInviteCookie() },
      },
    });
    setBusy(false);
    if (err) {
      setError(err.status === 429 ? "Easy, tiger. Wait a minute before asking for another link." : "That didn't send. Check the address and try again.");
      return;
    }
    setStage("sent");
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
      setError("That code didn't work. It may have expired; ask for a new link.");
      return;
    }
    router.push("/create");
    router.refresh();
  }

  return (
    <Sheet open={open} onClose={onClose} label="Sign up or log in">
      {stage === "form" ? (
        <form
          className="stack-16"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSend) void send();
          }}
        >
          <div className="stack-4" style={{ paddingTop: 4, paddingRight: 40 }}>
            <p className="overline">{invited ? "You've been invited" : "Early access"}</p>
            <h2 className="display-lg" style={{ margin: 0 }}>Claim your spot in Queens</h2>
            <p className="subtext" style={{ margin: "4px 0 0" }}>
              Sign up or log in with your email. We&apos;ll send a magic link: no password, no velvet rope.
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

          <label className="check-row">
            <input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} />
            <span>
              I&apos;m 18 or older and I agree to the{" "}
              <a href="/terms" target="_blank" rel="noreferrer" style={{ fontWeight: 600 }}>Terms</a> and{" "}
              <a href="/privacy" target="_blank" rel="noreferrer" style={{ fontWeight: 600 }}>Privacy Policy</a>.
            </span>
          </label>

          {error && <p className="error-text" role="alert">{error}</p>}

          <button type="submit" className="btn btn-taxi" disabled={!canSend}>
            {busy ? "Sending…" : "Send my magic link ›"}
          </button>
          <p className="meta center" style={{ margin: 0 }}>Already have an account? Same button. Same link. Same you.</p>
        </form>
      ) : (
        <div className="stack-16">
          <div className="stack-4" style={{ paddingTop: 4, paddingRight: 40 }}>
            <p className="overline">Check your inbox</p>
            <h2 className="display-lg" style={{ margin: 0 }}>Your link is on its way</h2>
            <p className="subtext" style={{ margin: "4px 0 0" }}>
              We sent a sign-in link to <strong>{email.trim()}</strong>. Tap it on this phone or any other device.
            </p>
          </div>

          <form
            className="stack-8"
            onSubmit={(e) => {
              e.preventDefault();
              void verifyCode();
            }}
          >
            <p className="meta" style={{ margin: 0 }}>Got a 6-digit code in the email instead? Type it here.</p>
            <div className="row">
              <label className="field" style={{ flex: 1 }}>
                <input
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

          <button className="btn btn-ghost" onClick={() => { setStage("form"); setCode(""); setError(null); }}>
            Wrong email? Start over
          </button>
        </div>
      )}
    </Sheet>
  );
}
