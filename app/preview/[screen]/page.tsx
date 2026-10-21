import { AvatarMoves } from "@/components/preview/AvatarMoves";
import { previewShopAction, previewShopAudit, previewShopNewDrop, previewShopEdit, previewShopFiles, previewShopImport, previewShopList, previewShopProcessImages } from "../shopActions";
import { notFound } from "next/navigation";
import { ECONOMY } from "@/lib/economy";
import { Creator, type CreatorStep } from "@/components/Creator";
import type { Flow } from "@/components/GameShell";
import { PreviewHome } from "@/components/preview/PreviewHome";
import { PreviewArt } from "@/components/preview/PreviewArt";
import { PreviewRoom } from "@/components/preview/PreviewRoom";
import { GuestMap } from "@/components/GuestMap";
import { Studio } from "@/components/studio/Studio";
import { CreatorDashboard } from "@/components/creator/CreatorDashboard";
import type { StudioArc } from "@/lib/studio";
import {
  previewStudioBeatEdit, previewStudioBeatStatus, previewStudioContent, previewStudioGoLive, previewStudioReorder, previewStudioList, previewStudioReview, previewStudioSchedule, previewStudioSetDay,
  previewStudioStatus, previewStudioUpload,
} from "../studioActions";
import {
  previewChatBlock, previewChatList, previewChatReport, previewChatSend, previewChatStatus, previewChatThread, previewLeaderboard,
  previewPlayerCard, previewStudioInsights, previewStudioMetrics, previewStudioPlayer, previewStudioPlayerBan, previewStudioPlayers, previewStudioReportAction, previewStudioReports,
} from "../chatActions";
import { previewCastAdd, previewCastLines, previewCastStatus } from "../castActions";
import { previewCreatorMe, previewStudioVideos, previewStudioVideoSave, previewStudioVideoStatus, previewStudioPayoutMark, previewStudioPayoutVoid, previewStudioPayouts, previewStudioAffiliates, previewStudioAffiliatesOverview, previewStudioCreatorPage, previewStudioCreatorSave, previewStudioLinkSave, previewStudioLinkStatus } from "../creatorActions";
import { previewNewsList, previewNewsReschedule, previewNewsStatus, previewNewsUpload } from "../newsActions";
import { previewDrafts, previewHuntList, previewGossipList, previewGossipStatus, previewHuntStatus, previewHuntUpload, previewSetupCheck } from "../huntActions";
import { previewStudioShoutoutAction, previewStudioShoutouts } from "../radioActions";
import { previewStudioBigScreen, previewStudioBigScreenAction } from "../tvActions";
import { normalizeLook } from "@/lib/look";
import type { Player } from "@/lib/player";

// Development-only previews of signed-in screens with sample data, so they can be
// checked without a Supabase project. Nothing is saved. Never served in production.
//   /preview/guest            the guest screen
//   /preview/creator?step=0-3 a creator step
//   /preview/home?state=new   right after "Move in" (welcome, tour, party)
//   /preview/home?campus=new|pick|week|friday|done  campus life (v0.15), standing at St. Johnsons
//   /preview/home?transit=showtime  showtime dancers on every subway ride (C4); ?transit=pass starts with an OMG Card.
//   The preview's News always has a live 7-train delay, so trips to Flushing take longer by subway.
//   /preview/home?calendar=today  every calendar event (C5) is on right now; ?calendar=gift also starts with a gift box
//   /preview/home?couture=soldout  every Clout Couture drop has sold out (migration 0102)
//   /preview/home?skills=pro  high skill levels, so skill gigs, invites and Dance's club access are open (migration 0092)
//   /preview/home?member=vip|monthly|cancelling|pastdue|forever|free|none  Membership & purchases (Settings, profile)
//   /preview/home?hint=daily  Lola's daily-tasks nudge (owner, Oct 17) after 2 seconds
//   /preview/home             a player who has finished the first session
//   /preview/home?flow=pwa    open one step of the first session (welcome, tour, party, partyDone, leaderboard, invitePrompt, pwa)
//   /preview/home?city=off    the home screen before migration 0004 (city screens say "coming soon")
//   /preview/home?mood=natural   the plain room lighting, for comparison
//   /preview/home?dev=1          show the staging time-travel pill
//   /preview/home?tasks=done     all five daily tasks done (the HUD's finished state)
//   /preview/home?hunt=joined   treasure hunt: new (not joined), joined, question (step 2 asked), wrong (waiting), finale (last step), done (found, badge)
//   /preview/home?party=invite   party plus-ones: invite (dana.vibes asks you), sent (you have a Jada ticket, Marco is your plus-one), ticket (a ticket, no plus-one yet)
//   /preview/home?crew=invite   crew outings: invite (Marco asks you out), tonight (you're hosting), full (your visit completes it), empty (no crew)
//   /preview/home?dating=match   crushes and date nights: match (an unseen "It's mutual"), invite (a date invite waiting), tonight (a date in progress), alone (nobody to ask yet)
//   /preview/home?story=3        start the Sarah Bird pilot so today is story Day 3 (story=off hides stories)
//   /preview/studio            the Story Studio on an in-memory copy of content/stories (&live=3: the pilot is on Day 3)
//   /preview/art             every location illustration, day and night
//   /preview/room?room=cafe|club|counter|astoria_studio|<place id>&time=night   one 3D room on its own (&mood=natural to compare)
//   add &time=day or &time=night to pin the map

