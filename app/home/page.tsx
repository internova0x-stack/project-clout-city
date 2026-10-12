import { GameShell } from "@/components/GameShell";
import { loadCityState } from "@/lib/cityServer";
import { getClique, requirePlayer } from "@/lib/player";
import { getServerSupabase } from "@/lib/supabase/server";
import { attendFirstParty, finishHandoff, setMusicMuted, setTutorialState } from "./actions";
import {
  acceptGig, attendClubEvent, buyItem, collectGig, doCityAction, equipItem, payBill, refreshCity, saveHomeLayout, sellItem, setClockOffset,
} from "./cityActions";
import {
  attendStoryEvent, completeStoryTask, devEntitleStory, devStartStory, loadStoryFeed, markBeatSeen, refreshStory, shadowGuessStory, voteStory,
} from "./storyActions";

export const dynamic = "force-dynamic";

export const metadata = { title: "Home · Clout City" };

export default async function HomePage() {
  const { player } = await requirePlayer();
  const supabase = await getServerSupabase();
  const [clique, city, story] = await Promise.all([getClique(), supabase ? loadCityState(supabase) : null, loadStoryFeed()]);
  return (
    <GameShell
      player={city ? { ...player, ...city.player } : player}
      clique={clique}
      actions={{ setTutorialState, attendFirstParty, finishHandoff, setMusicMuted }}
      city={city}
      cityApi={{
        refresh: refreshCity,
        doAction: doCityAction,
        attendEvent: attendClubEvent,
        acceptGig,
        collectGig,
        buyItem,
        sellItem,
        equipItem,
        payBill,
        setClockOffset,
        saveHomeLayout,
      }}
      story={city ? story : null}
      storyApi={city && story ? {
        refresh: refreshStory,
        vote: voteStory,
        shadowGuess: shadowGuessStory,
        markSeen: markBeatSeen,
        completeTask: completeStoryTask,
        attendEvent: attendStoryEvent,
        ...(city.devTools ? { devStart: devStartStory, devEntitle: devEntitleStory } : {}),
      } : undefined}
    />
  );
}
