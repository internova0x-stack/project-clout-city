"use server";

import { previewOnly } from "./guard";

import type { RecentItem } from "@/lib/recent";
import type { ChatMessage, ChatResult, ChatStatus, ChatSummary, ChatThread, PlayerCard, ReportReason } from "@/lib/chat";
import type { StudioMetrics, StudioReport } from "@/lib/studio";
import type { Insights } from "@/lib/insights";
import { previewCrushStatus, previewDatingBlock } from "./datingActions";
import { previewChatUnlimited, previewVip } from "./storyActions";
import { DAILY_LIMIT } from "@/lib/chat";
import { REACTIONS, type PlaceCounts, type Presence } from "@/lib/meet";
import { PLACES } from "@/lib/city";
import { STARTING_STYLES } from "@/lib/styles";

// Development previews only: chat, the report queue and metrics in memory, following
// the rules of supabase/migrations/0010. Refused in production builds.

const ME = "preview";
const PEOPLE: Record<string, { name: string; style: string; clout: number; homeId: string }> = {
  "p-tasha": { name: "tasha.b", style: "pilates_princess", clout: 2140, homeId: "lic_highrise" },
  "p-marco": { name: "Marco", style: "midtown_finance", clout: 1720, homeId: "jackson_heights_1br" },
  "p-dee": { name: "dee_rivera", style: "thrift_store_icon", clout: 1310, homeId: "astoria_studio" },
  "p-kenji": { name: "Kenji", style: "startup_founder", clout: 990, homeId: "lic_highrise" },
  "p-dev": { name: "dev.r", style: "arcade_nerd", clout: 1880, homeId: "jackson_heights_1br" },
  "p-kai": { name: "kai_beats", style: "bodega_drip", clout: 760, homeId: "astoria_studio" },
  "p-nina": { name: "nina.nyc", style: "pilates_princess", clout: 3020, homeId: "lic_highrise" },
};
/** Meeting players: who the preview puts at each place (the same few, turned by the place's name). */
const HERE_IDS = ["p-tasha", "p-dev", "p-kai", "p-nina", "p-marco", "p-dee"];
const hereAt = (placeId: string) => {
  if (crowd.n) return ["p-tasha", "p-dev", ...crowdPeople(crowd.n - 2)];
  const n = placeId.length % 4 + 2;
  return Array.from({ length: n }, (_, i) => HERE_IDS[(placeId.length + i) % HERE_IDS.length]);
};
const where = { place: null as string | null };
/** Crowded places: ?crowd=50 puts that many sample players at whatever place you walk into. */
const crowd = { n: 0 };
const FIRST = ["mia", "jay", "luz", "theo", "ari", "zoe", "rico", "bea", "nico", "ivy", "omar", "gia", "leo", "sky", "remy", "nia", "max", "tess", "kofi", "lina"];
const LAST = [".nyc", "_queens", ".exe", "_astoria", ".jpg", "_lic", "xo", ".fm", "_daily", "2k"];
function crowdPeople(n: number) {
  for (let i = 0; i < n; i++) {
    const id = `p-c${String(i).padStart(2, "0")}`;
    if (!PEOPLE[id]) PEOPLE[id] = { name: FIRST[i % FIRST.length] + LAST[(i * 7) % LAST.length], style: STARTING_STYLES[(i * 3) % STARTING_STYLES.length].id, clout: 200 + ((i * 7919) % 4800), homeId: "astoria_studio" };
  }
  return Array.from({ length: n }, (_, i) => `p-c${String(i).padStart(2, "0")}`);
}
const WORDS = ["fuck", "shit", "bitch"];
const LIMIT = 20;
let nextId = 100;
const t = (minAgo: number) => new Date(Date.now() - minAgo * 60_000).toISOString();
const state = {
  messages: [
    { id: 1, from: "p-tasha", to: ME, body: "ok who told the barista my name is Tash-ah", at: t(95) },
    { id: 2, from: ME, to: "p-tasha", body: "not me. probably the cat at the deli", at: t(90) },
    { id: 3, from: "p-tasha", to: ME, body: "pull up to Low Light tonight?? Jada Sol is playing the album", at: t(12) },
    { id: 4, from: "p-tasha", to: ME, body: "I'm on the list btw 💅", at: t(11) },
    { id: 5, from: "p-marco", to: ME, body: "Your bodega drip is a crime against fashion", at: t(60 * 26) },
  ] as { id: number; from: string; to: string; body: string; at: string; hidden?: boolean; reaction?: boolean }[],
  messagesFrom: "anyone" as "anyone" | "crew",
  read: { "p-tasha": t(91), "p-marco": t(0) } as Record<string, string>,
  blocks: new Set<string>(),
  reports: [] as StudioReport[],
  muted: new Set<string>(),
};
const ok = <T,>(data: T): ChatResult<T> => (process.env.NODE_ENV === "production" ? { ok: false, error: "Previews are off in production." } : { ok: true, data });
const filter = (s: string) => WORDS.reduce((acc, w) => acc.replace(new RegExp(`\\b${w}\\b`, "gi"), "•".repeat(w.length)), s);
const sentToday = () => state.messages.filter((m) => m.from === ME && !m.reaction && new Date(m.at).toDateString() === new Date().toDateString()).length;

