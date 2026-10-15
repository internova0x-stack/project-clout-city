import { NextResponse, type NextRequest } from "next/server";
import { AFTER_SIGNIN_COOKIE, afterSignIn } from "@/lib/authNext";
import { getServerSupabase } from "@/lib/supabase/server";

// PKCE callback: used by Supabase's default email template (same browser only)
// and, from v0.2, by Google sign-in.
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  const supabase = await getServerSupabase();
  if (supabase && code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const res = NextResponse.redirect(new URL(afterSignIn(url.searchParams.get("next"), request.cookies.get(AFTER_SIGNIN_COOKIE)?.value), request.url));
      res.cookies.delete(AFTER_SIGNIN_COOKIE);
      return res;
    }
  }
  return NextResponse.redirect(new URL("/?auth_error=link", request.url));
}
