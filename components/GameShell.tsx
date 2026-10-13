"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PlayerUpdate } from "@/app/home/actions";
import { ECONOMY } from "@/lib/economy";
import { inviteUrl } from "@/lib/invite";
import { normalizeLook } from "@/lib/look";
import { music, readLocalMuted, writeLocalMuted } from "@/lib/music";
import type { CliqueMember, Player } from "@/lib/player";
import { ASTORIA_CENTER, ASTORIA_ZOOM, DEFAULT_PLAYER_LOCATION, WAVE_1_PINS, type PlacePin } from "@/lib/places";
import { getStyle, starterOutfit } from "@/lib/styles";
import { CLUB_EVENTS, PLACES, eventOpen, placeById, realMinutesUntilOpen, type Place, type ShopItem } from "@/lib/city";
import { cityMinutes } from "@/lib/cityClock";
import { GAME_CONFIG } from "@/lib/config";
import { HOME_TEMPLATES, PLACE_TEMPLATES, type RoomItem } from "@/lib/rooms";
import { activeGig, dueBills, equippedItems, gigAvailability, gigReady, netWorth, tasksDone, isSupermarket, type CityApi, type RestKind, type CityResult, type CityState, type Gain } from "@/lib/cityState";
import { outfitWith } from "@/lib/wardrobe";
import { badgeInfo, chatterLine, mainArc, type FeedArc, type StoryApi, type StoryFeed, type StoryResult } from "@/lib/storyFeed";
import GENERIC_CHATTER from "@/content/chatter-generic.json";
import CAST_LINES from "@/content/cast-lines.json";
import { regularAt, regularLine } from "@/lib/cast";
import { formatPrice, liveParty, readReturn, type ExclusiveEvent, type StoreApi, type StoreProduct } from "@/lib/store";
import { BillsSheet, NetWorthSheet, ShopSheet } from "./city/Commerce";
import { LookRoom } from "./city/LookRoom";
import { TravelSheet, TripView, type Trip, type TripPlan } from "./city/Travel";
import { KitchenSheet, RestSheet } from "./city/Rest";
import { LottoSheet } from "./city/Lotto";
import type { LottoCard } from "@/lib/lotto";
import { formatMiles, milesBetween, travelQuote, type TravelMode } from "@/lib/travel";
import { CollectionSheet, type MoneyHandlers } from "./city/Money";
import { PlayerCardSheet } from "./chat/PlayerCard";
import type { ChatApi } from "@/lib/chat";
import { datingAlerts, type DatePerson, type DatingApi, type DatingInbox } from "@/lib/dating";
import { DateSheet, DatingPrompt, DatingSheet } from "./dating/Dating";
import { crewAlerts, type CrewApi, type CrewInbox, type CrewOuting } from "@/lib/crew";
import { CrewFullCard, CrewPlansSheet, CrewPrompt, CrewSheet } from "./crew/Crew";
import { KeepsakeSheet, PartyPrompt, PlusOneSheet } from "./city/Party";
import { onList, partyBadge, type PartyApi, type PartyInbox, type PartyMention } from "@/lib/party";
import type { ShopCategory } from "@/lib/city";
import { GainToast, useGameNow } from "./city/Common";
import { DevClock } from "./city/DevClock";
import { PhoneModal, type App } from "./city/Phone";
import { InteriorScene, LocationSheet, PlacesSheet, homeLocation, visiblePlaces, type PlaceHandlers } from "./city/Places";
import { NewsPrompt, StoryPrompt } from "./story/StoryBits";
import { newsGossip, splitNews, type NewsItem } from "@/lib/news";
import { HUNT_BADGE, type HuntApi, type HuntState } from "@/lib/hunts";
import { ComingSoon, type ComingSoonKey } from "./ComingSoon";
import { InvitePrompt, LeaderboardSheet, PartyDoneCard, PartySheet, PwaPrompt, isStandalone } from "./game/FirstSession";
import { BankSheet, EventsSheet, TasksSheet } from "./game/Sheets";
import { TourTooltip, TOUR, WelcomeModal } from "./game/Tutorial";
import { GameChrome, type ChromeAction, type Tab } from "./hud/GameChrome";
import { handle } from "@/lib/validation";
import { LocateIcon } from "./icons";
import { ProfileSheet } from "./game/ProfileSheet";
import { statTips } from "@/lib/recent";
import type { PlayerCard } from "@/lib/chat";
import { InviteSheet } from "./InviteSheet";
import { CityMap, type MapApi } from "./map/CityMap";
import { BoroughSheet } from "./map/BoroughSheet";
import type { BoroughId } from "@/lib/map/boroughs";
import { Sheet } from "./Sheet";
import { useCityClock } from "./useCityClock";
import { usePlayersOnline } from "./usePresence";

