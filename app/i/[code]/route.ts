import { NextResponse, type NextRequest } from "next/server";
import { GAME_CONFIG } from "@/lib/config";
import { normalizeInviteCode } from "@/lib/invite";
import { placeById } from "@/lib/city";

// Invite links (/i/CODE) land on the guest map with the code remembered. From a place ("Bring the
// crew", "Make it a date": /i/CODE?at=PLACE) they land on that place, and once the friend is in the
// game it opens there too (owner, Oct 15).
export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const invite = normalizeInviteCode(code);
  const at = request.nextUrl.searchParams.get("at");
  const place = at ? placeById(at) : undefined;
  const target = new URL("/", request.url);
  if (invite) target.searchParams.set("invited", "1");
  if (place) target.searchParams.set("at", place.id);
  const response = NextResponse.redirect(target);
  if (invite) {
    response.cookies.set(GAME_CONFIG.invite.cookieName, invite, {
      path: "/",
      maxAge: GAME_CONFIG.invite.cookieMaxAgeDays * 24 * 60 * 60,
      sameSite: "lax",
    });
  }
  if (place) {
    response.cookies.set(GAME_CONFIG.invite.placeCookieName, place.id, {
      path: "/",
      maxAge: GAME_CONFIG.invite.placeCookieMaxAgeDays * 24 * 60 * 60,
      sameSite: "lax",
    });
  }
  return response;
}
