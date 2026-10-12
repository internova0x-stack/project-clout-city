"use client";

import { placeById } from "@/lib/city";
import { formatPrice, partyState, POSTCARD_BADGE, type StoreProduct } from "@/lib/store";
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

/** C39: a postcard: the monument's illustration in a vintage frame. */
export function Postcard({ p, state }: { p: StoreProduct; state: "owned" | "locked" | "unvisited" }) {
  const place = p.placeId ? placeById(p.placeId) : undefined;
  return (
    <div className={`postcard ${state}`}>
      <div className="postcard-art">{place && <PlaceArt place={place} daytime />}</div>
      <span className="postcard-greeting">Greetings from Queens</span>
      {state !== "owned" && <span className="postcard-lock" aria-hidden="true">{state === "locked" ? "🔒" : "📍"}</span>}
    </div>
  );
}

/** C39: offered on the monument's card after a visit. The visit's clout is shown separately. */
export function PostcardOffer({ p, h }: { p: StoreProduct; h: MoneyHandlers }) {
  if (p.owned) return null;
  return (
    <div className="postcard-offer">
      <div style={{ width: 84, flex: "none" }}><Postcard p={p} state="locked" /></div>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span className="title" style={{ display: "block" }}>Collect the postcard</span>
        <span className="meta">For your Collection. Postcards don&apos;t pay clout; the visit did.</span>
      </span>
      {p.pending ? (
        <button className="btn btn-taxi btn-sm" disabled>Unlocking…</button>
      ) : (
        <button className="btn btn-taxi btn-sm" disabled={h.busy !== null} onClick={() => h.buy(p.sku)}>
          {h.busy === `buy:${p.sku}` ? "…" : formatPrice(p.priceCents, p.currency)}
        </button>
      )}
    </div>
  );
}

/** C39: the Collection screen: owned postcards, visited-but-not-owned silhouettes, and the rest. */
export function CollectionSheet({ open, onClose, products, h, badge }: {
  open: boolean; onClose: () => void; products: StoreProduct[]; h: MoneyHandlers; badge: boolean;
}) {
  const cards = products.filter((p) => p.type === "postcard");
  const owned = cards.filter((p) => p.owned).length;
  const share = async (p: StoreProduct) => {
    const text = `${p.name.replace("Postcard: ", "Greetings from ")} · Clout City`;
    try {
      if (navigator.share) await navigator.share({ title: "Clout City", text, url: window.location.origin });
      else await navigator.clipboard?.writeText(`${text} ${window.location.origin}`);
    } catch {
      /* cancelled share sheet */
    }
  };
  return (
    <Sheet open={open} onClose={onClose} label="Collection" tall>
      <div className="stack-16">
        <SheetTitle right={`${owned} of ${cards.length}`}>Collection</SheetTitle>
        <p className="subtext" style={{ margin: 0 }}>Postcards from monuments you&apos;ve visited. They&apos;re keepsakes, not net worth.</p>
        {badge ? (
          <div className="achievement-row">
            <span className="achievement" aria-hidden="true">{POSTCARD_BADGE.emoji}</span>
            <span><span className="title" style={{ display: "block" }}>{POSTCARD_BADGE.name}</span><span className="meta">{POSTCARD_BADGE.line}</span></span>
          </div>
        ) : (
          <p className="meta" style={{ margin: 0 }}>Collect the set for the {POSTCARD_BADGE.emoji} {POSTCARD_BADGE.name} badge.</p>
        )}
        <div className="collection-grid">
          {cards.map((p) => {
            const state = p.owned ? "owned" : p.visited ? "locked" : "unvisited";
            const place = p.placeId ? placeById(p.placeId) : undefined;
            return (
              <div key={p.sku} className="stack-8">
                <Postcard p={p} state={state} />
                <span className="body-strong" style={{ display: "block" }}>{place?.name ?? p.name}</span>
                {state === "owned" ? (
                  <button className="btn btn-secondary btn-sm" onClick={() => void share(p)}>↗ Share</button>
                ) : state === "locked" ? (
                  p.pending ? (
                    <button className="btn btn-taxi btn-sm" disabled>Unlocking…</button>
                  ) : (
                    <button className="btn btn-taxi btn-sm" disabled={h.busy !== null} onClick={() => h.buy(p.sku)}>{formatPrice(p.priceCents, p.currency)}</button>
                  )
                ) : (
                  <span className="meta">Visit to unlock</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Sheet>
  );
}