const Room3D = dynamic(() => import("./room/Room3D"), { ssr: false });
const AvatarHead = dynamic(() => import("./avatar/AvatarHead"), { ssr: false });

export interface GameActions {
  setTutorialState: (state: "done" | "skipped") => Promise<void>;
  attendFirstParty: (withClique: boolean) => Promise<{ ok: true; player: PlayerUpdate } | { ok: false; error: string }>;
  finishHandoff: () => Promise<void>;
  setMusicMuted: (muted: boolean) => Promise<void>;
}

/** The first session after creation, in order (Clarifications section 1, steps 4 to 14). */
export type Flow = "none" | "welcome" | "tour" | "party" | "partyDone" | "leaderboard" | "invitePrompt" | "pwa";

type Panel = "tasks" | "events" | "bank" | "leaderboard" | "profile" | "invite" | "crushInvite" | "places" | "bills" | "look" | "shop" | "networth" | "collection" | "dates" | "crew" | null;

const PINS_KEY = "cc_first_pins_seen";
const STORY_DISMISSED_KEY = "cc_story_dismissed";

/** Who's talking in a place (chatter templates are written per role). */
function npcRole(p: Place): { who: string; role: string } {
  if (p.template === "club") return { who: "The bartender", role: "bartender" };
  if (p.template === "cafe") return { who: "The barista", role: "barista" };
  if (p.template === "counter") return { who: "The clerk", role: "clerk" };
  if (p.template === "campus") return { who: "A professor", role: "professor" };
  if (p.category === "home" || p.tags.includes("luxury")) return { who: "The doorman", role: "doorman" };
  return { who: "Your driver", role: "driver" };
}

function initialFlow(p: Player): Flow {
  if (p.onboarding_step === "party_done") return "leaderboard"; // resume the hand-off
  if (!p.first_party_at && p.tutorial_state === "pending") return "welcome";
  return "none";
}

