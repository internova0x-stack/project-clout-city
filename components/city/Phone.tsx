"use client";

import type { PartyMention } from "@/lib/party";
import { JobsApp } from "../together/Together";
import { useEffect, useState } from "react";
import { GIG_TITLES } from "@/lib/city";
import { activeGig, gigAvailability, gigCloutReq, gigReady, type CityState, type GigOffer } from "@/lib/cityState";
import { formatCash } from "@/lib/economy";
import { tileBackground, type GlyphName } from "../AppGlyph";
import { TeaApp } from "./Gossip";
import { RadioApp } from "./Radio";
import { TvApp } from "./CloutTv";
import type { Station, StationThread, TvApi, TvState } from "@/lib/cloutTv";
import type { RadioApi } from "@/lib/radio";
import { BusinessesApp } from "./Businesses";
import { ApartmentsApp } from "./Apartments";
import type { GossipState, TeaCard } from "@/lib/gossip";
import { BankView } from "../game/Sheets";
import { NewsApp, type CityNews, type NewsHandlers } from "../story/News";
import { MessagesApp, type MessagesDating } from "../chat/Messages";
import type { ChatApi } from "@/lib/chat";
import { unseenBeats, type StoryFeed } from "@/lib/storyFeed";
import { ChevronLeftIcon, CloseIcon } from "../icons";
import { formatCountdown, useGameNow } from "./Common";

export type App = "gigs" | "bank" | "settings" | "news" | "messages" | "collection" | "tea" | "apartments" | "businesses" | "jobs" | "radio" | "tv";

// Emoji on gradient tiles (the gradients come from the shared icon family).
const APPS: { id: App; label: string; emoji: string; tile: GlyphName; soon?: boolean }[] = [
  { id: "news", label: "News", emoji: "📰", tile: "news" },
  { id: "messages", label: "Messages", emoji: "💬", tile: "chat", soon: true },
  // v0.10 neighborhood gossip (migration 0035); hidden until it runs.
  { id: "tea", label: "Tea", emoji: "🍵", tile: "tree" },
  // v0.14 Real Clout FM (migration 0057); hidden until it runs.
  { id: "radio", label: "Radio", emoji: "📻", tile: "radio" },
  // v0.14 Clout TV (migration 0058); hidden until it runs.
  { id: "tv", label: "Clout TV", emoji: "📺", tile: "tv" },
  { id: "bank", label: "Bank", emoji: "💵", tile: "cash" },
  // v0.12 businesses (migration 0048); hidden until it runs.
  { id: "businesses", label: "Businesses", emoji: "🏪", tile: "condo" },
  // v0.13 Better Together (migration 0050); hidden until it runs.
  { id: "jobs", label: "Jobs", emoji: "🛋️", tile: "briefcase" },
  // #19 moving up (migration 0045); hidden until it runs.
  { id: "apartments", label: "Apartments", emoji: "🔑", tile: "house" },
  // v0.7: the Collection's front door (owner, Oct 13). It opens the Collection sheet over the game.
  { id: "collection", label: "Collection", emoji: "💌", tile: "book" },
  { id: "gigs", label: "Gigs", emoji: "💼", tile: "briefcase" },
  { id: "settings", label: "Settings", emoji: "⚙️", tile: "gear" },
];

const TIER_TAG: Record<GigOffer["tier"], { label: string; cls: string }> = {
  side: { label: "Side gig", cls: "tag-neutral" },
  pro: { label: "Pro gig", cls: "tag-pro" },
  big: { label: "Big break", cls: "tag-event" },
};

/** C29: the Phone, with the Gigs, Bank and Settings apps (News and Messages arrive later). */
const noop = () => {};
const NO_STORY: NewsHandlers = { busy: null, vote: noop, shadowGuess: noop, markSeen: noop, completeTask: noop, onUnlock: noop };

