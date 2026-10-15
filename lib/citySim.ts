// An in-memory stand-in for the v0.3 server functions, used only by the
// development previews (/preview/home) so every city screen can be tried without
// a database. It follows the same rules as supabase/migrations/0004 in simplified
// form; the SQL is the source of truth.

import { CITY_ECONOMY, CLUB_EVENTS, GIG_TITLES, HOME_LOCATIONS, PLACES, collectorValue, eventOpen, itemBySku, purchaseClout, sellPrice, visitClout } from "./city.ts";
import { ECONOMY, moveCost } from "./economy.ts";
import type { ExclusiveEvent } from "./store.ts";
import { cityMinutes } from "./cityClock.ts";
import { milesBetween, skipCost, travelQuote } from "./travel.ts";
import { DOOR_CLOUT, HOME_NEEDS_CLOUT, VIP_ALREADY, VIP_LOCKED, clubDoor, OUTFIT_NEEDS_CLOUT, SHIFT_LIMIT, activeGig, gigCloutReq, hasBar, isSupermarket, type CityApi, type CityResult, type CityState, type DailyTask, type Gain, type GigOffer } from "./cityState.ts";
import { cardCells, isLottoPlace, lottoGame, prizeFor, type LottoCell } from "./lotto.ts";
import { placeStory, storyItemOpen, type StoryFeed } from "./storyFeed.ts";
import type { StoryEvent } from "./stories.ts";

const CLOCK = { realHoursPerCityDay: 2, dayStartsAt: 6, nightStartsAt: 19 };

export function sampleCityState(overrides: Partial<CityState["player"]> = {}): CityState {
  const today = new Date().toISOString().slice(0, 10);
  const tasks: DailyTask[] = [
    // v0.11: two of the five send the player along the gossip trail (the preview week's starts).
    { id: 1, slot: 1, kind: "gossip", place_id: "ditmars-deli", action_id: "gossip-regular", reward: 15, done_at: null },
    { id: 2, slot: 2, kind: "gossip", place_id: "two-bros-pizza", action_id: "gossip-overheard", reward: 15, done_at: null },
    { id: 3, slot: 3, kind: "hangout", place_id: "flushing-meadows", action_id: "hangout", reward: 55, done_at: new Date().toISOString() },
    { id: 4, slot: 4, kind: "visit", place_id: "velvet-static", action_id: "visit", reward: 90, done_at: null },
    { id: 5, slot: 5, kind: "event", place_id: "velvet-static", action_id: "neon-nights", reward: 80, done_at: null },
  ];
  const gig = (id: number, tier: GigOffer["tier"], i: number, pay: number, energy: number, wait: number, conf: number): GigOffer => ({
    id, ny_date: today, tier, title: GIG_TITLES[tier][i].title, pay, energy, wait_minutes: wait, confidence_req: conf,
    accepted_at: null, ready_at: null, collected_at: null,
  });
  return {
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
    attendedToday: [],
    clockOffsetSeconds: 0,
    devTools: false,
    homeLayout: null,
    restToday: { nap: 0, sit: 0 },
    actionsToday: ["flushing-meadows:hangout"],
    lotto: {
      freeUsed: 0, freeToday: 2, bought: 0, beginnerUntil: new Date(Date.now() + 4 * 86_400_000).toISOString(),
      unscratched: [],
      // Sample pots: each game's lucky number and its pot a little above the seed.
      pots: CITY_ECONOMY.lotto.games.map((g, i) => ({ game: g.id, lucky: [17, 8, 23, 4, 29][i], pool: Math.round(g.pot.seed * 1.06), period: g.period === "day" ? today : addDays(today, -1) })),
      wins: [{ game: "bodega-cat", amount: 10_640, wonAt: new Date(Date.now() - 86_400_000).toISOString(), mine: false, winner: "dana.vibes" }],
    },
  };
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
  peek(): { cash: number; clout: number };
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

};