const SAMPLE: Player = {
  id: "00000000-0000-0000-0000-000000000000",
  display_name: "bigsal",
  starting_style: "arcade_nerd",
  look: { body: "curvy", skin: "#8D5524", hair: "braids", hairColor: "#14100E", eyes: "#3B2314", glasses: "round", covering: "none" },
  invite_code: "Q7MZ4K",
  onboarding_step: "handoff_done",
  created_at: new Date(0).toISOString(),
  traits: ["loud", "hustler"],
  birth_cash: 7400,
  home_id: "astoria_studio",
  bank_cash: 5450,
  clout: 850,
  energy: 80,
  mood: 60,
  confidence: 55,
  tutorial_state: "done",
  first_party_at: new Date(0).toISOString(),
  music_muted: false,
};

export default async function Preview({
  params,
  searchParams,
}: {
  params: Promise<{ screen: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const { screen } = await params;
  const { time, step, state, flow, city, room, mood, dev, story, live, tasks, dating, crew, party, hunt, lotto, gossip, rankup, biz, together, radio, tv, brooklyn, hint, campus, goals, push, member, via, skills, transit, calendar, couture, skin, build, outfit, size, pick } = await searchParams;
  const daytimeOverride = time === "day" ? true : time === "night" ? false : undefined;

  switch (screen) {
    case "guest":
      // ?via=tasha: a guest who followed a creator's link (migration 0087); ?via=tasha-signup lands on sign-up.
      return <GuestMap invited={false} authError={false} creator={via ? { name: "Tasha Glow", giftCash: 500, giftItem: "fit-bucket-hat" } : null} openSignUp={via === "tasha-signup"} />;
    case "creator": {
      const s = Math.min(3, Math.max(0, Number(step ?? 0))) as CreatorStep;
      return (
        <Creator
          needsAgeConfirm={false}
          initialStep={s}
          initialLook={s > 0 ? normalizeLook(SAMPLE.look, SAMPLE.starting_style) : undefined}
          initialName={s > 0 ? SAMPLE.display_name : undefined}
          initialTraits={s > 1 ? SAMPLE.traits : []}
          initialCash={s > 2 ? 4400 : null}
          actions={{
            createPlayer: async () => {
              "use server";
              return { ok: true as const };
            },
            saveTraits: async () => {
              "use server";
              return { ok: true as const };
            },
            rollBirthLottery: async () => {
              "use server";
              return { ok: true as const, cash: ECONOMY.birthLottery.min + ECONOMY.birthLottery.step * Math.floor(Math.random() * ((ECONOMY.birthLottery.max - ECONOMY.birthLottery.min) / ECONOMY.birthLottery.step + 1)) };
            },
            moveIn: async () => {
              "use server";
              return { ok: false as const, error: "Preview only: nothing is saved." };
            },
          }}
        />
      );
    }
    case "home": {
      const fresh = state === "new";
      const player: Player = fresh
        ? { ...SAMPLE, onboarding_step: "home_done", tutorial_state: "pending", first_party_at: null, clout: 0, bank_cash: 5300, energy: 100, confidence: 40, home_id: "astoria_share" }
        : SAMPLE;
      return (
        <PreviewHome
          player={player}
          daytimeOverride={daytimeOverride}
          flow={flow as Flow | undefined}
          cityOff={city === "off"}
          roomMood={mood === "natural" ? "natural" : "dream"}
          devTools={dev === "1"}
          storyOff={story === "off"}
          tasksDone={tasks === "done"}
          datingPreset={dating}
          crewPreset={crew}
          partyPreset={party}
          huntPreset={hunt}
          lottoPreset={lotto}
          gossipPreset={gossip}
          dailyHintPreset={hint === "daily"}
          campusPreset={campus}
          skillsPreset={skills}
          transitPreset={transit}
          calendarPreset={calendar}
          couturePreset={couture}
          goalsPreset={goals}
          pushPreset={push}
          memberPreset={member}
          rankUpPreset={Number(rankup) || undefined}
          radioPreset={radio}
          tvPreset={tv}
          brooklynPreset={brooklyn}
          bizPreset={biz}
          togetherPreset={together}
          storyDay={story && /^\d+$/.test(story) ? Number(story) : undefined}
          clique={[
            { display_name: "tasha.b", starting_style: "pilates_princess", joined_at: new Date(0).toISOString() },
            { display_name: "Marco", starting_style: "midtown_finance", joined_at: new Date(1).toISOString() },
          ]}
        />
      );
    }
    case "affiliate":
      // The creator page (/creator, migration 0089) with sample numbers; ?state=new|paused.
      return <CreatorDashboard me={await previewCreatorMe(state)} who="tasha@example.com" preview />;
    case "studio": {
      const r = live && /^\d+$/.test(live) ? await previewStudioSetDay("sarah-bird", Number(live)) : await previewStudioList();
      return (
        <Studio
          preview
          who="preview"
          initial={r.ok ? r.arcs : ([] as StudioArc[])}
          api={{
            upload: previewStudioUpload, review: previewStudioReview, schedule: previewStudioSchedule, status: previewStudioStatus,
            beatStatus: previewStudioBeatStatus, content: previewStudioContent, reorder: previewStudioReorder, beatEdit: previewStudioBeatEdit, goLive: previewStudioGoLive,
            shopList: previewShopList, shopFiles: previewShopFiles, shopImport: previewShopImport, shopProcessImages: previewShopProcessImages,
            shopAction: previewShopAction, shopEdit: previewShopEdit, shopAudit: previewShopAudit, shopNewDrop: previewShopNewDrop,
            reports: previewStudioReports, reportAction: previewStudioReportAction, metrics: previewStudioMetrics, insights: previewStudioInsights, players: previewStudioPlayers, player: previewStudioPlayer, playerBan: previewStudioPlayerBan,
            affiliates: previewStudioAffiliates, affiliatesOverview: previewStudioAffiliatesOverview, creatorPage: previewStudioCreatorPage, payouts: previewStudioPayouts, payoutMark: previewStudioPayoutMark, payoutVoid: previewStudioPayoutVoid, videos: previewStudioVideos, videoSave: previewStudioVideoSave, videoStatus: previewStudioVideoStatus, creatorSave: previewStudioCreatorSave, linkSave: previewStudioLinkSave, linkStatus: previewStudioLinkStatus,
            castLines: previewCastLines, castAdd: previewCastAdd, castStatus: previewCastStatus,
            newsList: previewNewsList, newsUpload: previewNewsUpload, newsStatus: previewNewsStatus, newsReschedule: previewNewsReschedule,
            huntList: previewHuntList, huntUpload: previewHuntUpload, huntStatus: previewHuntStatus, drafts: previewDrafts,
            gossipList: previewGossipList, gossipStatus: previewGossipStatus, setupCheck: previewSetupCheck,
            shoutouts: previewStudioShoutouts, shoutoutAction: previewStudioShoutoutAction, bigScreen: previewStudioBigScreen, bigScreenAction: previewStudioBigScreenAction,
          }}
        />
      );
    }
    case "art":
      return <PreviewArt />;
    // The avatar upgrade: the new base bodies doing every move (?skin=0-7, ?build=; ?outfit=hoodie for stage 3; ?size= tile pixels; ?pick=a,b only those columns).
    case "moves":
      return <AvatarMoves skin={Number(skin ?? 3)} build={build as import("@/lib/look").Look["build"] | undefined} outfit={outfit} size={size ? Number(size) : undefined} pick={pick} />;
    case "room":
      return <PreviewRoom room={room ?? "cafe"} daytime={time !== "night"} mood={mood === "natural" ? "natural" : "dream"} />;
    default:
      notFound();
  }
}
