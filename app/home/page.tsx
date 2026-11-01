import {
  cancelJob, decorateSave, endJob, jobCheck, jobFinish, jobHome, jobSettle, jobsBoard, managerCollect, postJob, postTask, rateClient, rateJob, rideOffer, rideRespond, rideStatus, takeJob,
  togetherClaim, togetherInbox, togetherInvite, togetherRespond, togetherSeen,
} from "./togetherActions";
import { economyHistory, economySetOpen, economyState, giftAnswer, giftCandidates, giftInbox, giftSend } from "./economyActions";
import { marketBuy, marketCancel, marketCloset, marketList, marketPeople, marketSetOpen, marketState, tradeCancel, tradeConfirm, tradeEdit, tradeOffer } from "./marketActions";
import { assetAnswer, assetBuyers, assetCancel, assetOffer, assetSalesState } from "./assetActions";
import { coutureMap, plazaBook, plazaWeeks } from "./coutureActions";
import { businessState, buyBusiness, collectTills, goPublic, upgradeBusiness } from "./businessActions";
import { cookies } from "next/headers";
import { GameShell } from "@/components/GameShell";
import { GAME_CONFIG } from "@/lib/config";
import { loadCityState } from "@/lib/cityServer";
import { getClique, requirePlayer } from "@/lib/player";
import { getServerSupabase } from "@/lib/supabase/server";
import { attendFirstParty, finishHandoff, setMusicMuted, setTutorialState } from "./actions";
import {
  acceptGig, attendClubEvent, attendExclusiveEvent, buyItem, collectGig, doCityAction, equipItem, setItemOptions, payBill, saveLook, travel, skipTrip, buyTransitPass, watchShowtime, calendarAttend, buyGift, rest, barDrink, enterVip, vipSeen, buyGroceries, cook, buyLottoCard, scratchLottoCard, refreshCity, takeSkillGig, collectSkillGig, acceptSkillInvite, saveHomeLayout, moveHome, sellItem, setClockOffset,
} from "./cityActions";
import {
  attendStoryEvent, completeStoryTask, devEntitleStory, devStartStory, loadStoryFeed, markBeatSeen, readStoryPost, refreshStory, shadowGuessStory, voteStory,
} from "./storyActions";
import { loadCatalog, startCheckout } from "./storeActions";
import { steamCheckout, steamFinish } from "./steamStoreActions";
import { membershipPortal, membershipState } from "./membershipActions";
import {
  chatBlock, chatList, chatCrowned, chatReact, chatReport, chatSend, chatSetMessagesFrom, chatStatus, chatThread, mySkills, boroughState, placeCounts, placePresence, playerCard, sessionPing, skillsOf, track,
} from "./chatActions";
import { crewCreate, crewInbox, crewMembers, crewRespond } from "./crewActions";
import { loadNews } from "./newsActions";
import { syncGossipWeeks } from "@/lib/gossipImport";
import { syncWeeklyContent } from "@/lib/contentImport";
import { gossipFind, gossipShare, gossipState } from "./gossipActions";
import { partyInbox, partyInvite, partyMentions, partyRespond, setNewsOptOut } from "./partyActions";
import { partyRoomReport, partyRoomSay, partyRoomState } from "./partyRoomActions";
import { radioReport, radioRequest, radioState } from "./radioActions";
import { mayorSeen, mayorState, mayorWrite } from "./mayorActions";
import { characterRemembered } from "./characterActions";
import { choiceBail, choiceBlotter, choiceConditions, choiceChoose, choiceOffer, choiceSeen, choiceSkip, choiceState } from "./choiceActions";
import { underworldDeclineHire, underworldHire, underworldHires, underworldJob, underworldLawyer, underworldRunHire, underworldRunners, underworldScreen, underworldSeen, underworldTable } from "./underworldActions";
import { galaDonate, galaState } from "./galaActions";
import { careerApply, careerOffice, careerQuit, careerStick, careerAspire, careerScreen, careerStart, careerTask } from "./careerActions";
import { campaignBudget, campaignChoose, campaignDebate, campaignDilemma, campaignEndWeek, campaignReply, campaignScreen, campaignSlot, campaignStart } from "./campaignActions";
import { stationInbox, stationRead, tvState, tvSubmit, tvWithdraw } from "./tvActions";
import { huntAnswer, huntJoin, huntState, huntTalk } from "./huntActions";
import { goalsState, spendGuestPass } from "./goalsActions";
import { passClaimAll, passState, starterPackState } from "./seasonActions";
import { lifeActivity, lifeMoment, lifePlace, lifePlayMoment, lifeStamp, lifeToday } from "./placeLifeActions";
import { pushAsked, pushPrefs, pushSetOff, pushSubscribe, pushTest, pushUnsubscribe } from "./pushActions";
import { kickPush } from "@/lib/pushServer";
import { after } from "next/server";
import { campusAttend, campusEat, campusEnrol, campusExam, campusLeaderboard, campusPick, campusState, campusSubmit } from "./campusActions";
import { crushStatus, crushToggle, dateCancel, dateCandidates, dateInvite, dateRespond, datingInbox, matchSeen } from "./datingActions";
import {
  cohabitAnswer, cohabitAsk, cohabitCancel, cohabitHang, cohabitHome, cohabitLeave,
  coupleAnswer, coupleAsk, coupleEnd, coupleGift, coupleSeen, coupleShow, coupleState,
} from "./coupleActions";
import {
  subletAnswer, subletApply, subletHang, subletHome, subletLeave, subletList, subletNotice, subletRate, subletRenew, subletRenewAnswer,
  subletSeen, subletShow, subletState, subletUnlist, subletWithdraw,
} from "./subletActions";
import { homeScoreState } from "./homeScoreActions";
import { AnalyticsUser } from "@/components/Analytics";
import { starterHide, starterState } from "./starterActions";
import { deleteAccount } from "./accountActions";
import { visitAnswer, visitArrive, visitEnd, visitHome, visitHost, visitLeave, visitRoom, visitSay, visitSendHome, visitState } from "./visitActions";

