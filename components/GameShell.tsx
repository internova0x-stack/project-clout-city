"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PlayerUpdate } from "@/app/home/actions";
import { ECONOMY } from "@/lib/economy";
import { inviteUrl } from "@/lib/invite";
import { normalizeLook } from "@/lib/look";
import { music, readLocalMuted, writeLocalMuted } from "@/lib/music";
import type { CliqueMember, Player } from "@/lib/player";
import { DEFAULT_PLAYER_LOCATION, WAVE_1_PINS, type PlacePin } from "@/lib/places";
import { getStyle } from "@/lib/styles";
import { ApartmentBackdrop } from "./ApartmentBackdrop";
import { ComingSoon, type ComingSoonKey } from "./ComingSoon";
import { InvitePrompt, LeaderboardSheet, PartyDoneCard, PartySheet, PwaPrompt, isStandalone } from "./game/FirstSession";
import { BankSheet, EventsSheet, TasksSheet } from "./game/Sheets";
import { TourTooltip, TOUR, WelcomeModal } from "./game/Tutorial";
import { GameChrome, type ChromeAction, type Tab } from "./hud/GameChrome";
import { LocateIcon } from "./icons";
import { InviteSheet } from "./InviteSheet";
import { CityMap, type MapApi } from "./map/CityMap";
import { Sheet } from "./Sheet";
import { useCityClock } from "./useCityClock";
import { usePlayersOnline } from "./usePresence";

const Avatar3D = dynamic(() => import("./avatar/Avatar3D"), { ssr: false });

export interface GameActions {
  setTutorialState: (state: "done" | "skipped") => Promise<void>;
  attendFirstParty: (withClique: boolean) => Promise<{ ok: true; player: PlayerUpdate } | { ok: false; error: string }>;
  finishHandoff: () => Promise<void>;
  setMusicMuted: (muted: boolean) => Promise<void>;
}

/** The first session after creation, in order (Clarifications section 1, steps 4 to 14). */
export type Flow = "none" | "welcome" | "tour" | "party" | "partyDone" | "leaderboard" | "invitePrompt" | "pwa";

type Panel = "tasks" | "events" | "bank" | "leaderboard" | "profile" | "invite" | null;

const PINS_KEY = "cc_first_pins_seen";

function initialFlow(p: Player): Flow {
  if (p.onboarding_step === "party_done") return "leaderboard"; // resume the hand-off
  if (!p.first_party_at && p.tutorial_state === "pending") return "welcome";
  return "none";
}

