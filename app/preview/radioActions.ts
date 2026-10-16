"use server";

import { previewOnly } from "./guard";
import { RADIO, cleanHandle, maskWords, type RadioState, type ShoutoutAction, type ShoutoutStatus, type StudioShoutoutDay } from "@/lib/radio";

// Development previews only: Real Clout FM in memory, following the rules of migration 0057, shared by
// /preview/home (the Radio app, the banner) and /preview/studio (the Shoutouts queue). Refused in
// production builds. ?radio=new|sent|full|notpicked|mine sets where the preview starts.

interface Row { id: number; player: string; name: string; handle: string; message: string; date: string; status: "pending" | "on_air" | "wall" | "rejected"; at: string; airedAt: string | null }

const CAP = 50;
const WALL_MAX = 5;
const WORDS = ["damn"];
const ME = "preview";
const nyDay = (offset = 0) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date(Date.now() + offset * 86_400_000));
const SAMPLES: [string, string, string][] = [
  ["p-nina", "nina.nyc", "Good morning Queens! First week in Astoria and I already have a favorite bodega cat."],
  ["p-kai", "kai_beats", "Shoutout to everyone grinding on the N train this morning. Coffee first, clout later."],
  ["p-tasha", "tasha.b", "Pilates at 6, brunch at 11, main character energy all day."],
  ["p-dev", "dev.r", "Respawn Arena high score is mine. Come take it."],
  ["p-dee", "dee_rivera", "Thrifted a whole outfit for C$12. Ask me how."],
  ["p-marco", "marco.m", "Midtown by day, Ditmars by night."],
];

let store: { day: string; rows: Row[]; next: number; preset: string } | null = null;

function seed(preset: string) {
  const today = nyDay();
  const rows: Row[] = SAMPLES.map(([player, handle, message], i) => ({
    id: i + 1, player, name: handle, handle, message, date: today, status: "pending", at: new Date(Date.now() - (60 - i * 7) * 60_000).toISOString(), airedAt: null,
  }));
  if (preset !== "new") {
    rows[0].status = "on_air";
    rows[0].airedAt = new Date(Date.now() - 60_000).toISOString();
    rows[1].status = "wall";
    rows[2].status = "wall";
  }
  let next = rows.length + 1;
  const mine = (date: string, status: Row["status"], message: string) =>
    rows.push({ id: next++, player: ME, name: "bigsal", handle: "bigsal", message, date, status, at: new Date().toISOString(), airedAt: status === "on_air" ? new Date().toISOString() : null });
  if (preset === "sent") mine(today, "pending", "Hi from the creator preview. Big things coming.");
  if (preset === "notpicked") mine(nyDay(-1), "pending", "Yesterday's try. Maybe today.");
  if (preset === "mine") {
    rows[0].status = "wall";
    rows[0].airedAt = null;
    mine(today, "on_air", "It's me, on the radio! Mom, I made it.");
  }
  if (preset === "full") {
    for (let i = rows.length; i < CAP; i++) rows.push({ id: next++, player: `p-x${i}`, name: `listener${i}`, handle: `listener${i}`, message: "Morning Queens!", date: today, status: "pending", at: new Date().toISOString(), airedAt: null });
  }
  store = { day: today, rows, next, preset };
}

function get(preset?: string) {
  if (!store || store.day !== nyDay() || (preset !== undefined && preset !== store.preset)) seed(preset ?? store?.preset ?? "");
  return store!;
}

const status = (r: Row, today: string): ShoutoutStatus => (r.status === "pending" && r.date < today ? "not_picked" : r.status);
const pub = (r: Row) => ({ id: r.id, handle: r.handle, message: r.message, date: r.date, airedAt: r.airedAt });

