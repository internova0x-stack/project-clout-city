"use client";

import type { PartyApi } from "@/lib/party";
import { previewNews } from "@/app/preview/newsActions";
import { useCallback, useMemo, useRef } from "react";
import { GameShell, type Flow } from "@/components/GameShell";
import { createSimApi, sampleCityState } from "@/lib/citySim";
import type { CityResult } from "@/lib/cityState";
import type { CliqueMember, Player } from "@/lib/player";
import type { StoryApi, StoryFeed, StoryResult } from "@/lib/storyFeed";
import type { StoreApi, StoreProduct } from "@/lib/store";
import { CLUB_EVENTS, placeById } from "@/lib/city";
import type { ChatApi } from "@/lib/chat";
import type { DatingApi } from "@/lib/dating";
import type { CrewApi } from "@/lib/crew";
import type { HuntApi } from "@/lib/hunts";
import { previewHuntAnswer, previewHuntJoin, previewHuntSetup, previewHuntState, previewHuntTalk } from "@/app/preview/huntActions";
import { previewCrewCreate, previewCrewInbox, previewCrewMembers, previewCrewReset, previewCrewRespond, previewCrewWent } from "@/app/preview/crewActions";
import {
  previewCrush, previewCrushStatus, previewDateCancel, previewDateCandidates, previewDateInvite, previewDateRespond, previewDateWent, previewDatingInbox,
  previewDatingReset, previewMatchSeen,
} from "@/app/preview/datingActions";
import {
  previewChatBlock, previewChatList, previewChatReport, previewChatSend, previewChatStatus, previewChatThread, previewLeaderboard, previewPlayerCard,
} from "@/app/preview/chatActions";
import {
  previewPartyInbox, previewPartyInvite, previewPartyMentions, previewPartyReset, previewPartyRespond, previewSetNewsOptOut,
  previewCheckout, previewStoreAttended, previewStoreCatalog, previewStoreVisited, previewStoryDevStart, previewStoryEntitle, previewStoryRefresh, previewStorySeen, previewStoryShadow, previewStoryTask, previewStoryVote,
} from "@/app/preview/storyActions";

