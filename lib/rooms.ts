import { CLUB_EVENTS } from "./city.ts";

// Walkable 3D rooms (Design guide update 7, replacing the 2.5D backdrops in C38):
// room sizes, furniture layouts, what each piece of furniture does when tapped,
// and the walking grid. Pure data and math so it can be unit tested; the three.js
// scene lives in components/room. Units are meters; the room is centered on the
// origin, x to the right, z toward the camera. Furniture faces +z at rot 0; each
// quarter turn (three.js rotation.y = rot * 90°) turns it to face +x, -z, then -x.

export type FurnitureKind =
  // home
  | "bed" | "sofa" | "armchair" | "coffeeTable" | "tvStand" | "rug" | "plant" | "floorLamp" | "kitchen"
  | "fridge" | "diningTable" | "chair" | "wardrobe" | "desk" | "bookshelf"
  // club and lounge
  | "bar" | "barStool" | "djBooth" | "speaker" | "danceFloor" | "booth" | "piano"
  // boutique
  | "clothesRack" | "mirror" | "displayTable" | "storeCounter"
  // café
  | "cafeCounter" | "cafeTable" | "pastryCase"
  // deli
  | "deliCounter" | "shelf" | "drinksFridge" | "cat"
  // lecture hall
  | "lectureDesk" | "lectern" | "chalkboard"
  // v0.9 monument plazas
  | "globe" | "gantry" | "bench" | "foodCart" | "lamppost" | "tree" | "railing"
  // v0.10 Lucky Star Lotto
  | "lottoCounter" | "cardRack" | "starSign" | "lottoBoard"
  // v0.11 the exclusive venue's second floor
  | "stairs";

export type ItemUse =
  | { kind: "action"; actionId: string }
  | { kind: "events" }
  | { kind: "sit" }
  | { kind: "sleep" }
  | { kind: "look" }
  /** v0.8 the kitchen: the fridge's contents and Cook a meal. */
  | { kind: "cook" }
  /** v0.10 the lotto counter: the scratch-card games. */
  | { kind: "lotto" }
  /** v0.11 the exclusive venue: stairs to another floor of the building. */
  | { kind: "floor"; to: number }
  /** v0.11 the gigs board (offices): opens today's gigs in the Phone. */
  | { kind: "gigs" }
  /** Boutique racks open the Shop on a category (shopping places don't sell anything themselves). */
  | { kind: "shop"; category: "fashion" | "cars" | "houses" | "luxury" | "makeup" };

export interface RoomItem {
  id: string;
  kind: FurnitureKind;
  x: number;
  z: number;
  /** Quarter turns (0 to 3): faces +z, +x, -z, -x. */
  rot: number;
  color?: string;
  use?: ItemUse;
  /** A short label for the tap target ("Work a shift"). */
  label?: string;
}

export interface RoomTemplate {
  id: string;
  /** Interior size in meters (x, z). */
  w: number;
  d: number;
  wall: string;
  wallAccent: string;
  floor: string;
  floorKind: "wood" | "tile" | "concrete" | "checker";
  /** Club lighting: warm night-time interior with colored stage lights, whatever the hour. */
  dark?: boolean;
  /** Daytime lighting whatever the hour (owner, Oct 13: the lotto stays bright). */
  alwaysLit?: boolean;
  /** v0.9 monument plazas: no walls, a raised island of paving, and a landmark taller than a room. */
  outdoor?: { height: number; edge: string; water?: boolean; view: [number, number] };
  window?: boolean;
  items: RoomItem[];
  /** Where the avatar enters. */
  spawn: [number, number];
  /** v0.11 party floors: where the 8 to 10 people at a party stand (lib/partyRoom.ts crowdFor). */
  crowdSpots?: { x: number; z: number; facing: number }[];
  /** People hanging out (positions and facing), drawn as random New Yorkers. */
  npcs?: { x: number; z: number; facing: number; seated?: boolean }[];
}

/** Footprint (x, z) at rot 0, and whether people can walk over it. */
export const FURNITURE: Record<FurnitureKind, { w: number; d: number; walkable?: boolean; label: string; movable?: boolean }> = {
  bed: { w: 1.6, d: 2.1, label: "Bed", movable: true },
  sofa: { w: 2.0, d: 0.9, label: "Sofa", movable: true },
  armchair: { w: 0.9, d: 0.9, label: "Armchair", movable: true },
  coffeeTable: { w: 1.0, d: 0.6, label: "Coffee table", movable: true },
  tvStand: { w: 1.6, d: 0.45, label: "TV", movable: true },
  rug: { w: 2.2, d: 1.6, walkable: true, label: "Rug", movable: true },
  plant: { w: 0.5, d: 0.5, label: "Plant", movable: true },
  floorLamp: { w: 0.4, d: 0.4, label: "Lamp", movable: true },
  kitchen: { w: 2.4, d: 0.65, label: "Kitchen", movable: true },
  fridge: { w: 0.8, d: 0.75, label: "Fridge", movable: true },
  diningTable: { w: 1.2, d: 0.8, label: "Table", movable: true },
  chair: { w: 0.5, d: 0.5, label: "Chair", movable: true },
  wardrobe: { w: 1.2, d: 0.6, label: "Wardrobe", movable: true },
  desk: { w: 1.2, d: 0.6, label: "Desk", movable: true },
  bookshelf: { w: 1.0, d: 0.4, label: "Bookshelf", movable: true },
  bar: { w: 3.2, d: 0.8, label: "Bar" },
  barStool: { w: 0.45, d: 0.45, label: "Stool" },
  djBooth: { w: 1.8, d: 0.9, label: "DJ booth" },
  speaker: { w: 0.7, d: 0.7, label: "Speaker" },
  danceFloor: { w: 3.0, d: 3.0, walkable: true, label: "Dance floor" },
  booth: { w: 2.0, d: 1.0, label: "Booth" },
  cafeCounter: { w: 2.8, d: 0.8, label: "Counter" },
  cafeTable: { w: 0.8, d: 0.8, label: "Table" },
  pastryCase: { w: 1.2, d: 0.6, label: "Pastries" },
  deliCounter: { w: 2.6, d: 0.8, label: "Counter" },
  shelf: { w: 2.0, d: 0.5, label: "Shelf" },
  drinksFridge: { w: 1.4, d: 0.7, label: "Drinks" },
  cat: { w: 0.5, d: 0.3, label: "The cat" },
  piano: { w: 1.5, d: 1.4, label: "Piano" },
  clothesRack: { w: 1.6, d: 0.5, label: "Rack" },
  mirror: { w: 0.9, d: 0.3, label: "Mirror" },
  displayTable: { w: 1.2, d: 0.8, label: "Display" },
  storeCounter: { w: 2.0, d: 0.7, label: "Counter" },
  lectureDesk: { w: 1.6, d: 0.8, label: "Desk" },
  lectern: { w: 0.7, d: 0.6, label: "Lectern" },
  chalkboard: { w: 3.2, d: 0.3, label: "Chalkboard" },
  globe: { w: 5.0, d: 5.0, label: "The globe" },
  gantry: { w: 4.5, d: 1.8, label: "The gantries" },
  bench: { w: 1.6, d: 0.5, label: "Bench" },
  foodCart: { w: 1.3, d: 0.7, label: "Food cart" },
  lamppost: { w: 0.3, d: 0.3, label: "Lamp" },
  tree: { w: 0.8, d: 0.8, label: "Tree" },
  railing: { w: 8.0, d: 0.2, label: "Railing" },
  lottoCounter: { w: 2.6, d: 0.8, label: "Counter" },
  cardRack: { w: 1.4, d: 0.35, label: "Scratch cards" },
  starSign: { w: 1.6, d: 0.2, label: "Sign" },
  lottoBoard: { w: 1.8, d: 0.2, label: "Odds board" },
  stairs: { w: 1.2, d: 1.8, label: "Stairs" },
};

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------
const sit = { kind: "sit" } as const;

