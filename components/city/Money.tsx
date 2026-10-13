"use client";

import { useState } from "react";
import { CITY_ECONOMY, placeById } from "@/lib/city";
import { formatPrice, partyState, POSTCARD_BADGE, POSTCARD_NOTES, serialLabel, type StoreProduct } from "@/lib/store";
import type { HuntCard } from "@/lib/hunts";
import { Sheet } from "../Sheet";
import { EffectChips, SheetTitle } from "./Common";
import { PlaceArt } from "./PlaceArt";

// Real-money products in the city (Clarifications 6, Design Guide C26 and C39):
// exclusive events, monument postcards and the Collection. Buying always goes
// through Stripe Checkout; only the webhook unlocks anything.

export interface MoneyHandlers {
  busy: string | null;
  buy: (sku: string) => void;
  attend: (eventId: string) => void;
  /** Analytics: a postcard was shared. */
  onShared?: () => void;
}

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { timeZone: "America/New_York", weekday: "short", hour: "numeric", minute: "2-digit" });

/** C26: an exclusive event (a celebrity party), sold as a guest-list spot. */
export function ExclusiveEventCard({ p, nowMs, h, compact = false }: { p: StoreProduct; nowMs: number; h: MoneyHandlers; compact?: boolean }) {
  const e = p.event!;
  const s = partyState(e, nowMs);
  const where = placeById(e.placeId)?.name ?? "";
  const buying = h.busy === `buy:${p.sku}`;
  return (
    <div className="exclusive-card stack-8">
      <div className="row" style={{ justifyContent: "space-between", gap: 8 }}>
        <span className="tag tag-gold">✨ Exclusive{s.open ? " · Happening now" : ""}</span>
        {p.owned && <span className="tag on-list">On the list</span>}
      </div>
      <span className="title" style={{ display: "block", color: "#fff" }}>{e.name}</span>
      {!compact && <span className="subtext" style={{ color: "rgba(255,246,224,.78)" }}>{e.blurb}</span>}
      <span className="meta" style={{ color: "rgba(255,246,224,.7)" }}>
        {where} · {when(e.startsAt)} New York time
      </span>
      <EffectChips energy={e.energy} clout={p.owned ? undefined : e.clout} mood={e.mood} confidence={e.confidence} />
      {p.owned ? (
        e.attended ? (
          <span className="owned-chip">You were there. Everyone saw.</span>
        ) : s.open ? (
          <button className="btn btn-taxi btn-sm" disabled={h.busy !== null} onClick={() => h.attend(e.id)}>
            {h.busy === `party:${e.id}` ? "…" : "Pull up"}
          </button>
        ) : (
          <span className="meta" style={{ color: "rgba(255,246,224,.85)" }}>
            {s.minutesToOpen < 24 * 60 ? `Doors open in ${s.minutesToOpen} min` : `Doors open ${when(e.startsAt)}`}
          </span>
        )
      ) : p.pending ? (
        <button className="btn btn-taxi btn-sm" disabled>Unlocking… payment received</button>
      ) : (
        <button className="btn btn-taxi btn-sm" disabled={h.busy !== null} onClick={() => h.buy(p.sku)}>
          {buying ? "Opening checkout…" : `Get on the list · ${formatPrice(p.priceCents, p.currency)}`}
        </button>
      )}
    </div>
  );
}

/**
 * C39: a postcard: the monument's illustration in a vintage frame. Owned cards are full color with
 * a foil sheen and their serial; visited ones are a dulled preview of the same art (owner, Oct 13);
 * the rest are a faint outline until visited.
 */
export function Postcard({ p, state, label }: { p: StoreProduct; state: "owned" | "locked" | "unvisited"; label?: string }) {
  const place = p.placeId ? placeById(p.placeId) : undefined;
  return (
    <div className={`postcard ${state}`}>
      <div className="postcard-art">{place && <PlaceArt place={place} daytime />}</div>
      <span className="postcard-greeting">Greetings from Queens</span>
      {state === "owned" && p.serial ? <span className="card-serial">{serialLabel(p.serial)}</span> : null}
      {label && <span className="card-chip">{label}</span>}
    </div>
  );
}

