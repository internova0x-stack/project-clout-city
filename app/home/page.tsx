import { GameShell } from "@/components/GameShell";
import { loadCityState } from "@/lib/cityServer";
import { getClique, requirePlayer } from "@/lib/player";
import { getServerSupabase } from "@/lib/supabase/server";
import { attendFirstParty, finishHandoff, setMusicMuted, setTutorialState } from "./actions";
import {
  acceptGig, attendClubEvent, attendExclusiveEvent, buyItem, collectGig, doCityAction, equipItem, payBill, refreshCity, saveHomeLayout, sellItem, setClockOffset,
} from "./cityActions";
import {
  attendStoryEvent, completeStoryTask, devEntitleStory, devStartStory, loadStoryFeed, markBeatSeen, refreshStory, shadowGuessStory, voteStory,
} from "./storyActions";
import { loadCatalog, startCheckout } from "./storeActions";
import { chatBlock, chatList, chatReport, chatSend, chatStatus, chatThread, playerCard, track } from "./chatActions";

export const dynamic = "force-dynamic";

export const metadata = { title: "Home · Clout City" };

export default async function HomePage() {
  const { player } = await requirePlayer();
  const supabase = await getServerSupabase();
  const [clique, city, story, catalog, chat] = await Promise.all([
    getClique(), supabase ? loadCityState(supabase) : null, loadStoryFeed(), loadCatalog(), chatStatus(),
  ]);
  // Migration 0010 switches on chat; a banned account sees only a notice.
  const chatOn = chat.ok;
  if (chat.ok && chat.data.banned) return <Suspended />;
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
        attendExclusiveEvent,
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
      catalog={catalog}
      storeApi={catalog ? { catalog: loadCatalog, checkout: startCheckout } : undefined}
      chat={chatOn ? { list: chatList, thread: chatThread, send: chatSend, status: chatStatus, block: chatBlock, report: chatReport, card: playerCard } : undefined}
      track={chatOn ? track : undefined}
    />
  );
}

function Suspended() {
  return (
    <main className="studio studio-gate">
      <section className="studio-card stack-12">
        <h1 className="display-lg" style={{ margin: 0 }}>Account suspended</h1>
        <p className="body" style={{ margin: 0 }}>After a review of reported messages, this account can&apos;t play right now.</p>
        <form action="/auth/signout" method="post"><button className="btn btn-secondary" type="submit">Log out</button></form>
      </section>
    </main>
  );
}
