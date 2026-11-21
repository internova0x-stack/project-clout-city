"use client";

// Your Scene (owner, Nov 21; lib/scene.ts): the full-screen tab (SceneScreen), the "Start a move here" row on a place's
// panel (SceneHere) and the door card for a move above your rank (SneakSheet).

import { useEffect, useRef, useState } from "react";
import { Sheet } from "../Sheet";
import { DEAL, SNEAK, sneakLabel, type DealWay, type SneakWay } from "@/lib/scene";
import type { CrewCard, MoveCard, Offer, SceneView } from "@/lib/sceneView";

/** The view's clock, ticking: the preview's runs fast. */
export function useSceneNow(view: SceneView | null): number {
  const [got, setGot] = useState(() => Date.now());
  const [, tick] = useState(0);
  useEffect(() => { setGot(Date.now()); }, [view]);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  return view ? view.now + (Date.now() - got) * view.speed : Date.now();
}

export function timeLeft(ms: number): string {
  if (ms <= 0) return "now";
  const min = Math.ceil(ms / 60_000);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  return m && h < 10 ? `${h} h ${m} min` : `${h} h`;
}
const money = (n: number) => (n > 0 ? `C$${n.toLocaleString("en-US")}` : "Free");

function Face({ host, emoji, size = 48 }: { host?: Offer["host"]; emoji: string; size?: number }) {
  return host?.portrait
    ? <img className="scene-face" src={host.portrait} alt="" style={{ width: size, height: size }} />
    : <span className="scene-ico" style={{ width: size, height: size }} aria-hidden="true">{emoji}</span>;
}

function SlotTag({ n, muted, label }: { n: number; muted?: boolean; label?: string }) {
  return <span className={`scene-slot-tag${muted ? " muted" : ""}`}>{label ?? `SLOT ${n}`}</span>;
}

const DEALT: Record<DealWay, string> = { vouch: "🤝 A regular vouched for you", publicist: "📞 Your publicist handled it", spill: "🫖 You spilled first", rise: "😌 You rose above it" };

function MoveSlot({ m, now, at, busy, onHype, onCollect, onGo, onDeal }: {
  m: MoveCard; now: number; at: string | null; busy: boolean;
  onHype: (m: MoveCard) => void; onCollect: (m: MoveCard) => void; onGo: (place: string) => void; onDeal: (m: MoveCard) => void;
}) {
  const ready = now >= Date.parse(m.readyAt);
  const stale = now >= Date.parse(m.staleAt);
  const total = Date.parse(m.readyAt) - Date.parse(m.startedAt);
  const pct = ready ? 100 : Math.max(2, Math.min(100, ((now - Date.parse(m.startedAt)) / total) * 100));
  const hypeDue = !ready && m.hypes < m.need && (!m.hypeAt || now >= Date.parse(m.hypeAt));
  return (
    <div className={`scene-card${stale ? " stale" : ready ? " ready" : ""}`}>
      <SlotTag n={m.slot} />
      <div className="scene-row">
        <Face host={m.host} emoji={m.emoji} />
        <div className="scene-grow">
          <div className="scene-title">{m.title}</div>
          <div className="meta">{m.placeName}{m.entry === "sneak" ? " · snuck in 🤫" : ""}{m.boost > 1 ? " · 📈 trending ×1.5" : ""}</div>
          {m.nextPlaque && m.count > 0 && <div className="meta scene-plaque-line">🏅 {m.count}/{m.nextPlaque.at} to the {m.nextPlaque.name} plaque</div>}
        </div>
        {stale ? <span className="scene-chip grey">STALE</span>
          : ready ? <span className="scene-chip green">READY</span>
          : <span className="meta scene-left">{timeLeft(Date.parse(m.readyAt) - now)} left</span>}
      </div>
      <div className="scene-bar" aria-hidden="true"><span className={ready ? "done" : ""} style={{ width: `${pct}%` }} /></div>
      {m.hater && !m.dealt && !stale && (
        <button className="scene-hater" disabled={busy} onClick={() => onDeal(m)}>
          {m.hater.who?.portrait ? <img src={m.hater.who.portrait} alt="" /> : <span aria-hidden="true">{m.hater.emoji}</span>}
          <span className="scene-grow"><b>{m.hater.quote}</b><span className="meta">−{Math.round(m.hater.cut * 100)}% if you leave it · Deal with it ›</span></span>
        </button>
      )}
      {m.hater && m.dealt && <span className="meta">{DEALT[m.dealt]}{m.dealt === "rise" ? ` (−${Math.round(m.hater.cut * 100)}%)` : ""}</span>}
      {!ready && m.need > 0 && (
        <div className="scene-chips">
          <span className="scene-chip">⚡ Hyped {m.hypes} / {m.need}</span>
          {!hypeDue && m.hypes < m.need && m.hypeAt && <span className="meta">Next hype in {timeLeft(Date.parse(m.hypeAt) - now)}</span>}
        </div>
      )}
      {ready ? (
        <div className="scene-row">
          <span className="meta scene-grow">{stale ? "Went stale. You get a quarter." : `Goes stale in ${timeLeft(Date.parse(m.staleAt) - now)}`}</span>
          <button className="btn btn-taxi scene-btn" disabled={busy} onClick={() => onCollect(m)}>Collect +{(stale ? m.stalePay : m.pay).clout} 🔥</button>
        </div>
      ) : hypeDue ? (
        <button className="btn btn-taxi" disabled={busy} onClick={() => (at === m.place ? onHype(m) : onGo(m.place))}>
          {at === m.place ? "Hype it now" : "Go hype it"}
        </button>
      ) : null}
    </div>
  );
}

