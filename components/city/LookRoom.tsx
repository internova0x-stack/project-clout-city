"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { itemBySku, type ShopItem } from "@/lib/city";
import type { CityState } from "@/lib/cityState";
import { formatCash } from "@/lib/economy";
import { HEADWEAR_BASIC, HEADWEAR_CULTURAL, type CoveringId, type Look } from "@/lib/look";
import { BOTTOM_LABEL, TOP_LABEL, type BottomKind, type Fit, type Outfit, type StyleFits, type TopKind } from "@/lib/styles";
import { itemOptionsBySku, outfitFromSkus, slotsClash, wearSlot } from "@/lib/wearing";
import { GARMENT, HAT, SHOE } from "../avatar/garments";
import { ChevronLeftIcon } from "../icons";

const Avatar3D = dynamic(() => import("../avatar/Avatar3D"), { ssr: false });

/** Item slots: the starting style's (top, bottom, shoes, extra), whole outfits, dresses and the Shop's accessories. */
type Slot = "outfit" | "top" | "bottom" | "one-piece" | "shoes" | "accessory" | "head" | "face" | "ears" | "neck" | "hand" | "wrist" | "glow";
type Tab = "hats" | Slot;
const TABS: { id: Tab; label: string; owned?: boolean }[] = [
  // Headwear: the free basics and coverings, and Shop hats (slot "head").
  { id: "hats", label: "Hats" },
  // Whole outfits (#9) cover the top, bottom and shoes while they're on.
  { id: "outfit", label: "Outfits" },
  { id: "top", label: "Tops" },
  { id: "bottom", label: "Bottoms" },
  // A dress is a top and a bottom (migration 0101); the tabs below show once there's something to wear in them.
  { id: "one-piece", label: "Dresses", owned: true },
  { id: "shoes", label: "Shoes" },
  { id: "accessory", label: "Extras" },
  { id: "face", label: "Glasses", owned: true },
  { id: "ears", label: "Earrings", owned: true },
  { id: "neck", label: "Necklaces", owned: true },
  { id: "hand", label: "Bags", owned: true },
  { id: "wrist", label: "Watches", owned: true },
  // Clout Couture's 24k Glow Ritual (migration 0103): on or off like any piece.
  { id: "glow", label: "Glow", owned: true },
];
const SLOTS: Slot[] = ["outfit", "top", "bottom", "one-piece", "shoes", "accessory", "head", "face", "ears", "neck", "hand", "wrist", "glow"];

/** What's worn per slot: an owned item's id, or null for the starter piece (or nothing). */
type Worn = Record<Slot, number | null>;
const TRY_ID = -1;

/**
 * Your Look as a dressing room (v0.7 step 4, #24): you on stage, your clothes by category. Tapping
 * a tile tries it on at once; nothing is stored until "Save look". Shop pieces stay in the Shop,
 * which opens this room in try-on mode for one piece you don't own yet ("Try it on").
 */
