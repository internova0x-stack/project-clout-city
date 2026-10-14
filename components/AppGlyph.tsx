// One icon family for app tiles and place pins: white, rounded, duotone glyphs
// (solid shapes with a softer secondary layer) drawn on gradient tiles. Replaces
// emoji in tiles so every icon shares one art style on every platform.

export type GlyphName =
  | "news" | "chat" | "cash" | "briefcase" | "gear"
  | "cup" | "sandwich" | "cutlery" | "cocktail" | "tree" | "tower" | "bike" | "house"
  | "wave" | "church" | "dumbbell" | "condo" | "diner"
  | "globe" | "gantry" | "tumbler" | "hanger" | "car" | "cap" | "columns"
  | "pizza" | "cart" | "book" | "shield" | "firetruck" | "film" | "gamepad" | "train" | "sofa";

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
  wave: ["#7FE3F0", "#1E88B8"],
  church: ["#F7D9A8", "#B9785A"],
  dumbbell: ["#A0A8B8", "#3B4252"],
  condo: ["#B8C6FF", "#6B4FD8"],
  diner: ["#FF9AA2", "#D7263D"],
  globe: ["#A8C8E8", "#3E6FA0"],
  gantry: ["#FFB86B", "#5B4A8A"],
  tumbler: ["#E8B27A", "#7A2E3A"],
  hanger: ["#FF9AC8", "#B5246A"],
  sofa: ["#FFD27A", "#D9792B"],
  car: ["#FF8A7A", "#B4232F"],
  cap: ["#FF8A8A", "#9E1B32"],
  columns: ["#9CC0F0", "#2F5DA8"],
  pizza: ["#FFC76B", "#E5484D"],
  cart: ["#8BE6B8", "#1F9A6A"],
  book: ["#F2C48A", "#9A5A2E"],
  shield: ["#8FB2FF", "#2440A8"],
  firetruck: ["#FF8A7A", "#C21F2B"],
  film: ["#FF7AB6", "#7A1F6B"],
  gamepad: ["#B8A2FF", "#4B2FB8"],
  train: ["#FFD966", "#E08A12"],
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
  "skyline-pier": "condo",
  "hunters-pier": "wave",
  "rockaway-diner": "diner",
  "radiant-harbor": "church",
  "pressed-iron-gym": "dumbbell",
  unisphere: "globe",
  "gantry-plaza": "gantry",
  "low-light-lounge": "tumbler",
  "thread-count": "hanger",
  "fifs-furniture": "sofa",
  "boulevard-motors": "car",
  "st-johnsons": "cap",
  "queensborough-u": "columns",
  "ditmars-deli": "sandwich",
  "two-bros-pizza": "pizza",
  "neon-spoon": "diner",
  "up-on-thirty": "cutlery",
  "steinway-fresh": "cart",
  "hellgate-hall": "cocktail",
  "the-sticky-floor": "cocktail",
  "discount-disco": "cocktail",
  "ultraviolet-society": "cocktail",
  "triborough-works": "tower",
  "ditmars-library": "book",
  "precinct-114-half": "shield",
  "engine-7": "firetruck",
  "astoria-cc": "cap",
  "harmony-chapel": "church",
  "hell-gate-park": "tree",
  "rep-count": "dumbbell",
  "astoria-blvd-station": "train",
  "reel-queens": "film",
  "respawn-arena": "gamepad",
  home: "house",
};
const CATEGORY_GLYPHS: Record<string, GlyphName> = {
  food: "cutlery", nightlife: "cocktail", parks: "tree", places: "tower", home: "house", monument: "globe", shopping: "hanger", campus: "columns",
};

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
  // A slice: crust along the top, cheese and two pepperoni.
  pizza: (
    <>
      <path d="M3.5 6.5C9 3 15 3 20.5 6.5L12 21z" fill="#fff" />
      <path d="M3.5 6.5C9 3 15 3 20.5 6.5l-1 1.9C14.6 5.5 9.4 5.5 4.5 8.4z" fill={SOFT} />
      <circle cx="10" cy="10.5" r="1.6" fill={SOFT} />
      <circle cx="13.6" cy="13.8" r="1.3" fill={SOFT} />
    </>
  ),
  // A shopping cart.
  cart: (
    <>
      <path d="M2.5 4h2.6l2.3 10.5h10.8l2.3-7.5H6.4" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M7 8h12.5l-1.7 5.2H8.1z" fill={SOFT} />
      <circle cx="9" cy="18.5" r="1.7" fill="#fff" />
      <circle cx="17" cy="18.5" r="1.7" fill="#fff" />
    </>
  ),
  // An open book.
  book: (
    <>
      <path d="M12 6.5C9.5 4.8 6.5 4.5 3 5v13c3.5-.5 6.5-.2 9 1.5z" fill="#fff" />
      <path d="M12 6.5c2.5-1.7 5.5-2 9-1.5v13c-3.5-.5-6.5-.2-9 1.5z" fill={SOFT} />
      <path d="M12 6.5v13" stroke="#fff" strokeWidth="1.2" />
    </>
  ),
  // A badge shield with a star.
  shield: (
    <>
      <path d="M12 2.5 20 5.5v5.8c0 4.8-3.3 8.4-8 10.2-4.7-1.8-8-5.4-8-10.2V5.5z" fill="#fff" />
      <path d="m12 7.6 1.3 2.7 3 .4-2.2 2.1.5 3-2.6-1.4-2.6 1.4.5-3-2.2-2.1 3-.4z" fill={SOFT} />
    </>
  ),
  // A fire truck with a ladder.
  firetruck: (
    <>
      <path d="M2.5 9.5h11v7h-11z" fill="#fff" />
      <path d="M13.5 11.5h4l3 3v2h-7z" fill="#fff" />
      <path d="M3 7.5 14 4.5" stroke={SOFT} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M15 12.3h2.3l1.6 1.7H15z" fill={SOFT} />
      <circle cx="6.5" cy="17.5" r="2" fill={SOFT} stroke="#fff" strokeWidth="1.2" />
      <circle cx="16.5" cy="17.5" r="2" fill={SOFT} stroke="#fff" strokeWidth="1.2" />
    </>
  ),
  // A clapperboard.
  film: (
    <>
      <rect x="3" y="9.5" width="18" height="10.5" rx="2" fill="#fff" />
      <path d="M3 9.5 20 5.2l.6 2.2L3.6 11.7z" fill={SOFT} />
      <path d="m7 8.4 1.8 2.6M11.4 7.3l1.8 2.6M15.8 6.2l1.8 2.6" stroke="#fff" strokeWidth="1.2" />
      <path d="m10.5 12.5 4.5 2.6-4.5 2.6z" fill={SOFT} />
    </>
  ),
  // A game controller.
  gamepad: (
    <>
      <path d="M7 7.5h10a5 5 0 0 1 4.8 6.4l-.9 3.2a2.4 2.4 0 0 1-4 1.1L14.6 16H9.4l-2.3 2.2a2.4 2.4 0 0 1-4-1.1l-.9-3.2A5 5 0 0 1 7 7.5z" fill="#fff" />
      <path d="M7.5 10.2v3.6M5.7 12h3.6" stroke={SOFT} strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="16" cy="10.8" r="1.1" fill={SOFT} />
      <circle cx="17.8" cy="12.9" r="1.1" fill={SOFT} />
    </>
  ),
  // A subway car on rails.
  train: (
    <>
      <rect x="5" y="3.5" width="14" height="14" rx="3.5" fill="#fff" />
      <rect x="7" y="6" width="10" height="5" rx="1.2" fill={SOFT} />
      <circle cx="8.6" cy="14.2" r="1.2" fill={SOFT} />
      <circle cx="15.4" cy="14.2" r="1.2" fill={SOFT} />
      <path d="m7.5 18-2 3M16.5 18l2 3M6.5 20h11" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
    </>
  ),
  // A graduation cap: the board, the crown and the tassel.
  cap: (
    <>
      <path d="M7 12.5v3.6c0 1.6 2.3 3 5 3s5-1.4 5-3v-3.6l-5 2.3z" fill={SOFT} />
      <path d="M12 4.5 22 9l-10 4.6L2 9z" fill="#fff" />
      <path d="M19.2 10.3v5.2" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="19.2" cy="16.3" r="1.3" fill="#fff" />
    </>
  ),
  // A columned hall: pediment, four columns and the steps.
  columns: (
    <>
      <path d="M12 3.5 21 8H3z" fill="#fff" />
      <rect x="3.5" y="8.6" width="17" height="1.6" rx=".5" fill={SOFT} />
      {[5.2, 9.2, 13.2, 17.2].map((x) => <rect key={x} x={x} y="10.6" width="1.6" height="6.6" rx=".6" fill="#fff" />)}
      <rect x="3" y="17.6" width="18" height="1.6" rx=".5" fill={SOFT} />
      <rect x="2" y="19.4" width="20" height="1.6" rx=".5" fill="#fff" />
    </>
  ),
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
  wave: (
    <>
      <path d="M3 11.5c2 0 2.5-2 4.5-2s2.5 2 4.5 2 2.5-2 4.5-2 2.5 2 4.5 2V15c-2 0-2.5-2-4.5-2s-2.5 2-4.5 2-2.5-2-4.5-2S5 15 3 15z" fill="#fff" />
      <path d="M3 17c2 0 2.5-2 4.5-2s2.5 2 4.5 2 2.5-2 4.5-2 2.5 2 4.5 2v3H3z" fill={SOFT} />
      <rect x="15.5" y="3.5" width="1.6" height="6" rx=".6" fill="#fff" />
      <path d="M13 5.5h6.6v1.6H13z" fill={SOFT} />
    </>
  ),
  church: (
    <>
      <path d="M4 21v-8l8-5.5 8 5.5v8z" fill="#fff" />
      <path d="M10 9.4V6l2-2 2 2v3.4l-2-1.4z" fill={SOFT} />
      <rect x="11.3" y="1.6" width="1.4" height="3.6" rx=".5" fill="#fff" />
      <rect x="10.3" y="2.5" width="3.4" height="1.2" rx=".5" fill="#fff" />
      <path d="M10 21v-4a2 2 0 0 1 4 0v4z" fill={SOFT} />
      <circle cx="12" cy="12.3" r="1.5" fill={SOFT} />
    </>
  ),
  dumbbell: (
    <>
      <rect x="7" y="10.8" width="10" height="2.4" rx="1" fill={SOFT} />
      <rect x="4" y="6.5" width="3.6" height="11" rx="1.4" fill="#fff" />
      <rect x="16.4" y="6.5" width="3.6" height="11" rx="1.4" fill="#fff" />
      <rect x="1.8" y="9" width="2.6" height="6" rx="1" fill={SOFT} />
      <rect x="19.6" y="9" width="2.6" height="6" rx="1" fill={SOFT} />
    </>
  ),
  condo: (
    <>
      <path d="M4 21V8l6-3v16z" fill={SOFT} />
      <path d="M9 21V4.5L15 2l5 2.5V21z" fill="#fff" />
      {[6, 9.5, 13].map((y) => <rect key={y} x="11" y={y} width="7" height="1.6" rx=".6" fill={SOFT} />)}
      <path d="M2 21h20v1.2H2z" fill="#fff" />
    </>
  ),
  diner: (
    <>
      <rect x="3" y="7" width="18" height="10" rx="3" fill="#fff" />
      <rect x="5.5" y="9.3" width="5.5" height="3.4" rx="1" fill={SOFT} />
      <rect x="13" y="9.3" width="5.5" height="3.4" rx="1" fill={SOFT} />
      <rect x="2" y="16" width="20" height="2.4" rx="1.2" fill={SOFT} />
      <rect x="6" y="3.5" width="12" height="2.6" rx="1.3" fill="#fff" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="10" r="7" fill="#fff" />
      <path d="M5 10h14M12 3c2.2 2 3.2 4.4 3.2 7s-1 5-3.2 7c-2.2-2-3.2-4.4-3.2-7s1-5 3.2-7z" fill="none" stroke={SOFT} strokeWidth={1.3} />
      <ellipse cx="12" cy="10" rx="9.5" ry="3" fill="none" stroke="#fff" strokeWidth={1.2} transform="rotate(-20 12 10)" />
      <rect x="11.2" y="16.5" width="1.6" height="3.5" fill="#fff" />
      <rect x="7.5" y="19.5" width="9" height="2" rx="1" fill={SOFT} />
    </>
  ),
  gantry: (
    <>
      <path d="M4 21V7h3v14zM14 21V5h3v16z" fill="#fff" />
      <path d="M3 6h16v2.4H3zM13 4h9v2.4h-9z" fill="#fff" />
      <path d="M7 10l7 4M7 14l7-4M7 18l7-4" stroke={SOFT} strokeWidth={1.3} />
      <rect x="2" y="20" width="20" height="2" rx="1" fill={SOFT} />
    </>
  ),
  tumbler: (
    <>
      <path d="M5.5 5h13l-1.6 14.2a2 2 0 0 1-2 1.8H9.1a2 2 0 0 1-2-1.8z" fill="#fff" />
      <path d="M7.4 12h9.2l-.8 7H8.2z" fill={SOFT} />
      <rect x="9" y="9" width="4" height="4" rx="1" transform="rotate(12 11 11)" fill="#fff" stroke={SOFT} strokeWidth={0.8} />
    </>
  ),
  sofa: (
    <>
      <path d="M5 9.5a2.5 2.5 0 0 1 2.5-2.5h9A2.5 2.5 0 0 1 19 9.5V12H5z" fill={SOFT} />
      <path d="M3 11.5a1.8 1.8 0 0 1 3.6 0V13h10.8v-1.5a1.8 1.8 0 0 1 3.6 0V17a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" fill="#fff" />
      <path d="M5.5 18v1.6M18.5 18v1.6" stroke="#fff" strokeWidth={1.6} strokeLinecap="round" />
    </>
  ),
  hanger: (
    <>
      <path d="M12 4.2a2.2 2.2 0 1 1 2.2 2.2c-.9 0-1.5.6-1.5 1.4v1" fill="none" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" />
      <path d="M12.7 8.6 21 15.4a1.5 1.5 0 0 1-1 2.6H4a1.5 1.5 0 0 1-1-2.6z" fill="#fff" />
      <path d="M5.5 16h13" stroke={SOFT} strokeWidth={1.4} strokeLinecap="round" />
    </>
  ),
  car: (
    <>
      <path d="M3 15v-3l2.2-4.6A2 2 0 0 1 7 6.3h10a2 2 0 0 1 1.8 1.1L21 12v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" fill="#fff" />
      <path d="M6.5 11.5 7.8 8.4h8.4l1.3 3.1z" fill={SOFT} />
      <circle cx="7" cy="16.5" r="2.2" fill="#fff" stroke={SOFT} strokeWidth={1.4} />
      <circle cx="17" cy="16.5" r="2.2" fill="#fff" stroke={SOFT} strokeWidth={1.4} />
    </>
  ),
};