// The signed-in home screen: the apartment and the map, the HUD with live
// clout and cash, and the guided first session (welcome, tour, first party,
// leaderboard, invite and install prompts).
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
  leaderboardRows,
  dating,
  crew,
  party,
  partyInbox: initialPartyInbox = null,
  cityNews,
  hunt,
  roomMood = "dream",
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
  /** v0.5 crushes and date nights (migration 0011). */
  dating?: DatingApi;
  /** Crew outings (migration 0013). */
  crew?: CrewApi;
  /** v0.9 party keepsakes (migration 0029): plus-ones, "Spotted at" and the gossip setting. */
  party?: PartyApi;
  partyInbox?: PartyInbox | null;
  /** v0.6 City News: published items (news_feed(), migration 0017). */
  cityNews?: () => Promise<NewsItem[]>;
  /** v0.6 treasure hunts (migration 0018); without it there's no Hunt tab. */
  hunt?: HuntApi;
  /** Development previews: sample leaderboard rows. */
  leaderboardRows?: Parameters<typeof LeaderboardSheet>[0]["fetchRows"];
  /** Rooms use the Monument Valley-style "dream" lighting; "natural" stays for comparison in previews. */
  roomMood?: "natural" | "dream";
  /** Development previews only: pin the map to day or night. */
  daytimeOverride?: boolean;
  /** Development previews only: open a step of the first session directly. */
  previewFlow?: Flow;
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
  const [place, setPlace] = useState<Place | null>(null);
  const [inside, setInside] = useState<Place | null>(null);
  const [phone, setPhone] = useState<{ open: boolean; app: App | null; beat?: string | null; item?: string | null }>({ open: false, app: null });
  // v0.6 City News: loaded once; the newest headline rides the ticker and, once per session, a home card.
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [newsCard, setNewsCard] = useState<string | null>(null);
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
  const [chatWith, setChatWith] = useState<{ id: string; name: string; style: string } | null>(null);
  const [chatUnread, setChatUnread] = useState(0);
  const [cardId, setCardId] = useState<string | null>(null);
  const [inbox, setInbox] = useState<DatingInbox | null>(null);
  const [dateSpot, setDateSpot] = useState<{ kind: "place" | "event"; target: string; price: number } | null>(null);
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
  const worn = city ? equippedItems(city) : [];
  const outfit = worn.length ? outfitWith(starterOutfit(style, look.body, look.fit), worn) : undefined;
  const home = homeLocation(me.home_id);
  // v0.8 travel (#4): where the player is. Null is home; without migration 0025 there's no travel.
  const travelOn = !!(city && cityApi?.travel && city.player.at_place !== undefined);
  // v0.8 rest and bar drinks (migration 0026): restToday is missing until it runs.
  const restOn = !!(city?.restToday && cityApi?.rest);
  // v0.8 groceries and the kitchen (migration 0027): fridge_meals is missing until it runs.
  const kitchenOn = !!(travelOn && city?.player.fridge_meals !== undefined && cityApi?.cook);
  const atPlace = travelOn ? city!.player.at_place ?? null : null;
  const atPlaceInfo = atPlace ? placeById(atPlace) : undefined;
  const myPos = atPlaceInfo?.at ?? home;
  const myPosName = atPlaceInfo?.name ?? "home";
  const [travelPlan, setTravelPlan] = useState<TripPlan | null>(null);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [restKind, setRestKind] = useState<RestKind | null>(null);
  const [kitchenOpen, setKitchenOpen] = useState(false);
  // v0.10 Lucky Star Lotto (migration 0032): lotto state is missing until it runs.
  const lottoOn = !!(travelOn && city?.lotto && cityApi?.buyLottoCard && cityApi.scratchLottoCard);
  const [lottoAt, setLottoAt] = useState<string | null>(null);
  // The nearest supermarket, for "Go shopping" from an empty fridge.
  const grocer = useMemo(() => PLACES.filter((p) => isSupermarket(p.tags)).sort((a, b) => milesBetween(myPos, a.at) - milesBetween(myPos, b.at))[0], [myPos]);
  const cityOn = !!(city && cityApi);
  const statSuggestions = useMemo(() => {
    if (!cityOn || !city) return undefined;
    const tips = statTips(visiblePlaces(feed), me.bank_cash);
    // With the Confidence and clout a pro gig or big break needs, that's the better use of Confidence.
    const gig = city.gigs.filter((g) => g.tier !== "side" && !g.accepted_at && gigAvailability(g, city).ok).sort((a, b) => b.pay - a.pay)[0];
    if (gig) tips.confidence = { stat: "confidence", placeId: "gigs", placeName: gig.tier === "big" ? "A big break is open" : "A pro gig is open", emoji: "💼", price: 0, gain: 0, gig: { id: gig.id, pay: gig.pay } };
    return tips;
  }, [cityOn, city, feed, me.bank_cash]);
  const cityPins = useMemo(() => CITY_PINS(home, feed), [home, feed]);
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
      } catch {
        setToast("The city glitched. Try again.");
        return false;
      } finally {
        setBusy(null);
      }
    },
    [applyCity],
  );
  // The lotto's answers carry the card (its id, then its prize); the card itself shows the result.
  const lottoCall = useCallback(async (key: string, call: () => Promise<CityResult>): Promise<LottoCard | null> => {
    setBusy(key);
    try {
      const r = await call();
      if (!r.ok) { setToast(r.error); return null; }
      applyCity({ ...r, gain: undefined });
      return r.card ?? null;
    } catch {
      setToast("The city glitched. Try again.");
      return null;
    } finally {
      setBusy(null);
    }
  }, [applyCity]);
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
        setToast(p.type === "exclusive_event" ? `🎟️ You're on the list: ${p.name}` : `🔓 Unlocked: ${p.name}`);
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
  const buy = async (sku: string) => {
    if (!storeApi) return setToast("Purchases aren't switched on yet. Nothing was charged.");
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
  const openShop = (category: ShopCategory) => {
    setPlace(null);
    setInside(null);
    setShopCategory(category);
    setPanel("shop");
  };
  const handlers: PlaceHandlers = {
    busy,
    travel: travelOn ? {
      isHere: (id) => atPlace === id,
      onGoThere: (p) => { setPlace(null); setInside(null); setTravelPlan({ from: myPos, to: p.at, fromName: myPosName, toName: p.name, toId: p.id }); },
      from: { at: myPos, name: myPosName },
    } : undefined,
    money: catalog ? { products, nowMs: gameNow, h: money } : undefined,
    onOpenShop: openShop,
    crew: crew && crewInbox ? { outings: crewInbox.outings.filter((o) => o.myStatus !== "declined"), onBring: (p) => setCrewPlace(p) } : undefined,
    dating: dating && inbox ? { me: me.starting_style, dates: inbox.dates.filter((d) => d.status !== "declined"), bonus: inbox.bonus, onMakeDate: setDateSpot } : undefined,
    onAction: (pl, a) => cityApi && void cityThenStory(`${pl}:${a}`, () => cityApi.doAction(pl, a)),
    onAttendEvent: (id) => cityApi && void cityThenStory(`event:${id}`, () => cityApi.attendEvent(id)),
    onOpenGigs: () => { setPlace(null); setPhone({ open: true, app: "gigs" }); },
    onBuyGroceries: kitchenOn && cityApi?.buyGroceries ? (pl, b) => void run(`groceries:${b}`, () => cityApi.buyGroceries!(pl, b)) : undefined,
    onOpenLotto: lottoOn ? (id) => setLottoAt(id) : undefined,
    onBarDrink: restOn && travelOn && cityApi?.barDrink ? (id) => void run(`drink:${id}`, () => cityApi.barDrink!(id)) : undefined,
    story: storyOn ? feed : null,
    onAttendStoryEvent: storyApi
      ? (id) => void runStory(`story:${id}`, () => storyApi.attendEvent(id)).then((ok) => ok && cityApi && cityApi.refresh().then((r) => r.ok && applyCity(r)))
      : undefined,
    regular: (p, n) => {
      const r = regularAt(p.id);
      if (!r) return null;
      const story = feed?.chatter?.find((t) => t.lines)?.lines ?? null;
      // Studio lines first, then this week's city news as gossip.
      const live = { [r.id]: [...(city?.npcLines?.[r.id] ?? []), ...newsGossip(newsItems, newsToday, 1), ...(huntOn ? huntState!.hunt!.chatter : [])] };
      return { regular: r, line: regularLine(r, n + Math.floor(gameNow / 600_000), { story, live, evergreen: CAST_LINES }) };
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
    setPanel(null);
    setTab("map");
    setInside(null);
    setPlace(p);
    mapRef.current?.moveCamera(p.at, 15.5);
  };
  /** A tap on something in a place's room: run its action, or the event that's on. */
  const useInPlace = (p: Place, it: RoomItem) => {
    if (it.use?.kind === "lotto") return lottoOn ? setLottoAt(p.id) : setToast("Benny's still setting up the counter. Come back soon.");
    if (it.use?.kind === "action") return handlers.onAction(p.id, it.use.actionId);
    if (it.use?.kind === "shop") return openShop(it.use.category);
    if (it.use?.kind !== "events") return;
    // The lounge's guest list: a party you have a ticket for, if its doors are open; otherwise the Events list.
    const party = products.find((x) => x.event?.placeId === p.id && onList(x) && !x.event.attended
      && gameNow >= Date.parse(x.event.startsAt) && gameNow < Date.parse(x.event.endsAt));
    if (party) return money.attend(party.event!.id);
    if (products.some((x) => x.event?.placeId === p.id && liveParty(x, gameNow))) return setPanel("events");
    const minutes = cityMinutes(gameNow, GAME_CONFIG.cityClock);
    const events = CLUB_EVENTS.filter((e) => e.placeId === p.id);
    const live = events.find((e) => eventOpen(e, minutes) && !city?.attendedToday.includes(e.id));
    if (live) return handlers.onAttendEvent(live.id);
    const next = events.filter((e) => !eventOpen(e, minutes)).sort((a, b) => realMinutesUntilOpen(a, minutes) - realMinutesUntilOpen(b, minutes))[0];
    if (p.category === "campus") return setToast(next ? `Nothing on yet. ${next.name} starts in ${realMinutesUntilOpen(next, minutes)} min.` : "You already went today. The board says \"See you next semester.\"");
    setToast(next ? `Dancing solo. ${next.name} opens in ${realMinutesUntilOpen(next, minutes)} min.` : "You already went tonight. Dancing anyway.");
  };
  const clearGain = useCallback(() => { setGain(null); setToast(null); }, []);
  const gig = city ? activeGig(city) : undefined;
  const payoutReady = !!gig && gigReady(gig, gameNow);
  const partyDone = me.first_party_at !== null;
  const handedOff = me.onboarding_step === "handoff_done";

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
  const markPin = (k: "invite" | "networth") => {
    setPinsSeen((p) => {
      const next = { ...p, [k]: true };
      try { localStorage.setItem(PINS_KEY, JSON.stringify(next)); } catch { /* fine */ }
      return next;
    });
  };

  // Music starts on the first tap anywhere, remembering the player's choice.
  useEffect(() => {
    const m = player.music_muted || readLocalMuted();
    setMuted(m);
    music().setMuted(m);
    const start = () => music().start();
    window.addEventListener("pointerdown", start, { once: true });
    return () => window.removeEventListener("pointerdown", start);
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
      if (a === "tasks" || a === "daily") return setPanel("tasks");
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
    [flow, cityOn],
  );

  const onPinTap = useCallback(
    (pin: PlacePin) => {
      if (pin.id === "home") {
        if (travelOn && atPlace) return setTravelPlan({ from: myPos, to: home, fromName: myPosName, toName: "home", toId: "home" });
        return setTab("home");
      }
      const p = cityOn ? placeById(pin.id) : undefined;
      if (p) return setPlace(p);
      setSoon({ key: "place", title: pin.name });
    },
    [cityOn, travelOn, atPlace, myPos, myPosName, home],
  );
  /** Go: pay on the server first (arrival is instant there), then show the short trip. */
  const goTravel = async (mode: TravelMode) => {
    const plan = travelPlan;
    if (!plan || !cityApi?.travel) return;
    const ok = await run("travel", () => cityApi.travel!(plan.toId, mode));
    if (!ok) return;
    const q = travelQuote(mode, milesBetween(plan.from, plan.to), !!city?.player.car_sku);
    setTravelPlan(null);
    setPlace(null);
    setTab("map");
    setTrip({ ...plan, mode, seconds: q.seconds, fare: q.fare });
  };
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
  const showPrompt = showDating || showCrew || showParty || (storyOn && flow === "none" && !arranging && tab === "home" && !inside && promptVisible(feed, dismissed));
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
    <main className={`game${trip ? " travelling" : ""}${inside && city ? " inside" : ""}${arranging && tab === "home" ? " arranging" : ""}${showPrompt ? " has-story-prompt" : ""}`}>
      {inside && city ? (
        <InteriorScene
          place={inside}
          state={city}
          handlers={handlers}
          onBack={() => setInside(null)}
          room={
            <Room3D
              template={PLACE_TEMPLATES[inside.template && inside.template !== "apartment" ? inside.template : "cafe"]}
              look={look}
              outfit={outfit}
              daytime={daytime}
              sign={inside.name}
              label={`${me.display_name} inside ${inside.name}`}
              insetBottom={170}
              mood={roomMood}
              onUse={(it) => useInPlace(inside, it)}
              onNpcTap={() => {
                const { who, role } = npcRole(inside);
                setToast(`${who}: “${chatterLine(feed, role, GENERIC_CHATTER, Date.now())}”`);
              }}
            />
          }
        />
      ) : tab === "home" ? (
        <div className="layer">
          <Room3D
            template={HOME_TEMPLATES[me.home_id ?? ""] ?? HOME_TEMPLATES.astoria_studio}
            layout={city?.homeLayout}
            look={look}
            outfit={outfit}
            daytime={daytime}
            editable={cityOn && flow === "none"}
            label={`${me.display_name} at home, wearing ${style.label}`}
            insetBottom={170}
            onUse={(it) => {
              if (it.use?.kind === "look") setPanel(cityOn ? "look" : "profile");
              if (restOn && it.use?.kind === "sleep") setRestKind("nap");
              if (restOn && it.use?.kind === "sit") setRestKind("sit");
              if (kitchenOn && it.use?.kind === "cook") setKitchenOpen(true);
            }}
            onEditingChange={setArranging}
            mood={roomMood}
            onSaveLayout={(l) => (cityApi ? run("layout", () => cityApi.saveHomeLayout(l)) : Promise.resolve(true))}
          />
          {showDating && inbox && (
            <DatingPrompt inbox={inbox} onOpen={() => setPanel("dates")} onDismiss={() => setDatingDismissed(datingKey)} />
          )}
          {showCrew && crewInbox && (
            <CrewPrompt inbox={crewInbox} onOpen={() => setPanel("crew")} onDismiss={() => setCrewDismissed(crewKey)} />
          )}
          {showParty && partyInvite && (
            <PartyPrompt invite={partyInvite} onOpen={() => setPanel("events")} onDismiss={() => setPartyDismissed(partyKey)} />
          )}
          {storyOn && flow === "none" && !arranging && !showDating && !showCrew && !showParty && (
            <StoryPrompt feed={feed} dismissed={dismissed} onOpen={(beat) => openNews(beat)} onDismiss={dismissStory} />
          )}
          {newsCard && latestNews?.id === newsCard && flow === "none" && !arranging && !showDating && !showCrew && !showParty && !(storyOn && promptVisible(feed, dismissed)) && (
            <NewsPrompt item={latestNews} onOpen={() => openCityNews(latestNews.id)} onDismiss={() => setNewsCard(null)} />
          )}
        </div>
      ) : (
        <>
          <CityMap
            ref={mapRef}
            pins={cityOn ? cityPins : WAVE_1_PINS}
            vehicles={cityOn}
            player={{ at: cityOn ? myPos : DEFAULT_PLAYER_LOCATION, emoji: style.emoji }}
            initialCenter={cityOn ? ASTORIA_CENTER : DEFAULT_PLAYER_LOCATION}
            initialZoom={cityOn ? ASTORIA_ZOOM : undefined}
            daytime={daytime}
            onPinTap={onPinTap}
            onLockedTap={onLockedTap}
          />
          <button className="icon-round map-locate glass-hud" onClick={() => mapRef.current?.locatePlayer()} aria-label="Go to my location">
            <LocateIcon size={20} />
          </button>
          {atPlaceInfo && !trip && (
            <button className="glass-hud at-chip" onClick={() => setPlace(atPlaceInfo)}>
              📍 At {atPlaceInfo.name}
            </button>
          )}
          {trip && <TripView key={`${trip.toId}:${trip.mode}`} trip={trip} map={mapRef.current} onDone={endTrip} />}
        </>
      )}

      <GameChrome
        me={{ head: <AvatarHead look={look} outfit={outfit} />, rank: myCard?.rank ?? null, onOpen: () => setPanel("profile") }}
        tips={statSuggestions}
        onTip={(id) => (id === "gigs" ? setPhone({ open: true, app: "gigs" }) : openPlace(id))}
        headline={latestNews ? { text: latestNews.headline, onOpen: () => openCityNews(latestNews.id) } : null}
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
          dailyTotal: city?.tasks.length || 5,
          stats: { energy: me.energy, mood: me.mood, confidence: me.confidence },
          muted,
          online,
          eventsBadge: !partyDone,
          billsBadge: !!city && dueBills(city).length > 0,
          phoneBadge: payoutReady || chatUnread > 0 || datingAlerts(inbox) > 0 || crewAlerts(crewInbox) > 0 || (storyOn && (mainArc(feed)?.beats.some((b) => !b.seen) ?? false)),
        }}
      />
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
      {flow === "welcome" && (
        <WelcomeModal
          onStart={() => { setTourStep(0); setFlow("tour"); }}
          onSkip={() => {
            void actions.setTutorialState("skipped");
            setMe((p) => ({ ...p, tutorial_state: "skipped" }));
            setFlow("none"); // the first task waits in Tasks
          }}
        />
      )}
      {flow === "tour" && <TourTooltip index={tourStep} onNext={() => setTourStep((s) => Math.min(s + 1, TOUR.length - 1))} />}
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
      <BoroughSheet id={lockedBorough} onClose={() => setLockedBorough(null)} />
      <TasksSheet
        open={panel === "tasks"}
        onClose={() => setPanel(null)}
        partyDone={partyDone}
        onOpenParty={openParty}
        cliqueCount={clique.length}
        city={cityOn ? city : null}
        onOpenPlace={openPlace}
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
          <LottoSheet
            open={lottoAt !== null && lottoOn}
            state={city}
            placeId={lottoAt ?? ""}
            busy={busy !== null}
            onClose={() => setLottoAt(null)}
            onBuy={(pl, g, free) => lottoCall("lotto:buy", () => cityApi!.buyLottoCard!(pl, g, free))}
            onScratch={(id) => lottoCall("lotto:scratch", () => cityApi!.scratchLottoCard!(id))}
          />
          <TravelSheet plan={travelPlan} state={city} busy={busy !== null} onClose={() => setTravelPlan(null)} onGo={(m) => void goTravel(m)} />
          <PlacesSheet open={panel === "places"} onClose={() => setPanel(null)} from={home} state={city} story={storyOn ? feed : null} onPick={(p) => openPlace(p.id)} />
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
            realMoney={catalog ? { product: (sku) => products.find((p) => p.sku === sku), buy: money.buy, busy } : undefined}
          />
          <NetWorthSheet
            open={panel === "networth"}
            onClose={() => setPanel(null)}
            state={city}
            style={me.starting_style}
            busy={busy}
            onSell={(id) => run(`sell:${id}`, () => cityApi.sellItem(id))}
            onEquip={(id, on) => void run(`equip:${id}`, () => cityApi.equipItem(id, on))}
            onOpenCollection={catalog ? () => setPanel("collection") : undefined}
          />
          <CollectionSheet
            open={panel === "collection"}
            onClose={() => setPanel(null)}
            products={products}
            h={money}
            badge={!!feed?.badges.some((b) => b.id === "postcard-collector")}
            huntCards={huntState?.cards}
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
      <PhoneModal
        open={phone.open}
        initialApp={phone.app}
        focusBeat={phone.beat}
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
        onClose={() => {
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
            onInviteFriend={() => { setDateSpot(null); setPlace(null); setPanel("invite"); }}
            onCrushInvite={() => { setDateSpot(null); setPlace(null); setPanel("crushInvite"); }}
          />
          <InviteSheet
            open={panel === "crushInvite"}
            onClose={() => setPanel("dates")}
            inviteCode={me.invite_code}
            clique={clique}
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
            onInviteFriends={() => { setCrewPlace(null); setPlace(null); setPanel("invite"); }}
          />
          <CrewPlansSheet
            open={panel === "crew"}
            onClose={() => setPanel(null)}
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
      <ProfileSheet
        open={panel === "profile"}
        onClose={() => setPanel(null)}
        look={look}
        outfit={outfit}
        name={handle(me.display_name)}
        subtitle={`${style.emoji} ${style.label} · ${city?.player.house_sku ? "Homeowner" : ECONOMY.homes.find((h) => h.id === me.home_id)?.name ?? "Queens"}`}
        clout={me.clout}
        rank={myCard?.rank ?? null}
        netWorth={city ? netWorth(city) : me.bank_cash}
        badges={(feed?.badges ?? []).map((b) => {
          const info = badgeInfo(feed, b.id) ?? partyBadge(b.id, products) ?? (b.id === HUNT_BADGE ? { emoji: "🗺️", name: "Treasure hunter" } : null);
          return { id: b.id, emoji: info?.emoji ?? "🏅", name: info?.name ?? b.id };
        })}
        collections={{
          postcards: catalog ? { owned: products.filter((p) => p.type === "postcard" && p.owned).length, total: products.filter((p) => p.type === "postcard").length } : null,
          huntCards: huntState?.cards.length ?? 0,
        }}
        crew={clique.map((c) => c.display_name)}
        recent={myCard?.recent}
        onOpenCollection={catalog ? () => setPanel("collection") : undefined}
        onOpenNetWorth={city ? () => setPanel("networth") : undefined}
        onOpenLeaderboard={() => setPanel("leaderboard")}
      />
    </main>
  );
}

/** v0.3 pins: every built place plus the player's home. Story places appear once their story starts. */
const CITY_PINS = (home: readonly [number, number], feed: StoryFeed | null): PlacePin[] => [
  ...visiblePlaces(feed),
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
