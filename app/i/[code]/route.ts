import { NextResponse, type NextRequest } from "next/server";
import { GAME_CONFIG } from "@/lib/config";
import { normalizeInviteCode } from "@/lib/invite";

// Invite links (/i/CODE) land on the guest map with the code remembered.
export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const invite = normalizeInviteCode(code);
  const target = new URL("/", request.url);
  if (invite) target.searchParams.set("invited", "1");
  const response = NextResponse.redirect(target);
  if (invite) {
    response.cookies.set(GAME_CONFIG.invite.cookieName, invite, {
      path: "/",
      maxAge: GAME_CONFIG.invite.cookieMaxAgeDays * 24 * 60 * 60,
      sameSite: "lax",
    });
  }
  return response;
}
