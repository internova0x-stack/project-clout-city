"use server";

import { previewOnly } from "./guard";
import { HOLD_DAYS, commissionOn, normalizeCreatorCode, type Affiliates, type AffiliatesOverview, type Creator, type CreatorInput, type CreatorLink, type CreatorMe, type CreatorPage, type DayPoint, type PayoutMethod, type PayoutsAdmin, type VideoInput, type VideosAdmin, type CreatorVideo, type LinkInput } from "@/lib/creators";
import type { Admin } from "@/lib/studio";

// The Studio preview's Affiliates tab (migration 0087) on in-memory sample creators. Every name is invented.

const day = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
const link = (id: number, slug: string, label: string, lands: CreatorLink["lands"], clicks: number, signups: number, extra: Partial<CreatorLink> = {}): CreatorLink =>
  ({ id, slug, label, lands, campaign: null, videoUrl: null, status: "active", createdAt: day(40 - id), clicks, signups, ...extra });

let nextLink = 20;
const CREATORS: Creator[] = [
  {
    id: "c1", name: "Tasha Glow", handle: "@tashaglow", email: "tasha@example.com", code: "TASHA", rate: 30, months: null, giftCash: 500, giftItem: "fit-bucket-hat",
    status: "active", termsAt: "2026-10-01", note: "Lifetime deal: two videos a month.", createdAt: day(30), clicks: 0, signups: 0, byCode: 0, signupsAll: 0,
    links: [
      link(1, "tasha", "Main link", "home", 412, 58),
      link(2, "tasha-tiktok", "TikTok bio", "signup", 1840, 231, { campaign: "Launch week" }),
      link(3, "tasha-halloween", "Halloween video", "news", 966, 97, { campaign: "Halloween", videoUrl: "https://example.com/video/halloween" }),
    ],
  },
  {
    id: "c2", name: "Dev Okafor", handle: "@devdoesqueens", email: "dev@example.com", code: "DEVQ", rate: 20, months: 24, giftCash: 500, giftItem: null,
    status: "active", termsAt: "2026-10-09", note: null, createdAt: day(12), clicks: 0, signups: 0, byCode: 0, signupsAll: 0,
    links: [link(4, "devq", "Main link", "home", 288, 31), link(5, "devq-shop-haul", "Shop haul video", "shop", 140, 9, { status: "retired" })],
  },
  {
    id: "c3", name: "Marisol Reyes", handle: "@marisolsays", email: null, code: "MARI", rate: 20, months: 12, giftCash: 250, giftItem: "fit-varsity-tee",
    status: "paused", termsAt: null, note: "Paused while their channel is on break.", createdAt: day(25), clicks: 0, signups: 0, byCode: 0, signupsAll: 0,
    links: [link(6, "mari", "Main link", "signup", 95, 6)],
  },
];
const BY_CODE: Record<string, number> = { c1: 22, c2: 7, c3: 1 };
/** Sample economics per creator: share of sign-ups who pay, average spend per payer (cents), refund rate. */
const MONEY: Record<string, { payRate: number; arpu: number; refunds: number }> = {
  c1: { payRate: 0.11, arpu: 1240, refunds: 3.1 }, c2: { payRate: 0.08, arpu: 980, refunds: 24.5 }, c3: { payRate: 0.05, arpu: 700, refunds: 0 },
  none: { payRate: 0, arpu: 0, refunds: 0 },
};
const PLAYERS = ["sky.rivera", "jun_queens", "mo.bodega", "lena_astoria", "k.pierre", "rae.lic", "dante_q", "noor.nyc", "ty_hustles", "bex.boro", "ivy_on_7", "milo.subway"];
const PRODUCTS = [
  { sku: "chat-unlimited-monthly", name: "VIP monthly", price: 499 }, { sku: "chat-unlimited-yearly", name: "VIP yearly", price: 3999 },
  { sku: "side_sarah_bird_momager_files", name: "The Momager Files", price: 299 }, { sku: "postcard-unisphere", name: "Unisphere postcard", price: 199 },
  { sku: "chat-unlimited-forever", name: "Chat forever", price: 11999 },
];

