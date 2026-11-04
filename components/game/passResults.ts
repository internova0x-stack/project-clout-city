// The Clout Pass celebrations (components/Celebrate.tsx; owner, Nov 4: the celebrations for the rest of the game).
//   every tier reached            a legend, "18 tiers" as the hero (once per season on this device: cc-pass-max:<season>)
//   Collect all                   a banner listing what came in (the toast before it)
//   the season over (claim/over)  a results card: tiers reached against all of them, You keep the pieces and the badge
//                                 (once per season on this device: cc-pass-wrap:<season>)
// GameShell hands every pass read to `passRead` and every claim to `passClaimBanner`; nothing here calls the server.

import { claimable, rewardLabel, tierFor, type PassReward, type PassState } from "../../lib/seasonPass.ts";
import type { Celebration } from "../Celebrate";

type Name = (sku: string) => string | undefined;
const cs = (n: number) => `C$${n.toLocaleString("en-US")}`;

function onceOnDevice(key: string): boolean {
  try {
    if (localStorage.getItem(key)) return false;
    localStorage.setItem(key, "1");
    return true;
  } catch { return false; }
}
function seenOnDevice(key: string): void {
  try { localStorage.setItem(key, "1"); } catch { /* private mode */ }
}

/** Every tier: the legend. */
export function passMaxCelebration(s: PassState, onOpen?: () => void): Celebration {
  const n = s.season.tiers.length;
  const ready = claimable(s);
  const waiting = ready.free.length + ready.paid.length;
  return {
    rung: 4, emoji: s.season.badge.emoji, tag: "Clout Pass", num: String(n), unit: "tiers",
    title: `Every tier of ${s.season.name}`,
    line: "You did the daily tasks so many times the tasks started doing you.",
    rewards: s.paid ? [{ text: `${s.season.badge.emoji} ${s.season.badge.name} badge` }] : undefined,
    lola: "Maxed the pass. Your landlord is impressed and also raising the rent.",
    cta: waiting ? "Collect your rewards" : "Nice", onCta: waiting ? onOpen : undefined,
    share: `I maxed out all ${n} tiers of ${s.season.name} in Clout City.`,
  };
}

/** What Collect all brought in, as one banner: the money and clout added up, then the pieces. */
export function passClaimBanner(got: PassReward[], name: Name, onOpen?: () => void): Celebration {
  const cash = got.reduce((a, r) => a + (r.kind === "cash" ? r.amount : 0), 0);
  const clout = got.reduce((a, r) => a + (r.kind === "clout" ? r.amount : 0), 0);
  const things = got.filter((r) => r.kind === "item" || r.kind === "badge").map((r) => rewardLabel(r, name));
  const rewards: NonNullable<Celebration["rewards"]> = [
    ...(cash ? [{ tone: "cash" as const, text: `+${cs(cash)}` }] : []),
    ...(clout ? [{ tone: "clout" as const, text: `+${clout} 🔥` }] : []),
    ...things.slice(0, 2).map((text) => ({ text })),
    ...(things.length > 2 ? [{ text: `+${things.length - 2} more` }] : []),
  ];
  return {
    rung: 2, emoji: "🎁", tag: "Clout Pass",
    title: got.length === 1 ? "Reward collected" : `${got.length} rewards collected`,
    rewards, onCta: onOpen,
  };
}

/** The season's wrap-up: how far you got, and what stays yours. */
export function passWrapResult(s: PassState, name: Name, onOpen?: () => void): Celebration {
  const { tier } = tierFor(s.xp, s.season);
  const n = s.season.tiers.length;
  const all = tier >= n;
  const claimedRewards = [
    ...s.season.tiers.filter((t) => s.claimed.free.includes(t.tier)).flatMap((t) => t.free),
    ...s.season.tiers.filter((t) => s.claimed.paid.includes(t.tier)).flatMap((t) => t.paid),
  ];
  const pieces = claimedRewards.filter((r) => r.kind === "item").length;
  const badge = claimedRewards.some((r) => r.kind === "badge");
  const ready = claimable(s);
  const waiting = ready.free.length + ready.paid.length;
  const firstPiece = claimedRewards.find((r) => r.kind === "item");
  const keep = [
    pieces ? `👕 ${pieces} piece${pieces === 1 ? "" : "s"}` : "🧥 Your old sweater",
    ...(firstPiece ? [rewardLabel(firstPiece, name)] : []),
    ...(badge ? [`${s.season.badge.emoji} ${s.season.badge.name}`] : []),
  ];
  return {
    rung: 3, emoji: s.season.badge.emoji, tag: "Clout Pass · Season over",
    title: all ? `${s.season.name}, maxed` : `${s.season.name} is a wrap`,
    cta: waiting ? `Claim ${waiting} reward${waiting === 1 ? "" : "s"}` : "Bring on next season",
    onCta: waiting ? onOpen : undefined,
    result: {
      tone: all ? "win" : "warn",
      stamp: all ? { text: "MAXED", tone: "good" } : { text: "SEASON OVER", tone: "warn" },
      amount: tier, plain: true, unit: `of ${n} tiers`,
      story: all ? "Every tier, every task. The city noticed, then asked what a tier is." : "The season's over. The pieces stay. So does the sweater.",
      meter: { label: "Tiers reached", have: tier, need: n, max: n,
        say: waiting ? `${waiting} reward${waiting === 1 ? "" : "s"} still to claim.` : all ? "Every tier." : `${n - tier} short of the top. Next season.` },
      keep,
    },
  };
}

/**
 * Every pass read (GameShell's loadPass and a claim's answer): the wrap-up once when the season's over, else the legend
 * once when every tier is reached. Returns the celebration to show (the caller passes it to `celebrate`), or null.
 */
export function passRead(s: PassState, name: Name, onOpen?: () => void): Celebration | null {
  if (typeof window === "undefined" || s.phase === "soon") return null;
  const id = s.season.id;
  const max = tierFor(s.xp, s.season).max;
  if (s.phase === "claim" || s.phase === "over") {
    if (s.xp <= 0 || !onceOnDevice(`cc-pass-wrap:${id}`)) return null;
    seenOnDevice(`cc-pass-max:${id}`);
    return passWrapResult(s, name, onOpen);
  }
  if (max && onceOnDevice(`cc-pass-max:${id}`)) return passMaxCelebration(s, onOpen);
  return null;
}
