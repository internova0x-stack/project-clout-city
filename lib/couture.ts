// Clout Couture pieces made yours (migration 0103, owner Oct 21: "go"): the Clout Crown worn as a crown or a tiara, and
// the Sartorio Bespoke Suit's cloth, lining and up to three monogram initials. The choices live on the owned piece
// (player_items.options); set_item_options checks them against the same palettes (tests/couture.test.ts reads both).

/** What a piece's choices look like once saved. */
export type ItemOptions = { style?: "crown" | "tiara"; cloth?: string; lining?: string; monogram?: string };

export const CROWN_SKU = "clout-crown";
export const SUIT_SKU = "sartorio-bespoke-suit";

export const CROWN_STYLES: { id: "crown" | "tiara"; label: string }[] = [
  { id: "crown", label: "Crown" },
  { id: "tiara", label: "Tiara" },
];

/** The suit's cloths; the first is the default (midnight blue). */
export const SUIT_CLOTHS: { hex: string; label: string }[] = [
  { hex: "#1B2440", label: "Midnight blue" },
  { hex: "#14111A", label: "Black" },
  { hex: "#3A3F47", label: "Charcoal" },
  { hex: "#EDE3CF", label: "Ivory" },
  { hex: "#1F4A3A", label: "Emerald" },
  { hex: "#5A1A2A", label: "Burgundy" },
];

/** The suit's silk linings; the first is the default (gold). */
export const SUIT_LININGS: { hex: string; label: string }[] = [
  { hex: "#D4AF37", label: "Gold" },
  { hex: "#C0C6CE", label: "Silver" },
  { hex: "#B3122E", label: "Crimson" },
  { hex: "#1F6B4A", label: "Emerald" },
  { hex: "#6B4FD8", label: "Violet" },
];

/** Pieces that have choices. */
export const hasOptions = (sku: string) => sku === CROWN_SKU || sku === SUIT_SKU;

/** A monogram as saved: up to three letters, upper case (the server also runs the chat word filter). */
export function cleanMonogram(raw: string): string | null {
  const m = raw.trim().toUpperCase();
  return /^[A-Z]{0,3}$/.test(m) ? m : null;
}

/** One line for a piece's choices ("Tiara", "Black · Crimson lining · ABC"), or null for none. */
export function optionsLine(sku: string, o: ItemOptions | null | undefined): string | null {
  if (!o) return null;
  if (sku === CROWN_SKU) return o.style === "tiara" ? "Worn as a tiara" : null;
  if (sku === SUIT_SKU) {
    const cloth = SUIT_CLOTHS.find((c) => c.hex === o.cloth)?.label, lining = SUIT_LININGS.find((c) => c.hex === o.lining)?.label;
    const parts = [cloth, lining ? `${lining} lining` : null, o.monogram || null].filter(Boolean);
    return parts.length ? parts.join(" · ") : null;
  }
  return null;
}