// The signed-in home screen: the apartment and the map, the HUD with live
// clout and cash, and the guided first session (welcome, tour, first party,
// leaderboard, invite and install prompts).
export function GameShell({
  player,
  clique,
  actions,
  daytimeOverride,
  previewFlow,
}: {
  player: Player;
  clique: CliqueMember[];
  actions: GameActions;
  /** Development previews only: pin the map to day or night. */
  daytimeOverride?: boolean;
  /** Development previews only: open a step of the first session directly. */
  previewFlow?: Flow;
}) {
  const clock = useCityClock();
  const daytime = daytimeOverride ?? clock.daytime;
  const [tab, setTab] = useState<Tab>("home");
  const [soon, setSoon] = useState<{ key: ComingSoonKey; title?: string } | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [flow, setFlow] = useState<Flow>(() => previewFlow ?? initialFlow(player));
  const [tourStep, setTourStep] = useState(0);
  const [me, setMe] = useState(player);
  const [partyBusy, setPartyBusy] = useState(false);
  const [partyError, setPartyError] = useState<string | null>(null);
  const [invitedDuringParty, setInvitedDuringParty] = useState(false);
  const [pinsSeen, setPinsSeen] = useState({ invite: true, networth: true });
  const [muted, setMuted] = useState(player.music_muted);
  const mapRef = useRef<MapApi>(null);
  // The invite screen opened from the invite prompt returns to the install prompt when closed.
  const pendingPwa = useRef(false);
  const online = usePlayersOnline(player.id);

  const look = normalizeLook(me.look, me.starting_style);
  const style = getStyle(look.style);
  const partyDone = me.first_party_at !== null;
  const handedOff = me.onboarding_step === "handoff_done";

  // First-play pins on Net Worth and Invite appear at the hand-off (step 14).
  useEffect(() => {
    if (!handedOff) return;
    try {
      const seen = JSON.parse(localStorage.getItem(PINS_KEY) ?? "{}");
      setPinsSeen({ invite: !!seen.invite, networth: !!seen.networth });
    } catch {
      setPinsSeen({ invite: false, networth: false });
    }
  }, [handedOff]);
  const markPin = (k: "invite" | "networth") => {
    setPinsSeen((p) => {
      const next = { ...p, [k]: true };
      try { localStorage.setItem(PINS_KEY, JSON.stringify(next)); } catch { /* fine */ }
      return next;
    });
  };

  // Music starts on the first tap anywhere, remembering the player's choice.
  useEffect(() => {
    const m = player.music_muted || readLocalMuted();
    setMuted(m);
    music().setMuted(m);
    const start = () => music().start();
    window.addEventListener("pointerdown", start, { once: true });
    return () => window.removeEventListener("pointerdown", start);
  }, [player.music_muted]);
  const toggleSound = () => {
    const next = !muted;
    setMuted(next);
    music().start();
    music().setMuted(next);
    writeLocalMuted(next);
    void actions.setMusicMuted(next);
  };

  const shareInvite = useCallback(async () => {
    const url = inviteUrl(process.env.NEXT_PUBLIC_SITE_URL || window.location.origin, me.invite_code);
    try {
      if (navigator.share) {
        await navigator.share({ title: "Clout City NYC", text: "Pull up. I'm at a party in Clout City.", url });
        return true;
      }
      await navigator.clipboard.writeText(url);
      return true;
    } catch {
      return false; // a cancelled share sheet never blocks the party
    }
  }, [me.invite_code]);

  const attend = async (withClique: boolean) => {
    setPartyError(null);
    setPartyBusy(true);
    if (withClique) {
      const shared = await shareInvite();
      if (shared) setInvitedDuringParty(true);
    }
    const r = await actions.attendFirstParty(withClique);
    setPartyBusy(false);
    if (!r.ok) return setPartyError(r.error);
    setMe((p) => ({ ...p, ...r.player }));
    setFlow("partyDone");
  };

  const endHandoff = () => {
    setFlow("none");
    setMe((p) => ({ ...p, onboarding_step: "handoff_done" }));
    void actions.finishHandoff();
  };
  const afterInvitePrompt = () => (isStandalone() ? endHandoff() : setFlow("pwa"));

  const openParty = () => {
    setPanel(null);
    setFlow("party");
  };

  const onAction = useCallback(
    (a: ChromeAction) => {
      if (a === "tab:home") return setTab("home");
      if (a === "tab:map") return setTab("map");
      if (a === "invite") {
        markPin("invite");
        return setPanel("invite");
      }
      if (a === "leaderboard") return setPanel("leaderboard");
      if (a === "bank") return setPanel("bank");
      if (a === "tasks" || a === "daily") return setPanel("tasks");
      if (a === "events") {
        if (flow === "tour") {
          // Tooltip 5 ends the tour by tapping its target, and starts the first task.
          void actions.setTutorialState("done");
          setMe((p) => ({ ...p, tutorial_state: "done" }));
          return openParty();
        }
        return setPanel("events");
      }
      if (a === "networth") markPin("networth");
      setSoon({ key: a });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [flow],
  );

  const onPinTap = useCallback((pin: PlacePin) => setSoon({ key: "place", title: pin.name }), []);
  const onLockedTap = useCallback((name: string) => setSoon({ key: "place", title: `${name} is locked` }), []);

  return (
    <main className="game">
      {tab === "home" ? (
        <div className="layer">
          <ApartmentBackdrop daytime={daytime} />
          <div style={{ position: "absolute", left: 0, right: 0, bottom: "max(64px, 7%)", height: "54%" }}>
            <Avatar3D look={look} framing="room" label={`${me.display_name}, wearing ${style.label}`} />
          </div>
          <button
            className="glass-hud profile-chip"
            onClick={() => setPanel("profile")}
            aria-label="Your profile"
          >
            <span className="lb-avatar" style={{ border: "2px solid var(--taxi-400)", background: "var(--night-700)" }}>{style.emoji}</span>
            <span style={{ textAlign: "left", minWidth: 0 }}>
              <span className="display-sm" style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{me.display_name}</span>
              <span className="meta" style={{ display: "block" }}>
                {style.label} · {ECONOMY.homes.find((h) => h.id === me.home_id)?.neighborhood ?? "Queens"}
              </span>
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
          <button className="icon-round map-locate glass-hud" onClick={() => mapRef.current?.locatePlayer()} aria-label="Go to my location">
            <LocateIcon size={20} />
          </button>
        </>
      )}

      <GameChrome
        time={clock.time}
        tab={tab}
        onAction={onAction}
        invitePin={handedOff && !pinsSeen.invite}
        netWorthPin={handedOff && !pinsSeen.networth}
        onToggleSound={toggleSound}
        values={{
          clout: me.clout,
          bank: me.bank_cash,
          dailyDone: 0,
          dailyTotal: 5,
          stats: { energy: me.energy, mood: me.mood, confidence: me.confidence },
          muted,
          online,
          eventsBadge: !partyDone,
        }}
      />

      {/* ---- Guided first session ---- */}
      {flow === "welcome" && (
        <WelcomeModal
          onStart={() => { setTourStep(0); setFlow("tour"); }}
          onSkip={() => {
            void actions.setTutorialState("skipped");
            setMe((p) => ({ ...p, tutorial_state: "skipped" }));
            setFlow("none"); // the first task waits in Tasks
          }}
        />
      )}
      {flow === "tour" && <TourTooltip index={tourStep} onNext={() => setTourStep((s) => Math.min(s + 1, TOUR.length - 1))} />}
      <PartySheet open={flow === "party"} onClose={() => setFlow("none")} onAttend={attend} busy={partyBusy} error={partyError} />
      {flow === "partyDone" && <PartyDoneCard onContinue={() => setFlow("leaderboard")} />}
      <LeaderboardSheet
        open={flow === "leaderboard" || panel === "leaderboard"}
        onClose={() => (flow === "leaderboard" ? setFlow("invitePrompt") : setPanel(null))}
        cta={flow === "leaderboard" ? { label: "Climb the ladder", onClick: () => setFlow("invitePrompt") } : undefined}
        myClout={me.clout}
      />
      {flow === "invitePrompt" && (
        <InvitePrompt
          cliqueCount={clique.length}
          invitedDuringParty={invitedDuringParty}
          onRecruit={() => { pendingPwa.current = true; setFlow("none"); setPanel("invite"); }}
          onLater={afterInvitePrompt}
        />
      )}
      {flow === "pwa" && <PwaPrompt onDone={endHandoff} />}

      {/* ---- Panels ---- */}
      <TasksSheet open={panel === "tasks"} onClose={() => setPanel(null)} partyDone={partyDone} onOpenParty={openParty} cliqueCount={clique.length} />
      <EventsSheet open={panel === "events"} onClose={() => setPanel(null)} partyDone={partyDone} onOpenParty={openParty} />
      <BankSheet open={panel === "bank"} onClose={() => setPanel(null)} bank={me.bank_cash} />
      <InviteSheet
        open={panel === "invite"}
        onClose={() => {
          setPanel(null);
          if (pendingPwa.current) {
            pendingPwa.current = false;
            afterInvitePrompt();
          }
        }}
        inviteCode={me.invite_code}
        clique={clique}
      />
      <ComingSoon which={soon?.key ?? null} title={soon?.title} onClose={() => setSoon(null)} />
      <Sheet open={panel === "profile"} onClose={() => setPanel(null)} label="Your profile">
        <div className="stack-16">
          <div className="row" style={{ gap: 12 }}>
            <span style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--night-900)", border: "3px solid var(--taxi-400)", display: "grid", placeItems: "center", fontSize: 26 }} aria-hidden="true">
              {style.emoji}
            </span>
            <span>
              <span className="display-md" style={{ display: "block" }}>{me.display_name}</span>
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