export async function previewChatList() {
  previewOnly();
  const ids = [...new Set(state.messages.flatMap((m) => [m.from, m.to]).filter((x) => x !== ME))];
  const rows: ChatSummary[] = ids.map((id) => {
    const msgs = state.messages.filter((m) => (m.from === id || m.to === id) && !m.hidden);
    const last = msgs.at(-1)!;
    const blocked = state.blocks.has(id);
    return {
      with: id, name: PEOPLE[id].name, style: PEOPLE[id].style, blocked, last: blocked ? null : last.body, lastMine: last.from === ME,
      at: last.at, unread: blocked ? 0 : msgs.filter((m) => m.from === id && m.at > (state.read[id] ?? "")).length,
    };
  });
  return ok(rows.sort((a, b) => b.at.localeCompare(a.at)));
}
export async function previewChatThread(id: string) {
  previewOnly();
  state.read[id] = new Date().toISOString();
  const blocked = state.blocks.has(id);
  const messages: ChatMessage[] = blocked ? [] : state.messages
    .filter((m) => (m.from === id || m.to === id) && !m.hidden)
    .map((m) => ({ id: m.id, mine: m.from === ME, body: m.body, at: m.at, kind: m.reaction ? "reaction" as const : "text" as const }));
  return ok<ChatThread>({ with: id, blocked, blockedMe: false, messages });
}
export async function previewChatStatus() {
  previewOnly();
  return ok<ChatStatus>({ limit: LIMIT, left: Math.max(0, LIMIT - sentToday()), mutedUntil: null, warned: false, banned: false,
    unlimited: await previewChatUnlimited(), vip: await previewVip(), messagesFrom: state.messagesFrom });
}
export async function previewChatSend(to: string, body: string): Promise<ChatResult<{ left: number | null }>> {
  previewOnly();
  if (!PEOPLE[to]) return { ok: false, error: "That player isn't around anymore." };
  if (state.blocks.has(to)) return { ok: false, error: "You can't message this person." };
  if (!body.trim()) return { ok: false, error: "Say something first." };
  const unlimited = await previewChatUnlimited();
  if (!unlimited && sentToday() >= LIMIT) return { ok: false, error: DAILY_LIMIT };
  state.messages.push({ id: nextId++, from: ME, to, body: filter(body.trim()), at: new Date().toISOString() });
  return ok({ left: unlimited ? null : LIMIT - sentToday() });
}
export async function previewChatBlock(id: string, on: boolean) {
  previewOnly();
  if (on) {
    state.blocks.add(id);
    await previewDatingBlock(id);
  } else state.blocks.delete(id);
  return ok(null);
}
export async function previewChatReport(id: string, messageId: number | null, reason: ReportReason, note: string) {
  previewOnly();
  const msgs = state.messages.filter((m) => m.from === id || m.to === id).slice(-50);
  state.reports.unshift({
    id: nextId++, reason, note: note.trim() || null, status: "open", at: new Date().toISOString(), reviewedAt: null, messageId,
    reporter: { id: ME, name: "You (preview)" },
    reported: { id, name: PEOPLE[id]?.name ?? id, warned: false, mutedUntil: null, banned: false, reports: state.reports.filter((r) => r.reported.id === id).length + 1 },
    messages: msgs.map((m) => ({ id: m.id, from: m.from === ME ? "You (preview)" : PEOPLE[m.from].name, body: m.body, at: m.at, reported: m.id === messageId })),
  });
  return ok(null);
}
/** Sample "Recently" rows (migration 0020's shape); the day in each ref doesn't matter here. */
const recentFor = (seed: number): RecentItem[] => [
  { kind: "event" as const, ref: "neon-nights:d", at: t(120 + seed * 7) },
  { kind: "hunt" as const, ref: "auntie-vee", at: t(60 * 26 + seed), theme: "Auntie Vee's Storage Unit" },
  { kind: "purchase" as const, ref: "fit-satin-bomber", at: t(60 * 50 + seed) },
  { kind: "visit" as const, ref: "hell-gate-park:d", at: t(60 * 70 + seed) },
].slice(seed % 2);
/** The preview home's own player (app/preview/[screen]/page.tsx). */
const PREVIEW_PLAYER = "00000000-0000-0000-0000-000000000000";
export async function previewPlayerCard(id: string) {
  previewOnly();
  if (id === PREVIEW_PLAYER) {
    return ok<PlayerCard | null>({ id, name: "bigsal", style: "arcade_nerd", clout: 850, homeId: "astoria_studio", badges: 3, joined: t(60 * 24 * 3), blocked: false, isMe: true, rank: 128, recent: recentFor(0), netWorth: 5505 });
  }
  const p = PEOPLE[id];
  const crush = p ? await previewCrushStatus(id) : null;
  const rank = Object.values(PEOPLE).filter((o) => o.clout > (p?.clout ?? 0)).length + 1;
  const herePlace = where.place && hereAt(where.place).includes(id) ? where.place : null;
  return ok<PlayerCard | null>(p ? { id, name: p.name, style: p.style, clout: p.clout, homeId: p.homeId, badges: 2, joined: t(60 * 24 * 20), blocked: state.blocks.has(id), isMe: false, crush: crush?.ok ? crush.data : null, rank, recent: recentFor(p.clout), netWorth: 3000 + p.clout * 4,
    herePlace, canMessage: !state.blocks.has(id), crew: id === "p-tasha" } : null);
}
// ---- Meeting players (migration 0047) in memory: a few sample players at every place ----
/** ?chat=out starts the day with every message used, to show the unlimited chat offer. */
export async function previewCrowdPreset(n: number) {
  previewOnly();
  crowd.n = Math.max(0, Math.min(200, Math.floor(n)));
}
export async function previewChatPreset(preset: string) {
  previewOnly();
  if (preset !== "out") return;
  const at = new Date().toISOString();
  for (let i = state.messages.filter((m) => m.from === ME).length; sentToday() < LIMIT; i++) state.messages.push({ id: nextId++, from: ME, to: "p-tasha", body: `msg ${i}`, at });
}
export async function previewPresence(placeId: string, floor: number) {
  previewOnly();
  where.place = placeId;
  const club = !!PLACES.find((p) => p.id === placeId)?.club;
  const people = hereAt(placeId).filter((id) => !state.blocks.has(id)).map((id, i) => ({
    id, name: PEOPLE[id].name, style: PEOPLE[id].style, look: null, crew: id === "p-tasha",
    // At a club a few are on the other floors (the restroom, VIP).
    floor: club && (crowd.n ? i % 9 === 4 : i === 1 && floor === 1) ? (floor === 1 ? 0 : 1) : club && crowd.n && i % 9 === 7 ? (floor === 2 ? 1 : 2) : floor, clout: PEOPLE[id].clout,
    // v0.12: a few rich ones, so the list shows the money ranks too.
    netWorth: 3000 + PEOPLE[id].clout * 4 + (i % 11 === 3 ? 12_000_000 : i % 7 === 5 ? 1_400_000 : 0),
  }));
  // The server lists at most 40 (game_settings chat.hereMax) and gives the true count.
  return ok<Presence>({ count: people.length, people: people.slice(0, 40) });
}
export async function previewPlaceCounts() {
  previewOnly();
  const out: PlaceCounts = {};
  for (const p of PLACES.filter((x) => !x.story).slice(0, 12)) {
    const ids = hereAt(p.id);
    out[p.id] = { count: ids.length, names: ids.slice(0, 3).map((id) => ({ name: PEOPLE[id].name, style: PEOPLE[id].style })) };
  }
  return ok(out);
}
export async function previewChatReact(to: string, emoji: string) {
  previewOnly();
  if (!PEOPLE[to]) return { ok: false as const, error: "That player isn't around anymore." };
  if (!(REACTIONS as readonly string[]).includes(emoji)) return { ok: false as const, error: "That reaction isn't on the menu." };
  const last = [...state.messages].reverse().find((m) => m.from === ME && m.to === to && m.reaction);
  if (last && Date.now() - Date.parse(last.at) < 3 * 60_000) return { ok: false as const, error: "You just reacted. Give it a few minutes." };
  const m = { id: nextId++, from: ME, to, body: emoji, at: new Date().toISOString(), reaction: true };
  state.messages.push(m);
  return ok({ id: m.id, mine: true, body: emoji, at: m.at, kind: "reaction" as const });
}
export async function previewSetMessagesFrom(who: "anyone" | "crew") {
  previewOnly();
  state.messagesFrom = who;
  return ok(who);
}
/** The leaderboard with ids, so rows open player cards. */
export async function previewLeaderboard(myClout: number) {
  previewOnly();
  const rows = [...Object.entries(PEOPLE).map(([id, p]) => ({ id, display_name: p.name, starting_style: p.style, clout: p.clout, is_me: false })),
    { id: ME, display_name: "bigsal", starting_style: "arcade_nerd", clout: myClout, is_me: true }]
    .sort((a, b) => b.clout - a.clout);
  return rows.map((r, i) => ({ ...r, rank: i + 1 }));
}

