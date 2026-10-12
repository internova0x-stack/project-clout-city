"use client";

import { useMemo } from "react";
import { GameShell, type Flow } from "@/components/GameShell";
import { createSimApi, sampleCityState } from "@/lib/citySim";
import type { CliqueMember, Player } from "@/lib/player";

// Development previews only: the home screen with an in-memory city, so every
// v0.3 screen can be tried without a database. Nothing is saved.
export function PreviewHome({
  player, clique, flow, daytimeOverride, cityOff, roomMood, artStyle,
}: {
  player: Player; clique: CliqueMember[]; flow?: Flow; daytimeOverride?: boolean; cityOff?: boolean;
  roomMood?: "natural" | "dream"; artStyle?: "flat" | "mv";
}) {
  const city = useMemo(
    () => sampleCityState({ bank_cash: player.bank_cash, clout: player.clout, energy: player.energy, mood: player.mood, confidence: player.confidence, home_id: player.home_id }),
    [player],
  );
  const api = useMemo(() => createSimApi(city), [city]);
  const noop = async () => {};
  return (
    <GameShell
      player={player}
      clique={clique}
      daytimeOverride={daytimeOverride}
      previewFlow={flow}
      roomMood={roomMood}
      artStyle={artStyle}
      city={cityOff ? null : city}
      cityApi={cityOff ? undefined : api}
      actions={{
        setTutorialState: noop,
        finishHandoff: noop,
        setMusicMuted: noop,
        attendFirstParty: async () => ({
          ok: true as const,
          player: { bank_cash: player.bank_cash + 150, clout: player.clout + 100, energy: 80, mood: 60, confidence: 55, onboarding_step: "party_done" as const, first_party_at: new Date().toISOString() },
        }),
      }}
    />
  );
}
