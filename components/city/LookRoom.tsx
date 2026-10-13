"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { itemBySku, type ShopItem } from "@/lib/city";
import type { CityState } from "@/lib/cityState";
import { formatCash } from "@/lib/economy";
import { HEADWEAR_BASIC, HEADWEAR_CULTURAL, type CoveringId, type Look } from "@/lib/look";
import { BOTTOM_LABEL, TOP_LABEL, type Outfit } from "@/lib/styles";
import { outfitWith } from "@/lib/wardrobe";
import { GARMENT } from "../avatar/garments";
import { ChevronLeftIcon } from "../icons";

const Avatar3D = dynamic(() => import("../avatar/Avatar3D"), { ssr: false });

type Slot = "top" | "bottom" | "shoes" | "accessory";
type Tab = "hats" | Slot;
const TABS: { id: Tab; label: string; emoji: string }[] = [
  { id: "hats", label: "Hats", emoji: "🧢" },
  { id: "top", label: "Tops", emoji: "👕" },
  { id: "bottom", label: "Bottoms", emoji: "👖" },
  { id: "shoes", label: "Shoes", emoji: "👟" },
  { id: "accessory", label: "Extras", emoji: "✨" },
];
const HAT_EMOJI: Partial<Record<CoveringId, string>> = { none: "🚫", cap: "🧢", fedora: "🎩", bucket: "👒", durag: "🧣", hijab: "🧕", turban: "👳", headwrap: "🎀", kippah: "🔵" };

/** What's worn per slot: an owned item's id, or null for the starter piece. */
type Worn = Record<Slot, number | null>;
const TRY_ID = -1;

/**
 * Your Look as a dressing room (v0.7 step 4, #24): you on stage, your clothes by category. Tapping
 * a tile tries it on at once; nothing is stored until "Save look". Shop pieces stay in the Shop,
 * which opens this room in try-on mode for one piece you don't own yet ("Try it on").
 */
