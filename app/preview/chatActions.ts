"use server";

import type { RecentItem } from "@/lib/recent";
import type { ChatMessage, ChatResult, ChatStatus, ChatSummary, ChatThread, PlayerCard, ReportReason } from "@/lib/chat";
import type { StudioMetrics, StudioReport } from "@/lib/studio";
import { previewCrushStatus, previewDatingBlock } from "./datingActions";

// Development previews only: chat, the report queue and metrics in memory, following
// the rules of supabase/migrations/0010. Refused in production builds.

const ME = "preview";
const PEOPLE: Record<string, { name: string; style: string; clout: number; homeId: string }> = {
  "p-tasha": { name: "tasha.b", style: "pilates_princess", clout: 2140, homeId: "lic_highrise" },
  "p-marco": { name: "Marco", style: "midtown_finance", clout: 1720, homeId: "jackson_heights_1br" },
  "p-dee": { name: "dee_rivera", style: "thrift_store_icon", clout: 1310, homeId: "astoria_studio" },
  "p-kenji": { name: "Kenji", style: "startup_founder", clout: 990, homeId: "lic_highrise" },
};
const WORDS = ["fuck", "shit", "bitch"];
const LIMIT = 10;
let nextId = 100;
const t = (minAgo: number) => new Date(Date.now() - minAgo * 60_000).toISOString();
const state = {
  messages: [
    { id: 1, from: "p-tasha", to: ME, body: "ok who told the barista my name is Tash-ah", at: t(95) },
    { id: 2, from: ME, to: "p-tasha", body: "not me. probably the cat at the deli", at: t(90) },
    { id: 3, from: "p-tasha", to: ME, body: "pull up to Low Light tonight?? Jada Sol is playing the album", at: t(12) },
    { id: 4, from: "p-tasha", to: ME, body: "I'm on the list btw 💅", at: t(11) },
    { id: 5, from: "p-marco", to: ME, body: "Your bodega drip is a crime against fashion", at: t(60 * 26) },
  ] as { id: number; from: string; to: string; body: string; at: string; hidden?: boolean }[],
  read: { "p-tasha": t(91), "p-marco": t(0) } as Record<string, string>,
  blocks: new Set<string>(),
  reports: [] as StudioReport[],
  muted: new Set<string>(),
};
const ok = <T,>(data: T): ChatResult<T> => (process.env.NODE_ENV === "production" ? { ok: false, error: "Previews are off in production." } : { ok: true, data });
const filter = (s: string) => WORDS.reduce((acc, w) => acc.replace(new RegExp(`\\b${w}\\b`, "gi"), "•".repeat(w.length)), s);
const sentToday = () => state.messages.filter((m) => m.from === ME && new Date(m.at).toDateString() === new Date().toDateString()).length;

export async function previewChatList() {
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
  state.read[id] = new Date().toISOString();
  const blocked = state.blocks.has(id);
  const messages: ChatMessage[] = blocked ? [] : state.messages
    .filter((m) => (m.from === id || m.to === id) && !m.hidden)
    .map((m) => ({ id: m.id, mine: m.from === ME, body: m.body, at: m.at }));
  return ok<ChatThread>({ with: id, blocked, blockedMe: false, messages });
}
export async function previewChatStatus() {
  return ok<ChatStatus>({ limit: LIMIT, left: Math.max(0, LIMIT - sentToday()), mutedUntil: null, warned: false, banned: false });
}
export async function previewChatSend(to: string, body: string): Promise<ChatResult<{ left: number }>> {
  if (!PEOPLE[to]) return { ok: false, error: "That player isn't around anymore." };
  if (state.blocks.has(to)) return { ok: false, error: "You can't message this person." };
  if (!body.trim()) return { ok: false, error: "Say something first." };
  if (sentToday() >= LIMIT) return { ok: false, error: "That's your 10 for today. Back tomorrow." };
  state.messages.push({ id: nextId++, from: ME, to, body: filter(body.trim()), at: new Date().toISOString() });
  return ok({ left: LIMIT - sentToday() });
}
export async function previewChatBlock(id: string, on: boolean) {
  if (on) {
    state.blocks.add(id);
    await previewDatingBlock(id);
  } else state.blocks.delete(id);
  return ok(null);
}
export async function previewChatReport(id: string, messageId: number | null, reason: ReportReason, note: string) {
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
  if (id === PREVIEW_PLAYER) {
    return ok<PlayerCard | null>({ id, name: "bigsal", style: "arcade_nerd", clout: 850, homeId: "astoria_studio", badges: 3, joined: t(60 * 24 * 3), blocked: false, isMe: true, rank: 128, recent: recentFor(0), netWorth: 5505 });
  }
  const p = PEOPLE[id];
  const crush = p ? await previewCrushStatus(id) : null;
  const rank = Object.values(PEOPLE).filter((o) => o.clout > (p?.clout ?? 0)).length + 1;
  return ok<PlayerCard | null>(p ? { id, name: p.name, style: p.style, clout: p.clout, homeId: p.homeId, badges: 2, joined: t(60 * 24 * 20), blocked: state.blocks.has(id), isMe: false, crush: crush?.ok ? crush.data : null, rank, recent: recentFor(p.clout), netWorth: 3000 + p.clout * 4 } : null);
}
/** The leaderboard with ids, so rows open player cards. */
export async function previewLeaderboard(myClout: number) {
  const rows = [...Object.entries(PEOPLE).map(([id, p]) => ({ id, display_name: p.name, starting_style: p.style, clout: p.clout, is_me: false })),
    { id: ME, display_name: "bigsal", starting_style: "arcade_nerd", clout: myClout, is_me: true }]
    .sort((a, b) => b.clout - a.clout);
  return rows.map((r, i) => ({ ...r, rank: i + 1 }));
}

// ---- Studio: the review queue and metrics, over the same in-memory chat ----
export async function previewStudioReports(status: string) {
  if (!state.reports.length) {
    // One sample report so the queue isn't empty on first look.
    await previewChatReport("p-marco", 5, "harassment", "Rude about my outfit. Twice.");
  }
  return ok(state.reports.filter((r) => status === "all" || r.status === status));
}
export async function previewStudioReportAction(id: number, action: "dismiss" | "warn" | "mute" | "ban") {
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
  return ok<StudioMetrics>({
    players: 1284, newThisWeek: 212, firstTask: 1019, invited: 488, invitesJoined: 351, day1Cohort: 1180, day1Returned: 472,
    activeToday: 403, beatOpens: 6210, readers: 790, votes: 1544, voters: 702,
    purchases: { side_arc: { count: 61, cents: 18239 }, exclusive_event: { count: 44, cents: 18756 }, postcard: { count: 93, cents: 9207 }, collector_item: { count: 12, cents: 5388 } },
    refunds: 3, messagesToday: state.messages.length + 2310, openReports: state.reports.filter((r) => r.status === "open").length,
  });
}