/** `story` returns the preview's current story feed, so prices, closures and unlocks follow the World State. */
export function createSimApi(initial: CityState, story: () => StoryFeed | null = () => null): SimApi {
  let s: CityState = structuredClone(initial);
  let nextId = 1000;
  let shiftsToday = 0;
  let tripEnds = 0;
  // #19 clubs: VIP covers paid and VIP visits, by "place:day".
  const vipPaid = new Set<string>();
  const vipSeenOn = new Set<string>();
  const vipAccess = (placeId: string) => {
    const vip = clubDoor(PLACES.find((x) => x.id === placeId) ?? {}).vip;
    if (!vip) return null;
    return p().clout >= vip.freeClout ? "free" : vipPaid.has(`${placeId}:${s.today}`) ? "paid" : null;
  };
  const now = () => Date.now() + s.clockOffsetSeconds * 1000;
  const ok = (gain?: Gain): Promise<CityResult> => Promise.resolve({ ok: true, state: structuredClone(s), gain });
  const fail = (error: string): Promise<CityResult> => Promise.resolve({ ok: false, error });
  const p = () => s.player;

  const completeTask = (placeId: string, actionId: string): number => {
    const t = s.tasks.find((x) => !x.done_at && x.place_id === placeId && x.action_id === actionId);
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
      if (p().clout < door) return fail(DOOR_CLOUT);
      const q = travelQuote(mode, milesBetween(from, to), !!p().car_sku);
      if (q.unavailable) return fail(mode === "walk" ? "That's too far to walk. Your shoes have filed a complaint." : "You don't have a car. The Shop has some, and so does the subway.");
      if (p().energy < q.energy) return fail("Not enough Energy. Eat something, or sleep it off until tomorrow.");
      if (p().bank_cash < q.fare) return fail("Your card got declined. Loudly.");
      p().bank_cash -= q.fare;
      p().energy -= q.energy;
      p().at_place = dest;
      tripEnds = Date.now() + q.seconds * 1000;
      return ok({ cash: -q.fare, energy: -q.energy });
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
      return ok({ energy });
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
      const base = a.price ?? 0;
      const price = Math.round(base * (world.price?.appliesTo === "visit_price" ? world.price.multiplier : 1));
      if (a.energy > 0 && p().energy < a.energy) return fail("Not enough Energy. Eat something, or sleep it off until tomorrow.");
      if (p().bank_cash < price) return fail("Your card got declined. Loudly.");
      // v0.11 (0039): a work day is at most shiftsPerDay shifts, across every job.
      if (a.kind === "shift" && shiftsToday >= CITY_ECONOMY.shiftsPerDay) return fail(SHIFT_LIMIT);
      if (a.kind === "shift") shiftsToday += 1;
      const first = !s.visitsToday[placeId];
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
      return ok({ cash: (a.pay ?? 0) - price + taskCash, clout, energy: -a.energy, mood, confidence, taskCash });
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
      if (activeGig(s)) return fail("Finish your current gig first.");
      if (p().clout < gigCloutReq(g.tier)) return fail("This client googled you. Come back with more clout.");
      if (p().confidence < g.confidence_req) return fail("This client wants more Confidence than you've got right now.");
      if (p().energy < g.energy) return fail("Not enough Energy. Eat something, or sleep it off until tomorrow.");
      p().energy -= g.energy;
      g.accepted_at = new Date(now()).toISOString();
      g.ready_at = new Date(now() + g.wait_minutes * 60_000).toISOString();
      return ok({ energy: -g.energy });
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
      const item = itemBySku(sku);
      if (!item || (item.storyOnly && !storyItemOpen(story(), sku).open)) return fail("That isn't in stock.");
      if (item.collector) return fail("That piece is real cash only.");
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
      const amount = sellPrice(it.value);
      s.items = s.items.filter((i) => i.id !== itemId);
      p().bank_cash += amount;
      if (it.category === "cars") { p().car_sku = null; p().car_mode = null; p().next_car_due = null; }
      if (it.category === "houses") { p().house_sku = null; p().next_rent_due = addDays(s.today, 30); }
      return ok({ cash: amount });
    },
    equipItem(itemId, on) {
      const it = s.items.find((i) => i.id === itemId);
      const slot = it && itemBySku(it.sku)?.wear?.slot;
      if (!it || !slot) return fail("You can't wear that. You could try, but no.");
      if (on) for (const o of s.items) if (o.id !== it.id && itemBySku(o.sku)?.wear?.slot === slot) o.equipped = false;
      it.equipped = on;
      return ok();
    },
    saveLook(itemIds) {
      const slots = itemIds.map((id) => itemBySku(s.items.find((i) => i.id === id)?.sku ?? "")?.wear?.slot);
      if (slots.some((x) => !x)) return fail("You can't wear that. You could try, but no.");
      if (new Set(slots).size !== slots.length) return fail("One top, one bottom, one pair of shoes. You're not a closet.");
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
    peek() {
      return { cash: p().bank_cash, clout: p().clout };
    },
    grantCollector(sku) {
      const item = itemBySku(sku);
      if (!item || s.items.some((i) => i.sku === sku)) return;
      s.items.push({ id: nextId++, sku, category: item.category, value: collectorValue(item.category), acquired: "collector", equipped: false });
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
