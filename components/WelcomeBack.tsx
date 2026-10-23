"use client";

// The welcome screen for a returning player (owner, Oct 22): their home in 3D behind a card with who they are, the day
// and their cash, then Continue, or Start over (migration 0114: once every 30 days; real money, crew and badges stay).

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Sheet } from "./Sheet";
import { CATALOG_FURNITURE, itemBySku, type ShopItem } from "@/lib/city";
import { GAME_CONFIG } from "@/lib/config";
import { formatCashShort } from "@/lib/economy";
import { normalizeLook } from "@/lib/look";
import { homeTemplate, ownedId, placedElsewhere, type OwnedPiece } from "@/lib/rooms";
import { getStyle, starterOutfit } from "@/lib/styles";
import { itemOptionsBySku, outfitFromSkus } from "@/lib/wearing";
import type { ItemOptions } from "@/lib/couture";

const Room3D = dynamic(() => import("./room/Room3D"), { ssr: false });
const AvatarHead = dynamic(() => import("./avatar/AvatarHead"), { ssr: false });

export interface WelcomeItem { id: number; sku: string; category: string; equipped: boolean; options?: ItemOptions }

export interface WelcomeData {
  name: string;
  style: string;
  look: Record<string, unknown>;
  bank: number;
  homeId: string;
  houseSku: string | null;
  homeLayout: unknown;
  items: WelcomeItem[];
  /** restart_status(): null before migration 0114. */
  restart: { can: boolean; nextAt: string | null } | null;
}

export type RestartResult = { ok: true } | { ok: false; error: string };

/** "Thursday 22 Oct": today in New York, like the game's calendar. */
function today(): string {
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "short", timeZone: "America/New_York" }).format(new Date());
}

export function WelcomeBack({ data, onRestart, preview = false }: { data: WelcomeData; onRestart: () => Promise<RestartResult>; preview?: boolean }) {
  const router = useRouter();
  const [sheet, setSheet] = useState(false);
  const [busy, setBusy] = useState(false);
  const [going, setGoing] = useState(false);
  // Back from the game (the page restored from cache): the button is a button again.
  useEffect(() => {
    const reset = () => setGoing(false);
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);
  const [error, setError] = useState<string | null>(null);
  const look = useMemo(() => normalizeLook(data.look, data.style), [data.look, data.style]);
  const outfit = useMemo(() => {
    const worn = data.items.filter((i) => i.equipped && i.category === "fashion").map((i) => i.sku);
    return worn.length ? outfitFromSkus(starterOutfit(getStyle(look.style), look.body, look.fit), worn, itemOptionsBySku(data.items)) : undefined;
  }, [data.items, look]);
  const owned = useMemo<OwnedPiece[]>(() => {
    const elsewhere = placedElsewhere(data.homeLayout, 1);
    return data.items.flatMap((i) => {
      if (i.category !== "home") return [];
      const it: ShopItem | undefined = itemBySku(i.sku) ?? (CATALOG_FURNITURE[i.sku] ? ({ sku: i.sku, name: i.sku, emoji: "🛋️", furniture: CATALOG_FURNITURE[i.sku] } as ShopItem) : undefined);
      if (!it?.furniture) return [];
      const id = ownedId(i.id);
      return elsewhere.has(id) ? [] : [{ id, kind: it.furniture.kind as OwnedPiece["kind"], color: it.furniture.color, name: it.name, emoji: it.emoji }];
    });
  }, [data.items, data.homeLayout]);
  const template = homeTemplate(data.homeId, data.houseSku);
  const nextAt = data.restart?.nextAt && !data.restart.can
    ? new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", timeZone: "America/New_York" }).format(new Date(data.restart.nextAt))
    : null;

  async function restart() {
    setBusy(true);
    setError(null);
    const r = await onRestart();
    if (!r.ok) {
      setBusy(false);
      return setError(r.error);
    }
    router.push(preview ? "/preview/creator?step=0" : "/create");
  }

  return (
    <main className="welcome">
      <div className="welcome-room" aria-hidden="true">
        <Room3D template={template} layout={data.homeLayout} owned={owned} look={look} outfit={outfit} daytime label={`${data.name} at home`}
          insetTop={170} insetBottom={300} />
      </div>
      <header className="welcome-head">
        <h1 className="studio-mark welcome-mark">Clout City</h1>
        <p className="welcome-tag">Your New York story continues.</p>
      </header>
      <section className="welcome-card" aria-label="Your account">
        <div className="welcome-me">
          <span className="welcome-face"><AvatarHead look={look} outfit={outfit} size={52} /></span>
          <span className="welcome-who">
            <strong>{data.name}</strong>
            <span>{today()} · {formatCashShort(data.bank)}</span>
          </span>
        </div>
        {/* Owner, Oct 23: a spinner at once, so the tap never looks ignored while the game loads. */}
        <a className={`btn btn-taxi${going ? " is-loading" : ""}`} href="/home" aria-busy={going}
          onClick={(e) => { if (going) return e.preventDefault(); setGoing(true); }}>
          {going ? <><span className="btn-spinner" aria-hidden="true" /> Loading…</> : "Continue"}
        </a>
        <div className="welcome-foot">
          <span>Signed in as <strong>@{data.name}</strong></span>
          <form action="/auth/signout" method="post"><button className="link-btn" type="submit">Log out</button></form>
        </div>
        {data.restart && <button className="link-btn welcome-over" type="button" onClick={() => setSheet(true)}>Start over</button>}
      </section>

      <Sheet open={sheet} onClose={() => !busy && setSheet(false)} label="Start over">
        <div className="welcome-sheet">
          <h2 className="display-md">Start all over again?</h2>
          <p className="body">You go back through the character creator: a new look, a new birth lottery and a new first home.</p>
          <div className="welcome-lists">
            <div>
              <h3 className="overline">You keep</h3>
              <ul>
                <li>💳 Everything bought with real money (VIP, Clout Couture)</li>
                <li>👯 Your crew and your chats</li>
                <li>🏅 Your badges and your username</li>
              </ul>
            </div>
            <div>
              <h3 className="overline">You lose</h3>
              <ul>
                <li>💸 Your cash and clout ({formatCashShort(data.bank)} today)</li>
                <li>🏠 Your home and everything bought with C$</li>
                <li>📈 Skills, goals, streaks, businesses and campus</li>
              </ul>
            </div>
          </div>
          {nextAt ? (
            <p className="body-m welcome-wait">You can start over once every {GAME_CONFIG.restartDays} days. Next chance: {nextAt}.</p>
          ) : (
            <>
              <p className="subtext">This can't be undone, and you can only do it once every {GAME_CONFIG.restartDays} days.</p>
              {error && <p className="error-text" role="alert">{error}</p>}
              <button className="btn btn-taxi" type="button" disabled={busy} onClick={() => void restart()}>{busy ? "Starting over…" : "Start over"}</button>
            </>
          )}
          <button className="btn btn-ghost" type="button" disabled={busy} onClick={() => setSheet(false)}>Keep playing</button>
        </div>
      </Sheet>
    </main>
  );
}
