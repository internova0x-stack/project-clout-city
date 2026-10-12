// One icon family for app tiles and place pins: white, rounded, duotone glyphs
// (solid shapes with a softer secondary layer) drawn on gradient tiles. Replaces
// emoji in tiles so every icon shares one art style on every platform.

export type GlyphName =
  | "news" | "chat" | "cash" | "briefcase" | "gear"
  | "cup" | "sandwich" | "cutlery" | "cocktail" | "tree" | "tower" | "bike" | "house";

/** Tile gradients (top-left to bottom-right). */
export const GLYPH_GRADIENT: Record<GlyphName, [string, string]> = {
  news: ["#FF7AB6", "#D1105A"],
  chat: ["#7BEA9C", "#1FA35C"],
  cash: ["#6EE7C0", "#1F7A5C"],
  briefcase: ["#FFD24A", "#FF6A3D"],
  gear: ["#C7CCD4", "#5C6370"],
  cup: ["#FFC48A", "#C9673A"],
  sandwich: ["#FFD966", "#F08A24"],
  cutlery: ["#FFB06B", "#E5484D"],
  cocktail: ["#FF6FB0", "#8E2DE2"],
  tree: ["#8BE6A0", "#2E8B63"],
  tower: ["#9DB2FF", "#4B5BD7"],
  bike: ["#8FD3FF", "#3778E8"],
  house: ["#8F7CC8", "#3A2C5E"],
};

export const tileBackground = (g: GlyphName) => `linear-gradient(145deg, ${GLYPH_GRADIENT[g][0]}, ${GLYPH_GRADIENT[g][1]})`;

const PLACE_GLYPHS: Record<string, GlyphName> = {
  "velvet-static": "cocktail",
  "grind-and-gossip": "cup",
  "lucky-seven-deli": "sandwich",
  "altitude-718": "cutlery",
  "flushing-meadows": "tree",
  "pedal-pushers": "bike",
  "skybridge-tower": "tower",
  home: "house",
};
const CATEGORY_GLYPHS: Record<string, GlyphName> = { food: "cutlery", nightlife: "cocktail", parks: "tree", places: "tower", home: "house" };

export function glyphFor(place: { id: string; category: string }): GlyphName {
  return PLACE_GLYPHS[place.id] ?? CATEGORY_GLYPHS[place.category] ?? "tower";
}

const SOFT = "rgba(255,255,255,.55)";

export function Glyph({ name, size = 24 }: { name: GlyphName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ display: "block", filter: "drop-shadow(0 1px 1px rgba(0,0,0,.18))" }}>
      {PATHS[name]}
    </svg>
  );
}

