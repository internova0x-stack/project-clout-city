// An in-memory stand-in for the v0.3 server functions, used only by the
// development previews (/preview/home) so every city screen can be tried without
// a database. It follows the same rules as supabase/migrations/0004 in simplified
// form; the SQL is the source of truth.

import { CROWN_SKU, SUIT_CLOTHS, SUIT_LININGS, cleanMonogram, hasOptions } from "./couture.ts";
import { CITY_ECONOMY, CLUB_EVENTS, GIG_TITLES, HOME_LOCATIONS, PLACES, collectorValue, eventOpen, itemBySku, placeOpen, purchaseClout, sellPrice, visitClout, type ShopItem } from "./city.ts";
import { ECONOMY, moveCost } from "./economy.ts";
import type { ExclusiveEvent } from "./store.ts";
import { cityMinutes } from "./cityClock.ts";
import { lineFor, milesBetween, skipCost, travelQuote } from "./travel.ts";
import { calendarLive, calendarReward, dressedUp, type CalendarData } from "./calendar.ts";
import { DOOR_CLOUT, HOME_NEEDS_CLOUT, REWARD_KEEP, REWARD_ONLY, VIP_ALREADY, VIP_LOCKED, clubDoor, OUTFIT_NEEDS_CLOUT, SHIFT_LIMIT, activeGig, cityError, gigCloutReq, hasBar, isSupermarket, type CityApi, type CityResult, type CityState, type DailyTask, type Gain, type GigOffer } from "./cityState.ts";
import { cardCells, isLottoPlace, lottoGame, prizeFor, type LottoCell } from "./lotto.ts";
import { LEVEL_AT, PERK_ERRORS, SKILL_PERKS, perkOn, type PerksState, type SkillId, type SkillState } from "./skills.ts";
import { placeStory, storyItemOpen, type StoryFeed } from "./storyFeed.ts";
import type { StoryEvent } from "./stories.ts";
import { STYLE, fullLooks, styleCounts, venueLine } from "./style.ts";
import { slotsClash, wearSlot } from "./wearing.ts";

const CLOCK = { realHoursPerCityDay: 2, dayStartsAt: 6, nightStartsAt: 19 };

/** Sample skills for the preview (the profile's Skills tab and skill perks); `?skills=pro` uses the high set. */
export function sampleSkills(pro = false): SkillState[] {
  const lv = (id: SkillId, level: number, best = level, rusty = false): SkillState => ({ id, level, best, practice: LEVEL_AT[level] + (level < 10 ? 1 : 0), rusty });
  return pro
    ? [lv("cooking", 9), lv("charisma", 9), lv("fitness", 6), lv("smarts", 9), lv("music", 7), lv("hustle", 6), lv("dance", 9), lv("gossip", 3), lv("photography", 6, 8, true)]
    : [lv("cooking", 3), lv("charisma", 3), lv("fitness", 2), lv("smarts", 0), lv("music", 0), lv("hustle", 5, 6, true), lv("dance", 4), lv("gossip", 1), lv("photography", 0)];
}
const levelsOf = (skills: SkillState[]) => Object.fromEntries(skills.map((x) => [x.id, x.level])) as PerksState["levels"];

/** A Shop catalog piece the code doesn't know (the batch files), as a ShopItem the preview can sell: only once it can
 *  be worn and is live; wearable accessories are filed as fashion, as migration 0101 does. */
function catalogShopItem(s: Pick<CityState, "catalog">, sku: string): ShopItem | undefined {
  const c = s.catalog?.find((x) => x.sku === sku);
  if (!c || !c.wearable || c.status !== "live" || c.realCash) return undefined;
  const wearable = !!wearSlot(sku);
  return {
    sku, name: c.name, emoji: c.emoji, price: c.price, clout: c.clout, rating: Math.min(4, Math.max(1, c.stars)) as ShopItem["rating"], blurb: c.description,
    category: (wearable && c.tab === "accessories" ? "fashion" : c.tab) as ShopItem["category"],
  };
}

/** The preview's style counts, for the preview player's starting style. */
function simStyleCounts(s: Pick<CityState, "items" | "catalog">, startingStyle: string) {
  return styleCounts(s.items.filter((i) => i.category === "fashion" && i.equipped).map((i) => {
    const c = s.catalog?.find((x) => x.sku === i.sku);
    return { slot: c?.slot ?? wearSlot(i.sku) ?? null, lines: c?.styleLines.length ? c.styleLines : (STYLE.liveLines as Record<string, readonly string[]>)[i.sku] ?? [] };
  }), startingStyle);
}
function simStyle(s: Pick<CityState, "items" | "catalog">, boost: { line: string; place: string } | null, startingStyle: string): NonNullable<CityState["style"]> {
  const counts = simStyleCounts(s, startingStyle);
  return { counts, full: fullLooks(counts), boost };
}

/** The sample day's style task: the starting style's line, at the first place that suits it. */
function styleTask(startingStyle: string): DailyTask {
  const line = (STYLE.startingLines as Record<string, string>)[startingStyle] ?? "streetwear";
  const tags = (STYLE.venues as Record<string, readonly string[]>)[line] ?? [];
  const place = PLACES.find((p) => !p.story && p.tags.some((t) => tags.includes(t)) && p.actions.some((a) => ["visit", "hangout", "eat"].includes(a.kind)))!;
  const action = place.actions.find((a) => ["visit", "hangout", "eat"].includes(a.kind))!;
  return { id: 2, slot: 2, kind: `style:${line}`, place_id: place.id, action_id: action.id, reward: 45, done_at: null };
}

