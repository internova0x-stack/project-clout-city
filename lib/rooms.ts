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
  | "stairs"
  // #19 bigger homes: bathrooms, kitchen islands, bedside tables
  | "bathtub" | "toilet" | "bathSink" | "kitchenIsland" | "nightstand" | "hotTub"
  // #19 clubs: the restroom floor
  | "stall"
  // v0.14 On Air: Real Clout FM's studio and Clout TV's control room
  | "micDesk" | "onAirSign" | "soundPanel" | "bigScreen" | "tvCamera" | "ringLight"
  // The Hub's game room
  | "arcade" | "poolTable"
  // Clout Couture (migration 0102): the owner in gold on a marble pedestal; the Clout Throne
  | "statue" | "throne"
  // Tower offices (owner, Oct 31): cubicles, display glass, robots, server racks and the elevator bank
  | "cubicle" | "glassWall" | "displayCase" | "robot" | "serverRack" | "elevator"
  // Wall art (migration 0120): a framed painting that hangs on a wall
  | "painting"
  // Campaign HQ (owner, Nov 20: "spacious floors, with great furniture"): the phone bank, the war room, the press room and
  // the rally roof
  | "phoneBank" | "warTable" | "pressBackdrop" | "campaignBanner" | "flagStand" | "pendantLamp" | "waterCooler" | "pollBoard"
  | "rallyStage" | "stringLights" | "patioUmbrella" | "sectional" | "chandelier"
  // The big clubs (owner, Nov 20: "a bar, a stage with go-go dancers, a vip, lighting"): the DJ stage, podiums, video walls
  | "djStage" | "gogoPodium" | "ledWall" | "clubPillar" | "velvetRope"
  // The rooftops (owner, Nov 20): heat lamps, round dining sets and long planters
  | "heatLamp" | "roundDining" | "planter"
  // The subway station (owner, Nov 20): the track and its train, turnstiles, fare machines, the agent's booth, columns, the entrance
  | "subwayTrack" | "turnstile" | "fareMachine" | "ticketBooth" | "stationColumn" | "stationEntrance"
  // Clout TV Tower (owner, Nov 20): a show's set on a riser and the studio's lights on stands
  | "tvSet" | "studioLight";

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
  /** v0.14 On Air: the stations' buttons (Send Radio Shoutout, Get on Billboard, the Big Screen). */
  | { kind: "station"; what: "shoutout" | "billboard" | "watch" }
  /** v0.11 the exclusive venue: stairs to another floor of the building. */
  | { kind: "floor"; to: number }
  /** #19 clubs: Listen in at the restroom mirrors (juicier gossip, migration 0046). */
  | { kind: "listen" }
  /** #19 clubs: "Get seen in VIP", on the VIP floor's bar. */
  | { kind: "vip" }
  /** v0.11 the gigs board (offices): opens today's gigs in the Phone. */
  | { kind: "gigs" }
  /** Campaign HQ's reception desk (owner, Nov 20): opens the Campaign HQ sheet. */
  | { kind: "campaign" }
  /** v0.15 campus areas: open Campus life on a tab (classes at the lecture desks, exams in the library, the dining hall). */
  | { kind: "campus"; tab: "classes" | "exams" | "dining" | "pride" }
  /** Boutique racks open the Shop on a category (shopping places don't sell anything themselves). */
  | { kind: "shop"; category: "fashion" | "home" | "cars" | "houses" | "luxury" | "makeup"; section?: string };

