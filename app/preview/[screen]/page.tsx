import { notFound } from "next/navigation";
import { Creator } from "@/components/Creator";
import { GameShell } from "@/components/GameShell";
import { GuestMap } from "@/components/GuestMap";
import type { Player } from "@/lib/player";

// Development-only previews of signed-in screens, so they can be checked
// without a Supabase project. Never served in production.
const SAMPLE: Player = {
  id: "00000000-0000-0000-0000-000000000000",
  display_name: "Big Sal",
  starting_style: "arcade_nerd",
  look: { body: "curvy", skin: "#8D5524", hair: "braids", hairColor: "#14100E", eyes: "#3B2314", glasses: "round", covering: "none" },
  invite_code: "Q7MZ4K",
  onboarding_step: "look_done",
  created_at: new Date(0).toISOString(),
};

export default async function Preview({ params }: { params: Promise<{ screen: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const { screen } = await params;
  switch (screen) {
    case "guest":
      return <GuestMap invited={false} authError={false} />;
    case "creator":
      return (
        <Creator
          needsAgeConfirm={false}
          onSubmit={async () => {
            "use server";
            return { ok: false, error: "Preview only: nothing is saved." };
          }}
        />
      );
    case "home":
      return (
        <GameShell
          player={SAMPLE}
          firstVisit
          clique={[
            { display_name: "Tasha B", starting_style: "pilates_princess", joined_at: new Date(0).toISOString() },
            { display_name: "Marco", starting_style: "midtown_finance", joined_at: new Date(1).toISOString() },
          ]}
        />
      );
    default:
      notFound();
  }
}
