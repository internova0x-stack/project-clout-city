import { NextResponse, type NextRequest } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await getServerSupabase();
  if (supabase) await supabase.auth.signOut();
  // `bye` tells the welcome page to forget the player in analytics (components/Analytics.tsx).
  return NextResponse.redirect(new URL("/?bye=1", request.url), { status: 303 });
}