/** Days for the chart: a gentle wave, so the preview looks lived-in. */
function series(days: number, base: { clicks: number; signups: number; revenue: number; rate: number }): DayPoint[] {
  const span = days === 0 ? 60 : days;
  return Array.from({ length: span }, (_, i) => {
    const d = new Date(Date.now() - (span - 1 - i) * 86_400_000);
    const w = 0.55 + 0.45 * Math.sin(i / 3.1) ** 2 + (i % 7 === 5 ? 0.35 : 0);
    const revenueCents = Math.round(base.revenue * w * (i > span - 4 ? 1.4 : 1));
    return { date: d.toISOString().slice(0, 10), clicks: Math.round(base.clicks * w), signups: Math.round(base.signups * w), revenueCents, commissionCents: Math.round(revenueCents * 0.93 * base.rate / 100) };
  });
}

function view(days: number): Affiliates {
  const scale = days === 0 ? 1.6 : days === 7 ? 0.25 : days === 90 ? 1.3 : 1;
  const creators = CREATORS.map((c) => {
    const links = c.links.map((l) => ({ ...l, clicks: Math.round(l.clicks * scale), signups: Math.round(l.signups * scale) }));
    const byCode = Math.round(BY_CODE[c.id] * scale);
    const signups = links.reduce((t, l) => t + l.signups, 0) + byCode;
    const m = MONEY[c.id] ?? MONEY.none;
    const payers = Math.round(signups * m.payRate);
    const revenueCents = Math.round(payers * m.arpu);
    const net = Math.round(revenueCents * 0.93);
    const periodCents = Math.round((net * c.rate) / 100);
    return {
      ...c, byCode, clicks: links.reduce((t, l) => t + l.clicks, 0), signups, signupsAll: Math.round(signups * 1.6 / scale),
      links: links.map((l) => ({ ...l, payers: Math.round(l.signups * m.payRate), revenueCents: Math.round(l.signups * m.payRate * m.arpu) })),
      payers, revenueCents, refundRate: m.refunds,
      owed: { periodCents, periodNetCents: net, heldCents: Math.round(periodCents * 0.55), payableCents: Math.round(periodCents * 0.3), paidCents: Math.round(periodCents * 0.4) },
    };
  });
  return { days, creators };
}

export async function previewStudioAffiliates(days: number): Promise<Admin<Affiliates>> {
  previewOnly();
  return { ok: true, data: view(days) };
}

export async function previewStudioCreatorSave(input: CreatorInput): Promise<Admin<string>> {
  previewOnly();
  const code = normalizeCreatorCode(input.code);
  if (!code) return { ok: false, error: "Codes are 3 to 16 letters and numbers." };
  if (CREATORS.some((c) => c.code === code && c.id !== input.id)) return { ok: false, error: "Another creator already has that code." };
  const fields = { name: input.name.trim(), handle: input.handle || null, email: input.email || null, code, rate: input.rate, months: input.months,
    giftCash: input.giftCash, giftItem: input.giftItem, status: input.status, termsAt: input.termsAt || null, note: input.note || null };
  const old = CREATORS.find((c) => c.id === input.id);
  if (old) { Object.assign(old, fields); return { ok: true, data: old.id }; }
  const id = `c${CREATORS.length + 1}`;
  CREATORS.push({ id, ...fields, createdAt: new Date().toISOString(), clicks: 0, signups: 0, byCode: 0, signupsAll: 0, links: [link(nextLink++, code.toLowerCase(), "Main link", "home", 0, 0)] });
  BY_CODE[id] = 0;
  return { ok: true, data: id };
}

