"use client";

// #19 moving up (owner, Oct 14): the Apartments app in the Phone, and the bar shown while looking
// around a listing. Moving costs the first week's rent plus a broker fee and may need clout; the
// server checks all of it (migration 0045 move_home).

import { ECONOMY, formatCash, moveCost, type Home } from "@/lib/economy";
import type { CityState } from "@/lib/cityState";
import { HOME_FLOORS, HOME_TEMPLATES } from "@/lib/rooms";

/** How many rooms a home has (all floors), for the listing's tags. Open kitchens don't count, like a real listing. */
export function roomCount(homeId: string): number {
  const t = HOME_TEMPLATES[homeId];
  if (!t) return 1;
  const count = (rooms: { name: string }[] | undefined) => Math.max(1, (rooms ?? []).filter((r) => r.name !== "Kitchen").length);
  return count(t.rooms) + Object.values(HOME_FLOORS[homeId] ?? {}).reduce((n, f) => n + count(f.rooms), 0);
}

/** The next rental up from where you live (the early goal's target), if any. */
export function nextHomeUp(state: CityState): Home | undefined {
  const rent = ECONOMY.homes.find((h) => h.id === state.player.home_id)?.rent ?? 0;
  return ECONOMY.homes.filter((h) => h.rent > rent && !h.couture).sort((a, b) => a.rent - b.rent)[0];
}

/** Clout Couture homes show only to their owners (the Waterfront Mansion, migration 0105). */
const listed = (state: CityState, h: Home) => !h.couture || state.items.some((i) => i.sku === h.couture);
/** What a home's weekly bill is called: the mansion's is upkeep. */
const billWord = (h: Home | undefined) => (h?.couture ? "upkeep" : "rent");

/** Why you can't move into a home right now, or null. */
export function moveBlock(state: CityState, home: Home): string | null {
  const p = state.player;
  if (p.house_sku) return "You own a house";
  if (p.clout < (home.moveClout ?? 0)) return `🔒 ${(home.moveClout ?? 0).toLocaleString("en-US")} clout · you have ${p.clout.toLocaleString("en-US")}`;
  if (state.bills.some((b) => b.kind === "rent" && b.status === "due")) return "Pay this week's rent first";
  return null;
}

export function ApartmentsApp({ state, busy, onLookInside, onMove }: {
  state: CityState; busy: boolean; onLookInside: (homeId: string) => void; onMove: (homeId: string) => void;
}) {
  const p = state.player;
  const current = ECONOMY.homes.find((h) => h.id === p.home_id);
  const next = nextHomeUp(state);
  return (
    <div className="stack-12">
      <p className="subtext" style={{ margin: 0 }}>Move up when you can. The broker fee is a week&apos;s rent. Nobody knows what it&apos;s for.</p>
      <div className="apt-current">
        <span aria-hidden="true">{p.house_sku ? "🏡" : current?.emoji ?? "🏠"}</span>
        <span>
          <b>You live in: {p.house_sku ? "your own house" : current?.name ?? "Queens"}</b>
          <small>{p.house_sku ? "No rent. Your landlord misses you." : `${formatCash(current?.rent ?? 0)} ${billWord(current)} a week · ${roomCount(p.home_id ?? "")} room${roomCount(p.home_id ?? "") > 1 ? "s" : ""}`}</small>
        </span>
      </div>
      {ECONOMY.homes.filter((h) => h.id !== p.home_id && listed(state, h)).map((h) => {
        const block = moveBlock(state, h);
        const cost = moveCost(h);
        const short = p.bank_cash < cost;
        const rooms = roomCount(h.id);
        return (
          <div key={h.id} className="card apt-card stack-8">
            <div className="row" style={{ gap: 12 }}>
              <span className="apt-emoji" aria-hidden="true">{h.emoji}</span>
              <span style={{ minWidth: 0 }}>
                <span className="title" style={{ display: "block" }}>{h.couture ? `Your mansion: ${h.name}` : h.name}</span>
                <span className="meta">{h.neighborhood} · {formatCash(h.rent)} {billWord(h)} a week</span>
              </span>
            </div>
            <div className="chip-row" style={{ gap: 6 }}>
              {next?.id === h.id && !p.house_sku && <span className="tag tag-event">Next step up</span>}
              <span className="tag tag-neutral">{rooms} room{rooms > 1 ? "s" : ""}</span>
            </div>
            <span className="subtext">{h.blurb}{h.couture ? " The upkeep matches the priciest rent in Astoria, so it never saves you money." : ""}</span>
            {/* The price on its own line, so the button never wraps (owner, Oct 14). */}
            <span className="apt-cost"><b>{formatCash(cost)}</b> to move in</span>
            {block ? <span className="meta locked">{block}</span>
              : short ? <span className="meta locked">{formatCash(cost - p.bank_cash)} short</span> : null}
            <div className="row" style={{ gap: 8 }}>
              <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => onLookInside(h.id)}>Look inside</button>
              <button className="btn btn-taxi btn-sm" style={{ flex: 1 }} disabled={!!block || short || busy} onClick={() => onMove(h.id)}>Move in</button>
            </div>
          </div>
        );
      })}
      <p className="meta" style={{ margin: 0 }}>Houses are for sale in the Shop. Your furniture moves with you.</p>
    </div>
  );
}

/** Over the room while looking around a listing: back to the app, or move in. */
export function ViewingBar({ home, state, busy, onBack, onMove }: {
  home: Home; state: CityState | null; busy: boolean; onBack: () => void; onMove?: () => void;
}) {
  const block = state ? moveBlock(state, home) : null;
  const cost = moveCost(home);
  return (
    <div className="viewing-bar glass-hud" role="group" aria-label={`Looking around ${home.name}`}>
      <span style={{ minWidth: 0 }}>
        <b>{home.emoji} {home.name}</b>
        <small>{block ?? `${formatCash(home.rent)} a week · ${formatCash(cost)} to move in`}</small>
      </span>
      <button className="chip" onClick={onBack}>Back</button>
      {onMove && <button className="chip" aria-pressed="true" disabled={!!block || busy || (state?.player.bank_cash ?? 0) < cost} onClick={onMove}>Move in</button>}
    </div>
  );
}