/** The starter studio and 1-bedroom (scaled wider with sx). */
const studioItems = (sx: number): RoomItem[] => [
  { id: "bed", kind: "bed", x: -1.85 * sx, z: -1.5, rot: 0, color: "#6C8CFF", use: { kind: "sleep" }, label: "Nap" },
  { id: "lamp", kind: "floorLamp", x: -0.8 * sx, z: -2.3, rot: 0 },
  { id: "tv", kind: "tvStand", x: 0.3 * sx, z: -2.3, rot: 0 },
  { id: "plant", kind: "plant", x: 1.75 * sx, z: -2.3, rot: 0 },
  { id: "kitchen", kind: "kitchen", x: 2.35 * sx, z: -0.6, rot: 3, use: { kind: "cook" }, label: "Kitchen" },
  { id: "rug", kind: "rug", x: 0.3 * sx, z: 0.2, rot: 0, color: "#E0457B" },
  { id: "coffee-table", kind: "coffeeTable", x: 0.3 * sx, z: 0.1, rot: 0 },
  { id: "sofa", kind: "sofa", x: 0.3 * sx, z: 1.4, rot: 2, color: "#FF8A3D", use: sit, label: "Sit" },
  { id: "wardrobe", kind: "wardrobe", x: -2.35 * sx, z: 0.9, rot: 1, use: { kind: "look" }, label: "Your look" },
  { id: "armchair", kind: "armchair", x: -1.9 * sx, z: 1.95, rot: 2, color: "#40B589", use: sit, label: "Sit" },
];

const highriseItems: RoomItem[] = [
  { id: "bed", kind: "bed", x: -2.8, z: -1.8, rot: 0, color: "#1F1B26", use: { kind: "sleep" }, label: "Nap" },
  { id: "lamp", kind: "floorLamp", x: -1.6, z: -2.6, rot: 0 },
  { id: "bookshelf", kind: "bookshelf", x: -0.7, z: -2.65, rot: 0 },
  { id: "tv", kind: "tvStand", x: 1.0, z: -2.6, rot: 0 },
  { id: "plant", kind: "plant", x: 2.3, z: -2.6, rot: 0 },
  { id: "kitchen", kind: "kitchen", x: 3.35, z: -0.6, rot: 3, use: { kind: "cook" }, label: "Kitchen" },
  { id: "rug", kind: "rug", x: 1.0, z: 0.1, rot: 0, color: "#C2AE86" },
  { id: "coffee-table", kind: "coffeeTable", x: 1.0, z: 0.0, rot: 0 },
  { id: "sofa", kind: "sofa", x: 1.0, z: 1.3, rot: 2, color: "#ECE6DC", use: sit, label: "Sit" },
  { id: "wardrobe", kind: "wardrobe", x: -3.4, z: 0.6, rot: 1, use: { kind: "look" }, label: "Your look" },
  { id: "dining", kind: "diningTable", x: -1.4, z: 1.6, rot: 0 },
  { id: "chair-1", kind: "chair", x: -2.35, z: 1.6, rot: 1, use: sit, label: "Sit" },
  { id: "chair-2", kind: "chair", x: -0.45, z: 1.6, rot: 3, use: sit, label: "Sit" },
];

export const HOME_TEMPLATES: Record<string, RoomTemplate> = {
  astoria_studio: {
    id: "astoria_studio", w: 5.4, d: 5.2, wall: "#E9D8C4", wallAccent: "#C9B49C", floor: "#A8744A", floorKind: "wood", window: true,
    items: studioItems(1), spawn: [0.6, 2.3],
  },
  jackson_heights_1br: {
    id: "jackson_heights_1br", w: 6.0, d: 5.4, wall: "#D7E4E0", wallAccent: "#A9C2BB", floor: "#8E6242", floorKind: "wood", window: true,
    items: studioItems(1.1), spawn: [0.6, 2.4],
  },
  lic_highrise: {
    id: "lic_highrise", w: 7.4, d: 5.8, wall: "#ECEAF0", wallAccent: "#C9C6D2", floor: "#C9B79C", floorKind: "wood", window: true,
    items: highriseItems, spawn: [2.2, 2.4],
  },
};

export type PlaceTemplateId = "club" | "cafe" | "counter" | "lounge" | "store" | "campus" | "unisphere" | "gantries" | "lotto" | "office" | "civic" | "gym" | "plaza" | "penthouse";

// v0.11 (spec section 11): every place can be entered. The shared templates take a place's own
// actions: "*0" and "*1" are its first and second action (see placeRoom), so one office serves the
// gigs board and the delivery hub alike.
const MAIN = (n: number): ItemUse => ({ kind: "action", actionId: `*${n}` });

