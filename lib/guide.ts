// The Guide (migration 0170, owner Nov 20: "Still looking for how to solve the 'what do I do next?' problem… an extensive
// game walkthrough… a tip, an action, and the players will play through it till the action is complete"; then "go with your
// recommendations"). Steps in chapters: Lola's tip, two or three explainer cards, "Show me" (a glow on the real button) and a
// reward once the game sees it done. The step list is docs/GUIDE.md (from the owner's Claude Doc). Chapter 1, Arrival, is
// built; the other chapters show as "Coming soon" until their steps are written here.
//
// What counts as done is data: `check` is copied to game_settings 'guide' (tests/guide.test.ts keeps them in step) and read
// by the server's guide_claim, which pays once (ledger 'guide', ref the step id). A "seen" step is marked by the game itself
// when the player opens that screen (guide_seen). Safe to import anywhere: nothing here is secret.

export type GuideCheck =
  /** The game marks it when the screen is opened (guide_seen). */
  | { seen: true }
  /** Any ledger row of these kinds since the account began (Start over's archive aside). */
  | { ledger: string[] }
  /** A piece of gossip found (gossip_found). */
  | { gossip: true }
  /** Went out: a club event, VIP floor or calendar event (ledger), or an exclusive party (event_attendance). */
  | { events: true }
  /** The daily streak (player_streaks, current or best) at least this long. */
  | { streak: number };

export interface GuideCard { art: string; t: string; b: string }
export interface GuideStep {
  id: string;
  chapter: number;
  tag: string;
  tip: string;
  /** Who says the tip ("lola" unless a cameo). */
  who?: "lola" | "barksley";
  cards: GuideCard[];
  /** What the player does, in the "Show me" hint. */
  hint: string;
  /**
   * Where "Show me" points: CSS selectors tried in order (the first visible one gets the glow). None visible: the hint
   * shows on its own (a person in a room, which has no button).
   */
  targets: string[];
  check: GuideCheck;
  reward: { cash?: number; clout?: number };
  /** The banner when it's done. */
  done: string;
}
export interface GuideChapter {
  n: number;
  title: string;
  /** Opens on this New York day of the account (1 = the day it started) or at this rank, whichever the chapter names. */
  day?: number;
  rank?: number;
  badge: string;
  badgeId: string;
  reward: { cash?: number; clout?: number };
  /** False until its steps are written: shown as "Coming soon". */
  live: boolean;
}

export const CHAPTERS: GuideChapter[] = [
  { n: 1, title: "Arrival", day: 1, badge: "Off the Bus", badgeId: "guide-1", reward: { cash: 500 }, live: true },
  { n: 2, title: "Looking after yourself", day: 1, badge: "Adulting (Allegedly)", badgeId: "guide-2", reward: { cash: 300 }, live: false },
  { n: 3, title: "Money", day: 2, badge: "Bag Secured", badgeId: "guide-3", reward: { cash: 500 }, live: false },
  { n: 4, title: "More clout", day: 2, badge: "Locally Relevant", badgeId: "guide-4", reward: { clout: 150 }, live: false },
  { n: 5, title: "Home", day: 3, badge: "Landlord's Nightmare", badgeId: "guide-5", reward: { cash: 400 }, live: false },
  { n: 6, title: "Skills", day: 3, badge: "Multi-Hyphenate", badgeId: "guide-6", reward: { clout: 100 }, live: false },
  { n: 7, title: "Style", day: 2, badge: "Main Character Fit", badgeId: "guide-7", reward: { clout: 100 }, live: false },
  { n: 8, title: "People", day: 2, badge: "Plus One", badgeId: "guide-8", reward: { clout: 150 }, live: false },
  { n: 9, title: "Choices", day: 1, badge: "It's Complicated", badgeId: "guide-9", reward: { clout: 100 }, live: false },
  { n: 10, title: "Big plays", rank: 2, badge: "Big Plans", badgeId: "guide-10", reward: { clout: 200 }, live: false },
  { n: 11, title: "The city", day: 4, badge: "Well Informed", badgeId: "guide-11", reward: { clout: 100 }, live: false },
];

