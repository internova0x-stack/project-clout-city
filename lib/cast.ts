import type { Look } from "./look.ts";

// The recurring cast (v0.6, docs/08-new-features-spec.md section 4; the bible is docs/CAST.md).
// Every name is invented. Celebrities and wannabes appear in City News and in what the
// regulars say; regulars stand at their place and say a rotating line when tapped.
// Dependency-free so tests can import it.

export interface Celebrity {
  id: string;
  name: string;
  /** What kind of famous: one each, per the spec. */
  type: "streamer" | "basketball star" | "football star" | "reality TV star" | "pop star" | "movie star" | "tech founder" | "influencer";
  personality: string;
  wants: string;
  flaw: string;
}

export const CELEBRITIES: Celebrity[] = [
  { id: "chase-clout", name: "Chase Clout", type: "streamer", personality: "Loud, streams for 14 hours, catchphrase \"chat, chat, CHAT\"", wants: "A record million live viewers", flaw: "Gets banned about every other week" },
  { id: "dunk-daniels", name: "Dunk Daniels", type: "basketball star", personality: "Smooth, shoots from the logo, owns 400 pairs of sneakers", wants: "A championship ring", flaw: "Late to everything, games included" },
  { id: "brick-tackleton", name: "Brick Tackleton", type: "football star", personality: "Gentle giant, nonstop family man", wants: "To be taken seriously as an actor", flaw: "His acting" },
  { id: "chardonnay-shade", name: "Chardonnay Shade", type: "reality TV star", personality: "Lives for the confessional booth, a born villain", wants: "Her own spin-off", flaw: "Can't keep a secret, or a friend" },
  { id: "lunaria", name: "Lunaria", type: "pop star", personality: "Mysterious, one name, drops albums at 3 AM", wants: "The Golden Mic trophy", flaw: "Feuds with every producer she's worked with" },
  { id: "brock-squarejaw", name: "Brock Squarejaw", type: "movie star", personality: "Square-jawed, does his own stunts", wants: "To be cast as a superhero", flaw: "Ages one year every two years" },
  { id: "skyler-beta", name: "Skyler Beta", type: "tech founder", personality: "Hoodie, ten apps, three pivots a year", wants: "To build the everything app", flaw: "None of the apps work" },
  { id: "peyton-pastel", name: "Peyton Pastel", type: "influencer", personality: "Pastel everything, link in bio", wants: "A brand deal with a car company", flaw: "Every apology video goes viral" },
];

/** City Hall (owner, Oct 22): the Mayor, a recurring face in City News every week and the one who answers players'
 *  letters in the Phone's Mayor app (lib/mayor.ts). */
export interface Official { id: string; name: string; title: string; bit: string; /** Profile picture (public/). */ portrait: string }

export const MAYOR_PAPA_DANI: Official = {
  id: "mayor-papa-dani", name: "Mayor Papa-Dani", title: "the Mayor",
  bit: "Enthusiastic, everywhere at once, listens to his constituents and fixes the city's problems fast; never met a ribbon he wouldn't cut",
  // Owner, Oct 22: a big smile, a mustache and a short beard.
  portrait: "/cast/mayor-papa-dani.webp",
};
export const OFFICIALS: Official[] = [MAYOR_PAPA_DANI];
/** The Mayor's id before his rename (owner, Oct 22: Mama-Mandee became Papa-Dani); news files may still carry it. */
export const MAYOR_OLD_IDS: readonly string[] = ["mayor-mama-mandee"];

export interface Wannabe { id: string; name: string; bit: string }

export const WANNABES: Wannabe[] = [
  { id: "dj-polaroid", name: "DJ Polaroid", bit: "A struggling DJ who plays Hellgate Hall's 7 PM slot to an empty room" },
  { id: "chad-kensington", name: "Chad Kensington, CEO", bit: "CEO of \"a stealth startup\", which is a domain name" },
  { id: "tiff", name: "Tiff", bit: "\"Basically an influencer\": 312 followers, mostly bots, posts like she has millions" },
];

/** A regular: someone who's always at one place and has something to say. */
export interface Regular {
  id: string;
  name: string;
  /** Shown after the name: "Sal · the owner". */
  title: string;
  placeId: string;
  emoji: string;
  /** The story chatter role whose lines this regular speaks while a story runs (content/chatter-generic.json). */
  role: string;
}

