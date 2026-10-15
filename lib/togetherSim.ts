// v0.13 Better Together in the preview (/preview/home): the same rules as migration 0050, in memory.
// Sample players answer on their own after a few seconds. ?together=invite|ride|plan|bonus|decorate|approve
// starts in that state.

import { placeById, visitClout } from "./city.ts";
import {
  JOBS, TOGETHER, canDoTogether, rideShare, togetherError,
  type JobHome, type JobsBoard, type MyJob, type OpenJob, type RideRequest, type RideStatus, type TogetherApi, type TogetherBonus,
  type TogetherInbox, type TogetherPlan, type WorkJob,
} from "./together.ts";

interface SimHooks {
  cash(): number;
  pay(cash: number, clout?: number): void;
  /** Moves the player by a shared ride: the sim's own travel, then half the fare back. */
  ride(place: string, mode: "subway" | "taxi"): Promise<{ ok: true; fare: number; seconds: number } | { ok: false; error: string }>;
  /** The player's home layout and furniture, for the decorator preview. */
  home(): { homeId: string; layout: unknown };
  saveHome(layout: unknown): void;
  hasBusiness(): boolean;
}

const SAMPLE: Record<string, { name: string; style: string }> = {
  "p-tasha": { name: "tasha.b", style: "pilates_princess" },
  "p-dev": { name: "dev.r", style: "arcade_nerd" },
  "p-nina": { name: "nina.nyc", style: "pilates_princess" },
  "p-kai": { name: "kai_beats", style: "bodega_drip" },
  "p-marco": { name: "Marco", style: "midtown_finance" },
  "p-dee": { name: "dee_rivera", style: "thrift_store_icon" },
  "p-kenji": { name: "Kenji", style: "startup_founder" },
};
const who = (id: string) => SAMPLE[id] ?? { name: "a friend", style: "bodega_drip" };
const iso = (msAgo = 0) => new Date(Date.now() - msAgo).toISOString();
const MIN = 60_000;

