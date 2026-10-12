import { notFound } from "next/navigation";
import { Creator, type CreatorStep } from "@/components/Creator";
import { GameShell } from "@/components/GameShell";
import { GuestMap } from "@/components/GuestMap";
import { normalizeLook } from "@/lib/look";
import type { Player } from "@/lib/player";

// Development-only previews of signed-in screens with sample data, so they can be
// checked without a Supabase project. Nothing is saved. Never served in production.
//   /preview/guest            the guest screen
//   /preview/creator?step=0-3 a creator step
//   /preview/home?state=new   right after "Move in" (welcome, tour, party)
//   /preview/home             a player who has finished the first session
//   add &time=day or &time=night to pin the map

const SAMPLE: Player = {
  id: "00000000-0000-0000-0000-000000000000",
  display_name: "Big Sal",
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

async function noop() {
  "use server";
}

export default async function Preview({
  params,
  searchParams,
}: {
  params: Promise<{ screen: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const { screen } = await params;
  const { time, step, state } = await searchParams;
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
        <GameShell
          player={player}
          daytimeOverride={daytimeOverride}
          clique={[
            { display_name: "Tasha B", starting_style: "pilates_princess", joined_at: new Date(0).toISOString() },
            { display_name: "Marco", starting_style: "midtown_finance", joined_at: new Date(1).toISOString() },
          ]}
          actions={{
            setTutorialState: noop,
            finishHandoff: noop,
            setMusicMuted: noop,
            attendFirstParty: async () => {
              "use server";
              return {
                ok: true as const,
                player: { bank_cash: 5450, clout: 100, energy: 80, mood: 60, confidence: 55, onboarding_step: "party_done" as const, first_party_at: new Date().toISOString() },
              };
            },
          }}
        />
      );
    }
    default:
      notFound();
  }
}
