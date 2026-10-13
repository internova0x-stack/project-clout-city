import { NextResponse, type NextRequest } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

// PKCE callback: used by Supabase's default email template (same browser only)
// and, from v0.2, by Google sign-in.
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  const supabase = await getServerSupabase();
  if (supabase && code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(safeNext(url.searchParams.get("next")), request.url));
  }
  return NextResponse.redirect(new URL("/?auth_error=link", request.url));
}

/** Only same-site paths we expect (the Studio); everything else goes to the game. */
function safeNext(next: string | null): string {
  return next === "/studio" ? "/studio" : "/create";
}
