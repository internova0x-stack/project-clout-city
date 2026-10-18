"use server";

import { previewOnly } from "./guard";
import { HOLD_DAYS, commissionOn, normalizeCreatorCode, type Affiliates, type AffiliatesOverview, type Creator, type CreatorInput, type CreatorLink, type CreatorPage, type DayPoint, type LinkInput } from "@/lib/creators";
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