const PATHS: Record<GlyphName, React.ReactNode> = {
  news: (
    <>
      <rect x="3" y="4.5" width="15" height="15" rx="2.5" fill="#fff" />
      <path d="M18 8.5h1.5A1.5 1.5 0 0 1 21 10v7.5a2 2 0 0 1-2 2h-1z" fill={SOFT} />
      <rect x="5.5" y="7" width="10" height="3" rx="1" fill={SOFT} />
      <rect x="5.5" y="12" width="4.5" height="5" rx="1" fill={SOFT} />
      <rect x="11.5" y="12" width="4" height="1.6" rx=".8" fill={SOFT} />
      <rect x="11.5" y="15.4" width="4" height="1.6" rx=".8" fill={SOFT} />
    </>
  ),
  chat: (
    <>
      <path d="M12 3.5c5 0 9 3.3 9 7.5s-4 7.5-9 7.5c-1 0-2-.1-2.9-.4L4.5 20l1.2-3.8C4 14.8 3 13 3 11c0-4.2 4-7.5 9-7.5z" fill="#fff" />
      {[8, 12, 16].map((x) => <circle key={x} cx={x} cy="11" r="1.4" fill={SOFT} />)}
    </>
  ),
  cash: (
    <>
      <rect x="2.5" y="7" width="17" height="11" rx="2.5" fill={SOFT} />
      <rect x="4.5" y="5" width="17" height="11" rx="2.5" fill="#fff" />
      <circle cx="13" cy="10.5" r="3" fill={SOFT} />
      <circle cx="7.5" cy="10.5" r="1" fill={SOFT} />
      <circle cx="18.5" cy="10.5" r="1" fill={SOFT} />
    </>
  ),
  briefcase: (
    <>
      <path d="M9 6V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1h-1.8V5.2a.4.4 0 0 0-.4-.4h-1.6a.4.4 0 0 0-.4.4V6z" fill="#fff" />
      <rect x="3" y="6.5" width="18" height="13" rx="2.5" fill="#fff" />
      <path d="M3 11.5h18v1.5H3z" fill={SOFT} />
      <rect x="10.5" y="10.5" width="3" height="3.5" rx="1" fill={SOFT} />
    </>
  ),
  gear: (
    <>
      <path
        d="M10.3 2.8h3.4l.5 2.4a7 7 0 0 1 1.7 1l2.3-.8 1.7 3-1.8 1.6a7 7 0 0 1 0 2l1.8 1.6-1.7 3-2.3-.8a7 7 0 0 1-1.7 1l-.5 2.4h-3.4l-.5-2.4a7 7 0 0 1-1.7-1l-2.3.8-1.7-3 1.8-1.6a7 7 0 0 1 0-2L4.1 8.4l1.7-3 2.3.8a7 7 0 0 1 1.7-1z"
        fill="#fff"
      />
      <circle cx="12" cy="12" r="3.2" fill={SOFT} />
    </>
  ),
  cup: (
    <>
      <path d="M4 8h12v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z" fill="#fff" />
      <path d="M16 9.5h1.5a2.5 2.5 0 0 1 0 5H16v-1.8h1.5a.7.7 0 0 0 0-1.4H16z" fill="#fff" />
      <path d="M3 20h14v1.5H3z" fill={SOFT} />
      <path d="M8 3.5c1 1 1 2 0 3M11.5 3.5c1 1 1 2 0 3" stroke={SOFT} strokeWidth="1.4" strokeLinecap="round" fill="none" />
    </>
  ),
  sandwich: (
    <>
      <path d="M3 12 12 5l9 7z" fill="#fff" />
      <path d="M3.5 13h17l-1 1.6H4.5z" fill={SOFT} />
      <path d="M3 15.5h18v1.8a1.7 1.7 0 0 1-1.7 1.7H4.7A1.7 1.7 0 0 1 3 17.3z" fill="#fff" />
    </>
  ),
  cutlery: (
    <>
      <path d="M6 3v6a2 2 0 0 0 1.3 1.9V21h1.9V10.9A2 2 0 0 0 10.5 9V3H9.3v5H8.7V3H7.8v5h-.6V3z" fill="#fff" />
      <path d="M15 3c2.2 0 3.5 2.5 3.5 5.5 0 2-1 3.5-2.2 4V21h-2V3.2c.2-.1.5-.2.7-.2z" fill="#fff" />
      <circle cx="12.5" cy="12" r="6.5" fill="none" stroke={SOFT} strokeWidth="1.2" />
    </>
  ),
  cocktail: (
    <>
      <path d="M4 4h16l-8 8.5z" fill="#fff" />
      <path d="M7.5 7.7h9L12 12.5z" fill={SOFT} />
      <path d="M11.1 12h1.8v6.5h3v2h-7.8v-2h3z" fill="#fff" />
      <circle cx="17.5" cy="5.5" r="2" fill={SOFT} />
    </>
  ),
  tree: (
    <>
      <circle cx="12" cy="9" r="6" fill="#fff" />
      <circle cx="8" cy="12" r="3.5" fill={SOFT} />
      <circle cx="16" cy="12" r="3.5" fill={SOFT} />
      <path d="M11 13h2v8h-2z" fill="#fff" />
    </>
  ),
  tower: (
    <>
      <path d="M6 21V5.5L12.5 3 18 5v16z" fill="#fff" />
      {[7, 10.5, 14].map((y) => [8.2, 11.4, 14.6].map((x) => <rect key={`${x}-${y}`} x={x} y={y} width="1.8" height="2.2" rx=".4" fill={SOFT} />))}
      <rect x="10.8" y="17.5" width="2.6" height="3.5" rx=".6" fill={SOFT} />
    </>
  ),
  bike: (
    <>
      <circle cx="6" cy="15.5" r="3.8" fill="none" stroke="#fff" strokeWidth="2" />
      <circle cx="18" cy="15.5" r="3.8" fill="none" stroke="#fff" strokeWidth="2" />
      <path d="M6 15.5 10 8h5.5l2.5 7.5M10 8l3.5 7.5H6M14 5.5h3" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="13.5" cy="15.5" r="1.2" fill={SOFT} />
    </>
  ),
  house: (
    <>
      <path d="M12 3.5 21 11h-2.5v9.5h-13V11H3z" fill="#fff" />
      <rect x="10" y="14" width="4" height="6.5" rx="1" fill={SOFT} />
      <rect x="7" y="11.5" width="2.6" height="2.6" rx=".5" fill={SOFT} />
      <rect x="14.4" y="11.5" width="2.6" height="2.6" rx=".5" fill={SOFT} />
    </>
  ),
};
