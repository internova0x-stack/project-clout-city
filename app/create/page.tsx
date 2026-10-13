import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Creator, type CreatorStep } from "@/components/Creator";
import { GAME_CONFIG } from "@/lib/config";
import { normalizeLook } from "@/lib/look";
import { creationDone, getSession } from "@/lib/player";
import { createPlayer, moveIn, rollBirthLottery, saveTraits } from "./actions";

export const dynamic = "force-dynamic";

export const metadata = { title: "Create your character · Clout City" };

const STEP_FOR: Record<string, CreatorStep> = { look_done: 1, traits_done: 2, lottery_done: 3 };

export default async function CreatePage() {
  const { user, player } = await getSession();
  if (!user) redirect("/");
  if (player && creationDone(player)) redirect("/home");
  const ageCookie = (await cookies()).get(GAME_CONFIG.ageCookieName)?.value === "1";
  return (
    <Creator
      needsAgeConfirm={user.user_metadata?.age_confirmed !== true && !ageCookie}
      actions={{ createPlayer, saveTraits, rollBirthLottery, moveIn }}
      initialStep={player ? (STEP_FOR[player.onboarding_step] ?? 1) : 0}
      initialLook={player ? normalizeLook(player.look, player.starting_style) : undefined}
      initialTraits={player?.traits}
      initialCash={player?.birth_cash}
      initialName={player?.display_name}
    />
  );
}
