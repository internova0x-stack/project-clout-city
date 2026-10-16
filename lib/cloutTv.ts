// v0.14 Clout TV (migration 0058): "Make it to the big screen". Players submit a photo of themselves
// with their Instagram handle; the owner features one a day on the Clout Tower's big screen, a home
// card and the Clout TV app's archive. The rules live in SQL (tv_submit, tv_state); photos sit in a
// private storage bucket until featured. This file is the shapes, the copy and the photo prep.

export const TV = {
  station: "Clout TV",
  bucket: "big-screen",
  /**
   * The billboard's frame (owner, Oct 16: "a widget to crop the image to the frame of the billboard"):
   * 4:5 portrait, the Clout Tower's screen and Instagram's portrait size. Every photo is cropped to it on
   * the phone and uploaded at exactly this size (which also drops its location data).
   */
  frame: { w: 1080, h: 1350 },
  maxZoom: 4,
  quality: 0.86,
  maxBytes: 5 * 1024 * 1024,
} as const;

/** A photo that has been on the screen, as players see it. `url` is a short-lived link to the private file. */
export interface TvFeature { id: number; handle: string; photo: string; url: string | null; at: string; date: string }
export type TvStatus = "pending" | "approved" | "featured" | "rejected" | "withdrawn" | "taken_down";
export interface TvMine { id: number; handle: string; photo: string; url: string | null; status: TvStatus; date: string; featuredAt: string | null; onNow: boolean }

export interface TvState {
  today: string;
  /** Who's on the big screen now (null before the first photo goes up). */
  featured: TvFeature | null;
  /** When the next 3-hour slot starts (the next approved photo goes up). */
  nextAt: string;
  archive: TvFeature[];
  mine: TvMine[];
  submittedToday: boolean;
  /** Places left on today's list (20 a day). */
  left: number;
}

export type TvResult<T> = { ok: true; data: T } | { ok: false; error: string };

export interface TvApi {
  state(): Promise<TvResult<TvState>>;
  /** Puts the prepared photo in the player's folder; returns its path. Browser-side in the game. */
  upload?(photo: Blob): Promise<TvResult<string>>;
  submit(path: string, handle: string, self: boolean, adult: boolean, publicOk: boolean): Promise<TvResult<{ id: number }>>;
  withdraw(id: number): Promise<TvResult<null>>;
}

/** One row of the Studio's Big Screen queue (admin_big_screen). */
export interface StudioTvSubmission {
  id: number;
  handle: string;
  photo: string;
  url: string | null;
  status: TvStatus;
  at: string;
  approvedAt: string | null;
  featuredAt: string | null;
  onNow: boolean;
  player: { id: string; name: string };
  confirmed: { self: string; adult: string; public: string };
}
export interface StudioBigScreen { current: number | null; nextAt: string; cap: number; today: number; items: StudioTvSubmission[] }
export type TvAction = "approve" | "show_now" | "reject" | "take_down";

/** Texts from the stations in the Messages app (station_inbox). */
export type Station = "fm" | "tv";
export const STATIONS: Record<Station, { name: string; emoji: string }> = {
  fm: { name: "Real Clout FM", emoji: "📻" },
  tv: { name: "Clout TV", emoji: "📺" },
};
export interface StationThread { station: Station; unread: number; messages: { id: number; body: string; at: string }[] }
export interface StationApi {
  inbox(): Promise<TvResult<StationThread[]>>;
  read(station: Station): Promise<TvResult<null>>;
}

export function tvError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("confirm_all")) return "Confirm all three before you submit.";
  if (m.includes("bad_handle")) return "Instagram handles are letters, numbers, dots and underscores, up to 30.";
  if (m.includes("no_photo")) return "The photo didn't upload. Try picking it again.";
  if (m.includes("already_submitted")) return "You've submitted today's photo already. One a day.";
  if (m.includes("list_full")) return "Today's 20 photos are in. Try again tomorrow.";
  if (m.includes("not_allowed")) return "Your account can't submit photos right now.";
  if (m.includes("unknown_submission")) return "That photo isn't yours to withdraw, or it's gone.";
  if (m.includes("not_pending")) return "That one was already reviewed.";
  if (m.includes("not_featured")) return "That one isn't featured.";
  if (m.includes("not_admin")) return "This account isn't a story admin.";
  if (m.includes("payload too large") || m.includes("exceeded the maximum")) return "That photo is too big. Pick a smaller one.";
  if (m.includes("mime") || m.includes("invalid_mime")) return "Photos only: JPEG, PNG or WebP.";
  if (m.includes("function") && m.includes("does not exist")) return "Run migration 0058 to switch on Clout TV.";
  if (m.includes("encode")) return "That photo didn't crop. Try another.";
  return "Clout TV lost the signal for a second. Try again.";
}

/** Where a photo sits in the frame: its top-left corner and its scale, in frame pixels. */
export interface Crop { x: number; y: number; scale: number }

/** The smallest scale that still covers the whole frame. */
export const coverScale = (iw: number, ih: number, fw: number, fh: number) => Math.max(fw / iw, fh / ih);

/** A crop centred and covering the frame. */
export function centerCrop(iw: number, ih: number, fw: number, fh: number): Crop {
  const scale = coverScale(iw, ih, fw, fh);
  return { x: (fw - iw * scale) / 2, y: (fh - ih * scale) / 2, scale };
}

/** Keeps the photo covering the frame: zoom between cover and maxZoom, no gaps at the edges. */
export function clampCrop(c: Crop, iw: number, ih: number, fw: number, fh: number): Crop {
  const min = coverScale(iw, ih, fw, fh);
  const scale = Math.min(min * TV.maxZoom, Math.max(min, c.scale));
  const x = Math.min(0, Math.max(fw - iw * scale, c.x));
  const y = Math.min(0, Math.max(fh - ih * scale, c.y));
  return { x, y, scale };
}

/** Zooms around a point of the frame (the pinch's or the slider's centre), keeping that point still. */
export function zoomCrop(c: Crop, scale: number, cx: number, cy: number): Crop {
  const k = scale / c.scale;
  return { x: cx - (cx - c.x) * k, y: cy - (cy - c.y) * k, scale };
}

/** "3:00 PM" in the player's own time. */
export const tvTime = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

/** "Fri, Oct 16" for a New York date. */
export const tvDay = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

/** The home card shows once per feature per device. */
export const tvCardSeenKey = (id: number) => `cc-tv-card-${id}`;
