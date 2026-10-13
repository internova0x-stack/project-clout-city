import { GameShell } from "@/components/GameShell";
import { loadCityState } from "@/lib/cityServer";
import { getClique, requirePlayer } from "@/lib/player";
import { getServerSupabase } from "@/lib/supabase/server";
import { attendFirstParty, finishHandoff, setMusicMuted, setTutorialState } from "./actions";
import {
  acceptGig, attendClubEvent, attendExclusiveEvent, buyItem, collectGig, doCityAction, equipItem, payBill, saveLook, travel, rest, barDrink, buyGroceries, cook, buyLottoCard, scratchLottoCard, refreshCity, saveHomeLayout, sellItem, setClockOffset,
} from "./cityActions";
import {
  attendStoryEvent, completeStoryTask, devEntitleStory, devStartStory, loadStoryFeed, markBeatSeen, refreshStory, shadowGuessStory, voteStory,
} from "./storyActions";
import { loadCatalog, startCheckout } from "./storeActions";
import { chatBlock, chatList, chatReport, chatSend, chatStatus, chatThread, playerCard, track } from "./chatActions";
import { crewCreate, crewInbox, crewMembers, crewRespond } from "./crewActions";
import { loadNews } from "./newsActions";
import { partyInbox, partyInvite, partyMentions, partyRespond, setNewsOptOut } from "./partyActions";
import { huntAnswer, huntJoin, huntState, huntTalk } from "./huntActions";
import { crushStatus, crushToggle, dateCancel, dateCandidates, dateInvite, dateRespond, datingInbox, matchSeen } from "./datingActions";

export const dynamic = "force-dynamic";

export const metadata = { title: "Home · Clout City" };

export default async function HomePage() {
  const { player } = await requirePlayer();
  const supabase = await getServerSupabase();
  const [clique, city, story, catalog, chat, dating, crew, party] = await Promise.all([
    getClique(), supabase ? loadCityState(supabase) : null, loadStoryFeed(), loadCatalog(), chatStatus(), datingInbox(), crewInbox(), partyInbox(),
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
        saveLook,
        travel,
        rest,
        barDrink,
        buyGroceries,
        cook,
        buyLottoCard,
        scratchLottoCard,
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
      // Migration 0017 switches on City News (an empty feed hides it).
      cityNews={loadNews}
      // Migration 0018 switches on treasure hunts (hunt_state() failing hides the Hunt tab).
      hunt={city ? { state: huntState, join: huntJoin, talk: huntTalk, answer: huntAnswer } : undefined}
      // Migration 0013 switches on crew outings.
      crew={city && crew.ok ? { inbox: crewInbox, members: crewMembers, create: crewCreate, respond: crewRespond } : undefined}
      // Migration 0029 switches on party keepsakes (plus-ones, "Spotted at", the gossip setting).
      party={city && catalog && party ? { inbox: partyInbox, invite: partyInvite, respond: partyRespond, mentions: partyMentions, setNewsOptOut } : undefined}
      partyInbox={party}
      // Migration 0011 switches on crushes and date nights.
      dating={chatOn && dating.ok ? {
        inbox: datingInbox, crushStatus, crush: crushToggle, matchSeen, candidates: dateCandidates,
        invite: dateInvite, respond: dateRespond, cancel: dateCancel,
      } : undefined}
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