export function LookRoom({
  open, onClose, look, base, state, busy, onSave, trying, onBuy,
}: {
  open: boolean;
  onClose: () => void;
  /** The saved look (headwear lives here). */
  look: Look;
  /** The starting style's outfit, before any Shop clothes. */
  base: Outfit;
  state: CityState;
  busy: boolean;
  onSave: (itemIds: number[], covering: CoveringId) => Promise<boolean>;
  /** Shop try-on: a piece the player doesn't own. */
  trying?: ShopItem | null;
  onBuy?: (sku: string) => Promise<boolean>;
}) {
  const fashion = state.items.filter((i) => i.category === "fashion" && itemBySku(i.sku)?.wear);
  const slotOf = (sku: string) => itemBySku(sku)?.wear?.slot as Slot | undefined;
  const savedWorn = (): Worn => {
    const w: Worn = { top: null, bottom: null, shoes: null, accessory: null };
    for (const i of fashion) if (i.equipped) w[slotOf(i.sku)!] = i.id;
    if (trying?.wear) w[trying.wear.slot as Slot] = TRY_ID;
    return w;
  };
  const [worn, setWorn] = useState<Worn>(savedWorn);
  const [covering, setCovering] = useState<CoveringId>(look.covering);
  const [tab, setTab] = useState<Tab>(trying?.wear ? (trying.wear.slot as Slot) : "top");
  const [error, setError] = useState<string | null>(null);
  // Start fresh each time the room opens (or opens on another Shop piece).
  const openKey = `${open}:${trying?.sku ?? ""}`;
  const [lastKey, setLastKey] = useState(openKey);
  if (openKey !== lastKey) {
    setLastKey(openKey);
    if (open) {
      setWorn(savedWorn());
      setCovering(look.covering);
      setTab(trying?.wear ? (trying.wear.slot as Slot) : "top");
      setError(null);
    }
  }
  if (!open) return null;

  const itemFor = (id: number | null): ShopItem | undefined =>
    id === TRY_ID ? trying ?? undefined : id === null ? undefined : itemBySku(fashion.find((i) => i.id === id)?.sku ?? "");
  const wornItems = (Object.values(worn) as (number | null)[]).map(itemFor).filter((x): x is ShopItem => !!x);
  const outfit = outfitWith(base, wornItems);
  const preview: Look = { ...look, covering };
  const saved = savedWorn();
  const changed = covering !== look.covering || (Object.keys(worn) as Slot[]).some((s) => worn[s] !== saved[s]);

  const save = async () => {
    setError(null);
    const ids = (Object.values(worn) as (number | null)[]).filter((x): x is number => x !== null && x !== TRY_ID);
    if (!(await onSave(ids, covering))) setError("That didn't save. Try again in a second.");
  };

  const starter = (slot: Slot) => {
    if (slot === "top") return { name: TOP_LABEL[base.top], icon: <Garment kind={base.top} color={base.topColor} /> };
    if (slot === "bottom") return { name: BOTTOM_LABEL[base.bottom], icon: <Garment kind={base.bottom} color={base.bottomColor} /> };
    if (slot === "shoes") return { name: "Your sneakers", icon: <Dot color={base.shoeColor} /> };
    return { name: base.accessory === "none" ? "Nothing" : "Starter extra", icon: base.accessory === "none" ? <span aria-hidden="true">🚫</span> : <Dot color={base.accessoryColor} /> };
  };
  const iconFor = (it: ShopItem) => {
    const w = it.wear!;
    const kind = (w.kind ?? "") as keyof typeof GARMENT;
    return GARMENT[kind] ? <Garment kind={kind} color={w.color} /> : <span aria-hidden="true">{it.emoji}</span>;
  };

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
              <span className="look-icon big">{iconFor(trying)}</span>
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
              {TABS.map((t) => (
                <button key={t.id} role="tab" className="chip" aria-pressed={tab === t.id} aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
                  <span aria-hidden="true">{t.emoji}</span> {t.label}
                </button>
              ))}
            </div>
            <div className="look-grid" role="radiogroup" aria-label={TABS.find((t) => t.id === tab)!.label}>
              {tab === "hats"
                ? [...HEADWEAR_BASIC, ...HEADWEAR_CULTURAL].map((h) => (
                  <Tile key={h.id} on={covering === h.id} wearing={look.covering === h.id} name={h.label} sub="Free"
                    icon={<span aria-hidden="true">{HAT_EMOJI[h.id]}</span>} onPick={() => setCovering(h.id)} />
                ))
                : [
                  <Tile key="starter" on={worn[tab] === null} wearing={saved[tab] === null} name={starter(tab).name} sub="Starter"
                    icon={starter(tab).icon} onPick={() => setWorn({ ...worn, [tab]: null })} />,
                  ...fashion.filter((i) => slotOf(i.sku) === tab).map((i) => {
                    const it = itemBySku(i.sku)!;
                    return <Tile key={i.id} on={worn[tab] === i.id} wearing={i.equipped} name={it.name} sub="Owned" icon={iconFor(it)} onPick={() => setWorn({ ...worn, [tab]: i.id })} />;
                  }),
                ]}
            </div>
            {tab !== "hats" && !fashion.some((i) => slotOf(i.sku) === tab) && (
              <p className="meta" style={{ margin: 0 }}>Just your starter piece so far. The Shop has more, and every piece there has Try it on.</p>
            )}
          </>
        )}
        {error && <p className="error-text" role="alert" style={{ margin: 0 }}>{error}</p>}
      </div>

      <div className="look-bar">
        {trying ? (
          <>
            <button className="btn btn-secondary" onClick={onClose}>Back to Shop</button>
            <button className="btn btn-taxi" disabled={busy || state.player.bank_cash < trying.price}
              onClick={async () => { if (await onBuy?.(trying.sku)) onClose(); }}>
              {busy ? "…" : state.player.bank_cash < trying.price ? `${formatCash(trying.price - state.player.bank_cash)} short` : `Buy for ${formatCash(trying.price)}`}
            </button>
          </>
        ) : (
          <>
            <button className="btn btn-secondary" disabled={!changed || busy} onClick={() => { setWorn(saved); setCovering(look.covering); }}>Undo</button>
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
function Dot({ color }: { color: string }) {
  return <span aria-hidden="true" style={{ width: 26, height: 26, borderRadius: "50%", background: color, boxShadow: "inset 0 0 0 1px rgba(0,0,0,.2)" }} />;
}