/** C39: offered on the monument's card after a visit, as a dulled preview of the card itself. */
export function PostcardOffer({ p, h }: { p: StoreProduct; h: MoneyHandlers }) {
  if (p.owned) return null;
  return (
    <div className="postcard-offer">
      <Postcard p={p} state="locked" label="Not in your Collection yet" />
      <div className="row" style={{ gap: 12, justifyContent: "space-between" }}>
        <span style={{ minWidth: 0 }}>
          <span className="title" style={{ display: "block" }}>Collect the postcard</span>
          <span className="meta">This exact card, in full color and numbered. Postcards don&apos;t pay clout; the visit did.</span>
        </span>
        {p.pending ? (
          <button className="btn btn-taxi btn-sm" disabled>Unlocking…</button>
        ) : (
          <button className="btn btn-taxi btn-sm" disabled={h.busy !== null} onClick={() => h.buy(p.sku)}>
            {h.busy === `buy:${p.sku}` ? "…" : formatPrice(p.priceCents, p.currency)}
          </button>
        )}
      </div>
    </div>
  );
}

type Tab = "postcards" | "hunts" | "events";
type Picked = { kind: "postcard"; p: StoreProduct } | { kind: "event"; p: StoreProduct } | { kind: "hunt"; c: HuntCard };
const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" });

/**
 * C39, redesigned in v0.7 (#40): tabs for postcards, hunt cards and event cards, a progress bar per
 * set, and real art in every state. Tap an owned card to flip it.
 */
