"use client";

import { PushSettings } from "../push/Push";
import { MembershipRow } from "../store/Membership";
import { GraphicsSwitch } from "../GraphicsSwitch";
import { ConsentSwitch } from "../ConsentBanner";
import { DeleteAccountRow } from "../DeleteAccount";
import { Toggle } from "../Toggle";
import type { PushApi } from "@/lib/pushClient";

import type { PartyMention } from "@/lib/party";
import { JobsApp } from "../together/Together";
import { useEffect, useState } from "react";
import { GIG_TITLES } from "@/lib/city";
import { activeGig, gigAvailability, gigCloutReq, gigReady, type CityState, type GigOffer } from "@/lib/cityState";
import { formatCash } from "@/lib/economy";
import { tileBackground, type GlyphName } from "../AppGlyph";
import { TeaApp } from "./Gossip";
import { MayorApp } from "./Mayor";
import type { MayorApi } from "@/lib/mayor";
import type { ElectionTeaser } from "@/components/story/News";
import { RadioApp } from "./Radio";
import { TvApp } from "./CloutTv";
import type { Station, StationThread, TvApi, TvState } from "@/lib/cloutTv";
import type { RadioApi } from "@/lib/radio";
import { BusinessesApp } from "./Businesses";
import { ApartmentsApp } from "./Apartments";
import { SubletsApp, type SubletHandlers } from "./Sublets";
import { subletAlerts, type SubletState } from "@/lib/sublets";
import type { GossipState, TeaCard } from "@/lib/gossip";
import { BankView } from "../game/Sheets";
import { NewsApp, type CityNews, type NewsHandlers } from "../story/News";
import { MessagesApp, type MessagesDating } from "../chat/Messages";
import type { ChatApi } from "@/lib/chat";
import { unseenBeats, type StoryFeed } from "@/lib/storyFeed";
import { ChevronLeftIcon, CloseIcon } from "../icons";
import { formatCountdown, useGameNow } from "./Common";
import { whenLine, type CalendarEvent } from "@/lib/calendar";
import { PerkAction, type PerkHandlers } from "../game/Skills";
import { SKILLS, SKILL_PERKS, perkStatus } from "@/lib/skills";