export const dynamic = "force-dynamic";

export const metadata = { title: "Home · Clout City" };

export default async function HomePage() {
  const { player } = await requirePlayer();
  // Owner, Oct 15: a friend's invite from a place opens that place (the /i/CODE?at= link's cookie).
  const invitedAt = (await cookies()).get(GAME_CONFIG.invite.placeCookieName)?.value;
  const supabase = await getServerSupabase();
  // Gossip weeks, news and hunts go live on their own: store the repo's week files (at most every 10 minutes).
  await Promise.all([syncGossipWeeks().catch(() => []), syncWeeklyContent().catch(() => [])]);
  // The profile's Queens rank and skills come with the page, so they're there the moment it opens (owner, Oct 22).
  // Migration 0151 switches on the Player Economy (economy_state failing hides gifts and the jobs board's new kinds).
  const econP = economyState();
  const [clique, city, story, catalog, chat, dating, crew, party, together, campus, myCard, skills, couple, subletS, homeS, visitS, starterS] = await Promise.all([
    getClique(), supabase ? loadCityState(supabase) : null, loadStoryFeed(), loadCatalog(), chatStatus(), datingInbox(), crewInbox(), partyInbox(), togetherInbox(), campusState(),
    playerCard(player.id), mySkills().catch(() => null), coupleState(), subletState(), homeScoreState(), visitState(), starterState(),
  ]);
  const econ = await econP;
  // Push notifications: game traffic nudges the sender (at most once a minute per server); a cron covers quiet times.
  after(() => kickPush());
  // Migration 0010 switches on chat; a banned account sees only a notice.
  const chatOn = chat.ok;
  if (chat.ok && chat.data.banned) return <Suspended />;
  return (
    <>
    <AnalyticsUser id={player.id} />
    <GameShell
      invitedAt={invitedAt}
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
        setItemOptions,
        saveLook,
        travel,
        skipTrip,
        buyTransitPass,
        watchShowtime,
        calendarAttend,
        buyGift,
        rest,
        barDrink,
        buyGroceries,
        cook,
        buyLottoCard,
        scratchLottoCard,
        payBill,
        setClockOffset,
        saveHomeLayout,
        moveHome,
        enterVip,
        vipSeen,
        takeSkillGig,
        collectSkillGig,
        acceptSkillInvite,
      }}
      story={city ? story : null}
      storyApi={city && story ? {
        refresh: refreshStory,
        vote: voteStory,
        shadowGuess: shadowGuessStory,
        markSeen: markBeatSeen,
        readPost: readStoryPost,
        completeTask: completeStoryTask,
        attendEvent: attendStoryEvent,
        ...(city.devTools ? { devStart: devStartStory, devEntitle: devEntitleStory } : {}),
      } : undefined}
      catalog={catalog}
      storeApi={catalog ? { catalog: loadCatalog, checkout: startCheckout, steamCheckout, steamFinish } : undefined}
      coutureApi={{ map: coutureMap, weeks: plazaWeeks, book: plazaBook }}
      membership={catalog ? { state: membershipState, portal: membershipPortal } : undefined}
      // Migration 0047 (owner, Oct 15: two players in the same café couldn't see each other, because
      // presence, place counts, reactions and the message setting were never passed in here).
      chat={chatOn ? {
        list: chatList, thread: chatThread, crowned: chatCrowned, send: chatSend, status: chatStatus, block: chatBlock, report: chatReport, card: playerCard,
        react: chatReact, setMessagesFrom: chatSetMessagesFrom, presence: placePresence, counts: placeCounts, skills: skillsOf,
      } : undefined}
      track={chatOn ? track : undefined}
      // Migration 0053: session length for the Studio's Insights (a missing function is ignored).
      ping={sessionPing}
      // Migration 0056: the profile's Skills tab (no tab before the migration).
      loadSkills={mySkills}
      skills={skills ?? undefined}
      initialCard={myCard.ok ? myCard.data : null}
      loadBoroughs={boroughState}
      // Migration 0017 switches on City News (an empty feed hides it).
      cityNews={loadNews}
      // Migration 0018 switches on treasure hunts (hunt_state() failing hides the Hunt tab).
      hunt={city ? { state: huntState, join: huntJoin, talk: huntTalk, answer: huntAnswer } : undefined}
      // Migration 0050 switches on together bonuses, rides and the Jobs app (together_inbox failing hides them).
      together={city && together.ok ? {
        inbox: togetherInbox, invite: togetherInvite, respond: togetherRespond, claim: togetherClaim, seen: togetherSeen,
        rideOffer, rideRespond, rideStatus,
        jobs: {
          board: jobsBoard, post: postJob, cancel: cancelJob, take: takeJob, home: jobHome, save: decorateSave, finish: jobFinish, settle: jobSettle, rate: rateJob, collect: managerCollect, end: endJob,
          ...(econ.ok ? { postTask, check: jobCheck, rateClient } : {}),
        },
      } : undefined}
      economy={city && econ.ok ? {
        state: economyState, setOpen: economySetOpen, history: economyHistory, candidates: giftCandidates, inbox: giftInbox, send: giftSend, answer: giftAnswer,
      } : undefined}
      // Migration 0152: the Market (it says "Opening soon" while the Studio keeps phase 2 off).
      market={city && econ.ok ? {
        state: marketState, people: marketPeople, closet: marketCloset, list: marketList, cancel: marketCancel, buy: marketBuy,
        offer: tradeOffer, edit: tradeEdit, confirm: tradeConfirm, cancelTrade: tradeCancel, setOpen: marketSetOpen,
      } : undefined}
      // Phase 3 (migration 0153): business and property sales (before 0153, or switched off, the panels stay hidden).
      assets={city && econ.ok ? { state: assetSalesState, buyers: assetBuyers, offer: assetOffer, answer: assetAnswer, cancel: assetCancel } : undefined}
      // Migrations 0073 and 0074: goals, streaks and guest-list passes (goals_state failing just hides them).
      goals={city ? { state: goalsState, usePass: spendGuestPass } : undefined}
      // Migration 0156: the Clout Pass (Tasks → Pass) and the starter pack (season_state failing hides them).
      pass={city ? { state: passState, claimAll: passClaimAll, starter: starterPackState } : undefined}
      // Migration 0157: Living places (things to do at each place, happenings, crowd moments, regular cards).
      life={city ? { view: lifePlace, activity: lifeActivity, moment: lifeMoment, playMoment: lifePlayMoment, stamp: lifeStamp, today: lifeToday } : undefined}
      // Migration 0078: push notifications (Settings → Notifications and Lola's ask).
      push={city ? { prefs: pushPrefs, subscribe: pushSubscribe, unsubscribe: pushUnsubscribe, setOff: pushSetOff, asked: pushAsked, test: pushTest } : undefined}
      // Migration 0072 switches on campus life (campus_state failing hides it).
      campus={city && campus.ok ? {
        state: campusState, enrol: campusEnrol, pick: campusPick, attend: campusAttend, exam: campusExam, submit: campusSubmit, eat: campusEat, leaderboard: campusLeaderboard,
      } : undefined}
      // Migration 0057 switches on Real Clout FM (radio_state failing hides the Radio app).
      radio={city ? { state: radioState, request: radioRequest, report: radioReport } : undefined}
      // Migration 0105 opens the Mayor's office (mayor_letters_state failing hides the Mayor app).
      mayor={city ? { state: mayorState, write: mayorWrite, seen: mayorSeen } : undefined}
      // Migration 0127: Campaign Mode (the sheet says so if it hasn't run yet).
      campaign={city ? {
        screen: campaignScreen, start: campaignStart, budget: campaignBudget, slot: campaignSlot, reply: campaignReply,
        dilemma: campaignDilemma, debate: campaignDebate, endWeek: campaignEndWeek, choose: campaignChoose,
      } : undefined}
      // Migration 0135: Careers (the sheet says so if it hasn't run yet).
      underworld={city ? {
        screen: underworldScreen, job: underworldJob, lawyer: underworldLawyer, seen: underworldSeen, table: underworldTable,
        // Migration 0152: runners (underworld jobs between players).
        ...(econ.ok ? { hires: underworldHires, runners: underworldRunners, hire: underworldHire, runHire: underworldRunHire, declineHire: underworldDeclineHire } : {}),
      } : undefined}
      gala={city ? { state: galaState, donate: galaDonate } : undefined}
      careers={city ? { screen: careerScreen, apply: careerApply, start: careerStart, task: careerTask, office: careerOffice, quit: careerQuit, stick: careerStick, aspire: careerAspire } : undefined}
      // Migration 0131: Moral Choices (the actions answer quietly until it has run).
      choices={city ? { state: choiceState, offer: choiceOffer, choose: choiceChoose, skip: choiceSkip, seen: choiceSeen, bail: choiceBail, blotter: choiceBlotter, conditions: choiceConditions } : undefined}
      remembered={city ? characterRemembered : undefined}
      // Migration 0058 switches on Clout TV (tv_state failing hides it). Photos upload from the browser.
      tv={city ? { state: tvState, submit: tvSubmit, withdraw: tvWithdraw } : undefined}
      stations={city ? { inbox: stationInbox, read: stationRead } : undefined}
      business={city ? { state: businessState, buy: buyBusiness, upgrade: upgradeBusiness, collect: collectTills, goPublic } : undefined}
      // Migration 0035 switches on gossip (gossip_state returns null before it runs).
      gossip={city ? { state: gossipState, find: gossipFind, share: gossipShare } : undefined}
      // Migration 0013 switches on crew outings.
      crew={city && crew.ok ? { inbox: crewInbox, members: crewMembers, create: crewCreate, respond: crewRespond } : undefined}
      // Migration 0029 switches on party keepsakes (plus-ones, "Spotted at", the gossip setting).
      party={city && catalog && party ? { inbox: partyInbox, invite: partyInvite, respond: partyRespond, mentions: partyMentions, setNewsOptOut } : undefined}
      partyInbox={party}
      // Migration 0038 switches on party rooms (party_room failing keeps the crowd and chat hidden).
      partyRoom={city && catalog ? { room: partyRoomState, say: partyRoomSay, report: partyRoomReport } : undefined}
      // Migration 0011 switches on crushes and date nights.
      dating={chatOn && dating.ok ? {
        inbox: datingInbox, crushStatus, crush: crushToggle, matchSeen, candidates: dateCandidates,
        invite: dateInvite, respond: dateRespond, cancel: dateCancel,
      } : undefined}
      // Migration 0118 switches on relationships (couple_state fails before it runs).
      couple={chatOn && dating.ok && couple.ok ? {
        state: coupleState, ask: coupleAsk, answer: coupleAnswer, end: coupleEnd, show: coupleShow, gift: coupleGift, seen: coupleSeen,
        // Migration 0149 switches on living together (couple_state carries `home` once it has run).
        moveIn: couple.data && "home" in couple.data ? {
          ask: cohabitAsk, cancel: cohabitCancel, answer: cohabitAnswer, leave: cohabitLeave, hang: cohabitHang, home: cohabitHome,
        } : undefined,
      } : undefined}
      // Migration 0120 switches on the home score's milestones (the score shows either way).
      homeScoreApi={homeS.ok ? { state: homeScoreState } : undefined}
      // Migration 0122 switches on Starter Week (starter_state fails before it runs).
      starter={starterS.ok ? { state: starterState, hide: starterHide } : undefined}
      // Migration 0124 switches on Delete my account (account_delete_prepare fails before it runs, and nothing is deleted).
      deleteAccount={deleteAccount}
      // Migration 0121 switches on having people over (visit_state fails before it runs).
      visits={visitS.ok ? {
        state: visitState, host: visitHost, end: visitEnd, sendHome: visitSendHome, answer: visitAnswer, arrive: visitArrive,
        leave: visitLeave, room: visitRoom, home: visitHome, say: visitSay,
      } : undefined}
      // Migration 0119 switches on sublets (sublet_state fails before it runs).
      sublet={subletS.ok ? {
        state: subletState, home: subletHome, list: subletList, unlist: subletUnlist, apply: subletApply, withdraw: subletWithdraw,
        answer: subletAnswer, notice: subletNotice, leave: subletLeave, renew: subletRenew, renewAnswer: subletRenewAnswer,
        hang: subletHang, show: subletShow, rate: subletRate, seen: subletSeen,
      } : undefined}
    />
    </>
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
