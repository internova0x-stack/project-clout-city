import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { AFTER_SIGNIN_COOKIE, afterSignIn } from "@/lib/authNext";
import { getServerSupabase } from "@/lib/supabase/server";

// Magic-link target (token-hash flow). Works even when the email is opened on a different device
// or browser from the one that asked for it.
//
// Two steps (owner report, Oct 13: links said "expired"): opening the link only shows a "Continue"
// button; tapping it (a POST) signs in. Email security scanners and link previews open every link
// in a message, and when opening alone signed in, their visit used up the one-time token before the
// player's tap. Scanners load pages but don't submit forms.

const TYPES: EmailOtpType[] = ["email", "magiclink", "signup", "invite", "recovery", "email_change"];

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  if (!tokenHash) return NextResponse.redirect(new URL("/?auth_error=link", request.url));
  const type = TYPES.includes(url.searchParams.get("type") as EmailOtpType) ? (url.searchParams.get("type") as EmailOtpType) : "email";
  const next = afterSignIn(url.searchParams.get("next"), request.cookies.get(AFTER_SIGNIN_COOKIE)?.value);
  return new NextResponse(page(tokenHash, type, next), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      // The token is in the page: never cache it, never send it on as a referrer.
      "cache-control": "no-store",
      "referrer-policy": "no-referrer",
      "x-robots-tag": "noindex",
    },
  });
}

export async function POST(request: NextRequest) {
  // Security review (Oct 29): only this site's own Continue button may sign in, so another site can't post its own
  // token and sign a player in to the wrong account.
  const from = request.headers.get("origin");
  if (from && from !== new URL(request.url).origin && from !== process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "")) {
    return NextResponse.redirect(new URL("/?auth_error=link", request.url), { status: 303 });
  }
  const form = await request.formData();
  const tokenHash = String(form.get("token_hash") ?? "");
  const rawType = String(form.get("type") ?? "email") as EmailOtpType;
  const type = TYPES.includes(rawType) ? rawType : "email";
  const next = afterSignIn(String(form.get("next") ?? ""), request.cookies.get(AFTER_SIGNIN_COOKIE)?.value);
  const supabase = await getServerSupabase();
  if (supabase && tokenHash) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      const res = NextResponse.redirect(new URL(next, request.url), { status: 303 });
      res.cookies.delete(AFTER_SIGNIN_COOKIE);
      return res;
    }
  }
  return NextResponse.redirect(new URL("/?auth_error=link", request.url), { status: 303 });
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** A tiny standalone page in the game's colors: one button, no scripts. */
function page(tokenHash: string, type: string, next: string): string {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>Sign in · Clout City</title>
<style>
  :root { color-scheme: light; }
  body { margin:0; min-height:100vh; display:grid; place-items:center; padding:24px; box-sizing:border-box;
    font-family:-apple-system, BlinkMacSystemFont, "SF Pro Display", Inter, system-ui, sans-serif;
    background:radial-gradient(120% 90% at 50% 12%, #FFF4E6 0%, #FFE3CC 55%, #FFD3B5 100%); color:#17141C; }
  main { width:100%; max-width:380px; background:#FBF8F2; border-radius:28px; padding:28px 24px; box-shadow:0 8px 24px rgba(16,24,40,.14); text-align:center; }
  .mark { font-size:12px; font-weight:800; letter-spacing:.16em; text-transform:uppercase; color:#B0135A; }
  h1 { margin:10px 0 6px; font-size:26px; line-height:1.15; letter-spacing:-.015em; }
  p { margin:0 0 22px; font-size:15px; line-height:1.5; color:#4F4A56; }
  button { width:100%; height:54px; border:0; border-radius:16px; font-family:inherit; font-size:17px; font-weight:600; color:#fff; cursor:pointer;
    background:linear-gradient(180deg, #FA2D48, #D41834); box-shadow:0 6px 16px rgba(250,45,72,.35); }
</style></head>
<body><main>
  <div class="mark">Clout City</div>
  <h1>Welcome back</h1>
  <p>Tap to finish signing in. The link works once, on this device.</p>
  <form method="post" action="/auth/confirm">
    <input type="hidden" name="token_hash" value="${esc(tokenHash)}">
    <input type="hidden" name="type" value="${esc(type)}">
    <input type="hidden" name="next" value="${esc(next)}">
    <button type="submit">Continue to Clout City</button>
  </form>
</main></body></html>`;
}