export function createTogetherSim(hooks: SimHooks, preset?: string): TogetherApi {
  let nextId = 100;
  let left: number = TOGETHER.perDay;
  const plans: (TogetherPlan & { theyDid: boolean })[] = [];
  const bonuses: TogetherBonus[] = [];
  const rides: RideRequest[] = [];
  const myRides = new Map<number, { status: RideStatus; at: number }>();
  const rating = { hired: 3, rating: 4.7, rated: 3 };
  const open: OpenJob[] = [
    { id: 1, kind: "decorator", pay: 2_500, cut: 0, note: "Make it look like I have taste. 30 minutes, go.", createdAt: iso(20 * MIN), poster: "p-nina", posterName: "nina.nyc", posterStyle: "pilates_princess", homeId: "lic_highrise", posterRating: { hired: 7, rating: 4.9, rated: 7 }, businesses: 0, perDay: null },
    { id: 2, kind: "manager", pay: 0, cut: 12, note: null, createdAt: iso(60 * MIN), poster: "p-dev", posterName: "dev.r", posterStyle: "arcade_nerd", homeId: "jackson_heights_1br", posterRating: { hired: 12, rating: 4.7, rated: 10 }, businesses: 4, perDay: 4_300 },
  ];
  const mine: MyJob[] = [];
  const working: WorkJob[] = [];
  let homeBefore: unknown = null;

  const plan = (id: string, place: string, action: string, status: TogetherPlan["status"], isMine: boolean, theyDid = false) => {
    const p = who(id);
    plans.push({ id: nextId++, place, action, status, mine: isMine, with: id, withName: p.name, withStyle: p.style, withHere: true, createdAt: iso(), theyDid });
  };
  if (preset === "invite") plan("p-tasha", "ditmars-library", "study", "pending", false);
  if (preset === "plan") plan("p-tasha", "ditmars-library", "study", "accepted", true, true);
  if (preset === "bonus") { left--; bonuses.push({ id: nextId++, place: "ditmars-library", action: "study", with: "p-tasha", withName: "tasha.b", clout: 5, cloutBase: 10, confidence: 3, confidenceBase: 5, paid: true, left }); }
  if (preset === "ride") rides.push({ id: nextId++, place: "discount-disco", mode: "taxi", each: 18, seconds: 21, from: "p-dev", fromName: "dev.r", fromStyle: "arcade_nerd", createdAt: iso() });
  if (preset === "decorate") {
    const j = open.shift()!;
    working.push({ id: j.id, kind: j.kind, pay: j.pay, cut: 0, note: j.note, status: "active", earned: 0, takenAt: iso(12 * MIN), moved: 0, endsAt: new Date(Date.now() + 18 * MIN).toISOString(), poster: j.poster, posterName: j.posterName, posterStyle: j.posterStyle });
  }
  if (preset === "approve") {
    mine.push({ id: nextId++, kind: "decorator", pay: 2_500, cut: 0, note: null, status: "done", stars: null, moved: 14, earned: 0, createdAt: iso(60 * MIN), takenAt: iso(40 * MIN), finishedAt: iso(14 * MIN), endsAt: iso(10 * MIN), keepBy: new Date(Date.now() + 24 * 60 * MIN).toISOString(), worker: "p-dev", workerName: "dev.r", workerStyle: "arcade_nerd", workerRating: { hired: 12, rating: 4.8, rated: 11 } });
  }

  const fail = (code: string) => ({ ok: false as const, error: togetherError(code) });
  const ok = <T,>(data: T) => ({ ok: true as const, data });
  const bonusFor = (place: string, action: string, withId: string): TogetherBonus => {
    const a = placeById(place)?.actions.find((x) => x.id === action);
    const cloutBase = a?.clout ?? visitClout(a?.price ?? 0, 60, 50);
    const confBase = a?.confidence ?? 0;
    const paid = left > 0;
    if (paid) left--;
    const b: TogetherBonus = { id: nextId++, place, action, with: withId, withName: who(withId).name, clout: paid ? Math.round(cloutBase * 0.5) : 0, cloutBase, confidence: paid ? Math.round(confBase * 0.5) : 0, confidenceBase: confBase, paid, left };
    if (paid) hooks.pay(0, b.clout);
    return b;
  };
  /** Sample players say yes and turn up a few seconds later. */
  const settleSamples = () => {
    for (const p of plans) if (p.mine && p.status === "pending" && Date.now() - new Date(p.createdAt).getTime() > 4000) { p.status = "accepted"; p.theyDid = true; }
  };
  const timer = (id: number, ms: number) => {
    const j = mine.find((x) => x.id === id);
    if (j) setTimeout(() => { if (j.status === "open") { const w = who("p-dev"); Object.assign(j, { status: "active", worker: "p-dev", workerName: w.name, workerStyle: w.style, workerRating: rating, takenAt: iso(), endsAt: new Date(Date.now() + JOBS.decorator.minutes * MIN).toISOString() }); } }, ms);
  };

  return {
    async inbox() {
      settleSamples();
      const data: TogetherInbox = {
        left, canInvite: true,
        plans: plans.filter((p) => p.status === "pending" || p.status === "accepted").map(({ theyDid: _t, ...p }) => p),
        bonuses: structuredClone(bonuses), rides: structuredClone(rides),
      };
      return ok(data);
    },
    async invite(to, place, action) {
      const pl = placeById(place);
      if (!canDoTogether(pl, action)) return fail("not_together");
      if (plans.some((p) => p.mine && p.with === to && p.place === place && p.action === action)) return fail("already_invited");
      plan(to, place, action, "pending", true);
      return ok({ id: nextId - 1 });
    },
    async respond(id, yes) {
      const p = plans.find((x) => x.id === id && !x.mine);
      if (!p) return fail("unknown_invite");
      p.status = yes ? "accepted" : ("declined" as TogetherPlan["status"]);
      if (yes) p.theyDid = true;
      return ok({ status: p.status });
    },
    async claim(id) {
      settleSamples();
      const p = plans.find((x) => x.id === id);
      if (!p) return fail("unknown_invite");
      if (p.status !== "accepted") return fail("not_accepted");
      if (!p.theyDid) return fail("not_yet");
      p.status = "done" as TogetherPlan["status"];
      return ok(bonusFor(p.place, p.action, p.with));
    },
    async seen(id) {
      const i = bonuses.findIndex((b) => b.id === id);
      if (i >= 0) bonuses.splice(i, 1);
      return ok(null);
    },
    async rideOffer(to, place, mode) {
      const id = nextId++;
      myRides.set(id, { status: { id, status: "pending", place, mode, cash: 0, seconds: 0, arrivesAt: null }, at: Date.now() });
      void to;
      return ok({ id, fare: 0, each: 0 });
    },
    async rideRespond(id, yes) {
      const i = rides.findIndex((r) => r.id === id);
      if (i < 0) return fail("unknown_ride");
      const r = rides.splice(i, 1)[0];
      if (!yes) return ok({ id, status: "declined", place: r.place, mode: r.mode, cash: 0, seconds: 0, arrivesAt: null });
      const m = await hooks.ride(r.place, r.mode);
      if (!m.ok) return { ok: false, error: m.error };
      return ok({ id, status: "accepted", place: r.place, mode: r.mode, cash: -rideShare(m.fare), seconds: m.seconds, arrivesAt: new Date(Date.now() + m.seconds * 1000).toISOString() });
    },
    async rideStatus(id) {
      const r = myRides.get(id);
      if (!r) return ok(null);
      // The sample rider accepts after three seconds.
      if (r.status.status === "pending" && Date.now() - r.at > 3000) {
        const m = await hooks.ride(r.status.place, r.status.mode);
        if (!m.ok) return { ok: false, error: m.error };
        r.status = { ...r.status, status: "accepted", cash: -rideShare(m.fare), seconds: m.seconds, arrivesAt: new Date(Date.now() + m.seconds * 1000).toISOString() };
      }
      return ok(structuredClone(r.status));
    },
    jobs: {
      async board() {
        // Decorators finish at their deadline on their own.
        for (const j of working) if (j.status === "active" && j.endsAt && new Date(j.endsAt).getTime() < Date.now()) j.status = "done";
        const data: JobsBoard = { canWork: true, open: structuredClone(open), mine: structuredClone(mine), working: structuredClone(working), rating };
        return ok(data);
      },
      async post(kind, pay, cut, note) {
        if (mine.some((j) => j.kind === kind && ["open", "active", "done"].includes(j.status))) return fail("already_posted");
        if (kind === "decorator") {
          if (pay < JOBS.decorator.payMin || pay > JOBS.decorator.payMax) return fail("bad_pay");
          if (hooks.cash() < pay) return fail("cant_afford");
          hooks.pay(-pay);
        } else if (!hooks.hasBusiness()) return fail("no_business");
        const id = nextId++;
        mine.unshift({ id, kind, pay, cut, note: note || null, status: "open", stars: null, moved: 0, earned: 0, createdAt: iso(), takenAt: null, finishedAt: null, endsAt: null, keepBy: null, worker: null, workerName: null, workerStyle: null, workerRating: null });
        if (kind === "decorator") timer(id, 5000);
        return ok({ id, cash: -pay });
      },
      async cancel(id) {
        const j = mine.find((x) => x.id === id && x.status === "open");
        if (!j) return fail("job_taken");
        j.status = "cancelled";
        hooks.pay(j.pay);
        mine.splice(mine.indexOf(j), 1);
        return ok({ cash: j.pay });
      },
      async take(id) {
        const i = open.findIndex((x) => x.id === id);
        if (i < 0) return fail("job_taken");
        if (working.some((w) => w.kind === open[i].kind && w.status === "active")) return fail("already_working");
        const j = open.splice(i, 1)[0];
        working.unshift({ id: j.id, kind: j.kind, pay: j.pay, cut: j.cut, note: j.note, status: "active", earned: 0, takenAt: iso(), moved: 0,
          endsAt: j.kind === "decorator" ? new Date(Date.now() + JOBS.decorator.minutes * MIN).toISOString() : null, poster: j.poster, posterName: j.posterName, posterStyle: j.posterStyle });
        return ok({ id, kind: j.kind });
      },
      async home(id) {
        const j = working.find((x) => x.id === id && x.status === "active" && x.kind === "decorator");
        if (!j) return fail("job_over");
        // The preview decorates a sample high-rise (the player's own furniture stands in for theirs).
        const h = hooks.home();
        homeBefore ??= h.layout;
        const data: JobHome = { id, pay: j.pay, poster: j.poster, posterName: j.posterName, homeId: "lic_highrise", houseSku: null, layout: h.layout, items: [], endsAt: j.endsAt! };
        return ok(data);
      },
      async save(id, layout) {
        const j = working.find((x) => x.id === id && x.status === "active");
        if (!j) return fail("job_over");
        j.moved = Array.isArray(layout) ? layout.length : 0;
        return ok({ moved: j.moved });
      },
      async finish(id) {
        const j = working.find((x) => x.id === id && x.status === "active");
        if (!j) return fail("job_over");
        j.status = "done";
        // The sample client approves a few seconds later.
        setTimeout(() => { j.status = "kept"; hooks.pay(j.pay, JOBS.decorator.clout); }, 4000);
        return ok({ status: "done" });
      },
      async settle(id, keep, stars) {
        const j = mine.find((x) => x.id === id && x.status === "done");
        if (!j) return fail("not_done");
        j.status = keep ? "kept" : "undone";
        j.stars = stars;
        if (!keep) { hooks.pay(j.pay); if (homeBefore) hooks.saveHome(homeBefore); }
        return ok({ status: j.status, cash: keep ? 0 : j.pay });
      },
      async rate(id, stars) {
        const j = mine.find((x) => x.id === id);
        if (j) j.stars = stars;
        return ok(null);
      },
      async collect(id) {
        const j = working.find((x) => x.id === id && x.status === "active" && x.kind === "manager");
        if (!j) return fail("job_over");
        const cash = j.earned ? 0 : 516;
        j.earned += cash;
        if (cash) hooks.pay(cash);
        return ok({ collected: Math.round(cash / (j.cut / 100)), cash });
      },
      async end(id) {
        const j = mine.find((x) => x.id === id) ?? working.find((x) => x.id === id);
        if (!j || j.status !== "active") return fail("unknown_job");
        j.status = "ended";
        return ok({ status: "ended" });
      },
    },
  };
}