export type App = "gigs" | "bank" | "settings" | "news" | "messages" | "collection" | "tea" | "apartments" | "businesses" | "jobs" | "radio" | "tv" | "mayor" | "campaign";

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
  // Contact the Mayor (migration 0105): feedback to the team; hidden without it.
  { id: "mayor", label: "Mayor", emoji: "🏛️", tile: "columns" },
  // Campaign Mode (migration 0127): opens the Campaign sheet over the game; before Rank 2 it shows the teaser.
  { id: "campaign", label: "Campaign", emoji: "🗳️", tile: "news" },
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
  open, onClose, time, state, busy, onAccept, onCollect, perks, muted, onToggleSound, gossip, initialApp, story, news, focusBeat, cityNews,
  chat, chatWith, chatUnread = 0, onChatUnread, onToast, dating, crew, onOpenCollection, handle = "", tea, apartments, onChatPass, businesses, jobs, radio, radioDot, tv, stations, openForm, push, membership, onDeleteAccount,
  invite, mayor, locked, onOpenCampaign, election, scandals, blotter,
}: {
  open: boolean;
  onClose: () => void;
  time: string;
  state: CityState | null;
  busy: string | null;
  onAccept: (id: number) => void;
  onCollect: (id: number) => void;
  /** Skill perks (migration 0092): the skill gigs your levels have opened. */
  perks?: PerkHandlers;
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
  /** Push notifications (migration 0078): Settings → Notifications; hidden without it. */
  push?: PushApi;
  /** Membership & purchases (owner, Oct 18): the top row of Settings; hidden without payments. */
  membership?: { vip: "vip" | "forever" | null; onOpen: () => void };
  /** Delete my account (Settings' last row). */
  onDeleteAccount?: () => void;
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
  /** Apps locked until a rank (owner, Oct 26): the label says when ("Rank 2"). */
  locked?: Partial<Record<App, string>>;
  apartments?: {
    busy: boolean; onLookInside: (homeId: string) => void; onMove: (homeId: string) => void;
    /** Sublets (migration 0119): Apartments gets a Rent / Sublets switch. */
    sublets?: { state: SubletState | null; h: SubletHandlers; onOpen: () => void };
  };
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
  /** Culture pack C5: a neighbor's name-day invite on the home screen; "See it" opens it in Events. */
  invite?: { event: CalendarEvent; onOpen: () => void };
  /** Contact the Mayor (migration 0105): the feedback app, and whether a reply waits unread; without it the app is hidden. */
  mayor?: { api: MayorApi; unseen: number; onSeen: () => void };
  /** Campaign Mode: the Campaign app closes the phone and opens the Campaign sheet; without it the app is hidden. */
  onOpenCampaign?: () => void;
  /** Campaign Mode's "Upcoming election" card in News → City (while no campaign runs). */
  election?: ElectionTeaser;
  /** Campaign Mode: Lola's write-ups of the player's campaign scandals, in News → City. */
  scandals?: string[];
  /** Moral Choices: Lola's Blotter for News → City. */
  blotter?: import("@/lib/choices").BlotterItem[];
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
              {invite && (
                <button className="phone-invite" onClick={invite.onOpen}>
                  <span className="phone-invite-head">💌 You're invited · {invite.event.host?.split(",")[0]}</span>
                  <strong>{invite.event.title}</strong>
                  <span>{whenLine(invite.event, now)}. Dress up, and don't come empty-handed.</span>
                </button>
              )}
              <div className="phone-grid">
                {APPS.filter((a) => (a.id !== "collection" || onOpenCollection) && (a.id !== "tea" || tea) && (a.id !== "apartments" || (apartments && state)) && (a.id !== "businesses" || businesses) && (a.id !== "jobs" || jobs) && (a.id !== "radio" || radio) && (a.id !== "tv" || tv) && (a.id !== "mayor" || mayor) && (a.id !== "campaign" || onOpenCampaign)).map((a) => (
                  <button key={a.id} className={`phone-app${locked?.[a.id] ? " locked" : ""}`} aria-label={locked?.[a.id] ? `${a.label}, opens at ${locked[a.id]}` : undefined}
                    onClick={() => (a.id === "campaign" ? onOpenCampaign!() : locked?.[a.id] ? onToast?.(`🔒 ${a.label} opens at ${locked[a.id]}. Keep earning clout.`) : a.id === "collection" ? onOpenCollection!() : setApp(a.id))}>
                    <span style={{ position: "relative" }}>
                    {locked?.[a.id] && <span className="phone-lock" aria-hidden="true">🔒</span>}
                    <span className="phone-icon" style={{ background: tileBackground(a.tile) }} aria-hidden="true">
                      {a.emoji}
                      {a.id === "radio" && radioDot && <span className="pin-dot" style={{ top: -3, right: -3 }} />}
                      {a.id === "mayor" && mayor && mayor.unseen > 0 && <span className="count-badge">{mayor.unseen}</span>}
                      {a.id === "apartments" && subletAlerts(apartments?.sublets?.state ?? null) > 0 && <span className="count-badge">{subletAlerts(apartments!.sublets!.state)}</span>}
                      {a.id === "gigs" && payoutReady && <span className="pin-dot" style={{ top: -3, right: -3 }} />}
                      {a.id === "tea" && tea && tea.state.stories.some((x) => !x.done && x.pieces.some((p) => p.found)) && <span className="pin-dot" style={{ top: -3, right: -3 }} />}
                      {a.id === "news" && unseenBeats(story ?? null) > 0 && <span className="count-badge">{unseenBeats(story ?? null)}</span>}
                      {a.id === "messages" && (() => {
                        const n = chatUnread + (dating?.alerts ?? 0) + (crew?.alerts ?? 0) + (stations?.threads.reduce((x, t) => x + t.unread, 0) ?? 0);
                        return n > 0 && <span className="count-badge">{n}</span>;
                      })()}
                    </span>
                    </span>
                    <span>{a.label}{locked?.[a.id] && <small>{locked[a.id]}</small>}</span>
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
              {app === "gigs" && (state ? <GigsApp state={state} now={now} busy={busy} onAccept={onAccept} onCollect={onCollect} perks={perks} /> : <Soon text="Gigs open with the city." />)}
              {app === "businesses" && businesses && <BusinessesApp {...businesses} onHome={() => setApp(null)} />}
              {app === "jobs" && jobs && <JobsApp {...jobs} onHome={() => setApp(null)} />}
              {app === "radio" && radio && <RadioApp api={radio} startForm={openForm && app === initialApp} onToast={(t) => onToast?.(t)} />}
              {app === "mayor" && mayor && <MayorApp api={mayor.api} onSeen={mayor.onSeen} onToast={(t) => onToast?.(t)} />}
              {app === "tv" && tv && <TvApp api={tv.api} startForm={openForm && app === initialApp} onChange={tv.onChange} onToast={(t) => onToast?.(t)} />}
              {app === "apartments" && apartments && state && (apartments.sublets
                ? <ApartmentsTabs apartments={apartments as Required<NonNullable<typeof apartments>>} state={state} />
                : <ApartmentsApp state={state} busy={apartments.busy} onLookInside={apartments.onLookInside} onMove={apartments.onMove} />)}
              {app === "bank" && (state ? <BankView balance={state.player.bank_cash} handle={handle} /> : <Soon text="The Bank opens with the city." />)}
              {app === "settings" && (
                <div className="stack-12">
                  {membership && <MembershipRow vip={membership.vip} onOpen={membership.onOpen} />}
                  <div className="list-row static">
                    <span style={{ flex: 1 }}><span className="title" style={{ display: "block" }}>Music</span><span className="meta">Lo-fi city loop</span></span>
                    <Toggle on={!muted} label="Music" onChange={onToggleSound} />
                  </div>
                  <GraphicsSwitch kind="low" onToast={onToast} />
                  {/* Privacy choices (owner, Oct 27): the analytics consent, changeable any time. */}
                  <ConsentSwitch onToast={onToast} />
                  {gossip && (
                    <div className="list-row static">
                      <span style={{ flex: 1 }}>
                        <span className="title" style={{ display: "block" }}>Keep me out of the gossip</span>
                        <span className="meta">Your name stays out of Lola&apos;s &ldquo;Spotted at&rdquo; party lines</span>
                      </span>
                      <Toggle on={gossip.optedOut} label="Keep me out of the gossip" onChange={gossip.onToggle} />
                    </div>
                  )}
                  {push && <PushSettings api={push} onToast={onToast} />}
                  {chat?.setMessagesFrom && <ChatSettings api={chat} onToast={onToast} onChatPass={onChatPass} />}
                  <form action="/auth/signout" method="post"><button className="btn btn-secondary" type="submit">Log out</button></form>
                  {/* Owner, Oct 27: GDPR right to erasure. */}
                  {onDeleteAccount && <DeleteAccountRow onOpen={onDeleteAccount} />}
                </div>
              )}
              {app === "news" && (news || cityNews ? <NewsApp feed={story ?? null} handlers={news ?? NO_STORY} focusBeat={focusBeat} city={cityNews} spotted={gossip?.spotted} jackpots={state?.lotto?.wins} election={election} scandals={scandals} blotter={blotter} /> : <Soon text="Lola Lowdown is still fact-checking. Barely. The News app opens soon." />)}
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
function GigsApp({ state, now, busy, onAccept, onCollect, perks }: { state: CityState; now: number; busy: string | null; onAccept: (id: number) => void; onCollect: (id: number) => void; perks?: PerkHandlers }) {
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
            {/* The gig's joke plays while it runs, not on the offer. */}
            <span className="subtext">{blurbFor(active)}</span>
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
      {/* Owner, Oct 30 (fewer words): the title is the joke; "expires at midnight" is said once, not on every card. */}
      {offers.length > 0 && <p className="meta" style={{ margin: 0 }}>Today&apos;s offers expire at midnight.</p>}
      {offers.map((g) => {
        const av = gigAvailability(g, state);
        const locked = state.player.confidence < g.confidence_req || state.player.clout < gigCloutReq(g.tier);
        return (
          <div key={g.id} className={`gig-card${locked ? " locked" : ""}`}>
            <span className={`tag ${TIER_TAG[g.tier].cls}`}>{locked ? "🔒 " : ""}{TIER_TAG[g.tier].label}</span>
            <span className="title" style={{ display: "block" }}>{g.title}</span>
            <span className="meta gig-meta">
              <span className="money-pos">{formatCash(g.pay)}</span> · ⚡ −{g.energy} · ⏱ {g.wait_minutes >= 60 ? `${g.wait_minutes / 60} h` : `${g.wait_minutes} min`}
            </span>
            {!av.ok && <span className="meta reason">{av.reason}</span>}
            <button className="btn btn-taxi btn-sm" disabled={!av.ok || busy !== null} onClick={() => onAccept(g.id)}>
              {busy === `gig:${g.id}` ? "…" : "Take the gig"}
            </button>
          </div>
        );
      })}
      {done.length > 0 && <p className="meta">Paid today: {done.map((g) => formatCash(g.pay)).join(", ")}</p>}
      {perks && <SkillGigs perks={perks} now={now} />}
    </div>
  );
}

/** Skill gigs (owner, Oct 19): what your skills have opened, once a week each. */
function SkillGigs({ perks, now }: { perks: PerkHandlers; now: number }) {
  const gigs = SKILL_PERKS.filter((p) => p.kind === "gig");
  const open = gigs.filter((p) => perkStatus(p, perks.state, now) !== "locked");
  const next = gigs.filter((p) => perkStatus(p, perks.state, now) === "locked").sort((a, b) =>
    (a.level - (perks.state.levels[a.skill] ?? 0)) - (b.level - (perks.state.levels[b.skill] ?? 0)))[0];
  return (
    <div className="stack-8">
      <p className="overline" style={{ margin: "8px 0 0" }}>From your skills</p>
      {open.length === 0 && <p className="subtext" style={{ margin: 0 }}>Get any skill to level 3 and clients start calling.</p>}
      {open.map((p) => {
        const skill = SKILLS.find((x) => x.id === p.skill)!;
        return (
          <div key={p.id} className="gig-card skill-gig">
            <span className="tag tag-skill">{skill.emoji} {skill.name} {p.level}</span>
            <span className="title" style={{ display: "block" }}>{p.emoji} {p.name}</span>
            <span className="subtext">{p.blurb}</span>
            <span className="meta gig-meta">
              <span className="money-pos">{formatCash(p.pay ?? 0)}</span>{p.clout ? ` + ${p.clout} clout` : ""} · ⚡ −{p.energy} · ⏱ {(p.waitMinutes ?? 0) / 60} h · once a week
            </span>
            <PerkAction perk={p} state={perks.state} now={now} handlers={perks} />
          </div>
        );
      })}
      {next && (
        <p className="meta" style={{ margin: 0 }}>
          Next: {next.emoji} {next.name} at {SKILLS.find((x) => x.id === next.skill)!.name} {next.level}. Your profile's Skills tab shows them all.
        </p>
      )}
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

/** Apartments with sublets (migration 0119): Rent (moving) and Sublets. Opens on Sublets when one is going on. */
function ApartmentsTabs({ apartments, state }: { apartments: Required<NonNullable<Parameters<typeof PhoneModal>[0]["apartments"]>>; state: CityState }) {
  const sub = apartments.sublets.state;
  const busy = !!sub && !!(sub.live || sub.mine || sub.ended || subletAlerts(sub) > 0);
  const [tab, setTab] = useState<"rent" | "sublets">(busy ? "sublets" : "rent");
  const { onOpen } = apartments.sublets;
  useEffect(() => { onOpen(); }, [onOpen]);
  // The state can arrive after the app opens: a sublet going on switches to its tab, once.
  const [switched, setSwitched] = useState(busy);
  useEffect(() => { if (busy && !switched) { setSwitched(true); setTab("sublets"); } }, [busy, switched]);
  return (
    <div className="stack-12">
      <div className="segmented" role="group" aria-label="Apartments">
        <button aria-pressed={tab === "rent"} onClick={() => setTab("rent")}>Rent</button>
        <button aria-pressed={tab === "sublets"} onClick={() => setTab("sublets")}>Sublets{subletAlerts(sub) > 0 ? ` · ${subletAlerts(sub)}` : ""}</button>
      </div>
      {tab === "rent"
        ? <ApartmentsApp state={state} busy={apartments.busy} onLookInside={apartments.onLookInside} onMove={apartments.onMove} />
        : <SubletsApp state={sub} myHomeId={state.player.home_id} bank={state.player.bank_cash} h={apartments.sublets.h} />}
    </div>
  );
}
