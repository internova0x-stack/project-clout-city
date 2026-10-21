"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PlayerUpdate } from "@/app/home/actions";
import { ECONOMY, formatCash } from "@/lib/economy";
import { inviteUrl } from "@/lib/invite";
import { normalizeLook } from "@/lib/look";
import { music, readLocalMuted, writeLocalMuted } from "@/lib/music";
import { checkBuild, isStaleBuild, reloadForNewBuild } from "@/lib/freshBuild";
import { skillBadge } from "@/lib/skills";
import { LOOK_LABEL, STYLE, lookBadge } from "@/lib/style";
import type { CliqueMember, Player } from "@/lib/player";
import { ASTORIA_CENTER, ASTORIA_ZOOM, DEFAULT_PLAYER_LOCATION, WAVE_1_PINS, type PlacePin } from "@/lib/places";
import { getStyle, starterOutfit } from "@/lib/styles";
import { CATALOG_FURNITURE, CITY_ECONOMY, CLUB_EVENTS, PLACES, eventDaysLine, eventOpen, eventToday, isHub, itemBySku, placeById, realMinutesUntilOpen, type Place, type ShopItem } from "@/lib/city";
import { cityMinutes } from "@/lib/cityClock";
import { GAME_CONFIG } from "@/lib/config";
import { CAMPUS_AREAS, HOME_FLOORS, HOME_TEMPLATES, HUB_FLOORS, PLACE_TEMPLATES, homeTemplate, mergeFloorLayout, ownedId, placedElsewhere, type OwnedPiece, placeFloor, placeRoom, playerSlots, type RoomItem } from "@/lib/rooms";
import { PARTY_POLL_MS, crowdFor, type CrowdMember, type PartyMessage, type PartyPerson, type PartyRoomApi, type PartyRoomState } from "@/lib/partyRoom";
import { PartyChatSheet } from "./city/PartyChat";
import { VIP_LOCKED, activeGig, clubDoor, dueBills, gigAvailability, gigReady, netWorth, tasksDone, isSupermarket, type CityApi, type RestKind, type CityResult, type CityState, type Gain } from "@/lib/cityState";
import { outfitFromSkus } from "@/lib/wearing";
import { modelSex } from "@/lib/avatarCatalog";
import { badgeInfo, chatterLine, mainArc, unseenBeats, type FeedArc, type StoryApi, type StoryFeed, type StoryResult } from "@/lib/storyFeed";
import GENERIC_CHATTER from "@/content/chatter-generic.json";
import CAST_LINES from "@/content/cast-lines.json";
import NPC_PROFILES from "@/content/culture/npcs.json";
import { rememberedLine, withCatchphrases, type NpcProfile, type Roommate } from "@/lib/culture";
import CALENDAR_FILE from "@/content/culture/calendar.json";
import { calendarLive, phoneInvite, type CalendarData } from "@/lib/calendar";
import { RoommateCard, roommateCardDue, roommateMet } from "./home/Roommate";
import { callName, crowdName, regularAt, regularLine } from "@/lib/cast";
import { formatPrice, liveParty, needsConfirm, readReturn, type ExclusiveEvent, type StoreApi, type StoreProduct } from "@/lib/store";
import { BillsSheet, NetWorthSheet, ShopSheet } from "./city/Commerce";
import { LookRoom } from "./city/LookRoom";
import { TravelSheet, TripView, type Trip, type TripPlan } from "./city/Travel";
import { KitchenSheet, RestSheet } from "./city/Rest";
import { LottoSheet } from "./city/Lotto";
import { TeaRevealSheet } from "./city/Gossip";
import { TEA_BADGE, leadAction, leadFrom, leadLine, quietLine, type GossipApi, type GossipFind, type GossipState, type TeaCard } from "@/lib/gossip";
import { LOTTO_BADGE, type LottoCard } from "@/lib/lotto";
import { formatMiles, lineFor, milesBetween, travelQuote, type TravelMode } from "@/lib/travel";
import { BigBuySheet, CollectionSheet, type MoneyHandlers } from "./city/Money";
import { PlayerCardSheet } from "./chat/PlayerCard";
import type { ChatApi } from "@/lib/chat";
import { datingAlerts, type DatePerson, type DatingApi, type DatingInbox } from "@/lib/dating";
import { DateSheet, DatingPrompt, DatingSheet } from "./dating/Dating";
import { crewAlerts, type CrewApi, type CrewInbox, type CrewOuting } from "@/lib/crew";
import { CrewFullCard, CrewPlansSheet, CrewPrompt, CrewSheet } from "./crew/Crew";
import { KeepsakeSheet, PartyPrompt, PlusOneSheet } from "./city/Party";
import { onList, partyBadge, type PartyApi, type PartyInbox, type PartyMention } from "@/lib/party";
import type { ShopCategory } from "@/lib/city";
import { ActionTimer, GainToast, useGameNow } from "./city/Common";
import { actionSeconds, actionVerb, OTHER_SECONDS } from "@/lib/actionTime";
import { DevClock } from "./city/DevClock";
import { PhoneModal, type App } from "./city/Phone";
import { ViewingBar } from "./city/Apartments";
import { ChatPassCard } from "./chat/ChatPass";
import { COUNTS_POLL_MS, PRESENCE_POLL_MS, ROTATE_MS, VIP_SKUS, pickInView, type HerePerson, type PlaceCounts } from "@/lib/meet";
import { VipCoverCard } from "./city/Clubs";
import { InteriorScene, LocationSheet, PlacesSheet, homeLocation, visiblePlaces, type PlaceHandlers } from "./city/Places";
import { NewsPrompt, StoryPrompt } from "./story/StoryBits";
import { activeDelays, newsGossip, splitNews, type NewsItem } from "@/lib/news";
import { HUNT_BADGE, type HuntApi, type HuntState } from "@/lib/hunts";
import { ComingSoon, type ComingSoonKey } from "./ComingSoon";
import { InvitePrompt, LeaderboardSheet, PartyDoneCard, PartySheet, PwaPrompt, isStandalone } from "./game/FirstSession";
import { BankSheet, EventsSheet, TasksSheet } from "./game/Sheets";
import { DailyTasksHint, TourTooltip, TOUR } from "./game/Tutorial";
import { openBoroughs, type BoroughGate } from "@/lib/boroughGates";
import { boroughOf } from "@/lib/city";
import { GameChrome, type ChromeAction, type QuestButton, type Tab } from "./hud/GameChrome";
import { handle } from "@/lib/validation";
import { ProfileSheet } from "./game/ProfileSheet";
import { RankUpCard } from "./game/Ranks";
import { GoalsRevealCard, revealBetween, type GoalsReveal } from "./game/Goals";
import { PushPrompt, shouldAskPush } from "./push/Push";
import { MembershipSheet } from "./store/Membership";
import type { MembershipApi, MembershipState } from "@/lib/membership";
import type { PushApi } from "@/lib/pushClient";
import type { GoalsApi, GoalsState } from "@/lib/goals";
import { TillsCollectedCard, WentPublicCard } from "./city/Businesses";
import { businessById, businessesValue, type BusinessApi, type BusinessResult, type BusinessState } from "@/lib/businesses";
import { RANKS, rankFor, type Rank } from "@/lib/ranks";
import { contextTips } from "@/lib/statTips";
import type { PlayerCard } from "@/lib/chat";
import { InviteSheet } from "./InviteSheet";
import { DecorApproveCard, DecoratingBar, JobsApp, RideWaitCard, TogetherBonusCard, TogetherPlansSheet, TogetherPrompt, TogetherSheet } from "./together/Together";
import {
  canDoTogether, jobToApprove, rideShare, togetherAlerts, togetherVerb,
  type JobHome, type JobsBoard, type MyJob, type RideRequest, type TogetherApi, type TogetherBonus, type TogetherCandidate, type TogetherInbox, type TogetherResult,
} from "@/lib/together";
import type { CrewPerson } from "@/lib/crew";
import { CityMap, type MapApi } from "./map/CityMap";
import { BoroughSheet } from "./map/BoroughSheet";
import type { BoroughId } from "@/lib/map/boroughs";
import { Sheet } from "./Sheet";
import { useCityClock } from "./useCityClock";
import { usePlayersOnline } from "./usePresence";
import { RadioBanner } from "./city/Radio";
import { TvHomeCard, TvViewer } from "./city/CloutTv";
import { tvCardSeenKey, type Station, type StationApi, type StationThread, type TvApi, type TvFeature, type TvState } from "@/lib/cloutTv";
import { uploadToBigScreen } from "@/lib/tvUpload";
import { bannerSeenKey, type RadioApi, type RadioState, type Shoutout } from "@/lib/radio";
import { campusById, type CampusApi, type CampusId } from "@/lib/campus";
import { CampusSheet } from "./campus/CampusSheet";

/** Culture pack C1: a regular's everyday lines plus their profile's catchphrases. */
const EVERYDAY_LINES = withCatchphrases(CAST_LINES, NPC_PROFILES.profiles as NpcProfile[]);

const Room3D = dynamic(() => import("./room/Room3D"), { ssr: false });
const AvatarHead = dynamic(() => import("./avatar/AvatarHead"), { ssr: false });

export interface GameActions {
  setTutorialState: (state: "done" | "skipped") => Promise<void>;
  attendFirstParty: (withClique: boolean) => Promise<{ ok: true; player: PlayerUpdate } | { ok: false; error: string }>;
  finishHandoff: () => Promise<void>;
  setMusicMuted: (muted: boolean) => Promise<void>;
}

/** The first session after creation, in order (Clarifications section 1, steps 4 to 14). */
export type Flow = "none" | "tour" | "party" | "partyDone" | "leaderboard" | "invitePrompt" | "pwa";

type Panel = "tasks" | "events" | "bank" | "leaderboard" | "profile" | "invite" | "crushInvite" | "places" | "bills" | "look" | "shop" | "networth" | "collection" | "dates" | "crew" | null;

const PINS_KEY = "cc_first_pins_seen";
const TASKS_SEEN_KEY = "cc-tasks-seen";
/** Owner, Oct 17: set when the first session ends, cleared once the player opens the tasks or Lola's nudge. */
const DAILY_HINT_KEY = "cc-daily-hint";
const DAILY_HINT_AFTER_MS = 30_000;
const STORY_DISMISSED_KEY = "cc_story_dismissed";

/** Who's talking in a place (chatter templates are written per role). */
function npcRole(p: Place, floor = 1, index = 0): { who: string; role: string } {
  // v0.11 shared rooms: who's there depends on the kind of place.
  const tag = (t: string) => p.tags.includes(t);
  // Owner, Oct 18: only the first NPC in a room works there; the rest are the crowd, with lines of their own.
  // v0.15 campus areas: who works in each building (CAMPUS_AREAS), students everywhere else.
  if (tag("campus") && p.template === "campus") {
    if (index > 0 || floor === 1) return { who: "A student", role: "student" };
    if (floor === 3) return { who: "The librarian", role: "librarian" };
    if (floor === 4) return { who: "The lunch staff", role: "cook" };
    if (floor === 5) return { who: "The DJ", role: "dj" };
    return { who: "A professor", role: "professor" };
  }
  if (index > 0) return { who: "A regular", role: "patron" };
  // The Hub (owner, Oct 16): who's there depends on the floor.
  if (tag("hub")) {
    if (floor === 2) return { who: "A gamer", role: "regular" };
    if (floor === 3 || floor === 0) return { who: "A regular", role: "regular" };
    return { who: "The server", role: "barista" };
  }
  if (tag("games")) return { who: "A gamer", role: "regular" };
  if (tag("cinema")) return { who: "The usher", role: "clerk" };
  if (tag("police")) return { who: "The desk sergeant", role: "clerk" };
  if (tag("firehouse")) return { who: "A firefighter", role: "regular" };
  if (tag("library")) return { who: "The librarian", role: "clerk" };
  if (tag("chapel") || tag("church")) return { who: "The caretaker", role: "regular" };
  if (tag("gym")) return { who: "A trainer", role: "regular" };
  if (tag("park")) return { who: "A dog walker", role: "regular" };
  if (tag("office") || tag("delivery_hub")) return { who: "A coworker", role: "regular" };
  if (tag("dealership")) return { who: "A salesperson", role: "clerk" };
  if (tag("supermarket")) return { who: "The cashier", role: "clerk" };
  if (tag("rooftop")) return { who: "The host", role: "bartender" };
  if (tag("diner") || tag("pizza")) return { who: "The server", role: "barista" };
  if (p.template === "club") return { who: "The bartender", role: "bartender" };
  if (p.template === "cafe") return { who: "The barista", role: "barista" };
  if (p.template === "counter") return { who: "The clerk", role: "clerk" };
  if (p.template === "campus") return { who: "A professor", role: "professor" };
  if (p.category === "home" || p.tags.includes("luxury")) return { who: "The doorman", role: "doorman" };
  return { who: "Your driver", role: "driver" };
}

function initialFlow(p: Player): Flow {
  if (p.onboarding_step === "party_done") return "leaderboard"; // resume the hand-off
  // Owner, Oct 17: no welcome pop-up; Lola says hello as the tour's first step.
  if (!p.first_party_at && p.tutorial_state === "pending") return "tour";
  return "none";
}

// The signed-in home screen: the apartment and the map, the HUD with live
// clout and cash, and the guided first session (welcome, tour, first party,
// leaderboard, invite and install prompts).
/** A failed call: reload when the game was updated under us, else the usual toast. */
function glitched(e: unknown, toast: (m: string) => void) {
  if (isStaleBuild(e)) { toast("Clout City was updated. Reloading…"); reloadForNewBuild(); return; }
  console.error(e);
  toast("The city glitched. Try again.");
}

/** v0.15: a campus place, whose areas (CAMPUS_AREAS) are its floors. */
const isCampusPlace = (p: Place) => p.tags.includes("campus") && p.template === "campus";