// ---- Studio: the review queue and metrics, over the same in-memory chat ----
export async function previewStudioReports(status: string) {
  previewOnly();
  if (!state.reports.length) {
    // One sample report so the queue isn't empty on first look.
    await previewChatReport("p-marco", 5, "harassment", "Rude about my outfit. Twice.");
  }
  return ok(state.reports.filter((r) => status === "all" || r.status === status));
}
export async function previewStudioReportAction(id: number, action: "dismiss" | "warn" | "mute" | "ban") {
  previewOnly();
  const r = state.reports.find((x) => x.id === id);
  if (!r) return { ok: false as const, error: "That report is gone." };
  r.status = action === "dismiss" ? "dismissed" : action === "warn" ? "warned" : action === "mute" ? "muted" : "banned";
  r.reviewedAt = new Date().toISOString();
  if (action === "warn") r.reported.warned = true;
  if (action === "mute") r.reported.mutedUntil = new Date(Date.now() + 7 * 86_400_000).toISOString();
  if (action === "ban") r.reported.banned = true;
  return ok(null);
}
export async function previewStudioMetrics() {
  previewOnly();
  return ok<StudioMetrics>({
    players: 1284, newThisWeek: 212, firstTask: 1019, invited: 488, invitesJoined: 351, day1Cohort: 1180, day1Returned: 472,
    activeToday: 403, beatOpens: 6210, readers: 790, votes: 1544, voters: 702,
    purchases: { side_arc: { count: 61, cents: 18239 }, exclusive_event: { count: 44, cents: 18756 }, postcard: { count: 93, cents: 9207 }, collector_item: { count: 12, cents: 5388 } },
    refunds: 3, messagesToday: state.messages.length + 2310, openReports: state.reports.filter((r) => r.status === "open").length,
  });
}