export function PhoneModal({
  open, onClose, time, state, busy, onAccept, onCollect, muted, onToggleSound, gossip, initialApp, story, news, focusBeat, cityNews,
  chat, chatWith, chatUnread = 0, onChatUnread, onToast, dating, crew, onOpenCollection, handle = "", tea, apartments, onChatPass, businesses, jobs, radio, radioDot, tv, stations, openForm,
}: {
  open: boolean;
  onClose: () => void;
  time: string;
  state: CityState | null;
  busy: string | null;
  onAccept: (id: number) => void;
  onCollect: (id: number) => void;
  muted: boolean;
  onToggleSound: () => void;
  /** v0.9 (migration 0029): "Keep me out of the gossip", and the player's "Spotted at" lines. */
  gossip?: { optedOut: boolean; spotted: PartyMention[]; onToggle: () => void };
  initialApp?: App | null;
  story?: StoryFeed | null;
  news?: NewsHandlers;
  focusBeat?: string | null;
  /** v0.6 City News: published items and today's date (New York). */
  cityNews?: CityNews;
  /** v0.5 chat (migration 0010); without it Messages says it opens soon. */
  chat?: ChatApi;
  chatWith?: { id: string; name: string; style: string } | null;
  /** Meeting players (migration 0047): opens the unlimited chat offer (`out` when the day's messages ran out). */
  onChatPass?: (out: boolean) => void;
  chatUnread?: number;
  onChatUnread?: (n: number) => void;
  /** v0.5 crushes and date nights: the Messages app shows tonight's dates and the crush button. */
  dating?: MessagesDating;
  /** Crew outings: a "Crew plans" row in Messages. */
  crew?: { alerts: number; onOpen: () => void };
  onToast?: (text: string) => void;
  /** v0.7: the Collection app closes the phone and opens the Collection; without it the app is hidden. */
  onOpenCollection?: () => void;
  /** The player's @handle, on the Bank's virtual card. */
  handle?: string;
  /** #19 moving up: the Apartments app; without it the app is hidden. */
  apartments?: { busy: boolean; onLookInside: (homeId: string) => void; onMove: (homeId: string) => void };
  /** v0.12 businesses: the Businesses app; without it the app is hidden. */
  businesses?: Omit<React.ComponentProps<typeof BusinessesApp>, "onHome">;
  /** v0.13 the Jobs app (migration 0050); without it the app is hidden. */
  jobs?: Omit<React.ComponentProps<typeof JobsApp>, "onHome">;
  /** v0.14 Real Clout FM: the Radio app; without it the app is hidden. */
  radio?: RadioApi;
  /** A shoutout on air the player hasn't seen yet. */
  radioDot?: boolean;
  /** v0.14: opened from a station's button, straight to the Radio or Clout TV form. */
  openForm?: boolean;
  /** v0.14 Clout TV: the Clout TV app; without it the app is hidden. */
  tv?: { api: TvApi; onChange?: (s: TvState) => void };
  /** v0.14 texts from Real Clout FM and Clout TV, in Messages. */
  stations?: { threads: StationThread[]; onRead: (station: Station) => void };
  /** v0.10 gossip: the Tea app; without it the app is hidden. */
  tea?: { state: GossipState; busy: boolean; onShare?: (storyId: string, piece: number) => void; onOpenCard: (c: TeaCard) => void };
}) {
  const [app, setApp] = useState<App | null>(initialApp ?? null);
  const [lastInitial, setLastInitial] = useState(initialApp);
  if (initialApp !== lastInitial) {
    setLastInitial(initialApp);
    setApp(initialApp ?? null);
  }
  const now = useGameNow(state?.clockOffsetSeconds ?? 0);
  if (!open) return null;
  const ready = state ? activeGig(state) : undefined;
  const payoutReady = !!ready && gigReady(ready, now);

  return (
    <div className="modal-wrap phone-wrap" role="dialog" aria-modal="true" aria-label="Phone">
      <div className="scrim" onClick={onClose} aria-hidden="true" />
      <button className="icon-round phone-close" onClick={onClose} aria-label="Close phone"><CloseIcon size={18} /></button>
      <div className="phone-device">
        <div className="phone-screen">
          <div className={`phone-status${app ? " light" : ""}`}>
            <span>{time}</span>
            <span className="phone-pill" aria-hidden="true" />
            <span className="phone-status-icons" aria-hidden="true">
              {/* #34: drawn icons, so they don't stretch or turn sideways like emoji did. */}
              <svg width="18" height="12" viewBox="0 0 18 12" fill="currentColor">
                <rect x="0" y="8" width="3" height="4" rx="1" /><rect x="5" y="5.5" width="3" height="6.5" rx="1" />
                <rect x="10" y="3" width="3" height="9" rx="1" /><rect x="15" y="0" width="3" height="12" rx="1" opacity=".4" />
              </svg>
              <svg width="26" height="12" viewBox="0 0 26 12">
                <rect x=".5" y=".5" width="22" height="11" rx="3" fill="none" stroke="currentColor" opacity=".5" />
                <rect x="2" y="2" width="15" height="8" rx="1.6" fill="currentColor" />
                <rect x="23.5" y="4" width="1.8" height="4" rx=".9" fill="currentColor" opacity=".5" />
              </svg>
            </span>
          </div>
          {app === null ? (
            <div className="phone-home">
              <div className="phone-clock">{time.replace(/ [AP]M$/, "") || "9:41"}</div>
              <div className="phone-city">Queens</div>
              <div className="phone-grid">
                {APPS.filter((a) => (a.id !== "collection" || onOpenCollection) && (a.id !== "tea" || tea) && (a.id !== "apartments" || (apartments && state)) && (a.id !== "businesses" || businesses) && (a.id !== "jobs" || jobs) && (a.id !== "radio" || radio) && (a.id !== "tv" || tv)).map((a) => (
                  <button key={a.id} className="phone-app" onClick={() => (a.id === "collection" ? onOpenCollection!() : setApp(a.id))}>
                    <span className="phone-icon" style={{ background: tileBackground(a.tile) }} aria-hidden="true">
                      {a.emoji}
                      {a.id === "radio" && radioDot && <span className="pin-dot" style={{ top: -3, right: -3 }} />}
                      {a.id === "gigs" && payoutReady && <span className="pin-dot" style={{ top: -3, right: -3 }} />}
                      {a.id === "tea" && tea && tea.state.stories.some((x) => !x.done && x.pieces.some((p) => p.found)) && <span className="pin-dot" style={{ top: -3, right: -3 }} />}
                      {a.id === "news" && unseenBeats(story ?? null) > 0 && <span className="count-badge">{unseenBeats(story ?? null)}</span>}
                      {a.id === "messages" && (() => {
                        const n = chatUnread + (dating?.alerts ?? 0) + (crew?.alerts ?? 0) + (stations?.threads.reduce((x, t) => x + t.unread, 0) ?? 0);
                        return n > 0 && <span className="count-badge">{n}</span>;
                      })()}
                    </span>
                    <span>{a.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="phone-app-screen">
              {/* Tea draws its own back button (a story goes back to the list first). */}
              {app !== "tea" && app !== "businesses" && app !== "jobs" && <button className="phone-back" onClick={() => setApp(null)}><ChevronLeftIcon size={20} /> Home</button>}
              {/* News, Tea and Businesses draw their own headers (a business goes back to the list first). */}
              {app !== "news" && app !== "tea" && app !== "businesses" && app !== "jobs" && <h2 className="display-lg" style={{ margin: "4px 0 12px" }}>{APPS.find((a) => a.id === app)!.label}</h2>}
              {app === "gigs" && (state ? <GigsApp state={state} now={now} busy={busy} onAccept={onAccept} onCollect={onCollect} /> : <Soon text="Gigs open with the city." />)}
              {app === "businesses" && businesses && <BusinessesApp {...businesses} onHome={() => setApp(null)} />}
              {app === "jobs" && jobs && <JobsApp {...jobs} onHome={() => setApp(null)} />}
              {app === "radio" && radio && <RadioApp api={radio} startForm={openForm && app === initialApp} onToast={(t) => onToast?.(t)} />}
              {app === "tv" && tv && <TvApp api={tv.api} startForm={openForm && app === initialApp} onChange={tv.onChange} onToast={(t) => onToast?.(t)} />}
              {app === "apartments" && apartments && state && <ApartmentsApp state={state} busy={apartments.busy} onLookInside={apartments.onLookInside} onMove={apartments.onMove} />}
              {app === "bank" && (state ? <BankView balance={state.player.bank_cash} handle={handle} /> : <Soon text="The Bank opens with the city." />)}
              {app === "settings" && (
                <div className="stack-12">
                  <div className="list-row static">
                    <span style={{ flex: 1 }}><span className="title" style={{ display: "block" }}>Music</span><span className="meta">Lo-fi city loop</span></span>
                    <button className="chip" aria-pressed={!muted} onClick={onToggleSound}>{muted ? "Off" : "On"}</button>
                  </div>
                  {gossip && (
                    <div className="list-row static">
                      <span style={{ flex: 1 }}>
                        <span className="title" style={{ display: "block" }}>Keep me out of the gossip</span>
                        <span className="meta">Your name stays out of Lola&apos;s &ldquo;Spotted at&rdquo; party lines</span>
                      </span>
                      <button className="chip" aria-pressed={gossip.optedOut} onClick={gossip.onToggle}>{gossip.optedOut ? "On" : "Off"}</button>
                    </div>
                  )}
                  {chat?.setMessagesFrom && <ChatSettings api={chat} onToast={onToast} onChatPass={onChatPass} />}
                  <form action="/auth/signout" method="post"><button className="btn btn-secondary" type="submit">Log out</button></form>
                </div>
              )}
              {app === "news" && (news || cityNews ? <NewsApp feed={story ?? null} handlers={news ?? NO_STORY} focusBeat={focusBeat} city={cityNews} spotted={gossip?.spotted} jackpots={state?.lotto?.wins} /> : <Soon text="Lola Lowdown is still fact-checking. Barely. The News app opens soon." />)}
              {app === "tea" && tea && <TeaApp stories={tea.state.stories} cards={tea.state.cards} busy={tea.busy} onHome={() => setApp(null)} onShare={tea.onShare} onOpenCard={tea.onOpenCard} />}
              {app === "messages" && (chat
                ? <MessagesApp api={chat} openWith={chatWith} onToast={(t) => onToast?.(t)} onUnread={onChatUnread} dating={dating} crew={crew} stations={stations} onOutOfMessages={onChatPass ? () => onChatPass(true) : undefined} />
                : <Soon text="The group chat is on mute until the city is ready to gossip. Messages arrive soon." />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Soon({ text }: { text: string }) {
  return (
    <div className="card hazard-edge stack-4" style={{ paddingLeft: 22 }}>
      <p className="overline" style={{ margin: 0 }}>Coming soon</p>
      <p className="body" style={{ margin: 0, color: "var(--text-2)" }}>{text}</p>
    </div>
  );
}

const blurbFor = (g: GigOffer) => GIG_TITLES[g.tier].find((t) => t.title === g.title)?.blurb ?? "";

/** C36: today's offers and the active gig. */
function GigsApp({ state, now, busy, onAccept, onCollect }: { state: CityState; now: number; busy: string | null; onAccept: (id: number) => void; onCollect: (id: number) => void }) {
  const active = activeGig(state);
  const offers = state.gigs.filter((g) => !g.accepted_at && g.ny_date === state.today);
  const done = state.gigs.filter((g) => g.collected_at && g.ny_date === state.today);
  return (
    <div className="stack-12">
      {active && (() => {
        const total = active.wait_minutes * 60_000;
        const left = new Date(active.ready_at!).getTime() - now;
        const pct = Math.min(100, Math.max(0, ((total - left) / total) * 100));
        const ready = left <= 0;
        return (
          <div className="gig-card active">
            <span className={`tag ${TIER_TAG[active.tier].cls}`}>{TIER_TAG[active.tier].label} · In progress</span>
            <span className="title" style={{ display: "block" }}>{active.title}</span>
            <div className="gig-progress"><span style={{ width: `${pct}%` }} /></div>
            {ready ? (
              <button className="btn btn-taxi btn-sm" disabled={busy !== null} onClick={() => onCollect(active.id)}>
                {busy === `gig:${active.id}` ? "…" : `Collect ${formatCash(active.pay)}`}
              </button>
            ) : (
              <span className="meta">⏱ {formatCountdown(left)} left · pays {formatCash(active.pay)}</span>
            )}
          </div>
        );
      })()}
      {offers.length === 0 && !active && <p className="subtext">No offers left today. New ones land after midnight.</p>}
      {offers.map((g) => {
        const av = gigAvailability(g, state);
        const locked = state.player.confidence < g.confidence_req || state.player.clout < gigCloutReq(g.tier);
        return (
          <div key={g.id} className={`gig-card${locked ? " locked" : ""}`}>
            <span className={`tag ${TIER_TAG[g.tier].cls}`}>{locked ? "🔒 " : ""}{TIER_TAG[g.tier].label}</span>
            <span className="title" style={{ display: "block" }}>{g.title}</span>
            <span className="subtext">{blurbFor(g)}</span>
            <span className="meta gig-meta">
              <span className="money-pos">{formatCash(g.pay)}</span> · ⚡ −{g.energy} · ⏱ {g.wait_minutes >= 60 ? `${g.wait_minutes / 60} h` : `${g.wait_minutes} min`}
            </span>
            {!av.ok && <span className="meta reason">{av.reason}</span>}
            <button className="btn btn-taxi btn-sm" disabled={!av.ok || busy !== null} onClick={() => onAccept(g.id)}>
              {busy === `gig:${g.id}` ? "…" : "Take the gig"}
            </button>
            <span className="meta">Expires at midnight.</span>
          </div>
        );
      })}
      {done.length > 0 && <p className="meta">Paid today: {done.map((g) => formatCash(g.pay)).join(", ")}</p>}
    </div>
  );
}

/** Meeting players (owner, Oct 15): who can message me, and unlimited chat. */
function ChatSettings({ api, onToast, onChatPass }: { api: ChatApi; onToast?: (t: string) => void; onChatPass?: (out: boolean) => void }) {
  const [status, setStatus] = useState<import("@/lib/chat").ChatStatus | null>(null);
  useEffect(() => { void api.status().then((r) => r.ok && setStatus(r.data)); }, [api]);
  const set = async (who: "anyone" | "crew") => {
    const r = await api.setMessagesFrom!(who);
    if (!r.ok) return onToast?.(r.error);
    setStatus((s) => (s ? { ...s, messagesFrom: r.data } : s));
    onToast?.(who === "crew" ? "Only your crew can message you now." : "Anyone can say hi now.");
  };
  if (!status) return null;
  return (
    <>
      <div className="list-row static">
        <span style={{ flex: 1 }}>
          <span className="title" style={{ display: "block" }}>Who can message me</span>
          <span className="meta">Messages and reactions from players you meet</span>
        </span>
        <span className="row" style={{ gap: 6 }}>
          <button className="chip" aria-pressed={status.messagesFrom !== "crew"} onClick={() => void set("anyone")}>Anyone</button>
          <button className="chip" aria-pressed={status.messagesFrom === "crew"} onClick={() => void set("crew")}>My crew</button>
        </span>
      </div>
      <div className="list-row static">
        <span style={{ flex: 1 }}>
          <span className="title" style={{ display: "block" }}>Chat</span>
          <span className="meta">{status.vip ? "👑 VIP · unlimited chat and side stories" : status.unlimited ? "✨ Unlimited chat is on" : `${status.left} of ${status.limit} messages left today`}</span>
        </span>
        {!status.unlimited && onChatPass && <button className="chip" onClick={() => onChatPass(false)}>Get VIP</button>}
      </div>
    </>
  );
}
