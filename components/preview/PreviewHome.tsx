"use client";

import { previewCoutureMap, previewPlazaBook, previewPlazaWeeks } from "@/app/preview/coutureActions";
import type { CoutureApi } from "@/lib/coutureMap";
import { previewRadioReport, previewRadioRequest, previewRadioState } from "@/app/preview/radioActions";
import type { RadioApi } from "@/lib/radio";
import type { MayorApi } from "@/lib/mayor";
import { createCampaignSim } from "@/lib/campaignSim";
import { createCareerSim } from "@/lib/careerSim";
import { createUnderworldSim } from "@/lib/underworldSim";
import { createGalaSim } from "@/lib/galaSim";
import { createChoicesSim, storyMemory } from "@/lib/choicesSim";
import { remembered as rememberedFor, type RememberRule } from "@/lib/characterMemory";
import REMEMBERS from "@/content/characters/remembers.json";

/** Content Engine step 5 in the preview: the sample history's remembered lines (with a heatwave and a brownout on). */
const rememberedSim = async () => {
  const m = storyMemory();
  m.snapshot.conditions = ["heatwave", "brownout"];
  return rememberedFor(REMEMBERS as RememberRule[], m, new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" }));
};
import { previewMayorSeen, previewMayorState, previewMayorWrite } from "@/app/preview/mayorActions";
import { createCampusSim } from "@/lib/campusSim";
import { createGoalsSim } from "@/lib/goalsSim";
import type { PushApi, PushPrefs } from "@/lib/pushClient";
import { previewMembership } from "@/lib/membershipSim";
import type { MembershipApi } from "@/lib/membership";
import { PLACES } from "@/lib/city";
import { clubDoor } from "@/lib/cityState";
import { previewStationInbox, previewStationRead, previewTvState, previewTvSubmit, previewTvUpload, previewTvWithdraw } from "@/app/preview/tvActions";
import type { TvApi } from "@/lib/cloutTv";

import type { PartyApi } from "@/lib/party";
import type { GossipApi } from "@/lib/gossip";
import type { PartyRoomApi } from "@/lib/partyRoom";
import { previewPartyReport, previewPartyRoom, previewPartySay } from "@/app/preview/partyRoomActions";
import { previewGossipFind, previewGossipReset, previewGossipShare, previewGossipState } from "@/app/preview/gossipActions";
import { previewNews } from "@/app/preview/newsActions";
import { activeDelays, nyClock, type NewsItem } from "@/lib/news";
import CALENDAR_FILE from "@/content/culture/calendar.json";
import type { CalendarData } from "@/lib/calendar";
import { useCallback, useMemo, useRef, useEffect, useState } from "react";
import { previewShopCatalog } from "@/app/preview/shopActions";
import type { CatalogItem } from "@/lib/shopCatalog";
import { GameShell, type Flow } from "@/components/GameShell";
import { ECONOMY } from "@/lib/economy";
import { createSimApi, sampleCityState, sampleSkills } from "@/lib/citySim";
import { createStarterSim } from "@/lib/starterSim";
import { createBusinessSim } from "@/lib/businessSim";
import { createTogetherSim } from "@/lib/togetherSim";
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
import { previewCoupleAnswer, previewCoupleAsk, previewCoupleEnd, previewCoupleGift, previewCoupleReset, previewCoupleSeen, previewCoupleShow, previewCoupleState } from "@/app/preview/coupleActions";
import type { CoupleApi, CoupleResult, CoupleState } from "@/lib/couples";
import {
  previewSubletAnswer, previewSubletApply, previewSubletHang, previewSubletHome, previewSubletLeave, previewSubletList, previewSubletNotice,
  previewSubletRate, previewSubletRenew, previewSubletRenewAnswer, previewSubletReset, previewSubletSeen, previewSubletShow, previewSubletState,
  previewSubletUnlist, previewSubletWithdraw,
} from "@/app/preview/subletActions";
import type { SubletApi } from "@/lib/sublets";
import {
  previewVisitAnswer, previewVisitArrive, previewVisitEnd, previewVisitHome, previewVisitHost, previewVisitLeave, previewVisitReset,
  previewVisitRoom, previewVisitSay, previewVisitSendHome, previewVisitState,
} from "@/app/preview/visitActions";
import type { VisitApi } from "@/lib/visits";
import {
  previewChatBlock, previewChatList, previewCrowned, previewChatReact, previewSetMessagesFrom, previewPresence, previewPlaceCounts, previewChatPreset, previewCrowdPreset, previewChatReport, previewChatSend, previewChatStatus, previewChatThread, previewLeaderboard, previewPlayerCard, previewSkillsOf,
} from "@/app/preview/chatActions";
import {
  previewPartyInbox, previewPartyInvite, previewPartyMentions, previewPartyReset, previewPartyRespond, previewSetNewsOptOut,
  previewCheckout, previewStoreAttended, previewStoreCatalog, previewStoreVisited, previewStoryDevStart, previewStoryEntitle, previewStoryRefresh, previewStorySeen, previewStoryRead, previewStoryShadow, previewStoryTask, previewStoryVote,
} from "@/app/preview/storyActions";

// Development previews only: the home screen with an in-memory city and story
// world, so every v0.3 and v0.4 screen can be tried without a database. Nothing is saved.
const STATIONS_PREVIEW = { inbox: previewStationInbox, read: previewStationRead };

/** Clout Couture on the map with sample owners (app/preview/coutureActions.ts). */
const PREVIEW_COUTURE: CoutureApi = { map: previewCoutureMap, weeks: previewPlazaWeeks, book: previewPlazaBook };

export function PreviewHome({
  player, clique, flow, daytimeOverride, cityOff, roomMood, devTools = false, storyOff = false, storyDay, storyArc, tasksDone = false, datingPreset, crewPreset, partyPreset, huntPreset = "new", lottoPreset, rankUpPreset, bizPreset, togetherPreset, radioPreset, tvPreset, brooklynPreset, gossipPreset = "some", dailyHintPreset = false, campusPreset, goalsPreset, pushPreset, memberPreset, skillsPreset, transitPreset, rentPreset, calendarPreset, couturePreset, mayorPreset, atPreset, couplePreset, subletPreset, homeScorePreset, visitPreset, starterPreset, appsPreset, campaignPreset, careerPreset, underworldPreset, galaPreset, choicePreset,
}: {
  player: Player; clique: CliqueMember[]; flow?: Flow; daytimeOverride?: boolean; cityOff?: boolean;
  roomMood?: "natural" | "dream";
  /** Show the staging time-travel pill (off unless asked for). */
  devTools?: boolean;
  /** Hide the story world (as before migration 0007). */
  storyOff?: boolean;
  /** Start the pilot so today is this story day (the first refresh does it). */
  storyDay?: number;
  /** ?arc=: which main story ?story= starts (Sarah Bird by default). */
  storyArc?: string;
  /** All five daily tasks already done (to see the HUD's finished state). */
  tasksDone?: boolean;
  /** Start crushes and date nights in a set state: "match", "invite" or "tonight". */
  datingPreset?: string;
  /** Start crew outings in a set state: "invite", "tonight", "full" or "empty". */
  crewPreset?: string;
  /** v0.9 plus-ones: "invite" (someone asked you) or "sent" (you have a ticket and a plus-one). */
  partyPreset?: string;
  /** v0.12 businesses: ?biz=some|rich|public starts with businesses. */
  bizPreset?: string;
  /** v0.13 Better Together: ?together=invite|ride|plan|bonus|decorate|approve starts in that state. */
  togetherPreset?: string;
  /** v0.14 Real Clout FM: ?radio=new|sent|full|notpicked|mine starts the station in that state. */
  radioPreset?: string;
  /** v0.14 Clout TV: ?tv=new|sent|mine starts the big screen in that state. */
  tvPreset?: string;
  /** Owner, Oct 17: ?brooklyn=open opens Brooklyn; otherwise it's locked with a sample counter. */
  brooklynPreset?: string;
  /** Player ranks: ?rankup=1-10 opens the rank-up reveal for that rank. */
  rankUpPreset?: number;
  /** Start the treasure hunt in a set state: "new", "joined", "question", "wrong" or "done". */
  huntPreset?: string;
  /** v0.10 Lucky Star: the next cards' results ("win", "big", "back" or "lose"), or "jackpot" (the next card wins its pot). */
  lottoPreset?: string;
  /** v0.15 Campus: ?campus=new|pick|week|friday|done starts campus life in that state, standing at St. Johnsons. */
  campusPreset?: string;
  /** ?at=<place id>: the player was last at that place (the game opens there, owner Oct 24). */
  atPreset?: string;
  /** ?couple=progress|ask|dating|gift|ended: relationships (migration 0118) in that state. */
  couplePreset?: string;
  /** ?sublet=browse|listed|living|hosting|notice|ended: sublets (migration 0119) in that state. */
  subletPreset?: string;
  /** ?homescore=furnished: the home starts with furniture and three paintings placed (the home score, migration 0120). */
  homeScorePreset?: string;
  /** ?visit=none|hosting|invite|guest: having people over (migration 0121) in that state. */
  visitPreset?: string;
  /** ?starter=0-10: Starter Week with that many missions done. */
  starterPreset?: string;
  /** ?apps=locked: Businesses and Jobs locked as for a Rank 1 player. */
  appsPreset?: string;
  /** Skill perks (migration 0092): "pro" starts with high skill levels. */
  skillsPreset?: string;
  /** C4: "showtime" puts dancers on every subway ride; "pass" starts with an OMG Card. */
  transitPreset?: string;
  /** The rent alarm (owner, Oct 22): short (rent in 2 days), late (a day late) or evict (4 days late), C$930 in the bank. */
  rentPreset?: string;
  /** C5: "today" moves every calendar event to right now, so each can be tried; "gift" also starts with a gift box. */
  calendarPreset?: string;
  /** ?couture=soldout: every Clout Couture drop has sold out. */
  couturePreset?: string;
  /** Contact the Mayor: ?mayor=new (no letters yet) or reply (a reply waiting); otherwise one letter already read. */
  mayorPreset?: string;
  /** Campaign Mode: ?campaign=locked|pick|week|situation|debate|waiting|election (Phone → Campaign). */
  campaignPreset?: string;
  /** Careers: ?career=new|apply|work|day|office|grudge|review|warning|fired (Phone → Careers). */
  careerPreset?: string;
  /** The underworld (migration 0148): ?underworld=locked|new|jobs|pro|hot|caught|lawyer. */
  underworldPreset?: string;
  /** The Charity Gala (migration 0150): ?gala=on|off|new|done. */
  galaPreset?: string;
  /** Moral Choices: ?choice=now|back|high|low|log|jail|chain|story (lib/choicesSim.ts; story = storylets from a sample history). */
  choicePreset?: string;
  /** Push notifications: ?push=ask shows Lola's ask after 2 seconds. */
  pushPreset?: string;
  /** Membership & purchases: ?member=vip|monthly|cancelling|pastdue|forever|free|none (default vip). */
  memberPreset?: string;
  /** Daily tasks 2.0: ?goals=new|streak|pass|tonight|chapter starts goals, streaks and passes in that state; day3|day7|day14|goaldone opens that reveal. */
  goalsPreset?: string;
  /** Owner, Oct 17: show Lola's daily-tasks nudge after 2 seconds (?hint=daily). */
  dailyHintPreset?: boolean;
  /** v0.10 gossip: "new" (nothing found), "some" (two stories started), "almost" (one piece short) or "done". */
  gossipPreset?: string;
}) {
  // The Shop Manager's preview (migration 0099): the Shop shows what /preview/studio's Shop tab put on sale.
  const [catalog, setCatalog] = useState<CatalogItem[] | undefined>(undefined);
  useEffect(() => { void previewShopCatalog().then(setCatalog).catch(() => undefined); }, []);
  // v0.12 ?biz=some|rich|public: start with businesses, and the cash and clout to match.
  const boost = bizPreset === "some" ? { cash: 60_000, clout: 11_000 } : bizPreset === "rich" || bizPreset === "public" ? { cash: 60_000_000, clout: 60_000 } : null;
  const rentOn = rentPreset === "short" || rentPreset === "late" || rentPreset === "evict";
  const me = useMemo(() => (boost ? { ...player, bank_cash: player.bank_cash + boost.cash, clout: player.clout + boost.clout } : rentOn ? { ...player, bank_cash: 230 } : player),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [player, bizPreset]);
  const city = useMemo(() => {
    const s = sampleCityState({ bank_cash: me.bank_cash, clout: me.clout, energy: player.energy, mood: player.mood, confidence: player.confidence, home_id: player.home_id, ...(campusPreset !== undefined ? { at_place: "st-johnsons" } : atPreset ? { at_place: atPreset } : {}),
      ...(transitPreset === "pass" ? { transit_pass_until: new Date(Date.now() + 5 * 86_400_000).toISOString() } : { transit_pass_until: null }) }, sampleSkills(skillsPreset === "pro"), { firstDay: player.tutorial_state === "pending", startingStyle: player.starting_style });
    if (rentOn) {
      const day = (n: number) => new Date(Date.parse(`${s.today}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
      const rent = ECONOMY.homes.find((h) => h.id === s.player.home_id)?.rent ?? 425;
      s.bills = s.bills.map((b) => (b.status === "due" ? { ...b, status: "paid" as const, paid_at: new Date().toISOString() } : b));
      if (rentPreset === "short") s.player.next_rent_due = day(2);
      else s.bills = [...s.bills, { id: 299, kind: "rent", amount: rent, due_date: day(rentPreset === "late" ? -1 : -4), status: "due", paid_at: null }];
    }
    if (tasksDone) s.tasks = s.tasks.map((t) => ({ ...t, done_at: t.done_at ?? new Date().toISOString() }));
    s.calendar = { attended: [], gifts: calendarPreset === "gift" ? 1 : 0 };
    // The preview Shop's catalog, so its pieces (and Clout Couture's) can be bought and owned.
    if (catalog) s.catalog = catalog;
    // ?homescore=furnished: pieces in four rooms and three paintings on the walls.
    if (homeScorePreset === "furnished") {
      const placed: [string, number, number, number][] = [
        ["art-golden-hour-7", -0.4, -2.52, 0], ["art-bodega-cat-sunday", 1.3, -2.52, 0], ["art-clout", -2.62, 0.4, 1],
        ["home-plant", 2.2, 1.9, 0], ["home-chair-oak", -1.9, 2.0, 0], ["home-rug-violet", 0.4, 1.2, 0],
      ];
      s.items = [...s.items, ...placed.map(([sku], i) => ({ id: 9101 + i, sku, category: "home" as const, value: 0, acquired: "bought" as const, equipped: false }))];
      s.homeLayout = placed.map(([, x, z, rot], i) => ({ id: `item:${9101 + i}`, x, z, rot }));
    }
    // v0.15 (migration 0076): students get "Go to class" in place of the random task.
    if (campusPreset && campusPreset !== "new") s.tasks = s.tasks.map((t) => (t.slot === 5 ? { ...t, kind: "class" as const, place_id: "st-johnsons", action_id: "class", goal: null } : t));
    return { ...s, devTools };
  }, [me, player, devTools, tasksDone, campusPreset, skillsPreset, transitPreset, calendarPreset, catalog, rentOn, rentPreset, homeScorePreset]);
  // C5: the calendar, with ?calendar=today|gift moving every event to now (an hour ago for three hours).
  const calendar = useMemo<CalendarData>(() => {
    const { events, ...rest } = CALENDAR_FILE as CalendarData & { about?: string };
    if (!calendarPreset) return { ...rest, events };
    const { day, minutes } = nyClock(Date.now());
    const from = `${String(Math.max(0, Math.min(20, Math.floor(minutes / 60) - 1))).padStart(2, "0")}:00`;
    return { ...rest, events: events.map((e) => ({ ...e, date: day, from, hours: 3 })) };
  }, [calendarPreset]);
  // C4: the preview's News carries a live 7-train delay (app/preview/newsActions.ts); the simulator adds it to subway trips.
  const delaysRef = useRef<NewsItem[]>([]);
  useEffect(() => { void previewNews().then((items) => { delaysRef.current = items; }); }, []);
  const feedRef = useRef<StoryFeed | null>(null);
  const sim = useMemo(() => {
    const api = createSimApi(city, () => feedRef.current, (id) => passRef.current(id), {
      delayFor: (line) => (line ? activeDelays(delaysRef.current, Date.now())[line]?.seconds ?? 0 : 0),
      ...(transitPreset === "showtime" ? { showtimeChance: 1 } : {}),
    }, calendar, player.starting_style);
    const queue: Record<string, number[]> = { win: [5, 0, 2], big: [100, 0], back: [1, 0], lose: [0, 5] };
    if (lottoPreset && queue[lottoPreset]) api.lottoNext(queue[lottoPreset]);
    // ?lotto=jackpot: the next card's ⭐ wins its pot.
    if (lottoPreset === "jackpot") { api.lottoNext([5]); api.lottoPot(); }
    return api;
  }, [city, lottoPreset, transitPreset, calendar]);
  // Push notifications: an in-memory device list and switches (the browser's own permission still applies).
  const pushApi = useMemo<PushApi>(() => {
    const prefs: PushPrefs = { off: [], devices: pushPreset === "on" ? 1 : 0, askedAt: null };
    const ok = <T,>(data: T) => Promise.resolve({ ok: true as const, data });
    return {
      prefs: () => ok({ ...prefs }),
      subscribe: () => { prefs.devices = 1; return ok(null); },
      unsubscribe: () => { prefs.devices = 0; return ok(null); },
      setOff: (off) => { prefs.off = off; return ok({ ...prefs }); },
      asked: () => { prefs.askedAt = new Date().toISOString(); return ok({ ...prefs }); },
      test: () => ok(null),
    };
  }, [pushPreset]);
  // Membership & purchases: sample plans and receipts; "Manage billing" says where Stripe would open.
  const memberApi = useMemo<MembershipApi>(() => previewMembership(memberPreset ?? "vip"), [memberPreset]);
  // Daily tasks 2.0: goals read the simulated player; a pass used tonight opens the simulated door.
  const passRef = useRef<(placeId: string) => boolean>(() => false);
  const goalsApi = useMemo(() => {
    const g = createGoalsSim(goalsPreset === "new" ? "" : goalsPreset ?? "", {
      clout: () => sim.peek().clout,
      cash: () => sim.peek().cash,
      confidence: () => sim.peek().confidence,
      allDone: () => sim.peek().allDone,
      canEnter: (id) => {
        const place = PLACES.find((x) => x.id === id);
        if (!place?.club) return { club: false, needed: false };
        const { doorClout, vip } = clubDoor(place);
        const clout = sim.peek().clout;
        return { club: true, needed: clout < doorClout || (!!vip && clout < vip.freeClout) };
      },
    });
    passRef.current = g.passTonight;
    return g;
  }, [sim, goalsPreset]);
  // v0.14 Real Clout FM: the dev server's in-memory station, shared with /preview/studio's Shoutouts queue.
  const campusApi = useMemo(() => createCampusSim(campusPreset === "new" ? "" : campusPreset ?? ""), [campusPreset]);
  const mayorApi = useMemo<MayorApi>(() => ({
    state: () => previewMayorState(mayorPreset ?? ""),
    write: previewMayorWrite,
    seen: previewMayorSeen,
  }), [mayorPreset]);
  // Moral Choices: the real cards in memory, standing wherever the simulated player is.
  // One for the whole visit (it keeps its record and cooldowns), reading whichever simulated city is current.
  const simRef = useRef(sim);
  simRef.current = sim;
  const choicesApi = useMemo(() => createChoicesSim(choicePreset ?? null, {
    where: () => { const id = simRef.current.here(); const pl = id ? placeById(id) : undefined; return { place: pl?.id ?? null, tags: pl?.tags ?? [] }; },
    onEffects: (e) => simRef.current.choicePay(e),
    today: () => new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" }),
  }), [choicePreset]);
  const careerApi = useMemo(() => createCareerSim(careerPreset ?? null, {
    clout: player.clout, energy: player.energy, atPlace: () => simRef.current.here(),
    onBank: (cash) => simRef.current.choicePay({ cash }), onEnergy: (energy) => simRef.current.choicePay({ energy }),
  }), [careerPreset, player.clout, player.energy]);
  const underworldApi = useMemo(() => createUnderworldSim(underworldPreset ?? null, {
    atPlace: () => simRef.current.here(), bank: () => player.bank_cash,
    onBank: (cash) => simRef.current.choicePay({ cash }), onEnergy: (energy) => simRef.current.choicePay({ energy }),
  }), [underworldPreset, player.bank_cash]);
  const galaApi = useMemo(() => createGalaSim(galaPreset ?? null, {
    here: () => simRef.current.here(), bank: () => player.bank_cash,
    onPay: (e) => simRef.current.choicePay(e),
  }), [galaPreset, player.bank_cash]);
  const campaignApi = useMemo(() => createCampaignSim(campaignPreset ?? null, { clout: campaignPreset === "locked" ? 40 : Math.max(150, player.clout), bank: player.bank_cash }), [campaignPreset, player.clout, player.bank_cash]);
  const radioApi = useMemo<RadioApi>(() => ({
    state: () => previewRadioState(radioPreset ?? ""),
    request: previewRadioRequest,
    report: () => previewRadioReport(),
  }), [radioPreset]);
  // v0.14 Clout TV: the dev server's in-memory station; uploads go up as data URLs.
  const tvApi = useMemo<TvApi>(() => ({
    state: () => previewTvState(tvPreset ?? ""),
    upload: async (blob) => previewTvUpload(await new Promise<string>((ok) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.readAsDataURL(blob); })),
    submit: previewTvSubmit,
    withdraw: previewTvWithdraw,
  }), [tvPreset]);
  const businessApi = useMemo(() => createBusinessSim({
    cash: () => sim.peek().cash,
    clout: () => sim.peek().clout,
    pay: (cash, clout = 0) => sim.huntReward(cash, clout),
  }, bizPreset), [sim, bizPreset]);
  const togetherApi = useMemo(() => {
    let layout: unknown = null;
    return createTogetherSim({
      cash: () => sim.peek().cash,
      pay: (cash, clout = 0) => sim.huntReward(cash, clout),
      async ride(place, mode) {
        const before = sim.peek().cash;
        const r = await sim.travel!(place, mode);
        if (!r.ok) return { ok: false as const, error: r.error };
        const fare = before - sim.peek().cash;
        sim.huntReward(fare - Math.ceil(fare / 2), 0);
        return { ok: true as const, fare, seconds: 20 };
      },
      home: () => ({ homeId: "lic_highrise", layout }),
      saveHome: (l) => { layout = l; },
      hasBusiness: () => !!bizPreset,
    }, togetherPreset);
  }, [sim, togetherPreset, bizPreset]);

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
        return keep(previewStoryDevStart(day, storyArc));
      },
      vote: (pid, o) => keep(previewStoryVote(pid, o)),
      shadowGuess: (pid, o) => keep(previewStoryShadow(pid, o)),
      markSeen: (id) => keep(previewStorySeen(id)),
      readPost: (id) => keep(previewStoryRead(id)),
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
  const storeApi = useMemo<StoreApi>(() => {
    // Per simulator: a new one (the Shop catalog arriving) is granted its pieces again.
    const granted = new Set<string>();
    return {
      async catalog() {
        await partyReset(); // ?party=ticket|sent hand out a ticket first
        const raw = await previewStoreCatalog();
        const c = couturePreset === "soldout"
          ? raw?.map((p) => (p.edition && !p.owned ? { ...p, edition: { ...p.edition, issued: p.edition.size, left: 0, soldOut: true } } : p)) ?? null
          : raw;
        catalogRef.current = c;
        for (const p of c ?? []) {
          if (!p.owned || granted.has(p.sku)) continue;
          granted.add(p.sku);
          if (p.type === "collector_item") sim.grantCollector(p.sku);
          if (p.type === "exclusive_event" && p.event) sim.grantTicket(p.event.clout);
        }
        return c;
      },
      checkout: (sku) => previewCheckout(sku, window.location.pathname + window.location.search),
    };
  }, [sim, partyReset, couturePreset]);

  // City actions can finish story tasks (as do_action does in SQL).
  // Starter Week in memory (lib/starterSim.ts): the wrapped calls below mark missions the way migration 0122's triggers do.
  const starterSim = useMemo(() => createStarterSim(Number(starterPreset) || 0, (cash, clout) => sim.huntReward(cash, clout)), [starterPreset, sim]);
  const mark = starterSim.mark;
  const api = useMemo(() => ({
    ...sim,
    async travel(...a: Parameters<NonNullable<typeof sim.travel>>): Promise<CityResult> {
      const [placeId] = a;
      const r = await sim.travel!(...a);
      if (r.ok && placeId === "hell-gate-park") mark("park");
      return r;
    },
    async acceptGig(offerId: number): Promise<CityResult> {
      const r = await sim.acceptGig(offerId);
      if (r.ok) mark("gig");
      return r;
    },
    async collectGig(offerId: number): Promise<CityResult> {
      const r = await sim.collectGig(offerId);
      if (r.ok) mark("collect");
      return r;
    },
    async payBill(billId: number): Promise<CityResult> {
      const r = await sim.payBill(billId);
      if (r.ok && r.state.bills.find((b) => b.id === billId)?.kind === "rent") mark("rent");
      return r;
    },
    async saveLook(...a: Parameters<NonNullable<typeof sim.saveLook>>): Promise<CityResult> {
      const r = await sim.saveLook!(...a);
      if (r.ok) mark("look");
      return r;
    },
    async saveHomeLayout(layout: { id: string; x: number; z: number; rot: number }[]): Promise<CityResult> {
      const r = await sim.saveHomeLayout(layout);
      if (r.ok && layout.some((l) => r.state.items.some((i) => `item:${i.id}` === l.id && i.category === "home" && i.acquired === "bought"))) mark("furniture");
      return r;
    },
    async calendarAttend(eventId: string): Promise<CityResult> {
      const r = await sim.calendarAttend!(eventId);
      if (r.ok) mark("event");
      return r;
    },
    async attendExclusiveEvent(eventId: string): Promise<CityResult> {
      const ev = catalogRef.current?.find((p) => p.event?.id === eventId)?.event;
      if (!ev) return { ok: false, error: "That event doesn't exist." };
      const r = await sim.partyEvent(ev);
      if (r.ok) mark("event");
      if (r.ok) await previewStoreAttended(eventId);
      return r;
    },
    async attendEvent(eventId: string): Promise<CityResult> {
      const r = await sim.attendEvent(eventId);
      if (r.ok) mark("event");
      if (r.ok) await previewDateWent("event", eventId);
      if (r.ok) await previewCrewWent(CLUB_EVENTS.find((e) => e.id === eventId)?.placeId ?? "", eventId);
      return r;
    },
    async doAction(placeId: string, actionId: string): Promise<CityResult> {
      const r = await sim.doAction(placeId, actionId);
      if (!r.ok) return r;
      if (placeId === "ditmars-deli") mark("breakfast");
      if (placeId === "hell-gate-park") mark("park");
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
  }), [sim, mark]);

  // Meeting players: ?chat=out starts with today's messages used up (the unlimited chat offer).
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const preset = q.get("chat");
    if (preset) void previewChatPreset(preset);
    // Crowded places: ?crowd=50 puts 50 sample players at whatever place you walk into.
    void previewCrowdPreset(Number(q.get("crowd")) || 0);
  }, []);
  const chat = useMemo<ChatApi>(() => ({
    list: previewChatList, thread: previewChatThread, crowned: previewCrowned, status: previewChatStatus,
    block: previewChatBlock, report: previewChatReport, card: previewPlayerCard, skills: previewSkillsOf,
    react: previewChatReact, setMessagesFrom: previewSetMessagesFrom, presence: previewPresence, counts: previewPlaceCounts,
    async send(...a: Parameters<typeof previewChatSend>) { const r = await previewChatSend(...a); if (r.ok) mark("message"); return r; },
  }), [mark]);
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
  // Relationships in memory (app/preview/coupleActions.ts); streak rewards are mirrored into the sim's player.
  const couple = useMemo<CoupleApi>(() => {
    let started = false;
    const ready = async () => { if (!started) { started = true; await previewCoupleReset(couplePreset); } };
    const mirror = async <T,>(r: CoupleResult<T>) => {
      if (r.ok && r.data && typeof r.data === "object" && "paid" in r.data) {
        const n = (r.data as unknown as CoupleState).paid.reduce((t, x) => t + x.clout, 0);
        if (n) sim.storyClout(n);
      }
      return r;
    };
    return {
      async state() { await ready(); return mirror(await previewCoupleState()); },
      ask: async (id) => mirror(await previewCoupleAsk(id)),
      answer: async (id, yes) => mirror(await previewCoupleAnswer(id, yes)),
      end: previewCoupleEnd, show: previewCoupleShow, gift: previewCoupleGift, seen: previewCoupleSeen,
    };
  }, [couplePreset, sim]);
  // Having people over in memory (app/preview/visitActions.ts).
  const visitApi = useMemo<VisitApi>(() => {
    let started = false;
    const ready = async () => { if (!started) { started = true; await previewVisitReset(visitPreset); } };
    return {
      async state() { await ready(); return previewVisitState(); },
      host: previewVisitHost, end: previewVisitEnd, sendHome: previewVisitSendHome, answer: previewVisitAnswer, arrive: previewVisitArrive,
      leave: previewVisitLeave, room: previewVisitRoom, home: previewVisitHome, say: previewVisitSay,
    };
  }, [visitPreset]);
  // Sublets in memory (app/preview/subletActions.ts).
  const sublet = useMemo<SubletApi>(() => {
    let started = false;
    const ready = async () => { if (!started) { started = true; await previewSubletReset(subletPreset); } };
    return {
      async state() { await ready(); return previewSubletState(); },
      async home() { await ready(); return previewSubletHome(); },
      list: previewSubletList, unlist: previewSubletUnlist, apply: previewSubletApply, withdraw: previewSubletWithdraw,
      answer: previewSubletAnswer, notice: previewSubletNotice, leave: previewSubletLeave, renew: previewSubletRenew,
      renewAnswer: previewSubletRenewAnswer, hang: previewSubletHang, show: previewSubletShow, rate: previewSubletRate, seen: previewSubletSeen,
    };
  }, [subletPreset]);
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
  // v0.10 gossip in memory on the dev server (the preview sim trusts the place it's given).
  const gossipReady = useRef<Promise<void> | null>(null);
  const gossipApi = useMemo<GossipApi>(() => ({
    async state() { await (gossipReady.current ??= previewGossipReset(gossipPreset)); return previewGossipState(); },
    async find(placeId, via) {
      const r = await previewGossipFind(placeId, via);
      if (r.ok) mark("gossip");
      if (r.ok && r.data.bonus?.clout) sim.storyClout(r.data.bonus.clout);
      return r.ok ? { ok: true, data: { ...r.data, taskCash: sim.gossipTask(placeId, via) } } : r;
    },
    share: previewGossipShare,
  }), [gossipPreset, sim, mark]);
  // v0.11 party rooms in memory (?party=ticket, then go upstairs at the lounge while the party's on).
  const partyRoomApi = useMemo<PartyRoomApi>(() => ({ room: previewPartyRoom, say: previewPartySay, report: async () => previewPartyReport() }), []);
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
      calendarData={calendar}
      catalogOverride={catalog}
      skills={sampleSkills(skillsPreset === "pro")}
      previewRankUp={rankUpPreset}
      previewDailyHint={dailyHintPreset}
      player={me}
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
      couple={cityOff ? undefined : couple}
      sublet={cityOff ? undefined : sublet}
      visits={cityOff ? undefined : visitApi}
      starter={cityOff || starterPreset === undefined ? undefined : starterSim.api}
      lockAppsPreview={appsPreset === "locked"}
      // Delete my account: the preview says what would happen and deletes nothing.
      deleteAccount={async () => { await new Promise((r) => setTimeout(r, 600)); return { ok: false, error: "Preview: nothing is deleted here. In the game this deletes the account and lands on the welcome page." }; }}
      crew={cityOff ? undefined : crewApi}
      party={cityOff || storyOff ? undefined : partyApi}
      partyRoom={cityOff || storyOff ? undefined : partyRoomApi}
      cityNews={cityOff ? undefined : previewNews}
      hunt={cityOff ? undefined : huntApi}
      gossip={cityOff ? undefined : gossipApi}
      business={cityOff ? undefined : businessApi}
      radio={cityOff ? undefined : radioApi}
      mayor={cityOff ? undefined : mayorApi}
      campaign={cityOff ? undefined : campaignApi}
      careers={cityOff ? undefined : careerApi}
      underworld={cityOff ? undefined : underworldApi}
      gala={cityOff ? undefined : galaApi}
      choices={cityOff ? undefined : choicesApi}
      remembered={cityOff || (choicePreset !== "story" && choicePreset !== "city") ? undefined : rememberedSim}
      campus={cityOff ? undefined : campusApi}
      goals={cityOff ? undefined : goalsApi}
      push={cityOff ? undefined : pushApi}
      membership={cityOff ? undefined : memberApi}
      previewPushAsk={pushPreset === "ask"}
      previewGoalsReveal={goalsPreset === "day3" ? { kind: "streak", day: 3, reward: "clout" }
        : goalsPreset === "day7" ? { kind: "streak", day: 7, reward: "collectible", sku: "home-neon-five-sign" }
        : goalsPreset === "day14" ? { kind: "streak", day: 14, reward: "pass" }
        : goalsPreset === "goaldone" ? { kind: "goal", id: "pro_gigs", next: "first_business" } : undefined}
      boroughGates={[
        { id: "brooklyn", open: brooklynPreset === "open", target: 100, online: 37, peakToday: 64, counting: brooklynPreset !== "open" },
        { id: "bronx", open: false, target: 250, online: 37, peakToday: 64, counting: brooklynPreset === "open" },
        { id: "staten_island", open: false, target: 500, online: 37, peakToday: 64, counting: false },
        { id: "manhattan", open: false, target: 1000, online: 37, peakToday: 64, counting: false },
      ]}
      tv={cityOff ? undefined : tvApi}
      stations={cityOff ? undefined : STATIONS_PREVIEW}
      together={cityOff ? undefined : togetherApi}
      leaderboardRows={cityOff ? undefined : async () => previewLeaderboard(player.clout)}
      coutureApi={cityOff ? undefined : PREVIEW_COUTURE}
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