/** Sample Insights for /preview/studio: a small, growing launch (a fixed shape, so screenshots don't jump). */
export async function previewStudioInsights(days: number) {
  previewOnly();
  const n = Math.min(90, Math.max(7, days));
  const today = new Date();
  const wave = (i: number) => 1 + 0.18 * Math.sin(i / 2.2) + (i % 7 === 5 || i % 7 === 6 ? 0.22 : 0);
  const daily = Array.from({ length: n }, (_, k) => {
    const i = k + (90 - n);
    const d = new Date(today.getTime() - (n - 1 - k) * 86_400_000).toISOString().slice(0, 10);
    const grow = 0.35 + (0.65 * i) / 89;
    return {
      date: d,
      signups: Math.round(28 * grow * wave(i)),
      active: Math.round(410 * grow * wave(i)),
      revenueCents: Math.round(((i * 37) % 11) * 499 * grow + (i % 9 === 0 ? 11999 : 0)),
      avgSessionSeconds: Math.round(430 + 90 * Math.sin(i / 3.1) + i * 1.5),
    };
  });
  const sum = (f: (d: (typeof daily)[number]) => number, last = n) => daily.slice(-last).reduce((a, d) => a + f(d), 0);
  const active = daily.at(-1)!.active;
  const week = (w: number) => new Date(today.getTime() - (w * 7 + today.getUTCDay()) * 86_400_000).toISOString().slice(0, 10);
  return ok<Insights>({
    days: n,
    today: daily.at(-1)!.date,
    totals: {
      players: 2140, accounts: 2391,
      signupsToday: daily.at(-1)!.signups, signups7: sum((d) => d.signups, 7), signupsPeriod: sum((d) => d.signups),
      activeToday: active, active7: 1212, active30: 1688, activePeriod: n >= 30 ? 1688 + (n > 30 ? 214 : 0) : 1212,
      revenueCents: 1_184_330, revenuePeriodCents: sum((d) => d.revenueCents), revenue7Cents: sum((d) => d.revenueCents, 7),
      payers: 96, vipMembers: 41, chatForever: 9, refunds: 2,
      sessionsPeriod: Math.round(sum((d) => d.active) * 1.9), avgSessionSeconds: 512, medianSessionSeconds: 344,
      sessionsPerActiveDay: 1.9, minutesPerActiveDay: 16.2,
    },
    daily,
    retention: { d1: { cohort: 2088, returned: 793 }, d7: { cohort: 1874, returned: 356 }, d30: { cohort: 1302, returned: 143 } },
    cohorts: [0, 1, 2, 3, 4, 5, 6, 7].map((w) => {
      const size = 140 + w * 9;
      return {
        week: week(w), size,
        d1: Math.round(size * (0.36 + w * 0.006)), d1Eligible: w === 0 ? size - 22 : size,
        d7: w >= 1 ? Math.round(size * (0.17 + w * 0.004)) : 0, d7Eligible: w >= 1 ? size : 0,
        d30: w >= 5 ? Math.round(size * 0.11) : 0, d30Eligible: w >= 5 ? size : 0,
      };
    }),
    funnel: [
      { step: "Signed up", n: 2391 }, { step: "Made a character", n: 2140 }, { step: "Moved into a home", n: 1987 },
      { step: "Went to the first party", n: 1702 }, { step: "Came back the next day", n: 793 }, { step: "Made a purchase", n: 96 },
    ],
    features: [
      { feature: "Visited a place", players: 1640 }, { feature: "Finished a daily task", players: 1311 }, { feature: "Read a story beat", players: 1102 },
      { feature: "Sent a chat message", players: 688 }, { feature: "Found gossip", players: 742 }, { feature: "Played a treasure hunt", players: 405 },
      { feature: "Went to a club event", players: 913 }, { feature: "Went on a crew outing", players: 287 }, { feature: "Bought a lotto card", players: 820 },
      { feature: "Owns a business", players: 233 }, { feature: "Earned a together bonus", players: 371 }, { feature: "Took a job", players: 118 },
    ].map((f) => ({ ...f, players: Math.round((f.players * (n >= 30 ? 1 : 0.72)) * (n > 30 ? 1.08 : 1)) })),
    spending: [
      { type: "chat_pass", count: 74, cents: 528_160, buyers: 50 }, { type: "side_arc", count: 118, cents: 352_820, buyers: 61 },
      { type: "exclusive_event", count: 52, cents: 207_480, buyers: 33 }, { type: "collector_item", count: 31, cents: 77_190, buyers: 22 },
      { type: "postcard", count: 37, cents: 18_680, buyers: 19 },
    ],
    topProducts: [
      { sku: "chat-unlimited-monthly", name: "VIP (monthly)", count: 58, cents: 289_420 },
      { sku: "chat-unlimited-forever", name: "Unlimited chat (forever)", count: 9, cents: 107_991 },
      { sku: "side_rooftop", name: "Side story: Rooftop Season", count: 44, cents: 131_560 },
      { sku: "event_gala", name: "Exclusive: Harbor Gala", count: 27, cents: 107_730 },
      { sku: "chat-unlimited-yearly", name: "VIP (yearly)", count: 3, cents: 11_997 },
    ],
    ranks: [
      { level: 1, players: 812 }, { level: 2, players: 531 }, { level: 3, players: 344 }, { level: 4, players: 205 }, { level: 5, players: 118 },
      { level: 6, players: 64 }, { level: 7, players: 39 }, { level: 8, players: 17 }, { level: 9, players: 8 }, { level: 10, players: 2 },
    ],
    economy: { medianCash: 4180, medianClout: 640 },
  });
}