export async function previewStudioLinkSave(input: LinkInput): Promise<Admin<number>> {
  previewOnly();
  const c = CREATORS.find((x) => x.id === input.creatorId);
  if (!c) return { ok: false, error: "That creator is gone." };
  if (CREATORS.some((x) => x.links.some((l) => l.slug === input.slug))) return { ok: false, error: "That link is taken. Links are never deleted, so pick another." };
  const id = nextLink++;
  c.links.push({ ...link(id, input.slug, input.label, input.lands, 0, 0), campaign: input.campaign || null, videoUrl: input.videoUrl || null, createdAt: new Date().toISOString() });
  return { ok: true, data: id };
}

export async function previewStudioLinkStatus(id: number, status: "active" | "retired"): Promise<Admin<null>> {
  previewOnly();
  const l = CREATORS.flatMap((c) => c.links).find((x) => x.id === id);
  if (!l) return { ok: false, error: "That link is gone." };
  l.status = status;
  return { ok: true, data: null };
}

export async function previewStudioAffiliatesOverview(days: number): Promise<Admin<AffiliatesOverview>> {
  previewOnly();
  const v = view(days);
  const sum = (f: (c: Creator) => number) => v.creators.reduce((t, c) => t + f(c), 0);
  const commission = sum((c) => c.owed?.periodCents ?? 0), net = sum((c) => c.owed?.periodNetCents ?? 0);
  const daily = series(days, { clicks: sum((c) => c.clicks) / Math.max(1, days || 60), signups: sum((c) => c.signups) / Math.max(1, days || 60), revenue: sum((c) => c.revenueCents ?? 0) / Math.max(1, days || 60), rate: 25 });
  return { ok: true, data: {
    days, today: new Date().toISOString().slice(0, 10),
    totals: { clicks: sum((c) => c.clicks), signups: sum((c) => c.signups), payers: sum((c) => c.payers ?? 0), revenueCents: sum((c) => c.revenueCents ?? 0), netCents: net,
      commissionCents: commission, heldCents: sum((c) => c.owed?.heldCents ?? 0), payableCents: sum((c) => c.owed?.payableCents ?? 0), paidCents: sum((c) => c.owed?.paidCents ?? 0) },
    daily,
    topCreators: [...v.creators].sort((a, b) => (b.revenueCents ?? 0) - (a.revenueCents ?? 0)).map((c) => ({ id: c.id, name: c.name, signups: c.signups, revenueCents: c.revenueCents ?? 0 })),
    topLinks: v.creators.flatMap((c) => c.links.map((l) => ({ id: l.id, slug: l.slug, creator: c.name, clicks: l.clicks, signups: l.signups }))).sort((a, b) => b.signups - a.signups).slice(0, 5),
  } };
}