export function LookRoom({
  open, onClose, look, base, fit: savedFit, fits, state, busy, onSave, trying, onBuy,
}: {
  open: boolean;
  onClose: () => void;
  /** The saved look (headwear lives here). */
  look: Look;
  /** The starting style's outfit, before any Shop clothes. */
  base: Outfit;
  /** The starter clothes on now, and the ones the style offers (the creator's choices, free to switch, migration 0109). */
  fit: Fit;
  fits: StyleFits;
  state: CityState;
  busy: boolean;
  /** `fit` is set only when the starter clothes changed. */
  onSave: (itemIds: number[], covering: CoveringId, fit?: Fit) => Promise<boolean>;
  /** Shop try-on: a piece the player doesn't own. */
  trying?: ShopItem | null;
  onBuy?: (sku: string) => Promise<boolean>;
}) {
  const fashion = state.items.filter((i) => i.category === "fashion" && wearSlot(i.sku));
  const slotOf = (sku: string) => wearSlot(sku) as Slot | undefined;
  const tryingSlot = trying ? slotOf(trying.sku) : undefined;
  /** Picks `id` for `slot`, taking off what it clashes with (a dress and a top or bottom). */
  const pick = (w: Worn, slot: Slot, id: number | null): Worn => {
    const next = { ...w, [slot]: id };
    if (id !== null) for (const o of SLOTS) if (o !== slot && next[o] !== null && slotsClash(o, slot)) next[o] = null;
    return next;
  };
  const savedWorn = (): Worn => {
    let w = Object.fromEntries(SLOTS.map((x) => [x, null])) as Worn;
    for (const i of fashion) if (i.equipped) w[slotOf(i.sku)!] = i.id;
    if (tryingSlot) w = pick(w, tryingSlot, TRY_ID);
    return w;
  };
  const tabOf = (slot: Slot | undefined): Tab => (!slot ? "top" : slot === "head" ? "hats" : slot);
  const [worn, setWorn] = useState<Worn>(savedWorn);
  const [covering, setCovering] = useState<CoveringId>(look.covering);
  const [fit, setFit] = useState<Fit>(savedFit);
  const [tab, setTab] = useState<Tab>(tabOf(tryingSlot));
  const [error, setError] = useState<string | null>(null);
  // Start fresh each time the room opens (or opens on another Shop piece).
  const openKey = `${open}:${trying?.sku ?? ""}`;
  const [lastKey, setLastKey] = useState(openKey);
  if (openKey !== lastKey) {
    setLastKey(openKey);
    if (open) {
      setWorn(savedWorn());
      setCovering(look.covering);
      setFit(savedFit);
      setTab(tabOf(tryingSlot));
      setError(null);
    }
  }
  if (!open) return null;

  const skuFor = (id: number | null): string | undefined => (id === TRY_ID ? trying?.sku : id === null ? undefined : fashion.find((i) => i.id === id)?.sku);
  /** A worn or owned piece's name and picture: the code's item, else the Shop catalog's row. */
  const infoFor = (sku: string): { name: string; emoji: string; image: string | null; item?: ShopItem } => {
    const it = itemBySku(sku), c = state.catalog?.find((x) => x.sku === sku);
    return { name: c?.name ?? it?.name ?? trying?.name ?? sku, emoji: c?.emoji ?? it?.emoji ?? "🛍️", image: c?.images?.card ?? null, item: it };
  };
  const wornSkus = (Object.values(worn) as (number | null)[]).map(skuFor).filter((x): x is string => !!x);
  const outfit = outfitFromSkus({ ...base, ...fit }, wornSkus, itemOptionsBySku(state.items));
  const preview: Look = { ...look, covering };
  // Headwear takes the avatar's hat color (buildAvatar): the cap color for Bodega Drip, otherwise the outfit's accent.
  const hatColor = outfit.accessory === "cap" ? outfit.accessoryColor : outfit.topAccent;
  const hatIcon = (id: CoveringId) => (id === "none" || !HAT[id] ? <NoneIcon /> : <Shape color={hatColor}>{HAT[id]}</Shape>);
  // Each category tab shows what's on you in that slot (#18), not a stock emoji.
  const tabIcon = (t: Tab) => {
    if (t === "hats") return worn.head !== null ? iconForSku(skuFor(worn.head)!) : hatIcon(covering);
    const sku = skuFor(worn[t]);
    return sku ? iconForSku(sku) : starter(t).icon;
  };
  const saved = savedWorn();
  const fitChanged = (Object.keys(fit) as (keyof Fit)[]).some((k) => fit[k] !== savedFit[k]);
  const changed = covering !== look.covering || fitChanged || SLOTS.some((s) => worn[s] !== saved[s]);
  /** Wears a starter piece in `slot` (a dress comes off for a starter top or bottom). */
  const wearStarter = (slot: "top" | "bottom" | "shoes", change: Partial<Fit>) => {
    setFit({ ...fit, ...change });
    setWorn({ ...worn, [slot]: null, ...(slot !== "shoes" ? { "one-piece": null } : {}) });
  };

  const save = async () => {
    setError(null);
    const ids = (Object.values(worn) as (number | null)[]).filter((x): x is number => x !== null && x !== TRY_ID);
    if (!(await onSave(ids, covering, fitChanged ? fit : undefined))) setError("That didn't save. Try again in a second.");
  };

  const starter = (slot: Slot) => {
    if (slot === "outfit") return { name: "No outfit", icon: <NoneIcon /> };
    if (slot === "one-piece") return { name: "No dress", icon: <NoneIcon /> };
    if (slot === "glow") return { name: "No glow", icon: <NoneIcon /> };
    if (slot !== "top" && slot !== "bottom" && slot !== "shoes" && slot !== "accessory") return { name: "Nothing", icon: <NoneIcon /> };
    if (slot === "top") return { name: TOP_LABEL[fit.top], icon: <Garment kind={fit.top} color={fit.topColor} /> };
    if (slot === "bottom") return { name: BOTTOM_LABEL[fit.bottom], icon: <Garment kind={fit.bottom} color={fit.bottomColor} /> };
    if (slot === "shoes") return { name: "Your sneakers", icon: <Shape color={fit.shoeColor}>{SHOE}</Shape> };
    return { name: base.accessory === "none" ? "Nothing" : "Starter extra", icon: base.accessory === "none" ? <span aria-hidden="true">🚫</span> : <Dot color={base.accessoryColor} /> };
  };
  const iconFor = (it: ShopItem) => {
    const w = it.wear!;
    const kind = (w.kind ?? "") as keyof typeof GARMENT;
    if (GARMENT[kind]) return <Garment kind={kind} color={w.color} />;
    if (w.slot === "shoes") return <Shape color={w.color}>{SHOE}</Shape>;
    if (w.slot === "accessory" && HAT[w.kind ?? ""]) return <Shape color={w.color}>{HAT[w.kind ?? ""]}</Shape>;
    return <span aria-hidden="true">{it.emoji}</span>;
  };
  /** A piece's tile picture: the code's icon, else the Shop picture, else its emoji. */
  const iconForSku = (sku: string) => {
    const info = infoFor(sku);
    if (info.item?.wear) return iconFor(info.item);
    // eslint-disable-next-line @next/next/no-img-element
    return info.image ? <img src={info.image} alt="" width={34} height={34} style={{ objectFit: "contain" }} /> : <span aria-hidden="true">{info.emoji}</span>;
  };
  const owns = (slot: Slot) => fashion.some((i) => slotOf(i.sku) === slot) || tryingSlot === slot;
  const tabs = TABS.filter((t) => !t.owned || owns(t.id as Slot));

  return (
    <div className={`look-room${trying ? " trying" : ""}`} role="dialog" aria-modal="true" aria-label={trying ? `Try on the ${trying.name}` : "Your look"}>
      <div className="look-stage">
        <Avatar3D look={preview} outfit={outfit} framing="full" label="You, trying things on" />
        <div className="look-top">
          <button className="icon-round" onClick={onClose} aria-label={trying ? "Back to Shop" : "Close"}><ChevronLeftIcon size={18} /></button>
          <h1 className="display-sm" style={{ margin: 0, color: "var(--text-1)" }}>{trying ? "Try it on" : "Your look"}</h1>
          <span style={{ width: 36 }} />
        </div>
        {trying ? <span className="look-banner">Not yours yet · {formatCash(trying.price)}</span>
          : changed ? <span className="look-banner">Trying on · not saved</span> : null}
      </div>

      <div className="look-panel">
        {trying ? (
          <div className="stack-12">
            <div className="row" style={{ gap: 12 }}>
              <span className="look-icon big">{iconForSku(trying.sku)}</span>
              <span style={{ minWidth: 0 }}>
                <span className="title" style={{ display: "block", color: "var(--text-1)" }}>{trying.name}</span>
                <span className="subtext">{trying.blurb}</span>
              </span>
            </div>
            <p className="meta" style={{ margin: 0 }}>Buying adds it to your closet and puts it on. You can change back any time in Your look.</p>
          </div>
        ) : (
          <>
            <div className="chip-row" role="tablist" aria-label="Categories">
              {tabs.map((t) => (
                <button key={t.id} role="tab" className="chip" aria-pressed={tab === t.id} aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
                  <span className="look-tab-icon" aria-hidden="true">{tabIcon(t.id)}</span> {t.label}
                </button>
              ))}
            </div>
            <div className="look-grid" role="radiogroup" aria-label={TABS.find((t) => t.id === tab)?.label ?? "Pieces"}>
              {tab === "hats"
                ? [
                  ...[...HEADWEAR_BASIC, ...HEADWEAR_CULTURAL].map((h) => (
                    <Tile key={h.id} on={worn.head === null && covering === h.id} wearing={saved.head === null && look.covering === h.id} name={h.label} sub="Free"
                      icon={hatIcon(h.id)} onPick={() => { setCovering(h.id); setWorn({ ...worn, head: null }); }} />
                  )),
                  // Shop hats: a free cap or hat comes off for one; a faith or culture covering stays (the hat steps aside).
                  ...fashion.filter((i) => slotOf(i.sku) === "head").map((i) => (
                    <Tile key={i.id} on={worn.head === i.id} wearing={i.equipped} name={infoFor(i.sku).name} sub="Owned" icon={iconForSku(i.sku)}
                      onPick={() => { setWorn({ ...worn, head: i.id }); if (covering === "cap" || covering === "fedora" || covering === "bucket") setCovering("none"); }} />
                  )),
                ]
                : tab === "top" || tab === "bottom" ? [
                  // The starter clothes (owner, Oct 22): every top or bottom the starting style offers, free, in the color below.
                  ...(tab === "top" ? fits.tops : fits.bottoms).map((k) => {
                    const mine = tab === "top" ? fit.top === k : fit.bottom === k;
                    const wasMine = tab === "top" ? savedFit.top === k : savedFit.bottom === k;
                    return (
                      <Tile key={`starter-${k}`} on={worn[tab] === null && worn["one-piece"] === null && mine} wearing={saved[tab] === null && saved["one-piece"] === null && wasMine}
                        name={tab === "top" ? TOP_LABEL[k as TopKind] : BOTTOM_LABEL[k as BottomKind]} sub="Free"
                        icon={<Garment kind={k as TopKind} color={tab === "top" ? fit.topColor : fit.bottomColor} />}
                        onPick={() => wearStarter(tab, tab === "top" ? { top: k as TopKind } : { bottom: k as BottomKind })} />
                    );
                  }),
                  ...fashion.filter((i) => slotOf(i.sku) === tab).map((i) => (
                    <Tile key={i.id} on={worn[tab] === i.id} wearing={i.equipped} name={infoFor(i.sku).name} sub="Owned" icon={iconForSku(i.sku)} onPick={() => setWorn(pick(worn, tab, i.id))} />
                  )),
                ]
                : [
                  <Tile key="starter" on={worn[tab] === null} wearing={saved[tab] === null} name={starter(tab).name} sub={tab === "shoes" ? "Free" : tab === "accessory" ? "Starter" : "Off"}
                    icon={starter(tab).icon} onPick={() => setWorn({ ...worn, [tab]: null })} />,
                  ...fashion.filter((i) => slotOf(i.sku) === tab).map((i) => (
                    <Tile key={i.id} on={worn[tab] === i.id} wearing={i.equipped} name={infoFor(i.sku).name} sub="Owned" icon={iconForSku(i.sku)} onPick={() => setWorn(pick(worn, tab, i.id))} />
                  )),
                ]}
            </div>
            {(tab === "top" || tab === "bottom" || tab === "shoes") && (
              <div className="stack-4">
                <span className="overline">{tab === "top" ? "Starter top color" : tab === "bottom" ? "Starter bottom color" : "Sneaker color"}</span>
                <div className="swatches" role="radiogroup" aria-label="Colors">
                  {(tab === "top" ? fits.topColors : tab === "bottom" ? fits.bottomColors : fits.shoeColors).map((c) => {
                    const key = tab === "top" ? "topColor" : tab === "bottom" ? "bottomColor" : "shoeColor";
                    return <button key={c} role="radio" aria-checked={fit[key] === c} aria-label={`Color ${c}`} className="swatch" style={{ background: c }}
                      onClick={() => wearStarter(tab, { [key]: c })} />;
                  })}
                </div>
              </div>
            )}
            {tab !== "hats" && !fashion.some((i) => slotOf(i.sku) === tab) && (
              <p className="meta" style={{ margin: 0 }}>{tab === "outfit"
                ? "No outfits yet. The Shop sells city looks, and the wilder ones open up as your clout grows."
                : tab === "top" || tab === "bottom" || tab === "shoes" ? "Your starter clothes are free to switch. The Shop has more, and every piece there has Try it on."
                : "Just your starter piece so far. The Shop has more, and every piece there has Try it on."}</p>
            )}
          </>
        )}
        {error && <p className="error-text" role="alert" style={{ margin: 0 }}>{error}</p>}
      </div>

      <div className="look-bar">
        {trying ? (
          <>
            <button className="btn btn-secondary" onClick={onClose}>Back to Shop</button>
            {(trying.cloutReq ?? 0) > state.player.clout ? (
              <button className="btn btn-secondary" disabled>🔒 Needs {(trying.cloutReq ?? 0).toLocaleString("en-US")} clout</button>
            ) : (
              <button className="btn btn-taxi" disabled={busy || state.player.bank_cash < trying.price}
                onClick={async () => { if (await onBuy?.(trying.sku)) onClose(); }}>
                {busy ? "…" : state.player.bank_cash < trying.price ? `${formatCash(trying.price - state.player.bank_cash)} short` : `Buy for ${formatCash(trying.price)}`}
              </button>
            )}
          </>
        ) : (
          <>
            <button className="btn btn-secondary" disabled={!changed || busy} onClick={() => { setWorn(saved); setCovering(look.covering); setFit(savedFit); }}>Undo</button>
            <button className="btn btn-taxi" disabled={!changed || busy} onClick={() => void save()}>{busy ? "…" : "Save look"}</button>
          </>
        )}
      </div>
    </div>
  );
}