// ---------------------------------------------------------------------------
// Studio Players (migration 0055): sample players for /preview/studio. Bans last until the server restarts.
// ---------------------------------------------------------------------------
const PREVIEW_BANS = new Map<string, string | null>();
const SAMPLE_PLAYERS = [
  { id: "p1", name: "bigmich", email: "mich@example.com", style: "bodega_drip", days: 3, seenMin: 4, clout: 335, cash: 1433, worth: 6820, rank: 2, spend: 499, vip: true, reports: 0, moved: true },
  { id: "p2", name: "Celine", email: "celine@example.com", style: "influencer_soft_glam", days: 3, seenMin: 9, clout: 378, cash: 3051, worth: 3051, rank: 2, spend: 0, vip: false, reports: 0, moved: true },
  { id: "p3", name: "tasha.b", email: "tasha@example.com", style: "pilates_princess", days: 12, seenMin: 70, clout: 2140, cash: 11500, worth: 48200, rank: 5, spend: 1297, vip: true, reports: 0, moved: true },
  { id: "p4", name: "jay.fm", email: "jay@example.com", style: "arcade_nerd", days: 8, seenMin: 300, clout: 3319, cash: 900, worth: 22100, rank: 5, spend: 0, vip: false, reports: 2, moved: true },
  { id: "p5", name: "dev.r", email: "dev@example.com", style: "startup_founder", days: 1, seenMin: 1500, clout: 40, cash: 7200, worth: 7200, rank: 1, spend: 0, vip: false, reports: 0, moved: false },
  { id: "p6", name: "mia.nyc", email: "mia@example.com", style: "thrift_store_icon", days: 20, seenMin: 4000, clout: 200, cash: 2400, worth: 5100, rank: 1, spend: 299, vip: false, reports: 0, moved: true },
] as const;

