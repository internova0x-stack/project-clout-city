"use server";

import { previewOnly } from "./guard";
import { cleanHandle } from "@/lib/radio";
import { previewRadioState } from "./radioActions";
import type { Station, StationThread, StudioBigScreen, TvAction, TvFeature, TvMine, TvState, TvStatus } from "@/lib/cloutTv";

// Development previews only: Clout TV in memory, following the rules of migration 0058, shared by
// /preview/home (the Clout TV app, the home card, the Clout Tower's screen, the stations' texts) and
// /preview/studio (the Big Screen queue). Sample "photos" are drawn portraits. Refused in production.
// ?tv=new|sent|mine|empty sets where the preview starts ("mine": your photo is on the screen now; "empty":
// nobody up and nobody waiting, so the tower says "Make it BIG in NY").

interface Row { id: number; player: string; name: string; handle: string; photo: string; url: string; date: string; status: TvStatus; approvedAt: string | null; featuredAt: string | null; at: string }

const ME = "preview";
const CAP = 20;
const SLOT_H = 3;
const nyDay = (offset = 0) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date(Date.now() + offset * 86_400_000));
const ago = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
/** The start of the current 3-hour slot, New York (12, 3, 6, 9). */
function slotStart(): number {
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", hourCycle: "h23" }).format(new Date()));
  const now = new Date();
  now.setMinutes(0, 0, 0);
  return now.getTime() - (hour % SLOT_H) * 3_600_000;
}

/** A drawn portrait standing in for a player's photo: a backdrop, a figure, sunglasses. */
function portrait(bg: [string, string], skin: string, hair: string, top: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500"><defs><linearGradient id="b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${bg[0]}"/><stop offset="1" stop-color="${bg[1]}"/></linearGradient></defs>
<rect width="400" height="500" fill="url(#b)"/><circle cx="310" cy="96" r="56" fill="#FFF1C9" opacity=".55"/>
<path d="M60 500c10-100 66-148 140-148s130 48 140 148z" fill="${top}"/><rect x="176" y="292" width="48" height="50" rx="14" fill="${skin}"/>
<ellipse cx="200" cy="236" rx="74" ry="84" fill="${skin}"/><path d="M124 222c0-66 36-104 78-104s78 36 76 106c-14-38-42-56-78-56s-58 18-76 54z" fill="${hair}"/>
<rect x="140" y="226" width="50" height="26" rx="10" fill="#14111A"/><rect x="210" y="226" width="50" height="26" rx="10" fill="#14111A"/><rect x="188" y="234" width="24" height="5" fill="#14111A"/>
<path d="M176 286q24 16 48 0" stroke="#8B3A3A" stroke-width="5" fill="none" stroke-linecap="round"/></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}
const SAMPLES: [string, string, string][] = [
  ["p-nina", "nina.nyc", portrait(["#F2A07B", "#2E6F7E"], "#C68A62", "#2A1C14", "#F4F1EA")],
  ["p-kai", "kai_beats", portrait(["#7FE3F0", "#1E88B8"], "#8A5A3C", "#14111A", "#F2B705")],
  ["p-tasha", "tasha.b", portrait(["#FFD9A0", "#E0603D"], "#F1C9A8", "#C8352B", "#2E6F7E")],
  ["p-dee", "dee_rivera", portrait(["#A7DB9C", "#2E8B63"], "#B97A55", "#5B3A22", "#F2A07B")],
  ["p-dev", "dev.r", portrait(["#FFB27A", "#C8352B"], "#E2B48E", "#3A2A1C", "#1E3A44")],
];

let store: { day: string; rows: Row[]; next: number; preset: string } | null = null;
const uploads = new Map<string, string>();

function seed(preset: string) {
  const today = nyDay();
  const row = (i: number, status: TvStatus, featuredH: number | null, approvedH: number | null, dayOffset = 0): Row => ({
    id: i + 1, player: SAMPLES[i][0], name: SAMPLES[i][1], handle: SAMPLES[i][1], photo: `${SAMPLES[i][0]}/sample.jpg`, url: SAMPLES[i][2],
    date: nyDay(dayOffset), status, approvedAt: approvedH === null ? null : ago(approvedH), featuredAt: featuredH === null ? null : ago(featuredH), at: ago(30 + i),
  });
  // Two past features for the archive, one on the screen now (unless "new"), two waiting for review.
  const rows: Row[] = [
    row(1, "featured", 26, 30, -1),
    row(2, "featured", 7, 30, -1),
    preset === "new" || preset === "empty" ? row(0, "pending", null, null) : row(0, "featured", 0, 4),
    row(3, preset === "empty" ? "pending" : "approved", null, preset === "empty" ? null : 2),
    row(4, "pending", null, null),
  ];
  let next = 10;
  if (preset === "sent" || preset === "mine") {
    rows.push({ id: next++, player: ME, name: "bigsal", handle: "sal.from.queens", photo: `${ME}/sample.jpg`, url: portrait(["#FFB27A", "#2E6F7E"], "#9A6A48", "#14111A", "#C8352B"),
      date: today, status: preset === "mine" ? "featured" : "pending", approvedAt: preset === "mine" ? ago(1) : null, featuredAt: preset === "mine" ? ago(0.1) : null, at: ago(2) });
  }
  store = { day: today, rows, next, preset };
}