// "text:Map" is a visible button whose words are exactly "Map" (the tab bar's buttons have no label of their own).
const MAP = "text:Map";

export const STEPS: GuideStep[] = [
  {
    id: "1.1", chapter: 1, tag: "The map", tip: "First rule of New York: leave the apartment.",
    cards: [
      { art: "🗺️", t: "This is Astoria. Allegedly the best part of Queens.", b: "Every building is a place you can go. Names show the big ones; dots are the rest. Tap any of them to see what goes on there." },
      { art: "🌫️", t: "The other boroughs are under fog.", b: "Manhattan, Brooklyn and friends open later. For now, Queens is your whole world. Act like it." },
    ],
    hint: "Tap a place to open its card", targets: [".map-pin", ".compact-dot", MAP],
    check: { seen: true }, reward: { clout: 15 }, done: "You opened your first place card",
  },
  {
    id: "1.2", chapter: 1, tag: "Getting around", tip: "Pick a spot. Any spot. Commit.",
    cards: [
      { art: "🚇", t: "Walk, train or rideshare.", b: "Walking is free and slow. The subway rides the place's line and sometimes has delays. Rideshare is fast and charges like it." },
      { art: "⏱️", t: "Trips take real seconds.", b: "Each trip costs a little C$ and Energy. You can skip the wait for C$, but honestly, enjoy the view." },
    ],
    hint: "Open a place, then tap Go there", targets: ["[data-guide=travel-go]", ".map-pin", ".compact-dot", MAP],
    check: { seen: true }, reward: { cash: 50 }, done: "You made it across Astoria",
  },
  {
    id: "1.3", chapter: 1, tag: "Places", tip: "Inside is where the clout is.",
    cards: [
      { art: "🥪", t: "Every place has a room you can walk around.", b: "Tap the floor to walk. Tap people to talk: the regular behind the counter has opinions, and so does everyone else." },
      { art: "🕘", t: "Places keep hours.", b: "Some close at night, some only open at night. The place card says when it opens, and \"Happening now\" says what's on." },
    ],
    hint: "Tap someone in the room to talk", targets: [MAP],
    check: { seen: true }, reward: { clout: 15 }, done: "They talked back. Sort of.",
  },
  {
    id: "1.4", chapter: 1, tag: "Clout", tip: "Clout is the whole point. Obviously.",
    cards: [
      { art: "🔥", t: "Clout is how famous you are.", b: "You get it for being seen: going places, doing things, finishing tasks, showing up to events. It never goes down." },
      { art: "🪜", t: "Ten ranks, from Ramen Noodle Era to God Status.", b: "Every rank opens something: better gigs, club doors, VIP ropes, bigger apartments. Your clout sits by the 🔥 at the top." },
      { art: "👀", t: "Everyone can see it.", b: "The leaderboard ranks Queens by clout. Yes, people check." },
    ],
    hint: "Tap your clout to see where you stand", targets: ['button[aria-label="Clout score"]'],
    check: { seen: true }, reward: { clout: 15 }, done: "You know where you stand. Rank 1, but still.",
  },
  {
    id: "1.5", chapter: 1, tag: "Clout", tip: "Do something. Be seen.",
    cards: [
      { art: "⚡", t: "Every place has things to do.", b: "Each one pays clout, Mood or Confidence, and costs a little Energy. Some only count once a day." },
      { art: "📈", t: "Where you do it matters.", b: "Fancier places pay more clout. Your Mood and Confidence turn up the volume on all of it." },
    ],
    hint: "Open the place's list and pick one", targets: ['button[aria-label^="Show "][aria-label$=" actions"]', MAP],
    check: { ledger: ["visit", "shift"] }, reward: { clout: 20 }, done: "You did a thing. People noticed.",
  },
  {
    id: "1.6", chapter: 1, tag: "Clout", tip: "Five tasks a day keeps obscurity away.",
    cards: [
      { art: "✅", t: "Five tasks, every New York day.", b: "One gossip task, two for your current goal, one for a skill, one wild card. Each pays C$ and clout." },
      { art: "🎁", t: "Finish all five for the bonus.", b: "All five also keeps your streak alive and fills the Clout Pass. The counter at the top shows how many are done." },
    ],
    hint: "Your tasks live here", targets: ['button[aria-label^="Tasks and goals"]'],
    check: { ledger: ["daily_bonus"] }, reward: { cash: 150 }, done: "All five done. The city noticed.",
  },
  {
    id: "1.7", chapter: 1, tag: "Clout", tip: "Everybody's talking. Listen.",
    cards: [
      { art: "🍵", t: "The Tea app collects gossip.", b: "Talk to people at places. Every so often someone lets something slip, and it lands in Tea." },
      { art: "🗞️", t: "Collect a whole story.", b: "Each piece pays clout. Find every piece of a story to finish it and get the big reward." },
    ],
    hint: "Talk to people at a place. Someone always knows something.", targets: [MAP],
    check: { gossip: true }, reward: { clout: 20 }, done: "You found your first piece of tea",
  },
  {
    id: "1.8", chapter: 1, tag: "Clout", tip: "Tonight we go out.",
    cards: [
      { art: "🪩", t: "Events pay the most clout.", b: "Club nights, parties and real-date calendar events. Each runs at set hours on the city clock." },
      { art: "📋", t: "Some doors have a list.", b: "Bigger clubs need more clout (or a skill, or a guest-list pass). Start small and work your way to the velvet rope." },
    ],
    hint: "See what's on tonight", targets: ['button[aria-label="Events"]', MAP],
    check: { events: true }, reward: { clout: 30 }, done: "You went out. You were seen.",
  },
  {
    id: "1.9", chapter: 1, tag: "Stats", tip: "Your vitals, bestie.",
    cards: [
      { art: "🔋", t: "Energy, Mood, Confidence.", b: "Energy is spent on everything and comes back with sleep and food. Mood and Confidence make every bit of clout count for more." },
      { art: "💡", t: "Each stat tells you what raises it.", b: "Open the panel and every bar lists a few things to do about it, right there." },
    ],
    hint: "Open your stats", targets: ['button[aria-label="Expand stats"]'],
    check: { seen: true }, reward: { cash: 50 }, done: "Vitals checked. Hydrate.",
  },
  {
    id: "1.10", chapter: 1, tag: "The Phone", tip: "Your phone is your whole personality now.",
    cards: [
      { art: "📱", t: "Everything lives in your phone.", b: "Messages, your Bank, Apartments, Jobs, News, the Tea app and more. A pink dot means something's waiting." },
      { art: "💬", t: "Check your messages.", b: "People text. Lola texts the most. Open Messages and see who's been talking." },
    ],
    hint: "Open your Phone, then Messages", targets: ["text:Phone"],
    check: { seen: true }, reward: { clout: 15 }, done: "Inbox checked. Good manners pay.",
  },
  {
    id: "1.11", chapter: 1, tag: "Clout", tip: "Don't break the streak.",
    cards: [
      { art: "🔥", t: "All five tasks a day builds a streak.", b: "Three days in a row and it starts paying: clout, furniture you can't buy, guest-list passes." },
      { art: "🧯", t: "Life happens.", b: "One missed day a week is forgiven. Break it anyway and you have three days to repair it." },
    ],
    hint: "Finish today's five to keep it going", targets: ['button[aria-label^="Tasks and goals"]'],
    check: { streak: 3 }, reward: { clout: 30 }, done: "Three days straight. Consistency is hot.",
  },
  {
    id: "1.12", chapter: 1, tag: "Clout", tip: "Goals: the long game.",
    cards: [
      { art: "🎯", t: "Goals are bigger than tasks.", b: "Live alone. Become a regular somewhere. Get on a guest list. Each one pays when you get there." },
      { art: "🧭", t: "The game suggests one.", b: "Two of your daily tasks always push your current goal forward. New goals open as your rank goes up." },
    ],
    hint: "Goals are a tab in Tasks", targets: ['button[aria-label^="Tasks and goals"]'],
    check: { ledger: ["goal"] }, reward: { clout: 30 }, done: "Goal done. Look at you, planning.",
  },
  {
    id: "1.13", chapter: 1, tag: "Astoria Park", tip: "Free Wi-Fi and a dog with a trust fund.", who: "barksley",
    cards: [
      { art: "🐕", t: "Meet Sir Barksley.", b: "A billionaire's Pomeranian, deeply depressed, lives in Astoria Park. His walker Dmitri posts daily updates." },
      { art: "💸", t: "He tips.", b: "Be nice to him and he leaves you something for your trouble. He has nothing else to spend it on." },
    ],
    hint: "Find Sir Barksley in Astoria Park", targets: [MAP],
    check: { seen: true }, reward: { cash: 150 }, done: "Sir Barksley tipped you. He seems slightly less sad.",
  },
];