export async function previewRadioState(preset?: string) {
  previewOnly();
  const s = get(preset);
  const today = s.day;
  const air = s.rows.filter((r) => r.status === "on_air" && r.date <= today && r.airedAt && r.airedAt <= new Date().toISOString()).sort((a, b) => b.date.localeCompare(a.date))[0];
  const mine = s.rows.filter((r) => r.player === ME).sort((a, b) => b.date.localeCompare(a.date))[0];
  const airsAt = new Date(`${today}T09:00:00-04:00`).toISOString();
  const data: RadioState = {
    today,
    airsAt,
    onAir: air ? pub(air) : null,
    wall: air ? s.rows.filter((r) => r.date === air.date && r.status === "wall").map(pub) : [],
    mine: mine ? { ...pub(mine), status: status(mine, today) } : null,
    requestedToday: !!mine && mine.date === today,
    left: Math.max(0, CAP - s.rows.filter((r) => r.date === today).length),
    messageMax: RADIO.messageMax,
    words: WORDS,
  };
  return { ok: true as const, data };
}

export async function previewRadioRequest(handle: string, message: string, confirmed: boolean) {
  previewOnly();
  const s = get();
  const fail = (error: string) => ({ ok: false as const, error });
  const h = cleanHandle(handle);
  const msg = message.trim().replace(/\s+/g, " ");
  if (!confirmed) return fail("Confirm the handle is yours first.");
  if (!h) return fail("Handles are letters, numbers, dots and underscores, up to 30.");
  if (!msg || msg.length > RADIO.messageMax) return fail(`Say something, in ${RADIO.messageMax} characters or fewer.`);
  if (msg.includes("@")) return fail("Shoutouts can't tag or name anyone else. Keep it about you.");
  if (s.rows.some((r) => r.player === ME && r.date === s.day)) return fail("You've asked for today's shoutout already. One a day.");
  if (s.rows.filter((r) => r.date === s.day).length >= CAP) return fail("Today's list is full. Try again tomorrow.");
  const row: Row = { id: s.next++, player: ME, name: "bigsal", handle: h, message: maskWords(msg, WORDS), date: s.day, status: "pending", at: new Date().toISOString(), airedAt: null };
  s.rows.push(row);
  return { ok: true as const, data: { ...pub(row), status: "pending" as const } };
}

export async function previewRadioReport() {
  previewOnly();
  return { ok: true as const, data: null };
}

// ---- Studio: the Shoutouts queue ----
function day(date?: string): StudioShoutoutDay {
  const s = get();
  const d = date ?? s.day;
  return {
    date: d,
    airsAt: new Date(`${d}T09:00:00-04:00`).toISOString(),
    cap: CAP,
    wallMax: WALL_MAX,
    items: s.rows.filter((r) => r.date === d).map((r) => ({ id: r.id, handle: r.handle, message: r.message, status: status(r, s.day), at: r.at, airedAt: r.airedAt, player: { id: r.player, name: r.name } })),
  };
}

export async function previewStudioShoutouts(date?: string) {
  previewOnly();
  return { ok: true as const, data: day(date) };
}

export async function previewStudioShoutoutAction(id: number, action: ShoutoutAction) {
  previewOnly();
  const s = get();
  const r = s.rows.find((x) => x.id === id);
  if (!r) return { ok: false as const, error: "That shoutout is gone." };
  if (action !== "reject" && r.date < s.day) return { ok: false as const, error: "That day's show is over." };
  if (action === "air") {
    for (const o of s.rows) if (o.date === r.date && o.status === "on_air" && o !== r) { o.status = "pending"; o.airedAt = null; }
    r.status = "on_air";
    // The preview airs at once so you can see it (the real show waits for 9 a.m. New York).
    r.airedAt = new Date().toISOString();
  } else if (action === "wall") {
    if (r.status !== "wall" && s.rows.filter((o) => o.date === r.date && o.status === "wall").length >= WALL_MAX) return { ok: false as const, error: "The wall is full for that day." };
    r.status = "wall";
    r.airedAt = null;
  } else {
    r.status = action === "reject" ? "rejected" : "pending";
    r.airedAt = null;
  }
  return { ok: true as const, data: day(r.date) };
}