export async function previewStudioCreatorPage(id: string, days: number): Promise<Admin<CreatorPage>> {
  previewOnly();
  const c = view(days).creators.find((x) => x.id === id);
  if (!c) return { ok: false, error: "That creator is gone." };
  const span = days || 60;
  const daily = series(days, { clicks: c.clicks / span, signups: c.signups / span, revenue: (c.revenueCents ?? 0) / span, rate: c.rate });
  const today = new Date();
  const ago = (n: number) => new Date(today.getTime() - n * 86_400_000).toISOString();
  const dayOf = (n: number) => ago(n).slice(0, 10);
  const commissions: CreatorPage["commissions"] = PLAYERS.slice(0, 9).map((player, i) => {
    const p = PRODUCTS[i % PRODUCTS.length];
    const fee = Math.round(p.price * 0.029) + 30, tax = i % 3 === 0 ? Math.round(p.price * 0.08) : 0;
    const { net, commission } = commissionOn(p.price, fee, tax, c.rate);
    const at = i * 9 + 2;
    return { id: 100 + i, kind: p.sku === "chat-unlimited-monthly" && i > 2 ? "renewal" : "sale", sku: p.sku, name: p.name, player, at: ago(at), grossCents: p.price, feeCents: fee, taxCents: tax,
      netCents: net, feeEstimated: i === 6, rate: c.rate, commissionCents: commission, payableOn: dayOf(at - HOLD_DAYS),
      state: at < HOLD_DAYS ? "held" : at < 60 ? "payable" : "paid" };
  });
  const refunded = commissions[1];
  commissions.splice(0, 0, { ...refunded, id: 99, kind: "reversal", at: ago(1), grossCents: -refunded.grossCents, feeCents: 0, taxCents: 0, netCents: -refunded.netCents, commissionCents: -refunded.commissionCents, feeEstimated: false });
  const players: CreatorPage["players"] = PLAYERS.map((name, i) => ({
    id: `pp${i}`, name, joinedAt: ago(i * 4 + 1), how: i % 4 === 3 ? "code" : "link", link: i % 4 === 3 ? null : c.links[i % c.links.length]?.slug ?? null,
    spendCents: i < 9 ? PRODUCTS[i % PRODUCTS.length].price : 0, commissionCents: i < 9 ? commissions[i + 1].commissionCents : 0,
    lastSeen: i % 5 === 4 ? ago(12) : ago(i % 3), until: c.months ? new Date(today.getTime() + (c.months * 30 - i * 4) * 86_400_000).toISOString() : null,
  }));
  return { ok: true, data: {
    days, today: dayOf(0),
    creator: { id: c.id, name: c.name, handle: c.handle, code: c.code, rate: c.rate, months: c.months, status: c.status },
    owed: c.owed!,
    funnel: { clicks: c.clicks, signups: c.signups, movedIn: Math.round(c.signups * 0.82), payers: c.payers ?? 0, vip: Math.round((c.payers ?? 0) * 0.45) },
    daily,
    products: PRODUCTS.map((p, i) => ({ sku: p.sku, name: p.name, type: null, count: [41, 9, 18, 26, 2][i], revenueCents: p.price * [41, 9, 18, 26, 2][i] })).sort((a, b) => b.revenueCents - a.revenueCents),
    retention: { d1: { cohort: 380, returned: 171 }, d7: { cohort: 310, returned: 84 }, d30: { cohort: 120, returned: 22 } },
    commissions, players,
  } };
}

/** The creator page (/creator) as Tasha sees it, for /preview/affiliate (?state=new|paused). */
export async function previewCreatorMe(state?: string): Promise<CreatorMe> {
  previewOnly();
  const c = view(0).creators[0];
  const fresh = state === "new";
  const owed = fresh ? { heldCents: 0, payableCents: 0, paidCents: 0, periodCents: 0, periodNetCents: 0 } : c.owed!;
  const daily = series(30, { clicks: fresh ? 0 : 60, signups: fresh ? 0 : 8, revenue: fresh ? 0 : 1500, rate: c.rate });
  const months = Array.from({ length: 3 }, (_, i) => { const d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - i); return d.toISOString().slice(0, 10); });
  const next = new Date(); next.setUTCDate(1); next.setUTCMonth(next.getUTCMonth() + 1);
  return {
    name: c.name, handle: c.handle, code: c.code, rate: c.rate, months: c.months, status: state === "paused" ? "paused" : "active",
    termsAt: c.termsAt, giftCash: c.giftCash, giftItem: c.giftItem, owed, nextPayout: next.toISOString().slice(0, 10),
    totals: fresh ? { clicks: 0, signups: 0, payers: 0, earnedCents: 0 } : { clicks: c.clicks, signups: c.signups, payers: c.payers ?? 0, earnedCents: owed.heldCents + owed.payableCents + owed.paidCents },
    links: c.links.map((l) => ({ slug: l.slug, label: l.label, lands: l.lands, status: l.status, clicks: fresh ? 0 : l.clicks, signups: fresh ? 0 : l.signups,
      payers: fresh ? 0 : l.payers ?? 0, earnedCents: fresh ? 0 : Math.round((l.revenueCents ?? 0) * 0.93 * c.rate / 100) })),
    byCode: fresh ? { signups: 0, payers: 0, earnedCents: 0 } : { signups: c.byCode, payers: 3, earnedCents: 1180 },
    daily,
    byMonth: fresh ? [] : months.map((m, i) => ({ month: m, earnedCents: [9140, 6230, 2105][i], payments: [61, 44, 17][i] })),
    payouts: [],
  };
}