export const stepById = (id: string) => STEPS.find((s) => s.id === id);
export const chapterSteps = (n: number) => STEPS.filter((s) => s.chapter === n);

/** game_settings 'guide': what the server checks and pays, by step and chapter (tests/guide.test.ts compares). */
export function guideSettings() {
  return {
    steps: Object.fromEntries(STEPS.map((s) => [s.id, { chapter: s.chapter, check: s.check, cash: s.reward.cash ?? 0, clout: s.reward.clout ?? 0 }])),
    chapters: Object.fromEntries(CHAPTERS.filter((c) => c.live).map((c) => [String(c.n), { badge: c.badgeId, cash: c.reward.cash ?? 0, clout: c.reward.clout ?? 0, steps: chapterSteps(c.n).map((s) => s.id) }])),
  };
}

/** The player's Guide: steps paid, steps the game has seen done, chapters paid (guide_state). */
export interface GuideState { paid: string[]; ready: string[]; chapters: number[]; day: number; rank: number }

/** Opens? A chapter is open from its day or rank (and only when its steps are written). */
export const chapterOpen = (c: GuideChapter, s: Pick<GuideState, "day" | "rank">) => c.live && (c.day === undefined || s.day >= c.day) && (c.rank === undefined || s.rank >= c.rank);

/** The one recommended step: the first unpaid step of the first open chapter, in order. Null when everything open is done. */
export function nextStep(s: GuideState): GuideStep | null {
  for (const c of CHAPTERS) {
    if (!chapterOpen(c, s)) continue;
    const step = chapterSteps(c.n).find((x) => !s.paid.includes(x.id));
    if (step) return step;
  }
  return null;
}

/** A finished chapter waiting to pay its badge and reward. */
export const chapterDue = (s: GuideState) => CHAPTERS.find((c) => c.live && !s.chapters.includes(c.n) && chapterSteps(c.n).every((x) => s.paid.includes(x.id))) ?? null;

export const rewardText = (r: { cash?: number; clout?: number }) => [r.cash ? `+C$${r.cash.toLocaleString("en-US")}` : "", r.clout ? `+${r.clout} clout` : ""].filter(Boolean).join(" · ");

/** What GameShell is handed: the server actions (app/home/guideActions.ts) or the preview's memory (lib/guideSim.ts). */
export interface GuideApi {
  /** The server doesn't know the rank the way the game shows it; GameShell adds it. */
  state(): Promise<Omit<GuideState, "rank"> | null>;
  /** The preview only: "Show me" began for a step the server would check (lib/guideSim.ts counts it done shortly after). */
  shown?(step: string): void;
  seen(step: string): Promise<void>;
  claim(step: string): Promise<{ cash: number; clout: number; chapter: number | null } | null>;
}