function OfferCard({ o, at, busy, onStart, onGo, compact, later }: {
  o: Offer; at: string | null; busy: boolean; onStart: (o: Offer) => void; onGo: (place: string) => void; compact?: boolean;
  /** A move on another day this week: "Come back Tuesday" instead of a button. */
  later?: string;
}) {
  const here = !!at && o.places.some((p) => p.id === at);
  const where = here ? o.places.find((p) => p.id === at)! : o.places[0];
  return (
    <div className={`scene-offer${compact ? " compact" : ""}`}>
      <div className="scene-row">
        <Face host={o.host} emoji={o.emoji} size={44} />
        <div className="scene-grow">
          <div className="scene-title">{o.title}</div>
          <div className="scene-why">{o.short ? `Not on the list yet (${o.short})` : o.trending ? "📈 Trending this week: pays ×1.5" : o.why}</div>
        </div>
      </div>
      {o.knows && o.host && <div className="scene-knows">{o.host.name.split(" ")[0]}: &ldquo;{o.knows}&rdquo;</div>}
      <div className="meta">📍 {where?.name ?? "Somewhere new"} · {o.hours} h · +{o.clout} 🔥 · {money(o.cost)}{o.energy ? ` · ⚡${o.energy}` : ""}</div>
      {(o.days || o.weekly) && <div className="scene-days">{o.weekly ? "🆕 This week only" : ""}{o.weekly && o.days ? " · " : ""}{o.days ? `🗓️ ${o.days}` : ""}</div>}
      {later ? <span className="meta scene-later">🗓️ Come back {later} to start it</span>
        : o.running ? <span className="meta">Already going ✓</span>
        : o.bounced ? <span className="meta">They know your face tonight. Tomorrow.</span>
        : here ? <button className="btn btn-taxi scene-btn" disabled={busy} onClick={() => onStart(o)}>{o.short ? "Try to get in" : "Start it"}</button>
        : where ? <button className="btn btn-secondary scene-btn" onClick={() => onGo(where.id)}>Go to {where.name}</button> : null}
    </div>
  );
}

