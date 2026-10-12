import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

// Magic-link target (token-hash flow). Works even when the email is opened on a
// different device or browser from the one that asked for it.
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = (url.searchParams.get("type") ?? "email") as EmailOtpType;

  const supabase = await getServerSupabase();
  if (supabase && tokenHash) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL("/create", request.url));
  }
  return NextResponse.redirect(new URL("/?auth_error=link", request.url));
}