export function GameShell({
  player,
  clique,
  actions,
  daytimeOverride,
  previewFlow,
  city: initialCity = null,
  cityApi,
  story: initialStory = null,
  storyApi,
  catalog: initialCatalog = null,
  storeApi,
  chat,
  track,
  ping,
  skills: previewSkills,
  loadSkills,
  boroughGates,
  loadBoroughs,
  leaderboardRows,
  dating,
  crew,
  party,
  partyRoom,
  partyInbox: initialPartyInbox = null,
  cityNews,
  calendarData = CALENDAR_FILE as CalendarData,
  catalogOverride,
  hunt,
  gossip,
  business,
  together,
  radio,
  campus,
  goals,
  push,
  previewPushAsk = false,
  membership,
  tv,
  stations,
  roomMood = "dream",
  previewRankUp,
  previewDailyHint = false,
  previewGoalsReveal,
  invitedAt,
}: {
  player: Player;
  clique: CliqueMember[];
  actions: GameActions;
  /** v0.3 city state; null until migration 0004 is applied (the city screens then say "coming soon"). */
  city?: CityState | null;
  cityApi?: CityApi;
  /** v0.4 story feed (World State); null until migration 0007 is applied (the News app then says "soon"). */
  story?: StoryFeed | null;
  storyApi?: StoryApi;
  /** v0.5 real-money products (migration 0008); without it the Unlock button says purchases aren't open. */
  catalog?: StoreProduct[] | null;
  storeApi?: StoreApi;
  /** v0.5 chat (migration 0010): Messages in the Phone, player cards from the leaderboard. */
  chat?: ChatApi;
  /** v0.5 analytics: one event per name per day (sessions for day-1 return, invites shared). */
  track?: (name: "session" | "invite_shared" | "beat_shared" | "postcard_shared" | "crush_invite_shared") => void;
  /** Session length (Insights, migration 0053): pinged on open and every minute while the page is visible. */
  ping?: () => Promise<void>;
  /** Skills (owner, Oct 16): the profile's Skills tab; absent until they're switched on. */
  skills?: import("@/lib/skills").SkillState[];
  loadSkills?: () => Promise<import("@/lib/skills").SkillState[] | null>;
  /** Borough gates (owner, Oct 17): which boroughs are open and how close the next one is (borough_state()). */
  boroughGates?: BoroughGate[];
  loadBoroughs?: () => Promise<BoroughGate[] | null>;
  /** v0.5 crushes and date nights (migration 0011). */
  dating?: DatingApi;
  /** Crew outings (migration 0013). */
  crew?: CrewApi;
  /** v0.9 party keepsakes (migration 0029): plus-ones, "Spotted at" and the gossip setting. */
  party?: PartyApi;
  /** v0.11 party rooms (migration 0038): who's at the party, and the event chat. */
  partyRoom?: PartyRoomApi;
  partyInbox?: PartyInbox | null;
  /** v0.6 City News: published items (news_feed(), migration 0017). */
  cityNews?: () => Promise<NewsItem[]>;
  /** C5: the calendar of real-date events (the preview passes one with its dates moved). */
  calendarData?: CalendarData;
  /** The preview's Shop catalog (what was approved in /preview/studio); the game reads city.catalog. */
  catalogOverride?: import("@/lib/shopCatalog").CatalogItem[];
  /** v0.6 treasure hunts (migration 0018); without it there's no Hunt tab. */
  hunt?: HuntApi;
  /** v0.10 neighborhood gossip (migration 0035): Listen in, regulars' pieces, the Tea app and Tea cards. */
  gossip?: GossipApi;
  /** v0.12 businesses (migration 0048); without it the Businesses app is hidden. */
  business?: BusinessApi;
  /** v0.13 Better Together (migration 0050): together bonuses, rides and the Jobs app; hidden without it. */
  together?: TogetherApi;
  /** v0.14 Real Clout FM (migration 0057): the Radio app and the on-air banner; hidden until radio_state answers. */
  radio?: RadioApi;
  /** v0.15 Campus (migration 0072): campus life at the two universities; hidden until campus_state answers. */
  campus?: CampusApi;
  /** Daily tasks 2.0 (migrations 0073, 0074): the suggested goal, streaks and guest-list passes; hidden without it. */
  goals?: GoalsApi;
  /** Push notifications (migration 0078): Lola's ask and Settings → Notifications; hidden without it. */
  push?: PushApi;
  /** Development previews (?push=ask): Lola asks after 2 seconds. */
  previewPushAsk?: boolean;
  /** Membership & purchases (owner, Oct 18): Settings' top row, the profile's VIP line; hidden without payments. */
  membership?: MembershipApi;
  /** v0.14 Clout TV (migration 0058): the Clout TV app, the home card and the Clout Tower's screen; hidden until tv_state answers. */
  tv?: TvApi;
  /** v0.14 texts from the stations (migration 0058), read-only threads in Messages. */
  stations?: StationApi;
  /** Development previews: sample leaderboard rows. */
  leaderboardRows?: Parameters<typeof LeaderboardSheet>[0]["fetchRows"];
  /** Rooms use the Monument Valley-style "dream" lighting; "natural" stays for comparison in previews. */
  roomMood?: "natural" | "dream";
  /** Development previews only: pin the map to day or night. */
  daytimeOverride?: boolean;
  /** Development previews only: open a step of the first session directly. */
  previewFlow?: Flow;
  /** Owner, Oct 15: a friend's invite link from a place opens that place's card once the game is ready. */
  invitedAt?: string;
  /** Development previews only: show the rank-up reveal for this rank (1 to 10). */
  previewRankUp?: number;
  /** Preview: Lola's daily-tasks nudge appears after 2 seconds. */
  previewDailyHint?: boolean;
  /** Development previews (?goals=day3|day7|day14|goaldone): open with that reward reveal. */
  previewGoalsReveal?: GoalsReveal;
}) {
  const [city, setCity] = useState<CityState | null>(initialCity);
  const clock = useCityClock(city?.clockOffsetSeconds ?? 0);
  const daytime = daytimeOverride ?? clock.daytime;
  const [tab, setTab] = useState<Tab>("home");

  const [soon, setSoon] = useState<{ key: ComingSoonKey; title?: string } | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  // v0.7 step 4: a Shop piece being tried on in Your Look.
  const [tryOn, setTryOn] = useState<ShopItem | null>(null);
  const [flow, setFlow] = useState<Flow>(() => previewFlow ?? initialFlow(player));
  const [tourStep, setTourStep] = useState(0);
  const [me, setMe] = useState(player);
  const [partyBusy, setPartyBusy] = useState(false);
  const [partyError, setPartyError] = useState<string | null>(null);
  const [invitedDuringParty, setInvitedDuringParty] = useState(false);
  const [pinsSeen, setPinsSeen] = useState({ invite: true, networth: true });
  const [muted, setMuted] = useState(player.music_muted);
  const mapRef = useRef<MapApi>(null);
  // The invite screen opened from the invite prompt returns to the install prompt when closed.
  const pendingPwa = useRef(false);
  const online = usePlayersOnline(player.id);
  const [busy, setBusy] = useState<string | null>(null);
  const [arranging, setArranging] = useState(false);
  const [gain, setGain] = useState<Gain | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  // Migration 0100: the day's venue boost, said once when it lands ("Your Goth look fits The Kiln: +5 Confidence").
  const styleBoostKey = city?.style?.boost ? `${city.today}:${city.style.boost.place}` : null;
  // A boost already earned before this visit to the game isn't news.
  const styleBoostSeen = useRef<string | null>(initialCity?.style?.boost ? `${initialCity.today}:${initialCity.style.boost.place}` : null);
  useEffect(() => {
    if (!styleBoostKey || styleBoostSeen.current === styleBoostKey) return;
    styleBoostSeen.current = styleBoostKey;
    const b = city!.style!.boost!;
    setToast(`Your ${LOOK_LABEL[b.line] ?? ""} look fits ${placeById(b.place)?.name ?? "here"}: +${STYLE.venueConfidence} Confidence 💅`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [styleBoostKey]);
  // v0.14 Real Clout FM: today's show, checked on open and every few minutes; the banner shows once a shoutout.
  const [radioNow, setRadioNow] = useState<RadioState | null>(null);
  const [radioBanner, setRadioBanner] = useState<Shoutout | null>(null);
  useEffect(() => {
    if (!radio) return;
    let live = true;
    const check = async () => {
      const r = await radio.state().catch(() => null);
      if (!live || !r?.ok) return;
      setRadioNow(r.data);
      const s = r.data.onAir;
      if (s && s.date === r.data.today) {
        let seen = true;
        try { seen = window.localStorage.getItem(bannerSeenKey(s.id)) === "1"; } catch { seen = false; }
        if (!seen) setRadioBanner(s);
      }
    };
    void check();
    const t = setInterval(() => void check(), 5 * 60_000);
    return () => { live = false; clearInterval(t); };
  }, [radio]);
  // v0.14 Clout TV: today's feature (the home card once a feature, the tower's screen), checked every few minutes.
  const [tvNow, setTvNow] = useState<TvState | null>(null);
  const [tvView, setTvView] = useState<TvFeature | null>(null);
  const [tvCardSeen, setTvCardSeen] = useState<number | null>(null);
  const tvApi = useMemo<TvApi | undefined>(() => (tv ? { ...tv, upload: tv.upload ?? uploadToBigScreen } : undefined), [tv]);
  // The tower shows the live photo (owner, Oct 16): check every minute (so the Studio's Show now and Take
  // down reach everyone fast) and right when the next 3-hour slot starts.
  const loadTv = useCallback(async () => {
    if (!tv) return null;
    const r = await tv.state().catch(() => null);
    if (r?.ok) { setTvNow(r.data); return r.data; }
    return null;
  }, [tv]);
  useEffect(() => {
    if (!tv) return;
    void loadTv();
    const t = setInterval(() => void loadTv(), 60_000);
    return () => clearInterval(t);
  }, [tv, loadTv]);
  const tvNextAt = tvNow?.nextAt;
  useEffect(() => {
    if (!tvNextAt) return;
    const ms = Date.parse(tvNextAt) - Date.now() + 2_000;
    if (ms <= 0 || ms > 6 * 3_600_000) return;
    const t = setTimeout(() => void loadTv(), ms);
    return () => clearTimeout(t);
  }, [tvNextAt, loadTv]);
  const tvFeature = tvNow?.featured ?? null;
  // v0.14 On Air: the stations' buttons (on their cards and inside).
  const onStation = (what: "shoutout" | "billboard" | "watch") => {
    if (what === "watch") return openBigScreen();
    const app = what === "shoutout" ? "radio" : "tv";
    if (app === "radio" ? !radio : !tv) return setToast("The station's off the air for now. Try again soon.");
    setPlace(null);
    setPhone({ open: true, app, form: true });
  };
  // Tapping the tower opens at once with what we have (still in its slot), then checks for a newer photo.
  const openBigScreen = useCallback(() => {
    const fresh = !!tvNow && (!tvNow.nextAt || Date.parse(tvNow.nextAt) > Date.now());
    if (fresh) {
      if (tvFeature) setTvView(tvFeature); else setPhone({ open: true, app: "tv" });
    }
    void loadTv().then((st) => {
      const f = st ? st.featured : tvFeature;
      if (fresh) { if (f && f.photo !== tvFeature?.photo) setTvView(f); return; }
      if (f) setTvView(f); else setPhone({ open: true, app: "tv" });
    });
  }, [tvNow, tvFeature, loadTv]);
  // Texts from Real Clout FM and Clout TV (checked with the stations; the badge counts them).
  const [stationThreads, setStationThreads] = useState<StationThread[]>([]);
  useEffect(() => {
    if (!stations) return;
    let live = true;
    const check = async () => {
      const r = await stations.inbox().catch(() => null);
      if (live && r?.ok) setStationThreads(r.data);
    };
    void check();
    const t = setInterval(() => void check(), 5 * 60_000);
    return () => { live = false; clearInterval(t); };
  }, [stations]);
  const readStation = (st: Station) => {
    setStationThreads((ts) => ts.map((t) => (t.station === st ? { ...t, unread: 0 } : t)));
    void stations?.read(st);
  };
  const tvCardDue = (() => {
    if (!tvFeature || tvCardSeen === tvFeature.id) return false;
    try { return window.localStorage.getItem(tvCardSeenKey(tvFeature.id)) !== "1"; } catch { return true; }
  })();
  const dismissTvCard = () => {
    if (!tvFeature) return;
    setTvCardSeen(tvFeature.id);
    try { window.localStorage.setItem(tvCardSeenKey(tvFeature.id), "1"); } catch { /* shows again next visit */ }
  };
  const closeRadioBanner = useCallback(() => {
    setRadioBanner((b) => {
      if (b) try { window.localStorage.setItem(bannerSeenKey(b.id), "1"); } catch { /* shows again next visit */ }
      return null;
    });
  }, []);
  const [place, setPlace] = useState<Place | null>(null);
  const [inside, setInside] = useState<Place | null>(null);
  // #20: each tap on the place's regular inside the room starts their talk in the panel.
  const [talkNonce, setTalkNonce] = useState(0);
  // v0.11: which floor of the building (the exclusive venue has a second, the Penthouse Floor).
  const [insideFloor, setInsideFloor] = useState(1);
  useEffect(() => setInsideFloor(1), [inside?.id]);
  // #19 clubs: the VIP rope, when the cover hasn't been paid tonight.
  const [vipAsk, setVipAsk] = useState<{ place: Place; cover: number } | null>(null);
  const [phone, setPhone] = useState<{ open: boolean; app: App | null; beat?: string | null; item?: string | null; form?: boolean }>({ open: false, app: null });
  // v0.6 City News: loaded once; the newest headline rides the ticker and, once per session, a home card.
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [newsCard, setNewsCard] = useState<string | null>(null);
  /** C3: bumped when the roommate card is dismissed, so it hides (its "seen" lives in localStorage). */
  // Starts at -1 so the server render and the first client render agree (localStorage is read after mount).
  const [roommateTick, setRoommateTick] = useState(-1);
  useEffect(() => setRoommateTick(0), []);
  useEffect(() => {
    if (!cityNews) return;
    void cityNews().then((items) => {
      setNewsItems(items);
      const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
      const latest = splitNews(items, today).recent[0];
      try {
        if (latest && sessionStorage.getItem("cc_news_card") !== "shown") {
          sessionStorage.setItem("cc_news_card", "shown");
          setNewsCard(latest.id);
        }
      } catch { /* private mode: skip the card */ }
    });
  }, [cityNews]);
  // v0.6 treasure hunts: null until hunt_state() answers (no migration, no Hunt tab).
  // v0.7 step 3: my own public card, for the bubble's rank and the profile's "Recently".
  const [myCard, setMyCard] = useState<PlayerCard | null>(null);
  const profileOpen = panel === "profile";
  const [tasksTab, setTasksTab] = useState<"daily" | "goals" | "hunt" | undefined>(undefined);
  // Skills (migration 0056): fresh each time the profile or the Tasks list (its skill task) opens.
  const [skills, setSkills] = useState(previewSkills);
  const tasksOpen = panel === "tasks";
  useEffect(() => {
    if (!(profileOpen || tasksOpen) || !loadSkills) return;
    void loadSkills().then((s) => { if (s) setSkills(s); });
  }, [profileOpen, tasksOpen, loadSkills]);
  useEffect(() => {
    if (!chat) return;
    void chat.card(me.id).then((r) => r.ok && r.data && setMyCard(r.data));
  }, [chat, me.id, profileOpen]);
  const [huntState, setHuntState] = useState<HuntState | null>(null);
  useEffect(() => {
    if (!hunt) return;
    void hunt.state().then((r) => r.ok && setHuntState(r.state));
  }, [hunt]);
  const huntOn = !!huntState?.hunt?.joined && !huntState.hunt.completedAt;
  const [feed, setFeed] = useState<StoryFeed | null>(initialStory);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [catalog, setCatalog] = useState<StoreProduct[] | null>(initialCatalog);
  /** A side story paid for at Stripe, waiting for the webhook to unlock it. */
  const [unlocking, setUnlocking] = useState<string | null>(null);
  const [shopCategory, setShopCategory] = useState<ShopCategory>("fashion");
  // #19 Fif's Furniture: which room of the Home tab to open on, and a piece being tried at home.
  const [shopSection, setShopSection] = useState<string | undefined>(undefined);
  const [tryHome, setTryHome] = useState<ShopItem | null>(null);
  // #19 moving up: a home being looked at from the Apartments app, and the floor you're on at home.
  const [viewHome, setViewHome] = useState<string | null>(null);
  const [homeFloor, setHomeFloor] = useState(1);
  const [chatWith, setChatWith] = useState<{ id: string; name: string; style: string } | null>(null);
  const [chatUnread, setChatUnread] = useState(0);
  const [cardId, setCardId] = useState<string | null>(null);
  // Meeting players (owner, Oct 15; migration 0047): who's here, how many are where, and the unlimited chat offer.
  const [here, setHere] = useState<HerePerson[]>([]);
  // Crowded places (owner, Oct 15): the true count, the people you opened (they stay in view, most recent
  // first) and the turn that walks one of the others out and another in.
  const [hereCount, setHereCount] = useState(0);
  const [pinned, setPinned] = useState<string[]>([]);
  const [turn, setTurn] = useState(0);
  const openPlayer = (id: string) => { setPinned((p) => [id, ...p.filter((x) => x !== id)].slice(0, 3)); setCardId(id); };
  const [placeCounts, setPlaceCounts] = useState<PlaceCounts>({});
  const [chatPass, setChatPass] = useState<{ out: boolean } | null>(null);
  const [memberOpen, setMemberOpen] = useState(false);
  const [member, setMember] = useState<MembershipState | null>(null);
  useEffect(() => { if (membership && !memberOpen) void membership.state().then((r) => r.ok && setMember(r.data)); }, [membership, memberOpen]);
  const memberVip = member?.vip ? "vip" as const : member?.chatForever ? "forever" as const : null;
  const openMembership = () => { setPhone({ open: false, app: null }); setPanel(null); setMemberOpen(true); };
  // v0.12 businesses: what you own (with the server's clock offset, so tills count like the server's),
  // the tills-collected card and the go-public reveal.
  const [biz, setBiz] = useState<BusinessState | null>(null);
  const [bizOffset, setBizOffset] = useState(0);
  const [tillsPaid, setTillsPaid] = useState<{ id: string; cash: number }[] | null>(null);
  const [wentPublic, setWentPublic] = useState(false);
  // Net worth includes businesses, so ranks wait for this first answer (or its failure, before 0048 runs).
  const [bizTried, setBizTried] = useState(!business);
  const loadBiz = useCallback(async () => {
    if (!business) return;
    try {
      const r = await business.state();
      if (r.ok) { setBiz(r.data); setBizOffset(new Date(r.data.now).getTime() - Date.now()); }
    } finally {
      setBizTried(true);
    }
  }, [business]);
  useEffect(() => { void loadBiz(); }, [loadBiz]);
  // Player ranks (owner, Oct 15): the reveal when clout or net worth crosses into a new rank.
  const [rankUp, setRankUp] = useState<Rank | null>(previewRankUp ? RANKS[previewRankUp - 1] ?? null : null);
  const seenRank = useRef<number | null>(null);
  useEffect(() => {
    setPinned([]);
    if (!inside) return;
    const t = setInterval(() => setTurn((n) => n + 1), ROTATE_MS);
    return () => clearInterval(t);
  }, [inside]);
  useEffect(() => {
    if (inside || !chat?.counts) return;
    let stop = false;
    const tick = async () => { const r = await chat.counts!(); if (!stop && r.ok) setPlaceCounts(r.data); };
    void tick();
    const t = setInterval(() => void tick(), COUNTS_POLL_MS);
    return () => { stop = true; clearInterval(t); };
  }, [inside, chat]);
  const [inbox, setInbox] = useState<DatingInbox | null>(null);
  const [dateSpot, setDateSpot] = useState<{ kind: "place" | "event"; target: string; price: number } | null>(null);
  // Owner, Oct 15: the place an invite was sent from (Bring the crew, Make it a date); its link opens there.
  const [invitePlace, setInvitePlace] = useState<Place | null>(null);
  const spotPlace = (s: { kind: "place" | "event"; target: string } | null) =>
    !s ? null : placeById(s.kind === "place" ? s.target : CLUB_EVENTS.find((e) => e.id === s.target)?.placeId ?? "") ?? null;
  const [datingDismissed, setDatingDismissed] = useState<string | null>(null);
  const [datingBusy, setDatingBusy] = useState(false);
  /** Re-reads the dating inbox; a date that just paid out gets its own toast. */
  /** Re-reads the player from the server (bonuses paid by someone else's visit). Set once the city API is ready. */
  const resync = useRef<() => void>(() => {});
  const inboxRef = useRef<DatingInbox | null>(null);
  const loadInbox = useCallback(async () => {
    if (!dating) return;
    const r = await dating.inbox();
    if (!r.ok) return;
    const prev = inboxRef.current;
    inboxRef.current = r.data;
    setInbox(r.data);
    const paid = r.data.dates.find((d) => d.paid && prev?.dates.some((p) => p.id === d.id && !p.paid));
    if (paid) {
      setGain({ clout: r.data.bonus.clout, mood: r.data.bonus.mood });
      setToast(`Date night with ${paid.with.name}. You both pulled up. 💗`);
      resync.current();
    }
  }, [dating]);
  // ---- Crew outings: the inbox, and what changed since the last look ----
  const [crewInbox, setCrewInbox] = useState<CrewInbox | null>(null);
  const crewRef = useRef<CrewInbox | null>(null);
  const [crewPlace, setCrewPlace] = useState<Place | null>(null);
  const [crewFull, setCrewFull] = useState<CrewOuting | null>(null);
  const [crewDismissed, setCrewDismissed] = useState<string | null>(null);
  const [crewBusy, setCrewBusy] = useState(false);
  const loadCrew = useCallback(async () => {
    if (!crew) return;
    const r = await crew.inbox();
    if (!r.ok) return;
    const prev = crewRef.current;
    crewRef.current = r.data;
    setCrewInbox(r.data);
    if (!prev) return;
    const gained = r.data.clout - prev.clout;
    const full = r.data.outings.find((o) => o.full && o.iWent && prev.outings.some((p) => p.id === o.id && !p.full));
    if (full) setCrewFull(full);
    if (gained > 0) {
      // Friends who arrived since the last look (not you: your own visit has its own toast).
      const arrived = r.data.outings.flatMap((o) => o.members.filter((m) => m.went && m.id !== player.id
        && prev.outings.find((p) => p.id === o.id)?.members.some((pm) => pm.id === m.id && !pm.went)));
      setGain({ clout: gained });
      if (!full) setToast(arrived.length ? `${arrived.map((m) => m.name).join(", ")} pulled up. Crew bonus!` : "Crew bonus!");
      resync.current();
    }
  }, [crew, player.id]);
  // ---- v0.13 Better Together: plans, rides and bonuses (polled), and the Jobs board ----
  const [togetherIn, setTogetherIn] = useState<TogetherInbox | null>(null);
  const [togetherTarget, setTogetherTarget] = useState<{ place: string; action: string } | null>(null);
  const [togetherPlansOpen, setTogetherPlansOpen] = useState(false);
  const [togetherDismissed, setTogetherDismissed] = useState<string | null>(null);
  const [bonusCard, setBonusCard] = useState<TogetherBonus | null>(null);
  const [crewPeople, setCrewPeople] = useState<CrewPerson[]>([]);
  const [rideWait, setRideWait] = useState<{ id: number; name: string; mode: "subway" | "taxi"; each: number; plan: TripPlan } | null>(null);
  const [jobs, setJobs] = useState<JobsBoard | null>(null);
  const [decor, setDecor] = useState<JobHome | null>(null);
  const [approveLater, setApproveLater] = useState<number | null>(null);
  const loadTogether = useCallback(async () => {
    if (!together) return null;
    const r = await together.inbox();
    if (!r.ok) return null;
    setTogetherIn(r.data);
    // A bonus your partner's visit paid while you were elsewhere.
    if (r.data.bonuses.length) setBonusCard((cur) => cur ?? r.data.bonuses[0]);
    return r.data;
  }, [together]);
  const loadJobs = useCallback(async () => {
    if (!together) return null;
    const r = await together.jobs.board();
    if (r.ok) setJobs(r.data);
    return r.ok ? r.data : null;
  }, [together]);
  useEffect(() => {
    if (!together) return;
    void loadTogether();
    void loadJobs();
    const t = setInterval(() => { if (document.visibilityState === "visible") { void loadTogether(); void loadJobs(); } }, 20_000);
    return () => clearInterval(t);
  }, [together, loadTogether, loadJobs]);
  useEffect(() => {
    if (togetherTarget && crew && !crewPeople.length) void crew.members().then((r) => r.ok && setCrewPeople(r.data));
  }, [togetherTarget, crew, crewPeople.length]);
  /** After a together activity: if a plan is waiting on it, claim the bonus (quietly when the other hasn't done it yet). */
  const claimTogether = useCallback(async (placeId: string, actionId: string) => {
    if (!together || !togetherIn) return;
    const p = togetherIn.plans.find((x) => x.status === "accepted" && x.place === placeId && x.action === actionId);
    if (!p) return;
    const r = await together.claim(p.id);
    if (r.ok) {
      setBonusCard(r.data);
      void loadTogether();
      resync.current();
    }
  }, [together, togetherIn, loadTogether]);
  const togetherRun = async <T,>(key: string, call: () => Promise<TogetherResult<T>>): Promise<T | null> => {
    setBusy(key);
    try {
      const r = await call();
      if (!r.ok) { setToast(r.error); return null; }
      return r.data;
    } catch (e) {
      glitched(e, setToast);
      return null;
    } finally {
      setBusy(null);
    }
  };
  // ---- v0.10 neighborhood gossip: null until migration 0035 runs (no Tea app, no Listen in) ----
  const [teaState, setTeaState] = useState<GossipState | null>(null);
  const [teaCard, setTeaCard] = useState<{ card: TeaCard; fresh: boolean } | null>(null);
  const loadTea = useCallback(async () => {
    if (!gossip) return null;
    const st = await gossip.state();
    if (st) setTeaState(st);
    return st;
  }, [gossip]);
  useEffect(() => { void loadTea(); }, [loadTea]);
  // ---- v0.9 party keepsakes: plus-ones sent and received, and "Spotted at" mentions ----
  const [partyIn, setPartyIn] = useState<PartyInbox | null>(initialPartyInbox);
  const [mentions, setMentions] = useState<PartyMention[]>([]);
  const [plusOneFor, setPlusOneFor] = useState<ExclusiveEvent | null>(null);
  const [keepsake, setKeepsake] = useState<ExclusiveEvent | null>(null);
  const [partyDismissed, setPartyDismissed] = useState<string | null>(null);
  const loadParty = useCallback(async () => {
    if (!party) return;
    const [i, m] = await Promise.all([party.inbox(), party.mentions()]);
    if (i) setPartyIn(i);
    if (m) setMentions(m);
  }, [party]);
  useEffect(() => {
    if (!party) return;
    void loadParty();
    const t = setInterval(() => void loadParty(), 60_000);
    return () => clearInterval(t);
  }, [party, loadParty]);
  useEffect(() => {
    if (!crew) return;
    void loadCrew();
    const t = setInterval(() => void loadCrew(), 60_000);
    return () => clearInterval(t);
  }, [crew, loadCrew]);
  useEffect(() => {
    if (!dating) return;
    void loadInbox();
    const t = setInterval(() => void loadInbox(), 60_000);
    return () => clearInterval(t);
  }, [dating, loadInbox]);
  // A session a day counts toward day-1 return; unread messages badge the Phone.
  useEffect(() => { track?.("session"); }, [track]);
  // After a deploy, an installed app left open reloads when it comes back (lib/freshBuild.ts).
  useEffect(() => {
    const onShow = () => { if (document.visibilityState === "visible") void checkBuild(); };
    document.addEventListener("visibilitychange", onShow);
    window.addEventListener("pageshow", onShow);
    const id = window.setInterval(onShow, 10 * 60_000);
    return () => { document.removeEventListener("visibilitychange", onShow); window.removeEventListener("pageshow", onShow); window.clearInterval(id); };
  }, []);
  useEffect(() => {
    if (!ping) return;
    const beat = () => { if (document.visibilityState === "visible") void ping().catch(() => {}); };
    beat();
    const id = window.setInterval(beat, GAME_CONFIG.sessionPingMs);
    document.addEventListener("visibilitychange", beat);
    return () => { window.clearInterval(id); document.removeEventListener("visibilitychange", beat); };
  }, [ping]);
  useEffect(() => {
    if (!chat) return;
    const check = () => void chat.list().then((r) => r.ok && setChatUnread(r.data.reduce((n, c) => n + c.unread, 0)));
    check();
    const t = setInterval(check, 60_000);
    return () => clearInterval(t);
  }, [chat]);
  const gameNow = useGameNow(city?.clockOffsetSeconds ?? 0, 5000);

  const look = normalizeLook(me.look, me.starting_style);
  const style = getStyle(look.style);
  // Everything worn: the code's pieces, the Shop catalog's clothes and accessories (lib/wearing.ts).
  const wornSkus = city ? city.items.filter((i) => i.equipped && i.category === "fashion").map((i) => i.sku) : [];
  const outfit = wornSkus.length ? outfitFromSkus(starterOutfit(style, look.body, look.fit), wornSkus) : undefined;
  const home = homeLocation(me.home_id);
  // v0.8 travel (#4): where the player is. Null is home; without migration 0025 there's no travel.
  const travelOn = !!(city && cityApi?.travel && city.player.at_place !== undefined);
  // v0.8 rest and bar drinks (migration 0026): restToday is missing until it runs.
  const restOn = !!(city?.restToday && cityApi?.rest);
  // v0.8 groceries and the kitchen (migration 0027): fridge_meals is missing until it runs.
  const kitchenOn = !!(travelOn && city?.player.fridge_meals !== undefined && cityApi?.cook);
  const atPlace = travelOn ? city!.player.at_place ?? null : null;
  const atPlaceInfo = atPlace ? placeById(atPlace) : undefined;
  // Presence (owner, Oct 15: two players at the same café couldn't see each other): you count as here
  // once you've arrived, inside the room or on the map outside it; inside, on the floor you're on.
  const presencePlace = inside?.id ?? atPlace;
  const presenceFloor = inside ? insideFloor : 1;
  useEffect(() => {
    if (!presencePlace || !chat?.presence) { setHere([]); setHereCount(0); return; }
    let stop = false;
    const tick = async () => { const r = await chat.presence!(presencePlace, presenceFloor); if (!stop && r.ok) { setHere(r.data.people); setHereCount(r.data.count); } };
    void tick();
    const t = setInterval(() => void tick(), PRESENCE_POLL_MS);
    return () => { stop = true; clearInterval(t); };
  }, [presencePlace, presenceFloor, chat]);
  const myPos = atPlaceInfo?.at ?? home;
  const myPosName = atPlaceInfo?.name ?? "home";
  const [travelPlan, setTravelPlan] = useState<TripPlan | null>(null);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [restKind, setRestKind] = useState<RestKind | null>(null);
  const [kitchenOpen, setKitchenOpen] = useState(false);
  // v0.10 Lucky Star Lotto (migration 0032): lotto state is missing until it runs.
  const lottoOn = !!(travelOn && city?.lotto && cityApi?.buyLottoCard && cityApi.scratchLottoCard);
  const [lottoAt, setLottoAt] = useState<string | null>(null);
  const [campusAt, setCampusAt] = useState<CampusId | null>(null);
  const [campusTab, setCampusTab] = useState<"classes" | "exams" | "dining" | "pride" | undefined>(undefined);
  // The nearest supermarket, for "Go shopping" from an empty fridge.
  const grocer = useMemo(() => PLACES.filter((p) => isSupermarket(p.tags)).sort((a, b) => milesBetween(myPos, a.at) - milesBetween(myPos, b.at))[0], [myPos]);
  const cityOn = !!(city && cityApi);
  const statSuggestions = useMemo(() => {
    if (!cityOn || !city) return undefined;
    const tips = contextTips(visiblePlaces(feed), city, { restOn, kitchenOn });
    // With the Confidence and clout a pro gig or big break needs, that's the better use of Confidence.
    const gig = city.gigs.filter((g) => g.tier !== "side" && !g.accepted_at && gigAvailability(g, city).ok).sort((a, b) => b.pay - a.pay)[0];
    if (gig) tips.confidence = { stat: "confidence", placeId: "gigs", placeName: gig.tier === "big" ? "A big break is open" : "A pro gig is open", emoji: "💼", price: 0, gain: 0, gig: { id: gig.id, pay: gig.pay } };
    return tips;
  }, [cityOn, city, feed, restOn, kitchenOn]);
  // Borough gates (owner, Oct 17): fresh on open and every few minutes; Brooklyn stays locked until the server says so.
  const [gates, setGates] = useState<BoroughGate[] | null>(boroughGates ?? null);
  useEffect(() => {
    if (!loadBoroughs) return;
    let stop = false;
    const tick = () => void loadBoroughs().then((g) => { if (!stop && g) setGates(g); });
    tick();
    const t = setInterval(tick, 3 * 60_000);
    return () => { stop = true; clearInterval(t); };
  }, [loadBoroughs]);
  const openSet = useMemo(() => openBoroughs(gates), [gates]);
  const cityPins = useMemo(() => CITY_PINS(home, feed, openSet), [home, feed, openSet]);
  // The map's dark veil lifts off a borough once it opens.
  useEffect(() => { mapRef.current?.setBoroughLock("brooklyn", !openSet.has("brooklyn")); }, [openSet, tab]);
  const storyOn = !!(feed && storyApi);

  // ---- City actions: one at a time; the server's answer replaces local state ----
  const applyCity = useCallback((r: CityResult): boolean => {
    if (!r.ok) {
      setToast(r.error);
      return false;
    }
    setCity(r.state);
    const p = r.state.player;
    setMe((m) => ({ ...m, bank_cash: p.bank_cash, clout: p.clout, energy: p.energy, mood: p.mood, confidence: p.confidence, home_id: p.home_id }));
    if (r.gain) setGain(r.gain);
    return true;
  }, []);
  const run = useCallback(
    async (key: string, call: () => Promise<CityResult>): Promise<boolean> => {
      setBusy(key);
      try {
        return applyCity(await call());
      } catch (e) {
        glitched(e, setToast);
        return false;
      } finally {
        setBusy(null);
      }
    },
    [applyCity],
  );
  // Skill perks (migration 0092): skill gigs, invites and club access, shared by the Skills tab and the Gigs app.
  const perkHandlers = useMemo(() => (cityApi?.takeSkillGig && city?.perks ? {
    state: city.perks,
    clockOffsetSeconds: city.clockOffsetSeconds,
    busy,
    onTake: (id: string) => void run(`perk:${id}`, () => cityApi.takeSkillGig!(id)),
    onCollect: (id: string) => void run(`perk:${id}`, () => cityApi.collectSkillGig!(id)),
    onRsvp: (id: string) => void run(`perk:${id}`, () => cityApi.acceptSkillInvite!(id)),
  } : undefined), [cityApi, city?.perks, city?.clockOffsetSeconds, busy, run]);
  // ---- Daily tasks 2.0: the goal, the streak and passes. goals_state also pays a goal that has just finished, so it
  // runs when the Tasks sheet opens and shortly after anything that could finish one (a task, clout, cash, a move).
  const [goalsNow, setGoalsNow] = useState<GoalsState | null>(null);
  const [goalsReveal, setGoalsReveal] = useState<GoalsReveal | null>(previewGoalsReveal ?? null);
  const goalsPrev = useRef<GoalsState | null>(null);
  const ownedSkus = useRef<Set<string>>(new Set());
  ownedSkus.current = new Set((city?.items ?? []).map((i) => i.sku));
  const loadGoals = useCallback(async () => {
    if (!goals) return;
    const r = await goals.state().catch(() => null);
    if (!r?.ok) return;
    const reveal = revealBetween(goalsPrev.current, r.data, (sku) => ownedSkus.current.has(sku));
    goalsPrev.current = r.data;
    setGoalsNow(r.data);
    if (reveal) setGoalsReveal(reveal);
  }, [goals]);
  const goalsKey = city ? `${tasksDone(city)}:${city.player.clout}:${city.player.bank_cash}:${city.player.home_id}:${city.player.car_sku}:${city.player.house_sku}:${city.items.length}` : "";
  useEffect(() => {
    if (!goals || !goalsKey) return;
    const t = setTimeout(() => void loadGoals(), goalsPrev.current ? 800 : 0);
    return () => clearTimeout(t);
  }, [goals, goalsKey, loadGoals]);
  useEffect(() => { if (panel === "tasks") void loadGoals(); }, [panel, loadGoals]);
  const spendPass = useCallback(async (placeId: string): Promise<boolean> => {
    if (!goals) return false;
    setBusy(`pass:${placeId}`);
    try {
      const r = await goals.usePass(placeId);
      if (!r.ok) { setToast(r.error); return false; }
      goalsPrev.current = r.data;
      setGoalsNow(r.data);
      return true;
    } catch (e) {
      glitched(e, setToast);
      return false;
    } finally {
      setBusy(null);
    }
  }, [goals]);

  // The lotto's answers carry the card (its id, then its prize); the card itself shows the result.
  const lottoCall = useCallback(async (key: string, call: () => Promise<CityResult>): Promise<LottoCard | null> => {
    setBusy(key);
    try {
      const r = await call();
      if (!r.ok) { setToast(r.error); return null; }
      applyCity({ ...r, gain: undefined });
      return r.card ?? null;
    } catch (e) {
      glitched(e, setToast);
      return null;
    } finally {
      setBusy(null);
    }
  }, [applyCity]);
  // v0.12 businesses: every answer refreshes what you own and the city (cash moved).
  const bizRun = useCallback(async <T,>(key: string, call: () => Promise<BusinessResult<T>>): Promise<T | null> => {
    setBusy(key);
    try {
      const r = await call();
      if (!r.ok) { setToast(r.error); return null; }
      await loadBiz();
      if (cityApi) { const c = await cityApi.refresh(); if (c.ok) applyCity(c); }
      return r.data;
    } catch (e) {
      glitched(e, setToast);
      return null;
    } finally {
      setBusy(null);
    }
  }, [loadBiz, cityApi, applyCity]);
  useEffect(() => {
    resync.current = () => { if (cityApi) void cityApi.refresh().then((r) => r.ok && applyCity(r)); };
  }, [cityApi, applyCity]);
  // ---- Story actions: the server answers with the player's fresh story feed ----
  const applyStory = useCallback((r: StoryResult): boolean => {
    if (!r.ok) {
      setToast(r.error);
      return false;
    }
    setFeed(r.feed);
    if (r.clout) {
      setMe((m) => ({ ...m, clout: m.clout + r.clout! }));
      setGain({ clout: r.clout });
    }
    if (r.message) setToast(r.message);
    return true;
  }, []);
  const runStory = useCallback(
    async (key: string, call: () => Promise<StoryResult>): Promise<boolean> => {
      setBusy(key);
      try {
        return applyStory(await call());
      } catch {
        setToast("The newsroom glitched. Try again.");
        return false;
      } finally {
        setBusy(null);
      }
    },
    [applyStory],
  );
  const offset = city?.clockOffsetSeconds ?? 0;
  // The story follows the New York calendar (and the staging clock), so re-read it when either moves.
  useEffect(() => {
    if (!storyApi) return;
    void storyApi.refresh(offset).then((r) => r.ok && applyStory(r));
    const onVis = () => { if (document.visibilityState === "visible") void storyApi.refresh(offset).then((r) => r.ok && applyStory(r)); };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [storyApi, offset, applyStory]);
  useEffect(() => {
    try { setDismissed(JSON.parse(localStorage.getItem(STORY_DISMISSED_KEY) ?? "[]")); } catch { /* fine */ }
  }, []);
  const dismissStory = (key: string) => {
    setDismissed((d) => {
      const next = [...d, key].slice(-40);
      try { localStorage.setItem(STORY_DISMISSED_KEY, JSON.stringify(next)); } catch { /* fine */ }
      return next;
    });
  };
  /** #11: what's on the action timer right now (rewards land when it runs out). */
  const [doing, setDoing] = useState<{ emoji: string; label: string; seconds: number; key: number } | null>(null);
  const timed = (emoji: string, label: string, seconds: number, call: () => Promise<CityResult>) => (): Promise<CityResult> =>
    seconds <= 0 ? call() : new Promise<void>((done) => {
      setDoing({ emoji, label, seconds, key: Date.now() });
      setTimeout(done, seconds * 1000);
    }).then(() => { setDoing(null); return call(); });
  /** City actions can finish story tasks; the server already counted them, so just re-read the feed. */
  const cityThenStory = async (key: string, call: () => Promise<CityResult>) => {
    const ok = await run(key, call);
    if (ok && storyApi) await storyApi.refresh(offset).then((r) => r.ok && setFeed(r.feed));
    // A visit or an event can complete a date night.
    if (ok && inbox?.dates.some((d) => !d.paid && d.status !== "declined")) void loadInbox();
    if (ok && crewInbox?.outings.length) void loadCrew();
  };
  const newsToday = city?.today ?? new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const latestNews = splitNews(newsItems, newsToday).recent[0] ?? null;
  const openCityNews = (id: string) => {
    setPanel(null);
    setPlace(null);
    setNewsCard(null);
    setPhone({ open: true, app: "news", beat: null, item: id });
  };
  const openNews = (beat?: string | null) => {
    setPanel(null);
    setPlace(null);
    setPhone({ open: true, app: "news", beat: beat ?? null });
  };

  useEffect(() => {
    if (storeApi && !initialCatalog) void storeApi.catalog().then((c) => c && setCatalog(c));
  }, [storeApi, initialCatalog]);
  // Back from Stripe Checkout: only the webhook unlocks, so show "unlocking" and check until it lands.
  useEffect(() => {
    const back = readReturn(window.location.search);
    if (!back) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("purchase");
    url.searchParams.delete("sku");
    window.history.replaceState(null, "", url.toString());
    if (back.state === "cancelled") return setToast("Checkout cancelled. Nothing was charged.");
    setUnlocking(back.sku);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // A tapped push notification (migration 0082) opens the game at /home?open=<screen>.
  useEffect(() => {
    const url = new URL(window.location.href);
    const open = url.searchParams.get("open");
    if (!open) return;
    url.searchParams.delete("open");
    window.history.replaceState(null, "", url.toString());
    if (open === "messages" || open === "gigs" || open === "businesses") setPhone({ open: true, app: open });
    else if (open === "bills" || open === "tasks" || open === "events") setPanel(open);
    // Creator links (migration 0087) can land on the News, the Shop or the VIP plans.
    else if (open === "news") openNews(null);
    else if (open === "shop") openShop("fashion");
    else if (open === "vip") setChatPass({ out: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Back from Stripe's billing portal (Membership & purchases): reopen the screen with the fresh plan.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("membership") !== "back" || !membership) return;
    url.searchParams.delete("membership");
    window.history.replaceState(null, "", url.toString());
    setMemberOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!unlocking || !storeApi) return;
    const started = Date.now();
    let stop = false;
    const check = async () => {
      const [c, f] = await Promise.all([storeApi.catalog(), storyApi?.refresh(offset)]);
      if (stop) return;
      if (c) setCatalog(c);
      if (f?.ok) setFeed(f.feed);
      const p = c?.find((x) => x.sku === unlocking);
      if (p?.owned) {
        setUnlocking(null);
        setToast(p.type === "exclusive_event" ? `🎟️ You're on the list: ${p.name}` : p.type === "chat_pass" ? (VIP_SKUS.includes(p.sku) ? "👑 You're a VIP. Chat away; every side story is unlocked." : "✨ Unlimited chat is on. Say hi to everyone.") : `🔓 Unlocked: ${p.name}`);
        // Show it where it lives; collector pieces and tickets also change clout and Net Worth.
        if (p.type === "side_arc") openNews(null);
        if (p.type === "postcard") setPanel("collection");
        if (p.type === "collector_item") setPanel("networth");
        if (p.type === "exclusive_event") setPanel("events");
        if (cityApi && (p.type === "collector_item" || p.type === "exclusive_event")) void cityApi.refresh().then((r) => r.ok && applyCity(r));
      } else if (Date.now() - started > 90_000) {
        setUnlocking(null);
        setToast("Payment received. Unlocking can take a minute; it will appear on its own.");
      }
    };
    void check();
    const t = setInterval(() => void check(), 2500);
    return () => { stop = true; clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlocking, storeApi, storyApi, offset]);
  // Over $50, the confirmation sheet first (BigBuySheet), then checkout.
  const [bigBuy, setBigBuy] = useState<StoreProduct | null>(null);
  const buy = async (sku: string, confirmed = false) => {
    if (!storeApi) return setToast("Purchases aren't switched on yet. Nothing was charged.");
    const product = catalog?.find((p) => p.sku === sku);
    if (!confirmed && needsConfirm(product)) return setBigBuy(product!);
    setBusy(`buy:${sku}`);
    const r = await storeApi.checkout(sku).catch(() => ({ ok: false as const, error: "Checkout didn't open. Nothing was charged; try again." }));
    if (r.ok) return window.location.assign(r.url); // keeps "Opening checkout…" until Stripe loads
    setBusy(null);
    setToast(r.error);
  };

  // Pick up the daily tick (tasks, bills) when the player comes back to the tab.
  useEffect(() => {
    if (!cityApi) return;
    const onVis = () => { if (document.visibilityState === "visible") void cityApi.refresh().then((r) => r.ok && applyCity(r)); };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [cityApi, applyCity]);

  const money: MoneyHandlers = {
    busy,
    onShared: () => track?.("postcard_shared"),
    buy: (sku) => void buy(sku),
    attend: (id) => {
      if (!cityApi?.attendExclusiveEvent) return;
      void run(`party:${id}`, () => cityApi.attendExclusiveEvent!(id)).then(async (ok) => {
        const c = ok && storeApi ? await storeApi.catalog() : null;
        if (c) setCatalog(c);
        // v0.9: what you keep from the night.
        const ev = (c ?? catalog ?? []).find((p) => p.event?.id === id)?.event;
        if (ok && ev && party) {
          await loadParty();
          setKeepsake(ev);
        }
      });
    },
    party: party ? {
      inbox: partyIn,
      bring: (eventId) => setPlusOneFor(products.find((p) => p.event?.id === eventId)?.event ?? null),
      respond: (eventId, yes) => void (async () => {
        setBusy(`plus1:${eventId}`);
        const r = await party.respond(eventId, yes);
        setBusy(null);
        const host = partyIn?.plusOnes.find((x) => x.eventId === eventId && !x.mine)?.host.name;
        setToast(!r.ok ? r.error : yes ? `You're on the list${host ? ` with ${handle(host)}` : ""}. Dress accordingly.` : "No worries. They'll find someone.");
        await loadParty();
        if (r.ok && yes && storeApi) { const c = await storeApi.catalog(); if (c) setCatalog(c); }
      })(),
    } : undefined,
  };
  const products = (catalog ?? []).map((p) => (p.sku === unlocking ? { ...p, pending: true } : p));
  // ---- v0.11 party rooms: at the venue, with a ticket (or a plus-one), while the doors are open ----
  const partyHere = inside ? products.find((x) => x.event?.placeId === inside.id && onList(x)
    && gameNow >= Date.parse(x.event.startsAt) && gameNow < Date.parse(x.event.endsAt))?.event ?? null : null;
  const [room, setRoom] = useState<PartyRoomState | null>(null);
  const [partyChatOpen, setPartyChatOpen] = useState(false);
  const partyId = partyRoom && partyHere ? partyHere.id : null;
  useEffect(() => {
    setRoom(null);
    if (!partyRoom || !partyId) return;
    let stop = false;
    let after = 0;
    const tick = async () => {
      const r = await partyRoom.room(partyId, after);
      if (stop || !r.ok) return;
      const fresh = r.data.messages;
      if (fresh.length) after = fresh[fresh.length - 1].id;
      setRoom((cur) => {
        const have = new Set((cur?.messages ?? []).map((m) => m.id));
        return { count: r.data.count, people: r.data.people, messages: [...(cur?.messages ?? []), ...fresh.filter((m) => !have.has(m.id))].slice(-200) };
      });
    };
    void tick();
    const t = setInterval(() => void tick(), PARTY_POLL_MS);
    return () => { stop = true; clearInterval(t); };
  }, [partyRoom, partyId]);
  const partySay = async (body: string) => {
    if (!partyRoom || !partyId) return false;
    setBusy("partychat");
    const r = await partyRoom.say(partyId, body).finally(() => setBusy(null));
    if (!r.ok) { setToast(r.error); return false; }
    setRoom((cur) => (cur && !cur.messages.some((m) => m.id === r.data.id) ? { ...cur, messages: [...cur.messages, r.data] } : cur));
    return true;
  };
  const partyReport = async (m: PartyMessage) => {
    if (!partyRoom) return;
    const r = await partyRoom.report(m.id, "inappropriate");
    setToast(r.ok ? "Reported. A moderator will look at it." : r.error);
  };
  const partyBlock = chat ? async (m: PartyMessage) => {
    const r = await chat.block(m.from, true);
    if (!r.ok) return setToast(r.error);
    setRoom((cur) => (cur ? { ...cur, messages: cur.messages.filter((x) => x.from !== m.from), people: cur.people.filter((x) => x.id !== m.from) } : cur));
    setToast(`Blocked ${handle(m.name)}. You won't see each other here or in Messages.`);
  } : undefined;
  // #19: the home in the room view: a listing being looked at, else your home (upstairs when you're there).
  const baseHome = homeTemplate(me.home_id, city?.player.house_sku);
  const upstairs = homeFloor > 1 ? HOME_FLOORS[baseHome.id]?.[homeFloor] : undefined;
  const floorNow = upstairs ? homeFloor : 1;
  const viewing = viewHome ? HOME_TEMPLATES[viewHome] : undefined;
  // #19 Fif's Furniture: what the player bought for their home (placed or in storage).
  // A catalog piece (Clout Couture's sofa and statue) has its furniture in CATALOG_FURNITURE and its words in the catalog.
  const homeItem = (sku: string): ShopItem | undefined => {
    const it = itemBySku(sku);
    if (it?.furniture || !CATALOG_FURNITURE[sku]) return it;
    const c = city?.catalog?.find((x) => x.sku === sku);
    return { ...(it ?? {}), sku, category: "home", name: c?.name ?? sku, emoji: c?.emoji ?? "🛋️", furniture: CATALOG_FURNITURE[sku] } as ShopItem;
  };
  const ownedPieces: OwnedPiece[] = (city?.items ?? []).flatMap((i) => {
    const it = i.category === "home" ? homeItem(i.sku) : undefined;
    return it?.furniture ? [pieceOf(it, ownedId(i.id))] : [];
  });
  const elsewhere = placedElsewhere(city?.homeLayout, floorNow);
  const ownedHere = ownedPieces.filter((p) => !elsewhere.has(p.id));
  // v0.13 interior decorator: someone else's home (their furniture, their layout), ground floor.
  const decorHome = decor ? homeTemplate(decor.homeId, decor.houseSku) : undefined;
  const decorPieces: OwnedPiece[] = decor ? decor.items.flatMap((i) => {
    const it = homeItem(i.sku);
    return it?.furniture ? [pieceOf(it, ownedId(i.id))] : [];
  }).filter((p) => !placedElsewhere(decor.layout, 1).has(p.id)) : [];
  const openShop = (category: ShopCategory, section?: string) => {
    setPlace(null);
    setInside(null);
    setShopCategory(category);
    setShopSection(section);
    setPanel("shop");
  };
  // v0.10 gossip. Finding the fifth piece shows Lola's Tea card and refreshes clout and Mood.
  const gossipOn = !!(gossip && teaState && travelOn);
  // v0.11 (migration 0036): every find may complete a gossip daily task, and each piece found names
  // where the next one is. Returns the fresh Tea state, so the toast can point the player on.
  const afterFind = useCallback(async (f: GossipFind): Promise<GossipState | null> => {
    const st = f.found.length ? await loadTea() : teaState;
    if (f.finished.length) {
      const card = st?.cards.find((c) => c.storyId === f.finished[0]);
      if (card) setTeaCard({ card, fresh: true });
    }
    if ((f.finished.length || f.taskCash) && cityApi) void cityApi.refresh().then((r) => r.ok && applyCity(r));
    return st;
  }, [loadTea, teaState, cityApi, applyCity]);
  const pieceNote = (x: GossipFind["found"][number]) => `Piece ${x.count} of ${CITY_ECONOMY.gossip.pieces} · ${x.title}`;
  const taskNote = (f: GossipFind) => (f.taskCash ? ` · ✅ Task done +${formatCash(f.taskCash)}` : "");
  /** "Next: Talk to Rosa at Grind & Gossip Café" for the story just heard, if it isn't finished. */
  const nextOf = (st: GossipState | null, storyId: string): string | null => {
    const s = st?.stories.find((x) => x.id === storyId);
    const p = s && !s.done ? s.pieces.find((x) => !x.found && x.place) : undefined;
    return p && !p.found && p.place ? leadAction({ place: p.place, source: p.source, hours: p.hours }) : null;
  };
  const nextPlaceOf = (st: GossipState | null, storyId: string): string | null => {
    const s = st?.stories.find((x) => x.id === storyId);
    const p = s && !s.done ? s.pieces.find((x) => !x.found && x.place) : undefined;
    return p && !p.found ? p.place : null;
  };
  const nextNote = (st: GossipState | null, storyId: string) => { const n = nextOf(st, storyId); return n ? ` · Next: ${n}` : ""; };
  const listenIn = async (placeId: string, via: "overheard" | "restroom" = "overheard") => {
    if (!gossip) return;
    setBusy(`listen:${placeId}`);
    const r = await gossip.find(placeId, via).finally(() => setBusy(null));
    if (!r.ok) return setToast(r.error);
    const st = await afterFind(r.data);
    // #19: restroom pieces pay clout and Mood on the spot.
    const bonus = r.data.bonus?.clout ? ` · 🚻 +${r.data.bonus.clout} clout` : "";
    if (bonus && cityApi && !r.data.finished.length && !r.data.taskCash) void cityApi.refresh().then((x) => x.ok && applyCity(x));
    if (!r.data.found.length) {
      // Nothing here: point them on (unless more is said here later).
      const lead = r.data.later ? null : leadFrom(st, placeId, Date.now() >> 16);
      return setToast(`👂 ${lead ? `Nothing new here. ${leadLine(lead)}` : quietLine(r.data.later, Date.now())}${taskNote(r.data)}`);
    }
    const x = r.data.found[0];
    setToast(`🍵 ${pieceNote(x)}${r.data.found.length > 1 ? ` (+${r.data.found.length - 1} more)` : ""}${bonus}${nextNote(st, x.story)}${taskNote(r.data)}`);
  };
  /** The regular here: a piece of gossip, or else where to go next. Null when there's nothing to pass on. */
  const hearRegular = async (placeId: string): Promise<{ text: string; note: string; next?: string | null; nextPlace?: string | null } | null> => {
    if (!gossip) return null;
    const r = await gossip.find(placeId, "regular");
    if (!r.ok) return null;
    const st = await afterFind(r.data);
    if (r.data.found.length) {
      const x = r.data.found[0];
      return { text: x.text, note: `🍵 ${pieceNote(x)} · saved to Tea${taskNote(r.data)}`, next: nextOf(st, x.story), nextPlace: nextPlaceOf(st, x.story) };
    }
    const lead = leadFrom(st, placeId, Date.now() >> 16);
    return lead ? { text: leadLine(lead), note: `🍵 A lead for your Tea${taskNote(r.data)}` } : r.data.taskCash ? { text: "Nothing new today. Come back when the block starts talking.", note: taskNote(r.data).slice(3) } : null;
  };
  const shareTea = async (storyId: string, piece: number) => {
    if (!gossip) return;
    setBusy(`share:${storyId}:${piece}`);
    const r = await gossip.share(storyId, piece).finally(() => setBusy(null));
    if (!r.ok) return setToast(r.error);
    setToast(r.data ? `🍵 Shared with ${r.data} in your crew. Now they know.` : "Shared. Nobody in your crew needed it yet.");
    void loadTea();
  };
  const handlers: PlaceHandlers = {
    here: chat?.counts ? (id) => placeCounts[id] : undefined,
    busy,
    travel: travelOn ? {
      isHere: (id) => atPlace === id,
      onGoThere: (p) => { setPlace(null); setInside(null); setTravelPlan({ from: myPos, to: p.at, fromName: myPosName, toName: p.name, toId: p.id }); },
      from: { at: myPos, name: myPosName },
    } : undefined,
    passes: goals && goalsNow && travelOn ? {
      held: goalsNow.passes.held,
      tonight: goalsNow.passes.tonight?.place ?? null,
      busy: !!busy?.startsWith("pass:"),
      onUse: (p) => void spendPass(p.id).then((ok) => {
        if (!ok) return;
        setToast("🎟️ You're on the list tonight. Act like you've been here before.");
        setPlace(null); setInside(null);
        setTravelPlan({ from: myPos, to: p.at, fromName: myPosName, toName: p.name, toId: p.id });
      }),
    } : undefined,
    money: catalog ? { products, nowMs: gameNow, h: money } : undefined,
    onOpenShop: openShop,
    crew: crew && crewInbox ? { outings: crewInbox.outings.filter((o) => o.myStatus !== "declined"), onBring: (p) => setCrewPlace(p) } : undefined,
    dating: dating && inbox ? { me: me.starting_style, dates: inbox.dates.filter((d) => d.status !== "declined"), bonus: inbox.bonus, onMakeDate: setDateSpot } : undefined,
    onAction: (pl, a) => {
      if (!cityApi) return;
      const act = placeById(pl)?.actions.find((x) => x.id === a);
      const v = act ? actionVerb(act) : { emoji: "✨", label: "On it" };
      // v0.13: a together plan for this activity pays its bonus once both have done it.
      void cityThenStory(`${pl}:${a}`, timed(v.emoji, v.label, act ? actionSeconds(act) : 0, () => cityApi.doAction(pl, a))).then(() => claimTogether(pl, a));
    },
    together: together && togetherIn ? {
      plans: togetherIn.plans,
      onTogether: (pl, a) => setTogetherTarget({ place: pl, action: a }),
      // Owner, Oct 15: an invite for the activity in front of you is answered right on its row.
      onAnswer: (id, yes) => void togetherRun(`plan:${id}`, () => together.respond(id, yes)).then((r) => {
        void loadTogether();
        const p = togetherIn.plans.find((x) => x.id === id);
        if (r && yes && p) setToast(`You're in. Do it within ${CITY_ECONOMY.together.windowMinutes} minutes of ${handle(p.withName)} for the bonus.`);
      }),
      busy,
    } : undefined,
    onAttendEvent: (id) => cityApi && void cityThenStory(`event:${id}`, timed("🪩", `At ${CLUB_EVENTS.find((e) => e.id === id)?.name ?? "the event"}`, OTHER_SECONDS.event, () => cityApi.attendEvent(id))),
    onOpenGigs: () => { setPlace(null); setPhone({ open: true, app: "gigs" }); },
    onBuyGroceries: kitchenOn && cityApi?.buyGroceries ? (pl, b) => void run(`groceries:${b}`, timed("🛒", "Shopping", OTHER_SECONDS.groceries, () => cityApi.buyGroceries!(pl, b))) : undefined,
    onOpenLotto: lottoOn ? (id) => setLottoAt(id) : undefined,
    onStation: radio || tv ? onStation : undefined,
    onCampus: campus ? (id) => { if (campusById(id)) { setCampusTab(undefined); setCampusAt(id as CampusId); } } : undefined,
    gossip: gossipOn ? { listen: (id) => void listenIn(id), hear: hearRegular, openPlace: (id) => openPlace(id) } : undefined,
    onBarDrink: restOn && travelOn && cityApi?.barDrink ? (id) => void run(`drink:${id}`, timed("🍸", "At the bar", OTHER_SECONDS.drink, () => cityApi.barDrink!(id))) : undefined,
    story: storyOn ? feed : null,
    onAttendStoryEvent: storyApi
      ? (id) => void runStory(`story:${id}`, () => storyApi.attendEvent(id)).then((ok) => ok && cityApi && cityApi.refresh().then((r) => r.ok && applyCity(r)))
      : undefined,
    // C5 (migration 0096): gift boxes for name-day parties, at Sal's and Schlep & Schmear.
    gift: cityApi?.buyGift && city?.calendar ? {
      places: calendarData.giftPlaces, price: calendarData.giftPrice, held: city.calendar.gifts, max: calendarData.giftsMax,
      onBuy: () => void run("gift", () => cityApi.buyGift!()),
    } : undefined,
    calendarOn: city?.calendar ? (placeId) => calendarData.events.find((e) => e.place === placeId && calendarLive(e, gameNow))?.title ?? null : undefined,
    regular: (p, n) => {
      const r = regularAt(p.id);
      if (!r) return null;
      const story = feed?.chatter?.find((t) => t.lines)?.lines ?? null;
      // Studio lines first, then this week's city news as gossip.
      // C2: Sal remembers your order after three different days at the deli.
      const known = rememberedLine(NPC_PROFILES.profiles as NpcProfile[], r.id, city?.regularDays?.[p.id] ?? 0);
      const live = { [r.id]: [...(known ? [known] : []), ...(city?.npcLines?.[r.id] ?? []), ...newsGossip(newsItems, newsToday, 1), ...(huntOn ? huntState!.hunt!.chatter : [])] };
      return { regular: r, line: regularLine(r, n + Math.floor(gameNow / 600_000), { story, live, evergreen: EVERYDAY_LINES }) };
    },
    hunt: hunt && huntOn ? {
      talk: async (placeId) => {
        const r = await hunt.talk(placeId);
        if (r.ok) setHuntState(r.state);
        return r;
      },
      answer: async (choice) => {
        const r = await hunt.answer(choice);
        if (!r.ok) return r;
        setHuntState(r.state);
        if (r.reward) {
          setGain({ cash: r.reward.cash, clout: r.reward.clout });
          setToast(r.reward.badge ? "🏅 Treasure Hunter badge! Four hunts, four treasures." : `🗺️ Found it: ${r.state.cards[0]?.treasure ?? "the treasure"}. It's in your Collection.`);
          if (cityApi) void cityApi.refresh().then((c) => c.ok && applyCity(c));
        }
        return r;
      },
    } : undefined,
    chatter: (p) => {
      const { who, role } = npcRole(p);
      // The story's current phase first, everyday gossip otherwise; a new line every ten minutes.
      return { who, line: chatterLine(feed, role, GENERIC_CHATTER, Math.floor(gameNow / 600_000) + p.id.length) };
    },
  };
  const news = storyApi
    ? {
        busy,
        vote: (pid: string, o: string) => void runStory(`vote:${pid}`, () => storyApi.vote(pid, o)),
        shadowGuess: (pid: string, o: string) => void runStory(`shadow:${pid}`, () => storyApi.shadowGuess(pid, o)),
        markSeen: (id: string) => void storyApi.markSeen(id).then((r) => r.ok && setFeed(r.feed)),
        completeTask: (id: string) => void runStory(`task:${id}`, () => storyApi.completeTask(id)),
        onUnlock: (arc: FeedArc) => (arc.sku ? void buy(arc.sku) : undefined),
        onShared: () => track?.("beat_shared"),
        // VIP (migration 0052): monthly and yearly members have every side story.
        vip: catalog?.some((p) => VIP_SKUS.includes(p.sku)) ? {
          member: !!catalog?.some((p) => VIP_SKUS.includes(p.sku) && p.owned),
          onJoin: () => { setPhone({ open: false, app: null }); setChatWith(null); setChatPass({ out: false }); },
        } : undefined,
        product: (sku: string) => {
          const p = catalog?.find((x) => x.sku === sku);
          return p ? { price: formatPrice(p.priceCents, p.currency), pending: unlocking === sku || p.pending } : null;
        },
      }
    : undefined;
  /** A tap on a story task: go where it happens, or open the story for share and evidence tasks. */
  const onStoryTask = (t: StoryFeed["tasks"][number]) => {
    const where = t.do.place ?? feed?.events.find((e) => e.id === t.do.event)?.place;
    if (where) return openPlace(where);
    openNews(mainArc(feed)?.beats.at(-1)?.id);
  };
  const openPlace = (id: string) => {
    const p = placeById(id);
    if (!p) return;
    if (!openSet.has(boroughOf(p))) { setPanel(null); return setLockedBorough(boroughOf(p)); }
    setPanel(null);
    setTab("map");
    setInside(null);
    setPlace(p);
    mapRef.current?.moveCamera(p.at, 15.5);
  };
  /** A tap on something in a place's room: run its action, or the event that's on. */
  // v0.11: every place but subway stations has a room (shared templates take the place's own actions).
  const insideRoom = useMemo(
    () => (inside ? placeRoom(inside) : null),
    [inside],
  );
  // Player ranks: the first reading (once the city and net worth are in) is where you are; a higher one
  // later is a climb.
  // Net worth is everything you own: cash, things and businesses at their worth (owner, Oct 15).
  const otherWorth = city ? netWorth(city) : me.bank_cash;
  const myWorth = otherWorth + (biz ? businessesValue(biz.owned, me.clout) : 0);
  const myRank = rankFor(me.clout, myWorth);
  useEffect(() => {
    if (!city || !bizTried) return;
    if (seenRank.current !== null && myRank.level > seenRank.current) setRankUp(myRank);
    seenRank.current = myRank.level;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myRank.level, !!city, bizTried]);
  const insideTemplate = inside ? (insideFloor !== 1 ? placeFloor(inside, insideFloor) : null) ?? insideRoom ?? PLACE_TEMPLATES.cafe : null;
  // Meeting players (owner, Oct 15; migration 0047): the real players on this floor stand in the room;
  // nothing over their heads (NPCs keep their 💬), tap the figure to open their card. Crowded places
  // (owner, Oct 15): the room holds a few (lib/rooms.ts playerSlots) beside its regulars, who never make
  // way; pickInView picks who (opened, crew, then turns) and the rest are in the Here now list.
  const partyFloor = !!room && insideFloor === 2;
  const floorPeople: PartyPerson[] = [
    ...here.filter((p) => p.floor === insideFloor),
    ...(partyFloor ? room!.people.filter((p) => !here.some((h) => h.id === p.id)) : []),
  ];
  const slots = insideTemplate ? playerSlots(insideTemplate) : 0;
  const inView = pickInView(floorPeople, slots, pinned, turn).map((id) => floorPeople.find((p) => p.id === id)!);
  const toLook = (p: PartyPerson) => normalizeLook(p.look, p.style);
  // Party floors fill their spots with extras (lib/partyRoom.ts); anywhere else only real players.
  const crowd: CrowdMember[] | undefined = partyFloor
    ? crowdFor(inView, toLook, slots)
    : inView.length ? inView.map((p) => ({ key: `p:${p.id}`, npc: false as const, id: p.id, name: p.name, style: p.style, look: toLook(p), crew: p.crew })) : undefined;
  const useInPlace = (p: Place, it: RoomItem) => {
    if (it.use?.kind === "station") return onStation(it.use.what);
    // v0.15 campus areas: the lecture desks, the library's exam table and the dining hall open Campus life.
    if (it.use?.kind === "campus") {
      if (!campus || !campusById(p.id)) return setToast("Campus life is still enrolling. Come back soon.");
      setCampusTab(it.use.tab);
      return setCampusAt(p.id as CampusId);
    }
    if (it.use?.kind === "lotto") return lottoOn ? setLottoAt(p.id) : setToast("Benny's still setting up the counter. Come back soon.");
    if (it.use?.kind === "action") return handlers.onAction(p.id, it.use.actionId);
    if (it.use?.kind === "gigs") return handlers.onOpenGigs();
    if (it.use?.kind === "floor") {
      if (it.use.to <= 1) return setInsideFloor(it.use.to);
      // The Hub's floors are open to everyone.
      if (isHub(p)) return setInsideFloor(it.use.to);
      // #19 clubs: VIP is free from the club's clout, otherwise the cover for tonight (the server decides).
      if (p.club?.vip && !p.tags.includes("exclusive_venue")) {
        if (!cityApi?.enterVip) return setToast(VIP_LOCKED);
        return void (async () => {
          setBusy(`vip:${p.id}`);
          const r = await cityApi.enterVip!(p.id, false).finally(() => setBusy(null));
          if (!r.ok) return setToast(r.error);
          if (r.vip?.needsCover) return setVipAsk({ place: p, cover: r.vip.needsCover });
          setInsideFloor(it.use!.kind === "floor" ? it.use!.to : 2);
        })();
      }
      if (partyHere) return setInsideFloor(it.use.to);
      return setToast("The Penthouse Floor is guest list only, on party nights. The bouncer has a clipboard and no sense of humor.");
    }
    if (it.use?.kind === "listen") return gossipOn ? void listenIn(p.id, "restroom") : setToast("Just someone fixing their eyeliner and humming. Come back later.");
    if (it.use?.kind === "vip") return cityApi?.vipSeen ? void run(`vipseen:${p.id}`, () => cityApi.vipSeen!(p.id)) : undefined;
    if (it.use?.kind === "shop") return openShop(it.use.category, it.use.section);
    if (it.use?.kind !== "events") return;
    // The lounge's guest list: a party you have a ticket for, if its doors are open; otherwise the Events list.
    const party = products.find((x) => x.event?.placeId === p.id && onList(x) && !x.event.attended
      && gameNow >= Date.parse(x.event.startsAt) && gameNow < Date.parse(x.event.endsAt));
    if (party) return money.attend(party.event!.id);
    if (products.some((x) => x.event?.placeId === p.id && liveParty(x, gameNow))) return setPanel("events");
    const minutes = cityMinutes(gameNow, GAME_CONFIG.cityClock);
    // v0.15: Greek Row's dance floor is for party night; the Quad's board for the other campus events.
    const greekRow = isCampusPlace(p) && insideFloor === 5;
    const events = CLUB_EVENTS.filter((e) => e.placeId === p.id && (!isCampusPlace(p) || e.id.startsWith("greek-row") === greekRow));
    const live = events.find((e) => eventOpen(e, minutes) && !city?.attendedToday.includes(e.id));
    if (live) return handlers.onAttendEvent(live.id);
    const partyNight = events.find((e) => e.days);
    if (greekRow && partyNight && !eventToday(partyNight)) return setToast(`Party night is ${eventDaysLine(partyNight)}. Tonight it's just a very sticky couch.`);
    const next = events.filter((e) => !eventOpen(e, minutes)).sort((a, b) => realMinutesUntilOpen(a, minutes) - realMinutesUntilOpen(b, minutes))[0];
    if (p.category === "campus") return setToast(next ? `Nothing on yet. ${next.name} starts in ${realMinutesUntilOpen(next, minutes)} min.` : "You already went today. The board says \"See you next semester.\"");
    setToast(next ? `Dancing solo. ${next.name} opens in ${realMinutesUntilOpen(next, minutes)} min.` : "You already went tonight. Dancing anyway.");
  };
  const clearGain = useCallback(() => { setGain(null); setToast(null); }, []);
  const gig = city ? activeGig(city) : undefined;
  const payoutReady = !!gig && gigReady(gig, gameNow);
  const partyDone = me.first_party_at !== null;
  const handedOff = me.onboarding_step === "handoff_done";
  // Owner, Oct 15: "the invite link should bring them to that specific location". Once the first session
  // is done, open the place from the link, then forget it.
  const invitePlaceDone = useRef(false);
  useEffect(() => {
    if (invitePlaceDone.current || !invitedAt || !handedOff || !city) return;
    invitePlaceDone.current = true;
    document.cookie = `${GAME_CONFIG.invite.placeCookieName}=; Max-Age=0; path=/`;
    const p = placeById(invitedAt);
    if (!p) return;
    setTab("map");
    setPlace(p);
    setTimeout(() => mapRef.current?.moveCamera(p.at, 15.5), 300);
    setToast(`A friend invited you to ${p.emoji} ${p.name}. Go there to meet them.`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invitedAt, handedOff, !!city]);

  // First-play pins on Net Worth and Invite appear at the hand-off (step 14).
  useEffect(() => {
    if (!handedOff) return;
    try {
      const seen = JSON.parse(localStorage.getItem(PINS_KEY) ?? "{}");
      setPinsSeen({ invite: !!seen.invite, networth: !!seen.networth });
    } catch {
      setPinsSeen({ invite: false, networth: false });
    }
  }, [handedOff]);
  // v0.11 (spec section 11): a dot on the task icon at the first open of each New York day, until tapped.
  const [tasksSeenDay, setTasksSeenDay] = useState<string | null>("");
  useEffect(() => {
    try { setTasksSeenDay(localStorage.getItem(TASKS_SEEN_KEY)); } catch { setTasksSeenDay(null); }
  }, []);
  const markTasksSeen = useCallback(() => {
    if (!city?.today) return;
    setTasksSeenDay(city.today);
    try { localStorage.setItem(TASKS_SEEN_KEY, city.today); } catch { /* fine */ }
  }, [city?.today]);
  // Owner, Oct 17: new players didn't know what to do. If the daily tasks haven't been opened 30 seconds after the
  // first session ends, Lola rings the button. Once per device; waits for any open sheet to close first.
  const [dailyHint, setDailyHint] = useState<"waiting" | "due" | "showing" | "done">("done");
  // Push notifications (owner, Oct 18): Lola asks once, a little into a session after the first party (not during the
  // first session's hand-off), and again three days after "Not now".
  const [pushAsk, setPushAsk] = useState(false);
  useEffect(() => {
    if (!push || !partyDone) return;
    let stop = false;
    const t = setTimeout(() => void push.prefs().then((r) => { if (!stop && (previewPushAsk || (r.ok && shouldAskPush(r.data)))) setPushAsk(true); }), previewPushAsk ? 2000 : 20_000);
    return () => { stop = true; clearTimeout(t); };
  }, [push, partyDone, previewPushAsk]);
  useEffect(() => {
    if (previewDailyHint) return setDailyHint("waiting");
    try { if (handedOff && localStorage.getItem(DAILY_HINT_KEY) === "pending") setDailyHint("waiting"); } catch { /* fine */ }
  }, [handedOff, previewDailyHint]);
  useEffect(() => {
    if (dailyHint !== "waiting") return;
    const t = setTimeout(() => setDailyHint("due"), previewDailyHint ? 2000 : DAILY_HINT_AFTER_MS);
    return () => clearTimeout(t);
  }, [dailyHint, previewDailyHint]);
  const endDailyHint = useCallback(() => {
    setDailyHint("done");
    try { localStorage.removeItem(DAILY_HINT_KEY); } catch { /* fine */ }
  }, []);
  const markPin = (k: "invite" | "networth") => {
    setPinsSeen((p) => {
      const next = { ...p, [k]: true };
      try { localStorage.setItem(PINS_KEY, JSON.stringify(next)); } catch { /* fine */ }
      return next;
    });
  };

  // Music starts on the first tap anywhere (and restarts after the phone suspends it), remembering the player's choice.
  useEffect(() => {
    const m = player.music_muted || readLocalMuted();
    setMuted(m);
    music().setMuted(m);
    return music().unlockOnTap();
  }, [player.music_muted]);
  const toggleSound = () => {
    const next = !muted;
    setMuted(next);
    music().start();
    music().setMuted(next);
    writeLocalMuted(next);
    void actions.setMusicMuted(next);
  };

  const shareInvite = useCallback(async () => {
    const url = inviteUrl(process.env.NEXT_PUBLIC_SITE_URL || window.location.origin, me.invite_code);
    try {
      if (navigator.share) {
        await navigator.share({ title: "Clout City NYC", text: "Pull up. I'm at a party in Clout City.", url });
        track?.("invite_shared");
        return true;
      }
      await navigator.clipboard.writeText(url);
      track?.("invite_shared");
      return true;
    } catch {
      return false; // a cancelled share sheet never blocks the party
    }
  }, [me.invite_code]);

  const attend = async (withClique: boolean) => {
    setPartyError(null);
    setPartyBusy(true);
    if (withClique) {
      const shared = await shareInvite();
      if (shared) setInvitedDuringParty(true);
    }
    const r = await actions.attendFirstParty(withClique);
    setPartyBusy(false);
    if (!r.ok) return setPartyError(r.error);
    setMe((p) => ({ ...p, ...r.player }));
    setFlow("partyDone");
  };

  const endHandoff = () => {
    setFlow("none");
    setMe((p) => ({ ...p, onboarding_step: "handoff_done" }));
    try { localStorage.setItem(DAILY_HINT_KEY, "pending"); } catch { /* private mode: no nudge */ }
    setDailyHint("waiting");
    void actions.finishHandoff();
  };
  const afterInvitePrompt = () => (isStandalone() ? endHandoff() : setFlow("pwa"));

  const openParty = () => {
    setPanel(null);
    setFlow("party");
  };

  const onAction = useCallback(
    (a: ChromeAction) => {
      if (a === "tab:home") return setTab("home");
      if (a === "tab:map") return setTab("map");
      if (a === "invite") {
        markPin("invite");
        return setPanel("invite");
      }
      if (a === "leaderboard") return setPanel("leaderboard");
      if (a === "bank") return setPanel("bank");
      if (a === "tasks" || a === "daily") { markTasksSeen(); endDailyHint(); return setPanel("tasks"); }
      if (a === "events") {
        if (flow === "tour") {
          // Tooltip 5 ends the tour by tapping its target, and starts the first task.
          void actions.setTutorialState("done");
          setMe((p) => ({ ...p, tutorial_state: "done" }));
          return openParty();
        }
        return setPanel("events");
      }
      if (a === "networth") markPin("networth");
      if (cityOn) {
        if (a === "places") return setPanel("places");
        if (a === "bills") return setPanel("bills");
        if (a === "look") return setPanel("look");
        if (a === "shop") return setPanel("shop");
        if (a === "networth") return setPanel("networth");
        if (a === "phone") return setPhone({ open: true, app: null });
      }
      setSoon({ key: a });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [flow, cityOn, markTasksSeen, endDailyHint],
  );

  const onPinTap = useCallback(
    (pin: PlacePin) => {
      if (pin.id === "home") {
        if (travelOn && atPlace) return setTravelPlan({ from: myPos, to: home, fromName: myPosName, toName: "home", toId: "home" });
        return setTab("home");
      }
      const p = cityOn ? placeById(pin.id) : undefined;
      // A place in a borough that hasn't opened: the borough's sheet (what it takes to open it).
      if (pin.locked && pin.borough) return setLockedBorough(pin.borough);
      if (p) return setPlace(p);
      setSoon({ key: "place", title: pin.name });
    },
    [cityOn, travelOn, atPlace, myPos, myPosName, home],
  );
  /** Go: pay on the server first (it records when the player arrives), then show the trip. */
  // C4: the trip's train line (where it's going), any delay posted in News on it now, and the OMG Card.
  const passLive = !!city?.player.transit_pass_until && Date.parse(city.player.transit_pass_until) > gameNow;
  const travelTransit = travelPlan && city ? (() => {
    const line = lineFor(travelPlan.toId === "home" ? ECONOMY.homes.find((h) => h.id === me.home_id)?.neighborhood : placeById(travelPlan.toId)?.neighborhood);
    return {
      line,
      delay: (line && activeDelays(newsItems, gameNow)[line]) || null,
      passUntil: city.player.transit_pass_until,
      onBuyPass: cityApi?.buyTransitPass ? (id: string) => void run(`pass:${id}`, () => cityApi.buyTransitPass!(id)) : undefined,
    };
  })() : null;
  const goTravel = async (mode: TravelMode) => {
    const plan = travelPlan;
    if (!plan || !cityApi?.travel) return;
    // C4 (migration 0095): the server's own trip length (a posted delay included) and any showtime dancers.
    let info: CityResult | null = null;
    const ok = await run("travel", async () => (info = await cityApi.travel!(plan.toId, mode)));
    if (!ok) return;
    const t = info && (info as CityResult).ok ? (info as Extract<CityResult, { ok: true }>).trip : undefined;
    const q = travelQuote(mode, milesBetween(plan.from, plan.to), !!city?.player.car_sku, { delay: travelTransit?.delay?.seconds ?? 0, pass: passLive });
    setTravelPlan(null);
    setPlace(null);
    setTab("map");
    setTrip({ ...plan, mode, seconds: t?.seconds ?? q.seconds, fare: q.fare, line: t?.line ?? null, delay: t?.delay ?? 0, showtime: !!t?.showtime });
  };
  // ---- v0.13 ride together: offer, wait for a yes, then both go ----
  const rideGo = async (mode: TravelMode, person: TogetherCandidate) => {
    const plan = travelPlan;
    if (!plan || !together || (mode !== "subway" && mode !== "taxi")) return;
    const r = await togetherRun("ride", () => together.rideOffer(person.id, plan.toId, mode));
    if (!r) return;
    const q = travelQuote(mode, milesBetween(plan.from, plan.to), false);
    setTravelPlan(null);
    setRideWait({ id: r.id, name: person.name, mode, each: r.each || rideShare(q.fare), plan });
  };
  useEffect(() => {
    if (!rideWait || !together) return;
    let stop = false;
    const tick = async () => {
      const r = await together.rideStatus(rideWait.id);
      if (stop || !r.ok || !r.data) return;
      if (r.data.status === "accepted") {
        setRideWait(null);
        setPlace(null);
        setTab("map");
        setTrip({ ...rideWait.plan, mode: r.data.mode, seconds: r.data.seconds, fare: -r.data.cash });
        setToast(`${handle(rideWait.name)} is in. Riding together.`);
        if (cityApi) void cityApi.refresh().then((c) => c.ok && applyCity(c));
      } else if (r.data.status !== "pending") {
        setRideWait(null);
        setToast(`${handle(rideWait.name)} can't make it. Go on your own?`);
        setTravelPlan(rideWait.plan);
      }
    };
    const t = setInterval(() => void tick(), 2500);
    return () => { stop = true; clearInterval(t); };
  }, [rideWait, together, cityApi, applyCity]);
  const answerRide = async (ride: RideRequest, yes: boolean) => {
    if (!together) return;
    const r = await togetherRun(`ride:${ride.id}`, () => together.rideRespond(ride.id, yes));
    void loadTogether();
    if (!r) return;
    if (r.status !== "accepted") return setToast(yes ? "That ride already left." : "Maybe next time.");
    const p = placeById(ride.place);
    setTogetherPlansOpen(false);
    setPanel(null);
    setPlace(null);
    setInside(null);
    setTab("map");
    if (p) setTrip({ from: myPos, to: p.at, fromName: myPosName, toName: p.name, toId: p.id, mode: r.mode, seconds: r.seconds, fare: -r.cash });
    if (cityApi) void cityApi.refresh().then((c) => c.ok && applyCity(c));
  };
  // ---- v0.13 the Jobs app: decorating someone's home ----
  const startDecorating = async (id: number) => {
    if (!together) return;
    const h = await togetherRun(`decor:${id}`, () => together.jobs.home(id));
    if (!h) return;
    setPhone({ open: false, app: null });
    setPanel(null);
    setPlace(null);
    setInside(null);
    setViewHome(null);
    setTab("home");
    setDecor(h);
    setToast(`🛋️ ${handle(h.posterName)}'s place. Tap ✏️ to move things; it saves as you go.`);
  };
  const saveDecor = async (l: Parameters<typeof mergeFloorLayout>[1]): Promise<boolean> => {
    if (!together || !decor) return false;
    const next = mergeFloorLayout(decor.layout, l, 1);
    const r = await togetherRun("layout", () => together.jobs.save(decor.id, next));
    if (!r) return false;
    setDecor((d) => (d ? { ...d, layout: next } : d));
    return true;
  };
  const jobsHandlers = together ? {
    busy,
    onPlayer: chat ? (id: string) => setCardId(id) : undefined,
    take: (id: number) => void togetherRun(`take:${id}`, () => together.jobs.take(id)).then((r) => {
      if (!r) return;
      void loadJobs();
      if (r.kind === "decorator") void startDecorating(id);
      else setToast("💼 You run their tills now. Collect whenever they fill up.");
    }),
    post: (kind: "decorator" | "manager", pay: number, cut: number, note: string) => void togetherRun("post", () => together.jobs.post(kind, pay, cut, note)).then((r) => {
      if (!r) return;
      setToast(kind === "decorator" ? `Posted. ${formatCash(pay)} is held until you approve.` : "Posted. A manager will find you.");
      void loadJobs();
      if (cityApi) void cityApi.refresh().then((c) => c.ok && applyCity(c));
    }),
    cancel: (id: number) => void togetherRun(`cancel:${id}`, () => together.jobs.cancel(id)).then((r) => {
      if (!r) return;
      if (r.cash) setToast(`Cancelled. ${formatCash(r.cash)} is back in your account.`);
      void loadJobs();
      if (cityApi) void cityApi.refresh().then((c) => c.ok && applyCity(c));
    }),
    decorate: (id: number) => void startDecorating(id),
    collect: (id: number) => void togetherRun(`collect:${id}`, () => together.jobs.collect(id)).then((r) => {
      if (!r) return;
      setToast(r.cash ? `Collected ${formatCash(r.collected)}. Your cut: ${formatCash(r.cash)}.` : "The tills are empty. Check back later.");
      void loadJobs();
      if (cityApi) void cityApi.refresh().then((c) => c.ok && applyCity(c));
    }),
    end: (id: number) => void togetherRun(`end:${id}`, () => together.jobs.end(id)).then((r) => { if (r) { setToast("Done. They don't run your tills anymore."); void loadJobs(); } }),
    approve: () => { setApproveLater(null); setPhone({ open: false, app: null }); },
    rate: (id: number, stars: number) => void togetherRun(`rate:${id}`, () => together.jobs.rate(id, stars)).then((r) => { if (r !== null) setToast("Thanks. Rated."); void loadJobs(); }),
  } : null;
  const approving = together && !decor && flow === "none" && !arranging ? jobToApprove(jobs) : null;
  const settleDecor = (job: MyJob, keep: boolean, stars: number | null) => {
    if (!together) return;
    void togetherRun(`settle:${job.id}`, () => together.jobs.settle(job.id, keep, stars)).then((r) => {
      if (!r) return;
      setToast(keep ? `Kept. ${handle(job.workerName)} got paid.` : "Undone. Every piece is back where it was, and the pay is back with you.");
      void loadJobs();
      if (cityApi) void cityApi.refresh().then((c) => c.ok && applyCity(c));
    });
  };
  // Ride together: who's at your place when you open Go there (presence is only polled inside a room).
  const [rideHere, setRideHere] = useState<HerePerson[]>([]);
  useEffect(() => {
    if (!travelPlan || !together || !atPlace || !chat?.presence) { setRideHere([]); return; }
    if (inside?.id === atPlace) { setRideHere(here); return; }
    let stop = false;
    void chat.presence(atPlace, 1).then((r) => { if (!stop && r.ok) setRideHere(r.data.people); });
    return () => { stop = true; };
  }, [travelPlan, together, atPlace, chat, inside, here]);
  /** Who can be invited to do something together: crew anywhere, anyone here now. */
  const togetherPeople: TogetherCandidate[] = (() => {
    const out = new Map<string, TogetherCandidate>();
    for (const h of here) out.set(h.id, { id: h.id, name: h.name, style: h.style, crew: h.crew, here: true });
    for (const c of crewPeople) if (!out.has(c.id)) out.set(c.id, { ...c, crew: true, here: false });
    return [...out.values()].sort((a, b) => Number(b.crew && b.here) - Number(a.crew && a.here) || Number(b.crew) - Number(a.crew));
  })();
  const endTrip = () => {
    const t = trip;
    setTrip(null);
    if (!t) return;
    if (t.toId === "home") return setTab("home");
    const p = placeById(t.toId);
    if (p) setPlace(p);
  };
  const [lockedBorough, setLockedBorough] = useState<BoroughId | null>(null);
  const onLockedTap = useCallback((_name: string, id: BoroughId) => setLockedBorough(id), []);

  const datingKey = inbox ? `${inbox.matches.filter((m) => !m.seen).map((m) => m.id).join()}|${inbox.dates.filter((d) => !d.mine && d.status === "pending").map((d) => d.id).join()}` : "";
  const showDating = !!dating && datingAlerts(inbox) > 0 && datingDismissed !== datingKey && flow === "none" && !arranging && tab === "home" && !inside;
  const crewKey = crewInbox ? crewInbox.outings.filter((o) => !o.mine && o.myStatus === "invited").map((o) => o.id).join() : "";
  // One home card at a time: dates first, then crew plans, then the story.
  const showCrew = !showDating && !!crew && crewAlerts(crewInbox) > 0 && crewDismissed !== crewKey && flow === "none" && !arranging && tab === "home" && !inside;
  const partyInvite = (partyIn?.plusOnes ?? []).find((x) => !x.mine && x.status === "invited");
  const partyKey = partyInvite ? `${partyInvite.eventId}:${partyInvite.host.id}` : "";
  const showParty = !showDating && !showCrew && !!partyInvite && partyDismissed !== partyKey && flow === "none" && !arranging && tab === "home" && !inside;
  // Quest buttons (owner, Oct 16): this week's hunt and the story you're following, until they're finished.
  const quests: QuestButton[] = [];
  const huntNow = huntState?.hunt;
  if (hunt && huntNow && !huntNow.completedAt) {
    quests.push({
      id: "hunt", emoji: "🎁",
      aria: huntNow.joined && huntNow.track ? `Treasure hunt: ${huntNow.theme}, step ${Math.min(huntNow.step + 1, huntNow.track.steps)} of ${huntNow.track.steps}${huntNow.question ? ", a question is waiting" : ""}` : `New treasure hunt: ${huntNow.theme}`,
      dot: !huntNow.joined || !!huntNow.question,
      onOpen: () => { setTasksTab("hunt"); setPhone({ open: false, app: null }); setPanel("tasks"); },
    });
  }
  const storyNow = storyOn ? (mainArc(feed) ?? feed?.arcs.find((a) => a.type === "side" && a.entitled && !a.finished) ?? null) : null;
  if (storyNow) {
    quests.push({
      id: "story", emoji: "🗞️",
      aria: `Story: ${storyNow.title}, day ${Math.min(storyNow.day, storyNow.lastDay)} of ${storyNow.lastDay}${unseenBeats(feed) ? ", new chapters" : ""}`,
      dot: unseenBeats(feed) > 0,
      onOpen: () => openNews(storyNow.beats.filter((b) => !b.locked).at(-1)?.id ?? null),
    });
  }
  const togetherKey = togetherIn ? [...togetherIn.rides.map((r) => `r${r.id}`), ...togetherIn.plans.filter((x) => !x.mine && x.status === "pending").map((x) => x.id)].join() : "";
  const showTogether = !showDating && !showCrew && !showParty && !!together && togetherAlerts(togetherIn) > 0 && togetherDismissed !== togetherKey && flow === "none" && !arranging && !decor;
  // C3: the roommate's intro, then a note a day, when no other home card is up.
  const homeRoommate = ((): Roommate | null => {
    const id = city && !city.player.house_sku ? ECONOMY.homes.find((h) => h.id === me.home_id)?.roommate : undefined;
    return (id && (NPC_PROFILES.roommates as Roommate[]).find((r) => r.id === id)) || null;
  })();
  // The intro comes before the TV and news cards (a new player meets their roommate first); the daily note waits for them.
  const roommateIntro = !!homeRoommate && roommateTick >= 0 && !roommateMet(homeRoommate);
  const showRoommate = !!homeRoommate && !!city && roommateCardDue(homeRoommate, city.today) && roommateTick >= 0
    && !showDating && !showCrew && !showParty && !showTogether && flow === "none" && !arranging && !decor && tab === "home" && !inside
    && !(storyOn && promptVisible(feed, dismissed)) && (roommateIntro || (!(tvCardDue && tvFeature) && !(newsCard && latestNews?.id === newsCard)));
  const showPrompt = showRoommate || showDating || showCrew || showParty || showTogether || (storyOn && flow === "none" && !arranging && tab === "home" && !inside && promptVisible(feed, dismissed));
  const openChatWith = (p: DatePerson) => {
    setPanel(null);
    setChatWith({ id: p.id, name: p.name, style: p.style });
    setPhone({ open: true, app: "messages" });
  };
  const datingRun = async (call: () => Promise<{ ok: boolean; error?: string }>, done?: string) => {
    setDatingBusy(true);
    const r = await call();
    setDatingBusy(false);
    if (!r.ok) setToast(r.error ?? "Cupid glitched. Try again.");
    else if (done) setToast(done);
    await loadInbox();
  };

  return (
    <main className={`game${trip ? " travelling" : ""}${inside && city ? " inside" : ""}${arranging && tab === "home" ? " arranging" : ""}${showPrompt ? " has-story-prompt" : ""}${tab === "home" && !inside ? " at-home" : ""}`}>
      {inside && city ? (
        <>
        <InteriorScene
          place={inside}
          state={city}
          handlers={handlers}
          onBack={() => setInside(null)}
          talkNonce={talkNonce}
          here={chat?.presence ? { people: here, count: Math.max(hereCount, here.length), inView: inView.map((p) => p.id), floor: insideFloor, onOpen: openPlayer } : undefined}
          room={
            <Room3D
              template={insideTemplate!}
              crowd={crowd}
              crowdDots={partyFloor}
              onCrowdTap={(m) => { if (!m.npc && chat) openPlayer(m.id); }}
              look={look}
              outfit={outfit}
              daytime={daytime}
              sign={isCampusPlace(inside) ? `${campusById(inside.id)?.short ?? inside.name} · ${CAMPUS_AREAS[insideFloor]?.name ?? ""}` : isHub(inside) ? `${inside.name} · ${HUB_FLOORS[insideFloor]?.name ?? ""}` : insideFloor === 0 ? `${inside.name} · Restroom` : insideFloor === 2 ? `${inside.name} · ${inside.tags.includes("exclusive_venue") ? "Penthouse" : "VIP"}` : inside.name}
              rotatable
              door
              labels={insideFloor === 2 && inside.tags.includes("exclusive_venue") ? { floor: partyHere && !partyHere.attended ? "Check in 🎟️" : "Dance" } : undefined}
              label={`${me.display_name} inside ${inside.name}`}
              insetBottom={170}
              mood={roomMood}
              onUse={(it) => useInPlace(inside, it)}
              // Everyone has a name (owner, Oct 16); the regular's is the pink pill.
              npcNames={(insideTemplate?.npcs ?? []).map((_, i) => (i === 0 && insideFloor === 1 && regularAt(inside.id) ? callName(regularAt(inside.id)!.name) : crowdName(inside.id, insideFloor, i)))}
              npcHost={insideFloor === 1 && regularAt(inside.id) ? 0 : undefined}
              onNpcTap={(i) => void (async () => {
                // #20 (owner, Oct 14): the first NPC is the place's regular (Sal at the deli): the same talk as the card,
                // hunt clue first, in the panel below the room.
                if (i === 0 && insideFloor === 1 && regularAt(inside.id) && handlers.regular) { setTalkNonce((n) => n + 1); return; }
                const { who: kind, role } = npcRole(inside, insideFloor, i);
                const who = `${crowdName(inside.id, insideFloor, i)} (${kind.replace(/^(A|An|The|Your) /, "")})`;
                // v0.10: the regular may tell you a piece of gossip first.
                const tea = gossipOn && regularAt(inside.id) ? await hearRegular(inside.id) : null;
                // v0.11: some of the others point the player to a gossip lead; owner, Oct 18: not everyone says the same
                // thing, so each NPC has their own line (and lead) for the city-minute, and only every other one gossips.
                const beat = Math.floor(Date.now() / 60_000);
                const lead = !tea && gossipOn && i % 2 === 1 ? leadFrom(teaState, inside.id, beat + i) : null;
                setToast(tea ? `${who}: “${tea.text}” ${tea.note}${tea.next ? ` · Next: ${tea.next}` : ""}` : lead ? `${who}: “${leadLine(lead)}”` : `${who}: “${chatterLine(feed, role, GENERIC_CHATTER, beat + i)}”`);
              })()}
            />
          }
        />
        {/* v0.11 the event chat: everyone at the party, no daily limit tonight. */}
        {vipAsk && (
          <VipCoverCard
            place={vipAsk.place}
            cover={vipAsk.cover}
            freeClout={clubDoor(vipAsk.place).vip?.freeClout ?? 0}
            cash={city.player.bank_cash}
            busy={busy === `vip:${vipAsk.place.id}`}
            onClose={() => setVipAsk(null)}
            passes={goalsNow && !goalsNow.passes.tonight ? goalsNow.passes.held : 0}
            onUsePass={() => void spendPass(vipAsk.place.id).then(async (ok) => {
              if (!ok) return;
              const r = await cityApi!.enterVip!(vipAsk.place.id, false);
              setVipAsk(null);
              if (r.ok && r.vip?.access) { setInsideFloor(2); setToast("🎟️ Guest list. Upstairs. Pretend you've been here before."); }
              else if (!r.ok) setToast(r.error);
            })}
            onPay={() => void run(`vip:${vipAsk.place.id}`, () => cityApi!.enterVip!(vipAsk.place.id, true)).then((ok) => {
              setVipAsk(null);
              if (ok) { setInsideFloor(2); setToast("🥂 You're in. Act like you've been here before."); }
            })}
          />
        )}
        {/* v0.15 campus areas: walk between the Quad and the buildings around it. */}
        {isCampusPlace(inside) && (
          <nav className="campus-areas" aria-label="Campus">
            {Object.entries(CAMPUS_AREAS).map(([n, a]) => (
              <button key={n} className="pill-glass glass-hud" aria-pressed={insideFloor === Number(n)} onClick={() => setInsideFloor(Number(n))}>
                <span aria-hidden="true">{a.emoji}</span> {a.name}
              </button>
            ))}
          </nav>
        )}
        {partyHere && room && (
          <button className="pill-glass glass-hud party-pill" onClick={() => setPartyChatOpen(true)}>
            💬 Party chat · {room.count} here{room.messages.length ? ` · ${room.messages.length}` : ""}
          </button>
        )}
        {partyHere && room && (
          <PartyChatSheet
            open={partyChatOpen}
            onClose={() => setPartyChatOpen(false)}
            title={partyHere.name}
            here={room.count}
            messages={room.messages}
            busy={busy === "partychat"}
            onSend={partySay}
            onProfile={chat ? (id) => { setPartyChatOpen(false); setCardId(id); } : undefined}
            onReport={(m) => void partyReport(m)}
            onBlock={partyBlock ? (m) => void partyBlock(m) : undefined}
          />
        )}
        </>
      ) : tab === "home" ? (
        <div className="layer">
          <Room3D
            template={viewing ?? decorHome ?? upstairs ?? baseHome}
            floor={viewing || decorHome ? 1 : floorNow}
            layout={viewing ? null : decor ? decor.layout : city?.homeLayout}
            look={look}
            outfit={outfit}
            daytime={daytime}
            editable={cityOn && flow === "none" && !viewing}
            rotatable={flow === "none"}
            door={flow === "none"}
            label={viewing ? `Looking around ${ECONOMY.homes.find((h) => h.id === viewHome)?.name ?? "a listing"}` : decor ? `Decorating ${decor.posterName}'s place` : `${me.display_name} at home, wearing ${style.label}`}
            insetBottom={170}
            onUse={(it) => {
              if (viewing || decor) return;
              if (it.use?.kind === "floor") return setHomeFloor(it.use.to);
              if (it.use?.kind === "look") setPanel(cityOn ? "look" : "profile");
              if (restOn && it.use?.kind === "sleep") setRestKind("nap");
              if (restOn && it.use?.kind === "sit") setRestKind("sit");
              if (kitchenOn && it.use?.kind === "cook") setKitchenOpen(true);
            }}
            onEditingChange={setArranging}
            mood={roomMood}
            onSaveLayout={(l) => (decor && together ? saveDecor(l) : cityApi ? run("layout", () => cityApi.saveHomeLayout(mergeFloorLayout(city?.homeLayout, l, floorNow))) : Promise.resolve(true))}
            owned={viewing ? undefined : decor ? decorPieces : ownedHere}
            trial={!decor && tryHome?.furniture ? { piece: pieceOf(tryHome, "trial"), price: tryHome.price, canAfford: (city?.player.bank_cash ?? 0) >= tryHome.price } : undefined}
            onTrialEnd={() => setTryHome(null)}
            onTrialBuy={cityApi && ((l) => run(`buy:${tryHome!.sku}`, async () => {
              // Buy, then keep the piece where it was tried: the layout's "trial" becomes the new item.
              const sku = tryHome!.sku;
              const r = await cityApi.buyItem(sku, "buy");
              if (!r.ok) return r;
              const it = r.state.items.filter((i) => i.sku === sku).sort((a, b) => b.id - a.id)[0];
              if (!it) return r;
              return cityApi.saveHomeLayout(mergeFloorLayout(r.state.homeLayout, l.map((e) => (e.id === "trial" ? { ...e, id: ownedId(it.id) } : e)), floorNow));
            }))}
          />
          {viewing && viewHome && (
            <ViewingBar
              home={ECONOMY.homes.find((h) => h.id === viewHome)!}
              state={city}
              busy={busy !== null}
              onBack={() => { setViewHome(null); setPhone({ open: true, app: "apartments" }); }}
              onMove={cityApi?.moveHome ? () => void run(`move:${viewHome}`, () => cityApi.moveHome!(viewHome)).then((ok) => { if (ok) { setViewHome(null); setHomeFloor(1); setToast("Moved in. The broker fee is not refundable, emotionally or otherwise."); } }) : undefined}
            />
          )}
          {decor && together && (
            <DecoratingBar
              name={decor.posterName}
              endsAt={decor.endsAt}
              pay={decor.pay}
              busy={busy !== null}
              onLeave={() => { setDecor(null); setPhone({ open: true, app: "jobs" }); }}
              onDone={() => void togetherRun(`finish:${decor.id}`, () => together.jobs.finish(decor.id)).then((r) => {
                if (!r) return;
                setDecor(null);
                setToast(`Done. ${handle(decor.posterName)} gets to look; you get ${formatCash(decor.pay)} and ${CITY_ECONOMY.jobs.decorator.clout} clout if they keep it.`);
                void loadJobs();
              })}
            />
          )}
          {showTogether && togetherIn && (
            <TogetherPrompt inbox={togetherIn} onOpen={() => setTogetherPlansOpen(true)} onDismiss={() => setTogetherDismissed(togetherKey)} />
          )}
          {showDating && inbox && (
            <DatingPrompt inbox={inbox} onOpen={() => setPanel("dates")} onDismiss={() => setDatingDismissed(datingKey)} />
          )}
          {showCrew && crewInbox && (
            <CrewPrompt inbox={crewInbox} onOpen={() => setPanel("crew")} onDismiss={() => setCrewDismissed(crewKey)} />
          )}
          {showParty && partyInvite && (
            <PartyPrompt invite={partyInvite} onOpen={() => setPanel("events")} onDismiss={() => setPartyDismissed(partyKey)} />
          )}
          {storyOn && flow === "none" && !arranging && !decor && !showDating && !showCrew && !showParty && !showTogether && (
            <StoryPrompt feed={feed} dismissed={dismissed} onOpen={(beat) => openNews(beat)} onDismiss={dismissStory} />
          )}
          {tvCardDue && tvFeature && !(showRoommate && roommateIntro) && flow === "none" && !arranging && !showDating && !showCrew && !showParty && !showTogether && !(storyOn && promptVisible(feed, dismissed)) && (
            <TvHomeCard f={tvFeature} onOpen={() => { dismissTvCard(); setTvView(tvFeature); }} onDismiss={dismissTvCard} />
          )}
          {!tvCardDue && newsCard && latestNews?.id === newsCard && !(showRoommate && roommateIntro) && flow === "none" && !arranging && !showDating && !showCrew && !showParty && !showTogether && !(storyOn && promptVisible(feed, dismissed)) && (
            <NewsPrompt item={latestNews} onOpen={() => openCityNews(latestNews.id)} onDismiss={() => setNewsCard(null)} />
          )}
          {showRoommate && homeRoommate && city && (
            <RoommateCard roommate={homeRoommate} rent={formatCash(ECONOMY.homes.find((h) => h.id === me.home_id)?.rent ?? 0)}
              rentDue={city.player.next_rent_due} today={city.today} onDone={() => setRoommateTick((n) => n + 1)} />
          )}
        </div>
      ) : (
        <>
          <CityMap
            ref={mapRef}
            rightInset={72}
            pins={cityOn ? cityPins : WAVE_1_PINS}
            vehicles={cityOn}
            player={{ at: cityOn ? myPos : DEFAULT_PLAYER_LOCATION, emoji: style.emoji }}
            initialCenter={cityOn ? ASTORIA_CENTER : DEFAULT_PLAYER_LOCATION}
            initialZoom={cityOn ? ASTORIA_ZOOM : undefined}
            daytime={daytime}
            onPinTap={onPinTap}
            onLockedTap={onLockedTap}
            bigScreen={tvFeature ? { url: tvFeature.url, handle: tvFeature.handle, photo: tvFeature.photo } : null}
            // Tapping the tower checks first, so the photo that opens is the live one.
            onBigScreen={tv ? openBigScreen : undefined}
          />
          {trip && <TripView key={`${trip.toId}:${trip.mode}`} trip={trip} map={mapRef.current} onDone={endTrip} onSkip={cityApi?.skipTrip ? () => run("skip-trip", () => cityApi.skipTrip!()) : undefined}
            onShowtime={cityApi?.watchShowtime ? () => run("showtime", () => cityApi.watchShowtime!()) : undefined} />}
        </>
      )}

      <GameChrome
        me={{ head: <AvatarHead look={look} outfit={outfit} />, rank: myCard?.rank ?? null, onOpen: () => setPanel("profile") }}
        tips={statSuggestions}
        onTip={(id) => {
          if (id === "gigs") return setPhone({ open: true, app: "gigs" });
          if (id === "rest:nap" || id === "rest:sit") return setRestKind(id === "rest:nap" ? "nap" : "sit");
          if (id === "cook") return setKitchenOpen(true);
          // Something to do right where you are: step inside, where everything happens (#7).
          const p = placeById(id);
          if (p && atPlace === id && placeRoom(p)) { setPanel(null); setPlace(null); setTab("map"); return setInside(p); }
          openPlace(id);
        }}
        headline={latestNews ? { text: latestNews.headline, onOpen: () => openCityNews(latestNews.id) } : null}
        onLocate={tab === "map" && !trip ? () => mapRef.current?.locatePlayer() : undefined}
        atPlace={atPlaceInfo && !trip && tab === "map" && !inside ? { name: atPlaceInfo.name, onOpen: () => setPlace(atPlaceInfo) } : null}
        quests={trip ? [] : quests}
        time={clock.time}
        tab={tab}
        onAction={onAction}
        invitePin={handedOff && !pinsSeen.invite}
        netWorthPin={handedOff && !pinsSeen.networth}
        onToggleSound={toggleSound}
        values={{
          clout: me.clout,
          bank: me.bank_cash,
          dailyDone: city ? tasksDone(city) : 0,
          streak: goalsNow?.streak.current ?? 0,
          dailyTotal: city?.tasks.length || 5,
          stats: { energy: me.energy, mood: me.mood, confidence: me.confidence },
          muted,
          online,
          eventsBadge: !partyDone,
          billsBadge: !!city && dueBills(city).length > 0,
          tasksBadge: !!city && city.tasks.length > 0 && tasksSeenDay !== "" && tasksSeenDay !== city.today && handedOff,
          phoneBadge: payoutReady || chatUnread > 0 || datingAlerts(inbox) > 0 || crewAlerts(crewInbox) > 0 || (storyOn && (mainArc(feed)?.beats.some((b) => !b.seen) ?? false)),
        }}
      />
      <ActionTimer doing={doing} />
      {radio && radioBanner && !phone.open && (
        <RadioBanner s={radioBanner} api={radio} onToast={setToast} onDone={closeRadioBanner}
          onOpen={() => { closeRadioBanner(); setPhone({ open: true, app: "radio" }); }} />
      )}
      {tvView && (
        <TvViewer
          f={tvView}
          live={tvNow && tvView.id === tvNow.featured?.id ? { nextAt: tvNow.nextAt } : null}
          onClose={() => setTvView(null)}
          // From the map (not the Phone): the tower's own card, to go there or watch with the crew.
          onVisit={!phone.open && cityOn ? () => { setTvView(null); const t = placeById("clout-tower"); if (t) setPlace(t); } : undefined}
        />
      )}
      <GainToast gain={gain} message={toast} onDone={clearGain} />
      {city?.devTools && cityApi && (
        <DevClock
          offsetSeconds={city.clockOffsetSeconds}
          busy={busy !== null}
          onSet={(h) => void run("dev", () => cityApi.setClockOffset(h))}
          story={storyApi?.devStart && storyApi.devEntitle ? (() => {
            const arc = feed?.arcs.find((a) => a.id === "sarah-bird");
            const sku = feed?.arcs.find((a) => a.type === "side")?.sku ?? "side_sarah_bird_plus_one";
            return {
              day: arc ? arc.day : null,
              lastDay: arc?.lastDay ?? 10,
              sideArcs: !!feed?.arcs.some((a) => a.type === "side" && a.entitled),
              onStart: (d: number | null) => void runStory("dev", () => storyApi.devStart!(d)),
              onSideArcs: (on: boolean) => void (async () => {
                for (const a of feed?.arcs.filter((x) => x.type === "side" && x.sku) ?? [{ sku } as FeedArc]) await storyApi.devEntitle!(a.sku!, on);
                await runStory("dev", () => storyApi.refresh(offset));
              })(),
            };
          })() : undefined}
        />
      )}

      {/* ---- Guided first session ---- */}
      {pushAsk && push && flow === "none" && panel === null && !place && dailyHint !== "due" && (
        <PushPrompt api={push} onToast={setToast} onDone={() => setPushAsk(false)} />
      )}
      {dailyHint === "due" && flow === "none" && panel === null && !place && (
        <DailyTasksHint onOpen={() => onAction("daily")} onDismiss={endDailyHint} />
      )}
      {flow === "tour" && (
        <TourTooltip
          index={tourStep}
          onNext={() => setTourStep((s) => Math.min(s + 1, TOUR.length - 1))}
          onSkip={() => {
            void actions.setTutorialState("skipped");
            setMe((p) => ({ ...p, tutorial_state: "skipped" }));
            setFlow("none"); // the first task waits in Tasks
          }}
        />
      )}
      <PartySheet open={flow === "party"} onClose={() => setFlow("none")} onAttend={attend} busy={partyBusy} error={partyError} />
      {flow === "partyDone" && <PartyDoneCard onContinue={() => setFlow("leaderboard")} />}
      <LeaderboardSheet
        open={flow === "leaderboard" || panel === "leaderboard"}
        onClose={() => (flow === "leaderboard" ? setFlow("invitePrompt") : setPanel(null))}
        cta={flow === "leaderboard" ? { label: "Climb the ladder", onClick: () => setFlow("invitePrompt") } : undefined}
        myClout={me.clout}
        onOpenPlayer={chat ? (id) => setCardId(id) : undefined}
        fetchRows={leaderboardRows}
      />
      {chat && (
        <PlayerCardSheet
          playerId={cardId}
          api={chat}
          onClose={() => setCardId(null)}
          dating={dating ? { api: dating, onCrushChange: () => void loadInbox() } : undefined}
          onToast={setToast}
          placeName={(id) => placeById(id)?.name}
          hour={Math.floor(cityMinutes(gameNow, GAME_CONFIG.cityClock) / 60)}
          onOutOfMessages={() => setChatPass({ out: true })}
          onMessage={(p) => {
            setCardId(null);
            setPanel(null);
            setChatWith(p);
            setPhone({ open: true, app: "messages" });
          }}
        />
      )}
      {flow === "invitePrompt" && (
        <InvitePrompt
          cliqueCount={clique.length}
          invitedDuringParty={invitedDuringParty}
          onRecruit={() => { pendingPwa.current = true; setFlow("none"); setPanel("invite"); }}
          onLater={afterInvitePrompt}
        />
      )}
      {flow === "pwa" && <PwaPrompt onDone={endHandoff} />}

      {/* ---- Panels ---- */}
      <BoroughSheet id={lockedBorough} onClose={() => setLockedBorough(null)} gate={gates?.find((g) => g.id === lockedBorough) ?? null} />
      <TasksSheet
        open={panel === "tasks"}
        onClose={() => { setPanel(null); setTasksTab(undefined); }}
        tab={tasksTab}
        partyDone={partyDone}
        onOpenParty={openParty}
        cliqueCount={clique.length}
        city={cityOn ? city : null}
        goals={goalsNow}
        onOpenPlace={openPlace}
        skills={skills}
        onCook={() => { setPanel(null); setKitchenOpen(true); }}
        story={storyOn ? feed : null}
        onStoryTask={onStoryTask}
        hunt={hunt && huntState ? {
          state: huntState, style: me.starting_style, busy: busy === "hunt",
          onJoin: () => {
            setBusy("hunt");
            void hunt.join().then((r) => {
              setBusy(null);
              if (r.ok) setHuntState(r.state); else setToast(r.error);
            });
          },
        } : undefined}
      />
      <EventsSheet
        open={panel === "events"}
        onClose={() => setPanel(null)}
        partyDone={partyDone}
        onOpenParty={openParty}
        city={cityOn ? city : null}
        busy={busy}
        onAttend={(id) => handlers.onAttendEvent(id)}
        exclusive={catalog ? { products, nowMs: gameNow, h: money } : undefined}
        onGoThere={handlers.travel ? (id) => { const p = placeById(id); if (p) { setPanel(null); handlers.travel!.onGoThere(p); } } : undefined}
        calendar={cityApi?.calendarAttend && city?.calendar ? {
          data: calendarData,
          busy,
          onAttend: (id) => void run(`calendar:${id}`, () => cityApi.calendarAttend!(id)),
          onGoThere: handlers.travel ? (id) => { const p = placeById(id); if (p) { setPanel(null); handlers.travel!.onGoThere(p); } } : undefined,
        } : undefined}
      />
      {city && cityApi && (
        <>
          <LocationSheet
            place={place}
            state={city}
            daytime={daytime}
            handlers={handlers}
            from={home}
            onClose={() => setPlace(null)}
            onGoInside={(p) => { setPlace(null); setInside(p); }}
          />
          <RestSheet
            kind={restKind}
            state={city}
            busy={busy !== null}
            onClose={() => setRestKind(null)}
            onRest={(k) => run(`rest:${k}`, () => cityApi!.rest!(k))}
            onGoHome={() => { setRestKind(null); setTravelPlan({ from: myPos, to: home, fromName: myPosName, toName: "home", toId: "home" }); }}
          />
          <KitchenSheet
            open={kitchenOpen}
            state={city}
            busy={busy !== null}
            store={grocer ? { name: grocer.name, miles: formatMiles(milesBetween(myPos, grocer.at)) } : null}
            onClose={() => setKitchenOpen(false)}
            onCook={() => run("cook", () => cityApi!.cook!())}
            onGoHome={() => { setKitchenOpen(false); setTravelPlan({ from: myPos, to: home, fromName: myPosName, toName: "home", toId: "home" }); }}
            onGoShopping={() => { if (!grocer) return; setKitchenOpen(false); setTravelPlan({ from: myPos, to: grocer.at, fromName: myPosName, toName: grocer.name, toId: grocer.id }); }}
          />
          {campus && campusAt && (() => {
            const dormHome = ECONOMY.homes.find((h) => h.campus === campusAt);
            return (
              <CampusSheet
                open
                onClose={() => setCampusAt(null)}
                campusId={campusAt}
                tab={campusTab}
                api={campus}
                here={!travelOn || atPlace === campusAt}
                onDone={(msg) => {
                  setToast(msg);
                  void cityApi?.refresh().then((r) => r.ok && applyCity(r));
                }}
                dorm={dormHome && cityApi?.moveHome ? {
                  rent: dormHome.rent,
                  livesHere: city?.player.home_id === dormHome.id,
                  onMove: () => { setCampusAt(null); setViewHome(dormHome.id); },
                } : undefined}
              />
            );
          })()}
          <LottoSheet
            open={lottoAt !== null && lottoOn}
            state={city}
            placeId={lottoAt ?? ""}
            busy={busy !== null}
            onClose={() => setLottoAt(null)}
            onBuy={(pl, g, free) => lottoCall("lotto:buy", () => cityApi!.buyLottoCard!(pl, g, free))}
            onScratch={(id) => lottoCall("lotto:scratch", () => cityApi!.scratchLottoCard!(id))}
          />
          <TravelSheet
            plan={travelPlan}
            state={city}
            busy={busy !== null}
            onClose={() => setTravelPlan(null)}
            onGo={(m) => void goTravel(m)}
            transit={travelTransit ?? undefined}
            // v0.13: ride with someone here with you (both at the same place, split the fare).
            ride={together && atPlace && travelPlan?.toId !== "home" && rideHere.length > 0 && togetherIn?.canInvite
              ? { people: rideHere.slice().sort((a, b) => Number(b.crew) - Number(a.crew)).slice(0, 2).map((h) => ({ id: h.id, name: h.name, style: h.style, crew: h.crew, here: true })), onRide: (m, p) => void rideGo(m, p) }
              : undefined}
          />
          <PlacesSheet open={panel === "places"} onClose={() => setPanel(null)} from={home} state={city} story={storyOn ? feed : null} here={chat?.counts ? (id) => placeCounts[id] : undefined} onPick={(p) => openPlace(p.id)}
            openBoroughs={openSet} gates={gates} />
          <ShopSheet
            open={panel === "shop"}
            onClose={() => setPanel(null)}
            state={city}
            story={storyOn ? feed : null}
            busy={busy}
            initialCategory={shopCategory}
            onBuy={(sku, mode) => run(`buy:${sku}`, () => cityApi.buyItem(sku, mode))}
            onEquip={(id, on) => void run(`equip:${id}`, () => cityApi.equipItem(id, on))}
            onTryOn={setTryOn}
            section={shopSection}
            onTryAtHome={(item) => { setPanel(null); setTryHome(item); setTab("home"); }}
            fit={modelSex(look)}
            catalog={catalogOverride ?? city.catalog}
            realMoney={catalog ? { product: (sku) => products.find((p) => p.sku === sku), buy: money.buy, busy } : undefined}
          />
          <BigBuySheet p={bigBuy} onClose={() => setBigBuy(null)} busy={busy !== null} onConfirm={(sku) => { setBigBuy(null); void buy(sku, true); }} />
          <NetWorthSheet
            open={panel === "networth"}
            onClose={() => setPanel(null)}
            state={city}
            style={me.starting_style}
            busy={busy}
            onSell={(id) => run(`sell:${id}`, () => cityApi.sellItem(id))}
            onEquip={(id, on) => void run(`equip:${id}`, () => cityApi.equipItem(id, on))}
            onOpenCollection={catalog ? () => setPanel("collection") : undefined}
            serial={(sku) => products.find((p) => p.sku === sku)?.serial}
          />
          <CollectionSheet
            open={panel === "collection"}
            onClose={() => setPanel(null)}
            products={products}
            h={money}
            badge={!!feed?.badges.some((b) => b.id === "postcard-collector")}
            huntCards={huntState?.cards}
            teaCards={teaState ? teaState.cards : undefined}
            onOpenTea={(c) => setTeaCard({ card: c, fresh: false })}
            handle={me.display_name}
          />
          <LookRoom
            open={panel === "look" || !!tryOn}
            onClose={() => (tryOn ? setTryOn(null) : setPanel(null))}
            look={look}
            base={starterOutfit(style, look.body, look.fit)}
            state={city}
            busy={busy !== null}
            trying={tryOn}
            onSave={async (ids, covering) => {
              if (!cityApi.saveLook) return false;
              const ok = await run("look", () => cityApi.saveLook!(ids, covering));
              // Headwear lives on the player's look; saving also fills in the build (migration 0021).
              if (ok) setMe((m) => ({ ...m, look: { ...m.look, covering, build: look.build } }));
              return ok;
            }}
            onBuy={(sku) => run(`buy:${sku}`, async () => {
              // Buying from a try-on puts the piece on straight away.
              const r = await cityApi.buyItem(sku, "buy");
              const it = r.ok ? r.state.items.find((i) => i.sku === sku) : undefined;
              if (!r.ok || !it) return r;
              const e = await cityApi.equipItem(it.id, true);
              return e.ok ? { ...e, gain: r.gain } : e;
            })}
          />
          <BillsSheet open={panel === "bills"} onClose={() => setPanel(null)} state={city} busy={busy} onPay={(id) => void run(`bill:${id}`, () => cityApi.payBill(id))} />
        </>
      )}
      <TeaRevealSheet card={teaCard?.card ?? null} fresh={!!teaCard?.fresh} finished={teaState?.cards.length ?? 0} onClose={() => setTeaCard(null)} />
      {chatPass && (
        <ChatPassCard
          products={products.filter((p) => p.type === "chat_pass")}
          out={chatPass.out}
          busy={busy}
          onBuy={(sku) => void buy(sku)}
          onClose={() => setChatPass(null)}
        />
      )}
      {membership && (
        <MembershipSheet
          open={memberOpen}
          onClose={() => setMemberOpen(false)}
          api={membership}
          onGetVip={() => { setMemberOpen(false); setChatPass({ out: false }); }}
          onToast={setToast}
        />
      )}
      {together && (
        <>
          <TogetherSheet
            target={togetherTarget}
            people={togetherTarget ? togetherPeople.filter((p) => p.crew || (inside?.id === togetherTarget.place && p.here)) : []}
            inbox={togetherIn}
            busy={busy !== null}
            onClose={() => setTogetherTarget(null)}
            onInvite={(to) => {
              const t = togetherTarget;
              if (!t) return;
              void togetherRun("together", () => together.invite(to, t.place, t.action)).then((r) => {
                if (!r) return;
                const who = togetherPeople.find((p) => p.id === to);
                setTogetherTarget(null);
                setToast(`👯 Invited ${handle(who?.name)} to ${togetherVerb(t.place, t.action)} together.`);
                void loadTogether();
              });
            }}
          />
          <TogetherPlansSheet
            open={togetherPlansOpen}
            inbox={togetherIn}
            busy={busy !== null}
            onClose={() => setTogetherPlansOpen(false)}
            onAnswer={(id, yes) => void togetherRun(`plan:${id}`, () => together.respond(id, yes)).then((r) => {
              void loadTogether();
              if (!r) return;
              const p = togetherIn?.plans.find((x) => x.id === id);
              if (yes && p) { setTogetherPlansOpen(false); openPlace(p.place); setToast(`You're in. Do it within ${CITY_ECONOMY.together.windowMinutes} minutes of ${handle(p.withName)} for the bonus.`); }
            })}
            onRide={(ride, yes) => void answerRide(ride, yes)}
            onOpenPlace={(id) => { setTogetherPlansOpen(false); openPlace(id); }}
          />
          {bonusCard && (
            <TogetherBonusCard bonus={bonusCard} onClose={() => { const b = bonusCard; setBonusCard(null); void together.seen(b.id).then(() => loadTogether()); }} />
          )}
          {rideWait && (
            <RideWaitCard name={rideWait.name} mode={rideWait.mode} each={rideWait.each} onCancel={() => { const p = rideWait.plan; setRideWait(null); setTravelPlan(p); }} />
          )}
          {approving && approveLater !== approving.id && !bonusCard && (
            <DecorApproveCard
              job={approving}
              busy={busy !== null}
              onSettle={(keep, stars) => settleDecor(approving, keep, stars)}
              onLater={() => { setApproveLater(approving.id); setPhone({ open: false, app: null }); setPanel(null); setPlace(null); setInside(null); setTab("home"); setToast("Take a look around. Review it in Phone → Jobs."); }}
            />
          )}
        </>
      )}
      <PhoneModal
        invite={(() => {
          const e = city?.calendar && cityApi?.calendarAttend ? phoneInvite(calendarData.events, city.calendar.attended, gameNow) : null;
          return e ? { event: e, onOpen: () => { setPhone({ open: false, app: null }); setPanel("events"); } } : undefined;
        })()}
        push={push}
        membership={membership && member ? { vip: memberVip, onOpen: openMembership } : undefined}
        // The app shows whenever the station is on; if today's show can't load, the app says why.
        radio={radio}
        tv={tvApi && tvNow ? { api: tvApi, onChange: setTvNow } : undefined}
        stations={stations && stationThreads.length ? { threads: stationThreads, onRead: readStation } : undefined}
        radioDot={!!radioNow?.onAir && radioNow.onAir.date === radioNow.today && !!radioBanner}
        jobs={together && jobsHandlers ? { board: jobs, cash: city?.player.bank_cash ?? 0, hasBusiness: (biz?.owned.length ?? 0) > 0, h: jobsHandlers } : undefined}
        // The offer opens over the game, so the Phone steps aside first (it would cover the card).
        onChatPass={(out) => { setPhone({ open: false, app: null }); setChatWith(null); setChatPass({ out }); }}
        // Hidden until migration 0048 runs (business_state answers).
        businesses={business && city && biz ? {
          biz, cash: city.player.bank_cash, clout: me.clout, otherWorth, offsetMs: bizOffset,
          handlers: {
            busy,
            onBuy: (id) => void bizRun(`biz:${id}`, () => business.buy(id)).then((r) => { if (r) setToast(`${businessById(id)?.emoji} ${businessById(id)?.name} is yours. Open for business.`); }),
            onUpgrade: (id) => void bizRun(`biz:up:${id}`, () => business.upgrade(id)).then((r) => { if (r) setToast(`Upgraded: ${businessById(id)?.upgrades[r.level - 1]?.name}.`); }),
            onCollect: () => void bizRun("biz:collect", () => business.collect()).then((r) => { if (r && r.paid.length) setTillsPaid(r.paid); }),
            onGoPublic: () => void bizRun("biz:public", () => business.goPublic()).then((r) => { if (r) setWentPublic(true); }),
          },
        } : undefined}
        apartments={cityOn && cityApi?.moveHome && city?.player.moved_up !== undefined ? {
          busy: busy !== null,
          onLookInside: (id) => { setPhone({ open: false, app: null }); setPanel(null); setTab("home"); setViewHome(id); },
          onMove: (id) => void run(`move:${id}`, () => cityApi.moveHome!(id)).then((ok) => { if (ok) { setHomeFloor(1); setToast("Moved in. The broker fee is not refundable, emotionally or otherwise."); } }),
        } : undefined}
        open={phone.open}
        initialApp={phone.app}
        focusBeat={phone.beat}
        openForm={phone.form}
        cityNews={cityNews ? { items: newsItems, today: newsToday, focus: phone.item ?? null } : undefined}
        chat={chat}
        chatWith={chatWith}
        chatUnread={chatUnread}
        onChatUnread={setChatUnread}
        dating={dating ? {
          api: dating,
          alerts: datingAlerts(inbox),
          matched: inbox?.matches.map((m) => m.id) ?? [],
          onOpenDates: () => { setPhone({ open: false, app: null }); setChatWith(null); setPanel("dates"); },
          onCrushChange: () => void loadInbox(),
        } : undefined}
        crew={crew ? { alerts: crewAlerts(crewInbox), onOpen: () => { setPhone({ open: false, app: null }); setChatWith(null); setPanel("crew"); } } : undefined}
        handle={me.display_name}
        tea={gossipOn && teaState ? {
          state: teaState, busy: busy !== null,
          onShare: crew ? (sid, n) => void shareTea(sid, n) : undefined,
          // The card opens over the game, so the Phone steps aside first.
          onOpenCard: (c) => { setPhone({ open: false, app: null }); setTeaCard({ card: c, fresh: false }); },
        } : undefined}
        onOpenCollection={catalog ? () => { setPhone({ open: false, app: null }); setChatWith(null); setPanel("collection"); } : undefined}
        onToast={setToast}
        story={storyOn ? feed : null}
        news={storyOn ? news : undefined}
        onClose={() => { setPhone({ open: false, app: null }); setChatWith(null); }}
        time={clock.time}
        state={cityOn ? city : null}
        busy={busy}
        onAccept={(id) => cityApi && void run(`gig:${id}`, () => cityApi.acceptGig(id))}
        onCollect={(id) => cityApi && void run(`gig:${id}`, () => cityApi.collectGig(id))}
        perks={perkHandlers}
        muted={muted}
        onToggleSound={toggleSound}
        gossip={party && partyIn ? {
          optedOut: partyIn.newsOptOut,
          spotted: partyIn.newsOptOut ? [] : mentions,
          onToggle: () => void (async () => {
            const next = !partyIn.newsOptOut;
            setPartyIn({ ...partyIn, newsOptOut: next });
            const r = await party.setNewsOptOut(next);
            if (!r.ok) { setPartyIn({ ...partyIn }); setToast(r.error); return; }
            setToast(next ? "You're out of the gossip. Lola is devastated." : "Back in the gossip. Lola noticed.");
            await loadParty();
          })(),
        } : undefined}
      />
      <BankSheet open={panel === "bank"} onClose={() => setPanel(null)} bank={me.bank_cash} handle={me.display_name} />
      <InviteSheet
        open={panel === "invite"}
        place={invitePlace}
        onClose={() => {
          setInvitePlace(null);
          setPanel(null);
          if (pendingPwa.current) {
            pendingPwa.current = false;
            afterInvitePrompt();
          }
        }}
        inviteCode={me.invite_code}
        clique={clique}
      />
      {dating && (
        <>
          <DatingSheet
            open={panel === "dates"}
            onClose={() => setPanel(null)}
            inbox={inbox}
            me={me.starting_style}
            busy={datingBusy}
            onSeen={(id) => {
              setInbox((i) => (i ? { ...i, matches: i.matches.map((m) => (m.id === id ? { ...m, seen: true } : m)) } : i));
              void dating.matchSeen(id);
            }}
            onPlan={() => { setPanel("places"); setToast("Pick a restaurant or a club night, then tap “Make it a date”."); }}
            onSayHi={openChatWith}
            onAnswer={(id, yes) => void datingRun(() => dating.respond(id, yes), yes ? "You're in. Go whenever you're on tonight." : "No worries. Maybe another night.")}
            onCancel={(id) => void datingRun(() => dating.cancel(id), "Date called off.")}
            onCrushInvite={() => setPanel("crushInvite")}
          />
          <DateSheet
            spot={dateSpot}
            api={dating}
            onClose={() => setDateSpot(null)}
            onSent={(text) => { setDateSpot(null); setToast(text); void loadInbox(); }}
            onInviteFriend={() => { setInvitePlace(spotPlace(dateSpot)); setDateSpot(null); setPlace(null); setPanel("invite"); }}
            onCrushInvite={() => { setInvitePlace(spotPlace(dateSpot)); setDateSpot(null); setPlace(null); setPanel("crushInvite"); }}
          />
          <InviteSheet
            open={panel === "crushInvite"}
            onClose={() => { setInvitePlace(null); setPanel("dates"); }}
            inviteCode={me.invite_code}
            clique={clique}
            place={invitePlace}
            crush
            onShared={() => track?.("crush_invite_shared")}
          />
        </>
      )}
      {crew && (
        <>
          <CrewSheet
            place={crewPlace}
            api={crew}
            onClose={() => setCrewPlace(null)}
            onSent={(text) => { setCrewPlace(null); setToast(text); void loadCrew(); }}
            onInviteFriends={() => { setInvitePlace(crewPlace); setCrewPlace(null); setPlace(null); setPanel("invite"); }}
          />
          <CrewPlansSheet
            open={panel === "crew"}
            onClose={() => setPanel(null)}
            onInviteFriends={() => setPanel("invite")}
            onPickPlace={() => setPanel("places")}
            inbox={crewInbox}
            busy={crewBusy}
            onAnswer={(id, yes) => void (async () => {
              setCrewBusy(true);
              const r = await crew.respond(id, yes);
              setCrewBusy(false);
              setToast(!r.ok ? r.error : yes ? "You're in. Go whenever you're on tonight." : "No worries. Maybe next time.");
              await loadCrew();
            })()}
            onOpenPlace={(id) => openPlace(id)}
          />
          {crewFull && <CrewFullCard outing={crewFull} onClose={() => setCrewFull(null)} />}
        </>
      )}
      {party && (
        <>
          <PlusOneSheet
            event={plusOneFor}
            crew={crew}
            taken={(partyIn?.plusOnes ?? []).filter((x) => x.mine && x.eventId === plusOneFor?.id && x.status === "declined").map((x) => x.guest.id)}
            busy={busy === "plus1"}
            onClose={() => setPlusOneFor(null)}
            onSend={(guest) => void (async () => {
              if (!plusOneFor) return;
              setBusy("plus1");
              const r = await party.invite(plusOneFor.id, guest.id);
              setBusy(null);
              setToast(r.ok ? `Invite sent to ${handle(guest.name)}. They'll see it on their home screen.` : r.error);
              if (r.ok) setPlusOneFor(null);
              await loadParty();
            })()}
            onInviteFriends={() => { setPlusOneFor(null); setPanel("invite"); }}
          />
          <KeepsakeSheet
            event={keepsake}
            plusOneOf={keepsake?.plusOneOf}
            mention={mentions.find((m) => m.eventId === keepsake?.id) ?? null}
            optedOut={!!partyIn?.newsOptOut}
            onClose={() => setKeepsake(null)}
            onOpenCollection={catalog ? () => { setKeepsake(null); setPanel("collection"); } : undefined}
          />
        </>
      )}
      <ComingSoon which={soon?.key ?? null} title={soon?.title} onClose={() => setSoon(null)} />
      {tillsPaid && (
        <TillsCollectedCard paid={tillsPaid} clout={me.clout} worth={myWorth} onClose={() => setTillsPaid(null)}
          onUpgrade={() => { setTillsPaid(null); setPhone({ open: true, app: "businesses" }); }} />
      )}
      {wentPublic && <WentPublicCard worth={myWorth} onClose={() => setWentPublic(false)} />}
      {rankUp && <RankUpCard rank={rankUp} name={handle(me.display_name)} onClose={() => setRankUp(null)} />}
      {goalsReveal && !rankUp && (
        <GoalsRevealCard
          reveal={goalsReveal}
          onClose={() => setGoalsReveal(null)}
          onOpenGoals={() => { setGoalsReveal(null); setTasksTab("goals"); setPanel("tasks"); }}
        />
      )}
      <ProfileSheet
        open={panel === "profile"}
        onClose={() => setPanel(null)}
        look={look}
        outfit={outfit}
        name={handle(me.display_name)}
        subtitle={`${style.emoji} ${style.label} · ${city?.player.house_sku ? "Homeowner" : ECONOMY.homes.find((h) => h.id === me.home_id)?.name ?? "Queens"}`}
        looks={city?.style?.full}
        clout={me.clout}
        rank={myCard?.rank ?? null}
        netWorth={myWorth}
        bestRank={biz?.bestRank}
        badges={(feed?.badges ?? []).map((b) => {
          const info = badgeInfo(feed, b.id) ?? partyBadge(b.id, products) ?? (b.id === HUNT_BADGE ? { emoji: "🗺️", name: "Treasure hunter" } : b.id === LOTTO_BADGE ? { emoji: "🌟", name: "Jackpot winner" } : b.id === TEA_BADGE ? { emoji: "☕", name: "Spills the Tea" } : skillBadge(b.id) ?? lookBadge(b.id));
          return { id: b.id, emoji: info?.emoji ?? "🏅", name: info?.name ?? b.id };
        })}
        collections={{
          postcards: catalog ? { owned: products.filter((p) => p.type === "postcard" && p.owned).length, total: products.filter((p) => p.type === "postcard").length } : null,
          huntCards: huntState?.cards.length ?? 0,
        }}
        crew={clique.map((c) => c.display_name)}
        recent={myCard?.recent}
        skills={skills}
        perks={perkHandlers}
        onOpenCollection={catalog ? () => setPanel("collection") : undefined}
        onOpenNetWorth={city ? () => setPanel("networth") : undefined}
        onOpenLeaderboard={() => setPanel("leaderboard")}
        vip={membership && member ? { on: memberVip === "vip", until: member?.vip?.status === "cancelling" ? member.vip.periodEnd : null, onOpen: openMembership } : undefined}
      />
    </main>
  );
}

/** v0.3 pins: every built place plus the player's home. Story places appear once their story starts. */
const CITY_PINS = (home: readonly [number, number], feed: StoryFeed | null, open: Set<BoroughId>): PlacePin[] => [
  ...visiblePlaces(feed).map((p) => ({ ...p, borough: boroughOf(p), locked: !open.has(boroughOf(p)) })),
  { id: "home", name: "Home", emoji: "🏠", category: "home", neighborhood: "Your place", at: home, tags: ["home"] },
];

/** Mirrors StoryPrompt's own visibility rule, so the HUD can make room for it. */
function promptVisible(feed: StoryFeed | null, dismissed: string[]): boolean {
  const arc = mainArc(feed);
  const latest = arc?.beats.at(-1);
  if (!arc || !latest) return false;
  const vote = arc.predictions.find((p) => p.state === "open" && !p.myVote && new Date(p.closesAt).toDateString() === new Date().toDateString());
  const key = vote ? `vote:${vote.id}` : `beat:${latest.id}`;
  return !dismissed.includes(key) && (arc.beats.some((b) => !b.seen) || !!vote);
}

/** #19 Fif's Furniture: a Home item as a piece for the room view. */
function pieceOf(item: ShopItem, id: string): OwnedPiece {
  return { id, kind: item.furniture!.kind as OwnedPiece["kind"], color: item.furniture!.color, name: item.name, emoji: item.emoji };
}
