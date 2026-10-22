import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { GuestMap, type CreatorWelcome } from "@/components/GuestMap";
import { WelcomeBack, type WelcomeData, type WelcomeItem } from "@/components/WelcomeBack";
import { restartPlayer } from "./create/actions";
import { GAME_CONFIG } from "@/lib/config";
import { creationDone, getSession, type Player } from "@/lib/player";
import { getServerSupabase } from "@/lib/supabase/server";
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
  // A returning player gets the welcome screen (owner, Oct 22): Continue, or Start over (migration 0114).
  if (user && player && creationDone(player)) return <WelcomeBack data={await welcomeData(player)} onRestart={restartPlayer} />;
  if (user) redirect("/create");

  return (
    <GuestMap invited={params.invited === "1" || typeof params.ref === "string"} authError={typeof params.auth_error === "string"}
      at={typeof params.at === "string" ? params.at : undefined} creator={await creatorWelcome()} openSignUp={params.signup === "1"} />
  );
}

/** What the welcome screen shows: the home (layout, furniture), the outfit, and whether Start over is open. */
async function welcomeData(player: Player): Promise<WelcomeData> {
  const supabase = await getServerSupabase();
  const [row, items, restart] = supabase
    ? await Promise.all([
        supabase.from("players").select("house_sku, home_layout").eq("id", player.id).maybeSingle<{ house_sku: string | null; home_layout: unknown }>(),
        supabase.from("player_items").select("id, sku, category, equipped, options").eq("player_id", player.id),
        supabase.rpc("restart_status"),
      ])
    : [null, null, null];
  return {
    name: player.display_name, style: player.starting_style, look: player.look, bank: player.bank_cash, homeId: player.home_id!,
    houseSku: row?.data?.house_sku ?? null, homeLayout: row?.data?.home_layout ?? null,
    items: ((items?.data ?? []) as WelcomeItem[]).map((i) => ({ ...i, options: i.options ?? undefined })),
    restart: restart && !restart.error && restart.data ? (restart.data as WelcomeData["restart"]) : null,
  };
}
