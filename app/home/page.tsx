import { GameShell } from "@/components/GameShell";
import { loadCityState } from "@/lib/cityServer";
import { getClique, requirePlayer } from "@/lib/player";
import { getServerSupabase } from "@/lib/supabase/server";
import { attendFirstParty, finishHandoff, setMusicMuted, setTutorialState } from "./actions";
import {
  acceptGig, attendClubEvent, buyItem, collectGig, doCityAction, equipItem, payBill, refreshCity, saveHomeLayout, sellItem, setClockOffset,
} from "./cityActions";

export const dynamic = "force-dynamic";

export const metadata = { title: "Home · Clout City" };

export default async function HomePage() {
  const { player } = await requirePlayer();
  const supabase = await getServerSupabase();
  const [clique, city] = await Promise.all([getClique(), supabase ? loadCityState(supabase) : null]);
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
    />
  );
}
