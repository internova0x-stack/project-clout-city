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
  // v0.14 On Air (owner, Oct 16): the voice of The Wake-Up Call, always at the desk.
  { id: "sharm", name: "Sharm Almight", title: "DJ, The Wake-Up Call", placeId: "real-clout-fm", emoji: "🎙️", role: "bartender" },
];

/** What people call a regular: their first name, or title and surname ("Mr. Penwright", "Sgt. Bev"). */
export function callName(name: string): string {
  const [a, b] = name.split(" ");
  return /\.$/.test(a) && b ? `${a} ${b}` : a;
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