export const PLACE_TEMPLATES: Record<PlaceTemplateId, RoomTemplate> = {
  club: {
    id: "club", w: 8.0, d: 7.0, wall: "#4A2C5E", wallAccent: "#FF2E88", floor: "#2E2440", floorKind: "concrete", dark: true,
    items: [
      { id: "bar", kind: "bar", x: -2.2, z: -2.9, rot: 0, use: { kind: "action", actionId: "visit" }, label: "Get seen" },
      { id: "stool-1", kind: "barStool", x: -3.2, z: -2.1, rot: 0 },
      { id: "stool-2", kind: "barStool", x: -2.2, z: -2.1, rot: 0 },
      { id: "stool-3", kind: "barStool", x: -1.2, z: -2.1, rot: 0 },
      { id: "dj", kind: "djBooth", x: 2.4, z: -2.9, rot: 0 },
      { id: "speaker-1", kind: "speaker", x: 3.65, z: -2.9, rot: 0 },
      { id: "speaker-2", kind: "speaker", x: 1.15, z: -2.9, rot: 0 },
      { id: "floor", kind: "danceFloor", x: 1.6, z: 0.2, rot: 0, use: { kind: "events" }, label: "Dance" },
      { id: "booth", kind: "booth", x: -3.4, z: 1.4, rot: 1, color: "#6B2BD9" },
    ],
    spawn: [0, 3.0],
    npcs: [
      { x: 1.0, z: 0.0, facing: 0.6 }, { x: 2.2, z: 0.6, facing: -2.4 }, { x: -2.2, z: -2.1, facing: 3.14, seated: true },
      { x: 2.4, z: -2.2, facing: 0 }, { x: -1.2, z: -2.1, facing: 3.14, seated: true },
    ],
  },
  cafe: {
    id: "cafe", w: 7.0, d: 6.0, wall: "#F4E3C8", wallAccent: "#C27C4E", floor: "#D9C2A0", floorKind: "checker", window: true,
    items: [
      { id: "counter", kind: "cafeCounter", x: -1.4, z: -2.3, rot: 0, use: { kind: "action", actionId: "shift" }, label: "Work a shift" },
      { id: "pastries", kind: "pastryCase", x: 1.0, z: -2.4, rot: 0 },
      { id: "table-1", kind: "cafeTable", x: -1.8, z: 0.8, rot: 0, use: { kind: "action", actionId: "eat" }, label: "Brunch" },
      { id: "table-2", kind: "cafeTable", x: 0.6, z: 0.4, rot: 0, use: { kind: "action", actionId: "eat" }, label: "Brunch" },
      { id: "table-3", kind: "cafeTable", x: 2.4, z: 1.4, rot: 0 },
      { id: "chair-1", kind: "chair", x: -2.6, z: 0.8, rot: 1 },
      { id: "chair-2", kind: "chair", x: 1.4, z: 0.4, rot: 3 },
      { id: "chair-3", kind: "chair", x: 2.4, z: 2.2, rot: 2 },
      { id: "plant-1", kind: "plant", x: 3.0, z: -2.4, rot: 0 },
      { id: "plant-2", kind: "plant", x: -3.0, z: 2.4, rot: 0 },
    ],
    spawn: [0.4, 2.4],
    npcs: [{ x: -1.4, z: -2.85, facing: 0 }, { x: 1.4, z: 0.4, facing: -1.57, seated: true }, { x: 2.4, z: 2.2, facing: 3.14, seated: true }],
  },
  counter: {
    id: "counter", w: 6.0, d: 5.4, wall: "#E8E2D0", wallAccent: "#2E8B63", floor: "#B9B2A4", floorKind: "tile",
    items: [
      { id: "counter", kind: "deliCounter", x: -1.0, z: -2.0, rot: 0, use: { kind: "action", actionId: "eat" }, label: "Chopped cheese" },
      { id: "shelf-1", kind: "shelf", x: 1.6, z: -2.35, rot: 0 },
      { id: "shelf-2", kind: "shelf", x: 1.8, z: 0.6, rot: 3 },
      { id: "fridge", kind: "drinksFridge", x: -2.5, z: 0.4, rot: 1 },
      { id: "cat", kind: "cat", x: -0.2, z: -1.35, rot: 0 },
    ],
    spawn: [0, 2.0],
    npcs: [{ x: -1.0, z: -2.65, facing: 0 }, { x: 0.6, z: 0.9, facing: -2.6 }],
  },
  // Wave 3 (v0.5): a warm, low-lit lounge and a bright boutique.
  lounge: {
    id: "lounge", w: 7.6, d: 6.6, wall: "#3A2430", wallAccent: "#B8743A", floor: "#5A3E2B", floorKind: "wood", dark: true,
    items: [
      { id: "bar", kind: "bar", x: -1.8, z: -2.7, rot: 0, use: { kind: "action", actionId: "visit" }, label: "Order a drink" },
      { id: "stool-1", kind: "barStool", x: -2.8, z: -1.9, rot: 0 },
      { id: "stool-2", kind: "barStool", x: -1.8, z: -1.9, rot: 0 },
      { id: "piano", kind: "piano", x: 2.6, z: -2.3, rot: 0 },
      { id: "booth-1", kind: "booth", x: -3.2, z: 1.2, rot: 1, color: "#7A2E3A" },
      { id: "sofa", kind: "sofa", x: 1.6, z: 2.4, rot: 2, color: "#7A2E3A" },
      { id: "table", kind: "coffeeTable", x: 1.6, z: 1.3, rot: 0 },
      { id: "chair", kind: "armchair", x: 3.1, z: 0.5, rot: 3, color: "#B8743A" },
      { id: "rope", kind: "rug", x: 0.2, z: 0.2, rot: 0, use: { kind: "events" }, label: "Guest list" },
      { id: "lamp", kind: "floorLamp", x: 3.4, z: 2.8, rot: 0 },
      { id: "plant", kind: "plant", x: -3.45, z: -0.9, rot: 0 },
    ],
    spawn: [-0.6, 2.6],
    npcs: [
      { x: -2.8, z: -1.9, facing: 3.14, seated: true }, { x: 2.6, z: -1.3, facing: 3.14 }, { x: 1.2, z: 2.4, facing: 3.14, seated: true },
      { x: -1.8, z: -3.15, facing: 0 },
    ],
  },
  store: {
    id: "store", w: 7.0, d: 6.0, wall: "#F4EDE6", wallAccent: "#E0457B", floor: "#E6DCD0", floorKind: "wood", window: true,
    items: [
      { id: "rack-1", kind: "clothesRack", x: -2.2, z: -2.4, rot: 0, use: { kind: "shop", category: "fashion" }, label: "Browse the racks" },
      { id: "rack-2", kind: "clothesRack", x: 1.2, z: -2.4, rot: 0 },
      { id: "rack-3", kind: "clothesRack", x: -2.9, z: 0.6, rot: 1 },
      { id: "display", kind: "displayTable", x: 0.0, z: 0.2, rot: 0, use: { kind: "action", actionId: "browse" }, label: "Try things on" },
      { id: "mirror", kind: "mirror", x: 3.2, z: -0.4, rot: 3 },
      { id: "counter", kind: "storeCounter", x: 2.2, z: 2.1, rot: 2 },
      { id: "plant", kind: "plant", x: 3.0, z: -2.5, rot: 0 },
    ],
    spawn: [-0.8, 2.3],
    npcs: [{ x: 2.2, z: 2.6, facing: 3.14 }, { x: 1.2, z: -1.6, facing: 3.14 }],
  },
  // The parody universities: a lecture hall with rows of desks facing the board.
  campus: {
    id: "campus", w: 8.0, d: 7.0, wall: "#EDE4D3", wallAccent: "#7A5A3A", floor: "#B08A5E", floorKind: "wood", window: true,
    items: [
      { id: "board", kind: "chalkboard", x: -0.4, z: -3.3, rot: 0, use: { kind: "events" }, label: "Campus events" },
      { id: "lectern", kind: "lectern", x: 2.0, z: -2.3, rot: 0 },
      { id: "desk-1", kind: "lectureDesk", x: -2.5, z: -0.6, rot: 2, use: { kind: "action", actionId: "lecture" }, label: "Take notes" },
      { id: "desk-2", kind: "lectureDesk", x: 0.0, z: -0.6, rot: 2 },
      { id: "desk-3", kind: "lectureDesk", x: 2.5, z: -0.6, rot: 2 },
      { id: "desk-4", kind: "lectureDesk", x: -2.5, z: 0.9, rot: 2 },
      { id: "desk-5", kind: "lectureDesk", x: 0.0, z: 0.9, rot: 2, use: { kind: "action", actionId: "lecture" }, label: "Take notes" },
      { id: "desk-6", kind: "lectureDesk", x: 2.5, z: 0.9, rot: 2 },
      { id: "shelf-1", kind: "bookshelf", x: -3.75, z: 2.4, rot: 1 },
      { id: "plant-1", kind: "plant", x: 3.6, z: -3.1, rot: 0 },
      { id: "plant-2", kind: "plant", x: 3.6, z: 3.1, rot: 0 },
    ],
    spawn: [0.6, 2.8],
    npcs: [
      { x: 2.0, z: -2.85, facing: 0 },
      { x: 0.3, z: -0.3, facing: 3.14, seated: true }, { x: 2.2, z: -0.3, facing: 3.14, seated: true },
      { x: -2.2, z: 1.2, facing: 3.14, seated: true }, { x: 2.8, z: 1.2, facing: 3.14, seated: true },
    ],
  },
  // v0.10 Lucky Star Lotto: a narrow, sunny yellow shop (owner, Oct 13). The counter (Benny behind it) opens the games; the
  // rack and the odds board open them too, so any tap near the cards works.
  lotto: {
    id: "lotto", w: 6.4, d: 5.6, wall: "#FFD84D", wallAccent: "#F2A900", floor: "#F5C542", floorKind: "checker", window: true, alwaysLit: true,
    items: [
      { id: "counter", kind: "lottoCounter", x: -0.6, z: -1.9, rot: 0, use: { kind: "lotto" }, label: "Scratch cards" },
      { id: "sign", kind: "starSign", x: -2.3, z: -2.7, rot: 0 },
      { id: "rack", kind: "cardRack", x: 2.3, z: -2.6, rot: 0, use: { kind: "lotto" }, label: "Pick a game" },
      { id: "board", kind: "lottoBoard", x: -3.1, z: 0.0, rot: 1, use: { kind: "lotto" }, label: "The odds" },
      { id: "stool", kind: "barStool", x: 0.7, z: -1.1, rot: 0 },
      { id: "stool-2", kind: "barStool", x: -1.9, z: -1.1, rot: 0 },
      { id: "plant-2", kind: "plant", x: 2.8, z: 2.3, rot: 0 },
      { id: "plant", kind: "plant", x: -2.9, z: 2.3, rot: 0 },
    ],
    spawn: [0.2, 1.9],
    npcs: [{ x: -0.6, z: -2.4, facing: 0 }, { x: 1.4, z: 0.4, facing: 2.4 }],
  },
  // ---- v0.9 monument plazas (#32): one shared outdoor plaza, each with its own landmark ----
  unisphere: {
    id: "unisphere", w: 18.0, d: 16.0, wall: "#BFD3E0", wallAccent: "#8FA4B8", floor: "#D9CFC0", floorKind: "tile",
    // Plazas are several times an apartment's floor (owner, Oct 13); the camera follows the player.
    outdoor: { height: 5.5, edge: "#7FA36A", view: [10, 9] },
    items: [
      { id: "globe", kind: "globe", x: 0, z: -3.5, rot: 0, use: { kind: "action", actionId: "visit" }, label: "Pose with the globe" },
      { id: "coin", kind: "rug", x: 2.8, z: 0.6, rot: 0, color: "#7FC8E8", use: { kind: "action", actionId: "wish" }, label: "Toss a coin" },
      { id: "tour", kind: "lamppost", x: -4.0, z: 0.8, rot: 0, use: { kind: "action", actionId: "tour" }, label: "Walt's tour" },
      { id: "cart", kind: "foodCart", x: 6.0, z: -2.6, rot: 3, color: "#E0457B", use: { kind: "action", actionId: "pretzel" }, label: "Pretzel cart" },
      { id: "bench-1", kind: "bench", x: -6.6, z: 3.0, rot: 1, use: { kind: "action", actionId: "people" }, label: "People-watch" },
      { id: "bench-2", kind: "bench", x: 5.4, z: 4.2, rot: 2, use: { kind: "sit" }, label: "Sit" },
      { id: "bench-3", kind: "bench", x: -1.8, z: 6.2, rot: 2, use: { kind: "sit" }, label: "Sit" },
      { id: "lamp-1", kind: "lamppost", x: -5.2, z: -6.6, rot: 0 },
      { id: "lamp-2", kind: "lamppost", x: 5.2, z: -6.6, rot: 0 },
      { id: "lamp-3", kind: "lamppost", x: 3.8, z: 3.4, rot: 0 },
      { id: "tree-1", kind: "tree", x: -7.6, z: -6.4, rot: 0 },
      { id: "tree-2", kind: "tree", x: 7.6, z: -6.6, rot: 0 },
      { id: "tree-3", kind: "tree", x: -7.6, z: 6.6, rot: 0 },
      { id: "tree-4", kind: "tree", x: 7.6, z: 6.6, rot: 0 },
      { id: "tree-5", kind: "tree", x: 1.8, z: 7.0, rot: 0 },
      { id: "bed-1", kind: "plant", x: -7.7, z: -1.0, rot: 0 },
      { id: "bed-2", kind: "plant", x: 7.7, z: 1.2, rot: 0 },
    ],
    spawn: [0.4, 5.0],
    npcs: [
      { x: -4.0, z: 0.2, facing: 3.14 }, { x: 5.2, z: -2.6, facing: 1.57 }, { x: -2.6, z: -0.4, facing: 0.6 },
      { x: 1.4, z: 1.6, facing: 2.6 }, { x: 6.4, z: 2.0, facing: 4.2 }, { x: -6.0, z: -3.4, facing: 0.9 },
      { x: 3.2, z: -0.4, facing: 3.6 },
    ],
  },
  gantries: {
    id: "gantries", w: 18.0, d: 14.0, wall: "#BFD3E0", wallAccent: "#3A3540", floor: "#CFC6B8", floorKind: "concrete",
    outdoor: { height: 5.5, edge: "#5B87B5", water: true, view: [10, 9] },
    items: [
      { id: "gantries", kind: "gantry", x: -2.0, z: -5.0, rot: 0, use: { kind: "action", actionId: "visit" }, label: "Catch the skyline" },
      { id: "rail-1", kind: "railing", x: -4.5, z: -6.8, rot: 0 },
      { id: "rail-2", kind: "railing", x: 4.5, z: -6.8, rot: 0 },
      { id: "shoot", kind: "rug", x: 4.6, z: -4.2, rot: 0, color: "#F2A900", use: { kind: "action", actionId: "photoshoot" }, label: "Golden hour shoot" },
      { id: "lawn", kind: "rug", x: -5.6, z: 2.0, rot: 0, color: "#40B589", use: { kind: "action", actionId: "picnic" }, label: "Picnic on the lawn" },
      { id: "lawn-2", kind: "rug", x: -5.6, z: 4.2, rot: 0, color: "#40B589" },
      { id: "bench-1", kind: "bench", x: 2.0, z: 1.4, rot: 2, use: { kind: "action", actionId: "ferries" }, label: "Watch the ferries" },
      { id: "bench-2", kind: "bench", x: 6.6, z: -1.6, rot: 2, use: { kind: "sit" }, label: "Sit" },
      { id: "bench-3", kind: "bench", x: -1.4, z: 4.6, rot: 2, use: { kind: "sit" }, label: "Sit" },
      { id: "cart", kind: "foodCart", x: 6.6, z: 3.6, rot: 3, color: "#6C8CFF" },
      { id: "run", kind: "lamppost", x: -0.4, z: 0.4, rot: 0, use: { kind: "action", actionId: "run" }, label: "Run the river path" },
      { id: "lamp-1", kind: "lamppost", x: -7.6, z: -5.6, rot: 0 },
      { id: "lamp-2", kind: "lamppost", x: 7.6, z: -5.6, rot: 0 },
      { id: "lamp-3", kind: "lamppost", x: 3.2, z: 5.8, rot: 0 },
      { id: "tree-1", kind: "tree", x: -7.8, z: -1.4, rot: 0 },
      { id: "tree-2", kind: "tree", x: 7.8, z: 6.0, rot: 0 },
      { id: "tree-3", kind: "tree", x: -7.8, z: 6.0, rot: 0 },
    ],
    spawn: [0.4, 4.4],
    npcs: [
      { x: 3.6, z: -5.6, facing: 3.14 }, { x: 4.6, z: -5.4, facing: 3.14 }, { x: -5.0, z: 1.8, facing: 0.8, seated: true },
      { x: -1.2, z: -3.6, facing: 3.14 }, { x: 5.4, z: 2.4, facing: 4.2 }, { x: 0.6, z: 3.0, facing: 1.2 },
      { x: -3.6, z: -1.6, facing: 2.2 },
    ],
  },
  // ---- v0.11 the exclusive venue's second floor (spec section 10): the Penthouse Floor, where the party is ----
  penthouse: {
    id: "penthouse", w: 8.4, d: 7.2, wall: "#241A33", wallAccent: "#F2A900", floor: "#1C1626", floorKind: "concrete", dark: true,
    items: [
      { id: "stairs-down", kind: "stairs", x: -3.3, z: 2.2, rot: 2, use: { kind: "floor", to: 1 }, label: "Downstairs ↓" },
      { id: "dj", kind: "djBooth", x: 1.6, z: -3.0, rot: 0 },
      { id: "speaker-1", kind: "speaker", x: 3.2, z: -3.05, rot: 0 },
      { id: "speaker-2", kind: "speaker", x: 0.0, z: -3.05, rot: 0 },
      { id: "floor", kind: "danceFloor", x: 1.4, z: -0.6, rot: 0, use: { kind: "events" }, label: "The party" },
      { id: "bar", kind: "bar", x: -2.2, z: -3.0, rot: 0 },
      { id: "booth-1", kind: "booth", x: -3.6, z: -0.4, rot: 1, color: "#F2A900" },
      { id: "sofa", kind: "sofa", x: 2.6, z: 2.9, rot: 2, color: "#7A2E3A" },
      { id: "plant-1", kind: "plant", x: 3.85, z: 0.8, rot: 0 },
      { id: "plant-2", kind: "plant", x: -1.5, z: 3.25, rot: 0 },
    ],
    spawn: [-2.0, 2.6],
    crowdSpots: [
      { x: 0.4, z: -1.5, facing: 0.6 }, { x: 2.6, z: -1.3, facing: -2.4 }, { x: 1.5, z: 0.5, facing: 3.0 },
      { x: -0.8, z: 0.4, facing: 1.2 }, { x: 3.4, z: -0.1, facing: -1.8 }, { x: -2.8, z: -2.2, facing: 3.14 },
      { x: -1.0, z: -2.2, facing: 3.14 }, { x: -0.6, z: 2.2, facing: 0.4 }, { x: 1.0, z: 2.0, facing: 2.6 },
      { x: -2.4, z: 1.0, facing: 1.6 },
    ],
  },
  // ---- v0.11 shared templates: recolored per place, with its own sign and actions ----
  office: {
    id: "office", w: 7.2, d: 6.2, wall: "#E9EEF2", wallAccent: "#5B7FA6", floor: "#C9C3B8", floorKind: "concrete", window: true,
    items: [
      { id: "reception", kind: "storeCounter", x: -1.6, z: -2.4, rot: 0, use: MAIN(0), label: "*" },
      { id: "desk-1", kind: "desk", x: 1.6, z: -2.5, rot: 0 },
      { id: "chair-1", kind: "chair", x: 1.6, z: -1.75, rot: 2 },
      { id: "desk-2", kind: "desk", x: 1.9, z: 0.4, rot: 3, use: MAIN(1), label: "*" },
      { id: "chair-2", kind: "chair", x: 1.1, z: 0.4, rot: 1 },
      { id: "desk-3", kind: "desk", x: -2.0, z: 0.6, rot: 1 },
      { id: "chair-3", kind: "chair", x: -1.2, z: 0.6, rot: 3 },
      { id: "shelf", kind: "bookshelf", x: -3.35, z: -1.4, rot: 1 },
      { id: "plant-1", kind: "plant", x: 3.2, z: -2.6, rot: 0 },
      { id: "plant-2", kind: "plant", x: -3.2, z: 2.6, rot: 0 },
      { id: "sofa", kind: "sofa", x: 2.1, z: 2.5, rot: 2, color: "#5B7FA6", use: { kind: "sit" }, label: "Sit" },
    ],
    spawn: [-0.4, 2.5],
    npcs: [{ x: -1.6, z: -2.95, facing: 0 }, { x: 1.6, z: -1.75, facing: 3.14, seated: true }, { x: -1.2, z: 0.6, facing: -1.57, seated: true }],
  },
  // Civic places (library, precinct, firehouse, chapel, lobbies, cinema): a front desk and rows of benches.
  civic: {
    id: "civic", w: 7.6, d: 6.6, wall: "#EFE7D8", wallAccent: "#7A6A55", floor: "#B39C7C", floorKind: "wood", window: true,
    items: [
      { id: "desk", kind: "storeCounter", x: 0.0, z: -2.6, rot: 0, use: MAIN(0), label: "*" },
      { id: "shelf-1", kind: "bookshelf", x: -2.6, z: -3.05, rot: 0 },
      { id: "shelf-2", kind: "bookshelf", x: 2.6, z: -3.05, rot: 0 },
      { id: "bench-1", kind: "bench", x: -1.6, z: -0.6, rot: 2, use: MAIN(1), label: "*" },
      { id: "bench-2", kind: "bench", x: 1.6, z: -0.6, rot: 2, use: { kind: "sit" }, label: "Sit" },
      { id: "bench-3", kind: "bench", x: -1.6, z: 0.9, rot: 2 },
      { id: "bench-4", kind: "bench", x: 1.6, z: 0.9, rot: 2 },
      { id: "plant-1", kind: "plant", x: -3.5, z: 2.9, rot: 0 },
      { id: "plant-2", kind: "plant", x: 3.5, z: 2.9, rot: 0 },
      { id: "lamp", kind: "floorLamp", x: 3.5, z: -1.4, rot: 0 },
    ],
    spawn: [0.0, 2.7],
    npcs: [{ x: 0.0, z: -3.1, facing: 0 }, { x: -1.6, z: 0.95, facing: 3.14, seated: true }, { x: 2.4, z: 2.0, facing: 2.4 }],
  },
  // Gyms: mats, mirrors along the back and a bench to rest on.
  gym: {
    id: "gym", w: 7.2, d: 6.2, wall: "#E4E6EA", wallAccent: "#D93A2F", floor: "#3A3A42", floorKind: "concrete", window: true,
    items: [
      { id: "mat-1", kind: "rug", x: -1.5, z: -0.9, rot: 0, color: "#D93A2F", use: MAIN(0), label: "*" },
      { id: "mat-2", kind: "rug", x: 1.5, z: -0.9, rot: 0, color: "#2E2E36" },
      { id: "mirror-1", kind: "mirror", x: -1.6, z: -2.9, rot: 0 },
      { id: "mirror-2", kind: "mirror", x: 0.0, z: -2.9, rot: 0 },
      { id: "mirror-3", kind: "mirror", x: 1.6, z: -2.9, rot: 0 },
      { id: "bench", kind: "bench", x: -2.4, z: 1.6, rot: 1, use: { kind: "sit" }, label: "Catch your breath" },
      { id: "speaker", kind: "speaker", x: 3.1, z: -2.6, rot: 0 },
      { id: "counter", kind: "storeCounter", x: 2.2, z: 2.3, rot: 2, use: MAIN(1), label: "*" },
      { id: "plant", kind: "plant", x: -3.2, z: -2.7, rot: 0 },
    ],
    spawn: [0.0, 2.5],
    npcs: [{ x: -1.2, z: -1.2, facing: 3.14 }, { x: 1.6, z: -0.6, facing: 0.6 }, { x: 2.2, z: 2.8, facing: 3.14 }],
  },
  // Parks and piers: a plaza with trees, benches and a cart (smaller than the monument plazas).
  plaza: {
    id: "plaza", w: 14.0, d: 12.0, wall: "#BFD3E0", wallAccent: "#7FA36A", floor: "#D4CBB8", floorKind: "tile",
    outdoor: { height: 4.5, edge: "#7FA36A", view: [10, 9] },
    items: [
      { id: "lawn", kind: "rug", x: -3.0, z: -1.6, rot: 0, color: "#7CC86B", use: MAIN(0), label: "*" },
      { id: "lawn-2", kind: "rug", x: -3.0, z: 0.2, rot: 0, color: "#7CC86B" },
      { id: "bench-1", kind: "bench", x: 2.4, z: -2.6, rot: 2, use: MAIN(1), label: "*" },
      { id: "bench-2", kind: "bench", x: 3.6, z: 1.6, rot: 3, use: { kind: "sit" }, label: "Sit" },
      { id: "cart", kind: "foodCart", x: -4.6, z: 3.4, rot: 1, color: "#F2A900" },
      { id: "lamp-1", kind: "lamppost", x: -1.0, z: -4.6, rot: 0 },
      { id: "lamp-2", kind: "lamppost", x: 5.2, z: -0.6, rot: 0 },
      { id: "tree-1", kind: "tree", x: -6.0, z: -5.0, rot: 0 },
      { id: "tree-2", kind: "tree", x: 6.0, z: -5.0, rot: 0 },
      { id: "tree-3", kind: "tree", x: 6.0, z: 4.6, rot: 0 },
      { id: "tree-4", kind: "tree", x: 0.6, z: -5.2, rot: 0 },
      { id: "bed-1", kind: "plant", x: -6.2, z: 1.0, rot: 0 },
    ],
    spawn: [0.4, 4.4],
    npcs: [{ x: -2.4, z: -1.0, facing: 0.8, seated: true }, { x: 2.4, z: -2.0, facing: 3.14 }, { x: 4.4, z: -2.6, facing: 2.2 }, { x: -1.0, z: 1.8, facing: 1.2 }],
  },
};

