// Leaving the bench at the 114½ (owner, Nov 4): a "You're out" banner with how it ended (bail paid, Sgt. Bev, or time
// served), once per stay on this device. A stay is known by its end time (the holding mark's `until`): GameShell hands
// the current one to `useHoldingOut`, which remembers it (`cc-held`), and plays "time served" when the clock runs out, or
// on the next open if it ran out while the game was closed (within a day). Bail and Sgt. Bev call `leftHolding` first,
// so the stay is spent and the clock never plays a second banner.

import { useEffect } from "react";
import type { Celebration } from "../Celebrate.tsx";

export type HoldingExit = "bail" | "bev" | "time";

const cs = (n: number) => `C$${Math.round(n).toLocaleString("en-US")}`;

/** The banner (pure; tests/holdingOut.test.ts). */
export function holdingOutBanner(how: HoldingExit, cost = 0): Celebration {
  if (how === "bail") return { rung: 2, emoji: "🚔", tag: "You're out", title: "Bail paid. Don't make it a habit.", rewards: [{ tone: "cash", text: `Bail ${cs(cost)}` }] };
  if (how === "bev") return { rung: 2, emoji: "💛", tag: "You're out", title: "Sgt. Bev signed you out early", rewards: [{ text: "“You were never here.”" }] };
  return { rung: 2, emoji: "🔓", tag: "You're out", title: "Time served. The vending machine misses you.", rewards: [{ text: "C$0 bail" }] };
}

const KEY = "cc-held";
interface Held { until: string; out: boolean }

function load(): Held | null {
  try { const raw = localStorage.getItem(KEY); return raw ? (JSON.parse(raw) as Held) : null; } catch { return null; }
}
function save(h: Held) {
  try { localStorage.setItem(KEY, JSON.stringify(h)); } catch { /* private mode */ }
}

/** Marks the stay spent; true when it hadn't been (show the banner). `until` is the stay's end, when known. */
function spend(until: string | null): boolean {
  const h = load();
  if (until) {
    if (h?.until === until && h.out) return false;
    save({ until, out: true });
    return true;
  }
  if (h && !h.out) { save({ ...h, out: true }); return true; }
  return !h;
}

/** Bail or Sgt. Bev ended it: the banner, once for this stay. */
export function leftHolding(how: Exclude<HoldingExit, "time">, until: string | null, cost = 0, show: (c: Celebration) => void) {
  if (spend(until)) show(holdingOutBanner(how, cost));
}

/** Remembers the current stay and plays "time served" when it runs out (or ran out while the game was closed). */
export function useHoldingOut(until: string | null, show: (c: Celebration) => void) {
  useEffect(() => {
    const h = load();
    if (until) {
      if (h?.until !== until) save({ until, out: false });
    } else if (h && !h.out) {
      // The stay is gone from the server's marks: ended by time if its clock ran out (bail and Bev spend it first).
      const end = Date.parse(h.until);
      if (end <= Date.now() && Date.now() - end < 86_400_000) { save({ ...h, out: true }); show(holdingOutBanner("time")); }
      else if (end <= Date.now()) save({ ...h, out: true });
    }
    if (!until) return;
    const wait = Date.parse(until) - Date.now();
    if (wait <= 0 || wait > 6 * 3_600_000) return;
    const t = setTimeout(() => {
      const now = load();
      if (now?.until === until && !now.out) { save({ until, out: true }); show(holdingOutBanner("time")); }
    }, wait + 500);
    return () => clearTimeout(t);
  }, [until, show]);
}
