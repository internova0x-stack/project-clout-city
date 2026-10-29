"use client";

import { useMemo, useState } from "react";
import CALENDAR_FILE from "@/content/culture/calendar.json";
import { GameShell, type Flow } from "@/components/GameShell";
import type { CalendarData } from "@/lib/calendar";
import { createSimApi, sampleCityState, sampleSkills } from "@/lib/citySim";
import { createChoicesSim } from "@/lib/choicesSim";
import { placeById } from "@/lib/city";
import { lookChoices } from "@/lib/look";
import { QuickPick, type QuickCharacter } from "./QuickPick";
import type { CityResult } from "@/lib/cityState";
import type { Player } from "@/lib/player";
import { createStarterSim } from "@/lib/starterSim";
import { Sheet } from "@/components/Sheet";
import type { Row } from "@/components/game/FirstSession";

// Demo mode (owner, Oct 27): a guest picks a ready-made character in one tap (QuickPick, owner Oct 28) and plays the first session on the in-memory city
// (lib/citySim.ts), entirely in the browser. Nothing reaches the server and nothing is saved; the banner and the end
// card send them to sign-up. Social features (chat, crew, dating, radio, TV) stay off: they need real people.

const noop = async () => {};
const SIGN_UP = "/?signup=1";

export function DemoGame() {
  const [player, setPlayer] = useState<Player | null>(null);
  if (!player) {
    return (
      <div className="demo-mode">
        <DemoBanner />
        <QuickPick onPick={(c) => setPlayer(demoPlayer(c))} />
      </div>
    );
  }
  return <DemoCity player={player} />;
}

function demoPlayer(c: QuickCharacter): Player {
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
  // Moral Choices in the browser only, with the real cards (nothing reaches the server).
  const choices = useMemo(() => createChoicesSim(null, {
    where: () => { const pl = placeById(sim.here() ?? ""); return { place: pl?.id ?? null, tags: pl?.tags ?? [] }; },
    onEffects: (e) => sim.choicePay(e),
    today: () => new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" }),
  }), [sim]);
  // Starter Week in memory, marked by the same calls as the preview (components/preview/PreviewHome.tsx).
  const starter = useMemo(() => createStarterSim(0, (cash, clout) => sim.huntReward(cash, clout)), [sim]);
  const api = useMemo(() => {
    const mark = starter.mark;
    const after = (id: string) => (r: CityResult) => { if (r.ok) mark(id); return r; };
    return {
      ...sim,
      travel: async (...a: Parameters<NonNullable<typeof sim.travel>>) => { const r = await sim.travel!(...a); if (r.ok && a[0] === "hell-gate-park") mark("park"); return r; },
      acceptGig: async (id: number) => after("gig")(await sim.acceptGig(id)),
      collectGig: async (id: number) => after("collect")(await sim.collectGig(id)),
      payBill: async (id: number) => {
        const r = await sim.payBill(id);
        if (r.ok && r.state.bills.find((b) => b.id === id)?.kind === "rent") mark("rent");
        return r;
      },
      saveLook: async (...a: Parameters<NonNullable<typeof sim.saveLook>>) => after("look")(await sim.saveLook!(...a)),
      saveHomeLayout: async (layout: { id: string; x: number; z: number; rot: number }[]) => {
        const r = await sim.saveHomeLayout(layout);
        if (r.ok && layout.some((l) => r.state.items.some((i) => `item:${i.id}` === l.id && i.category === "home" && i.acquired === "bought"))) mark("furniture");
        return r;
      },
      calendarAttend: async (id: string) => after("event")(await sim.calendarAttend!(id)),
      attendEvent: async (id: string) => after("event")(await sim.attendEvent(id)),
      doAction: async (placeId: string, actionId: string) => {
        const r = await sim.doAction(placeId, actionId);
        if (r.ok && placeId === "ditmars-deli") mark("breakfast");
        if (r.ok && placeId === "hell-gate-park") mark("park");
        return r;
      },
    };
  }, [sim, starter]);
  const [ask, setAsk] = useState<"invite" | "end" | null>(null);
  // Development only: ?flow=leaderboard jumps to the end of the first session (to check the end card).
  const [devFlow] = useState(() => (process.env.NODE_ENV !== "production" && typeof window !== "undefined" ? (new URLSearchParams(window.location.search).get("flow") as Flow | null) ?? undefined : undefined));
  return (
    <div className="demo-mode">
      <DemoBanner />
      <GameShell
        calendarData={calendar}
        skills={skills}
        player={player}
        clique={[]}
        city={city}
        cityApi={api}
        starter={starter.api}
        choices={choices}
        demo={{ signUp: setAsk }}
        previewFlow={devFlow}
        leaderboardRows={async (scope, clout) => demoLeaderboard(scope, clout, player)}
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
      <DemoSignUp why={ask} onClose={() => setAsk(null)} />
    </div>
  );
}

/** The demo has no other players, so its leaderboard is made up (owner, Oct 28): invented New Yorkers around a
 *  newcomer's clout, so the first board isn't empty. Crew is only you: a demo can't have one. */
const DEMO_BOARD: [string, string, number][] = [
  ["nina.nyc", "pilates_princess", 3020], ["oatmilk_oligarch", "startup_founder", 2140], ["dev.r", "arcade_nerd", 1880],
  ["brunch_tycoon", "midtown_finance", 1720], ["dee_rivera", "thrift_store_icon", 1310], ["lowkey_famous", "influencer_soft_glam", 990],
  ["kai_beats", "bodega_drip", 760], ["mta_survivor", "night_owl_goth", 420], ["sublet_steve", "bodega_drip", 85],
  ["vibes_llc", "startup_founder", 40], ["rent_is_due", "thrift_store_icon", 15],
];
function demoLeaderboard(scope: "queens" | "clique", myClout: number, player: Player): Row[] {
  const me = { display_name: player.display_name, starting_style: player.starting_style, clout: myClout, is_me: true };
  const all = scope === "clique" ? [me] : [...DEMO_BOARD.map(([display_name, starting_style, clout]) => ({ display_name, starting_style, clout, is_me: false })), me];
  return all.sort((a, b) => b.clout - a.clout).map((r, i) => ({ ...r, rank: i + 1 }));
}

/** The demo's ask: from "Invite your Crew", and when the first session ends. Nothing carries over, so it never says it does. */
function DemoSignUp({ why, onClose }: { why: "invite" | "end" | null; onClose: () => void }) {
  return (
    <Sheet open={why !== null} onClose={onClose} label="Sign up">
      <div className="stack-16">
        <div className="stack-4" style={{ paddingTop: 4, paddingRight: 40 }}>
          <p className="overline">{why === "invite" ? "Crew" : "That was the demo"}</p>
          <h2 className="display-lg" style={{ margin: 0 }}>{why === "invite" ? "Your crew can't come to a demo" : "Ready to make it real?"}</h2>
          <p className="subtext" style={{ margin: "4px 0 0" }}>
            {why === "invite"
              ? "Sign up and you get your own invite link. Friends who join are your crew: plans, rides, parties, the lot."
              : "Sign up free and make your character for real: the same Queens, real players to meet, date and outdo, and everything you do saved."}
          </p>
        </div>
        <a className="btn btn-taxi" href={SIGN_UP} style={{ textDecoration: "none" }}>Sign up free ›</a>
        <button className="btn btn-ghost" onClick={onClose}>Keep looking around</button>
      </div>
    </Sheet>
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
