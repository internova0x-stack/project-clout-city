"use server";

import { previewOnly } from "./guard";
import { normalizeCreatorCode, type Affiliates, type Creator, type CreatorInput, type CreatorLink, type LinkInput } from "@/lib/creators";
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

function view(days: number): Affiliates {
  const scale = days === 0 ? 1.6 : days === 7 ? 0.25 : days === 90 ? 1.3 : 1;
  const creators = CREATORS.map((c) => {
    const links = c.links.map((l) => ({ ...l, clicks: Math.round(l.clicks * scale), signups: Math.round(l.signups * scale) }));
    const byCode = Math.round(BY_CODE[c.id] * scale);
    const signups = links.reduce((t, l) => t + l.signups, 0) + byCode;
    return { ...c, links, byCode, clicks: links.reduce((t, l) => t + l.clicks, 0), signups, signupsAll: Math.round(signups * 1.6 / scale) };
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