function get(preset?: string) {
  if (!store || store.day !== nyDay() || (preset !== undefined && preset !== store.preset)) seed(preset ?? store?.preset ?? "");
  return store!;
}

/** On the screen now: the latest to go up in this 3-hour slot (none: "Make it BIG in NY"). */
const current = (s: NonNullable<typeof store>) =>
  s.rows.filter((r) => r.status === "featured" && Date.parse(r.featuredAt!) >= slotStart() && r.featuredAt! <= new Date().toISOString())
    .sort((a, b) => b.featuredAt!.localeCompare(a.featuredAt!))[0];

/** The rotation: a new slot puts the next approved photo up. */
function sync(s: NonNullable<typeof store>) {
  const cur = current(s);
  if (!cur) {
    const nxt = s.rows.filter((r) => r.status === "approved").sort((a, b) => a.approvedAt!.localeCompare(b.approvedAt!))[0];
    if (nxt) { nxt.status = "featured"; nxt.featuredAt = new Date().toISOString(); }
  }
}

const feature = (r: Row): TvFeature => ({ id: r.id, handle: r.handle, photo: r.photo, url: r.url, at: r.featuredAt!, date: nyDayOf(r.featuredAt!) });
const nyDayOf = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date(iso));

export async function previewTvState(preset?: string) {
  previewOnly();
  const s = get(preset);
  sync(s);
  const cur = current(s);
  const data: TvState = {
    today: s.day,
    featured: cur ? feature(cur) : null,
    nextAt: new Date(slotStart() + SLOT_H * 3_600_000).toISOString(),
    archive: s.rows.filter((r) => r.status === "featured" && r !== cur).sort((a, b) => b.featuredAt!.localeCompare(a.featuredAt!)).map(feature),
    mine: s.rows.filter((r) => r.player === ME && r.status !== "withdrawn")
      .map((r): TvMine => ({ id: r.id, handle: r.handle, photo: r.photo, url: r.url, status: r.status, date: r.date, featuredAt: r.featuredAt, onNow: r === cur })),
    submittedToday: s.rows.some((r) => r.player === ME && r.date === s.day),
    left: Math.max(0, CAP - s.rows.filter((r) => r.date === s.day).length),
  };
  return { ok: true as const, data };
}

/** The preview's "upload": the cropped photo as a data URL, kept in memory. */
export async function previewTvUpload(dataUrl: string) {
  previewOnly();
  if (!dataUrl.startsWith("data:image/")) return { ok: false as const, error: "Photos only: JPEG, PNG or WebP." };
  const s = get();
  const path = `${ME}/${s.next++}.jpg`;
  uploads.set(path, dataUrl);
  return { ok: true as const, data: path };
}

export async function previewTvSubmit(path: string, handle: string, self: boolean, adult: boolean, publicOk: boolean) {
  previewOnly();
  const s = get();
  const fail = (error: string) => ({ ok: false as const, error });
  const h = cleanHandle(handle);
  if (!(self && adult && publicOk)) return fail("Confirm all three before you submit.");
  if (!h) return fail("Instagram handles are letters, numbers, dots and underscores, up to 30.");
  const url = uploads.get(path);
  if (!url) return fail("The photo didn't upload. Try picking it again.");
  if (s.rows.some((r) => r.player === ME && r.date === s.day)) return fail("You've submitted today's photo already. One a day.");
  if (s.rows.filter((r) => r.date === s.day).length >= CAP) return fail("Today's 20 photos are in. Try again tomorrow.");
  const id = s.next++;
  s.rows.push({ id, player: ME, name: "bigsal", handle: h, photo: path, url, date: s.day, status: "pending", approvedAt: null, featuredAt: null, at: new Date().toISOString() });
  return { ok: true as const, data: { id } };
}