export const REGULARS: Regular[] = [
  { id: "sal", name: "Sal", title: "the owner", placeId: "ditmars-deli", emoji: "🧔", role: "clerk" },
  { id: "jojo", name: "Jojo", title: "the barista", placeId: "grind-and-gossip", emoji: "🧑‍🎤", role: "barista" },
  { id: "rocco", name: "Rocco", title: "the bouncer", placeId: "hellgate-hall", emoji: "🕶️", role: "bartender" },
  { id: "mags", name: "Mags", title: "the bartender", placeId: "velvet-static", emoji: "👩‍🦰", role: "bartender" },
  { id: "captain-rosa", name: "Captain Rosa Díaz-Moore", title: "Engine 7", placeId: "engine-7", emoji: "👩‍🚒", role: "driver" },
  { id: "penwright", name: "Mr. Penwright", title: "the librarian", placeId: "ditmars-library", emoji: "🧓", role: "professor" },
  { id: "sgt-bev", name: "Sgt. Bev Kowalski", title: "the desk sergeant", placeId: "precinct-114-half", emoji: "👮‍♀️", role: "doorman" },
  { id: "pixel", name: "Pixel", title: "the arena manager", placeId: "respawn-arena", emoji: "🎧", role: "driver" },
  { id: "walt", name: "Walt", title: "the tour guide", placeId: "unisphere", emoji: "🧢", role: "driver" },
  { id: "gus", name: "Gus", title: "same bench, every day", placeId: "hell-gate-park", emoji: "👴", role: "driver" },
  { id: "inez", name: "Inez", title: "the wedding photographer", placeId: "gantry-plaza", emoji: "📸", role: "driver" },
  { id: "benny", name: "Benny Fortuna", title: "the owner, never bought a ticket", placeId: "lucky-star", emoji: "🧑‍🦳", role: "clerk" },
  // Culture pack C1 (owner, Oct 20): every Astoria place gets its person; profiles in content/culture/npcs.json.
  { id: "dr-eleni", name: "Dr. Eleni Markou", title: "the ER doctor", placeId: "st-copays", emoji: "👩‍⚕️", role: "patron" },
  { id: "marcos", name: "Marcos Albuquerque", title: "the owner", placeId: "low-light-lounge", emoji: "🎸", role: "bartender" },
  { id: "camila", name: "Camila Restrepo", title: "the store manager", placeId: "steinway-fresh", emoji: "🛒", role: "clerk" },
  { id: "valentina", name: "Valentina Ospina", title: "runs the gigs board", placeId: "triborough-works", emoji: "💻", role: "regular" },
  { id: "rev-mercy", name: "Rev. Mercy Adeyemi", title: "the reverend", placeId: "harmony-chapel", emoji: "🕊️", role: "patron" },
  { id: "yesenia", name: "Yesenia Ortiz", title: "the station agent", placeId: "astoria-blvd-station", emoji: "🚇", role: "driver" },
  { id: "nour", name: "Nour El-Sayed", title: "the Big Screen producer", placeId: "clout-tower", emoji: "🎬", role: "dj" },
  // Culture pack C2: the people at Astoria's new food places.
  { id: "arben", name: "Arben Krasniqi", title: "the owner", placeId: "still-a-dollar-slice", emoji: "🍕", role: "cook" },
  { id: "tariq", name: "Tariq Hossain", title: "the cart owner", placeId: "white-sauce-cart", emoji: "🥙", role: "cook" },
  { id: "lou", name: "Lou Ferraro", title: "the cart owner", placeId: "boiled-and-beloved", emoji: "🌭", role: "cook" },
  { id: "andreas", name: "Andreas Charalambous", title: "the owner", placeId: "feta-compli", emoji: "🫒", role: "bartender" },
  { id: "hersh", name: "Hersh Weiss", title: "the owner, at the counter", placeId: "schlep-and-schmear", emoji: "🥯", role: "clerk" },
  // Culture pack C5: the rooftop's guest list and the ballpark's longest-serving usher.
  { id: "kiki", name: "Kiki Mensah", title: "runs the guest list", placeId: "ditmars-heights-rooftop", emoji: "🌃", role: "doorman" },
  { id: "hector", name: "Hector Rivera", title: "usher, Section 7", placeId: "meteor-park", emoji: "⚾", role: "driver" },
  // Culture pack C6: the dumpling stall in Flushing, and the super of The Lease's walk-up (seen while that story runs).
  { id: "wen", name: "Wen Zhao", title: "runs the dumpling stall", placeId: "downstairs-on-main", emoji: "🥟", role: "cook" },
  { id: "teddy", name: "Teddy Bautista", title: "the super", placeId: "ditmars-walkup", emoji: "🔧", role: "doorman" },
  // v0.14 On Air (owner, Oct 16): the voice of The Wake-Up Call, always at the desk.
  { id: "sharm", name: "Sharm Almight", title: "DJ, The Wake-Up Call", placeId: "real-clout-fm", emoji: "🎙️", role: "bartender" },
  // The Hub's host (owner, Oct 16): the city's tea queen, who can get you anything and knows everyone worth knowing.
  { id: "lola", name: "Lola Lowdown", title: "the tea queen", placeId: "neon-spoon", emoji: "💋", role: "bartender" },
];

