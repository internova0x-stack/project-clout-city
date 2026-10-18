import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { GuestMap, type CreatorWelcome } from "@/components/GuestMap";
import { GAME_CONFIG } from "@/lib/config";
import { getSession } from "@/lib/player";
import { getAdminSupabase } from "@/lib/supabase/admin";

/** The creator whose link this guest followed (the /c/<slug> cookie), for the welcome line. Never counts a click. */
async function creatorWelcome(): Promise<CreatorWelcome | null> {
  const slug = (await cookies()).get(GAME_CONFIG.creator.cookieName)?.value;
  const admin = slug ? getAdminSupabase() : null;
  if (!slug || !admin) return null;
  const { data } = await admin.rpc("creator_link", { p_slug: slug, p_click: false });
  const c = data as (CreatorWelcome & { live: boolean }) | null;
  return c?.live ? { name: c.name, giftCash: c.giftCash, giftItem: c.giftItem } : null;
}

export const dynamic = "force-dynamic";

export default async function GuestPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  // Supabase falls back to the Site URL (here) when it doesn't recognize a sign-in's redirect:
  // finish signing in through the callback, which also knows a Studio sign-in (lib/authNext.ts).
  if (typeof params.code === "string") redirect(`/auth/callback?code=${encodeURIComponent(params.code)}`);
  const { user, player } = await getSession();
  if (user && player) redirect("/home");
  if (user) redirect("/create");

  return (
    <GuestMap invited={params.invited === "1" || typeof params.ref === "string"} authError={typeof params.auth_error === "string"}
      at={typeof params.at === "string" ? params.at : undefined} creator={await creatorWelcome()} openSignUp={params.signup === "1"} />
  );
}