export async function previewTvWithdraw(id: number) {
  previewOnly();
  const r = get().rows.find((x) => x.id === id && x.player === ME && ["pending", "approved", "featured"].includes(x.status));
  if (!r) return { ok: false as const, error: "That photo isn't yours to withdraw, or it's gone." };
  r.status = "withdrawn";
  return { ok: true as const, data: null };
}

// ---- Texts from the stations ----
const read = new Set<string>();
export async function previewStationInbox() {
  previewOnly();
  const s = get();
  sync(s);
  const threads: StationThread[] = [];
  const mineTv = s.rows.filter((r) => r.player === ME && r.featuredAt && r.status === "featured");
  if (mineTv.length) {
    threads.push({ station: "tv", unread: mineTv.filter((r) => !read.has(`tv:${r.id}`)).length,
      messages: mineTv.map((r) => ({ id: r.id, at: r.featuredAt!, body: "📺 You made it to the Big Screen! Your photo is up on the Clout Tower in Astoria for the next 3 hours. Now the whole city knows your name." })) });
  }
  const radio = await previewRadioState();
  const mine = radio.ok ? radio.data.mine : null;
  if (mine && (mine.status === "on_air" || mine.status === "wall")) {
    threads.push({ station: "fm", unread: read.has(`fm:${mine.id}`) ? 0 : 1, messages: [{ id: mine.id, at: mine.airedAt ?? new Date().toISOString(),
      body: mine.status === "on_air" ? `🎙️ You're on air! DJ Sharm Almight just read your shoutout on The Wake-Up Call: "${mine.message}"` : "📌 Your shoutout made today's wall on Real Clout FM. See it in the Radio app." }] });
  }
  return { ok: true as const, data: threads };
}
export async function previewStationRead(station: Station) {
  previewOnly();
  const s = get();
  if (station === "tv") for (const r of s.rows) if (r.player === ME) read.add(`tv:${r.id}`);
  const radio = await previewRadioState();
  if (station === "fm" && radio.ok && radio.data.mine) read.add(`fm:${radio.data.mine.id}`);
  return { ok: true as const, data: null };
}

// ---- Studio: the Big Screen queue ----
export async function previewStudioBigScreen(status: "pending" | "approved" | "featured" | "all") {
  previewOnly();
  const s = get();
  sync(s);
  const cur = current(s);
  const rows = s.rows.filter((r) => status === "all" || r.status === status)
    .sort((a, b) => Number(b === cur) - Number(a === cur) || (a.approvedAt ?? "~").localeCompare(b.approvedAt ?? "~") || (b.featuredAt ?? "").localeCompare(a.featuredAt ?? "") || a.at.localeCompare(b.at));
  const data: StudioBigScreen = {
    current: cur?.id ?? null,
    nextAt: new Date(slotStart() + SLOT_H * 3_600_000).toISOString(),
    cap: CAP,
    today: s.rows.filter((r) => r.date === s.day).length,
    items: rows.map((r) => ({
      id: r.id, handle: r.handle, photo: r.photo, url: r.url, status: r.status, at: r.at, approvedAt: r.approvedAt, featuredAt: r.featuredAt, onNow: r === cur,
      player: { id: r.player, name: r.name }, confirmed: { self: r.at, adult: r.at, public: r.at },
    })),
  };
  return { ok: true as const, data };
}

export async function previewStudioBigScreenAction(id: number, action: TvAction) {
  previewOnly();
  const s = get();
  const r = s.rows.find((x) => x.id === id);
  if (!r) return { ok: false as const, error: "That photo is gone." };
  const now = new Date().toISOString();
  if (action === "approve") {
    if (r.status !== "pending") return { ok: false as const, error: "That one was already reviewed." };
    r.status = "approved";
    r.approvedAt = now;
  } else if (action === "show_now") {
    if (!["pending", "approved", "featured"].includes(r.status)) return { ok: false as const, error: "That one was already reviewed." };
    r.approvedAt ??= now;
    r.status = "featured";
    r.featuredAt = now;
  } else if (action === "reject") {
    if (r.status !== "pending" && r.status !== "approved") return { ok: false as const, error: "That one was already reviewed." };
    r.status = "rejected";
  } else {
    if (r.status !== "featured") return { ok: false as const, error: "That one isn't featured." };
    r.status = "taken_down";
    const nxt = s.rows.filter((x) => x.status === "approved").sort((a, b) => a.approvedAt!.localeCompare(b.approvedAt!))[0];
    if (nxt) { nxt.status = "featured"; nxt.featuredAt = now; }
  }
  return { ok: true as const, data: null };
}
