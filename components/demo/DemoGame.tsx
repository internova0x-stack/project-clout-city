"use client";

import { useMemo, useState } from "react";
import CALENDAR_FILE from "@/content/culture/calendar.json";
import { Creator, type CreatorActions } from "@/components/Creator";
import { GameShell } from "@/components/GameShell";
import type { CalendarData } from "@/lib/calendar";
import { createSimApi, sampleCityState, sampleSkills } from "@/lib/citySim";
import { ECONOMY } from "@/lib/economy";
import { lookChoices, type Look } from "@/lib/look";
import type { Player } from "@/lib/player";

// Demo mode (owner, Oct 27): a guest makes a character and plays the first session on the in-memory city
// (lib/citySim.ts), entirely in the browser. Nothing reaches the server and nothing is saved; the banner and the end
// card send them to sign-up. Social features (chat, crew, dating, radio, TV) stay off: they need real people.

const noop = async () => {};
const SIGN_UP = "/?signup=1";

const DEMO_ACTIONS: CreatorActions = {
  createPlayer: async () => ({ ok: true }),
  saveTraits: async () => ({ ok: true }),
  rollBirthLottery: async () => {
    const { min, max, step } = ECONOMY.birthLottery;
    return { ok: true, cash: min + step * Math.floor(Math.random() * ((max - min) / step + 1)) };
  },
  moveIn: async () => ({ ok: true }),
};

export function DemoGame() {
  const [player, setPlayer] = useState<Player | null>(null);
  if (!player) {
    return (
      <div className="demo-mode">
        <DemoBanner />
        <Creator
          needsAgeConfirm={false}
          actions={DEMO_ACTIONS}
          onFinished={(c) => setPlayer(demoPlayer(c))}
        />
      </div>
    );
  }
  return <DemoCity player={player} />;
}

function demoPlayer(c: { name: string; look: Look; traits: string[]; cash: number; homeId: string }): Player {
  return {
    id: "demo", display_name: c.name || "you", starting_style: c.look.style, look: lookChoices(c.look), invite_code: "DEMO",
    onboarding_step: "home_done", created_at: new Date().toISOString(), traits: c.traits, birth_cash: c.cash, home_id: c.homeId,
    bank_cash: c.cash, clout: 0, energy: 100, mood: 60, confidence: 40, tutorial_state: "pending", first_party_at: null, music_muted: false,
  };
}

function DemoCity({ player }: { player: Player }) {
  const calendar = useMemo(() => {
    const { events, ...rest } = CALENDAR_FILE as CalendarData & { about?: string };
    return { ...rest, events };
  }, []);
  // A new player's skills: all at zero.
  const skills = useMemo(() => sampleSkills().map((x) => ({ ...x, level: 0, best: 0, practice: 0, rusty: false })), []);
  const city = useMemo(() => sampleCityState(
    { bank_cash: player.bank_cash, clout: 0, energy: player.energy, mood: player.mood, confidence: player.confidence, home_id: player.home_id, transit_pass_until: null },
    skills, { firstDay: true, startingStyle: player.starting_style },
  ), [player, skills]);
  const sim = useMemo(() => createSimApi(city, () => null, () => false, { delayFor: () => 0 }, calendar, player.starting_style), [city, calendar, player.starting_style]);
  return (
    <div className="demo-mode">
      <DemoBanner />
      <GameShell
        calendarData={calendar}
        skills={skills}
        player={player}
        clique={[]}
        city={city}
        cityApi={sim}
        actions={{
          setTutorialState: noop,
          finishHandoff: noop,
          setMusicMuted: noop,
          attendFirstParty: async () => ({
            ok: true as const,
            player: { bank_cash: player.bank_cash + 150, clout: 100, energy: 80, mood: 60, confidence: 55, onboarding_step: "party_done" as const, first_party_at: new Date().toISOString() },
          }),
        }}
      />
    </div>
  );
}

/** Always on top: what this is, and the way out to a real account. */
function DemoBanner() {
  return (
    <div className="demo-banner" role="status">
      <span><strong>Demo</strong> · nothing is saved</span>
      <a className="demo-banner-cta" href={SIGN_UP}>Sign up to keep playing ›</a>
    </div>
  );
}
