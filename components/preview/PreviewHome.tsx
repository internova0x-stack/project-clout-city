"use client";

import { useMemo, useRef } from "react";
import { GameShell, type Flow } from "@/components/GameShell";
import { createSimApi, sampleCityState } from "@/lib/citySim";
import type { CityResult } from "@/lib/cityState";
import type { CliqueMember, Player } from "@/lib/player";
import type { StoryApi, StoryFeed, StoryResult } from "@/lib/storyFeed";
import {
  previewCheckout, previewStoreCatalog, previewStoryDevStart, previewStoryEntitle, previewStoryRefresh, previewStorySeen, previewStoryShadow, previewStoryTask, previewStoryVote,
} from "@/app/preview/storyActions";

// Development previews only: the home screen with an in-memory city and story
// world, so every v0.3 and v0.4 screen can be tried without a database. Nothing is saved.
export function PreviewHome({
  player, clique, flow, daytimeOverride, cityOff, roomMood, devTools = false, storyOff = false, storyDay, tasksDone = false,
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
}) {
  const city = useMemo(() => {
    const s = sampleCityState({ bank_cash: player.bank_cash, clout: player.clout, energy: player.energy, mood: player.mood, confidence: player.confidence, home_id: player.home_id });
    if (tasksDone) s.tasks = s.tasks.map((t) => ({ ...t, done_at: t.done_at ?? new Date().toISOString() }));
    return { ...s, devTools };
  }, [player, devTools, tasksDone]);
  const feedRef = useRef<StoryFeed | null>(null);
  const sim = useMemo(() => createSimApi(city, () => feedRef.current), [city]);

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

  // City actions can finish story tasks (as do_action does in SQL).
  const api = useMemo(() => ({
    ...sim,
    async doAction(placeId: string, actionId: string): Promise<CityResult> {
      const r = await sim.doAction(placeId, actionId);
      if (!r.ok) return r;
      const t = await previewStoryTask("", { place: placeId, action: actionId });
      if (!t.ok || !t.clout) return r;
      feedRef.current = t.feed;
      sim.storyClout(t.clout);
      const fresh = await sim.refresh();
      return fresh.ok ? { ...fresh, gain: { ...r.gain, clout: (r.gain?.clout ?? 0) + t.clout } } : r;
    },
  }), [sim]);

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
      storeApi={cityOff || storyOff ? undefined : {
        catalog: previewStoreCatalog,
        checkout: (sku) => previewCheckout(sku, window.location.pathname + window.location.search),
      }}
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