/** Lola Lowdown's look (owner, Oct 17: her head is the tour guide's avatar): soft glam; light-skinned and mixed, long brunette hair (owner, Oct 26). */
/** Her portrait in the tour and hint bubbles (owner, Oct 26: the 3D hair read as a durag; made with Higgsfield, like the Mayor's). */
export const LOLA_PORTRAIT = "/cast/lola-lowdown.webp";
export const LOLA_LOOK: Look = {
  style: "influencer_soft_glam", body: "curvy", build: "curvy", skin: "#E0AC69", hair: "long", hairColor: "#4A2C1A",
  eyes: "#3B2314", glasses: "none", covering: "none", fit: null,
};

/** What people call a regular: their first name, or title and surname ("Mr. Penwright", "Sgt. Bev"). */
export function callName(name: string): string {
  const [a, b] = name.split(" ");
  return /\.$/.test(a) && b ? `${a} ${b}` : a;
}

/**
 * The people in a room who aren't its regular (owner, Oct 16: "give the characters different names instead of
 * a generic 'A gamer'"): an invented first name each, the same for a place, floor and spot on every visit,
 * and never two alike in one room.
 */
const CROWD_NAMES = [
  "Jules", "Marisol", "Dev", "Priya", "Tavi", "Rosalind", "Kenji", "Ama", "Nico", "Bex", "Omari", "Yara", "Sunny", "Ilse",
  "Mateo", "Noor", "Fitz", "Calla", "Ravi", "Dot", "Hollis", "Zuri", "Benji", "Esme", "Kofi", "Lupe", "Wren", "Dario",
  "Mina", "Tobias", "Ines", "Rocky", "Shay", "Leandro", "Pia", "Gideon", "Tamsin", "Arlo", "Sol", "Vee",
];
export function crowdName(placeId: string, floor: number, i: number): string {
  const seed = [...`${placeId}:${floor}`].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  return CROWD_NAMES[(seed + i * 7) % CROWD_NAMES.length];
}

export function regularAt(placeId: string): Regular | undefined {
  return REGULARS.find((r) => r.placeId === placeId);
}

/** Story chatter by role while a story runs (from the story feed): role → lines. */
export type StoryLines = Record<string, string[]> | null;

/**
 * The line a regular says on tap number `n`. A live story's lines for their role come
 * first (the city talks about the story), then this week's approved lines from the
 * Studio (personal updates and cast news), then their evergreen lines.
 */
export function regularLine(r: Regular, n: number, opts: { story?: StoryLines; live?: Record<string, string[]>; evergreen: Record<string, string[]> }): string {
  const story = opts.story?.[r.role] ?? [];
  const live = opts.live?.[r.id] ?? [];
  const evergreen = opts.evergreen[r.id] ?? [];
  // Story lines lead every other tap, so a regular still sounds like themselves.
  const pool = story.length ? (n % 2 === 0 ? story : [...live, ...evergreen]) : [...live, ...evergreen];
  const lines = pool.length ? pool : story.length ? story : ["Nice day for it."];
  return lines[((n % lines.length) + lines.length) % lines.length];
}