export function CollectionSheet({ open, onClose, products, h, badge, huntCards = [], handle = "" }: {
  open: boolean; onClose: () => void; products: StoreProduct[]; h: MoneyHandlers; badge: boolean;
  /** v0.6 hunt cards: earned, free, no net-worth value and not for sale. */
  huntCards?: HuntCard[];
  /** The player's @handle, written on the back of their postcards. */
  handle?: string;
}) {
  const [tab, setTab] = useState<Tab>("postcards");
  const [picked, setPicked] = useState<Picked | null>(null);
  const [flipped, setFlipped] = useState(false);
  const cards = products.filter((p) => p.type === "postcard");
  const owned = cards.filter((p) => p.owned).length;
  const events = products.filter((p) => p.type === "exclusive_event" && p.owned && p.event);
  const { badgeAfter } = CITY_ECONOMY.hunt;
  const pick = (x: Picked) => { setPicked(x); setFlipped(false); };
  const share = async (p: StoreProduct) => {
    const text = `${p.name.replace("Postcard: ", "Greetings from ")} · Clout City`;
    try {
      if (navigator.share) await navigator.share({ title: "Clout City", text, url: window.location.origin });
      else await navigator.clipboard?.writeText(`${text} ${window.location.origin}`);
      h.onShared?.();
    } catch {
      /* cancelled share sheet */
    }
  };
  const close = () => { setPicked(null); onClose(); };

  return (
    <Sheet open={open} onClose={picked ? () => setPicked(null) : close} label={picked ? "Card" : "Collection"} tall>
      {picked ? (
        <CardDetail picked={picked} flipped={flipped} onFlip={() => setFlipped((f) => !f)} handle={handle}
          onBack={() => setPicked(null)} onShare={picked.kind === "postcard" ? () => void share(picked.p) : undefined} />
      ) : (
        <div className="stack-16">
          <SheetTitle>Collection</SheetTitle>
          <div className="chip-row collection-tabs" role="tablist" aria-label="Collection">
            <button role="tab" className="chip" aria-selected={tab === "postcards"} aria-pressed={tab === "postcards"} onClick={() => setTab("postcards")}>💌 Postcards <i>{owned}/{cards.length}</i></button>
            <button role="tab" className="chip" aria-selected={tab === "hunts"} aria-pressed={tab === "hunts"} onClick={() => setTab("hunts")}>🗺️ Hunts <i>{huntCards.length}</i></button>
            <button role="tab" className="chip" aria-selected={tab === "events"} aria-pressed={tab === "events"} onClick={() => setTab("events")}>🎟️ Events <i>{events.length}</i></button>
          </div>

          {tab === "postcards" && (
            <>
              <SetProgress title={POSTCARD_BADGE.name} done={owned} total={cards.length}
                line={badge ? `${POSTCARD_BADGE.emoji} Badge earned. ${POSTCARD_BADGE.line}` : `${owned} of ${cards.length} · collect them all for the ${POSTCARD_BADGE.emoji} badge`} />
              <div className="collection-grid">
                {cards.map((p) => {
                  const state = p.owned ? "owned" : p.visited ? "locked" : "unvisited";
                  const place = p.placeId ? placeById(p.placeId) : undefined;
                  return (
                    <div key={p.sku} className="stack-4">
                      {state === "owned" ? (
                        <button className="card-button" onClick={() => pick({ kind: "postcard", p })} aria-label={`${place?.name ?? p.name}, tap to flip`}>
                          <Postcard p={p} state="owned" />
                        </button>
                      ) : (
                        <Postcard p={p} state={state} label={state === "locked" ? "Visited · not collected" : "Visit to unlock"} />
                      )}
                      <span className="body-strong" style={{ display: "block", marginTop: 4 }}>{place?.name ?? p.name}</span>
                      {state === "owned" ? (
                        <span className="meta">Tap to flip</span>
                      ) : state === "locked" ? (
                        p.pending ? (
                          <button className="btn btn-taxi btn-sm" disabled>Unlocking…</button>
                        ) : (
                          <button className="btn btn-taxi btn-sm" disabled={h.busy !== null} onClick={() => h.buy(p.sku)}>{formatPrice(p.priceCents, p.currency)}</button>
                        )
                      ) : (
                        <span className="meta">{place?.neighborhood ?? "Queens"}</span>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="meta" style={{ margin: 0 }}>More postcards arrive with new monuments. Keepsakes, not net worth.</p>
            </>
          )}

          {tab === "hunts" && (
            <>
              <SetProgress title="Treasure Hunter" done={Math.min(huntCards.length, badgeAfter)} total={badgeAfter}
                line={huntCards.length >= badgeAfter ? "🏅 Badge earned. Every new hunt adds a card." : `${huntCards.length} of ${badgeAfter} hunts · finish ${badgeAfter} for the 🏅 badge`} />
              {huntCards.length ? (
                <div className="collection-grid">
                  {huntCards.map((c) => (
                    <button key={c.huntId} className="trade-card" onClick={() => pick({ kind: "hunt", c })}>
                      <span className="trade-card-art" aria-hidden="true">{c.emoji}</span>
                      <b>{c.treasure}</b>
                      <small>{c.theme}</small>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="meta" style={{ margin: 0 }}>Finish a weekly treasure hunt (Tasks, then Hunt) and its card lands here.</p>
              )}
            </>
          )}

          {tab === "events" && (
            events.length ? (
              <div className="stack-12">
                {events.map((p) => (
                  <button key={p.sku} className="card-button" onClick={() => pick({ kind: "event", p })} aria-label={`${p.event!.name}, tap to flip`}>
                    <EventCard p={p} />
                  </button>
                ))}
              </div>
            ) : (
              <p className="meta" style={{ margin: 0 }}>Get on the list for an exclusive party and its ticket lands here, numbered.</p>
            )
          )}
        </div>
      )}
    </Sheet>
  );
}

function SetProgress({ title, done, total, line }: { title: string; done: number; total: number; line: string }) {
  return (
    <div className="set-progress" role="group" aria-label={`${title}: ${done} of ${total}`}>
      <span className="title" style={{ display: "block" }}>{title}</span>
      <span className="meta">{line}</span>
      <span className="set-bar"><span style={{ width: `${total ? Math.round((done / total) * 100) : 0}%` }} /></span>
    </div>
  );
}

/** An exclusive party as a ticket: the venue's art, the party, and its number. */
function EventCard({ p }: { p: StoreProduct }) {
  const e = p.event!;
  const place = placeById(e.placeId);
  return (
    <span className="event-ticket">
      <span className="event-ticket-art">{place && <PlaceArt place={place} daytime={false} />}</span>
      <span className="event-ticket-text">
        <b>{e.name}</b>
        <small>{place?.name ?? "Queens"} · {shortDate(e.startsAt)}</small>
        <small>{e.attended ? "✓ You were there" : "🎟️ On the list"}</small>
      </span>
      {p.serial ? <span className="card-serial">{serialLabel(p.serial)}</span> : null}
    </span>
  );
}

/** One owned card, large: tap to flip it to its back (C39, v0.7). */
function CardDetail({ picked, flipped, onFlip, handle, onBack, onShare }: {
  picked: Picked; flipped: boolean; onFlip: () => void; handle: string; onBack: () => void; onShare?: () => void;
}) {
  const title = picked.kind === "hunt" ? picked.c.treasure : picked.kind === "event" ? picked.p.event!.name : placeById(picked.p.placeId ?? "")?.name ?? picked.p.name;
  const serial = picked.kind === "hunt" ? null : picked.p.serial ?? null;
  const when = picked.kind === "hunt" ? picked.c.earnedAt : picked.p.ownedAt;
  const front = picked.kind === "postcard" ? <Postcard p={picked.p} state="owned" />
    : picked.kind === "event" ? <EventCard p={picked.p} />
    : <span className="trade-card big"><span className="trade-card-art" aria-hidden="true">{picked.c.emoji}</span><b>{picked.c.treasure}</b><small>{picked.c.theme}</small></span>;
  const back = picked.kind === "postcard" ? (
    <span className="card-back">
      <span className="card-back-note">{POSTCARD_NOTES[picked.p.placeId ?? ""] ?? "Wish you were here."}<br /><br />Lola x</span>
      <span className="card-back-stamp" aria-hidden="true">{placeById(picked.p.placeId ?? "")?.emoji ?? "📮"}</span>
      <span className="card-back-mark" aria-hidden="true">{(placeById(picked.p.placeId ?? "")?.neighborhood ?? "Queens").toUpperCase()}<br />NY{when ? <><br />{shortDate(when).toUpperCase()}</> : null}</span>
      <span className="card-back-to">{handle ? `@${handle}` : "You"}, Queens</span>
      {serial ? <span className="card-back-serial">{serialLabel(serial)}</span> : null}
    </span>
  ) : picked.kind === "event" ? (
    <span className="card-back">
      <span className="card-back-note">{picked.p.event!.blurb}<br /><br />Hosted by {picked.p.event!.host}</span>
      <span className="card-back-stamp" aria-hidden="true">🎟️</span>
      <span className="card-back-to">{picked.p.event!.attended ? "Admitted" : "On the list"}: {handle ? `@${handle}` : "you"}</span>
      {serial ? <span className="card-back-serial">Ticket {serialLabel(serial)}</span> : null}
    </span>
  ) : (
    <span className="card-back">
      <span className="card-back-note">{picked.c.lore}</span>
      <span className="card-back-stamp" aria-hidden="true">🗺️</span>
      <span className="card-back-to">Found by {handle ? `@${handle}` : "you"}</span>
      <span className="card-back-serial">{picked.c.theme}</span>
    </span>
  );
  return (
    <div className="stack-16">
      <div>
        <h2 className="display-md" style={{ margin: 0, paddingRight: 44 }}>{title}</h2>
        <p className="meta" style={{ margin: "4px 0 0" }}>{[when ? `Collected ${shortDate(when)}` : null, serial ? serialLabel(serial) : null].filter(Boolean).join(" · ")}</p>
      </div>
      <button className={`flip-card${flipped ? " flipped" : ""}`} onClick={onFlip} aria-label={flipped ? "Show the front" : "Flip the card"}>
        <span className="flip-face front">{front}</span>
        <span className="flip-face back">{back}</span>
      </button>
      <p className="meta" style={{ margin: 0, textAlign: "center" }}>↻ Tap the card to flip it</p>
      {onShare && <button className="btn btn-secondary" onClick={onShare}>↗ Share</button>}
      <button className="btn btn-ghost" onClick={onBack}>Back to the Collection</button>
    </div>
  );
}