/** v0.11: the exclusive venue's stairs, on the ground floor. */
const VENUE_STAIRS: RoomItem = { id: "stairs-up", kind: "stairs", x: 0.7, z: -2.4, rot: 0, use: { kind: "floor", to: 2 }, label: "Upstairs ↑" };

/** The bits of a place a room needs (lib/city.ts Place). */
export interface RoomPlace {
  id: string;
  template?: string;
  depth?: string;
  palette?: string[];
  opensShop?: string;
  actions: { id: string; label: string; kind: string }[];
}

/**
 * v0.11: the room for a place, or null (a subway station: map label and lore). Shared templates take
 * the place's own actions: placeholders ("*0", "*1") and any action id the place doesn't have are
 * given its actions in order, labelled with their names; items left over just sit there. Events,
 * the gigs board and Shop racks follow the place. Places that used to be scene cards are recolored
 * with their palette.
 */
export function placeRoom(place: RoomPlace & { tags?: string[] }): RoomTemplate | null {
  // Club nights, campus events and exclusive parties are held here; elsewhere the dance floor is just a floor.
  const hasEvents = CLUB_EVENTS.some((e) => e.placeId === place.id) || !!place.tags?.includes("exclusive_venue");
  const base = place.template && place.template !== "apartment" ? PLACE_TEMPLATES[place.template as PlaceTemplateId] : undefined;
  if (!base) return null;
  const ids = new Set(place.actions.map((a) => a.id));
  const free = place.actions.filter((a) => !base.items.some((i) => i.use?.kind === "action" && i.use.actionId === a.id));
  const take = (n?: number) => {
    const a = n !== undefined && free[n] && !used.has(free[n].id) ? free[n] : free.find((x) => !used.has(x.id));
    if (a) used.add(a.id);
    return a;
  };
  const used = new Set<string>();
  const items = base.items.map((it): RoomItem => {
    const u = it.use;
    if (u?.kind === "action" && !ids.has(u.actionId)) {
      const want = u.actionId.startsWith("*") ? Number(u.actionId.slice(1)) : undefined;
      const a = take(want);
      if (!a) return { ...it, use: undefined, label: undefined };
      return { ...it, use: a.kind === "gigs" ? { kind: "gigs" } : { kind: "action", actionId: a.id }, label: a.label };
    }
    if (u?.kind === "events" && !hasEvents) return { ...it, use: undefined, label: undefined };
    // A shared room in a place that used to be a scene card: its actions keep the place's own names.
    if (u?.kind === "action" && place.depth === "scene") return { ...it, label: place.actions.find((a) => a.id === u.actionId)?.label ?? it.label };
    if (u?.kind === "shop" && place.opensShop && place.opensShop !== u.category) return { ...it, use: { kind: "shop", category: place.opensShop as Extract<ItemUse, { kind: "shop" }>["category"] } };
    return it;
  });
  const accent = place.depth === "scene" && place.palette?.[0];
  // The exclusive venue has a second floor: stairs up from the lounge.
  if (place.tags?.includes("exclusive_venue")) items.push(VENUE_STAIRS);
  return { ...base, id: `${base.id}:${place.id}`, items, ...(accent ? { wallAccent: accent } : {}) };
}

