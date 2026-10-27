import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AnalyticsUser } from "@/components/Analytics";
import { Creator, type CreatorStep } from "@/components/Creator";
import { GAME_CONFIG } from "@/lib/config";
import { normalizeLook } from "@/lib/look";
import { creationDone, getSession } from "@/lib/player";
import { getServerSupabase } from "@/lib/supabase/server";
import { createPlayer, moveIn, restartLook, rollBirthLottery, saveTraits } from "./actions";

export const dynamic = "force-dynamic";

export const metadata = { title: "Create your character · Clout City" };

const STEP_FOR: Record<string, CreatorStep> = { look_done: 1, traits_done: 2, lottery_done: 3 };

export default async function CreatePage() {
  const { user, player } = await getSession();
  if (!user) redirect("/");
  if (player && creationDone(player)) redirect("/home");
  const ageCookie = (await cookies()).get(GAME_CONFIG.ageCookieName)?.value === "1";
  // Start over (migration 0114): back to the look step with the username kept, until the new look is saved.
  const restarting = player ? await restartPending() : false;
  return (
    <>
    {/* No player yet: the account was just made (signup_completed, once). */}
    <AnalyticsUser id={user.id} newAccount={!player} />
    <Creator
      needsAgeConfirm={!restarting && user.user_metadata?.age_confirmed !== true && !ageCookie}
      actions={{ createPlayer: restarting ? restartLook : createPlayer, saveTraits, rollBirthLottery, moveIn }}
      restarting={restarting}
      initialStep={restarting ? 0 : player ? (STEP_FOR[player.onboarding_step] ?? 1) : 0}
      initialLook={player ? normalizeLook(player.look, player.starting_style) : undefined}
      initialTraits={player?.traits}
      initialCash={player?.birth_cash}
      initialName={player?.display_name}
    />
    </>
  );
}

/** True while a player who started over hasn't saved their new look (false before migration 0114). */
async function restartPending(): Promise<boolean> {
  const supabase = await getServerSupabase();
  if (!supabase) return false;
  const { data, error } = await supabase.rpc("restart_pending");
  return !error && data === true;
}
