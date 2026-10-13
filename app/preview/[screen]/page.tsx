import { notFound } from "next/navigation";
import { Creator, type CreatorStep } from "@/components/Creator";
import type { Flow } from "@/components/GameShell";
import { PreviewHome } from "@/components/preview/PreviewHome";
import { PreviewArt } from "@/components/preview/PreviewArt";
import { PreviewRoom } from "@/components/preview/PreviewRoom";
import { GuestMap } from "@/components/GuestMap";
import { Studio } from "@/components/studio/Studio";
import type { StudioArc } from "@/lib/studio";
import {
  previewStudioBeatStatus, previewStudioContent, previewStudioList, previewStudioReview, previewStudioSchedule, previewStudioSetDay,
  previewStudioStatus, previewStudioUpload,
} from "../studioActions";
import {
  previewChatBlock, previewChatList, previewChatReport, previewChatSend, previewChatStatus, previewChatThread, previewLeaderboard,
  previewPlayerCard, previewStudioMetrics, previewStudioReportAction, previewStudioReports,
} from "../chatActions";
import { normalizeLook } from "@/lib/look";
import type { Player } from "@/lib/player";

// Development-only previews of signed-in screens with sample data, so they can be
// checked without a Supabase project. Nothing is saved. Never served in production.
//   /preview/guest            the guest screen
//   /preview/creator?step=0-3 a creator step
//   /preview/home?state=new   right after "Move in" (welcome, tour, party)
//   /preview/home             a player who has finished the first session
//   /preview/home?flow=pwa    open one step of the first session (welcome, tour, party, partyDone, leaderboard, invitePrompt, pwa)
//   /preview/home?city=off    the home screen before migration 0004 (city screens say "coming soon")
//   /preview/home?mood=natural   the plain room lighting, for comparison
//   /preview/home?dev=1          show the staging time-travel pill
//   /preview/home?tasks=done     all five daily tasks done (the HUD's finished state)
//   /preview/home?crew=invite   crew outings: invite (Marco asks you out), tonight (you're hosting), full (your visit completes it), empty (no crew)
//   /preview/home?dating=match   crushes and date nights: match (an unseen "It's mutual"), invite (a date invite waiting), tonight (a date in progress)
//   /preview/home?story=3        start the Sarah Bird pilot so today is story Day 3 (story=off hides stories)
//   /preview/studio            the Story Studio on an in-memory copy of content/stories (&live=3: the pilot is on Day 3)
//   /preview/art             every location illustration, day and night
//   /preview/room?room=cafe|club|counter|astoria_studio&time=night   one 3D room on its own (&mood=natural to compare)
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
  const { time, step, state, flow, city, room, mood, dev, story, live, tasks, dating, crew } = await searchParams;
  const daytimeOverride = time === "day" ? true : time === "night" ? false : undefined;

  switch (screen) {
    case "guest":
      return <GuestMap invited={false} authError={false} />;
    case "creator": {
      const s = Math.min(3, Math.max(0, Number(step ?? 0))) as CreatorStep;
      return (
        <Creator
          needsAgeConfirm={false}
          initialStep={s}
          initialLook={s > 0 ? normalizeLook(SAMPLE.look, SAMPLE.starting_style) : undefined}
          initialTraits={s > 1 ? SAMPLE.traits : []}
          initialCash={s > 2 ? 6400 : null}
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
              return { ok: true as const, cash: 6000 + 100 * Math.floor(Math.random() * 41) };
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
        ? { ...SAMPLE, onboarding_step: "home_done", tutorial_state: "pending", first_party_at: null, clout: 0, bank_cash: 5300, energy: 100, confidence: 40 }
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
          storyDay={story && /^\d+$/.test(story) ? Number(story) : undefined}
          clique={[
            { display_name: "tasha.b", starting_style: "pilates_princess", joined_at: new Date(0).toISOString() },
            { display_name: "Marco", starting_style: "midtown_finance", joined_at: new Date(1).toISOString() },
          ]}
        />
      );
    }
    case "studio": {
      const r = live && /^\d+$/.test(live) ? await previewStudioSetDay("sarah-bird", Number(live)) : await previewStudioList();
      return (
        <Studio
          preview
          who="preview"
          initial={r.ok ? r.arcs : ([] as StudioArc[])}
          api={{
            upload: previewStudioUpload, review: previewStudioReview, schedule: previewStudioSchedule, status: previewStudioStatus,
            beatStatus: previewStudioBeatStatus, content: previewStudioContent,
            reports: previewStudioReports, reportAction: previewStudioReportAction, metrics: previewStudioMetrics,
          }}
        />
      );
    }
    case "art":
      return <PreviewArt />;
    case "room":
      return <PreviewRoom room={room ?? "cafe"} daytime={time !== "night"} mood={mood === "natural" ? "natural" : "dream"} />;
    default:
      notFound();
  }
}