// Development previews only: the home screen with an in-memory city and story
// world, so every v0.3 and v0.4 screen can be tried without a database. Nothing is saved.
export function PreviewHome({
  player, clique, flow, daytimeOverride, cityOff, roomMood, devTools = false, storyOff = false, storyDay, tasksDone = false, datingPreset, crewPreset, partyPreset, huntPreset = "new", lottoPreset,
}: {
  player: Player; clique: CliqueMember[]; flow?: Flow; daytimeOverride?: boolean; cityOff?: boolean;
  roomMood?: "natural" | "dream";
  /** Show the staging time-travel pill (off unless asked for). */
  devTools?: boolean;
  /** Hide the story world (as before migration 0007). */
  storyOff?: boolean;
  /** Start the pilot so today is this story day (the first refresh does it). */
  storyDay?: number;
  /** All five daily tasks already done (to see the HUD's finished state). */
  tasksDone?: boolean;
  /** Start crushes and date nights in a set state: "match", "invite" or "tonight". */
  datingPreset?: string;
  /** Start crew outings in a set state: "invite", "tonight", "full" or "empty". */
  crewPreset?: string;
  /** v0.9 plus-ones: "invite" (someone asked you) or "sent" (you have a ticket and a plus-one). */
  partyPreset?: string;
  /** Start the treasure hunt in a set state: "new", "joined", "question", "wrong" or "done". */
  huntPreset?: string;
  /** v0.10 Lucky Star: the next cards' results ("win", "big", "back" or "lose"), or "jackpot" (last week's draw was mine). */
  lottoPreset?: string;
}) {
  const city = useMemo(() => {
    const s = sampleCityState({ bank_cash: player.bank_cash, clout: player.clout, energy: player.energy, mood: player.mood, confidence: player.confidence, home_id: player.home_id });
    if (tasksDone) s.tasks = s.tasks.map((t) => ({ ...t, done_at: t.done_at ?? new Date().toISOString() }));
    // ?lotto=jackpot: last week's draw was mine.
    const won = s.lotto?.draws?.[0];
    if (lottoPreset === "jackpot" && won) Object.assign(won, { mine: true, winner: player.display_name });
    return { ...s, devTools };
  }, [player, devTools, tasksDone, lottoPreset]);
  const feedRef = useRef<StoryFeed | null>(null);
  const sim = useMemo(() => {
    const api = createSimApi(city, () => feedRef.current);
    const queue: Record<string, number[]> = { win: [5, 0, 2], big: [100, 0], back: [1, 0], lose: [0, 5] };
    if (lottoPreset && queue[lottoPreset]) api.lottoNext(queue[lottoPreset]);
    return api;
  }, [city, lottoPreset]);

  // The story store lives on the dev server; clout it pays is mirrored into the sim's player.
  const story = useMemo<StoryApi>(() => {
    const keep = async (p: Promise<StoryResult>, simCounted = 0): Promise<StoryResult> => {
      const r = await p;
      if (r.ok) {
        feedRef.current = r.feed;
        if (r.clout && r.clout > simCounted) sim.storyClout(r.clout - simCounted);
      }
      return r;
    };
    let preset = storyDay;
    return {
      async refresh(offset) {
        const r = await keep(previewStoryRefresh(offset));
        if (preset === undefined || !r.ok) return r;
        const day = preset;
        preset = undefined;
        return keep(previewStoryDevStart(day));
      },
      vote: (pid, o) => keep(previewStoryVote(pid, o)),
      shadowGuess: (pid, o) => keep(previewStoryShadow(pid, o)),
      markSeen: (id) => keep(previewStorySeen(id)),
      completeTask: (id) => keep(previewStoryTask(id)),
      async attendEvent(id) {
        const ev = feedRef.current?.events.find((e) => e.id === id);
        if (!ev || ev.cancelled) return { ok: false, error: "That event isn't happening anymore." };
        const r = await sim.storyEvent(ev);
        if (!r.ok) return r;
        const t = await keep(previewStoryTask("", { event: id }));
        return t.ok ? { ...t, clout: (r.gain?.clout ?? 0) + (t.clout ?? 0) } : t;
      },
      devStart: (day) => keep(previewStoryDevStart(day)),
      devEntitle: (sku, on) => keep(previewStoryEntitle(sku, on)),
    };
  }, [sim, storyDay]);

  // The pretend webhook's grants land in the sim's player, once each.
  const catalogRef = useRef<StoreProduct[] | null>(null);
  // The ?party preset applies once per page load, before the first catalog or inbox read.
  const partyReady = useRef<Promise<void> | null>(null);
  const partyReset = useCallback(() => (partyReady.current ??= previewPartyReset(partyPreset)), [partyPreset]);
  const granted = useRef(new Set<string>());
  const storeApi = useMemo<StoreApi>(() => ({
    async catalog() {
      await partyReset(); // ?party=ticket|sent hand out a ticket first
      const c = await previewStoreCatalog();
      catalogRef.current = c;
      for (const p of c ?? []) {
        if (!p.owned || granted.current.has(p.sku)) continue;
        granted.current.add(p.sku);
        if (p.type === "collector_item") sim.grantCollector(p.sku);
        if (p.type === "exclusive_event" && p.event) sim.grantTicket(p.event.clout);
      }
      return c;
    },
    checkout: (sku) => previewCheckout(sku, window.location.pathname + window.location.search),
  }), [sim, partyReset]);

  // City actions can finish story tasks (as do_action does in SQL).
  const api = useMemo(() => ({
    ...sim,
    async attendExclusiveEvent(eventId: string): Promise<CityResult> {
      const ev = catalogRef.current?.find((p) => p.event?.id === eventId)?.event;
      if (!ev) return { ok: false, error: "That event doesn't exist." };
      const r = await sim.partyEvent(ev);
      if (r.ok) await previewStoreAttended(eventId);
      return r;
    },
    async attendEvent(eventId: string): Promise<CityResult> {
      const r = await sim.attendEvent(eventId);
      if (r.ok) await previewDateWent("event", eventId);
      if (r.ok) await previewCrewWent(CLUB_EVENTS.find((e) => e.id === eventId)?.placeId ?? "", eventId);
      return r;
    },
    async doAction(placeId: string, actionId: string): Promise<CityResult> {
      const r = await sim.doAction(placeId, actionId);
      if (!r.ok) return r;
      await previewDateWent("place", placeId);
      await previewCrewWent(placeId, actionId);
      if (placeById(placeId)?.postcard) await previewStoreVisited(placeId);
      const t = await previewStoryTask("", { place: placeId, action: actionId });
      if (!t.ok || !t.clout) return r;
      feedRef.current = t.feed;
      sim.storyClout(t.clout);
      const fresh = await sim.refresh();
      return fresh.ok ? { ...fresh, gain: { ...r.gain, clout: (r.gain?.clout ?? 0) + t.clout } } : r;
    },
  }), [sim]);

  const chat = useMemo<ChatApi>(() => ({
    list: previewChatList, thread: previewChatThread, send: previewChatSend, status: previewChatStatus,
    block: previewChatBlock, report: previewChatReport, card: previewPlayerCard,
  }), []);
  // Crushes and date nights in memory; a date's bonus clout is mirrored into the sim's player.
  const paid = useRef(new Set<number>());
  const dating = useMemo<DatingApi>(() => {
    // The preset is applied on the first read (server functions can't run during render).
    let started = false;
    const ready = async () => { if (!started) { started = true; await previewDatingReset(datingPreset); } };
    return {
      async inbox() {
        await ready();
        const r = await previewDatingInbox();
        if (r.ok) for (const d of r.data.dates) if (d.paid && !paid.current.has(d.id)) { paid.current.add(d.id); sim.storyClout(r.data.bonus.clout); }
        return r;
      },
      crushStatus: previewCrushStatus, crush: previewCrush, matchSeen: previewMatchSeen, candidates: previewDateCandidates,
      invite: previewDateInvite, respond: previewDateRespond, cancel: previewDateCancel,
    };
  }, [datingPreset, sim]);
  // Crew outings in memory; crew bonus clout is mirrored into the sim's player.
  const crewPaid = useRef(0);
  const crewApi = useMemo<CrewApi>(() => {
    let started = false;
    return {
      async inbox() {
        if (!started) { started = true; await previewCrewReset(crewPreset); }
        const r = await previewCrewInbox();
        if (r.ok && r.data.clout > crewPaid.current) { sim.storyClout(r.data.clout - crewPaid.current); crewPaid.current = r.data.clout; }
        return r;
      },
      members: previewCrewMembers, create: previewCrewCreate, respond: previewCrewRespond,
    };
  }, [crewPreset, sim]);
  // v0.9 party keepsakes in memory (?party=invite|sent).
  const partyApi = useMemo<PartyApi>(() => ({
    async inbox() { await partyReset(); return previewPartyInbox(); },
    invite: previewPartyInvite, respond: previewPartyRespond, mentions: previewPartyMentions, setNewsOptOut: previewSetNewsOptOut,
  }), [partyReset]);
  // The hunt runs on the dev server (answers stay there); visits come from the sim's own day.
  const huntApi = useMemo<HuntApi>(() => {
    let started = false;
    return {
      async state() {
        if (!started) { started = true; return previewHuntSetup(huntPreset, player.starting_style); }
        return previewHuntState();
      },
      join: () => previewHuntJoin(player.starting_style),
      async talk(placeId) {
        const s = await sim.refresh();
        return previewHuntTalk(placeId, s.ok && (s.state.visitsToday[placeId] ?? 0) > 0);
      },
      async answer(choice) {
        const r = await previewHuntAnswer(choice);
        if (r.ok && r.reward) sim.huntReward(r.reward.cash, r.reward.clout);
        return r;
      },
    };
  }, [huntPreset, player.starting_style, sim]);
  const noop = async () => {};
  return (
    <GameShell
      player={player}
      clique={clique}
      daytimeOverride={daytimeOverride}
      previewFlow={flow}
      roomMood={roomMood}
      city={cityOff ? null : city}
      cityApi={cityOff ? undefined : api}
      storyApi={cityOff || storyOff ? undefined : story}
      storeApi={cityOff || storyOff ? undefined : storeApi}
      chat={cityOff ? undefined : chat}
      dating={cityOff ? undefined : dating}
      crew={cityOff ? undefined : crewApi}
      party={cityOff || storyOff ? undefined : partyApi}
      cityNews={cityOff ? undefined : previewNews}
      hunt={cityOff ? undefined : huntApi}
      leaderboardRows={cityOff ? undefined : async () => previewLeaderboard(player.clout)}
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