/** Payouts by hand (migration 0090) on sample data: Tasha is over the minimum, Dev under it. */
const PAYOUT_HISTORY: PayoutsAdmin["history"] = [];
let paidNow: Record<string, number> = {};
export async function previewStudioPayouts(): Promise<Admin<PayoutsAdmin>> {
  previewOnly();
  const today = new Date().toISOString().slice(0, 10);
  const next = new Date(Date.now() + 9 * 86_400_000).toISOString().slice(0, 10);
  const rows: PayoutsAdmin["due"] = [
    { creatorId: "c1", name: "Tasha Glow", handle: "@tashaglow", email: "tasha@example.com", code: "TASHA", status: "active", connectAccount: null, payableCents: 7473, heldCents: 13700, nextPayableOn: next, lastPaidAt: null },
    { creatorId: "c2", name: "Dev Okafor", handle: "@devdoesqueens", email: "dev@example.com", code: "DEVQ", status: "active", connectAccount: null, payableCents: 2190, heldCents: 401, nextPayableOn: next, lastPaidAt: null },
    { creatorId: "c3", name: "Marisol Reyes", handle: "@marisolsays", email: null, code: "MARI", status: "paused", connectAccount: null, payableCents: 0, heldCents: 290, nextPayableOn: next, lastPaidAt: null },
  ];
  const due = rows.map((d) => (paidNow[d.creatorId] ? { ...d, payableCents: 0, lastPaidAt: new Date().toISOString() } : d));
  if (!PAYOUT_HISTORY.length) PAYOUT_HISTORY.push({ id: 1, creatorId: "c1", name: "Tasha Glow", email: "tasha@example.com", period: "2026-09-01", totalCents: 9964, currency: "usd",
    method: "paypal", reference: "PP-7Q2K", note: "September payout", paidAt: "2026-10-01T15:12:00Z", paidBy: "boss@example.com", items: 38, voidedAt: null, voidReason: null });
  return { ok: true, data: { today, minimumCents: 5000, due, history: [...PAYOUT_HISTORY] } };
}
export async function previewStudioPayoutMark(creatorId: string, method: PayoutMethod, reference: string, note: string, belowMinimum: boolean): Promise<Admin<{ id: number; totalCents: number }>> {
  previewOnly();
  const amounts: Record<string, number> = { c1: 7473, c2: 2190 };
  const total = paidNow[creatorId] ? 0 : amounts[creatorId] ?? 0;
  if (total <= 0) return { ok: false, error: "Nothing is payable for that creator right now." };
  if (total < 5000 && !belowMinimum) return { ok: false, error: "That's under the $50 minimum. Tick \"Pay below the minimum\" to pay it anyway." };
  paidNow = { ...paidNow, [creatorId]: total };
  const id = PAYOUT_HISTORY.length + 1;
  PAYOUT_HISTORY.unshift({ id, creatorId, name: creatorId === "c1" ? "Tasha Glow" : "Dev Okafor", email: null, period: new Date().toISOString().slice(0, 8) + "01", totalCents: total, currency: "usd",
    method, reference: reference || null, note: note || null, paidAt: new Date().toISOString(), paidBy: "boss@example.com", items: 12, voidedAt: null, voidReason: null });
  return { ok: true, data: { id, totalCents: total } };
}
export async function previewStudioPayoutVoid(id: number, reason: string): Promise<Admin<null>> {
  previewOnly();
  const h = PAYOUT_HISTORY.find((x) => x.id === id);
  if (!h || h.voidedAt) return { ok: false, error: "That payout is gone or already undone." };
  h.voidedAt = new Date().toISOString(); h.voidReason = reason;
  const { [h.creatorId]: _gone, ...rest } = paidNow; paidNow = rest;
  return { ok: true, data: null };
}