/** v0.11: a building's other floors (the exclusive venue's Penthouse Floor), by floor number. */
export function placeFloor(place: RoomPlace & { tags?: string[] }, floor: number): RoomTemplate | null {
  if (floor <= 1) return placeRoom(place);
  if (!place.tags?.includes("exclusive_venue") || floor !== 2) return null;
  return { ...PLACE_TEMPLATES.penthouse, id: `penthouse:${place.id}` };
}

// ---------------------------------------------------------------------------
// Layout and geometry helpers
// ---------------------------------------------------------------------------
export interface LayoutEntry { id: string; x: number; z: number; rot: number }

export function footprint(item: Pick<RoomItem, "kind" | "rot">): { w: number; d: number } {
  const f = FURNITURE[item.kind];
  return item.rot % 2 ? { w: f.d, d: f.w } : { w: f.w, d: f.d };
}

/** Keeps an item fully inside the room. */
export function clampItem(t: RoomTemplate, item: RoomItem): RoomItem {
  const { w, d } = footprint(item);
  const x = Math.min(t.w / 2 - w / 2, Math.max(-t.w / 2 + w / 2, item.x));
  const z = Math.min(t.d / 2 - d / 2, Math.max(-t.d / 2 + d / 2, item.z));
  return { ...item, x, z };
}

