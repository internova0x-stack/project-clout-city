import { NextResponse, type NextRequest } from "next/server";
import { steamConfig, steamEmail, steamError, verifySteamTicket } from "@/lib/steam";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { getServerSupabase } from "@/lib/supabase/server";

// Steam sign-in (migration 0133; docs/STEAM.md). The Steam app (desktop/) posts a Web API ticket from the Steam client.
//   * Signed out: the server checks the ticket with Steam, finds the account linked to that Steam id (or makes one, with
//     an address nobody mails) and signs the browser in through a one-time magic-link token it verifies itself.
//   * Signed in (a web player who signed in with email inside the Steam app): links this Steam id to their account, so
//     the next launch signs them straight in. A Steam id already on an account the app made that never got a character
//     moves; one on an account with a character stays put ('steam_taken').
// Only this site's own pages may call it.

type Admin = NonNullable<ReturnType<typeof getAdminSupabase>>;

function fail(code: string, status = 400) {
  return NextResponse.json({ ok: false, error: steamError(code), code }, { status });
}

async function hasPlayer(admin: Admin, userId: string) {
  const { data } = await admin.from("players").select("id").eq("id", userId).maybeSingle();
  return !!data;
}

export async function POST(request: NextRequest) {
  const from = request.headers.get("origin");
  if (!from || (from !== new URL(request.url).origin && from !== process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, ""))) return fail("bad_origin", 403);
  const supabase = await getServerSupabase();
  const admin = getAdminSupabase();
  if (!supabase || !admin) return fail("not_set_up", 503);

  const body = (await request.json().catch(() => null)) as { ticket?: unknown } | null;
  const check = await verifySteamTicket(String(body?.ticket ?? ""), steamConfig());
  if (!check.ok) return fail(check.error, check.error === "steam_down" ? 503 : 400);
  const steamId = check.steamId;

  const { data: link } = await admin.from("steam_accounts").select("user_id, made_here").eq("steam_id", steamId).maybeSingle<{ user_id: string; made_here: boolean }>();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    // Link this Steam id to the signed-in account.
    if (link?.user_id === user.id) return NextResponse.json({ ok: true, state: "linked" });
    const { data: mine } = await admin.from("steam_accounts").select("steam_id").eq("user_id", user.id).maybeSingle();
    if (mine) return NextResponse.json({ ok: true, state: "other_steam" });
    if (link) {
      // Only an account the Steam app made, with no character yet, gives its link up.
      if (!link.made_here || (await hasPlayer(admin, link.user_id))) return fail("steam_taken", 409);
      await admin.from("steam_accounts").delete().eq("steam_id", steamId);
      await admin.auth.admin.deleteUser(link.user_id);
    }
    const { error } = await admin.from("steam_accounts").insert({ steam_id: steamId, user_id: user.id, made_here: false });
    if (error) return fail("steam_taken", 409);
    return NextResponse.json({ ok: true, state: "linked" });
  }

  // Sign in: the linked account, or a new one the Steam app makes.
  let email: string | null = null;
  if (link) {
    const { data } = await admin.auth.admin.getUserById(link.user_id);
    email = data.user?.email ?? null;
  } else {
    email = steamEmail(steamId);
    const made = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { steam: true } });
    let userId = made.data.user?.id;
    if (!userId) {
      // Made before but never linked (a failed first launch): find it by its address.
      const { data } = await admin.rpc("steam_user_by_email", { p_email: email });
      userId = (data as string | null) ?? undefined;
    }
    if (!userId) return fail("bad_ticket", 500);
    const { error } = await admin.from("steam_accounts").insert({ steam_id: steamId, user_id: userId, made_here: true });
    if (error) return fail("bad_ticket", 500);
  }
  if (!email) return fail("bad_ticket", 500);

  const { data: magic, error: linkErr } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const hash = magic?.properties?.hashed_token;
  if (linkErr || !hash) return fail("bad_ticket", 500);
  const { error: otpErr } = await supabase.auth.verifyOtp({ type: "magiclink", token_hash: hash });
  if (otpErr) return fail("bad_ticket", 500);
  return NextResponse.json({ ok: true, state: "signed_in" });
}