/** Paid videos (migration 0091) on sample data: results come from each video's link. */
const VIDEOS: Omit<CreatorVideo, "creator" | "slug" | "clicks" | "signups" | "payers" | "revenueCents" | "commissionCents">[] = [
  { id: 1, creatorId: "c1", linkId: 2, title: "Moving to Queens with C$0", platform: "tiktok", url: "https://example.com/v/1", postedOn: "2026-10-02", feeCents: 25000, note: null, status: "live" },
  { id: 2, creatorId: "c1", linkId: 3, title: "Haunted Hell Gate tour", platform: "tiktok", url: "https://example.com/v/2", postedOn: "2026-10-12", feeCents: 30000, note: "Brief: a date night gone wrong", status: "live" },
  { id: 3, creatorId: "c2", linkId: 5, title: "Shop haul in Astoria", platform: "instagram", url: null, postedOn: "2026-09-28", feeCents: 15000, note: null, status: "removed" },
  { id: 4, creatorId: "c2", linkId: null, title: "Story time: my first date", platform: "youtube", url: null, postedOn: "2026-10-09", feeCents: 20000, note: "Code only in the video", status: "live" },
];
export async function previewStudioVideos(): Promise<Admin<VideosAdmin>> {
  previewOnly();
  const v = view(0);
  const links = v.creators.flatMap((c) => c.links.map((l) => ({ ...l, rate: c.rate })));
  const videos = VIDEOS.map((x) => {
    const c = v.creators.find((k) => k.id === x.creatorId)!;
    const l = links.find((k) => k.id === x.linkId);
    return { ...x, creator: c.name, slug: l?.slug ?? null, clicks: l ? l.clicks : null, signups: l ? l.signups : null, payers: l ? l.payers ?? 0 : null,
      revenueCents: l ? l.revenueCents ?? 0 : null, commissionCents: l ? Math.round((l.revenueCents ?? 0) * 0.93 * l.rate / 100) : null };
  });
  return { ok: true, data: { videos, creators: v.creators.map((c) => ({
    creatorId: c.id, name: c.name, videos: VIDEOS.filter((x) => x.creatorId === c.id && x.status === "live").length,
    spendCents: VIDEOS.filter((x) => x.creatorId === c.id).reduce((t, x) => t + x.feeCents, 0), signups: c.signups, payers: c.payers ?? 0,
    revenueCents: c.revenueCents ?? 0, netCents: c.owed?.periodNetCents ?? 0, commissionCents: c.owed?.periodCents ?? 0 })) } };
}
export async function previewStudioVideoSave(input: VideoInput): Promise<Admin<number>> {
  previewOnly();
  if (!input.title.trim()) return { ok: false, error: "Give the video a title." };
  const old = VIDEOS.find((x) => x.id === input.id);
  const row = { creatorId: input.creatorId, linkId: input.linkId, title: input.title.trim(), platform: input.platform, url: input.url || null,
    postedOn: input.postedOn || null, feeCents: input.feeCents, note: input.note || null };
  if (old) { Object.assign(old, row); return { ok: true, data: old.id }; }
  const id = VIDEOS.length + 1;
  VIDEOS.unshift({ id, ...row, status: "live" });
  return { ok: true, data: id };
}
export async function previewStudioVideoStatus(id: number, status: "live" | "removed"): Promise<Admin<null>> {
  previewOnly();
  const v = VIDEOS.find((x) => x.id === id);
  if (!v) return { ok: false, error: "That video is gone." };
  v.status = status;
  return { ok: true, data: null };
}
