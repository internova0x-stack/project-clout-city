"use client";

// Shop pictures (the Shop Manager, migration 0099): an item's processed card image when it has one, otherwise its
// emoji tile as before. The Studio's review shows the same card players see.

import type { ShopItem } from "@/lib/city";
import { STYLE_LINE_LABEL, type CatalogItem, type StyleLine } from "@/lib/shopCatalog";
import { formatPrice } from "@/lib/store";
import { formatCash } from "@/lib/economy";
import { IconTile, Stars } from "./Common";

export function ShopArt({ image, emoji, item, size = 52, big = false }: { image?: string | null; emoji: string; item?: ShopItem; size?: number; big?: boolean }) {
  if (!image) return <IconTile emoji={emoji} item={item} size={size} />;
  return (
    // Processed WebPs from Supabase Storage (or data URLs in the preview); next/image would re-encode them.
    // eslint-disable-next-line @next/next/no-img-element
    <img className={`shop-art${big ? " big" : ""}`} src={image} alt="" width={size} height={size} loading="lazy" decoding="async" style={{ width: size, height: size }} />
  );
}

/** The card exactly as the Shop shows it, without buttons that do anything (the Studio's review). */
export function ShopCardPreview({ item, dark = false }: { item: CatalogItem; dark?: boolean }) {
  const locked = !item.wearable;
  return (
    <div className={`shop-preview${dark ? " dark" : ""}`}>
      <div className={`item-card${item.realCash ? " collector" : ""}`} style={{ maxWidth: 200 }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
          <ShopArt image={item.images?.card} emoji={item.emoji} size={72} />
          {item.realCash ? <span className="tag tag-gold">✨ Real cash</span> : <span className="meta">{item.slot ?? ""}</span>}
        </div>
        <span className="title" style={{ display: "block" }}>{item.name}</span>
        <span className="subtext clamp-2">{item.description}</span>
        <Stars rating={Math.min(4, Math.max(1, item.stars)) as 1 | 2 | 3 | 4} />
        {!!item.styleLines.length && <span className="meta">{item.styleLines.map((s) => STYLE_LINE_LABEL[s as StyleLine] ?? s).join(" · ")}</span>}
        <span className="meta">🔥 up to +{item.clout}</span>
        {locked ? (
          <span className="meta locked">🔒 Coming soon to your wardrobe</span>
        ) : null}
        <button className="btn btn-taxi btn-sm" disabled={locked} tabIndex={-1}>
          {item.realCash ? (item.priceUsdCents ? formatPrice(item.priceUsdCents, "usd") : "–") : formatCash(item.price)}
        </button>
      </div>
    </div>
  );
}
