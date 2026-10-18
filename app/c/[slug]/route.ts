import { NextResponse, type NextRequest } from "next/server";
import { GAME_CONFIG } from "@/lib/config";
import { landingPath, type Lands } from "@/lib/creators";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { getServerSupabase } from "@/lib/supabase/server";

// Creator links (/c/<slug>, spec section 21, migration 0087): counts the click, remembers the link on this device
// for 30 days so sign-up can credit the creator, and sends the visitor where the link lands. An unknown, retired
// or paused link still lands somewhere sensible; it just doesn't count.
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const admin = getAdminSupabase();
  type Link = { slug: string; lands: Lands; live: boolean };
  let link: Link | null = null;
  if (admin && /^[a-z0-9-]{2,40}$/i.test(slug)) {
    const { data, error } = await admin.rpc("creator_link", { p_slug: slug, p_click: true });
    if (error) console.error("creator_link failed", error);
    else link = data as Link | null;
  }
  const supabase = await getServerSupabase();
  const signedIn = !!(supabase && (await supabase.auth.getUser()).data.user);
  const response = NextResponse.redirect(new URL(landingPath(link?.lands ?? "home", signedIn), request.url));
  if (link?.live && !signedIn) {
    response.cookies.set(GAME_CONFIG.creator.cookieName, link.slug, {
      path: "/",
      maxAge: GAME_CONFIG.creator.cookieMaxAgeDays * 24 * 60 * 60,
      sameSite: "lax",
    });
  }
  return response;
}