function Tile({ on, wearing, name, sub, icon, onPick }: { on: boolean; wearing: boolean; name: string; sub: string; icon: React.ReactNode; onPick: () => void }) {
  return (
    <button role="radio" aria-checked={on} className={`look-tile${on ? " on" : ""}${on && !wearing ? " trying" : ""}`} onClick={onPick}>
      {on && !wearing && <span className="look-trying">Trying</span>}
      {on && wearing && <span className="look-check" aria-hidden="true">✓</span>}
      <span className="look-icon">{icon}</span>
      <b>{name}</b>
      <small>{wearing ? "Wearing" : sub}</small>
    </button>
  );
}

function Garment({ kind, color }: { kind: keyof typeof GARMENT; color: string }) {
  return <svg viewBox="0 0 60 56" width="34" height="32" fill={color} stroke="rgba(0,0,0,.25)" strokeWidth="1" aria-hidden="true">{GARMENT[kind]}</svg>;
}
function Shape({ color, children }: { color: string; children: React.ReactNode }) {
  return <svg viewBox="0 0 60 56" width="34" height="32" fill={color} stroke="rgba(0,0,0,.25)" strokeWidth="1" aria-hidden="true">{children}</svg>;
}
function NoneIcon() {
  return <svg viewBox="0 0 60 56" width="34" height="32" aria-hidden="true"><circle cx="30" cy="28" r="16" fill="none" stroke="rgba(30,26,40,.45)" strokeWidth="3" /><path d="M19 39 L41 17" stroke="rgba(30,26,40,.45)" strokeWidth="3" strokeLinecap="round" /></svg>;
}
function Dot({ color }: { color: string }) {
  return <span aria-hidden="true" style={{ width: 26, height: 26, borderRadius: "50%", background: color, boxShadow: "inset 0 0 0 1px rgba(0,0,0,.2)" }} />;
}