export function sampleCityState(overrides: Partial<CityState["player"]> = {}, skills: SkillState[] = sampleSkills(), opts: { firstDay?: boolean; startingStyle?: string } = {}): CityState {
  const today = new Date().toISOString().slice(0, 10);
  // C3 (migration 0094): a new player's first day starts with the fixed tasks, then a gossip lead and a skill.
  const firstDay: DailyTask[] = [
    ...CITY_ECONOMY.dailyTasks.firstDay.map((f, i) => ({
      id: 11 + i, slot: 1 + i, kind: PLACES.find((p) => p.id === f.place)!.actions.find((a) => a.id === f.action)!.kind as DailyTask["kind"], place_id: f.place, action_id: f.action, reward: [35, 25, 40][i] ?? 30, done_at: null,
    })),
    { id: 14, slot: 4, kind: "gossip", place_id: "grind-and-gossip", action_id: "gossip-regular", reward: 15, done_at: null },
    { id: 15, slot: 5, kind: "cook", place_id: "home", action_id: "cook", reward: 45, done_at: null, skill: "cooking" },
  ];
  const tasks: DailyTask[] = opts.firstDay ? firstDay : [
    // v0.11: two of the five send the player along the gossip trail (the preview week's starts).
    { id: 1, slot: 1, kind: "gossip", place_id: "ditmars-deli", action_id: "gossip-regular", reward: 15, done_at: null },
    // Migration 0100: some days, a task asks for a full look (the preview player's starting Streetwear counts).
    styleTask(opts.startingStyle ?? "bodega_drip"),
    { id: 3, slot: 3, kind: "hangout", place_id: "flushing-meadows", action_id: "hangout", reward: 55, done_at: new Date().toISOString(), goal: "first_gig" },
    // Migration 0063: one task a day levels up a skill.
    { id: 4, slot: 4, kind: "cook", place_id: "home", action_id: "cook", reward: 90, done_at: null, skill: "cooking" },
    { id: 5, slot: 5, kind: "event", place_id: "velvet-static", action_id: "neon-nights", reward: 80, done_at: null, goal: "first_gig" },
  ];
  const gig = (id: number, tier: GigOffer["tier"], i: number, pay: number, energy: number, wait: number, conf: number): GigOffer => ({
    id, ny_date: today, tier, title: GIG_TITLES[tier][i].title, pay, energy, wait_minutes: wait, confidence_req: conf,
    accepted_at: null, ready_at: null, collected_at: null,
  });
  const st: CityState = {
    player: {
      id: "preview", bank_cash: 5450, clout: 850, energy: 80, mood: 60, confidence: 55, home_id: "astoria_studio",
      next_rent_due: addDays(today, 3), next_phone_due: addDays(today, 5), next_car_due: null, house_sku: null, car_sku: null, car_mode: null, purchases_count: 1, at_place: null, fridge_meals: 4, moved_up: false, ...overrides,
    },
    today,
    tasks,
    gigs: [gig(101, "side", 0, 480, 38, 60, 0), gig(102, "side", 3, 420, 38, 60, 0), gig(103, "pro", 0, 1080, 50, 120, 50), gig(104, "big", 1, 2100, 75, 240, 80)],
    bills: [
      { id: 201, kind: "phone", amount: CITY_ECONOMY.bills.phone, due_date: today, status: "due", paid_at: null },
      { id: 200, kind: "rent", amount: 600, due_date: addDays(today, -4), status: "paid", paid_at: new Date().toISOString() },
    ],
    items: [{ id: 301, sku: "fit-bucket-hat", category: "fashion", value: 55, acquired: "bought", equipped: true }],
    visitsToday: { "flushing-meadows": 1 },
    regularDays: { "flushing-meadows": 4, "ditmars-deli": 2 },
    attendedToday: [],
    clockOffsetSeconds: 0,
    devTools: false,
    homeLayout: null,
    restToday: { nap: 0, sit: 0 },
    actionsToday: ["flushing-meadows:hangout"],
    perks: { levels: levelsOf(skills), gigs: [], invites: [] },
    lotto: {
      freeUsed: 0, freeToday: 2, bought: 0, beginnerUntil: new Date(Date.now() + 4 * 86_400_000).toISOString(),
      unscratched: [],
      // Sample pots: each game's lucky number and its pot a little above the seed.
      pots: CITY_ECONOMY.lotto.games.map((g, i) => ({ game: g.id, lucky: [17, 8, 23, 4, 29][i], pool: Math.round(g.pot.seed * 1.06), period: g.period === "day" ? today : addDays(today, -1) })),
      wins: [{ game: "bodega-cat", amount: 10_640, wonAt: new Date(Date.now() - 86_400_000).toISOString(), mine: false, winner: "dana.vibes" }],
    },
  };
  st.style = simStyle(st, null, opts.startingStyle ?? "bodega_drip");
  return st;
}

function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** The sim plus what the preview's story world needs (free story events change Energy and Clout). */
export type SimApi = CityApi & {
  storyEvent(ev: StoryEvent): Promise<CityResult>;
  storyClout(n: number): void;
  /** A treasure hunt's finale pays cash and clout (the preview's hunt runs on the dev server). */
  huntReward(cash: number, clout: number): void;
  /** v0.12 businesses in the preview: the player's cash and clout right now. */
  peek(): { cash: number; clout: number; confidence: number; allDone: boolean };
  /** What the preview's pretend Stripe webhook grants. */
  grantCollector(sku: string): void;
  grantTicket(clout: number): void;
  partyEvent(ev: ExclusiveEvent): Promise<CityResult>;
  /** Previews only (?lotto=win|big|lose): the next cards' prizes, as multiples of the card. */
  lottoNext(times: number[]): void;
  /** Previews only (?lotto=jackpot): the next card's ⭐ wins its pot. */
  lottoPot(): void;
  /** v0.11 gossip tasks: talking or listening in at a place completes its task (the find runs on the dev server). */
  gossipTask(placeId: string, via: "overheard" | "regular" | "restroom"): number;
  /** Moral Choices in the preview (lib/choicesSim.ts): where the player is, and what a choice paid. */
  here(): string | null;
  choicePay(e: { cash?: number; clout?: number; mood?: number; energy?: number }): void;

};