export async function previewStudioPlayers(query: string, filter: string, sort: string, offset: number) {
  previewOnly();
  const now = Date.now();
  let rows = SAMPLE_PLAYERS.map((p) => ({
    id: p.id, name: p.name, email: p.email, style: p.style, joinedAt: new Date(now - p.days * 86_400_000).toISOString(),
    lastSeen: new Date(now - p.seenMin * 60_000).toISOString(), clout: p.clout, cash: p.cash, netWorth: p.worth, rank: p.rank,
    spendCents: p.spend, vip: p.vip, banned: PREVIEW_BANS.has(p.id), openReports: p.reports, movedIn: p.moved,
  }));
  const q = query.toLowerCase();
  if (q) rows = rows.filter((r) => r.name.toLowerCase().includes(q) || r.email.includes(q));
  rows = rows.filter((r) => filter === "new" ? now - Date.parse(r.joinedAt) < 7 * 86_400_000 : filter === "active" ? now - Date.parse(r.lastSeen) < 86_400_000
    : filter === "paying" ? r.spendCents > 0 : filter === "vip" ? r.vip : filter === "banned" ? r.banned : filter === "reported" ? r.openReports > 0
    : filter === "no_home" ? !r.movedIn : true);
  const key = (r: (typeof rows)[number]) => sort === "clout" ? r.clout : sort === "worth" ? r.netWorth : sort === "spend" ? r.spendCents : sort === "seen" ? Date.parse(r.lastSeen) : Date.parse(r.joinedAt);
  rows.sort((a, b) => key(b) - key(a));
  return ok({ total: rows.length, rows: rows.slice(offset, offset + 50) });
}