function overlaps(a: RoomItem, b: RoomItem): boolean {
  const fa = footprint(a);
  const fb = footprint(b);
  return Math.abs(a.x - b.x) < (fa.w + fb.w) / 2 - 0.02 && Math.abs(a.z - b.z) < (fa.d + fb.d) / 2 - 0.02;
}

/** True when a moved item sits inside the room without overlapping solid furniture. Rugs may sit under things. */
export function placementOk(t: RoomTemplate, items: RoomItem[], moved: RoomItem): boolean {
  const c = clampItem(t, moved);
  if (Math.abs(c.x - moved.x) > 1e-6 || Math.abs(c.z - moved.z) > 1e-6) return false;
  if (FURNITURE[moved.kind].walkable) return true;
  return items.every((o) => o.id === moved.id || FURNITURE[o.kind].walkable || !overlaps(o, moved));
}

/** Applies a saved home layout to a template; unknown ids and bad numbers are ignored. */
export function applyLayout(t: RoomTemplate, raw: unknown): RoomItem[] {
  const entries = Array.isArray(raw) ? (raw as Partial<LayoutEntry>[]) : [];
  const byId = new Map(entries.filter((e) => e && typeof e.id === "string").map((e) => [e.id as string, e]));
  const out: RoomItem[] = [];
  for (const item of t.items) {
    const e = byId.get(item.id);
    let next = item;
    if (e && Number.isFinite(e.x) && Number.isFinite(e.z) && Number.isInteger(e.rot) && FURNITURE[item.kind].movable) {
      next = clampItem(t, { ...item, x: e.x as number, z: e.z as number, rot: (((e.rot as number) % 4) + 4) % 4 });
      if (!placementOk(t, [...out, ...t.items.filter((o) => o.id !== item.id)], next)) next = item;
    }
    out.push(next);
  }
  return out;
}