export interface RoomItem {
  id: string;
  kind: FurnitureKind;
  x: number;
  z: number;
  /** Quarter turns (0 to 3): faces +z, +x, -z, -x. */
  rot: number;
  color?: string;
  use?: ItemUse;
  /** A short label for the tap target ("Work a shift"), or just an arrow or emoji. */
  label?: string;
  /** What a screen reader says when the label is only an arrow or an emoji. */
  name?: string;
  /** Wall art: the painting's picture. */
  art?: string;
  /**
   * A modeled piece (owner, Nov 20: real 3D furniture): the id of a file in public/models/ (components/room/models.ts
   * MODELS). The box-built piece shows until the model has loaded, and stays if it can't.
   */
  model?: string;
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
  /** #19 bigger homes: the rooms inside, each with its own floor (plan coordinates, x0 < x1, z0 < z1). */
  rooms?: { name: string; x0: number; z0: number; x1: number; z1: number; floor: string; floorKind: RoomTemplate["floorKind"] }[];
  /** #19: waist-high walls between rooms, as axis-aligned segments [x0, z0, x1, z1]; the gaps are doorways. */
  walls?: [number, number, number, number][];
  /** Big public floors (owner, Nov 20): the walls between rooms stand full height, like a dollhouse cut open from above. */
  tallWalls?: boolean;
  /** Recessed spotlights along the far walls, each washing the wall below with warm light. */
  spotlights?: boolean;
  /** A roof terrace: a waist-high parapet instead of walls, open sky, no sign or window. */
  open?: boolean;
  /** The big clubs: moving light beams from a rig over the floor and colored pools of light sweeping the floor. */
  clubLights?: boolean;
  /** Open to the sky: a real sky behind it (blue by day, navy at night) instead of one from the walls' colors. Nothing else
   *  around it (owner, Nov 20: "Leave out the background buildings. Keep it at just the interior"). */
  skyline?: boolean;
  items: RoomItem[];
  /** Where the avatar enters. */
  spawn: [number, number];
  /** v0.11 party floors: where the 8 to 10 people at a party stand (lib/partyRoom.ts crowdFor). */
  crowdSpots?: { x: number; z: number; facing: number }[];
  /** People hanging out (positions and facing), drawn as random New Yorkers. */
  npcs?: { x: number; z: number; facing: number; seated?: boolean; dance?: boolean; y?: number; costume?: "gogo" }[];
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
  piano: { w: 1.5, d: 1.4, label: "Piano", movable: true },
  statue: { w: 0.8, d: 0.8, label: "Statue", movable: true },
  throne: { w: 1.4, d: 1.3, label: "Throne", movable: true },
  // Hangs above furniture, so it never blocks a piece (walkable); place it with its back to a wall.
  painting: { w: 1.1, d: 0.12, walkable: true, label: "Painting", movable: true },
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
  micDesk: { w: 2.8, d: 0.9, label: "The desk" },
  arcade: { w: 0.9, d: 0.8, label: "Arcade" },
  poolTable: { w: 2.2, d: 1.2, label: "Pool table" },
  onAirSign: { w: 1.4, d: 0.2, label: "On Air" },
  soundPanel: { w: 1.8, d: 0.15, label: "Foam" },
  bigScreen: { w: 3.4, d: 0.2, label: "The Big Screen" },
  tvCamera: { w: 0.7, d: 0.7, label: "Camera" },
  ringLight: { w: 0.7, d: 0.7, label: "Ring light" },
  cardRack: { w: 1.4, d: 0.35, label: "Scratch cards" },
  starSign: { w: 1.6, d: 0.2, label: "Sign" },
  lottoBoard: { w: 1.8, d: 0.2, label: "Odds board" },
  stairs: { w: 1.2, d: 1.8, label: "Stairs" },
  phoneBank: { w: 2.6, d: 0.8, label: "Phone bank" },
  warTable: { w: 3.8, d: 1.9, label: "War room table" },
  pressBackdrop: { w: 3.6, d: 0.2, label: "Press backdrop" },
  campaignBanner: { w: 2.4, d: 0.12, walkable: true, label: "Campaign banner" },
  flagStand: { w: 0.4, d: 0.4, label: "Flag" },
  pendantLamp: { w: 0.5, d: 0.5, walkable: true, label: "Pendant lamp" },
  waterCooler: { w: 0.4, d: 0.4, label: "Water cooler" },
  pollBoard: { w: 3.6, d: 0.2, label: "Poll board" },
  rallyStage: { w: 6.0, d: 2.8, label: "Rally stage" },
  stringLights: { w: 18.0, d: 0.2, walkable: true, label: "String lights" },
  patioUmbrella: { w: 1.6, d: 1.6, label: "Patio table" },
  sectional: { w: 3.0, d: 2.0, label: "Sectional sofa" },
  chandelier: { w: 1.0, d: 1.0, walkable: true, label: "Chandelier" },
  djStage: { w: 10.0, d: 2.6, label: "DJ stage" },
  gogoPodium: { w: 1.2, d: 1.2, label: "Go-go podium" },
  ledWall: { w: 8.0, d: 0.15, walkable: true, label: "Video wall" },
  clubPillar: { w: 0.6, d: 0.6, label: "Pillar" },
  velvetRope: { w: 2.0, d: 0.25, label: "Velvet rope" },
  heatLamp: { w: 0.5, d: 0.5, label: "Heat lamp" },
  roundDining: { w: 2.0, d: 2.0, label: "Table" },
  planter: { w: 1.8, d: 0.5, label: "Planter" },
  subwayTrack: { w: 23.8, d: 3.2, label: "Tracks" },
  turnstile: { w: 0.8, d: 0.6, label: "Turnstile" },
  fareMachine: { w: 0.8, d: 0.5, label: "Fare machine" },
  ticketBooth: { w: 2.2, d: 1.6, label: "Station booth" },
  stationColumn: { w: 0.4, d: 0.4, label: "Column" },
  stationEntrance: { w: 3.0, d: 2.0, label: "Subway entrance" },
  tvSet: { w: 4.4, d: 3.0, label: "The set" },
  studioLight: { w: 0.6, d: 0.6, label: "Studio light" },
  cubicle: { w: 1.6, d: 1.5, label: "Cubicle" },
  glassWall: { w: 3.0, d: 0.12, label: "Glass wall" },
  displayCase: { w: 0.9, d: 0.9, label: "Display case" },
  robot: { w: 0.6, d: 0.6, label: "Robot" },
  serverRack: { w: 0.8, d: 0.7, label: "Server rack" },
  elevator: { w: 1.6, d: 0.6, label: "Elevator" },
  bathtub: { w: 1.6, d: 0.8, label: "Bathtub" },
  toilet: { w: 0.5, d: 0.7, label: "Toilet" },
  bathSink: { w: 0.7, d: 0.5, label: "Sink" },
  kitchenIsland: { w: 1.8, d: 0.9, label: "Kitchen island", movable: true },
  nightstand: { w: 0.5, d: 0.45, label: "Nightstand", movable: true },
  hotTub: { w: 1.8, d: 1.8, label: "Hot tub" },
  stall: { w: 1.0, d: 1.2, label: "Stall" },
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

// #19 bigger homes (owner, Oct 14): rooms with their own floors and waist-high walls between them.
// Item ids carry the home's prefix, so a layout arranged in another home never lands in a wall here.
type Rooms = NonNullable<RoomTemplate["rooms"]>;
const room = (name: string, x0: number, z0: number, x1: number, z1: number, floor: string, floorKind: RoomTemplate["floorKind"] = "wood"): Rooms[number] =>
  ({ name, x0, z0, x1, z1, floor, floorKind });
const piece = (prefix: string) => (id: string, kind: FurnitureKind, x: number, z: number, rot = 0, extra: Partial<RoomItem> = {}): RoomItem =>
  ({ id: `${prefix}-${id}`, kind, x, z, rot, ...extra });

// Jackson Heights 1BR (mid rent): two rooms, a bedroom and a living room with a kitchen nook. Room counts
// follow the price (owner, Oct 14): the cheap studio is one room; dearer homes have more. It comes a little
// bigger and nearly empty (bed, kitchen, wardrobe, one chair) so players furnish it from Fif's Furniture.
const jh = piece("1br");
const jacksonHeights: RoomTemplate = {
  id: "jackson_heights_1br", w: 7.7, d: 6.6, wall: "#D7E4E0", wallAccent: "#A9C2BB", floor: "#8E6242", floorKind: "wood", window: true,
  rooms: [
    room("Living", -3.85, -0.2, 3.85, 3.3, "#8E6242"),
    room("Kitchen", 0.9, -3.3, 3.85, -0.2, "#E6E1D8", "tile"),
    room("Bedroom", -3.85, -3.3, 0.9, -0.2, "#7E5638"),
  ],
  walls: [[-3.85, -0.2, -2.8, -0.2], [-1.8, -0.2, 0.9, -0.2], [0.9, -3.3, 0.9, -0.2]],
  items: [
    jh("bed", "bed", -2.2, -2.15, 0, { color: "#6C8CFF", use: { kind: "sleep" }, label: "Nap" }),
    jh("wardrobe", "wardrobe", 0.5, -1.8, 3, { use: { kind: "look" }, label: "Your look" }),
    jh("kitchen", "kitchen", 2.4, -2.95, 0, { use: { kind: "cook" }, label: "Kitchen" }),
    jh("chair", "chair", 2.4, -1.3, 2, { use: sit, label: "Sit" }),
  ],
  spawn: [0.9, 2.7],
};

// LIC high-rise: open living and kitchen; a bedroom and a bathroom behind.
const hr = piece("hr");
const licHighrise: RoomTemplate = {
  id: "lic_highrise", w: 9.0, d: 7.0, wall: "#ECEAF0", wallAccent: "#C9C6D2", floor: "#C9B79C", floorKind: "wood", window: true,
  rooms: [
    room("Living", -4.5, -0.5, 1.5, 3.5, "#C9B79C"),
    room("Kitchen", 1.5, -0.5, 4.5, 3.5, "#E6E1D8", "tile"),
    room("Bedroom", -4.5, -3.5, 1.0, -0.5, "#B89A78"),
    room("Bathroom", 1.0, -3.5, 4.5, -0.5, "#DDE7EA", "tile"),
  ],
  walls: [[-4.5, -0.5, -2.6, -0.5], [-1.6, -0.5, 1.6, -0.5], [2.6, -0.5, 4.5, -0.5], [1.0, -3.5, 1.0, -0.5]],
  items: [
    hr("bed", "bed", -3.2, -2.3, 0, { color: "#1F1B26", use: { kind: "sleep" }, label: "Nap" }),
    hr("nightstand", "nightstand", -2.0, -3.15),
    hr("desk", "desk", -0.9, -3.15),
    hr("wardrobe", "wardrobe", 0.6, -2.0, 3, { use: { kind: "look" }, label: "Your look" }),
    hr("lamp", "floorLamp", -4.2, -0.95),
    hr("bathtub", "bathtub", 3.6, -3.0),
    hr("toilet", "toilet", 1.5, -3.1),
    hr("sink", "bathSink", 2.4, -3.2),
    hr("tv", "tvStand", -0.4, 0.0),
    hr("rug", "rug", -0.4, 1.5, 0, { color: "#C2AE86" }),
    hr("coffee-table", "coffeeTable", -0.4, 1.5),
    hr("sofa", "sofa", -0.4, 2.8, 2, { color: "#ECE6DC", use: sit, label: "Sit" }),
    hr("armchair", "armchair", -2.4, 1.5, 1, { color: "#3E5C76", use: sit, label: "Sit" }),
    hr("bookshelf", "bookshelf", -4.2, 1.6, 1),
    hr("plant", "plant", -4.1, 0.1),
    hr("lamp-2", "floorLamp", -4.1, 3.1),
    hr("kitchen", "kitchen", 4.1, 1.6, 3, { use: { kind: "cook" }, label: "Kitchen" }),
    hr("fridge", "fridge", 4.1, 0.0, 3),
    hr("dining", "diningTable", 2.5, 2.2),
    hr("chair-1", "chair", 2.5, 1.5, 0, { use: sit, label: "Sit" }),
    hr("chair-2", "chair", 2.5, 2.95, 2, { use: sit, label: "Sit" }),
  ],
  spawn: [0.9, 3.0],
};

// Astoria townhouse (bought): bedroom, home office and bathroom upstairs-style at the back; living and kitchen in front.
const th = piece("th");
const astoriaTownhouse: RoomTemplate = {
  id: "house-astoria-townhouse", w: 11.0, d: 8.0, wall: "#E9D8C4", wallAccent: "#C9B49C", floor: "#A8744A", floorKind: "wood", window: true,
  rooms: [
    room("Living", -5.5, 0.5, 0.5, 4.0, "#A8744A"),
    room("Kitchen", 0.5, 0.5, 5.5, 4.0, "#E8E2D6", "tile"),
    room("Bedroom", -5.5, -4.0, -1.5, 0.5, "#9A6B45"),
    room("Office", -1.5, -4.0, 2.0, 0.5, "#B08260"),
    room("Bathroom", 2.0, -4.0, 5.5, 0.5, "#D9E6E3", "tile"),
  ],
  walls: [[-5.5, 0.5, -4.3, 0.5], [-3.3, 0.5, -0.4, 0.5], [0.6, 0.5, 2.6, 0.5], [3.6, 0.5, 5.5, 0.5], [-1.5, -4.0, -1.5, 0.5], [2.0, -4.0, 2.0, 0.5]],
  items: [
    th("bed", "bed", -4.0, -2.9, 0, { color: "#E0457B", use: { kind: "sleep" }, label: "Nap" }),
    th("nightstand", "nightstand", -5.2, -3.65),
    th("wardrobe", "wardrobe", -5.2, -0.9, 1, { use: { kind: "look" }, label: "Your look" }),
    th("lamp", "floorLamp", -5.1, 0.0),
    th("desk", "desk", 0.25, -3.6),
    th("desk-chair", "chair", 0.25, -2.9, 2, { use: sit, label: "Sit" }),
    th("bookshelf", "bookshelf", -1.15, -1.5, 1),
    th("plant", "plant", 1.6, 0.0),
    th("bathtub", "bathtub", 4.6, -3.5),
    th("toilet", "toilet", 2.5, -3.55),
    th("sink", "bathSink", 3.3, -3.7),
    th("tv", "tvStand", -2.0, 1.0),
    th("rug", "rug", -2.0, 2.1, 0, { color: "#C2AE86" }),
    th("coffee-table", "coffeeTable", -2.0, 2.1),
    th("sofa", "sofa", -2.0, 3.3, 2, { color: "#3E5C76", use: sit, label: "Sit" }),
    th("armchair", "armchair", -4.4, 2.1, 1, { color: "#D9A43A", use: sit, label: "Sit" }),
    th("plant-2", "plant", 0.0, 3.6),
    th("kitchen", "kitchen", 5.1, 2.6, 3, { use: { kind: "cook" }, label: "Kitchen" }),
    th("fridge", "fridge", 5.1, 0.95, 3),
    th("island", "kitchenIsland", 3.0, 2.0),
    th("dining", "diningTable", 1.6, 3.3),
    th("chair-1", "chair", 0.75, 3.3, 1, { use: sit, label: "Sit" }),
    th("chair-2", "chair", 2.45, 3.3, 3, { use: sit, label: "Sit" }),
  ],
  spawn: [-0.4, 2.4],
};

// LIC penthouse (bought): a loft with a piano, a master bedroom, a bathroom and a dressing room.
const ph = piece("ph");
const licPenthouse: RoomTemplate = {
  id: "house-lic-penthouse", w: 12.0, d: 8.5, wall: "#E8E6EE", wallAccent: "#B8B4C4", floor: "#D9CBB4", floorKind: "wood", window: true,
  rooms: [
    room("Living", -6.0, 0.0, 1.5, 4.25, "#D9CBB4"),
    room("Kitchen", 1.5, 0.0, 6.0, 4.25, "#ECE8E0", "tile"),
    room("Bedroom", -6.0, -4.25, -1.0, 0.0, "#C2AA88"),
    room("Bathroom", -1.0, -4.25, 2.0, 0.0, "#E3ECEF", "tile"),
    room("Dressing room", 2.0, -4.25, 6.0, 0.0, "#CDB79A"),
  ],
  walls: [[-6.0, 0, -4.6, 0], [-3.6, 0, -0.2, 0], [0.8, 0, 2.6, 0], [3.6, 0, 6.0, 0], [-1.0, -4.25, -1.0, 0], [2.0, -4.25, 2.0, 0]],
  items: [
    ph("bed", "bed", -4.0, -3.0, 0, { color: "#2A2530", use: { kind: "sleep" }, label: "Nap" }),
    ph("nightstand-1", "nightstand", -5.2, -3.75),
    ph("nightstand-2", "nightstand", -2.8, -3.75),
    ph("lamp", "floorLamp", -1.5, -0.5),
    ph("plant", "plant", -5.6, -0.4),
    ph("bathtub", "bathtub", 0.5, -3.65),
    ph("toilet", "toilet", 1.6, -2.2, 3),
    ph("sink", "bathSink", -0.55, -2.0, 1),
    ph("wardrobe", "wardrobe", 4.0, -3.9, 0, { use: { kind: "look" }, label: "Your look" }),
    ph("plant-2", "plant", 5.6, -3.8),
    ph("armchair", "armchair", 5.3, -1.0, 3, { color: "#B0135A", use: sit, label: "Sit" }),
    ph("piano", "piano", -4.5, 2.6, 1),
    ph("tv", "tvStand", -1.6, 0.45),
    ph("rug", "rug", -1.6, 2.1, 0, { color: "#6B4FD8" }),
    ph("coffee-table", "coffeeTable", -1.6, 2.1),
    ph("sofa", "sofa", -1.6, 3.5, 2, { color: "#F4F1EA", use: sit, label: "Sit" }),
    ph("armchair-2", "armchair", -3.2, 2.1, 1, { color: "#C9A227", use: sit, label: "Sit" }),
    ph("lamp-2", "floorLamp", -5.6, 0.5),
    ph("kitchen", "kitchen", 5.6, 2.4, 3, { use: { kind: "cook" }, label: "Kitchen" }),
    ph("fridge", "fridge", 5.6, 0.6, 3),
    ph("island", "kitchenIsland", 3.0, 2.0),
    ph("dining", "diningTable", 2.6, 3.6),
    ph("chair-1", "chair", 1.75, 3.6, 1, { use: sit, label: "Sit" }),
    ph("chair-2", "chair", 3.45, 3.6, 3, { use: sit, label: "Sit" }),
    ph("plant-3", "plant", 1.2, 3.9),
  ],
  spawn: [0.6, 2.4],
};

// Sunnyside Gardens (#19 moving up, owner Oct 14): the first home to work towards. Three rooms,
// nearly empty (bed, wardrobe, kitchen, bathroom, one chair) to furnish from Fif's.
const sg = piece("sg");
const sunnysideGardens: RoomTemplate = {
  id: "sunnyside_gardens", w: 8.4, d: 7.0, wall: "#EDE3D2", wallAccent: "#B7A27F", floor: "#B88A5E", floorKind: "wood", window: true,
  rooms: [
    room("Living", -4.2, -0.3, 4.2, 3.5, "#B88A5E"),
    room("Bedroom", -4.2, -3.5, 1.2, -0.3, "#A07650"),
    room("Bathroom", 1.2, -3.5, 4.2, -0.3, "#DDE7EA", "tile"),
  ],
  walls: [[-4.2, -0.3, -2.9, -0.3], [-1.9, -0.3, 1.9, -0.3], [2.9, -0.3, 4.2, -0.3], [1.2, -3.5, 1.2, -0.3]],
  items: [
    sg("bed", "bed", -2.6, -2.4, 0, { color: "#40B589", use: { kind: "sleep" }, label: "Nap" }),
    sg("wardrobe", "wardrobe", 0.8, -1.8, 3, { use: { kind: "look" }, label: "Your look" }),
    sg("bathtub", "bathtub", 3.3, -3.0),
    sg("toilet", "toilet", 1.65, -3.05),
    sg("sink", "bathSink", 3.75, -1.2, 3),
    sg("kitchen", "kitchen", 3.75, 1.8, 3, { use: { kind: "cook" }, label: "Kitchen" }),
    sg("chair", "chair", 2.6, 1.8, 1, { use: sit, label: "Sit" }),
  ],
  spawn: [0.0, 3.0],
};

// Hunters Point duplex penthouse (#19, bought): two floors joined by stairs. Downstairs: a big living
// room with a piano, dining and a kitchen with an island. Upstairs: bedroom, bathroom, dressing room
// and a terrace with a hot tub.
const dx = piece("dx");
const duplexDown: RoomTemplate = {
  id: "house-hunters-point-duplex", w: 12.0, d: 8.5, wall: "#E8E6EE", wallAccent: "#B8B4C4", floor: "#D9CBB4", floorKind: "wood", window: true,
  rooms: [
    room("Living", -6.0, -4.25, 1.5, 4.25, "#D9CBB4"),
    room("Kitchen", 1.5, 0.0, 6.0, 4.25, "#ECE8E0", "tile"),
    room("Dining", 1.5, -4.25, 6.0, 0.0, "#CDB79A"),
  ],
  walls: [[1.5, -4.25, 1.5, -2.6], [1.5, -1.4, 1.5, 1.2], [1.5, 2.4, 1.5, 4.25]],
  items: [
    dx("piano", "piano", -4.6, -3.0),
    dx("tv", "tvStand", -2.0, -0.3),
    dx("rug", "rug", -2.0, 1.2, 0, { color: "#6B4FD8" }),
    dx("coffee-table", "coffeeTable", -2.0, 1.2),
    dx("sofa", "sofa", -2.0, 2.4, 2, { color: "#F4F1EA", use: sit, label: "Sit" }),
    dx("armchair-1", "armchair", -4.2, 1.2, 1, { color: "#C9A227", use: sit, label: "Sit" }),
    dx("armchair-2", "armchair", 0.2, 1.2, 3, { color: "#C9A227", use: sit, label: "Sit" }),
    dx("stairs", "stairs", -5.2, 3.2, 2, { use: { kind: "floor", to: 2 }, label: "↑", name: "Upstairs" }),
    dx("bookshelf", "bookshelf", -2.6, -4.0),
    dx("plant", "plant", 1.0, -3.8),
    dx("kitchen", "kitchen", 5.6, 2.2, 3, { use: { kind: "cook" }, label: "Kitchen" }),
    dx("fridge", "fridge", 5.6, 0.5, 3),
    dx("island", "kitchenIsland", 3.4, 2.4),
    dx("dining", "diningTable", 3.8, -2.0),
    dx("chair-1", "chair", 3.8, -2.75, 0, { use: sit, label: "Sit" }),
    dx("chair-2", "chair", 3.8, -1.25, 2, { use: sit, label: "Sit" }),
  ],
  spawn: [-1.0, 3.6],
};
const duplexUp: RoomTemplate = {
  id: "house-hunters-point-duplex:2", w: 12.0, d: 8.5, wall: "#E8E6EE", wallAccent: "#B8B4C4", floor: "#B9B2A6", floorKind: "tile", window: true,
  rooms: [
    room("Bedroom", -6.0, -4.25, 0.0, 0.5, "#C2AA88"),
    room("Bathroom", 0.0, -4.25, 3.0, 0.5, "#E3ECEF", "tile"),
    room("Dressing room", 3.0, -4.25, 6.0, 0.5, "#CDB79A"),
    room("Terrace", -6.0, 0.5, 6.0, 4.25, "#B9B2A6", "tile"),
  ],
  walls: [[-6.0, 0.5, -4.4, 0.5], [-3.4, 0.5, 0.9, 0.5], [1.9, 0.5, 3.9, 0.5], [4.9, 0.5, 6.0, 0.5], [0.0, -4.25, 0.0, 0.5], [3.0, -4.25, 3.0, 0.5]],
  items: [
    dx("bed", "bed", -3.5, -2.8, 0, { color: "#2A2530", use: { kind: "sleep" }, label: "Nap" }),
    dx("nightstand", "nightstand", -5.0, -3.7),
    dx("lamp", "floorLamp", -5.6, -3.8),
    dx("armchair-3", "armchair", -1.0, -0.6, 2, { color: "#B0135A", use: sit, label: "Sit" }),
    dx("bathtub", "bathtub", 1.9, -3.7),
    dx("toilet", "toilet", 0.5, -3.8),
    dx("sink", "bathSink", 2.5, -1.2, 3),
    dx("wardrobe", "wardrobe", 4.5, -3.9, 0, { use: { kind: "look" }, label: "Your look" }),
    dx("plant-2", "plant", 5.5, -3.8),
    dx("stairs-down", "stairs", -5.2, 3.2, 2, { use: { kind: "floor", to: 1 }, label: "↓", name: "Downstairs" }),
    dx("hot-tub", "hotTub", 4.0, 2.6),
    dx("table", "cafeTable", 1.6, 2.6),
    dx("lounger", "sofa", -0.6, 3.6, 2, { color: "#F4F1EA", use: sit, label: "Sit" }),
    dx("plant-3", "plant", -2.6, 3.8),
  ],
  spawn: [-4.0, 3.0],
};

export const HOME_TEMPLATES: Record<string, RoomTemplate> = {
  astoria_studio: {
    id: "astoria_studio", w: 5.4, d: 5.2, wall: "#E9D8C4", wallAccent: "#C9B49C", floor: "#A8744A", floorKind: "wood", window: true,
    items: studioItems(1), spawn: [0.6, 2.3],
  },
  // Culture pack C3 (owner, Oct 20: "two beds or a bunk"): the shared apartment, two single beds side by side. Yours is
  // the one you nap in; Priya's is made with hospital corners.
  astoria_share: {
    id: "astoria_share", w: 6.0, d: 5.2, wall: "#E4DCCB", wallAccent: "#B9A88E", floor: "#9C6C46", floorKind: "wood", window: true,
    items: [
      { id: "share-bed", kind: "bed", x: -2.1, z: -1.5, rot: 0, color: "#6C8CFF", use: { kind: "sleep" }, label: "Nap" },
      { id: "share-bed-priya", kind: "bed", x: 0.1, z: -1.5, rot: 0, color: "#E0457B", name: "Priya's bed" },
      { id: "share-plant", kind: "plant", x: 1.6, z: -2.3, rot: 0 },
      { id: "share-kitchen", kind: "kitchen", x: 2.65, z: -0.4, rot: 3, use: { kind: "cook" }, label: "Kitchen" },
      { id: "share-rug", kind: "rug", x: 0.2, z: 1.0, rot: 0, color: "#40B589" },
      { id: "share-sofa", kind: "sofa", x: 0.2, z: 1.9, rot: 2, color: "#FF8A3D", use: sit, label: "Sit" },
      { id: "share-wardrobe", kind: "wardrobe", x: -2.65, z: 1.0, rot: 1, use: { kind: "look" }, label: "Your look" },
    ],
    spawn: [0.9, 0.6],
  },
  jackson_heights_1br: jacksonHeights,
  lic_highrise: licHighrise,
  // v0.15 Campus: the dorm rooms, in each school's colors (the roommate's side arrives with the campus screens).
  sj_dorm: { id: "sj_dorm", w: 5.4, d: 5.2, wall: "#F2E6D8", wallAccent: "#C8102E", floor: "#B08A5E", floorKind: "wood", window: true, items: studioItems(1), spawn: [0.6, 2.3] },
  qu_dorm: { id: "qu_dorm", w: 5.4, d: 5.2, wall: "#E8E2D0", wallAccent: "#3B6FB6", floor: "#B08A5E", floorKind: "wood", window: true, items: studioItems(1), spawn: [0.6, 2.3] },
  "house-astoria-townhouse": astoriaTownhouse,
  "house-lic-penthouse": licPenthouse,
  sunnyside_gardens: sunnysideGardens,
  "house-hunters-point-duplex": duplexDown,
};

/** #19: a home's upper floors (the duplex), by floor number. */
export const HOME_FLOORS: Record<string, Record<number, RoomTemplate>> = {
  "house-hunters-point-duplex": { 2: duplexUp },
};

/** The player's home: a bought house, else the rented home (the studio if unknown). */
export function homeTemplate(homeId: string | null | undefined, houseSku?: string | null): RoomTemplate {
  return (houseSku && HOME_TEMPLATES[houseSku]) || HOME_TEMPLATES[homeId ?? ""] || HOME_TEMPLATES.astoria_studio;
}

export type PlaceTemplateId = "campaignGround" | "campaignWar" | "campaignRoof" | "clubBig" | "vipBig" | "rooftop" | "station" | "tvStudio" | "tvNewsroom" | "restroom" | "vip" | "club" | "cafe" | "counter" | "lounge" | "store" | "showroom" | "campus" | "unisphere" | "gantries" | "lotto" | "office" | "officeSmall" | "officeBig" | "towerLobby" | "techFloor" | "execFloor" | "newsroom" | "streamHouse" | "streamFloor" | "atelier" | "tradingFloor" | "lawOffice" | "backRoom" | "civic" | "gym" | "plaza" | "penthouse" | "radio" | "broadcast" | "hub" | "hubGames" | "hubLounge" | "campusQuad" | "campusLibrary" | "campusDining" | "campusGreek";

// v0.11 (spec section 11): every place can be entered. The shared templates take a place's own
// actions: "*0" and "*1" are its first and second action (see placeRoom), so one office serves the
// gigs board and the delivery hub alike.
const MAIN = (n: number): ItemUse => ({ kind: "action", actionId: `*${n}` });

export const PLACE_TEMPLATES: Record<PlaceTemplateId, RoomTemplate> = {
  // ---- #19 clubs (owner, Oct 14): a restroom floor downstairs and a VIP floor upstairs ----
  // The restroom: sinks and mirrors, stalls and a bench. Listen in at the mirrors, where the gossip is juicier.
  restroom: {
    id: "restroom", w: 7.0, d: 5.6, wall: "#2B2440", wallAccent: "#3DDC97", floor: "#D8D4E4", floorKind: "tile", dark: true,
    items: [
      { id: "stairs-up", kind: "stairs", x: -2.8, z: 1.8, rot: 2, use: { kind: "floor", to: 1 }, label: "↑", name: "Back up to the club" },
      { id: "sink-1", kind: "bathSink", x: -1.4, z: -2.5, rot: 0 },
      { id: "sink-2", kind: "bathSink", x: -0.3, z: -2.5, rot: 0, use: { kind: "listen" }, label: "👂", name: "Listen in at the mirrors" },
      { id: "sink-3", kind: "bathSink", x: 0.8, z: -2.5, rot: 0 },
      { id: "stall-1", kind: "stall", x: 2.9, z: -1.0, rot: 3 },
      { id: "stall-2", kind: "stall", x: 2.9, z: 0.05, rot: 3 },
      { id: "stall-3", kind: "stall", x: 2.9, z: 1.1, rot: 3 },
      { id: "bench", kind: "bench", x: -0.2, z: 2.3, rot: 2, use: sit, label: "Sit" },
      { id: "plant", kind: "plant", x: -3.1, z: -2.4, rot: 0 },
    ],
    spawn: [-1.6, 1.0],
    npcs: [
      { x: -1.4, z: -1.75, facing: 3.14 }, { x: 0.8, z: -1.75, facing: 3.14 }, { x: 0.3, z: -1.0, facing: -2.2 },
      { x: -0.6, z: 2.3, facing: 3.14, seated: true },
    ],
  },
  // ---- Clout TV Tower (owner, Nov 20: "next") ----
  // The Studio floor, 20 × 14 m: the lobby (reception, the Big Screen on the wall and the sofa to watch it with the crew), the
  // control room (the mixing desk and monitors), the main studio (the talk-show set under a video wall, three cameras, lights on
  // stands, audience seats), the green room and the "Get on Billboard" photo set.
  tvStudio: {
    id: "tvStudio", w: 20, d: 14, wall: "#F4F1F6", wallAccent: "#FF2E88", floor: "#E8E4EC", floorKind: "tile", alwaysLit: true,
    spotlights: true,
    rooms: [
      { name: "Control room", x0: -10, z0: -7, x1: -3, z1: -1, floor: "#DCD8E2", floorKind: "concrete" },
      { name: "Studio", x0: -3, z0: -7, x1: 10, z1: 2, floor: "#D6D2DC", floorKind: "concrete" },
      { name: "Lobby", x0: -10, z0: -1, x1: -3, z1: 7, floor: "#F7F4F8", floorKind: "tile" },
      { name: "Green room", x0: -3, z0: 2, x1: 4, z1: 7, floor: "#9CC488", floorKind: "wood" },
      { name: "Billboard set", x0: 4, z0: 2, x1: 10, z1: 7, floor: "#FFE3EE", floorKind: "tile" },
    ],
    walls: [
      [-3, -7, -3, -5.2], [-3, -3.4, -3, -1], [-10, -1, -7.8, -1], [-5.8, -1, -3, -1],
      [-3, 2, -3, 3.2], [-3, 5.0, -3, 7], [-3, 2, -1.6, 2], [0.4, 2, 4, 2], [4, 2, 5.6, 2], [7.6, 2, 10, 2], [4, 2, 4, 3.4], [4, 5.2, 4, 7],
    ],
    items: [
      // The lobby.
      { id: "reception", kind: "storeCounter", x: -6.5, z: 0.0, rot: 0, color: "#FF2E88", model: "receptionDesk" },
      { id: "screen", kind: "bigScreen", x: -9.85, z: 3.4, rot: 1, use: { kind: "station", what: "watch" }, label: "On the Big Screen" },
      { id: "couch", kind: "sofa", x: -7.0, z: 3.4, rot: 3, color: "#FF6A3D", use: { kind: "action", actionId: "*0" }, label: "Watch with the crew", model: "sofa" },
      { id: "lobby-table", kind: "coffeeTable", x: -8.2, z: 3.4, rot: 1, model: "marbleTable" },
      { id: "awards", kind: "displayCase", x: -3.6, z: 0.0, rot: 3 },
      { id: "lobby-plant-1", kind: "plant", x: -4.6, z: 6.5, rot: 0, model: "figTree" },
      { id: "lobby-plant-2", kind: "plant", x: -3.5, z: 6.5, rot: 0, model: "monstera" },
      // The control room.
      { id: "mixing-desk", kind: "micDesk", x: -6.5, z: -3.8, rot: 0, color: "#C9C4D2" },
      ...[-7.6, -6.5, -5.4].map((x, i) => ({ id: `control-chair-${i}`, kind: "chair" as const, x, z: -2.9, rot: 2, model: "k:chairDesk" })),
      { id: "monitors", kind: "bigScreen", x: -6.5, z: -6.85, rot: 0 },
      { id: "on-air", kind: "onAirSign", x: -4.0, z: -6.85, rot: 0 },
      { id: "foam", kind: "soundPanel", x: -9.9, z: -4.0, rot: 1 },
      // The studio: the set under the video wall, cameras, lights, the audience.
      { id: "screen-wall", kind: "ledWall", x: 3.5, z: -6.9, rot: 0 },
      { id: "camera-1", kind: "tvCamera", x: 0.8, z: -1.6, rot: 2, model: "tvCamera" },
      { id: "camera-2", kind: "tvCamera", x: 3.5, z: -1.2, rot: 2, model: "tvCamera" },
      { id: "camera-3", kind: "tvCamera", x: 6.2, z: -1.6, rot: 2, model: "tvCamera" },
      { id: "light-1", kind: "studioLight", x: -1.6, z: -3.8, rot: 1 },
      { id: "light-2", kind: "studioLight", x: 8.6, z: -3.8, rot: 3 },
      { id: "light-3", kind: "studioLight", x: 0.2, z: -6.4, rot: 0 },
      { id: "light-4", kind: "studioLight", x: 6.8, z: -6.4, rot: 0 },
      ...[-1.4, -0.4, 0.6, 6.4, 7.4, 8.4].flatMap((x, i) => [0.5, 1.4].map((z, r) => ({ id: `seat-${i}-${r}`, kind: "chair" as const, x, z, rot: 2, model: "k:chairRounded" }))),
      // The green room.
      { id: "green-sofa", kind: "sofa", x: 0.5, z: 6.3, rot: 2, color: "#EDE6D6", model: "sofa", use: sit, label: "Sit" },
      { id: "green-table", kind: "coffeeTable", x: 0.5, z: 5.1, rot: 0, model: "marbleTable" },
      { id: "green-chair", kind: "armchair", x: -1.6, z: 4.6, rot: 1, color: "#FF2E88", model: "velvetChair" },
      { id: "vanity", kind: "mirror", x: 2.6, z: 2.3, rot: 0 },
      { id: "green-fridge", kind: "drinksFridge", x: 3.2, z: 6.5, rot: 2 },
      // The billboard photo set.
      { id: "ring", kind: "ringLight", x: 8.6, z: 4.6, rot: 3, use: { kind: "station", what: "billboard" }, label: "Get on Billboard" },
      { id: "backdrop", kind: "rug", x: 6.8, z: 4.6, rot: 1, color: "#FF2E88" },
      { id: "billboard-camera", kind: "tvCamera", x: 5.0, z: 4.6, rot: 1 },
    ],
    spawn: [-6.5, 5.8],
    npcs: [
      { x: -6.5, z: -0.6, facing: 0 }, { x: -7.6, z: -2.9, facing: 3.14, seated: true }, { x: -5.4, z: -2.9, facing: 3.14, seated: true },
      { x: 2.6, z: -4.4, facing: 0.4 }, { x: 4.4, z: -4.4, facing: -0.4 }, { x: 0.8, z: -0.8, facing: 3.14 }, { x: 6.2, z: -0.8, facing: 3.14 },
      { x: -0.4, z: 0.5, facing: 3.14, seated: true }, { x: 7.4, z: 1.4, facing: 3.14, seated: true }, { x: 6.4, z: 0.5, facing: 3.14, seated: true },
      { x: 0.5, z: 6.2, facing: 3.14, seated: true }, { x: 7.6, z: 4.0, facing: -1.2 }, { x: -7.0, z: 4.6, facing: -1.57 },
    ],
  },
  // The Newsroom floor, 20 × 14 m: the news desk set under a video wall with its cameras and lights, the writers' desks, three
  // glass edit bays and a break corner.
  tvNewsroom: {
    id: "tvNewsroom", w: 20, d: 14, wall: "#F4F1F6", wallAccent: "#FF6A3D", floor: "#ECE8EE", floorKind: "tile", window: true, alwaysLit: true,
    tallWalls: true, spotlights: true,
    rooms: [
      { name: "News set", x0: -2, z0: -7, x1: 10, z1: 0, floor: "#D6D2DC", floorKind: "concrete" },
      { name: "Writers", x0: -10, z0: -7, x1: -2, z1: 3, floor: "#F2EFF4", floorKind: "tile" },
      { name: "Edit bays", x0: -10, z0: 3, x1: -2, z1: 7, floor: "#E2DEE8", floorKind: "concrete" },
      { name: "Break corner", x0: 4, z0: 0, x1: 10, z1: 7, floor: "#C9B79C", floorKind: "wood" },
    ],
    walls: [[-10, 3, -7.6, 3], [-6.0, 3, -2, 3], [-6.4, 3, -6.4, 7], [-4.2, 3, -4.2, 7], [-2, 3, -2, 4.4]],
    items: [
      // The news set.
      { id: "news-desk", kind: "tvSet", x: 4.0, z: -4.6, rot: 0, model: "newsDesk", name: "The news desk" },
      { id: "news-wall", kind: "ledWall", x: 4.0, z: -6.9, rot: 0 },
      { id: "on-air", kind: "onAirSign", x: -0.4, z: -6.85, rot: 0 },
      { id: "news-camera-1", kind: "tvCamera", x: 2.2, z: -1.2, rot: 2, model: "tvCamera" },
      { id: "news-camera-2", kind: "tvCamera", x: 5.8, z: -1.2, rot: 2, model: "tvCamera" },
      { id: "news-light-1", kind: "studioLight", x: 0.2, z: -3.4, rot: 1 },
      { id: "news-light-2", kind: "studioLight", x: 8.4, z: -3.4, rot: 3 },
      // The writers' desks: three rows of three, a screen on every desk.
      ...[-8.4, -6.2, -4.0].flatMap((x, c) => [-5.4, -2.8, -0.2].flatMap((z, r) => [
        { id: `writer-desk-${c}-${r}`, kind: "desk" as const, x, z, rot: 0, model: "k:desk" },
        { id: `writer-chair-${c}-${r}`, kind: "chair" as const, x, z: z + 0.75, rot: 2, model: "k:chairDesk" },
      ])),
      { id: "board", kind: "chalkboard", x: -9.75, z: -2.8, rot: 1 },
      // The edit bays: a desk and a chair each, glass along the front.
      ...[-8.4, -5.3, -3.1].map((x, i) => ({ id: `edit-desk-${i}`, kind: "desk" as const, x, z: 6.3, rot: 2, model: "k:desk" })),
      ...[-8.4, -5.3, -3.1].map((x, i) => ({ id: `edit-chair-${i}`, kind: "chair" as const, x, z: 5.5, rot: 0, model: "k:chairDesk" })),
      // The break corner.
      { id: "break-sofa", kind: "sofa", x: 7.0, z: 6.3, rot: 2, color: "#FF6A3D", model: "sofa", use: sit, label: "Sit" },
      { id: "break-table", kind: "coffeeTable", x: 7.0, z: 5.1, rot: 0, model: "marbleTable" },
      { id: "break-chair", kind: "armchair", x: 9.0, z: 4.6, rot: 3, color: "#FF2E88", model: "velvetChair" },
      { id: "break-fridge", kind: "drinksFridge", x: 9.2, z: 1.4, rot: 3 },
      { id: "break-bot", kind: "robot", x: 5.2, z: 2.0, rot: 2, color: "#FF2E88" },
      { id: "break-plant", kind: "plant", x: 9.5, z: 6.5, rot: 0, model: "monstera" },
    ],
    spawn: [1.0, 4.6],
    npcs: [
      { x: 3.4, z: -4.0, facing: 0, seated: true }, { x: 4.6, z: -4.0, facing: 0, seated: true }, { x: 2.2, z: -0.5, facing: 3.14 },
      { x: -8.4, z: -4.65, facing: 3.14, seated: true }, { x: -6.2, z: -2.05, facing: 3.14, seated: true }, { x: -4.0, z: 0.55, facing: 3.14, seated: true },
      { x: -8.4, z: -0.25, facing: 3.14, seated: true }, { x: -4.0, z: -4.65, facing: 3.14, seated: true },
      { x: -5.3, z: 5.5, facing: 0, seated: true }, { x: 7.0, z: 6.2, facing: 3.14, seated: true }, { x: 6.4, z: 3.0, facing: 2.2 },
    ],
  },
  // ---- The subway station (owner, Nov 20: "next the station") ----
  // Astoria Blvd, an elevated station open to the sky: the platform at the back along the tracks, where a
  // train pulls in, opens its doors and leaves (subwayTrack); benches facing the tracks (people-watching, the station's action),
  // green columns with lamps and a coffee cart; the fare line of turnstiles and railings with the gate open in the middle; the
  // fare machines and the agent's booth; the street entrance (the signature piece) where you come up.
  station: {
    id: "station", w: 24, d: 14, wall: "#3F6B4A", wallAccent: "#FFC21A", floor: "#B8B4AC", floorKind: "concrete", open: true, skyline: true,
    rooms: [
      { name: "Platform", x0: -12, z0: -3.8, x1: 12, z1: 1.6, floor: "#C9C5BC", floorKind: "concrete" },
      { name: "Mezzanine", x0: -12, z0: 1.6, x1: 12, z1: 7, floor: "#D9D2C5", floorKind: "tile" },
    ],
    items: [
      { id: "track", kind: "subwayTrack", x: 0, z: -5.4, rot: 0 },
      ...[-9.5, -4.75, 0, 4.75, 9.5].map((x, i) => ({ id: `column-${i}`, kind: "stationColumn" as const, x, z: -0.6, rot: 0 })),
      { id: "bench-1", kind: "bench", x: -7.1, z: -2.4, rot: 2, model: "stationBench" },
      { id: "bench-2", kind: "bench", x: -2.4, z: -2.4, rot: 2, model: "stationBench", use: MAIN(0), label: "*" },
      { id: "bench-3", kind: "bench", x: 2.4, z: -2.4, rot: 2, model: "stationBench" },
      { id: "bench-4", kind: "bench", x: 7.1, z: -2.4, rot: 2, model: "stationBench" },
      { id: "coffee", kind: "foodCart", x: 10.4, z: 0.6, rot: 3, color: "#3F6B4A" },
      // The fare line: railings either side, three turnstiles each side of the open gate.
      { id: "rail-left", kind: "railing", x: -7.9, z: 1.6, rot: 0 },
      { id: "rail-right", kind: "railing", x: 7.9, z: 1.6, rot: 0 },
      ...[-3.4, -2.5, -1.6, 1.6, 2.5, 3.4].map((x, i) => ({ id: `turnstile-${i}`, kind: "turnstile" as const, x, z: 1.6, rot: 0 })),
      // The mezzanine: fare machines, the booth, the entrance.
      { id: "fare-1", kind: "fareMachine", x: -11.5, z: 3.2, rot: 1 },
      { id: "fare-2", kind: "fareMachine", x: -11.5, z: 4.2, rot: 1 },
      { id: "booth", kind: "ticketBooth", x: 9.6, z: 4.6, rot: 3 },
      { id: "mezz-bench", kind: "bench", x: 3.4, z: 6.6, rot: 2, model: "stationBench" },
      { id: "lamp-1", kind: "lamppost", x: -2.4, z: 4.8, rot: 0 },
      { id: "lamp-2", kind: "lamppost", x: 6.4, z: 3.0, rot: 0 },
    ],
    spawn: [-4.4, 5.8],
    npcs: [
      { x: -7.1, z: -2.4, facing: 3.14, seated: true }, { x: 2.4, z: -2.4, facing: 3.14, seated: true }, { x: 7.4, z: -2.4, facing: 3.14, seated: true },
      { x: -10.6, z: -1.8, facing: 3.4 }, { x: -5.6, z: -0.8, facing: 2.6 }, { x: 0.8, z: -1.2, facing: 3.0 }, { x: 4.6, z: -2.0, facing: 2.8 },
      { x: 9.4, z: -1.4, facing: 2.2 }, { x: 9.4, z: 0.6, facing: 1.57 },
      { x: 0.0, z: 0.6, facing: 0.4, dance: true },
      { x: 10.1, z: 4.6, facing: -1.57 }, { x: -10.6, z: 3.7, facing: -1.57 }, { x: 1.2, z: 4.4, facing: 2.0 },
    ],
  },
  // ---- The rooftops (owner, Nov 20: "next the rooftops") ----
  // Altitude 718, Ditmars Heights and Up on Wythe: a 24 × 16 m roof terrace behind a parapet, open to the sky. The
  // bar along the back, round marble tables under string lights and heat lamps (dining is the place's action), a lounge in the
  // front corner, planters along the edges; each roof's signature piece (PLACE_SIGNATURE) stands in the middle of the deck.
  rooftop: {
    id: "rooftop", w: 24, d: 16, wall: "#CFC6B8", wallAccent: "#B8743A", floor: "#8A6A4E", floorKind: "wood", open: true, skyline: true,
    rooms: [
      { name: "Bar", x0: -12, z0: -8, x1: -1, z1: -3, floor: "#4A4038", floorKind: "tile" },
      { name: "Dining", x0: -1, z0: -8, x1: 12, z1: 1.5, floor: "#D9D2C5", floorKind: "tile" },
    ],
    items: [
      // The bar along the back parapet.
      { id: "bar", kind: "bar", x: -8.2, z: -7.4, rot: 0, color: "#6B4A2B" },
      { id: "bar-2", kind: "bar", x: -4.9, z: -7.4, rot: 0, color: "#6B4A2B" },
      ...[-9.4, -8.3, -7.2, -6.1, -5.0, -3.9].map((x, i) => ({ id: `stool-${i + 1}`, kind: "barStool" as const, x, z: -6.5, rot: 0, model: "barStool" })),
      { id: "bar-plant", kind: "plant", x: -11.5, z: -7.5, rot: 0, model: "figTree" },
      // Dining: six round marble tables under string lights, heat lamps between them.
      { id: "table-1", kind: "roundDining", x: 2.5, z: -1.6, rot: 0, use: MAIN(0), label: "*", model: "diningSet" },
      ...[[6.0, -1.6], [9.5, -1.6], [2.5, -5.2], [6.0, -5.2], [9.5, -5.2]].map(([x, z], i) => ({ id: `table-${i + 2}`, kind: "roundDining" as const, x, z, rot: 0, model: "diningSet" })),
      { id: "lights-1", kind: "stringLights", x: 1.5, z: -3.4, rot: 0 },
      { id: "lights-2", kind: "stringLights", x: 1.5, z: 2.6, rot: 0 },
      { id: "heat-1", kind: "heatLamp", x: 4.25, z: -3.4, rot: 0 },
      { id: "heat-2", kind: "heatLamp", x: 7.75, z: -3.4, rot: 0 },
      { id: "heat-3", kind: "heatLamp", x: -1.5, z: 4.6, rot: 0 },
      { id: "heat-4", kind: "heatLamp", x: 6.8, z: 4.4, rot: 0 },
      ...[2.5, 6.0, 9.5].map((x, i) => ({ id: `planter-back-${i}`, kind: "planter" as const, x, z: -7.6, rot: 0 })),
      { id: "planter-left-1", kind: "planter", x: -11.6, z: -0.6, rot: 1 },
      { id: "planter-left-2", kind: "planter", x: -11.6, z: 2.6, rot: 1 },
      { id: "dining-plant", kind: "plant", x: 11.5, z: -7.5, rot: 0, model: "figTree" },
      // The lounge in the front corner.
      { id: "lounge-sofa-1", kind: "sofa", x: -8.6, z: 7.3, rot: 2, color: "#EDE6D6", model: "sofa" },
      { id: "lounge-table-1", kind: "coffeeTable", x: -8.6, z: 6.1, rot: 0, model: "marbleTable" },
      { id: "lounge-sofa-2", kind: "sofa", x: -4.4, z: 7.3, rot: 2, color: "#EDE6D6", model: "sofa", use: sit, label: "Sit" },
      { id: "lounge-table-2", kind: "coffeeTable", x: -4.4, z: 6.1, rot: 0, model: "marbleTable" },
      { id: "lounge-chair-1", kind: "armchair", x: -10.5, z: 5.7, rot: 1, model: "k:loungeDesignChair" },
      { id: "lounge-chair-2", kind: "armchair", x: -2.5, z: 5.7, rot: 3, model: "k:loungeDesignChair" },
      { id: "lounge-plant", kind: "plant", x: -11.5, z: 7.5, rot: 0, model: "monstera" },
      // Sun loungers in the far corner, with a planter between them and the dining.
      { id: "sunbed-1", kind: "armchair", x: 9.2, z: 6.8, rot: 2, model: "k:loungeChair" },
      { id: "sunbed-2", kind: "armchair", x: 11.0, z: 6.8, rot: 2, model: "k:loungeChair" },
      { id: "planter-front", kind: "planter", x: 10.0, z: 3.4, rot: 0 },
    ],
    spawn: [1.0, 6.6],
    npcs: [
      { x: -7.0, z: -7.85, facing: 0 }, { x: -8.3, z: -6.5, facing: 3.14, seated: true }, { x: -5.0, z: -6.5, facing: 3.14, seated: true },
      { x: 1.6, z: -0.8, facing: 2.4 }, { x: 6.9, z: -4.4, facing: -2.4 }, { x: 9.5, z: -2.7, facing: 0 }, { x: 3.4, z: -6.0, facing: 0.8 },
      { x: -8.6, z: 7.2, facing: 3.14, seated: true }, { x: -4.4, z: 7.2, facing: 3.14, seated: true },
      { x: -1.2, z: 3.8, facing: 2.2 }, { x: 6.2, z: 3.6, facing: -0.8 }, { x: 0.4, z: 2.0, facing: 1.4 },
    ],
  },
  // ---- The big clubs (owner, Nov 20: "Start with the clubs"; then the references: "a bar, a stage with go-go dancers, a vip,
  // lighting, a bigger floor plan") ----
  // 28 × 18 m. The back wall is the show: a raised DJ stage under a video wall, a go-go dancer at each end and two more on lit
  // podiums at the dance floor's corners, CO2 cannons, a lighting rig with moving beams (clubLights). The long bar runs down the
  // left wall under a second video wall; the roped-off VIP section (gold carpet, gold booths, bottle tables, the stairs to the
  // VIP floor) takes the front right; the lounge (and each club's signature piece: PLACE_SIGNATURE) the front left.
  clubBig: {
    id: "clubBig", w: 28, d: 18, wall: "#1B1426", wallAccent: "#FF2E88", floor: "#1E1828", floorKind: "concrete", dark: true,
    clubLights: true,
    rooms: [
      { name: "Dance floor", x0: -11, z0: -9, x1: 14, z1: 2, floor: "#1E1828", floorKind: "concrete" },
      { name: "Bar", x0: -14, z0: -9, x1: -11, z1: 4, floor: "#2A1E24", floorKind: "wood" },
      { name: "Lounge", x0: -14, z0: 4, x1: 5, z1: 9, floor: "#241A30", floorKind: "wood" },
      { name: "VIP", x0: 5, z0: 2, x1: 14, z1: 9, floor: "#3A2A12", floorKind: "wood" },
      { name: "Floor", x0: -11, z0: 2, x1: 5, z1: 4, floor: "#1E1828", floorKind: "concrete" },
    ],
    items: [
      // The show: stage, video walls, dancers' podiums, pillars.
      { id: "stage", kind: "djStage", x: 0, z: -7.55, rot: 0 },
      { id: "screen-back", kind: "ledWall", x: 0, z: -8.9, rot: 0 },
      { id: "screen-side", kind: "ledWall", x: -13.9, z: -4.5, rot: 1 },
      { id: "speaker-1", kind: "speaker", x: -6.0, z: -8.4, rot: 0, model: "k:speaker" },
      { id: "speaker-2", kind: "speaker", x: 6.0, z: -8.4, rot: 0, model: "k:speaker" },
      { id: "podium-1", kind: "gogoPodium", x: -6.2, z: -3.2, rot: 0 },
      { id: "podium-2", kind: "gogoPodium", x: 6.2, z: -3.2, rot: 0 },
      { id: "pillar-1", kind: "clubPillar", x: -8.5, z: -6.0, rot: 0 },
      { id: "pillar-2", kind: "clubPillar", x: 8.5, z: -6.0, rot: 0 },
      { id: "pillar-3", kind: "clubPillar", x: -8.5, z: 1.0, rot: 0 },
      { id: "pillar-4", kind: "clubPillar", x: 8.5, z: 1.0, rot: 0 },
      // The dance floor: six lit tiles, 9 × 6 m, in front of the stage.
      { id: "floor", kind: "danceFloor", x: 0, z: -1.0, rot: 0, use: { kind: "events" }, label: "Dance" },
      { id: "floor-2", kind: "danceFloor", x: -3.0, z: -1.0, rot: 0 },
      { id: "floor-3", kind: "danceFloor", x: 3.0, z: -1.0, rot: 0 },
      { id: "floor-4", kind: "danceFloor", x: -3.0, z: -4.0, rot: 0 },
      { id: "floor-5", kind: "danceFloor", x: 0, z: -4.0, rot: 0 },
      { id: "floor-6", kind: "danceFloor", x: 3.0, z: -4.0, rot: 0 },
      // The bar down the left wall: three lengths of neon bar, bartenders behind, stools in front.
      { id: "bar", kind: "bar", x: -12.9, z: -1.2, rot: 1, use: { kind: "action", actionId: "visit" }, label: "Get seen", model: "bar" },
      { id: "bar-2", kind: "bar", x: -12.9, z: -4.4, rot: 1, model: "bar" },
      { id: "bar-3", kind: "bar", x: -12.9, z: 2.0, rot: 1, model: "bar" },
      ...[-5.6, -4.6, -3.6, -2.4, -1.4, -0.4, 0.8, 1.8, 2.8].map((z, i) => ({ id: `stool-${i + 1}`, kind: "barStool" as const, x: -11.9, z, rot: 1, model: "barStool" })),
      // The lounge: sofas facing the floor, velvet chairs, low marble tables; the left end is the feature corner.
      { id: "lounge-sofa-1", kind: "sofa", x: -6.0, z: 8.3, rot: 2, color: "#3B2A55", model: "sofa" },
      { id: "lounge-table-1", kind: "coffeeTable", x: -6.0, z: 7.1, rot: 0, model: "marbleTable" },
      { id: "lounge-chair-1", kind: "armchair", x: -7.6, z: 6.6, rot: 1, color: "#6B2BD9", model: "velvetChair", use: sit, label: "Sit" },
      { id: "lounge-chair-2", kind: "armchair", x: -4.4, z: 6.6, rot: 3, color: "#6B2BD9", model: "velvetChair" },
      { id: "lounge-sofa-2", kind: "sofa", x: -0.5, z: 8.3, rot: 2, color: "#3B2A55", model: "sofa" },
      { id: "lounge-table-2", kind: "coffeeTable", x: -0.5, z: 7.1, rot: 0, model: "marbleTable" },
      { id: "lounge-chair-3", kind: "armchair", x: -2.1, z: 6.6, rot: 1, color: "#6B2BD9", model: "velvetChair" },
      { id: "lounge-chair-4", kind: "armchair", x: 1.1, z: 6.6, rot: 3, color: "#6B2BD9", model: "velvetChair" },
      { id: "lounge-lamp", kind: "floorLamp", x: 3.6, z: 8.5, rot: 0, model: "arcLamp" },
      { id: "lounge-plant", kind: "plant", x: -13.5, z: 8.5, rot: 0, model: "figTree" },
      // The VIP section: roped off, gold carpet, gold booths with bottle tables, a chandelier, the stairs to the VIP floor.
      { id: "vip-rug", kind: "rug", x: 9.5, z: 5.5, rot: 0, color: "#C9A227" },
      { id: "rope-1", kind: "velvetRope", x: 6.2, z: 2.3, rot: 0 },
      { id: "rope-2", kind: "velvetRope", x: 11.6, z: 2.3, rot: 0 },
      { id: "rope-3", kind: "velvetRope", x: 5.3, z: 4.4, rot: 1 },
      { id: "rope-4", kind: "velvetRope", x: 5.3, z: 7.6, rot: 1 },
      { id: "vip-booth-1", kind: "booth", x: 13.4, z: 3.8, rot: 3, color: "#F2A900", model: "booth" },
      { id: "vip-table-1", kind: "coffeeTable", x: 12.2, z: 3.8, rot: 1, model: "marbleTable" },
      { id: "vip-booth-2", kind: "booth", x: 13.4, z: 6.6, rot: 3, color: "#F2A900", model: "booth" },
      { id: "vip-table-2", kind: "coffeeTable", x: 12.2, z: 6.6, rot: 1, model: "marbleTable" },
      { id: "vip-booth-3", kind: "booth", x: 8.0, z: 8.4, rot: 2, color: "#F2A900", model: "booth" },
      { id: "vip-table-3", kind: "coffeeTable", x: 8.0, z: 7.3, rot: 0, model: "marbleTable" },
      { id: "vip-chandelier", kind: "chandelier", x: 9.5, z: 5.5, rot: 0, model: "chandelier" },
      { id: "vip-plant", kind: "plant", x: 13.5, z: 8.5, rot: 0, model: "monstera" },
    ],
    spawn: [-2.0, 3.0],
    npcs: [
      // The show: the DJ and two dancers on the stage, two on the podiums.
      { x: 0, z: -8.2, facing: 0, y: 0.6 },
      { x: -3.9, z: -7.2, facing: 0, y: 0.6, dance: true, costume: "gogo" }, { x: 3.9, z: -7.2, facing: 0, y: 0.6, dance: true, costume: "gogo" },
      { x: -6.2, z: -3.2, facing: 0.4, y: 0.95, dance: true, costume: "gogo" }, { x: 6.2, z: -3.2, facing: -0.4, y: 0.95, dance: true, costume: "gogo" },
      // The floor.
      { x: -3.4, z: -1.4, facing: 0.6 }, { x: -1.0, z: -0.4, facing: -2.4 }, { x: 1.2, z: -3.4, facing: 2.0 }, { x: 3.4, z: -1.2, facing: -1.2 },
      { x: 0.2, z: -4.8, facing: 0.2 }, { x: -2.6, z: -4.4, facing: 1.0 }, { x: 2.4, z: 0.2, facing: 3.0 },
      // Bartenders, the bar, the lounge, VIP.
      { x: -13.65, z: -2.2, facing: 1.57 }, { x: -13.65, z: 1.4, facing: 1.57 },
      { x: -11.9, z: -4.6, facing: -1.57, seated: true }, { x: -11.9, z: -0.4, facing: -1.57, seated: true }, { x: -11.9, z: 1.8, facing: -1.57, seated: true },
      { x: -6.0, z: 8.2, facing: 3.14, seated: true }, { x: -0.5, z: 8.2, facing: 3.14, seated: true },
      { x: 13.0, z: 3.8, facing: -1.57, seated: true }, { x: 13.0, z: 6.6, facing: -1.57, seated: true }, { x: 10.0, z: 5.2, facing: 2.4 },
    ],
  },
  // The big clubs' VIP floor (14 × 10 m): the gold bar where you get seen, a grand piano nobody may touch, a pool table under the
  // chandelier, gold booths and a chesterfield corner.
  vipBig: {
    id: "vipBig", w: 14, d: 10, wall: "#1E1730", wallAccent: "#F2A900", floor: "#2A2036", floorKind: "wood", dark: true,
    clubLights: true,
    items: [
      { id: "screen", kind: "ledWall", x: 2.4, z: -4.9, rot: 0 },
      { id: "pillar-1", kind: "clubPillar", x: -0.4, z: -1.6, rot: 0 },
      { id: "pillar-2", kind: "clubPillar", x: 4.4, z: 2.4, rot: 0 },
      { id: "stairs-down", kind: "stairs", x: -6.0, z: 3.9, rot: 0, use: { kind: "floor", to: 1 }, label: "↓", name: "Back down to the club" },
      { id: "bar", kind: "bar", x: -2.5, z: -4.45, rot: 0, color: "#F2A900", use: { kind: "vip" }, label: "🥂", name: "Get seen in VIP" },
      ...[-3.7, -2.9, -2.1, -1.3].map((x, i) => ({ id: `stool-${i + 1}`, kind: "barStool" as const, x, z: -3.6, rot: 0, model: "barStool" })),
      { id: "piano", kind: "piano", x: 4.6, z: -3.9, rot: 0, model: "grandPiano" },
      { id: "pool", kind: "poolTable", x: 2.0, z: 0.2, rot: 0, model: "poolTable" },
      { id: "pool-light", kind: "chandelier", x: 2.0, z: 0.2, rot: 0, model: "chandelier" },
      { id: "booth-1", kind: "booth", x: -6.4, z: -1.2, rot: 1, color: "#F2A900", model: "booth" },
      { id: "table-1", kind: "coffeeTable", x: -5.3, z: -1.2, rot: 1, model: "marbleTable" },
      { id: "booth-2", kind: "booth", x: 6.4, z: 1.6, rot: 3, color: "#F2A900", model: "booth" },
      { id: "table-2", kind: "coffeeTable", x: 5.3, z: 1.6, rot: 1, model: "marbleTable" },
      { id: "sofa", kind: "sofa", x: -1.5, z: 4.4, rot: 2, color: "#7A2E3A", use: sit, label: "Sit", model: "chesterfield" },
      { id: "chair-1", kind: "armchair", x: -3.2, z: 3.0, rot: 1, color: "#1F6B4A", model: "velvetChair" },
      { id: "chair-2", kind: "armchair", x: 0.2, z: 3.0, rot: 3, color: "#1F6B4A", model: "velvetChair" },
      { id: "table", kind: "coffeeTable", x: -1.5, z: 3.0, rot: 0, model: "marbleTable" },
      { id: "lamp", kind: "floorLamp", x: -4.3, z: 4.5, rot: 0, model: "arcLamp" },
      { id: "plant-1", kind: "plant", x: 6.5, z: -4.5, rot: 0, model: "figTree" },
      { id: "plant-2", kind: "plant", x: 6.5, z: 4.5, rot: 0, model: "monstera" },
    ],
    spawn: [-4.6, 3.9],
    npcs: [
      { x: -3.7, z: -3.6, facing: 3.14, seated: true }, { x: -2.1, z: -3.6, facing: 3.14, seated: true }, { x: -2.5, z: -4.95, facing: 0 },
      { x: 2.0, z: 1.3, facing: 3.14 }, { x: 3.4, z: -0.6, facing: -1.6 }, { x: -6.0, z: -1.2, facing: 1.57, seated: true },
      { x: 4.6, z: -2.9, facing: 3.14 }, { x: -1.5, z: 3.8, facing: 3.14 },
    ],
  },
  // VIP: gold booths, a private bar where you get seen, and a piano nobody is allowed to touch.
  vip: {
    id: "vip", w: 7.6, d: 6.4, wall: "#1E1730", wallAccent: "#F2A900", floor: "#2A2036", floorKind: "wood", dark: true,
    items: [
      { id: "stairs-down", kind: "stairs", x: -3.0, z: 2.2, rot: 2, use: { kind: "floor", to: 1 }, label: "↓", name: "Back down to the club" },
      { id: "bar", kind: "bar", x: -1.0, z: -2.7, rot: 0, color: "#F2A900", use: { kind: "vip" }, label: "🥂", name: "Get seen in VIP" },
      { id: "stool-1", kind: "barStool", x: -2.0, z: -1.9, rot: 0 },
      { id: "stool-2", kind: "barStool", x: -1.0, z: -1.9, rot: 0 },
      { id: "stool-3", kind: "barStool", x: 0.0, z: -1.9, rot: 0 },
      { id: "piano", kind: "piano", x: 2.6, z: -2.3, rot: 0 },
      { id: "booth-1", kind: "booth", x: -3.3, z: -0.4, rot: 1, color: "#F2A900" },
      { id: "booth-2", kind: "booth", x: 3.3, z: 0.4, rot: 3, color: "#F2A900" },
      { id: "sofa", kind: "sofa", x: 1.0, z: 2.6, rot: 2, color: "#7A2E3A", use: sit, label: "Sit" },
      { id: "table", kind: "coffeeTable", x: 1.0, z: 1.5, rot: 0 },
      { id: "plant", kind: "plant", x: 3.45, z: 2.85, rot: 0 },
    ],
    spawn: [-1.8, 1.4],
    npcs: [
      { x: -2.0, z: -1.9, facing: 3.14, seated: true }, { x: 0.0, z: -1.9, facing: 3.14, seated: true }, { x: -1.0, z: -3.15, facing: 0 },
      { x: 2.6, z: -1.3, facing: 3.14 }, { x: 0.6, z: 2.6, facing: 3.14, seated: true },
    ],
  },
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
      { id: "floor", kind: "danceFloor", x: 0.65, z: 0.3, rot: 0, use: { kind: "events" }, label: "Dance" },
      { id: "booth", kind: "booth", x: -3.4, z: 1.4, rot: 1, color: "#6B2BD9" },
    ],
    spawn: [0, 3.0],
    npcs: [
      { x: 0.2, z: 0.0, facing: 0.6 }, { x: 1.4, z: 0.8, facing: -2.4 }, { x: -2.2, z: -2.1, facing: 3.14, seated: true },
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
  // #19 Fif's Furniture: little rooms on the shop floor; each opens the Shop's Home tab on that room.
  showroom: {
    id: "showroom", w: 10.0, d: 7.5, wall: "#F3EBDD", wallAccent: "#FFC21A", floor: "#D9C7A8", floorKind: "wood", window: true,
    items: [
      { id: "rug-1", kind: "rug", x: -3.0, z: -2.2, rot: 0, color: "#40B589" },
      { id: "sofa", kind: "sofa", x: -3.0, z: -3.05, rot: 0, color: "#6C8CFF", use: { kind: "shop", category: "home", section: "living" }, label: "Browse living" },
      { id: "coffee-table", kind: "coffeeTable", x: -3.0, z: -1.9, rot: 0 },
      { id: "lamp", kind: "floorLamp", x: -4.6, z: -3.4, rot: 0 },
      { id: "bed", kind: "bed", x: 0.6, z: -2.55, rot: 0, color: "#F2B8C6", use: { kind: "shop", category: "home", section: "bedroom" }, label: "Browse bedroom" },
      { id: "nightstand", kind: "nightstand", x: 1.85, z: -3.3, rot: 0 },
      { id: "rug-2", kind: "rug", x: 3.6, z: -2.3, rot: 0, color: "#FFC21A" },
      { id: "dining", kind: "diningTable", x: 3.6, z: -2.3, rot: 0, use: { kind: "shop", category: "home", section: "dining" }, label: "Browse dining" },
      { id: "chair-1", kind: "chair", x: 3.6, z: -3.0, rot: 0 },
      { id: "chair-2", kind: "chair", x: 3.6, z: -1.6, rot: 2 },
      { id: "armchair-1", kind: "armchair", x: -4.4, z: 0.6, rot: 1, color: "#FF8A3D", use: { kind: "action", actionId: "browse" }, label: "Sit on everything" },
      { id: "armchair-2", kind: "armchair", x: -4.4, z: 1.8, rot: 1, color: "#B0135A" },
      { id: "bookshelf", kind: "bookshelf", x: -1.4, z: 0.4, rot: 0 },
      { id: "plant-1", kind: "plant", x: 4.3, z: 1.4, rot: 0, use: { kind: "shop", category: "home", section: "decor" }, label: "Browse decor" },
      { id: "plant-2", kind: "plant", x: 4.3, z: 0.7, rot: 0 },
      { id: "display", kind: "desk", x: 0.4, z: 0.4, rot: 0 },
      { id: "counter", kind: "storeCounter", x: 2.8, z: 2.6, rot: 2 },
    ],
    spawn: [-0.6, 2.9],
    npcs: [{ x: 2.8, z: 3.15, facing: 3.14 }, { x: -2.4, z: -1.0, facing: 3.14 }],
  },
  // The parody universities: a lecture hall with rows of desks facing the board.
  campus: {
    id: "campus", w: 8.0, d: 7.0, wall: "#EDE4D3", wallAccent: "#7A5A3A", floor: "#B08A5E", floorKind: "wood", window: true,
    items: [
      { id: "board", kind: "chalkboard", x: -0.4, z: -3.3, rot: 0, use: { kind: "events" }, label: "Campus events" },
      { id: "lectern", kind: "lectern", x: 2.0, z: -2.3, rot: 0 },
      { id: "desk-1", kind: "lectureDesk", x: -2.5, z: -0.6, rot: 2, use: { kind: "action", actionId: "lecture" }, label: "Take notes" },
      { id: "desk-2", kind: "lectureDesk", x: 0.0, z: -0.6, rot: 2 },
      { id: "desk-3", kind: "lectureDesk", x: 2.5, z: -0.6, rot: 2, use: { kind: "campus", tab: "classes" }, label: "Go to class" },
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
  // v0.14 On Air (owner, Oct 16): Real Clout FM's studio. DJ Sharm Almight sits at the desk; the desk
  // (and the mic in front of it) is "Send Radio Shoutout"; the couch is where guests sit in on the show.
  radio: {
    id: "radio", w: 6.4, d: 5.6, wall: "#1F3A44", wallAccent: "#FF2E88", floor: "#9A6B45", floorKind: "wood", window: false, alwaysLit: true,
    items: [
      { id: "desk", kind: "micDesk", x: 0.0, z: -1.6, rot: 0, use: { kind: "station", what: "shoutout" }, label: "Send Radio Shoutout" },
      { id: "on-air", kind: "onAirSign", x: -1.4, z: -2.7, rot: 0 },
      { id: "foam", kind: "soundPanel", x: 1.35, z: -2.72, rot: 0 },
      { id: "speaker", kind: "speaker", x: -2.8, z: -2.3, rot: 0 },
      { id: "speaker-2", kind: "speaker", x: 2.8, z: -2.3, rot: 0 },
      { id: "couch", kind: "sofa", x: -1.8, z: 1.2, rot: 1, color: "#FF6A3D", use: { kind: "action", actionId: "*0" }, label: "Sit in on the show" },
      { id: "rug", kind: "rug", x: 0.6, z: 1.0, rot: 0, color: "#FFB23D" },
      { id: "plant", kind: "plant", x: 2.8, z: 2.3, rot: 0 },
    ],
    spawn: [0.8, 1.9],
    npcs: [{ x: 0.0, z: -2.4, facing: 0, seated: true }, { x: 1.9, z: 0.0, facing: 2.4 }],
  },
  // v0.14 On Air: Clout TV's control room at the foot of the tower. The wall screen shows what's on the
  // Big Screen now; the ring light by the backdrop is "Get on Billboard".
  broadcast: {
    id: "broadcast", w: 7.2, d: 6.0, wall: "#2A2530", wallAccent: "#FF6A3D", floor: "#3A3440", floorKind: "tile", window: false, alwaysLit: true,
    items: [
      { id: "screen", kind: "bigScreen", x: -0.6, z: -2.9, rot: 0, use: { kind: "station", what: "watch" }, label: "On the Big Screen" },
      { id: "ring", kind: "ringLight", x: 2.6, z: -1.4, rot: 3, use: { kind: "station", what: "billboard" }, label: "Get on Billboard" },
      { id: "backdrop", kind: "rug", x: 2.6, z: -0.2, rot: 1, color: "#FF2E88" },
      { id: "camera", kind: "tvCamera", x: -2.6, z: -0.2, rot: 1 },
      { id: "camera-2", kind: "tvCamera", x: 0.6, z: 0.6, rot: 2 },
      { id: "couch", kind: "sofa", x: -0.8, z: 1.9, rot: 2, color: "#FF6A3D", use: { kind: "action", actionId: "*0" }, label: "Watch with the crew" },
      { id: "plant", kind: "plant", x: 3.2, z: 2.5, rot: 0 },
      { id: "plant-2", kind: "plant", x: -3.2, z: 2.5, rot: 0 },
    ],
    spawn: [1.4, 2.4],
    npcs: [{ x: -1.8, z: -1.6, facing: 0.6 }, { x: 0.4, z: -1.0, facing: 3.0 }],
  },
  // ---- The Hub (owner, Oct 16): the meeting point, four floors (HUB_FLOORS) joined by stairs ----
  // Ground floor: the Neon Spoon diner. Stairs down to the restroom, up to the game room.
  hub: {
    id: "hub", w: 10.0, d: 8.0, wall: "#E8F4F6", wallAccent: "#3BB8C9", floor: "#CFE3E8", floorKind: "checker", window: true, alwaysLit: true,
    items: [
      { id: "counter", kind: "cafeCounter", x: -2.0, z: -3.0, rot: 0, use: { kind: "action", actionId: "eat" }, label: "Pancakes at the counter" },
      { id: "pastries", kind: "pastryCase", x: 0.7, z: -3.1, rot: 0 },
      { id: "stool-1", kind: "barStool", x: -3.0, z: -2.2, rot: 0 },
      { id: "stool-2", kind: "barStool", x: -2.0, z: -2.2, rot: 0 },
      { id: "stool-3", kind: "barStool", x: -1.0, z: -2.2, rot: 0 },
      { id: "booth-1", kind: "booth", x: 4.4, z: -2.6, rot: 1, color: "#FF2E88" },
      { id: "table-1", kind: "cafeTable", x: 3.4, z: -2.6, rot: 0, use: { kind: "action", actionId: "eat" }, label: "A booth" },
      { id: "booth-2", kind: "booth", x: 4.4, z: 0.2, rot: 1, color: "#3BB8C9" },
      { id: "table-2", kind: "cafeTable", x: 3.4, z: 0.2, rot: 0, use: { kind: "action", actionId: "eat" }, label: "A booth" },
      { id: "emblem", kind: "rug", x: -0.4, z: 0.4, rot: 0, color: "#3BB8C9" },
      { id: "table-3", kind: "cafeTable", x: -3.4, z: 0.6, rot: 0 },
      { id: "chair-3", kind: "chair", x: -2.6, z: 0.6, rot: 3 },
      { id: "stairs-down", kind: "stairs", x: -4.1, z: 2.6, rot: 1, color: "#2B2440", use: { kind: "floor", to: 0 }, label: "↓", name: "Downstairs to the restroom" },
      { id: "stairs-up", kind: "stairs", x: 4.1, z: 2.6, rot: 3, color: "#3BB8C9", use: { kind: "floor", to: 2 }, label: "↑", name: "Up to the game room" },
      { id: "plant-1", kind: "plant", x: 2.2, z: -3.4, rot: 0 },
      { id: "plant-2", kind: "plant", x: -4.5, z: -3.4, rot: 0 },
    ],
    spawn: [0.0, 3.2],
    npcs: [{ x: 1.4, z: 2.4, facing: 0 }, { x: -2.0, z: -3.6, facing: 0 }, { x: -1.8, z: 1.8, facing: -2.2 }],
  },
  // Second floor: the game room, lit by the cabinets. Stairs down to the diner, up to the lounge.
  hubGames: {
    id: "hubGames", w: 10.0, d: 8.0, wall: "#173A3F", wallAccent: "#3DDC97", floor: "#22363A", floorKind: "concrete", dark: true,
    items: [
      { id: "arcade-1", kind: "arcade", x: -4.2, z: -3.5, rot: 0, color: "#FF2E88", use: { kind: "action", actionId: "play" }, label: "Play a round" },
      { id: "arcade-2", kind: "arcade", x: -3.1, z: -3.5, rot: 0, color: "#3BB8C9" },
      { id: "arcade-3", kind: "arcade", x: -2.0, z: -3.5, rot: 0, color: "#FFB23D", use: { kind: "action", actionId: "play" }, label: "Play a round" },
      { id: "arcade-4", kind: "arcade", x: -0.9, z: -3.5, rot: 0, color: "#3DDC97" },
      { id: "pool", kind: "poolTable", x: 1.4, z: 0.0, rot: 0, use: { kind: "action", actionId: "play" }, label: "Rack 'em" },
      { id: "tv", kind: "tvStand", x: 3.4, z: -3.6, rot: 0 },
      { id: "couch", kind: "sofa", x: 3.4, z: -2.0, rot: 2, color: "#FF6A3D" },
      { id: "speaker", kind: "speaker", x: 1.2, z: -3.6, rot: 0 },
      { id: "stairs-down", kind: "stairs", x: -4.1, z: 2.6, rot: 1, color: "#2B2440", use: { kind: "floor", to: 1 }, label: "↓", name: "Down to the diner" },
      { id: "stairs-up", kind: "stairs", x: 4.1, z: 2.6, rot: 3, color: "#3DDC97", use: { kind: "floor", to: 3 }, label: "↑", name: "Up to the lounge" },
    ],
    spawn: [0.0, 3.2],
    npcs: [{ x: -2.0, z: -2.6, facing: 3.14 }, { x: 2.6, z: 0.9, facing: 2.6 }],
  },
  // Top floor: the lounge, couches under the glass ring. Stairs down to the game room.
  hubLounge: {
    id: "hubLounge", w: 10.0, d: 8.0, wall: "#F6EFE6", wallAccent: "#FF6A3D", floor: "#B98A62", floorKind: "wood", window: true, alwaysLit: true,
    items: [
      { id: "sofa-1", kind: "sofa", x: -2.4, z: -1.8, rot: 0, color: "#3BB8C9", use: { kind: "action", actionId: "hang" }, label: "Hang out" },
      { id: "table-1", kind: "coffeeTable", x: -2.4, z: -0.5, rot: 0 },
      { id: "chair-1", kind: "armchair", x: -4.2, z: -0.4, rot: 1, color: "#FFB23D" },
      { id: "rug-1", kind: "rug", x: -2.4, z: -0.6, rot: 0, color: "#FFE7C2" },
      { id: "sofa-2", kind: "sofa", x: 2.6, z: -1.8, rot: 0, color: "#FF6A3D", use: { kind: "action", actionId: "hang" }, label: "Hang out" },
      { id: "table-2", kind: "coffeeTable", x: 2.6, z: -0.5, rot: 0 },
      { id: "chair-2", kind: "armchair", x: 0.6, z: 1.0, rot: 2, color: "#3DDC97" },
      { id: "shelf", kind: "bookshelf", x: -0.2, z: -3.7, rot: 0 },
      { id: "piano", kind: "piano", x: 3.9, z: 1.0, rot: 3 },
      { id: "lamp", kind: "floorLamp", x: 4.6, z: -3.6, rot: 0 },
      { id: "plant-1", kind: "plant", x: -4.6, z: -3.6, rot: 0 },
      { id: "plant-2", kind: "plant", x: 1.6, z: -3.6, rot: 0 },
      { id: "stairs-down", kind: "stairs", x: -4.1, z: 2.6, rot: 1, color: "#2B2440", use: { kind: "floor", to: 2 }, label: "↓", name: "Down to the game room" },
    ],
    spawn: [0.0, 3.2],
    npcs: [{ x: -2.4, z: -2.2, facing: 0, seated: true }, { x: 1.8, z: 1.2, facing: 3.14 }],
  },
  // ---- v0.15 campus areas (owner, Oct 18: "a walk-around campus with rooms"): CAMPUS_AREAS ----
  // The Quad, where you arrive: lawns, benches, the events board and paths to every building.
  campusQuad: {
    id: "campusQuad", w: 14.0, d: 12.0, wall: "#BFD3E0", wallAccent: "#7FA36A", floor: "#D9CFC0", floorKind: "tile",
    outdoor: { height: 4.5, edge: "#7FA36A", view: [10, 9] },
    items: [
      { id: "lawn-1", kind: "rug", x: -3.2, z: -1.4, rot: 0, color: "#7CC86B", use: { kind: "action", actionId: "quad" }, label: "Hang out on the lawn" },
      { id: "lawn-2", kind: "rug", x: -3.2, z: 0.4, rot: 0, color: "#7CC86B" },
      { id: "lawn-3", kind: "rug", x: 3.2, z: -1.4, rot: 0, color: "#7CC86B" },
      { id: "lawn-4", kind: "rug", x: 3.2, z: 0.4, rot: 0, color: "#7CC86B" },
      { id: "board", kind: "chalkboard", x: 0.0, z: -5.2, rot: 0, use: { kind: "events" }, label: "Campus events" },
      { id: "bench-1", kind: "bench", x: -1.2, z: -3.0, rot: 0, use: { kind: "sit" }, label: "Sit" },
      { id: "bench-2", kind: "bench", x: 1.2, z: -3.0, rot: 0, use: { kind: "action", actionId: "quad" }, label: "People-watch" },
      { id: "bench-3", kind: "bench", x: -5.6, z: 2.6, rot: 1 },
      { id: "cart", kind: "foodCart", x: 5.4, z: 3.2, rot: 3, color: "#F2A900" },
      { id: "lamp-1", kind: "lamppost", x: -2.0, z: 2.4, rot: 0 },
      { id: "lamp-2", kind: "lamppost", x: 2.0, z: 2.4, rot: 0 },
      { id: "tree-1", kind: "tree", x: -6.0, z: -5.0, rot: 0 },
      { id: "tree-2", kind: "tree", x: 6.0, z: -5.0, rot: 0 },
      { id: "tree-3", kind: "tree", x: -6.0, z: -1.0, rot: 0 },
      { id: "tree-4", kind: "tree", x: 6.0, z: -1.0, rot: 0 },
      { id: "tree-5", kind: "tree", x: 6.2, z: 5.0, rot: 0 },
    ],
    spawn: [0.0, 4.6],
    npcs: [
      { x: -3.0, z: -1.0, facing: 0.6, seated: true }, { x: 3.4, z: -0.8, facing: 2.6, seated: true },
      { x: 1.2, z: -2.6, facing: 3.14, seated: true }, { x: 4.6, z: 2.8, facing: 2.2 }, { x: -1.4, z: 1.2, facing: 1.0 },
    ],
  },
  // The Library: stacks, long study tables and the exam desk. Quiet, mostly.
  campusLibrary: {
    id: "campusLibrary", w: 9.0, d: 7.5, wall: "#EFE6D6", wallAccent: "#6B4A2E", floor: "#9C7651", floorKind: "wood", window: true,
    items: [
      { id: "stack-1", kind: "bookshelf", x: -3.6, z: -3.5, rot: 0 },
      { id: "stack-2", kind: "bookshelf", x: -2.4, z: -3.5, rot: 0 },
      { id: "stack-3", kind: "bookshelf", x: -1.2, z: -3.5, rot: 0 },
      { id: "stack-4", kind: "bookshelf", x: 1.2, z: -3.5, rot: 0 },
      { id: "stack-5", kind: "bookshelf", x: 2.4, z: -3.5, rot: 0 },
      { id: "stack-6", kind: "bookshelf", x: 3.6, z: -3.5, rot: 0 },
      { id: "table-1", kind: "diningTable", x: -2.2, z: -0.8, rot: 0, use: { kind: "action", actionId: "study" }, label: "Study" },
      { id: "chair-1", kind: "chair", x: -2.8, z: -0.1, rot: 2 },
      { id: "chair-2", kind: "chair", x: -1.6, z: -0.1, rot: 2 },
      { id: "table-2", kind: "diningTable", x: 2.2, z: -0.8, rot: 0, use: { kind: "campus", tab: "exams" }, label: "Exams" },
      { id: "chair-3", kind: "chair", x: 1.6, z: -0.1, rot: 2 },
      { id: "chair-4", kind: "chair", x: 2.8, z: -0.1, rot: 2 },
      { id: "desk", kind: "desk", x: -3.4, z: 2.2, rot: 1 },
      { id: "lamp-1", kind: "floorLamp", x: -4.0, z: 3.2, rot: 0 },
      { id: "chair-5", kind: "armchair", x: 3.4, z: 2.0, rot: 3, color: "#7A5A3A" },
      { id: "plant-1", kind: "plant", x: 4.0, z: 3.2, rot: 0 },
    ],
    spawn: [0.0, 3.0],
    npcs: [{ x: -3.4, z: 2.6, facing: 1.57, seated: true }, { x: -2.8, z: 0.2, facing: 3.14, seated: true }, { x: 2.8, z: 0.2, facing: 3.14, seated: true }],
  },
  // The Dining Hall: a tray line, long tables and the menu of the day.
  campusDining: {
    id: "campusDining", w: 9.0, d: 7.5, wall: "#F3EBDD", wallAccent: "#C8102E", floor: "#D8D2C4", floorKind: "checker", window: true, alwaysLit: true,
    items: [
      { id: "line", kind: "cafeCounter", x: -2.4, z: -3.1, rot: 0, use: { kind: "campus", tab: "dining" }, label: "Grab a tray" },
      { id: "case", kind: "pastryCase", x: -0.2, z: -3.1, rot: 0 },
      { id: "menu", kind: "chalkboard", x: 2.6, z: -3.55, rot: 0, use: { kind: "campus", tab: "dining" }, label: "Today's menu" },
      { id: "table-1", kind: "diningTable", x: -2.4, z: 0.0, rot: 0 },
      { id: "table-2", kind: "diningTable", x: 0.6, z: 0.0, rot: 0 },
      { id: "table-3", kind: "diningTable", x: -2.4, z: 2.2, rot: 0 },
      { id: "table-4", kind: "diningTable", x: 0.6, z: 2.2, rot: 0 },
      { id: "chair-1", kind: "chair", x: -2.4, z: 0.7, rot: 2 },
      { id: "chair-2", kind: "chair", x: 0.6, z: -0.7, rot: 0 },
      { id: "chair-3", kind: "chair", x: -2.4, z: 2.9, rot: 2 },
      { id: "chair-4", kind: "chair", x: 0.6, z: 2.9, rot: 2 },
      { id: "fridge", kind: "drinksFridge", x: 4.0, z: 0.2, rot: 3 },
      { id: "plant-1", kind: "plant", x: 4.0, z: 3.2, rot: 0 },
    ],
    spawn: [3.0, 2.6],
    npcs: [{ x: -2.4, z: -2.4, facing: 0 }, { x: -2.4, z: 0.7, facing: 3.14, seated: true }, { x: 0.6, z: -0.7, facing: 0, seated: true }],
  },
  // Greek Row: a house party living room. Party night happens here; the rest of the week it's a very sticky couch.
  campusGreek: {
    id: "campusGreek", w: 9.0, d: 7.5, wall: "#3A2E44", wallAccent: "#FF6A3D", floor: "#6E4C35", floorKind: "wood", dark: true,
    items: [
      { id: "floor", kind: "danceFloor", x: 0.0, z: 0.2, rot: 0, use: { kind: "events" }, label: "Party night" },
      { id: "dj", kind: "djBooth", x: 0.0, z: -3.0, rot: 0 },
      { id: "speaker-1", kind: "speaker", x: -2.0, z: -3.2, rot: 0 },
      { id: "speaker-2", kind: "speaker", x: 2.0, z: -3.2, rot: 0 },
      { id: "sofa", kind: "sofa", x: -3.4, z: 2.6, rot: 1, color: "#7A5A3A", use: { kind: "sit" }, label: "Sit" },
      { id: "table", kind: "coffeeTable", x: -2.3, z: 2.6, rot: 1 },
      { id: "punch", kind: "bar", x: 3.6, z: 1.0, rot: 3 },
      { id: "lamp", kind: "floorLamp", x: -4.0, z: -3.2, rot: 0 },
    ],
    spawn: [0.0, 3.0],
    npcs: [{ x: 0.0, z: -2.5, facing: 0 }, { x: -0.8, z: 0.6, facing: 0.6 }, { x: 0.9, z: 0.0, facing: 2.6 }, { x: 3.1, z: 1.4, facing: 4.7 }],
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
      { id: "stairs-down", kind: "stairs", x: -3.3, z: 2.2, rot: 2, use: { kind: "floor", to: 1 }, label: "↓", name: "Downstairs" },
      { id: "dj", kind: "djBooth", x: 1.6, z: -3.0, rot: 0 },
      { id: "speaker-1", kind: "speaker", x: 3.2, z: -3.05, rot: 0 },
      { id: "speaker-2", kind: "speaker", x: 0.0, z: -3.05, rot: 0 },
      { id: "floor", kind: "danceFloor", x: 1.4, z: -0.6, rot: 0, use: { kind: "events" }, label: "Check in 🎟️" },
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
  // ---- Tower offices (owner, Oct 31: "offices with multiple floors, swanky design, cubicles, display glass, robots... for big
  // technology or media companies"). Big companies get a tower (TOWERS below): a lobby, then floors up the elevator. The
  // elevator doors on each floor are added by towerElevators. ----
  // The lobby: marble, a reception desk with a robot greeter, glass display cases and a lounge behind a glass wall.
  towerLobby: {
    id: "towerLobby", w: 11.0, d: 9.0, wall: "#E9ECF1", wallAccent: "#6C8CFF", floor: "#E4E1DA", floorKind: "tile", window: true, alwaysLit: true,
    items: [
      { id: "reception", kind: "storeCounter", x: 0.6, z: -2.6, rot: 0, color: "#1F1B26", use: MAIN(0), label: "*" },
      { id: "greeter", kind: "robot", x: 2.4, z: -2.2, rot: 2, color: "#7FE0FF" },
      { id: "case-1", kind: "displayCase", x: -3.6, z: -0.6, rot: 0, color: "#7FE0FF" },
      { id: "case-2", kind: "displayCase", x: -3.6, z: 1.2, rot: 0, color: "#C08BFF" },
      { id: "case-3", kind: "displayCase", x: -1.8, z: 0.3, rot: 0, color: "#3DDC97" },
      { id: "glass", kind: "glassWall", x: 2.4, z: 2.4, rot: 1 },
      { id: "sofa", kind: "sofa", x: 4.2, z: 3.8, rot: 2, color: "#2A2F3A", use: { kind: "sit" }, label: "Sit" },
      { id: "table", kind: "coffeeTable", x: 4.2, z: 2.8, rot: 0 },
      { id: "chair-1", kind: "armchair", x: 4.6, z: 1.3, rot: 3, color: "#6C8CFF" },
      { id: "plant-1", kind: "plant", x: 5.0, z: -4.0, rot: 0 },
      { id: "plant-2", kind: "plant", x: -5.0, z: 4.0, rot: 0 },
      { id: "plant-3", kind: "plant", x: 3.2, z: -4.0, rot: 0 },
    ],
    spawn: [0.0, 3.6],
    npcs: [{ x: 0.6, z: -3.15, facing: 0 }, { x: -2.6, z: 1.6, facing: -2.2 }, { x: 1.2, z: 0.9, facing: 2.6 }, { x: 4.2, z: 3.75, facing: 3.14, seated: true }],
  },
  // The open floor: a dozen cubicles in two blocks, server racks humming at the back, robots on patrol, a coffee point.
  techFloor: {
    id: "techFloor", w: 12.0, d: 9.5, wall: "#E6EAF0", wallAccent: "#6C8CFF", floor: "#BFC6D1", floorKind: "concrete", window: true, alwaysLit: true,
    items: [
      { id: "cube-1", kind: "cubicle", x: -4.6, z: -1.9, rot: 0, color: "#8B95A6" },
      { id: "cube-2", kind: "cubicle", x: -2.95, z: -1.9, rot: 0, color: "#8B95A6" },
      { id: "cube-3", kind: "cubicle", x: -1.3, z: -1.9, rot: 0, color: "#8B95A6" },
      { id: "cube-4", kind: "cubicle", x: -4.6, z: -0.35, rot: 0, color: "#8B95A6" },
      { id: "cube-5", kind: "cubicle", x: -2.95, z: -0.35, rot: 0, color: "#8B95A6" },
      { id: "cube-6", kind: "cubicle", x: -1.3, z: -0.35, rot: 0, color: "#8B95A6" },
      { id: "cube-7", kind: "cubicle", x: 1.3, z: -1.9, rot: 0, color: "#6C8CFF" },
      { id: "cube-8", kind: "cubicle", x: 2.95, z: -1.9, rot: 0, color: "#6C8CFF" },
      { id: "cube-9", kind: "cubicle", x: 4.6, z: -1.9, rot: 0, color: "#6C8CFF" },
      { id: "cube-10", kind: "cubicle", x: 1.3, z: -0.35, rot: 0, color: "#6C8CFF" },
      { id: "cube-11", kind: "cubicle", x: 2.95, z: -0.35, rot: 0, color: "#6C8CFF" },
      { id: "cube-12", kind: "cubicle", x: 4.6, z: -0.35, rot: 0, color: "#6C8CFF" },
      { id: "rack-1", kind: "serverRack", x: 2.6, z: -4.35, rot: 0 },
      { id: "rack-2", kind: "serverRack", x: 3.5, z: -4.35, rot: 0 },
      { id: "rack-3", kind: "serverRack", x: 4.4, z: -4.35, rot: 0 },
      { id: "bot-1", kind: "robot", x: 0.0, z: 1.6, rot: 2 },
      { id: "bot-2", kind: "robot", x: -3.0, z: 2.8, rot: 1, color: "#FF6A3D" },
      { id: "kitchen", kind: "kitchen", x: 4.4, z: 4.35, rot: 2 },
      { id: "cooler", kind: "drinksFridge", x: 5.55, z: 2.6, rot: 3 },
      { id: "sofa", kind: "sofa", x: -4.6, z: 4.25, rot: 2, color: "#6C8CFF", use: { kind: "sit" }, label: "Sit" },
      { id: "plant-1", kind: "plant", x: 5.6, z: -4.3, rot: 0 },
      { id: "plant-2", kind: "plant", x: 1.6, z: 4.3, rot: 0 },
    ],
    spawn: [-4.0, -3.2],
    npcs: [
      { x: -4.6, z: -1.55, facing: 3.14, seated: true }, { x: -2.95, z: -1.55, facing: 3.14, seated: true }, { x: -1.3, z: -1.55, facing: 3.14, seated: true }, { x: 1.3, z: -1.55, facing: 3.14, seated: true }, { x: 2.95, z: -1.55, facing: 3.14, seated: true }, { x: 4.6, z: -1.55, facing: 3.14, seated: true }, { x: -4.6, z: 0.0, facing: 3.14, seated: true }, { x: -2.95, z: 0.0, facing: 3.14, seated: true }, { x: -1.3, z: 0.0, facing: 3.14, seated: true },
      { x: 4.0, z: 3.5, facing: 0.4 }, { x: 4.9, z: 3.4, facing: -0.8 }, { x: 0.0, z: -3.4, facing: 1.2 },
    ],
  },
  // The executive floor: a glass-walled boardroom with a video wall, a corner office with display cases, a robot butler and
  // a lounge with a view.
  execFloor: {
    id: "execFloor", w: 11.0, d: 9.0, wall: "#1E2433", wallAccent: "#7FE0FF", floor: "#5A4636", floorKind: "wood", window: true, alwaysLit: true,
    items: [
      { id: "glass-side", kind: "glassWall", x: 0.9, z: -2.9, rot: 1 },
      { id: "glass-front", kind: "glassWall", x: 2.55, z: -1.35, rot: 0 },
      { id: "wall-screen", kind: "bigScreen", x: 3.0, z: -4.3, rot: 0 },
      { id: "board", kind: "diningTable", x: 2.6, z: -3.0, rot: 0 },
      { id: "board-1", kind: "chair", x: 1.75, z: -3.0, rot: 1 },
      { id: "board-2", kind: "chair", x: 3.45, z: -3.0, rot: 3 },
      { id: "board-3", kind: "chair", x: 2.6, z: -2.25, rot: 2 },
      { id: "desk", kind: "desk", x: -2.4, z: 0.4, rot: 0, color: "#1F1B26" },
      { id: "desk-chair", kind: "armchair", x: -2.4, z: 1.3, rot: 2, color: "#2A2F3A", use: { kind: "sit" }, label: "Sit in the big chair" },
      { id: "case-1", kind: "displayCase", x: -4.7, z: -0.4, rot: 1, color: "#C08BFF" },
      { id: "case-2", kind: "displayCase", x: -4.7, z: 1.2, rot: 1, color: "#7FE0FF" },
      { id: "butler", kind: "robot", x: -0.4, z: 2.2, rot: 2, color: "#C08BFF" },
      { id: "sofa", kind: "sofa", x: 3.2, z: 3.8, rot: 2, color: "#2A2F3A", use: { kind: "sit" }, label: "Sit" },
      { id: "armchair", kind: "armchair", x: 4.8, z: 2.4, rot: 3, color: "#6C8CFF" },
      { id: "table", kind: "coffeeTable", x: 3.2, z: 2.8, rot: 0 },
      { id: "art", kind: "painting", x: -0.8, z: -4.4, rot: 0, color: "#C9CDD4" },
      { id: "plant-1", kind: "plant", x: -5.0, z: 4.0, rot: 0 },
      { id: "plant-2", kind: "plant", x: 5.0, z: -0.6, rot: 0 },
    ],
    spawn: [-3.8, -3.0],
    npcs: [
      { x: 1.75, z: -3.0, facing: 1.57, seated: true }, { x: 3.45, z: -3.0, facing: -1.57, seated: true },
      { x: -2.4, z: 1.3, facing: 3.14, seated: true }, { x: 2.6, z: 2.6, facing: 2.4 }, { x: 4.0, z: 0.8, facing: -2.6 },
    ],
  },
  // A media newsroom: cubicles facing a wall of screens, a camera on its dolly and a robot running tapes.
  newsroom: {
    id: "newsroom", w: 12.0, d: 9.5, wall: "#2A2530", wallAccent: "#FF2E88", floor: "#3A3440", floorKind: "tile", window: true, alwaysLit: true,
    items: [
      { id: "screen-1", kind: "bigScreen", x: 1.4, z: -4.55, rot: 0 },
      { id: "screen-2", kind: "bigScreen", x: 4.0, z: -2.5, rot: 1 },
      { id: "on-air", kind: "onAirSign", x: -1.2, z: -4.6, rot: 0 },
      { id: "cube-1", kind: "cubicle", x: -4.6, z: -1.6, rot: 0, color: "#5A4A6E" },
      { id: "cube-2", kind: "cubicle", x: -2.95, z: -1.6, rot: 0, color: "#5A4A6E" },
      { id: "cube-3", kind: "cubicle", x: -1.3, z: -1.6, rot: 0, color: "#5A4A6E" },
      { id: "cube-4", kind: "cubicle", x: -4.6, z: 0.0, rot: 0, color: "#5A4A6E" },
      { id: "cube-5", kind: "cubicle", x: -2.95, z: 0.0, rot: 0, color: "#5A4A6E" },
      { id: "cube-6", kind: "cubicle", x: -1.3, z: 0.0, rot: 0, color: "#5A4A6E" },
      { id: "cube-7", kind: "cubicle", x: -4.6, z: 1.55, rot: 0, color: "#FF6A3D" },
      { id: "cube-8", kind: "cubicle", x: -2.95, z: 1.55, rot: 0, color: "#FF6A3D" },
      { id: "camera", kind: "tvCamera", x: 1.8, z: -1.0, rot: 0 },
      { id: "ring", kind: "ringLight", x: 3.2, z: 0.6, rot: 3 },
      { id: "anchor-desk", kind: "desk", x: 1.6, z: 1.2, rot: 0, color: "#FF2E88" },
      { id: "anchor-chair", kind: "chair", x: 1.6, z: 1.95, rot: 2 },
      { id: "bot", kind: "robot", x: 0.2, z: 3.0, rot: 2, color: "#FF2E88" },
      { id: "sofa", kind: "sofa", x: 4.4, z: 4.25, rot: 2, color: "#FF6A3D", use: { kind: "sit" }, label: "Sit" },
      { id: "cooler", kind: "drinksFridge", x: 5.55, z: 2.2, rot: 3 },
      { id: "plant-1", kind: "plant", x: -5.6, z: 4.3, rot: 0 },
      { id: "plant-2", kind: "plant", x: 5.6, z: -4.3, rot: 0 },
    ],
    spawn: [-4.0, -3.2],
    npcs: [
      { x: -4.6, z: -1.25, facing: 3.14, seated: true }, { x: -2.95, z: -1.25, facing: 3.14, seated: true }, { x: -1.3, z: -1.25, facing: 3.14, seated: true }, { x: -4.6, z: 0.35, facing: 3.14, seated: true }, { x: -2.95, z: 0.35, facing: 3.14, seated: true }, { x: -1.3, z: 0.35, facing: 3.14, seated: true },
      { x: 1.6, z: 1.95, facing: 3.14, seated: true }, { x: 2.5, z: -1.2, facing: -0.6 }, { x: 4.6, z: 3.2, facing: 2.6 },
    ],
  },
  // The Glow Up House (Streaming): a content house's main room. Streaming desks with ring lights and glowing screens along the
  // back, an arcade corner, a giant screen for the house channel and a couch that's been in eleven thumbnails.
  streamHouse: {
    id: "streamHouse", w: 10.0, d: 8.0, wall: "#1C1830", wallAccent: "#B14BFF", floor: "#2A2440", floorKind: "concrete", dark: true,
    items: [
      { id: "stream-desk", kind: "desk", x: -3.0, z: -3.3, rot: 0, color: "#1F1B26", use: MAIN(0), label: "*" },
      { id: "stream-chair", kind: "chair", x: -3.0, z: -2.55, rot: 2 },
      { id: "ring-1", kind: "ringLight", x: -4.2, z: -2.5, rot: 0 },
      { id: "desk-2", kind: "desk", x: -0.8, z: -3.3, rot: 0, color: "#1F1B26" },
      { id: "chair-2", kind: "chair", x: -0.8, z: -2.55, rot: 2 },
      { id: "screen", kind: "bigScreen", x: 2.7, z: -3.7, rot: 0 },
      { id: "arcade-1", kind: "arcade", x: 4.3, z: -1.5, rot: 3 },
      { id: "arcade-2", kind: "arcade", x: 4.3, z: -0.4, rot: 3 },
      { id: "couch", kind: "sofa", x: 1.6, z: 1.8, rot: 2, color: "#B14BFF", use: MAIN(1), label: "*" },
      { id: "table", kind: "coffeeTable", x: 1.6, z: 0.8, rot: 0 },
      { id: "ring-2", kind: "ringLight", x: -2.4, z: 1.2, rot: 1 },
      { id: "rug", kind: "rug", x: -3.4, z: 1.2, rot: 1, color: "#3DF2FF" },
      { id: "plant", kind: "plant", x: 4.4, z: 3.3, rot: 0 },
      { id: "fridge", kind: "drinksFridge", x: 4.45, z: 1.8, rot: 3 },
    ],
    spawn: [-1.0, 3.2],
    npcs: [{ x: -3.0, z: -2.55, facing: 3.14, seated: true }, { x: -0.8, z: -2.55, facing: 3.14, seated: true }, { x: 3.4, z: -1.0, facing: 1.57 }, { x: 1.2, z: 1.8, facing: 3.14, seated: true }],
  },
  // The Glow Up House's stream floor (owner, Oct 31: "a content house that serves as an office"): streaming booths in rows,
  // ring lights, the producer's desk under the week's stream schedule, and the servers that keep everyone live.
  streamFloor: {
    id: "streamFloor", w: 12.0, d: 9.5, wall: "#1C1830", wallAccent: "#B14BFF", floor: "#2A2440", floorKind: "concrete", dark: true,
    items: [
      { id: "booth-1", kind: "cubicle", x: -4.6, z: -1.9, rot: 0, color: "#B14BFF" },
      { id: "booth-2", kind: "cubicle", x: -2.95, z: -1.9, rot: 0, color: "#B14BFF" },
      { id: "booth-3", kind: "cubicle", x: -1.3, z: -1.9, rot: 0, color: "#B14BFF" },
      { id: "booth-4", kind: "cubicle", x: 0.35, z: -1.9, rot: 0, color: "#B14BFF" },
      { id: "booth-5", kind: "cubicle", x: -4.6, z: -0.35, rot: 0, color: "#B14BFF" },
      { id: "booth-6", kind: "cubicle", x: -2.95, z: -0.35, rot: 0, color: "#B14BFF" },
      { id: "booth-7", kind: "cubicle", x: -1.3, z: -0.35, rot: 0, color: "#B14BFF" },
      { id: "booth-8", kind: "cubicle", x: 0.35, z: -0.35, rot: 0, color: "#B14BFF" },
      { id: "schedule", kind: "chalkboard", x: 3.6, z: -4.45, rot: 0 },
      { id: "producer", kind: "desk", x: 3.6, z: -2.9, rot: 0, color: "#1F1B26" },
      { id: "producer-chair", kind: "chair", x: 3.6, z: -2.15, rot: 2 },
      { id: "rack-1", kind: "serverRack", x: 5.55, z: -0.6, rot: 3 },
      { id: "rack-2", kind: "serverRack", x: 5.55, z: 0.4, rot: 3 },
      { id: "ring-1", kind: "ringLight", x: -4.6, z: 1.4, rot: 2 },
      { id: "ring-2", kind: "ringLight", x: -1.3, z: 1.4, rot: 2 },
      { id: "ring-3", kind: "ringLight", x: 2.0, z: 0.6, rot: 3 },
      { id: "beanbag", kind: "armchair", x: 3.4, z: 3.6, rot: 2, color: "#3DF2FF", use: { kind: "sit" }, label: "Sit" },
      { id: "sofa", kind: "sofa", x: 0.6, z: 4.25, rot: 2, color: "#B14BFF", use: { kind: "sit" }, label: "Sit" },
      { id: "fridge", kind: "drinksFridge", x: 5.55, z: 3.0, rot: 3 },
      { id: "plant", kind: "plant", x: -5.6, z: 4.3, rot: 0 },
    ],
    spawn: [-3.6, 3.2],
    npcs: [{ x: -4.6, z: -1.55, facing: 3.14, seated: true }, { x: -2.95, z: -1.55, facing: 3.14, seated: true }, { x: -1.3, z: -1.55, facing: 3.14, seated: true }, { x: 0.35, z: -1.55, facing: 3.14, seated: true }, { x: -4.6, z: 0.0, facing: 3.14, seated: true }, { x: -2.95, z: 0.0, facing: 3.14, seated: true }, { x: -1.3, z: 0.0, facing: 3.14, seated: true }, { x: 0.35, z: 0.0, facing: 3.14, seated: true }, { x: 3.6, z: -2.15, facing: 3.14, seated: true }, { x: 2.6, z: 2.2, facing: 2.4 }],
  },
  // Queensboro Capital's trading floor (Finance): rows of black desks back to back, a wall of tickers, the corner where the
  // big trades happen, and a robot that brings espresso nobody has time to drink.
  tradingFloor: {
    id: "tradingFloor", w: 12.0, d: 9.5, wall: "#E6E9EE", wallAccent: "#2FA36B", floor: "#BFC6D1", floorKind: "concrete", window: true, alwaysLit: true,
    items: [
      { id: "desk-1", kind: "desk", x: -4.4, z: -1.0, rot: 0, color: "#1F1B26" },
      { id: "chair-1", kind: "chair", x: -4.4, z: -0.25, rot: 2 },
      { id: "desk-2", kind: "desk", x: -3.0, z: -1.0, rot: 0, color: "#1F1B26" },
      { id: "chair-2", kind: "chair", x: -3.0, z: -0.25, rot: 2 },
      { id: "desk-3", kind: "desk", x: -1.6, z: -1.0, rot: 0, color: "#1F1B26" },
      { id: "chair-3", kind: "chair", x: -1.6, z: -0.25, rot: 2 },
      { id: "desk-4", kind: "desk", x: -4.4, z: -1.7, rot: 2, color: "#1F1B26" },
      { id: "chair-4", kind: "chair", x: -4.4, z: -2.45, rot: 0 },
      { id: "desk-5", kind: "desk", x: -3.0, z: -1.7, rot: 2, color: "#1F1B26" },
      { id: "chair-5", kind: "chair", x: -3.0, z: -2.45, rot: 0 },
      { id: "desk-6", kind: "desk", x: -1.6, z: -1.7, rot: 2, color: "#1F1B26" },
      { id: "chair-6", kind: "chair", x: -1.6, z: -2.45, rot: 0 },
      { id: "desk-7", kind: "desk", x: -4.4, z: 1.8, rot: 0, color: "#1F1B26" },
      { id: "chair-7", kind: "chair", x: -4.4, z: 2.55, rot: 2 },
      { id: "desk-8", kind: "desk", x: -3.0, z: 1.8, rot: 0, color: "#1F1B26" },
      { id: "chair-8", kind: "chair", x: -3.0, z: 2.55, rot: 2 },
      { id: "desk-9", kind: "desk", x: -1.6, z: 1.8, rot: 0, color: "#1F1B26" },
      { id: "chair-9", kind: "chair", x: -1.6, z: 2.55, rot: 2 },
      { id: "desk-10", kind: "desk", x: -4.4, z: 1.1, rot: 2, color: "#1F1B26" },
      { id: "chair-10", kind: "chair", x: -4.4, z: 0.35, rot: 0 },
      { id: "desk-11", kind: "desk", x: -3.0, z: 1.1, rot: 2, color: "#1F1B26" },
      { id: "chair-11", kind: "chair", x: -3.0, z: 0.35, rot: 0 },
      { id: "desk-12", kind: "desk", x: -1.6, z: 1.1, rot: 2, color: "#1F1B26" },
      { id: "chair-12", kind: "chair", x: -1.6, z: 0.35, rot: 0 },
      { id: "tickers-1", kind: "bigScreen", x: 2.0, z: -4.55, rot: 0 },
      { id: "tickers-2", kind: "bigScreen", x: 5.8, z: -1.8, rot: 1 },
      { id: "trader-desk", kind: "desk", x: 2.6, z: -2.0, rot: 0, color: "#2FA36B" },
      { id: "trader-chair", kind: "armchair", x: 2.6, z: -1.1, rot: 2, color: "#1F1B26" },
      { id: "rack", kind: "serverRack", x: 4.4, z: -4.35, rot: 0 },
      { id: "bot", kind: "robot", x: 1.0, z: 2.6, rot: 2, color: "#2FA36B" },
      { id: "glass", kind: "glassWall", x: 3.4, z: 1.4, rot: 0 },
      { id: "sofa", kind: "sofa", x: 3.4, z: 3.6, rot: 2, color: "#1F1B26", use: { kind: "sit" }, label: "Sit" },
      { id: "cooler", kind: "drinksFridge", x: 5.55, z: 2.7, rot: 3 },
      { id: "plant", kind: "plant", x: -5.6, z: 4.3, rot: 0 },
    ],
    spawn: [-4.4, 3.8],
    npcs: [{ x: -4.4, z: -0.25, facing: 3.14, seated: true }, { x: -3.0, z: -2.45, facing: 0, seated: true }, { x: -1.6, z: -0.25, facing: 3.14, seated: true }, { x: -4.4, z: 2.55, facing: 3.14, seated: true }, { x: -1.6, z: 0.35, facing: 0, seated: true }, { x: -3.0, z: 2.55, facing: 3.14, seated: true }, { x: 2.6, z: -1.1, facing: 3.14, seated: true }, { x: 4.4, z: 0.4, facing: -2.2 }],
  },
  // Whitlock & Hale LLP (Law): a wall of law books, the long conference table, two partners' desks with green lamps and
  // reception by the door. Worn leather, billable silence.
  lawOffice: {
    id: "lawOffice", w: 10.0, d: 8.0, wall: "#E9E2D6", wallAccent: "#2F4A3A", floor: "#7A5236", floorKind: "wood", window: true,
    items: [
      { id: "reception", kind: "storeCounter", x: -2.8, z: 2.6, rot: 2, color: "#3A2A1E", use: MAIN(0), label: "*" },
      { id: "books-1", kind: "bookshelf", x: -4.0, z: -3.75, rot: 0 },
      { id: "books-2", kind: "bookshelf", x: -2.9, z: -3.75, rot: 0 },
      { id: "books-3", kind: "bookshelf", x: -1.8, z: -3.75, rot: 0 },
      { id: "books-4", kind: "bookshelf", x: -0.7, z: -3.75, rot: 0 },
      { id: "table-1", kind: "diningTable", x: -2.4, z: -1.5, rot: 0, color: "#4A2E1E", use: MAIN(1), label: "*" },
      { id: "table-2", kind: "diningTable", x: -1.2, z: -1.5, rot: 0, color: "#4A2E1E" },
      { id: "seat-1", kind: "chair", x: -2.4, z: -2.3, rot: 0 },
      { id: "seat-2", kind: "chair", x: -1.2, z: -2.3, rot: 0 },
      { id: "seat-3", kind: "chair", x: -2.4, z: -0.7, rot: 2 },
      { id: "seat-4", kind: "chair", x: -1.2, z: -0.7, rot: 2 },
      { id: "partner-1", kind: "desk", x: 2.6, z: -3.3, rot: 0, color: "#3A2A1E" },
      { id: "partner-chair-1", kind: "armchair", x: 2.6, z: -2.4, rot: 2, color: "#7A2E3A" },
      { id: "lamp-1", kind: "floorLamp", x: 3.6, z: -3.5, rot: 0 },
      { id: "partner-2", kind: "desk", x: 3.9, z: 0.2, rot: 3, color: "#3A2A1E" },
      { id: "partner-chair-2", kind: "armchair", x: 3.0, z: 0.2, rot: 1, color: "#7A2E3A" },
      { id: "sofa", kind: "sofa", x: 1.8, z: 3.3, rot: 2, color: "#7A2E3A", use: { kind: "sit" }, label: "Sit" },
      { id: "plant", kind: "plant", x: 4.4, z: 3.3, rot: 0 },
    ],
    spawn: [0.0, 3.0],
    npcs: [{ x: -2.8, z: 2.05, facing: 0 }, { x: -2.4, z: -2.3, facing: 0, seated: true }, { x: -1.2, z: -0.7, facing: 3.14, seated: true }, { x: 2.6, z: -2.4, facing: 3.14, seated: true }],
  },
  // Pablo's Discount Luggage & Notary (the underworld, owner Oct 31): a dusty luggage counter by the door that has never
  // sold a suitcase, shelves of them nobody may touch ("load-bearing"), and the back room's card table under one lamp.
  backRoom: {
    id: "backRoom", w: 6.0, d: 5.0, wall: "#5A4636", wallAccent: "#B8862E", floor: "#6B5A48", floorKind: "wood", window: false,
    items: [
      { id: "counter", kind: "storeCounter", x: -0.6, z: 1.6, rot: 2, color: "#7A4E2A", use: MAIN(0), label: "*" },
      { id: "luggage-1", kind: "shelf", x: -2.55, z: -1.25, rot: 1 },
      { id: "luggage-2", kind: "shelf", x: -2.55, z: 0.9, rot: 1 },
      { id: "wardrobe", kind: "wardrobe", x: -1.5, z: -2.15, rot: 0, color: "#4A3526" },
      { id: "rug", kind: "rug", x: 1.2, z: -0.8, rot: 0, color: "#7A2E3A" },
      { id: "card-table", kind: "diningTable", x: 1.2, z: -0.8, rot: 0, color: "#2F4A3A", use: MAIN(1), label: "*" },
      { id: "seat-1", kind: "chair", x: 0.3, z: -0.8, rot: 1 },
      { id: "seat-2", kind: "chair", x: 1.2, z: 0.0, rot: 2 },
      { id: "pablo-chair", kind: "armchair", x: 2.3, z: -0.8, rot: 3, color: "#8A2E2E" },
      { id: "lamp", kind: "floorLamp", x: 2.5, z: -2.1, rot: 0 },
      { id: "plant", kind: "plant", x: 2.5, z: 2.0, rot: 0 },
    ],
    spawn: [1.4, 1.9],
    npcs: [{ x: 2.3, z: -0.8, facing: -1.57, seated: true }, { x: -0.6, z: 1.05, facing: 0 }],
  },
  // Atelier Vernon (Fashion): racks of samples, cutting tables, a mirror wall, a runway down the middle and a lit fitting
  // corner where a ring light lives.
  atelier: {
    id: "atelier", w: 10.0, d: 8.0, wall: "#F2EDE6", wallAccent: "#C9A27A", floor: "#D8CFC2", floorKind: "concrete", window: true, alwaysLit: true,
    items: [
      { id: "runway", kind: "rug", x: 0.0, z: 0.4, rot: 1, color: "#1F1B26", use: MAIN(0), label: "*" },
      { id: "rack-1", kind: "clothesRack", x: -3.6, z: -3.4, rot: 0 },
      { id: "rack-2", kind: "clothesRack", x: -1.6, z: -3.4, rot: 0 },
      { id: "rack-3", kind: "clothesRack", x: 4.4, z: 0.4, rot: 3 },
      { id: "table-1", kind: "displayTable", x: -3.4, z: -0.6, rot: 0, use: MAIN(1), label: "*" },
      { id: "table-2", kind: "displayTable", x: -3.4, z: 1.2, rot: 0 },
      { id: "mirror-1", kind: "mirror", x: 1.4, z: -3.65, rot: 0 },
      { id: "mirror-2", kind: "mirror", x: 2.5, z: -3.65, rot: 0 },
      { id: "mirror-3", kind: "mirror", x: 3.6, z: -3.65, rot: 0 },
      { id: "ring", kind: "ringLight", x: 2.6, z: -2.2, rot: 2 },
      { id: "sofa", kind: "sofa", x: 2.6, z: 3.3, rot: 2, color: "#C9A27A", use: { kind: "sit" }, label: "Sit" },
      { id: "plant-1", kind: "plant", x: -4.4, z: 3.3, rot: 0 },
      { id: "plant-2", kind: "plant", x: 4.4, z: -3.3, rot: 0 },
    ],
    spawn: [-1.6, 3.2],
    npcs: [{ x: 0.0, z: -1.6, facing: 0 }, { x: -2.6, z: -0.6, facing: -1.57 }, { x: 2.6, z: -1.4, facing: 3.14 }, { x: 0.0, z: 1.8, facing: 3.14 }],
  },
  // Office sizes (owner, Oct 31: "different office sizes… depending on the size of the company"). The small one: two desks
  // shoved together, a mini fridge and nowhere to stand (a storefront campaign office, a tiny startup).
  // ---- Campaign HQ (owner, Nov 20: "spacious floors, with great furniture"; the competitor's houses as the reference) ----
  // A three-floor building, 20 × 14 m a floor (the old storefront was 5 × 4.4): full-height walls between rooms, bright tile,
  // recessed spotlights, pendant lamps, art and plants; volunteers and staff at work. Ground floor: reception, the phone bank,
  // the volunteers' kitchen and the press room.
  campaignGround: {
    id: "campaignGround", w: 20, d: 14, wall: "#F4F2EE", wallAccent: "#C62C3B", floor: "#ECE8E1", floorKind: "tile", window: true, alwaysLit: true,
    tallWalls: true, spotlights: true,
    rooms: [
      { name: "Phone bank", x0: -10, z0: -7, x1: -3, z1: 7, floor: "#C9D1DC", floorKind: "concrete" },
      { name: "Kitchen", x0: -3, z0: -7, x1: 5, z1: 1, floor: "#D8BE98", floorKind: "wood" },
      { name: "Reception", x0: -3, z0: 1, x1: 5, z1: 7, floor: "#EFEBE4", floorKind: "tile" },
      { name: "Press room", x0: 5, z0: -7, x1: 10, z1: 2, floor: "#7E5A3C", floorKind: "wood" },
    ],
    walls: [[-3, -7, -3, -2.2], [-3, -0.6, -3, 3.2], [-3, 4.8, -3, 7], [-3, 1, 0.2, 1], [1.8, 1, 5, 1], [5, -7, 5, -3.6], [5, -2, 5, 2], [5, 2, 6.6, 2]],
    items: [
      // Reception: the front desk (Campaign HQ itself), a waiting corner, flags and the candidates' banner.
      { id: "reception", kind: "storeCounter", x: 1.0, z: 4.0, rot: 0, color: "#F4F2EE", use: { kind: "campaign" }, label: "🗳️ Campaign HQ", model: "receptionDesk" },
      { id: "banner-rec", kind: "campaignBanner", x: 1.0, z: 1.12, rot: 0 },
      { id: "flag-1", kind: "flagStand", x: -1.9, z: 1.6, rot: 0 },
      { id: "flag-2", kind: "flagStand", x: 3.9, z: 1.6, rot: 0 },
      { id: "wait-1", kind: "armchair", x: -2.2, z: 3.8, rot: 1, color: "#2F4A7A", model: "k:loungeDesignChair" },
      { id: "wait-2", kind: "armchair", x: -2.2, z: 5.0, rot: 1, color: "#2F4A7A", model: "k:loungeDesignChair" },
      { id: "wait-table", kind: "coffeeTable", x: -1.1, z: 4.4, rot: 1, model: "k:tableCoffeeGlass" },
      { id: "rec-rug", kind: "rug", x: -1.3, z: 4.4, rot: 1, color: "#C62C3B" },
      { id: "plant-door", kind: "plant", x: 4.4, z: 6.4, rot: 0, model: "k:plantSmall1" },
      { id: "chandelier-rec", kind: "chandelier", x: 1.0, z: 3.0, rot: 0, model: "chandelier" },
      // The phone bank: four long tables of volunteers, a banner over them, a whiteboard of call targets.
      ...[-5.3, -2.8, -0.3, 2.2].flatMap((z, row) => [
        { id: `bank-${row}`, kind: "phoneBank" as const, x: -6.5, z, rot: 0, ...(row === 1 ? { use: MAIN(0), label: "*" } : {}) },
        ...[-0.85, 0, 0.85].map((dx, i) => ({ id: `bank-chair-${row}-${i}`, kind: "chair" as const, x: -6.5 + dx, z: z + 0.75, rot: 2, model: "k:chairDesk" })),
      ]),
      { id: "banner-bank", kind: "campaignBanner", x: -6.5, z: -6.92, rot: 0 },
      { id: "board-bank", kind: "chalkboard", x: -9.85, z: 0.0, rot: 1 },
      { id: "plant-bank-1", kind: "plant", x: -9.5, z: 6.4, rot: 0, model: "k:plantSmall2" },
      { id: "plant-bank-2", kind: "plant", x: -3.6, z: -6.5, rot: 0, model: "k:plantSmall1" },
      { id: "lamp-bank-1", kind: "pendantLamp", x: -6.5, z: -4.0, rot: 0 },
      { id: "lamp-bank-2", kind: "pendantLamp", x: -6.5, z: 1.0, rot: 0 },
      // The volunteers' kitchen: cold pizza on the big table, coffee, the water cooler and a sofa for the night shift.
      { id: "kitchen", kind: "kitchen", x: 1.0, z: -6.62, rot: 0 },
      { id: "fridge", kind: "fridge", x: 3.8, z: -6.55, rot: 0, model: "k:kitchenFridgeLarge" },
      { id: "cooler", kind: "waterCooler", x: -2.5, z: -6.5, rot: 0 },
      { id: "pizza-table", kind: "diningTable", x: 1.0, z: -3.6, rot: 0 },
      ...[[-0.5, -4.4, 0], [0.5, -4.4, 0], [1.5, -4.4, 0], [-0.5, -2.8, 2], [0.5, -2.8, 2], [1.5, -2.8, 2]].map(([x, z, rot], i) => ({ id: `pizza-chair-${i}`, kind: "chair" as const, x: x + 0.5 - 0.5, z, rot })),
      { id: "kitchen-sofa", kind: "sofa", x: 3.6, z: -0.4, rot: 2, color: "#C62C3B", model: "k:loungeSofa" },
      { id: "art-kitchen", kind: "painting", x: -1.6, z: -6.92, rot: 0, art: "/art/art-rent-is-due.webp" },
      { id: "lamp-kitchen", kind: "pendantLamp", x: 1.0, z: -3.6, rot: 0 },
      // The press room: the step-and-repeat, the podium, the cameras and rows of reporters' chairs.
      { id: "backdrop", kind: "pressBackdrop", x: 7.5, z: -6.82, rot: 0 },
      { id: "podium", kind: "lectern", x: 7.5, z: -5.7, rot: 0, use: MAIN(1), label: "*", model: "podium" },
      { id: "press-flag-1", kind: "flagStand", x: 5.7, z: -6.3, rot: 0 },
      { id: "press-flag-2", kind: "flagStand", x: 9.3, z: -6.3, rot: 0 },
      ...[-3.6, -2.4, -1.2].flatMap((z, row) => [6.3, 7.5, 8.7].map((x, i) => ({ id: `press-chair-${row}-${i}`, kind: "chair" as const, x, z, rot: 2, model: "k:chairRounded" }))),
      { id: "press-cam", kind: "tvCamera", x: 9.3, z: 0.6, rot: 2 },
      { id: "press-light", kind: "ringLight", x: 5.8, z: 0.6, rot: 2 },
    ],
    spawn: [1.0, 6.2],
    npcs: [
      { x: -7.35, z: -4.55, facing: 3.14, seated: true }, { x: -5.65, z: -4.55, facing: 3.14, seated: true },
      { x: -6.5, z: -2.05, facing: 3.14, seated: true }, { x: -7.35, z: 0.45, facing: 3.14, seated: true },
      { x: -5.65, z: 0.45, facing: 3.14, seated: true }, { x: -6.5, z: 2.95, facing: 3.14, seated: true },
      { x: 1.0, z: 3.2, facing: 0 }, { x: 2.2, z: -2.2, facing: 2.6 }, { x: 0.0, z: -4.4, facing: 0, seated: true },
      { x: 7.5, z: -2.4, facing: 3.14, seated: true }, { x: 8.7, z: -1.2, facing: 3.14, seated: true },
    ],
  },
  // The second floor: the war room (the big table, the poll board, the map), the candidate's office and the staff lounge.
  campaignWar: {
    id: "campaignWar", w: 20, d: 14, wall: "#F4F2EE", wallAccent: "#2F5BBF", floor: "#ECE8E1", floorKind: "tile", window: true, alwaysLit: true,
    tallWalls: true, spotlights: true,
    rooms: [
      { name: "War room", x0: -10, z0: -7, x1: 1, z1: 0, floor: "#3B4558", floorKind: "concrete" },
      { name: "The candidate's office", x0: 1, z0: -7, x1: 10, z1: 0, floor: "#8A6242", floorKind: "wood" },
      { name: "Staff lounge", x0: -10, z0: 0, x1: 10, z1: 7, floor: "#EFEBE4", floorKind: "tile" },
    ],
    walls: [[-10, 0, -6.2, 0], [-4.4, 0, 3.6, 0], [5.4, 0, 10, 0], [1, -7, 1, -3.6], [1, -2, 1, 0]],
    items: [
      // The war room.
      { id: "war-table", kind: "warTable", x: -4.5, z: -3.6, rot: 0, use: { kind: "campaign" }, label: "🗺️ Plan the week" },
      ...[-5.8, -4.5, -3.2].flatMap((x, i) => [
        { id: `war-chair-n-${i}`, kind: "chair" as const, x, z: -4.85, rot: 0, model: "k:chairDesk" },
        { id: `war-chair-s-${i}`, kind: "chair" as const, x, z: -2.35, rot: 2, model: "k:chairDesk" },
      ]),
      { id: "war-chair-w", kind: "chair", x: -6.75, z: -3.6, rot: 1 },
      { id: "poll-board", kind: "pollBoard", x: -4.5, z: -6.85, rot: 0 },
      { id: "war-board", kind: "chalkboard", x: -9.85, z: -3.6, rot: 1 },
      { id: "war-lamp", kind: "pendantLamp", x: -4.5, z: -3.6, rot: 0 },
      { id: "war-plant", kind: "plant", x: 0.4, z: -6.4, rot: 0, model: "k:plantSmall1" },
      // The candidate's office.
      { id: "office-desk", kind: "desk", x: 5.6, z: -5.2, rot: 0, color: "#5A3E2B", model: "execDesk" },
      { id: "office-chair", kind: "chair", x: 5.6, z: -6.0, rot: 0, model: "k:chairDesk" },
      { id: "office-shelf-1", kind: "bookshelf", x: 2.4, z: -6.7, rot: 0 },
      { id: "office-shelf-2", kind: "bookshelf", x: 8.8, z: -6.7, rot: 0 },
      { id: "office-flag-1", kind: "flagStand", x: 4.0, z: -6.4, rot: 0 },
      { id: "office-flag-2", kind: "flagStand", x: 7.2, z: -6.4, rot: 0 },
      { id: "office-art", kind: "painting", x: 5.6, z: -6.92, rot: 0, art: "/art/art-self-made.webp" },
      { id: "office-sofa", kind: "sofa", x: 5.6, z: -1.0, rot: 2, color: "#EDE6D6", use: { kind: "sit" }, label: "Sit", model: "chesterfield" },
      { id: "office-arm-1", kind: "armchair", x: 3.4, z: -2.6, rot: 1, color: "#2F4A7A", model: "k:loungeDesignChair" },
      { id: "office-arm-2", kind: "armchair", x: 7.8, z: -2.6, rot: 3, color: "#2F4A7A", model: "k:loungeDesignChair" },
      { id: "office-table", kind: "coffeeTable", x: 5.6, z: -2.4, rot: 0, model: "k:tableCoffeeGlass" },
      { id: "office-rug", kind: "rug", x: 5.6, z: -2.2, rot: 0, color: "#7A2E3A" },
      { id: "office-lamp", kind: "floorLamp", x: 9.4, z: -1.0, rot: 0 },
      { id: "office-chandelier", kind: "chandelier", x: 5.6, z: -2.6, rot: 0, model: "chandelier" },
      // The staff lounge: a long sofa set, the coffee bar, the TV on the news, plants and art.
      { id: "lounge-tv", kind: "tvStand", x: -9.6, z: 3.5, rot: 1, model: "k:televisionModern" },
      { id: "lounge-sofa", kind: "sectional", x: -6.3, z: 3.6, rot: 3, color: "#EDE6D6", use: { kind: "sit" }, label: "Sit", model: "sectional" },
      { id: "lounge-table", kind: "coffeeTable", x: -8.0, z: 3.6, rot: 1, model: "k:tableCoffeeGlass" },
      { id: "lounge-rug", kind: "rug", x: -8.0, z: 3.6, rot: 1, color: "#C9B79C" },
      { id: "coffee-bar", kind: "kitchenIsland", x: 2.0, z: 3.4, rot: 0, use: MAIN(0), label: "*" },
      ...[1.0, 2.0, 3.0].map((x, i) => ({ id: `bar-stool-${i}`, kind: "barStool" as const, x, z: 4.4, rot: 2 })),
      { id: "lounge-cooler", kind: "waterCooler", x: 9.5, z: 0.6, rot: 0 },
      { id: "lounge-art-1", kind: "painting", x: -9.92, z: 0.9, rot: 1, art: "/art/art-astoria-rooftops.webp" },
      { id: "lounge-plant-1", kind: "plant", x: -9.4, z: 6.4, rot: 0, model: "k:plantSmall2" },
      { id: "lounge-plant-2", kind: "plant", x: 7.6, z: 6.4, rot: 0, model: "k:plantSmall1" },
      { id: "lounge-arm-1", kind: "armchair", x: 6.4, z: 3.0, rot: 2, color: "#C62C3B", model: "k:loungeChair" },
      { id: "lounge-arm-2", kind: "armchair", x: 7.6, z: 3.0, rot: 2, color: "#C62C3B", model: "k:loungeChair" },
      { id: "lounge-lamp-1", kind: "pendantLamp", x: 2.0, z: 3.4, rot: 0 },
      { id: "lounge-chandelier", kind: "chandelier", x: -7.4, z: 3.6, rot: 0, model: "chandelier" },
    ],
    spawn: [8.4, 4.0],
    npcs: [
      { x: -5.8, z: -4.85, facing: 0, seated: true }, { x: -3.2, z: -4.85, facing: 0, seated: true }, { x: -4.5, z: -2.35, facing: 3.14, seated: true },
      { x: -6.75, z: -3.6, facing: 1.57, seated: true }, { x: 5.6, z: -6.0, facing: 0, seated: true },
      { x: -6.6, z: 2.6, facing: -1.57, seated: true }, { x: 2.0, z: 4.4, facing: 3.14, seated: true }, { x: 6.9, z: 4.4, facing: 2.8 },
    ],
  },
  // The rally roof: the stage with the podium and speakers, rows of supporters' chairs, patio tables, string lights.
  campaignRoof: {
    id: "campaignRoof", w: 20, d: 14, wall: "#D9D3C8", wallAccent: "#C62C3B", floor: "#A9A39A", floorKind: "concrete", alwaysLit: true, open: true,
    rooms: [{ name: "Deck", x0: -10, z0: 2.5, x1: 10, z1: 7, floor: "#B98E62", floorKind: "wood" }],
    items: [
      { id: "stage", kind: "rallyStage", x: 0, z: -5.4, rot: 0, use: MAIN(0), label: "*" },
      { id: "speaker-1", kind: "speaker", x: -3.8, z: -5.8, rot: 0 },
      { id: "speaker-2", kind: "speaker", x: 3.8, z: -5.8, rot: 0 },
      { id: "flag-roof-1", kind: "flagStand", x: -5.0, z: -6.3, rot: 0 },
      { id: "flag-roof-2", kind: "flagStand", x: 5.0, z: -6.3, rot: 0 },
      ...[-2.6, -1.4, -0.2, 1.0].flatMap((z, row) => [-3.0, -1.8, -0.6, 0.6, 1.8, 3.0].map((x, i) => ({ id: `rally-chair-${row}-${i}`, kind: "chair" as const, x, z, rot: 2, model: "k:chairRounded" }))),
      { id: "lights-1", kind: "stringLights", x: 0, z: -2.4, rot: 0 },
      { id: "lights-2", kind: "stringLights", x: 0, z: 2.2, rot: 0 },
      ...[[-7.6, 4.2], [-4.6, 5.4], [4.6, 5.4], [7.6, 4.2]].map(([x, z], i) => ({ id: `patio-${i}`, kind: "patioUmbrella" as const, x, z, rot: 0 })),
      { id: "roof-banner-1", kind: "campaignBanner", x: -7.8, z: -6.9, rot: 0 },
      { id: "roof-banner-2", kind: "campaignBanner", x: 7.8, z: -6.9, rot: 0 },
      { id: "roof-plant-1", kind: "plant", x: -9.4, z: -6.4, rot: 0 },
      { id: "roof-plant-2", kind: "plant", x: 9.4, z: -6.4, rot: 0 },
      { id: "roof-plant-3", kind: "plant", x: -9.4, z: 6.4, rot: 0 },
      { id: "roof-plant-4", kind: "plant", x: 9.4, z: 6.4, rot: 0 },
      { id: "roof-bench", kind: "bench", x: 0, z: 6.2, rot: 2 },
    ],
    spawn: [8.4, 0.5],
    npcs: [
      ...[[-3.0, -2.6], [-1.8, -2.6], [0.6, -2.6], [1.8, -2.6], [-0.6, -1.4], [3.0, -1.4], [-1.8, -0.2], [1.8, 1.0]].map(([x, z]) => ({ x, z, facing: 3.14, seated: true })),
      { x: 0, z: -5.2, facing: 0 }, { x: -7.0, z: 3.4, facing: 1.2 }, { x: 4.6, z: 4.6, facing: -2.4 },
    ],
  },
  officeSmall: {
    id: "officeSmall", w: 5.0, d: 4.4, wall: "#EEF0F2", wallAccent: "#5B7FA6", floor: "#BDB6AA", floorKind: "concrete", window: true,
    items: [
      { id: "desk-1", kind: "desk", x: -1.2, z: -1.85, rot: 0, use: MAIN(0), label: "*" },
      { id: "chair-1", kind: "chair", x: -1.2, z: -1.1, rot: 2 },
      { id: "desk-2", kind: "desk", x: 0.4, z: -1.85, rot: 0 },
      { id: "chair-2", kind: "chair", x: 0.4, z: -1.1, rot: 2 },
      { id: "fridge", kind: "fridge", x: 2.0, z: -1.8, rot: 0 },
      { id: "shelf", kind: "bookshelf", x: 2.25, z: -0.5, rot: 1 },
      { id: "desk-3", kind: "desk", x: -1.9, z: 0.6, rot: 1, use: MAIN(1), label: "*" },
      { id: "chair-3", kind: "chair", x: -1.15, z: 0.6, rot: 3 },
      { id: "plant", kind: "plant", x: 2.15, z: 1.85, rot: 0 },
    ],
    spawn: [0.6, 1.6],
    npcs: [{ x: -1.2, z: -1.1, facing: 3.14, seated: true }, { x: 0.4, z: -1.1, facing: 3.14, seated: true }, { x: 1.2, z: 0.2, facing: -2.2 }],
  },
  // The big one: an open-plan floor, two banks of six desks, a meeting table by the whiteboard, a kitchen with a drinks
  // fridge (the water cooler), reception by the door and a lounge corner; coworkers everywhere.
  officeBig: {
    id: "officeBig", w: 12.0, d: 9.5, wall: "#EDF1F4", wallAccent: "#5B7FA6", floor: "#CFC9BE", floorKind: "concrete", window: true, alwaysLit: true,
    items: [
      { id: "reception", kind: "storeCounter", x: -4.2, z: 3.0, rot: 0, use: MAIN(0), label: "*" },
      { id: "desk-1", kind: "desk", x: -4.2, z: -0.25, rot: 0 },
      { id: "chair-1", kind: "chair", x: -4.2, z: 0.5, rot: 2 },
      { id: "desk-2", kind: "desk", x: -4.2, z: -0.95, rot: 2 },
      { id: "chair-2", kind: "chair", x: -4.2, z: -1.7, rot: 0 },
      { id: "desk-3", kind: "desk", x: -2.8, z: -0.25, rot: 0 },
      { id: "chair-3", kind: "chair", x: -2.8, z: 0.5, rot: 2 },
      { id: "desk-4", kind: "desk", x: -2.8, z: -0.95, rot: 2 },
      { id: "chair-4", kind: "chair", x: -2.8, z: -1.7, rot: 0 },
      { id: "desk-5", kind: "desk", x: -1.4, z: -0.25, rot: 0 },
      { id: "chair-5", kind: "chair", x: -1.4, z: 0.5, rot: 2 },
      { id: "desk-6", kind: "desk", x: -1.4, z: -0.95, rot: 2 },
      { id: "chair-6", kind: "chair", x: -1.4, z: -1.7, rot: 0 },
      { id: "desk-7", kind: "desk", x: 1.4, z: -0.25, rot: 0, use: MAIN(1), label: "*" },
      { id: "chair-7", kind: "chair", x: 1.4, z: 0.5, rot: 2 },
      { id: "desk-8", kind: "desk", x: 1.4, z: -0.95, rot: 2 },
      { id: "chair-8", kind: "chair", x: 1.4, z: -1.7, rot: 0 },
      { id: "desk-9", kind: "desk", x: 2.8, z: -0.25, rot: 0 },
      { id: "chair-9", kind: "chair", x: 2.8, z: 0.5, rot: 2 },
      { id: "desk-10", kind: "desk", x: 2.8, z: -0.95, rot: 2 },
      { id: "chair-10", kind: "chair", x: 2.8, z: -1.7, rot: 0 },
      { id: "desk-11", kind: "desk", x: 4.2, z: -0.25, rot: 0 },
      { id: "chair-11", kind: "chair", x: 4.2, z: 0.5, rot: 2 },
      { id: "desk-12", kind: "desk", x: 4.2, z: -0.95, rot: 2 },
      { id: "chair-12", kind: "chair", x: 4.2, z: -1.7, rot: 0 },
      { id: "whiteboard", kind: "chalkboard", x: 0.6, z: -4.45, rot: 0 },
      { id: "meeting", kind: "diningTable", x: 0.6, z: -3.3, rot: 0 },
      { id: "meeting-chair-1", kind: "chair", x: -0.3, z: -3.3, rot: 1 },
      { id: "meeting-chair-2", kind: "chair", x: 1.5, z: -3.3, rot: 3 },
      { id: "meeting-chair-3", kind: "chair", x: 0.6, z: -2.55, rot: 2 },
      { id: "kitchen", kind: "kitchen", x: 4.6, z: -4.35, rot: 0 },
      { id: "cooler", kind: "drinksFridge", x: 5.6, z: -2.9, rot: 3 },
      { id: "shelf-1", kind: "bookshelf", x: -4.2, z: -4.5, rot: 0 },
      { id: "shelf-2", kind: "bookshelf", x: -3.0, z: -4.5, rot: 0 },
      { id: "shelf-3", kind: "bookshelf", x: -5.75, z: -2.0, rot: 1 },
      { id: "sofa", kind: "sofa", x: 4.3, z: 4.0, rot: 2, color: "#5B7FA6", use: { kind: "sit" }, label: "Sit" },
      { id: "table", kind: "coffeeTable", x: 4.3, z: 2.9, rot: 0 },
      { id: "plant-1", kind: "plant", x: -5.6, z: -4.3, rot: 0 },
      { id: "plant-2", kind: "plant", x: -5.6, z: 4.3, rot: 0 },
      { id: "plant-3", kind: "plant", x: 5.6, z: 1.6, rot: 0 },
      { id: "plant-4", kind: "plant", x: 2.45, z: -4.3, rot: 0 },
    ],
    spawn: [0.0, 3.8],
    npcs: [
      { x: -4.2, z: 2.45, facing: 3.14 }, { x: -4.2, z: 0.5, facing: 3.14, seated: true }, { x: -2.8, z: -1.7, facing: 0, seated: true }, { x: -1.4, z: 0.5, facing: 3.14, seated: true }, { x: 1.4, z: -1.7, facing: 0, seated: true }, { x: 2.8, z: 0.5, facing: 3.14, seated: true }, { x: 4.2, z: -1.7, facing: 0, seated: true }, { x: -4.2, z: -1.7, facing: 0, seated: true }, { x: 2.8, z: -1.7, facing: 0, seated: true },
      { x: 0.6, z: -2.55, facing: 3.14, seated: true }, { x: 4.9, z: -3.5, facing: 0.4 }, { x: 4.0, z: -3.4, facing: -0.6 },
    ],
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
const VENUE_STAIRS: RoomItem = { id: "stairs-up", kind: "stairs", x: 0.7, z: -2.4, rot: 0, use: { kind: "floor", to: 2 }, label: "↑", name: "Upstairs" };
/** #19 clubs: stairs down to the restroom floor (floor 0) and up to VIP (floor 2), by room template. */
const CLUB_STAIRS: Partial<Record<PlaceTemplateId, { down: [number, number, number]; up?: [number, number, number] }>> = {
  club: { down: [-3.05, -0.6, 1], up: [3.1, 0.9, 3] },
  clubBig: { down: [-12.8, 6.6, 0], up: [10.6, 8.3, 1] },
  lounge: { down: [-1.7, 2.65, 1] },
};

/** The bits of a place a room needs (lib/city.ts Place). */
export interface RoomPlace {
  id: string;
  template?: string;
  depth?: string;
  palette?: string[];
  opensShop?: string;
  actions: { id: string; label: string; kind: string }[];
  /** #19 clubs: a restroom floor; `vip` adds a VIP floor upstairs. */
  club?: { vip?: string; doorClout?: number };
}

/**
 * v0.11: the room for a place, or null (a place with no room). Shared templates take
 * the place's own actions: placeholders ("*0", "*1") and any action id the place doesn't have are
 * given its actions in order, labelled with their names; items left over just sit there. Events,
 * the gigs board and Shop racks follow the place. Places that used to be scene cards are recolored
 * with their palette.
 */
/**
 * Places rebuilt as big buildings (owner, Nov 20) whose ground floor isn't the template in the city seed: the code picks it,
 * so no migration is needed. Their other floors are TOWERS.
 */
export const PLACE_GROUND: Record<string, PlaceTemplateId> = {
  "campaign-hq": "campaignGround",
  // The big clubs (owner, Nov 20); their VIP floor is vipBig (placeFloor).
  "velvet-static": "clubBig", "hellgate-hall": "clubBig", "the-sticky-floor": "clubBig", "discount-disco": "clubBig", "ultraviolet-society": "clubBig",
  // The rooftops (owner, Nov 20).
  "altitude-718": "rooftop", "ditmars-heights-rooftop": "rooftop", "up-on-thirty": "rooftop",
  // Clout TV Tower (owner, Nov 20): its Studio floor (the Newsroom is TOWERS' floor 2).
  "clout-tower": "tvStudio",
  // The subway station (owner, Nov 20): it used to be a map label only.
  "astoria-blvd-station": "station",
};

/**
 * Each special place's signature piece (owner, Nov 20: "a special furniture piece for each of the 18 locations"): pieces added
 * to its ground floor, and models swapped onto the shared template's own pieces (by item id).
 */
export const PLACE_SIGNATURE: Record<string, { add?: RoomItem[]; models?: Record<string, string> }> = {
  // The clubs' feature corner is the lounge's left end (clubBig: x -11.5 to -9, z 4.5 to 9).
  "velvet-static": { add: [{ id: "sig-banquette", kind: "booth", x: -10.2, z: 8.3, rot: 2, color: "#8B1A2B", model: "velvetBanquette", name: "The velvet booth" }] },
  "hellgate-hall": { add: [{ id: "sig-kiln", kind: "booth", x: -10.2, z: 8.3, rot: 2, color: "#FF5A36", model: "kilnBar", name: "The kiln" }] },
  "the-sticky-floor": { add: [{ id: "sig-jukebox", kind: "arcade", x: -10.2, z: 8.4, rot: 2, color: "#3DDC97", model: "jukebox", name: "The jukebox" }] },
  "discount-disco": { models: Object.fromEntries(["floor", "floor-2", "floor-3", "floor-4", "floor-5", "floor-6"].map((id) => [id, "discoFloor"])) },
  // The rooftops' signature pieces stand in the middle of the deck (rooftop: around x -5.5, z 1.2), the water tower at the back.
  "altitude-718": { add: [{ id: "sig-firepit", kind: "sectional", x: -5.5, z: 1.0, rot: 0, model: "firePit", name: "The fire pit" }] },
  "ditmars-heights-rooftop": { add: [{ id: "sig-cabana", kind: "sectional", x: -5.5, z: 1.0, rot: 0, color: "#F4F1EA", model: "cabana", name: "The cabana" }] },
  "clout-tower": { add: [{ id: "sig-talkshow", kind: "tvSet", x: 3.5, z: -4.6, rot: 0, model: "talkShow", name: "The talk-show set" }] },
  "astoria-blvd-station": { add: [{ id: "sig-entrance", kind: "stationEntrance", x: -8.6, z: 5.6, rot: 0, model: "subwayEntrance", name: "The way down to the street" }] },
  "up-on-thirty": { add: [{ id: "sig-tower", kind: "tree", x: -10.6, z: -4.4, rot: 0, model: "waterTower", name: "The water tower" }] },
  "ultraviolet-society": {
    add: [
      { id: "sig-pod-1", kind: "armchair", x: -10.8, z: 8.2, rot: 2, color: "#9B5CFF", model: "uvPod", name: "UV pod" },
      { id: "sig-pod-2", kind: "armchair", x: -9.6, z: 8.2, rot: 2, color: "#9B5CFF", model: "uvPod", name: "UV pod" },
    ],
  },
};

export function placeRoom(place: RoomPlace & { tags?: string[] }, area?: PlaceTemplateId): RoomTemplate | null {
  // Club nights, campus events and exclusive parties are held here; elsewhere the dance floor is just a floor.
  const hasEvents = CLUB_EVENTS.some((e) => e.placeId === place.id) || !!place.tags?.includes("exclusive_venue");
  // v0.15: a campus opens on the Quad; its other areas come through placeFloor (CAMPUS_AREAS).
  const campusArea = area ?? (place.tags?.includes("campus") && place.template === "campus" ? "campusQuad" : undefined);
  const ground = PLACE_GROUND[place.id];
  const base = campusArea ? PLACE_TEMPLATES[campusArea] : ground ? PLACE_TEMPLATES[ground] : place.template && place.template !== "apartment" ? PLACE_TEMPLATES[place.template as PlaceTemplateId] : undefined;
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
  // Tower offices: the ground floor's elevator doors.
  if (TOWERS[place.id] && !area) items.push(...towerElevators(base, place.id, 1));
  // The place's signature piece (on its ground floor, not a campus area).
  const sig = !area ? PLACE_SIGNATURE[place.id] : undefined;
  if (sig?.models) items.forEach((it, i) => { if (sig.models![it.id]) items[i] = { ...it, model: sig.models![it.id] }; });
  if (sig?.add) items.push(...sig.add);
  // #19 clubs: stairs down to the restroom, and up to VIP where there is one.
  const stairs = place.club && CLUB_STAIRS[base.id as PlaceTemplateId];
  if (stairs) {
    const [dx, dz, dr] = stairs.down;
    items.push({ id: "stairs-down", kind: "stairs", x: dx, z: dz, rot: dr, color: "#2B2440", use: { kind: "floor", to: 0 }, label: "↓", name: "Downstairs to the restroom" });
    if (place.club!.vip && stairs.up) {
      const [ux, uz, ur] = stairs.up;
      items.push({ id: "stairs-vip", kind: "stairs", x: ux, z: uz, rot: ur, color: "#F2A900", use: { kind: "floor", to: 2 }, label: "↑", name: "Upstairs to VIP" });
    }
  }
  // v0.15 campus areas wear the school's color.
  const schoolColor = campusArea && !base.dark && place.palette?.[0];
  const room = { ...base, id: `${base.id}:${place.id}`, items, ...(accent ? { wallAccent: accent } : {}), ...(schoolColor ? { wallAccent: schoolColor } : {}) };
  // Interior styles (owner, Oct 31): the place's own look, on its ground floor.
  return campusArea ? room : styleRoom(room, PLACE_STYLES[place.id]);
}

/**
 * A building's other floors, by number: 0 is a club's restroom (#19), 1 the ground floor, 2 the
 * exclusive venue's Penthouse Floor (v0.11) or a club's VIP floor (#19).
 */
export function placeFloor(place: RoomPlace & { tags?: string[] }, floor: number): RoomTemplate | null {
  if (floor === 1) return placeRoom(place);
  // v0.15 campus areas: the Lecture Hall, Library, Dining Hall and Greek Row (CAMPUS_AREAS).
  if (place.tags?.includes("campus") && place.template === "campus") return CAMPUS_AREAS[floor] ? placeRoom(place, CAMPUS_AREAS[floor].template) : null;
  // The Hub: the game room on 2 and the lounge on 3; its restroom is floor 0 like a club's.
  if (place.tags?.includes("hub") && (floor === 2 || floor === 3)) {
    const t = PLACE_TEMPLATES[HUB_FLOORS[floor].template];
    return { ...t, id: `${t.id}:${place.id}` };
  }
  if (floor === 0 && place.tags?.includes("hub")) {
    const t = PLACE_TEMPLATES.restroom;
    return { ...t, id: `restroom:${place.id}`, items: t.items.map((it) => (it.use?.kind === "floor" ? { ...it, name: "Back up to the diner" } : it)) };
  }
  // Tower offices: floors 2 and up, each with its elevator doors.
  const tower = TOWERS[place.id];
  if (tower) {
    const f = tower[floor];
    if (!f) return null;
    const t = PLACE_TEMPLATES[f.template];
    return styleRoom({ ...t, id: `${t.id}:${place.id}`, items: [...t.items, ...towerElevators(t, place.id, floor)] }, PLACE_STYLES[place.id]);
  }
  if (floor === 0) return place.club ? { ...PLACE_TEMPLATES.restroom, id: `restroom:${place.id}` } : null;
  if (floor !== 2) return null;
  if (place.tags?.includes("exclusive_venue")) return { ...PLACE_TEMPLATES.penthouse, id: `penthouse:${place.id}` };
  if (!place.club?.vip) return null;
  const vip = PLACE_GROUND[place.id] === "clubBig" ? PLACE_TEMPLATES.vipBig : PLACE_TEMPLATES.vip;
  return { ...vip, id: `${vip.id}:${place.id}` };
}

/**
 * Tower offices (owner, Oct 31): big technology and media companies have floors joined by an elevator bank. Floor 1 is the
 * place's own room (its template); the rest come from here. Every floor gets elevator doors to every other floor.
 */
export const TOWERS: Record<string, Record<number, { name: string; emoji: string; template: PlaceTemplateId; lift?: [number, number, number]; stairs?: boolean }>> = {
  "skybridge-tower": {
    1: { name: "Lobby", emoji: "🛎️", template: "towerLobby" },
    2: { name: "Open floor", emoji: "💻", template: "techFloor" },
    3: { name: "Executive floor", emoji: "🥂", template: "execFloor" },
  },
  // A content house that serves as an office (owner, Oct 31): stairs, not an elevator.
  "glow-up-house": {
    1: { name: "Living room", emoji: "🛋️", template: "streamHouse", stairs: true, lift: [-4.3, 2.9, 0] },
    2: { name: "Stream floor", emoji: "🎮", template: "streamFloor", stairs: true },
    3: { name: "Brand deals floor", emoji: "🤝", template: "execFloor", stairs: true },
  },
  // Finance (owner, Oct 31): a Court Square glass tower.
  "queensboro-capital": {
    1: { name: "Lobby", emoji: "🛎️", template: "towerLobby" },
    2: { name: "Trading floor", emoji: "📈", template: "tradingFloor" },
    3: { name: "Executive floor", emoji: "🥂", template: "execFloor" },
  },
  // Campaign HQ (owner, Nov 20): a three-floor building with stairs up from reception (the ground floor replaces the place's
  // own storefront template: PLACE_GROUND).
  "campaign-hq": {
    1: { name: "Ground floor", emoji: "🗳️", template: "campaignGround", stairs: true, lift: [8.6, 5.4, 0] },
    2: { name: "War room floor", emoji: "🗺️", template: "campaignWar", stairs: true, lift: [9.2, 5.4, 0] },
    3: { name: "Rally roof", emoji: "📣", template: "campaignRoof", stairs: true, lift: [9.2, 0.4, 0] },
  },
  "clout-tower": {
    1: { name: "Studio", emoji: "📺", template: "tvStudio", lift: [-9.0, 6.65, 2] },
    2: { name: "Newsroom", emoji: "🗞️", template: "tvNewsroom", lift: [1.0, 6.65, 2] },
    3: { name: "Executive floor", emoji: "🥂", template: "execFloor" },
  },
};

// ---------------------------------------------------------------------------
// Interior styles (owner, Oct 31: "Building interiors also need different styles; old english, minimalist, futuristic,
// modern"). A style re-dresses a place's room: walls, floor, upholstery and a few touches. The layout never moves, so
// every hotspot stays where it was; the place's own accent color (its brand) stays on the trim.
// ---------------------------------------------------------------------------
export type InteriorStyle = "oldEnglish" | "minimalist" | "futuristic" | "modern";

export const INTERIOR_STYLES: Record<InteriorStyle, {
  name: string; wall: string; floor: string; floorKind: RoomTemplate["floorKind"];
  /** Upholstery and rugs: what sofas, armchairs, booths and rugs are re-covered in. */
  seat: string; rug: string; accent?: string; dark?: boolean; alwaysLit?: boolean;
}> = {
  // Wood paneling, oxblood leather, racing green and oil paintings in gilt frames: a gentlemen's club in Queens.
  oldEnglish: { name: "Old English", wall: "#6B4A35", floor: "#6A4226", floorKind: "wood", seat: "#7A2E3A", rug: "#2F4A3A" },
  // White walls, pale concrete, oatmeal linen and almost nothing else.
  minimalist: { name: "Minimalist", wall: "#F4F2EE", floor: "#DCD6CC", floorKind: "concrete", seat: "#D9D2C5", rug: "#E8E2D8", alwaysLit: true },
  // Midnight walls, glossy dark tiles, neon trim and light-up seats.
  futuristic: { name: "Futuristic", wall: "#151A2C", floor: "#232A40", floorKind: "tile", seat: "#2A3352", rug: "#3DF2FF", accent: "#3DF2FF", alwaysLit: true },
  // Warm white, light oak, charcoal sofas, black trim.
  modern: { name: "Modern", wall: "#ECEAE6", floor: "#C49A6C", floorKind: "wood", seat: "#3A3F4A", rug: "#C9B79C", accent: "#2F2A26" },
};

/** Which places wear which style (places not listed keep their template's own look). */
export const PLACE_STYLES: Record<string, InteriorStyle> = {
  // Old English: the library, the Mayor's annex, the speakeasy lounge, the jazz bar, the chapel.
  "ditmars-library": "oldEnglish", "city-hall-annex": "oldEnglish", "low-light-lounge": "oldEnglish",
  "brownstone-sessions": "oldEnglish", "harmony-chapel": "oldEnglish",
  // Minimalist: the boutique, the coworking floor, the gym, the café.
  "thread-count": "minimalist", "triborough-works": "minimalist", "pressed-iron-gym": "minimalist", "grind-and-gossip": "minimalist",
  // Futuristic: the tech tower, the gaming arena, the UV club.
  "skybridge-tower": "futuristic", "respawn-arena": "futuristic", "ultraviolet-society": "futuristic",
  // Modern: the TV tower, the rooftop restaurant, the campaign office, the furniture showroom, the atelier.
  "atelier-vernon": "minimalist", "glow-up-house": "futuristic",
  // Real Estate, Finance and Law (owner, Oct 31).
  "no-fee-realty": "modern", "pablos-luggage": "oldEnglish", "queensboro-capital": "modern", "whitlock-hale": "oldEnglish",
  "altitude-718": "modern", "fifs-furniture": "modern",
};

const RESTYLED: FurnitureKind[] = ["sofa", "armchair", "booth"];

/** A room in a style: the same layout, re-dressed. */
export function styleRoom(t: RoomTemplate, style: InteriorStyle | undefined): RoomTemplate {
  if (!style || t.outdoor) return t;
  const st = INTERIOR_STYLES[style];
  let items = t.items.map((it) => (RESTYLED.includes(it.kind) ? { ...it, color: st.seat } : it.kind === "rug" && !it.use ? { ...it, color: st.rug } : it));
  if (style === "minimalist") {
    // Less is more: one plant, no lamps.
    let plants = 0;
    items = items.filter((it) => it.use || (it.kind === "plant" ? plants++ < 1 : it.kind !== "floorLamp"));
  }
  if (style === "oldEnglish") {
    // Oil paintings in gilt frames along the back wall (they hang on the wall, so nothing is in their way).
    const art = ["/art/art-bridge-rain.webp", "/art/art-pigeon-portrait.webp"];
    [-t.w / 4, t.w / 4].forEach((x, i) => items.push({ id: `style-art-${i}`, kind: "painting", x: Math.round(x * 10) / 10, z: -t.d / 2 + 0.08, rot: 0, color: "#B08D57", art: art[i] }));
  }
  return {
    ...t, items, wall: st.wall, floor: st.floor, floorKind: st.floorKind,
    ...(st.accent ? { wallAccent: st.accent } : {}),
    ...(st.alwaysLit ? { alwaysLit: true } : {}),
  };
}

/** A tower floor's elevator: up to the next floor (from the top, back down to the ground); the floor buttons go anywhere. */
export function towerElevators(t: Pick<RoomTemplate, "w" | "d">, placeId: string, floor: number): RoomItem[] {
  const floors = TOWERS[placeId];
  if (!floors) return [];
  const to = floors[floor + 1] ? floor + 1 : 1;
  const kind = floors[floor]?.stairs ? "stairs" : "elevator";
  const f = FURNITURE[kind];
  const [x, z, rot] = floors[floor]?.lift ?? [-t.w / 2 + f.w / 2 + 0.2, -t.d / 2 + f.d / 2 + 0.08, 0];
  const up = to > floor;
  return [{
    id: "elevator", kind, x, z, rot,
    use: { kind: "floor", to }, label: `${kind === "stairs" ? (up ? "⬆️" : "⬇️") : "🛗"} ${up ? "Up" : "Down"} to the ${floors[to].name.toLowerCase()}`,
    name: `${kind === "stairs" ? "Stairs" : "Elevator"} to the ${floors[to].name.toLowerCase()}`,
  }];
}

/** #19 clubs: the floors a place has besides the ground floor (0 restroom, 2 upstairs; the Hub also 3). */
export function placeFloors(place: RoomPlace & { tags?: string[] }): number[] {
  return [0, 2, 3, 4, 5].filter((f) => placeFloor(place, f) !== null);
}

/** The Hub's floors (owner, Oct 16): what each is called on the wall sign, the card and the stairs. */
export const HUB_FLOORS: Record<number, { name: string; emoji: string; template: PlaceTemplateId }> = {
  0: { name: "Restroom", emoji: "🚻", template: "restroom" },
  1: { name: "The Neon Spoon diner", emoji: "🍳", template: "hub" },
  2: { name: "Game room", emoji: "🎮", template: "hubGames" },
  3: { name: "Lounge", emoji: "🛋️", template: "hubLounge" },
};

/** v0.15 campus areas (owner, Oct 18): you walk in on the Quad (1); the buildings are "floors" 2 to 5. */
export const CAMPUS_AREAS: Record<number, { name: string; emoji: string; template: PlaceTemplateId }> = {
  1: { name: "The Quad", emoji: "🌳", template: "campusQuad" },
  2: { name: "Lecture Hall", emoji: "🎓", template: "campus" },
  3: { name: "Library", emoji: "📖", template: "campusLibrary" },
  4: { name: "Dining Hall", emoji: "🍽️", template: "campusDining" },
  5: { name: "Greek Row", emoji: "🎉", template: "campusGreek" },
};

// ---------------------------------------------------------------------------
// Layout and geometry helpers
// ---------------------------------------------------------------------------
/** A saved spot; `f` is the floor of a bought piece in a home with stairs (#19, the duplex), 1 when absent. */
export interface LayoutEntry { id: string; x: number; z: number; rot: number; f?: number }

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

/** #19: half the thickness of the waist-high walls between rooms. */
export const INNER_WALL = 0.06;

/** True when a box (center, half sizes) crosses one of the template's inner walls. */
export function hitsWall(t: Pick<RoomTemplate, "walls">, x: number, z: number, hw: number, hd: number): boolean {
  return (t.walls ?? []).some(([x0, z0, x1, z1]) =>
    x + hw > Math.min(x0, x1) - INNER_WALL && x - hw < Math.max(x0, x1) + INNER_WALL
    && z + hd > Math.min(z0, z1) - INNER_WALL && z - hd < Math.max(z0, z1) + INNER_WALL);
}

/** #19: which room of a multi-room home a point is in (its name), if any. */
export function roomAt(t: Pick<RoomTemplate, "rooms">, x: number, z: number): string | null {
  return t.rooms?.find((r) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1)?.name ?? null;
}

/** True when a moved item sits inside the room without overlapping solid furniture or a wall. Rugs may sit under things. */
export function placementOk(t: RoomTemplate, items: RoomItem[], moved: RoomItem): boolean {
  const c = clampItem(t, moved);
  if (Math.abs(c.x - moved.x) > 1e-6 || Math.abs(c.z - moved.z) > 1e-6) return false;
  const f = footprint(moved);
  if (hitsWall(t, moved.x, moved.z, f.w / 2 - 0.02, f.d / 2 - 0.02)) return false;
  if (FURNITURE[moved.kind].walkable) return true;
  return items.every((o) => o.id === moved.id || FURNITURE[o.kind].walkable || !overlaps(o, moved));
}

/** #19 Fif's Furniture: a piece the player bought (a player_items row), placed through the home layout. */
export interface OwnedPiece { id: string; kind: FurnitureKind; color?: string; name: string; emoji: string; art?: string }
/** The layout id of a bought piece. */
export const ownedId = (itemId: number) => `item:${itemId}`;
export const isOwnedId = (id: string) => id.startsWith("item:");
/** Bought seats and beds work like the home's own. */
const OWNED_USE: Partial<Record<FurnitureKind, Pick<RoomItem, "use" | "label">>> = {
  sofa: { use: { kind: "sit" }, label: "Sit" }, armchair: { use: { kind: "sit" }, label: "Sit" },
  chair: { use: { kind: "sit" }, label: "Sit" }, bed: { use: { kind: "sleep" }, label: "Nap" },
  throne: { use: { kind: "sit" }, label: "Sit" },
};
export function ownedItem(p: OwnedPiece, x: number, z: number, rot: number): RoomItem {
  return { id: p.id, kind: p.kind, x, z, rot: ((rot % 4) + 4) % 4, color: p.color, name: p.name, ...(p.art ? { art: p.art } : {}), ...OWNED_USE[p.kind] };
}

/**
 * Applies a saved home layout to a template; unknown ids and bad numbers are ignored. Bought pieces
 * (#19) appear where the layout puts them; any without a spot, or whose spot no longer fits (another
 * home, a wall), stay in storage.
 */
export function applyLayout(t: RoomTemplate, raw: unknown, owned: OwnedPiece[] = [], floor = 1): RoomItem[] {
  const entries = Array.isArray(raw) ? (raw as Partial<LayoutEntry>[]) : [];
  const valid = (e: Partial<LayoutEntry> | undefined): e is LayoutEntry =>
    !!e && Number.isFinite(e.x) && Number.isFinite(e.z) && Number.isInteger(e.rot);
  const byId = new Map(entries.filter((e) => e && typeof e.id === "string").map((e) => [e.id as string, e]));
  const out: RoomItem[] = [];
  for (const item of t.items) {
    const e = byId.get(item.id);
    let next = item;
    if (valid(e) && FURNITURE[item.kind].movable) {
      next = clampItem(t, { ...item, x: e.x, z: e.z, rot: ((e.rot % 4) + 4) % 4 });
      if (!placementOk(t, [...out, ...t.items.filter((o) => o.id !== item.id)], next)) next = item;
    }
    out.push(next);
  }
  for (const p of owned) {
    const e = byId.get(p.id);
    if (!valid(e) || (e.f ?? 1) !== floor) continue;
    const next = ownedItem(p, e.x, e.z, e.rot);
    const c = clampItem(t, next);
    if (c.x === next.x && c.z === next.z && placementOk(t, out, next)) out.push(next);
  }
  return out;
}

/** The first free spot for a piece taken out of storage, searching outward from the middle of the room. */
export function freeSpot(t: RoomTemplate, items: RoomItem[], piece: RoomItem): RoomItem | null {
  for (let ring = 0; ring < 40; ring++) {
    for (let dx = -ring; dx <= ring; dx++) for (let dz = -ring; dz <= ring; dz++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) !== ring) continue;
      const cand = { ...piece, x: snap(dx * GRID), z: snap(dz * GRID) };
      if (placementOk(t, items, cand)) return cand;
    }
  }
  return null;
}

export function toLayout(items: RoomItem[], floor = 1): LayoutEntry[] {
  return items.filter((i) => FURNITURE[i.kind].movable).map((i) => ({
    id: i.id, x: round(i.x), z: round(i.z), rot: i.rot, ...(floor !== 1 && isOwnedId(i.id) ? { f: floor } : {}),
  }));
}

/**
 * #19 homes with stairs: saving one floor keeps the other floor's entries. Bought pieces placed on
 * another floor stay there; this floor's own entries are replaced.
 */
export function mergeFloorLayout(prev: unknown, next: LayoutEntry[], floor: number): LayoutEntry[] {
  const ids = new Set(next.map((e) => e.id));
  const kept = (Array.isArray(prev) ? (prev as LayoutEntry[]) : []).filter((e) =>
    e && typeof e.id === "string" && !ids.has(e.id) && !(isOwnedId(e.id) && (e.f ?? 1) === floor));
  return [...kept, ...next];
}

/** Bought pieces that stand on another floor of the home (so this floor's storage doesn't list them). */
export function placedElsewhere(raw: unknown, floor: number): Set<string> {
  return new Set((Array.isArray(raw) ? (raw as LayoutEntry[]) : [])
    .filter((e) => e && typeof e.id === "string" && isOwnedId(e.id) && (e.f ?? 1) !== floor).map((e) => e.id));
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
      const wall = hitsWall(t, x, z, BODY_RADIUS, BODY_RADIUS);
      blocked[r * cols + c] = edge || hit || wall ? 1 : 0;
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

/**
 * Crowded places (owner, Oct 15): how many real players a room shows before it gets cramped, on top of
 * its regulars (who never make way: they carry the stories and the gossip). Party floors use their
 * crowdSpots instead. Everyone else at the place is in the Here now list.
 */
export const PLAYER_SLOTS: Record<PlaceTemplateId, number> = {
  restroom: 3, vip: 4, club: 6, cafe: 5, counter: 4, lounge: 5, store: 5, showroom: 7, campus: 6, lotto: 4,
  unisphere: 7, gantries: 7, office: 5, officeSmall: 3, officeBig: 7, towerLobby: 6, techFloor: 7, execFloor: 6, newsroom: 7, streamHouse: 6, streamFloor: 7, atelier: 6, tradingFloor: 7, lawOffice: 6, backRoom: 3, civic: 5, gym: 5, plaza: 7, penthouse: 10, radio: 4, broadcast: 5,
  hub: 7, hubGames: 7, hubLounge: 7, campusQuad: 7, campusLibrary: 5, campusDining: 6, campusGreek: 7,
  campaignGround: 12, campaignWar: 10, campaignRoof: 14, clubBig: 14, vipBig: 7, rooftop: 14, station: 12, tvStudio: 12, tvNewsroom: 12,
};
/** The player figures a room holds (its party spots, or PLAYER_SLOTS by template; floors are "vip:place"). */
export function playerSlots(t: RoomTemplate): number {
  if (t.crowdSpots) return t.crowdSpots.length;
  return PLAYER_SLOTS[t.id.split(":")[0] as PlaceTemplateId] ?? 4;
}

/**
 * Meeting players (owner, Oct 15): where real players at a place stand in a room without party
 * spots. Free floor cells, spread out, away from the door, the regulars and each other; the same
 * room and count always give the same spots.
 */
export function openSpots(t: RoomTemplate, items: RoomItem[], n: number): { x: number; z: number; facing: number }[] {
  if (n <= 0) return [];
  const grid = makeGrid(t, items);
  const taken: [number, number][] = [t.spawn, ...(t.npcs ?? []).map((p) => [p.x, p.z] as [number, number])];
  const out: { x: number; z: number; facing: number }[] = [];
  let seed = (Math.round(t.w * 97 + t.d * 31) + t.id.length * 7919) % 2147483647 || 1;
  const rand = () => ((seed = (seed * 48271) % 2147483647) / 2147483647);
  // Only floor you can walk to from the door (not behind a bar or in a corner boxed in by furniture).
  const reach = new Uint8Array(grid.cols * grid.rows);
  const [sc, sr] = grid.cellOf(t.spawn[0], t.spawn[1]);
  const queue = [sr * grid.cols + sc];
  reach[queue[0]] = 1;
  while (queue.length) {
    const i = queue.pop()!;
    const c = i % grid.cols, r = Math.floor(i / grid.cols);
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc, nr = r + dr, j = nr * grid.cols + nc;
      if (nc < 0 || nr < 0 || nc >= grid.cols || nr >= grid.rows || reach[j] || grid.blocked[j]) continue;
      reach[j] = 1;
      queue.push(j);
    }
  }
  const cells: number[] = [];
  for (let i = 0; i < grid.cols * grid.rows; i++) if (!grid.blocked[i] && reach[i]) cells.push(i);
  for (let i = cells.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [cells[i], cells[j]] = [cells[j], cells[i]]; }
  for (const gap of [1.1, 0.8, 0.55]) {
    for (const i of cells) {
      if (out.length >= n) return out;
      const x = grid.toX(i % grid.cols);
      const z = grid.toZ(Math.floor(i / grid.cols));
      if (taken.some(([a, b]) => Math.hypot(a - x, b - z) < gap)) continue;
      taken.push([x, z]);
      out.push({ x, z, facing: rand() * Math.PI * 2 - Math.PI });
    }
  }
  return out;
}