export async function previewStudioPlayer(id: string) {
  previewOnly();
  const p = SAMPLE_PLAYERS.find((x) => x.id === id) ?? SAMPLE_PLAYERS[0];
  const now = Date.now();
  const ago = (min: number) => new Date(now - min * 60_000).toISOString();
  const banned = PREVIEW_BANS.has(p.id);
  return ok({
    profile: {
      id: p.id, name: p.name, email: p.email, style: p.style, look: {}, traits: ["loud", "hustler"],
      homeId: p.moved ? "jackson_heights_1br" : null, houseSku: null, carSku: null, carMode: null, atPlace: "grind-gossip-cafe",
      birthCash: 7400, joinedAt: ago(p.days * 1440), movedInAt: p.moved ? ago(p.days * 1440 - 6) : null, firstPartyAt: p.moved ? ago(p.days * 1440 - 20) : null,
      lastSeen: ago(p.seenMin), inviteCode: "QK7M2P", invitedBy: p.id === "p2" ? { id: "p1", name: "bigmich" } : null, invitedCount: p.id === "p1" ? 1 : 0,
      crewSize: p.id === "p1" || p.id === "p2" ? 1 : 0, rank: p.rank, vip: p.vip, vipSince: p.vip ? ago(2 * 1440) : null, chatForever: false,
      banned, bannedAt: banned ? ago(1) : null, banReason: PREVIEW_BANS.get(p.id) ?? null, mutedUntil: null, warnedAt: null, admin: false,
    },
    numbers: {
      clout: p.clout, cash: p.cash, netWorth: p.worth, energy: 64, mood: 71, confidence: 48, spendCents: p.spend, purchases: p.spend ? 1 : 0,
      sessions: 9, secondsPlayed: 9 * 512, daysActive: Math.min(p.days, 3), messagesSent: 23, businesses: p.worth > 20000 ? 2 : 0, placesVisited: 11,
    },
    sessions: [{ startedAt: ago(p.seenMin + 14), seconds: 840 }, { startedAt: ago(p.seenMin + 300), seconds: 420 }, { startedAt: ago(1500), seconds: 1260 }],
    safety: {
      reportsAgainst: p.reports ? [{ id: 11, reason: "spam", status: "open", at: ago(180), by: "mia.nyc" }, { id: 9, reason: "harassment", status: "dismissed", at: ago(2000), by: "dev.r" }] : [],
      reportsMade: 0, blocked: 0, blockedBy: p.reports ? 1 : 0,
      actions: banned ? [{ action: "ban" as const, reason: PREVIEW_BANS.get(p.id) ?? null, at: ago(1), by: "you" }] : [],
    },
    timeline: [
      ...(banned ? [{ type: "ban" as const, ref: PREVIEW_BANS.get(p.id) ?? null, at: ago(1) }] : []),
      { type: "ledger" as const, kind: "together", ref: "hellgate-hall:dance", cash: 0, clout: 8, at: ago(p.seenMin + 2) },
      { type: "ledger" as const, kind: "event_entry", ref: "bass-bath:2026-10-15", cash: -160, clout: 0, at: ago(p.seenMin + 5) },
      { type: "ledger" as const, kind: "drink", ref: "hellgate-hall:2026-10-15:1", cash: -60, clout: 0, at: ago(p.seenMin + 8) },
      { type: "ledger" as const, kind: "travel", ref: "taxi:hellgate-hall:1", cash: -18, clout: 0, at: ago(p.seenMin + 12) },
      { type: "ledger" as const, kind: "visit", ref: "grind-gossip-cafe:2026-10-15", cash: 0, clout: 12, at: ago(p.seenMin + 30) },
      { type: "ledger" as const, kind: "daily_task", ref: "2026-10-15:3", cash: 40, clout: 0, at: ago(p.seenMin + 34) },
      ...(p.spend ? [{ type: "purchase" as const, ref: "chat-unlimited-monthly", name: "VIP (monthly)", status: "paid", cents: 499, at: ago(2 * 1440) }] : []),
      { type: "ledger" as const, kind: "rent", ref: "2026-10-12", cash: -2600, clout: 0, at: ago(3 * 1440 - 30) },
      ...(p.moved ? [{ type: "moved_in" as const, ref: "jackson_heights_1br", at: ago(p.days * 1440 - 6) }] : []),
      { type: "ledger" as const, kind: "birth_lottery", ref: "", cash: 7400, clout: 0, at: ago(p.days * 1440 - 2) },
      { type: "joined" as const, at: ago(p.days * 1440) },
    ],
  });
}

export async function previewStudioPlayerBan(id: string, ban: boolean, reason: string) {
  previewOnly();
  if (ban) PREVIEW_BANS.set(id, reason || null); else PREVIEW_BANS.delete(id);
  return ok({ banned: ban });
}

/** Skills (migration 0056): sample top skills on preview player cards. */
export async function previewSkillsOf(playerId: string) {
  previewOnly();
  const sets: { id: "dance" | "charisma" | "hustle" | "fitness" | "gossip"; level: number }[][] = [
    [{ id: "dance", level: 6 }, { id: "charisma", level: 4 }, { id: "gossip", level: 2 }],
    [{ id: "hustle", level: 7 }, { id: "fitness", level: 3 }],
    [{ id: "charisma", level: 5 }],
  ];
  return ok(sets[playerId.length % sets.length]);
}