export function toLayout(items: RoomItem[]): LayoutEntry[] {
  return items.filter((i) => FURNITURE[i.kind].movable).map((i) => ({ id: i.id, x: round(i.x), z: round(i.z), rot: i.rot }));
}

const round = (v: number) => Math.round(v * 100) / 100;
export const GRID = 0.25;
export const snap = (v: number) => Math.round(v / GRID) * GRID;

export const FACING: [number, number][] = [[0, 1], [1, 0], [0, -1], [-1, 0]];

/** Where someone stands to use an item: just in front of it. */
export function useSpot(item: RoomItem): [number, number] {
  const { d } = FURNITURE[item.kind];
  const gap = FURNITURE[item.kind].walkable ? 0 : d / 2 + 0.45;
  const dir = FACING[item.rot % 4];
  return [item.x + dir[0] * gap, item.z + dir[1] * gap];
}

// ---------------------------------------------------------------------------
// Walking: A* on a 0.25 m grid around solid furniture.
// ---------------------------------------------------------------------------
const BODY_RADIUS = 0.22;

export function makeGrid(t: RoomTemplate, items: RoomItem[]) {
  const cols = Math.floor(t.w / GRID);
  const rows = Math.floor(t.d / GRID);
  const toX = (c: number) => -t.w / 2 + (c + 0.5) * GRID;
  const toZ = (r: number) => -t.d / 2 + (r + 0.5) * GRID;
  const blocked = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = toX(c);
      const z = toZ(r);
      const edge = Math.abs(x) > t.w / 2 - BODY_RADIUS || Math.abs(z) > t.d / 2 - BODY_RADIUS;
      const hit = items.some((i) => {
        if (FURNITURE[i.kind].walkable) return false;
        const f = footprint(i);
        return Math.abs(x - i.x) < f.w / 2 + BODY_RADIUS && Math.abs(z - i.z) < f.d / 2 + BODY_RADIUS;
      });
      blocked[r * cols + c] = edge || hit ? 1 : 0;
    }
  }
  const cellOf = (x: number, z: number) => [
    Math.min(cols - 1, Math.max(0, Math.floor((x + t.w / 2) / GRID))),
    Math.min(rows - 1, Math.max(0, Math.floor((z + t.d / 2) / GRID))),
  ];
  return { cols, rows, blocked, toX, toZ, cellOf };
}

