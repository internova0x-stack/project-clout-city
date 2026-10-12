import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { GAME_CONFIG } from "@/lib/config";
import { normalizeInviteCode } from "@/lib/invite";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "@/lib/supabase/env";

// Runs before every page: refreshes the Supabase session cookie and keeps an
// invite code (?ref=CODE) so the friend who shared the link gets credit.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  if (isSupabaseConfigured()) {
    const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
          for (const [key, value] of Object.entries(headers ?? {})) response.headers.set(key, value);
        },
      },
    });
    // Touching the user refreshes an expiring session.
    await supabase.auth.getUser();
  }

  const ref = normalizeInviteCode(request.nextUrl.searchParams.get("ref"));
  if (ref) {
    response.cookies.set(GAME_CONFIG.invite.cookieName, ref, {
      path: "/",
      maxAge: GAME_CONFIG.invite.cookieMaxAgeDays * 24 * 60 * 60,
      sameSite: "lax",
    });
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|glb|mp3)$).*)",
  ],
};
