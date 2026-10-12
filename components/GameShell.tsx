"use client";

import dynamic from "next/dynamic";
import { useCallback, useRef, useState } from "react";
import type { CliqueMember, Player } from "@/lib/player";
import { DEFAULT_PLAYER_LOCATION, WAVE_1_PINS, type PlacePin } from "@/lib/places";
import { normalizeLook } from "@/lib/look";
import { getStyle } from "@/lib/styles";
import { ApartmentBackdrop } from "./ApartmentBackdrop";
import { ComingSoon, type ComingSoonKey } from "./ComingSoon";
import { GameChrome, type ChromeAction, type Tab } from "./hud/GameChrome";
import { LocateIcon } from "./icons";
import { InviteSheet } from "./InviteSheet";
import { CityMap, type MapApi } from "./map/CityMap";
import { Sheet } from "./Sheet";
import { useCityClock } from "./useCityClock";

const Avatar3D = dynamic(() => import("./avatar/Avatar3D"), { ssr: false });

// The signed-in home screen: Home (the apartment) and Map work; everything
// else opens a "Coming soon" card (Milestones v0.1).
export function GameShell({
  player,
  clique,
  firstVisit = false,
  daytimeOverride,
}: {
  player: Player;
  clique: CliqueMember[];
  firstVisit?: boolean;
  /** Development previews only: pin the map to day or night. */
  daytimeOverride?: boolean;
}) {
  const clock = useCityClock();
  const time = clock.time;
  const daytime = daytimeOverride ?? clock.daytime;
  const [tab, setTab] = useState<Tab>("home");
  const [soon, setSoon] = useState<{ key: ComingSoonKey; title?: string } | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [invitePin, setInvitePin] = useState(firstVisit);
  const mapRef = useRef<MapApi>(null);

  const look = normalizeLook(player.look, player.starting_style);
  const style = getStyle(look.style);

  const onAction = useCallback((a: ChromeAction) => {
    if (a === "tab:home") return setTab("home");
    if (a === "tab:map") return setTab("map");
    if (a === "invite") {
      setInvitePin(false);
      return setInviteOpen(true);
    }
    setSoon({ key: a });
  }, []);

  const onPinTap = useCallback((pin: PlacePin) => setSoon({ key: "place", title: pin.name }), []);
  const onLockedTap = useCallback((name: string) => setSoon({ key: "place", title: `${name} is locked` }), []);

  return (
    <main className="game">
      {tab === "home" ? (
        <div className="layer">
          <ApartmentBackdrop daytime={daytime} />
          <div style={{ position: "absolute", left: 0, right: 0, bottom: "max(64px, 7%)", height: "54%" }}>
            <Avatar3D look={look} framing="room" label={`${player.display_name}, wearing ${style.label}`} />
          </div>
          <button
            className="glass-dark"
            onClick={() => setProfileOpen(true)}
            style={{
              position: "absolute", zIndex: 16, left: "50%", transform: "translateX(-50%)", top: "calc(124px + var(--safe-top))",
              display: "flex", alignItems: "center", gap: 10, padding: "6px 14px 6px 6px", borderRadius: 999, boxShadow: "var(--elev-2)", maxWidth: "62%",
            }}
            aria-label="Your profile"
          >
            <span style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--night-700)", border: "2px solid var(--taxi-400)", display: "grid", placeItems: "center", fontSize: 16, flex: "none" }}>
              {style.emoji}
            </span>
            <span style={{ textAlign: "left", minWidth: 0 }}>
              <span className="display-sm" style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{player.display_name}</span>
              <span className="meta" style={{ display: "block", color: "rgba(255,246,224,.6)" }}>{style.label} · Astoria</span>
            </span>
          </button>
        </div>
      ) : (
        <>
          <CityMap
            ref={mapRef}
            pins={WAVE_1_PINS}
            player={{ at: DEFAULT_PLAYER_LOCATION, emoji: style.emoji }}
            initialCenter={DEFAULT_PLAYER_LOCATION}
            daytime={daytime}
            onPinTap={onPinTap}
            onLockedTap={onLockedTap}
          />
          <button className="icon-round dark map-locate" onClick={() => mapRef.current?.locatePlayer()} aria-label="Go to my location">
            <LocateIcon size={20} />
          </button>
        </>
      )}

      <GameChrome time={time} tab={tab} onAction={onAction} invitePin={invitePin} netWorthPin={firstVisit} />

      <ComingSoon which={soon?.key ?? null} title={soon?.title} onClose={() => setSoon(null)} />
      <InviteSheet open={inviteOpen} onClose={() => setInviteOpen(false)} inviteCode={player.invite_code} clique={clique} />
      <Sheet open={profileOpen} onClose={() => setProfileOpen(false)} label="Your profile">
        <div className="stack-16">
          <div className="row" style={{ gap: 12 }}>
            <span style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--night-900)", border: "3px solid var(--taxi-400)", display: "grid", placeItems: "center", fontSize: 26 }} aria-hidden="true">
              {style.emoji}
            </span>
            <span>
              <span className="display-md" style={{ display: "block" }}>{player.display_name}</span>
              <span className="meta" style={{ display: "block" }}>{style.emoji} <span style={{ color: "var(--text-2)" }}>{style.label}</span> · Queens</span>
            </span>
          </div>
          <div className="card stack-8">
            <p className="overline" style={{ margin: 0 }}>Starter wardrobe</p>
            <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
              {style.starterItems.map((i) => <span key={i} className="tag tag-neutral">{i}</span>)}
            </div>
          </div>
          <form action="/auth/signout" method="post">
            <button className="btn btn-secondary" type="submit">Log out</button>
          </form>
        </div>
      </Sheet>
    </main>
  );
}