/** Nearest walkable point to (x, z). */
export function nearestFree(grid: ReturnType<typeof makeGrid>, x: number, z: number): [number, number] | null {
  const [c0, r0] = grid.cellOf(x, z);
  let best: [number, number] | null = null;
  let bestD = Infinity;
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      if (grid.blocked[r * grid.cols + c]) continue;
      const d = (c - c0) ** 2 + (r - r0) ** 2;
      if (d < bestD) { bestD = d; best = [grid.toX(c), grid.toZ(r)]; }
    }
  }
  return best;
}

/** Path of points from start to goal (both snapped to free cells), or [] when unreachable. */
export function findPath(grid: ReturnType<typeof makeGrid>, from: [number, number], to: [number, number]): [number, number][] {
  const start = nearestFree(grid, ...from);
  const goal = nearestFree(grid, ...to);
  if (!start || !goal) return [];
  const [sc, sr] = grid.cellOf(...start);
  const [gc, gr] = grid.cellOf(...goal);
  const { cols, rows, blocked } = grid;
  const idx = (c: number, r: number) => r * cols + c;
  const g = new Float64Array(cols * rows).fill(Infinity);
  const came = new Int32Array(cols * rows).fill(-1);
  const open = new Set<number>([idx(sc, sr)]);
  const h = (c: number, r: number) => Math.hypot(c - gc, r - gr);
  const f = new Map<number, number>([[idx(sc, sr), h(sc, sr)]]);
  g[idx(sc, sr)] = 0;
  while (open.size) {
    let cur = -1;
    let bestF = Infinity;
    for (const n of open) { const v = f.get(n) ?? Infinity; if (v < bestF) { bestF = v; cur = n; } }
    const cc = cur % cols;
    const cr = Math.floor(cur / cols);
    if (cc === gc && cr === gr) break;
    open.delete(cur);
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nc = cc + dc;
      const nr = cr + dr;
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows || blocked[idx(nc, nr)]) continue;
      if (dc && dr && (blocked[idx(cc + dc, cr)] || blocked[idx(cc, cr + dr)])) continue; // no corner cutting
      const ng = g[cur] + (dc && dr ? Math.SQRT2 : 1);
      const ni = idx(nc, nr);
      if (ng < g[ni]) {
        g[ni] = ng;
        came[ni] = cur;
        f.set(ni, ng + h(nc, nr));
        open.add(ni);
      }
    }
  }
  if (came[idx(gc, gr)] === -1 && idx(gc, gr) !== idx(sc, sr)) return [];
  const cells: number[] = [];
  for (let n = idx(gc, gr); n !== -1; n = came[n]) cells.push(n);
  cells.reverse();
  // Drop points on straight runs so the walk looks natural.
  const pts = cells.map((n) => [grid.toX(n % cols), grid.toZ(Math.floor(n / cols))] as [number, number]);
  return pts.filter((p, i) => {
    if (i === 0 || i === pts.length - 1) return true;
    const a = pts[i - 1];
    const b = pts[i + 1];
    return Math.abs((p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0])) > 1e-9;
  });
}