export function SceneScreen({ view, busy, onStart, onHype, onCollect, onGo, onDeal, onCrewHype, onResidencyTake, onResidencyCheckin }: {
  view: SceneView; busy: boolean;
  onStart: (o: Offer) => void; onHype: (m: MoveCard) => void; onCollect: (m: MoveCard) => void; onGo: (place: string) => void;
  onDeal: (m: MoveCard) => void; onCrewHype: (c: CrewCard) => void; onResidencyTake: (move: string) => void; onResidencyCheckin: () => void;
}) {
  const now = useSceneNow(view);
  // Owner, Nov 21: the week strip and the free slots weren't tappable. A day opens its moves; a free slot opens today's.
  const [list, setList] = useState<{ title: string; sub: string; offers: Offer[]; later?: string } | null>(null);
  const pickFor = (slot: number) => setList({ title: `Pick a move for slot ${slot}`, sub: "Everything you can start today. Go there, then start it.", offers: view.today });
  const openDay = (d: SceneView["castWeek"][number]) => setList({
    title: d.today ? "Today on the scene" : `${DAY_NAMES[d.day]} on the scene`,
    sub: d.today ? "Hosted today. Go there and start it." : `Hosted on ${DAY_NAMES[d.day]}. Come back then to start it.`,
    offers: d.items.map((it) => it.offer), later: d.today ? undefined : DAY_NAMES[d.day],
  });
  const go = (o: Offer) => { setList(null); onStart(o); };
  const goTo = (place: string) => { setList(null); onGo(place); };
  const free = view.slots - view.moves.length;
  const freeSlots = Array.from({ length: view.slots }, (_, i) => i + 1).filter((s) => !view.moves.some((m) => m.slot === s));
  const forYou = (
    <section className="scene-section" aria-label="For you today">
      <div className="scene-label">FOR YOU TODAY</div>
      <div className="scene-swipe">
        {view.forYou.map((o) => <OfferCard key={o.move} o={o} at={view.at} busy={busy} onStart={onStart} onGo={onGo} compact />)}
        {!view.forYou.length && <p className="meta">Nothing new right now. Check back tomorrow.</p>}
      </div>
    </section>
  );
  return (
    <div className="scene-screen" role="region" aria-label="Your Scene">
      <MovesSheet list={list} view={view} busy={busy} onClose={() => setList(null)} onStart={go} onGo={goTo} />
      <div className="scene-inner">
        <div className="scene-head">
          <h1>Your Scene</h1>
          <span className="scene-count">{view.moves.length} / {view.slots} slots</span>
        </div>
        <p className="meta scene-sub">Start moves around the city. Hype them, collect them before they go stale.</p>
        <CastWeek days={view.castWeek} onDay={openDay} />
        {free > 0 && forYou}
        <section className="scene-section" aria-label="Your moves">
          <div className="scene-label">YOUR MOVES</div>
          {view.moves.map((m) => <MoveSlot key={m.id} m={m} now={now} at={view.at} busy={busy} onHype={onHype} onCollect={onCollect} onGo={onGo} onDeal={onDeal} />)}
          {freeSlots.map((s) => (
            <button key={s} type="button" className="scene-card free scene-free-btn" onClick={() => pickFor(s)}>
              <SlotTag n={s} />
              <div className="scene-title">Free slot</div>
              <div className="meta">Tap to pick a move ({view.today.filter((o) => !o.running).length} on today).</div>
              <span className="scene-free-plus" aria-hidden="true">＋</span>
            </button>
          ))}
          {view.nextSlotRank && (
            <div className="scene-card locked">
              <SlotTag n={view.slots + 1} muted />
              <span className="meta">🔒 Another slot opens at Rank {view.nextSlotRank}</span>
            </div>
          )}
        </section>
        {free <= 0 && forYou}
        {(view.residency || view.residencyOffers.length > 0) && (
          <section className="scene-section" aria-label="Residency">
            <div className="scene-label">YOUR RESIDENCY</div>
            {view.residency ? (() => {
              const r = view.residency;
              const here = !!view.at && r.places.some((p) => p.id === view.at);
              const days = Math.max(1, Math.ceil((Date.parse(r.until) - now) / 86_400_000));
              return (
                <div className="scene-card residency">
                  <SlotTag n={0} label="RESIDENT" />
                  <div className="scene-row">
                    <span className="scene-ico" style={{ width: 48, height: 48 }} aria-hidden="true">{r.emoji}</span>
                    <div className="scene-grow">
                      <div className="scene-title">{r.title}</div>
                      <div className="meta">{r.places.map((p) => p.name).join(" or ")} · {days} {days === 1 ? "day" : "days"} left</div>
                    </div>
                  </div>
                  {r.paidToday ? <span className="meta">✓ Checked in today. Back tomorrow for +{r.pay} 🔥</span>
                    : here ? <button className="btn btn-taxi" disabled={busy} onClick={onResidencyCheckin}>Check in · +{r.pay} 🔥</button>
                    : <button className="btn btn-secondary" onClick={() => onGo(r.places[0].id)}>Go check in · +{r.pay} 🔥</button>}
                </div>
              );
            })() : view.residencyOffers.map((o) => {
              const here = !!view.at && o.places.some((p) => p.id === view.at);
              return (
                <div key={o.move} className="scene-offer">
                  <div className="scene-row">
                    <span className="scene-ico" style={{ width: 44, height: 44 }} aria-hidden="true">{o.emoji}</span>
                    <div className="scene-grow">
                      <div className="scene-title">Take a residency: {o.title}</div>
                      <div className="meta">A week of daily check-ins at {o.places.map((p) => p.name).join(" or ")} · +{o.pay} 🔥 a day</div>
                    </div>
                  </div>
                  {here ? <button className="btn btn-taxi" disabled={busy} onClick={() => onResidencyTake(o.move)}>Take it</button>
                    : o.places[0] && <button className="btn btn-secondary" onClick={() => onGo(o.places[0].id)}>Go to {o.places[0].name}</button>}
                </div>
              );
            })}
          </section>
        )}
        {view.crew.length > 0 && (
          <section className="scene-section" aria-label="Your crew's moves">
            <div className="scene-label">YOUR CREW&apos;S MOVES</div>
            {view.crew.map((c) => (
              <div key={c.id} className="scene-offer">
                <div className="scene-row">
                  <span className="scene-ico" style={{ width: 44, height: 44 }} aria-hidden="true">{c.emoji}</span>
                  <div className="scene-grow">
                    <div className="scene-title">{c.owner}: {c.title}</div>
                    <div className="meta">{c.placeName} · hyped {c.hypes}/{c.need} · {timeLeft(Date.parse(c.readyAt) - now)} left</div>
                  </div>
                  <button className="btn btn-taxi scene-btn" disabled={busy} onClick={() => onCrewHype(c)}>Hype ⚡</button>
                </div>
              </div>
            ))}
          </section>
        )}
        <section className="scene-section" aria-label="Known for">
          <div className="scene-label">KNOWN FOR</div>
          {/* Owner, Nov 21: one Known for for the whole game (migration 0176). */}
          <p className="meta scene-known-note">Everything you do counts: promotions and businesses for Status, dates and your crew for Social, club nights for Nightlife, the campaign trail for Stage, the Shop for Style, hunts and gossip for Street cred.</p>
          <div className="scene-scores">
            {view.scores.map((s) => (
              <div key={s.id} className="scene-score">
                <span className="meta">{s.emoji} {s.label}</span>
                <b>{s.title}</b>
                {s.next !== null && <span className="scene-score-bar" aria-hidden="true"><span style={{ width: `${Math.min(100, (s.points / s.next) * 100)}%` }} /></span>}
              </div>
            ))}
          </div>
          {view.plaques.length > 0 && (
            <div className="scene-plaques">
              {view.plaques.map((p) => (
                <span key={p.move} className={`scene-plaque${p.have ? " have" : ""}`}>
                  {p.emoji} {p.have ? `${p.have}: ` : ""}{p.title} · {p.count}{p.next ? `/${p.next.at}` : ""}
                </span>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

/** The place panel's row: the moves you can start here. */
export function SceneHere({ view, busy, onPick }: { view: SceneView; busy: boolean; onPick: (o: Offer) => void }) {
  if (!view.here.length) return null;
  const free = view.slots - view.moves.length;
  return (
    <div className="scene-here">
      <div className="scene-label">🎬 START A MOVE HERE · {free > 0 ? `${free} SLOT${free === 1 ? "" : "S"} FREE` : "SLOTS FULL"}</div>
      <div className="life-row" role="list" aria-label="Moves you can start here">
        {view.here.map((o) => (
          <button key={o.move} role="listitem" className={`life-card${o.short ? " scene-short" : ""}`} disabled={busy || o.running || o.bounced || free <= 0} onClick={() => onPick(o)}>
            <span className="life-card-emoji" aria-hidden="true">{o.emoji}</span>
            <span className="life-card-title">{o.title}</span>
            <span className="life-card-meta">{o.running ? "✓ Going" : o.bounced ? "Bounced tonight" : o.short ? `🤫 Sneak in` : `${o.hours} h · +${o.clout} 🔥`}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** Starting a move: a plain confirm when invited, the door's three options when you're short of its rank. */
export function SceneStartSheet({ offer, busy, onClose, onGo }: { offer: Offer | null; busy: boolean; onClose: () => void; onGo: (way?: SneakWay["id"]) => void }) {
  return (
    <Sheet open={!!offer} onClose={onClose} label={offer?.title ?? "Start a move"}>
      {offer && (
        <div className="stack-12">
          <div className="scene-row">
            <Face host={offer.host} emoji={offer.emoji} size={56} />
            <div className="scene-grow">
              <div className="scene-title" style={{ fontSize: 19 }}>{offer.title}</div>
              <div className="meta">{offer.line}</div>
            </div>
          </div>
          {offer.short ? (
            <>
              <p className="scene-why" style={{ margin: 0 }}>You're not on the list ({offer.short}). How do you get in?</p>
              {SNEAK.map((w) => {
                const l = sneakLabel(w, offer.host?.name ?? null, offer.cost);
                return (
                  <button key={w.id} className="scene-way" disabled={busy} onClick={() => onGo(w.id)}>
                    <span className="scene-way-title">{w.emoji} {l.label}</span>
                    <span className="scene-get">You get: {w.get}</span>
                    <span className="meta">It costs: {l.cost} · ⚡{offer.energy}{offer.cost ? ` · ${money(offer.cost)} once you're in` : ""}</span>
                  </button>
                );
              })}
            </>
          ) : (
            <>
              <div className="scene-chips">
                <span className="scene-chip green">You get +{offer.clout} 🔥</span>
                <span className="scene-chip">It costs {money(offer.cost)} · ⚡{offer.energy}</span>
                <span className="scene-chip">Ready in {offer.hours} h</span>
              </div>
              <button className="btn btn-taxi" disabled={busy} onClick={() => onGo()}>Start it</button>
            </>
          )}
        </div>
      )}
    </Sheet>
  );
}

/** A hater on one of your moves: who's saying what, and the four ways to deal with it (You get / It costs). */
export function HaterSheet({ move, view, busy, onClose, onPick }: { move: MoveCard | null; view: SceneView | null; busy: boolean; onClose: () => void; onPick: (way: DealWay) => void }) {
  const h = move?.hater;
  const vouch = view?.deal.vouch;
  const fill = (t: string) => t.replace(/\{regular\}/g, vouch?.name ?? "a regular")
    .replace("{publicist}", (view?.deal.publicist ?? 0).toLocaleString("en-US")).replace("{tea}", (view?.deal.tea ?? 0).toLocaleString("en-US"));
  return (
    <Sheet open={!!move && !!h} onClose={onClose} label="Someone's coming for you">
      {move && h && (
        <div className="stack-12">
          <div className="scene-row">
            {h.who?.portrait ? <img className="scene-face" src={h.who.portrait} alt="" style={{ width: 64, height: 64 }} /> : <span className="scene-ico" style={{ width: 64, height: 64, fontSize: 32 }} aria-hidden="true">{h.emoji}</span>}
            <div className="scene-grow">
              <div className="scene-label" style={{ margin: 0, color: "#A8102A" }}>ON YOUR {move.title.toUpperCase()}</div>
              <div className="scene-title" style={{ fontSize: 19 }}>&ldquo;{h.quote}&rdquo;</div>
            </div>
          </div>
          <p className="meta" style={{ margin: 0 }}>{h.line} Leave it and the move pays {Math.round(h.cut * 100)}% less.</p>
          {DEAL.filter((d) => d.id !== "vouch" || vouch).map((d) => (
            <button key={d.id} className="scene-way" disabled={busy} onClick={() => onPick(d.id)}>
              <span className="scene-way-title">{d.emoji} {fill(d.label)}</span>
              <span className="scene-get">You get: {fill(d.get)}</span>
              <span className="meta">It costs: {fill(d.cost)}</span>
            </button>
          ))}
        </div>
      )}
    </Sheet>
  );
}

/** This week on the scene: who hosts what, by day; today stands out. */
const DAY_NAMES = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** A day's moves, or a free slot's pick: the same cards as For you today, full width. */
function MovesSheet({ list, view, busy, onClose, onStart, onGo }: {
  list: { title: string; sub: string; offers: Offer[]; later?: string } | null; view: SceneView; busy: boolean;
  onClose: () => void; onStart: (o: Offer) => void; onGo: (place: string) => void;
}) {
  return (
    <Sheet open={!!list} onClose={onClose} label={list?.title ?? "Moves"}>
      {list && (
        <div className="stack-12">
          <div>
            <h2 style={{ margin: 0, fontSize: 20 }}>{list.title}</h2>
            <p className="meta" style={{ margin: "4px 0 0" }}>{list.sub}</p>
          </div>
          {list.offers.map((o) => <OfferCard key={o.move} o={o} at={view.at} busy={busy} onStart={onStart} onGo={onGo} later={list.later} />)}
          {!list.offers.length && <p className="meta">Nothing on right now. Check back tomorrow.</p>}
        </div>
      )}
    </Sheet>
  );
}

function CastWeek({ days, onDay }: { days: SceneView["castWeek"]; onDay: (d: SceneView["castWeek"][number]) => void }) {
  // The strip opens on today.
  const row = useRef<HTMLDivElement>(null);
  const shown = days.some((d) => d.items.length);
  const scrolled = useRef(false);
  useEffect(() => {
    // The strip appears once the week loads: scroll to today then, once.
    if (!shown || scrolled.current) return;
    const id = requestAnimationFrame(() => {
      const r = row.current, el = r?.querySelector<HTMLElement>(".scene-week-day.today");
      if (!r || !el) return;
      scrolled.current = true;
      r.scrollLeft = Math.max(0, r.scrollLeft + el.getBoundingClientRect().left - r.getBoundingClientRect().left - 14);
    });
    return () => cancelAnimationFrame(id);
  }, [shown]);
  if (!shown) return null;
  return (
    <section className="scene-section" aria-label="This week on the scene">
      <div className="scene-label">THIS WEEK ON THE SCENE</div>
      <div className="scene-week" ref={row}>
        {days.map((d) => (
          <button key={d.day} type="button" className={`scene-week-day${d.today ? " today" : ""}`} onClick={() => onDay(d)} disabled={!d.items.length}>
            <span className="scene-week-label">{d.today ? "Today" : d.label}</span>
            {d.items.length ? d.items.slice(0, 3).map((it) => (
              <span key={it.move} className="scene-week-item" title={it.title}>
                {it.host?.portrait ? <img src={it.host.portrait} alt="" /> : <span aria-hidden="true">{it.emoji}</span>}
                <span className="scene-week-title">{it.title}</span>
              </span>
            )) : <span className="meta scene-week-none">Quiet</span>}
            {d.items.length > 3 && <span className="scene-week-more">+{d.items.length - 3} more</span>}
            {d.items.length > 0 && <span className="scene-week-see">See {d.today ? "today" : d.label} ›</span>}
          </button>
        ))}
      </div>
    </section>
  );
}