/** `story` returns the preview's current story feed, so prices, closures and unlocks follow the World State. */
export function createSimApi(
  initial: CityState, story: () => StoryFeed | null = () => null,
  /** Daily tasks 2.0 (lib/goalsSim.ts): a guest-list pass used tonight at this club. */
  passTonight: (placeId: string) => boolean = () => false,
  /** C4: transit delays posted in the preview's News (seconds, by line); `showtime` 1 makes every subway ride have dancers. */
  transit: { delayFor: (line: string | null) => number; showtimeChance?: number } = { delayFor: () => 0 },
  /** C5: the calendar (content/culture/calendar.json, passed in by the preview, which may move its dates). */
  calendar: CalendarData | null = null,
  /** Migration 0100: the preview player's starting style (their clothes count toward its line). */
  startingStyle = "bodega_drip",
): SimApi {
  let s: CityState = structuredClone(initial);
  let nextId = 1000;
  let shiftsToday = 0;
  let tripEnds = 0;
  // C4: the showtime dancers on this ride, and the day their clout was paid.
  let showtimeUntil = 0;
  let showtimePaidOn: string | null = null;
  // #19 clubs: VIP covers paid and VIP visits, by "place:day".
  const vipPaid = new Set<string>();
  const vipSeenOn = new Set<string>();
  const vipAccess = (placeId: string) => {
    const vip = clubDoor(PLACES.find((x) => x.id === placeId) ?? {}).vip;
    if (!vip) return null;
    return p().clout >= vip.freeClout ? "free" : perkOn(s.perks, "vip") ? "skill" : vipPaid.has(`${placeId}:${s.today}`) ? "paid" : passTonight(placeId) ? "pass" : null;
  };
  const now = () => Date.now() + s.clockOffsetSeconds * 1000;
  // Migration 0100 in memory: style counts from what's worn (the preview player started in Bodega Drip), the venue
  // boost once a day, style tasks only while the look is worn.
  let styleBoost: { line: string; place: string; day: string } | null = null;
  const styleNow = () => simStyleCounts(s, startingStyle);
  const withStyle = () => {
    s.style = simStyle(s, styleBoost?.day === s.today ? { line: styleBoost.line, place: styleBoost.place } : null, startingStyle);
    return s;
  };
  const ok = (gain?: Gain): Promise<CityResult> => Promise.resolve({ ok: true, state: structuredClone(withStyle()), gain });
  const fail = (error: string): Promise<CityResult> => Promise.resolve({ ok: false, error });
  const p = () => s.player;

  const completeTask = (placeId: string, actionId: string): number => {
    const counts = styleNow();
    const t = s.tasks.find((x) => !x.done_at && x.place_id === placeId && x.action_id === actionId
      && (!x.kind.startsWith("style:") || (counts[x.kind.slice(6)] ?? 0) >= STYLE.fullMin));
    if (!t) return 0;
    t.done_at = new Date(now()).toISOString();
    // Owner, Oct 14 (migration 0042): gossip tasks pay clout, not cash.
    let paid = t.kind === "gossip" ? 0 : t.reward;
    if (t.kind === "gossip") p().clout += CITY_ECONOMY.gossip.taskClout;
    if (s.tasks.every((x) => x.done_at)) paid += CITY_ECONOMY.dailyTasks.bonus;
    p().bank_cash += paid;
    return paid;
  };

  // Lucky Star in memory. The real draw is the server's (migration 0032); here it's Math.random,
  // or the preview's queued results.
  const lottoCards = new Map<number, { game: string; prize: number; pot: number; lucky: number; numbers: LottoCell[] }>();
  let lottoQueue: number[] = [];
  let potNext = false;
  const rand = (n: number) => Math.floor(Math.random() * n);

  return {
    refresh: () => ok(),
    lottoNext(times) { lottoQueue = [...times]; },
    lottoPot() { potNext = true; },
    gossipTask: (placeId, via) => completeTask(placeId, `gossip-${via}`),

    buyLottoCard(placeId, gameId, free) {
      const place = PLACES.find((x) => x.id === placeId);
      const game = lottoGame(gameId);
      const l = s.lotto;
      if (!place || !isLottoPlace(place.tags) || !l) return fail("That isn't something you can do here.");
      if (!game) return fail("Benny's never heard of that one.");
      if ((p().at_place ?? null) !== placeId) return fail("You're not at Lucky Star. The cards don't travel.");
      if (free) {
        if (gameId !== CITY_ECONOMY.lotto.freeGame) return fail("The free card is the Corner Store Classic.");
        if (l.freeUsed >= l.freeToday) return fail("Free cards are used up today. New ones at midnight.");
        l.freeUsed += 1;
      } else {
        if (l.bought >= CITY_ECONOMY.lotto.buyPerDay) return fail(`That's ${CITY_ECONOMY.lotto.buyPerDay} cards today. Benny cuts everyone off. New cards at midnight.`);
        if (p().bank_cash < game.price) return fail("Not enough cash for this card.");
        l.bought += 1;
        p().bank_cash -= game.price;
      }
      const potRow = l.pots.find((x) => x.game === gameId)!;
      if (!free) potRow.pool = Math.floor(potRow.pool + game.price * CITY_ECONOMY.lotto.potCut);
      const queued = lottoQueue.shift();
      const prize = queued !== undefined ? queued * game.price : prizeFor(game.price, rand(100_000));
      let pot = 0;
      if (potNext || rand(game.pot.oneIn) === 0) {
        pot = potRow.pool;
        potRow.pool = game.pot.seed;
        potNext = false;
      }
      const id = nextId++;
      lottoCards.set(id, { game: gameId, prize, pot, lucky: potRow.lucky, numbers: cardCells(game.price, prize, pot, potRow.lucky, rand) });
      l.unscratched.push({ id, game: gameId });
      return Promise.resolve({ ok: true, state: structuredClone(s), card: { id, game: gameId } });
    },
    scratchLottoCard(cardId) {
      const c = lottoCards.get(cardId);
      if (!c || !s.lotto) return fail("That card isn't yours to scratch.");
      lottoCards.delete(cardId);
      s.lotto.unscratched = s.lotto.unscratched.filter((x) => x.id !== cardId);
      p().bank_cash += c.prize + c.pot;
      if (c.pot) s.lotto.wins = [{ game: c.game, amount: c.pot, wonAt: new Date(now()).toISOString(), mine: true, winner: "you" }, ...(s.lotto.wins ?? [])].slice(0, 3);
      return Promise.resolve({ ok: true, state: structuredClone(s), card: { id: cardId, game: c.game, prize: c.prize, pot: c.pot, lucky: c.lucky, numbers: c.numbers } });
    },
    travel(placeId, mode) {
      const dest = placeId === "home" ? null : placeId;
      if ((p().at_place ?? null) === dest) return ok();
      const point = (id: string | null) => (id ? PLACES.find((x) => x.id === id)?.at : HOME_LOCATIONS[p().home_id ?? "astoria_studio"]);
      const from = point(p().at_place ?? null);
      const to = point(dest);
      if (!from || !to) return fail("That place isn't on the map.");
      const door = dest ? clubDoor(PLACES.find((x) => x.id === dest)!).doorClout : 0;
      if (p().clout < door && !passTonight(dest!) && !perkOn(s.perks, "door")) return fail(DOOR_CLOUT);
      // C4 (migration 0095): the destination's line, its delay, the OMG Card, showtime dancers.
      const line = lineFor(dest ? PLACES.find((x) => x.id === dest)?.neighborhood : ECONOMY.homes.find((h) => h.id === p().home_id)?.neighborhood);
      const delay = mode === "subway" ? transit.delayFor(line) : 0;
      const pass = !!p().transit_pass_until && Date.parse(p().transit_pass_until!) > Date.now();
      const q = travelQuote(mode, milesBetween(from, to), !!p().car_sku, { delay, pass });
      if (q.unavailable) return fail(mode === "walk" ? "That's too far to walk. Your shoes have filed a complaint." : "You don't have a car. The Shop has some, and so does the subway.");
      if (p().energy < q.energy) return fail("Not enough Energy. Eat something, or sleep it off until tomorrow.");
      if (p().bank_cash < q.fare) return fail("Your card got declined. Loudly.");
      p().bank_cash -= q.fare;
      p().energy -= q.energy;
      p().at_place = dest;
      tripEnds = Date.now() + q.seconds * 1000;
      const showtime = mode === "subway" && showtimePaidOn !== s.today && Math.random() < (transit.showtimeChance ?? CITY_ECONOMY.travel.subway.showtime.chance);
      showtimeUntil = showtime ? tripEnds + 60_000 : 0;
      return ok({ cash: -q.fare, energy: -q.energy }).then((r) => (r.ok ? { ...r, trip: { seconds: q.seconds, line: mode === "subway" ? line : null, delay, showtime } } : r));
    },
    calendarAttend(eventId) {
      const e = calendar?.events.find((x) => x.id === eventId);
      if (!e) return fail(cityError("unknown_event"));
      if (!calendarLive(e, now())) return fail(cityError("not_now"));
      if ((p().at_place ?? null) !== e.place) return fail("You're not there yet. Go there first.");
      const cal = s.calendar ?? { attended: [], gifts: 0 };
      if (cal.attended.includes(e.id)) return fail(cityError("already_went"));
      if (p().bank_cash < e.entry) return fail("Your card got declined. Loudly.");
      const r = calendarReward(e, { dressed: dressedUp(s.items), gifts: cal.gifts });
      p().bank_cash -= e.entry;
      p().clout = Math.max(0, p().clout + r.clout);
      p().mood = Math.min(100, p().mood + r.mood);
      s.calendar = { attended: [...cal.attended, e.id], gifts: cal.gifts - (r.gift === "brought" ? 1 : 0) };
      return ok({ clout: r.clout, mood: r.mood, cash: -e.entry });
    },
    buyGift() {
      if (!calendar) return fail(cityError("no_gifts_here"));
      if (!calendar.giftPlaces.includes(p().at_place ?? "")) return fail(cityError("no_gifts_here"));
      const cal = s.calendar ?? { attended: [], gifts: 0 };
      if (cal.gifts >= calendar.giftsMax) return fail(cityError("gifts_full"));
      if (p().bank_cash < calendar.giftPrice) return fail("Your card got declined. Loudly.");
      p().bank_cash -= calendar.giftPrice;
      s.calendar = { ...cal, gifts: cal.gifts + 1 };
      return ok({ cash: -calendar.giftPrice });
    },
    buyTransitPass(passId) {
      const pass = CITY_ECONOMY.travel.subway.passes.find((x) => x.id === passId);
      if (!pass) return fail(cityError("unknown_pass"));
      if (p().bank_cash < pass.price) return fail("Your card got declined. Loudly.");
      p().bank_cash -= pass.price;
      const from = Math.max(Date.now(), p().transit_pass_until ? Date.parse(p().transit_pass_until!) : 0);
      p().transit_pass_until = new Date(from + pass.days * 86_400_000).toISOString();
      return ok({ cash: -pass.price });
    },
    watchShowtime() {
      if (showtimeUntil < Date.now()) return fail(cityError("no_showtime"));
      showtimeUntil = 0;
      if (showtimePaidOn === s.today) return ok({ clout: 0 });
      showtimePaidOn = s.today;
      const clout = CITY_ECONOMY.travel.subway.showtime.clout;
      p().clout += clout;
      return ok({ clout });
    },
    skipTrip() {
      const cost = skipCost(Math.ceil((tripEnds - Date.now()) / 1000));
      if (p().bank_cash < cost) return fail("Your card got declined. Loudly.");
      p().bank_cash -= cost;
      tripEnds = 0;
      return ok({ cash: -cost });
    },
    rest(kind) {
      const r = CITY_ECONOMY.rest[kind];
      if (!r) return fail("That isn't a way to rest.");
      if ((p().at_place ?? null) !== null) return fail("Go home first. Your bed and your kitchen are both there.");
      const used = s.restToday?.[kind] ?? 0;
      if (used >= r.perDay) return fail("You've rested enough for today. The couch needs a break from you.");
      s.restToday = { nap: 0, sit: 0, ...s.restToday, [kind]: used + 1 };
      const energy = Math.min(100 - p().energy, r.energy);
      const mood = Math.min(100 - p().mood, r.mood);
      p().energy += energy;
      p().mood += mood;
      return ok({ energy, mood });
    },
    barDrink(placeId) {
      const place = PLACES.find((x) => x.id === placeId);
      if (!place || !hasBar(place.tags)) return fail("That isn't something you can do here.");
      if ((p().at_place ?? null) !== placeId) return fail("You're not there yet. Go there first.");
      const price = CITY_ECONOMY.barDrink.price;
      if (p().energy >= 100) return fail("You're already at full Energy. Save it for later.");
      if (p().bank_cash < price) return fail("Your card got declined. Loudly.");
      const energy = Math.min(100 - p().energy, CITY_ECONOMY.barDrink.energy);
      p().bank_cash -= price;
      p().energy += energy;
      return ok({ cash: -price, energy });
    },
    buyGroceries(placeId, bundleId) {
      const place = PLACES.find((x) => x.id === placeId);
      if (!place || !isSupermarket(place.tags)) return fail("That isn't something you can do here.");
      const b = CITY_ECONOMY.groceries.bundles.find((x) => x.id === bundleId);
      if (!b) return fail("That isn't on the shelves.");
      if ((p().at_place ?? null) !== placeId) return fail("You're not there yet. Go there first.");
      if ((p().fridge_meals ?? 0) + b.meals > CITY_ECONOMY.groceries.fridgeMax) return fail("Your fridge is full. Eat something first, or play fridge Tetris.");
      if (p().bank_cash < b.price) return fail("Your card got declined. Loudly.");
      p().bank_cash -= b.price;
      p().fridge_meals = (p().fridge_meals ?? 0) + b.meals;
      return ok({ cash: -b.price });
    },
    cook() {
      if ((p().at_place ?? null) !== null) return fail("Go home first. Your bed and your kitchen are both there.");
      if (!p().fridge_meals) return fail("The fridge is empty. The light still works, though.");
      if (p().energy >= 100) return fail("You're already at full Energy. Save it for later.");
      const energy = Math.min(100 - p().energy, CITY_ECONOMY.groceries.cook.energy);
      p().fridge_meals! -= 1;
      p().energy += energy;
      const cash = completeTask("home", "cook");
      return ok(cash ? { energy, cash } : { energy });
    },
    doAction(placeId, actionId) {
      const place = PLACES.find((x) => x.id === placeId);
      const a = place?.actions.find((x) => x.id === actionId);
      if (!place || !a) return fail("That isn't something you can do here.");
      if ((p().at_place ?? null) !== placeId) return fail("You're not there yet. Go there first.");
      const feed = story();
      const world = placeStory(feed, place);
      if (place.story && !(feed?.startedArcs ?? []).includes(place.story)) return fail("That isn't something you can do here.");
      if (a.storyUnlock && !world.unlocked.includes(a.id)) return fail("That isn't something you can do here.");
      if (world.closed) return fail(world.closed.reason);
      if (world.restricted && !world.restricted.allow.includes(a.id)) return fail(world.restricted.reason);
      // C2 (migration 0093): opening hours on the city clock.
      if (!placeOpen(place, cityMinutes(now(), CLOCK))) return fail(cityError("closed_now"));
      const base = a.price ?? 0;
      const price = Math.round(base * (world.price?.appliesTo === "visit_price" ? world.price.multiplier : 1));
      if (a.energy > 0 && p().energy < a.energy) return fail("Not enough Energy. Eat something, or sleep it off until tomorrow.");
      if (p().bank_cash < price) return fail("Your card got declined. Loudly.");
      // v0.11 (0039): a work day is at most shiftsPerDay shifts, across every job.
      if (a.kind === "shift" && shiftsToday >= CITY_ECONOMY.shiftsPerDay) return fail(SHIFT_LIMIT);
      if (a.kind === "shift") shiftsToday += 1;
      const first = !s.visitsToday[placeId];
      if (first) s.regularDays = { ...s.regularDays, [placeId]: (s.regularDays?.[placeId] ?? 0) + 1 };
      s.visitsToday[placeId] = (s.visitsToday[placeId] ?? 0) + 1;
      // v0.9 (0031): Mood and Confidence once a day per activity.
      const key = `${placeId}:${actionId}`;
      const firstAction = !(s.actionsToday ?? []).includes(key);
      s.actionsToday = [...(s.actionsToday ?? []), key];
      // Clout comes from the base price (or the action's fixed clout), never a story-raised price.
      const clout = !first ? 0 : a.clout ?? (a.kind === "visit" || a.kind === "eat" ? visitClout(base, p().mood, p().confidence) : 0);
      const mood = firstAction ? a.mood ?? 0 : 0;
      const confidence = firstAction ? a.confidence ?? 0 : 0;
      p().bank_cash += (a.pay ?? 0) - price;
      p().energy = Math.min(100, Math.max(0, p().energy - a.energy));
      p().clout += clout;
      p().mood = Math.min(100, p().mood + mood);
      p().confidence = Math.min(100, p().confidence + confidence);
      const taskCash = completeTask(placeId, actionId);
      // The venue boost lands after the action (the server's deferred trigger), so it isn't in this action's clout.
      let styleConf = 0;
      const line = styleBoost?.day === s.today ? null : venueLine(styleNow(), place.tags);
      if (line) { styleBoost = { line, place: placeId, day: s.today }; styleConf = Math.min(100 - p().confidence, STYLE.venueConfidence); p().confidence += styleConf; }
      return ok({ cash: (a.pay ?? 0) - price + taskCash, clout, energy: -a.energy, mood, confidence: confidence + styleConf, taskCash });
    },
    attendEvent(eventId) {
      const ev = CLUB_EVENTS.find((e) => e.id === eventId);
      if (!ev) return fail("That event doesn't exist.");
      if ((p().at_place ?? null) !== ev.placeId) return fail("You're not there yet. Go there first.");
      const club = PLACES.find((x) => x.id === ev.placeId);
      const world = club ? placeStory(story(), club) : null;
      if (world?.closed) return fail(world.closed.reason);
      const entry = Math.round(ev.entry * (world?.price?.appliesTo === "event_entry" ? world.price.multiplier : 1));
      if (!eventOpen(ev, cityMinutes(now(), CLOCK))) return fail("Doors aren't open yet. The bouncer is pretending not to see you.");
      if (s.attendedToday.includes(eventId)) return fail("You already went tonight. Twice would be desperate.");
      if (p().energy < CITY_ECONOMY.energy.eventCost) return fail("Not enough Energy. Eat something, or sleep it off until tomorrow.");
      if (p().bank_cash < entry) return fail("Your card got declined. Loudly.");
      s.attendedToday.push(eventId);
      const clout = Math.round(ev.clout * (0.7 + (0.3 * p().mood) / 100 + (0.3 * p().confidence) / 100));
      p().bank_cash -= entry;
      p().energy -= CITY_ECONOMY.energy.eventCost;
      p().clout += clout;
      p().mood = Math.min(100, p().mood + ev.mood);
      p().confidence = Math.min(100, p().confidence + ev.confidence);
      const taskCash = completeTask(ev.placeId, ev.id);
      return ok({ cash: -entry + taskCash, clout, energy: -CITY_ECONOMY.energy.eventCost, mood: ev.mood, confidence: ev.confidence, taskCash });
    },
    acceptGig(offerId) {
      const g = s.gigs.find((x) => x.id === offerId);
      if (!g) return fail("That offer expired at midnight.");
      if (activeGig(s) || s.perks?.gigs.some((x) => !x.collected_at)) return fail("Finish your current gig first.");
      if (p().clout < gigCloutReq(g.tier)) return fail("This client googled you. Come back with more clout.");
      if (p().confidence < g.confidence_req) return fail("This client wants more Confidence than you've got right now.");
      if (p().energy < g.energy) return fail("Not enough Energy. Eat something, or sleep it off until tomorrow.");
      p().energy -= g.energy;
      g.accepted_at = new Date(now()).toISOString();
      g.ready_at = new Date(now() + g.wait_minutes * 60_000).toISOString();
      return ok({ energy: -g.energy });
    },
    // Skill perks (migration 0092).
    takeSkillGig(perkId) {
      const perk = SKILL_PERKS.find((x) => x.id === perkId && x.kind === "gig");
      const st = s.perks;
      if (!perk || !st) return fail(PERK_ERRORS.unknown_perk);
      if ((st.levels[perk.skill] ?? 0) < perk.level) return fail(PERK_ERRORS.skill_locked);
      if (st.gigs.some((x) => x.perk === perkId)) return fail(PERK_ERRORS.gig_done_week);
      if (activeGig(s) || st.gigs.some((x) => !x.collected_at)) return fail(PERK_ERRORS.gig_active);
      if (p().energy < perk.energy!) return fail(PERK_ERRORS.no_energy);
      p().energy -= perk.energy!;
      // The preview finishes skill gigs in seconds, so the whole loop can be tried.
      st.gigs.push({ perk: perkId, accepted_at: new Date(now()).toISOString(), ready_at: new Date(now() + 8_000).toISOString(), collected_at: null });
      return ok({ energy: -perk.energy! });
    },
    collectSkillGig(perkId) {
      const perk = SKILL_PERKS.find((x) => x.id === perkId);
      const g = s.perks?.gigs.find((x) => x.perk === perkId && !x.collected_at);
      if (!perk || !g) return fail(PERK_ERRORS.unknown_perk);
      if (new Date(g.ready_at!).getTime() > now()) return fail(PERK_ERRORS.not_ready);
      g.collected_at = new Date(now()).toISOString();
      p().bank_cash += perk.pay!;
      p().clout += perk.clout ?? 0;
      return ok({ cash: perk.pay, ...(perk.clout ? { clout: perk.clout } : {}) });
    },
    acceptSkillInvite(perkId) {
      const perk = SKILL_PERKS.find((x) => x.id === perkId && x.kind === "invite");
      const st = s.perks;
      if (!perk || !st) return fail(PERK_ERRORS.unknown_perk);
      if ((st.levels[perk.skill] ?? 0) < perk.level) return fail(PERK_ERRORS.skill_locked);
      if (st.invites.includes(perkId)) return ok();
      st.invites.push(perkId);
      p().clout += perk.clout!;
      return ok({ clout: perk.clout });
    },
    collectGig(offerId) {
      const g = s.gigs.find((x) => x.id === offerId);
      if (!g?.ready_at || g.collected_at) return fail("Nothing to collect.");
      if (new Date(g.ready_at).getTime() > now()) return fail("Not done yet. Good work takes time; so does mediocre work.");
      g.collected_at = new Date(now()).toISOString();
      p().bank_cash += g.pay;
      return ok({ cash: g.pay });
    },
    buyItem(sku, mode) {
      const item = itemBySku(sku) ?? catalogShopItem(s, sku);
      if (!item || (item.storyOnly && !storyItemOpen(story(), sku).open)) return fail("That isn't in stock.");
      if (item.collector) return fail("That piece is real cash only.");
      if (item.reward) return fail(REWARD_ONLY);
      if (s.items.some((i) => i.sku === sku)) return fail("You already own that. Calm down.");
      if (p().clout < (item.cloutReq ?? 0)) return fail(OUTFIT_NEEDS_CLOUT);
      const price = mode === "rent" ? item.rentPerWeek ?? 0 : item.price;
      if (p().bank_cash < price) return fail("Your card got declined. Loudly.");
      p().bank_cash -= price;
      let clout = 0;
      if (mode === "buy") {
        clout = purchaseClout(item.clout, p().purchases_count);
        p().purchases_count += 1;
        p().clout += clout;
        s.items.push({ id: nextId++, sku, category: item.category, value: item.price, acquired: "bought", equipped: false });
      }
      if (item.category === "cars") { p().car_sku = sku; p().car_mode = mode === "rent" ? "rented" : "owned"; p().next_car_due = addDays(s.today, mode === "rent" ? 7 : 30); }
      if (item.category === "houses") { p().house_sku = sku; p().next_rent_due = null; }
      return ok({ cash: -price, clout });
    },
    sellItem(itemId) {
      const it = s.items.find((i) => i.id === itemId);
      if (!it) return fail("You don't own that.");
      if (it.acquired === "collector") return fail("Collector pieces can't be sold.");
      if (itemBySku(it.sku)?.reward) return fail(REWARD_KEEP);
      const amount = sellPrice(it.value);
      s.items = s.items.filter((i) => i.id !== itemId);
      p().bank_cash += amount;
      if (it.category === "cars") { p().car_sku = null; p().car_mode = null; p().next_car_due = null; }
      if (it.category === "houses") { p().house_sku = null; p().next_rent_due = addDays(s.today, 30); }
      return ok({ cash: amount });
    },
    equipItem(itemId, on) {
      const it = s.items.find((i) => i.id === itemId);
      const slot = it && it.category === "fashion" ? wearSlot(it.sku) : undefined;
      if (!it || !slot) return fail("You can't wear that. You could try, but no.");
      // One piece per slot, a dress counting as the top and the bottom (migration 0101 wear_slots).
      if (on) for (const o of s.items) { const os = wearSlot(o.sku); if (o.id !== it.id && os && slotsClash(os, slot)) o.equipped = false; }
      it.equipped = on;
      return ok();
    },
    setItemOptions(itemId, o) {
      const it = s.items.find((i) => i.id === itemId);
      if (!it || !hasOptions(it.sku)) return fail("That piece has no choices to make.");
      if (it.sku === CROWN_SKU) it.options = { style: o.style === "tiara" ? "tiara" : "crown" };
      else {
        const mono = cleanMonogram(o.monogram ?? "");
        if (mono === null) return fail("Up to three letters, A to Z.");
        if (!SUIT_CLOTHS.some((c) => c.hex === (o.cloth ?? SUIT_CLOTHS[0].hex)) || !SUIT_LININGS.some((c) => c.hex === (o.lining ?? SUIT_LININGS[0].hex))) return fail("That isn't one of the choices.");
        it.options = { cloth: o.cloth ?? SUIT_CLOTHS[0].hex, lining: o.lining ?? SUIT_LININGS[0].hex, monogram: mono };
      }
      return ok();
    },
    saveLook(itemIds) {
      const slots = itemIds.map((id) => wearSlot(s.items.find((i) => i.id === id)?.sku ?? ""));
      if (slots.some((x) => !x)) return fail("You can't wear that. You could try, but no.");
      if (new Set(slots).size !== slots.length) return fail("One top, one bottom, one pair of shoes. You're not a closet.");
      if (slots.includes("one-piece") && (slots.includes("top") || slots.includes("bottom"))) return fail("A dress is already a top and a bottom. Pick one.");
      for (const i of s.items) if (i.category === "fashion") i.equipped = itemIds.includes(i.id);
      return ok();
    },
    payBill(billId) {
      const b = s.bills.find((x) => x.id === billId);
      if (!b || b.status !== "due") return ok();
      if (p().bank_cash < b.amount) return fail("Your card got declined. Loudly.");
      p().bank_cash -= b.amount;
      b.status = "paid";
      b.paid_at = new Date(now()).toISOString();
      return ok({ cash: -b.amount });
    },
    saveHomeLayout(layout) {
      s.homeLayout = layout;
      return ok();
    },
    enterVip(placeId, pay) {
      // Migration 0046's enter_vip: free from the club's clout, else the cover once a day.
      const vip = clubDoor(PLACES.find((x) => x.id === placeId) ?? {}).vip;
      if (!vip) return fail("This club doesn't have a VIP floor. Everyone here is equally important.");
      if ((p().at_place ?? null) !== placeId) return fail("You're not there yet. Go there first.");
      const access = vipAccess(placeId);
      if (access) return Promise.resolve({ ok: true, state: structuredClone(s), vip: { access } });
      if (!pay) return Promise.resolve({ ok: true, state: structuredClone(s), vip: { needsCover: vip.cover } });
      if (p().bank_cash < vip.cover) return fail("Your card got declined. Loudly.");
      p().bank_cash -= vip.cover;
      vipPaid.add(`${placeId}:${s.today}`);
      return Promise.resolve({ ok: true, state: structuredClone(s), gain: { cash: -vip.cover }, vip: { access: "paid" } });
    },
    vipSeen(placeId) {
      const place = PLACES.find((x) => x.id === placeId);
      const a = place?.actions.find((x) => x.kind === "visit");
      if (!place || !a || !place.club?.vip) return fail("This club doesn't have a VIP floor. Everyone here is equally important.");
      if (!vipAccess(placeId)) return fail(VIP_LOCKED);
      if (vipSeenOn.has(`${placeId}:${s.today}`)) return fail(VIP_ALREADY);
      if (p().energy < a.energy) return fail("Not enough Energy. Eat something, or sleep it off until tomorrow.");
      const clout = CITY_ECONOMY.clubs.vipTimes * visitClout(a.price ?? 0, p().mood, p().confidence);
      const mood = Math.min(100 - p().mood, a.mood ?? 0);
      const confidence = Math.min(100 - p().confidence, a.confidence ?? 0);
      vipSeenOn.add(`${placeId}:${s.today}`);
      p().clout += clout;
      p().mood += mood;
      p().confidence += confidence;
      p().energy -= a.energy;
      return ok({ clout, mood, confidence, energy: -a.energy });
    },
    moveHome(homeId) {
      // Migration 0045's move_home: first week's rent plus the broker fee, the home's clout, no rent owed.
      const home = ECONOMY.homes.find((h) => h.id === homeId);
      if (!home) return fail("That listing was a scam. Classic.");
      if (p().house_sku) return fail("You own a house. Landlords are a thing of your past.");
      if (p().home_id === homeId) return fail("You already live there. Unpack first.");
      if (s.bills.some((b) => b.kind === "rent" && b.status === "due")) return fail("Pay this week's rent before you move. Landlords talk.");
      if (p().clout < (home.moveClout ?? 0)) return fail(HOME_NEEDS_CLOUT);
      const cost = moveCost(home);
      if (p().bank_cash < cost) return fail("Your card got declined. Loudly.");
      const before = ECONOMY.homes.find((h) => h.id === p().home_id)?.rent ?? 0;
      p().bank_cash -= cost;
      p().home_id = homeId;
      p().next_rent_due = addDays(s.today, 7);
      p().moved_up = !!p().moved_up || home.rent > before;
      return ok({ cash: -cost });
    },
    storyClout(n) {
      p().clout += n;
    },
    huntReward(cash, clout) {
      p().bank_cash += cash;
      p().clout += clout;
    },
    here: () => p().at_place ?? null,
    choicePay(e) {
      p().bank_cash = Math.max(0, p().bank_cash + (e.cash ?? 0));
      p().clout = Math.max(0, p().clout + (e.clout ?? 0));
      p().mood = Math.min(100, Math.max(0, p().mood + (e.mood ?? 0)));
      p().energy = Math.min(100, Math.max(0, p().energy + (e.energy ?? 0)));
    },
    peek() {
      return { cash: p().bank_cash, clout: p().clout, confidence: p().confidence, allDone: s.tasks.length > 0 && s.tasks.every((t) => t.done_at) };
    },
    grantCollector(sku) {
      // The code's collector pieces, or a catalog one (Clout Couture, migration 0102): worn accessories filed as fashion,
      // valued by their Shop tab, and a car goes in the garage.
      const c = itemBySku(sku) ? undefined : s.catalog?.find((x) => x.sku === sku && x.realCash);
      const item = itemBySku(sku) ?? (c && { category: (wearSlot(sku) && c.tab !== "fashion" ? "fashion" : c.tab) as ShopItem["category"], clout: c.clout });
      if (!item || s.items.some((i) => i.sku === sku)) return;
      s.items.push({ id: nextId++, sku, category: item.category, value: collectorValue(c?.tab ?? item.category), acquired: "collector", equipped: false });
      if (c?.tab === "cars" && p().car_mode !== "owned") Object.assign(p(), { car_sku: sku, car_mode: "owned" });
      p().clout += purchaseClout(item.clout, p().purchases_count);
      p().purchases_count += 1;
    },
    grantTicket(clout) {
      p().clout += purchaseClout(clout, p().purchases_count);
      p().purchases_count += 1;
    },
    partyEvent(ev) {
      if ((p().at_place ?? null) !== ev.placeId) return fail("You're not there yet. Go there first.");
      if (s.attendedToday.includes(ev.id)) return fail("You already went tonight. Twice would be desperate.");
      if (p().energy < ev.energy) return fail("Not enough Energy. Eat something, or sleep it off until tomorrow.");
      s.attendedToday.push(ev.id);
      p().energy -= ev.energy;
      p().mood = Math.min(100, p().mood + ev.mood);
      p().confidence = Math.min(100, p().confidence + ev.confidence);
      return ok({ energy: -ev.energy, mood: ev.mood, confidence: ev.confidence });
    },
    storyEvent(ev) {
      if (s.attendedToday.includes(ev.id)) return fail("You were already there. Everyone saw you. It's fine.");
      if (p().energy < (ev.energy ?? 0)) return fail("Not enough Energy. Eat something, or sleep it off until tomorrow.");
      s.attendedToday.push(ev.id);
      const clout = Math.round((ev.clout ?? 0) * (0.7 + (0.3 * p().mood) / 100 + (0.3 * p().confidence) / 100));
      p().energy -= ev.energy ?? 0;
      p().clout += clout;
      p().mood = Math.min(100, p().mood + (ev.mood ?? 0));
      return ok({ clout, energy: -(ev.energy ?? 0), mood: ev.mood ?? 0 });
    },
    setClockOffset(hours) {
      s.clockOffsetSeconds = Math.round(hours * 3600);
      return ok();
    },
  };
}
