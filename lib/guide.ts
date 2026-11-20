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
  | { streak: number }
  /** Rested this way on any day (player_rest: sleep, nap, sit). */
  | { rest: "sleep" | "nap" | "sit" }
  /** Practised this skill (skill_log). */
  | { skill: string }
  /** Paid a bill (bills). */
  | { bill: true }
  /** Has one of these (each a table the server reads): an aspiration, a career job, a workday done, an office move, a
   *  business, a job on the players' Jobs board (posted or taken). */
  | { has: "aspiration" | "job" | "workday" | "office_move" | "business" | "board_job" | "hunt_step" | "shoutout"
      | "layout" | "placed_piece" | "home_plan" | "garden" | "moved_up" | "hosted"
      | "skill_task" | "skill2" | "skill3" | "look_saved" | "fashion" | "dressed_out"
      | "message" | "crush" | "couple" | "moved_in" | "gift" | "choice" | "favor" | "held" | "underworld"
      | "enrolled" | "exam_pass" | "crown_race" | "campaign" | "campaign_week" | "biz_upgrade" | "tv" | "mayor_letter" };

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
  /** A step that opens later than its chapter (Rank 2 for businesses and the Jobs board): until then the Guide skips it. */
  opens?: { rank?: number; day?: number };
  /** Not every player can or wants to (dating, Pablo, holding): it pays, but the chapter doesn't wait for it, and its tip
   *  card offers "Skip this one" (kept on the device). */
  optional?: boolean;
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
  /** A reward-only piece given with the chapter (acquired 'earned', value 0). */
  item?: { sku: string; name: string };
  /** False until its steps are written: shown as "Coming soon". */
  live: boolean;
  /** Finished after any this many of its steps (Big plays: three); otherwise every step that isn't optional. */
  need?: number;
}

export const CHAPTERS: GuideChapter[] = [
  // Owner, Nov 20 ("go with your recommendation"): the Guide replaces Starter Week for new players, so Chapter 1's finish takes
  // over Starter Week's: C$1,000 and the violet rug.
  { n: 1, title: "Arrival", day: 1, badge: "Off the Bus", badgeId: "guide-1", reward: { cash: 1000 }, item: { sku: "home-rug-violet", name: "the violet rug" }, live: true },
  { n: 2, title: "Looking after yourself", day: 1, badge: "Adulting (Allegedly)", badgeId: "guide-2", reward: { cash: 300 }, live: true },
  { n: 3, title: "Money", day: 2, badge: "Bag Secured", badgeId: "guide-3", reward: { cash: 500 }, live: true },
  { n: 4, title: "More clout", day: 2, badge: "Locally Relevant", badgeId: "guide-4", reward: { clout: 150 }, live: true },
  { n: 5, title: "Home", day: 3, badge: "Landlord's Nightmare", badgeId: "guide-5", reward: { cash: 400 }, live: true },
  { n: 6, title: "Skills", day: 3, badge: "Multi-Hyphenate", badgeId: "guide-6", reward: { clout: 100 }, live: true },
  { n: 7, title: "Style", day: 2, badge: "Main Character Fit", badgeId: "guide-7", reward: { clout: 100 }, live: true },
  { n: 8, title: "People", day: 2, badge: "Plus One", badgeId: "guide-8", reward: { clout: 150 }, live: true },
  { n: 9, title: "Choices", day: 1, badge: "It's Complicated", badgeId: "guide-9", reward: { clout: 100 }, live: true },
  { n: 10, title: "Big plays", rank: 2, badge: "Big Plans", badgeId: "guide-10", reward: { clout: 200 }, live: true, need: 3 },
  { n: 11, title: "The city", day: 4, badge: "Well Informed", badgeId: "guide-11", reward: { clout: 100 }, live: true },
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

// ---- Chapter 2: Looking after yourself (owner, Nov 20: "write chapter 2"). The roommate step (2.7 in the doc) is folded into
// 2.6's cards: only room-share players could do it, and a step some players can't do would hold their chapter back.
const HOME = "text:Home";
STEPS.push(
  {
    id: "2.1", chapter: 2, tag: "Energy", tip: "Energy is a currency. You're broke in it.",
    cards: [
      { art: "🔋", t: "Everything costs Energy.", b: "Trips, actions, shifts and work all spend it. At zero you can still scroll, but that's about it." },
      { art: "🛏️", t: "Sleep is the big refill.", b: "Sleep in your own bed once a day for +80 Energy. Naps and sitting down top you up in between." },
    ],
    hint: "Go home and tap your bed", targets: [HOME],
    check: { rest: "sleep" }, reward: { clout: 15 }, done: "Eight hours. Or the game version of it.",
  },
  {
    id: "2.2", chapter: 2, tag: "Food", tip: "Sal says you look hungry.",
    cards: [
      { art: "🥯", t: "Eating out is the easy way.", b: "Delis, cafés and diners sell meals. A meal brings back Energy and usually a little Mood." },
      { art: "🧾", t: "Regulars get remembered.", b: "Go back to the same spot on three different days and they start remembering your order. Sal does, anyway." },
    ],
    hint: "Eat a meal at a deli, café or diner", targets: [".map-pin", ".compact-dot", MAP],
    check: { ledger: ["eat"] }, reward: { cash: 50 }, done: "Fed. Sal approves.",
  },
  {
    id: "2.3", chapter: 2, tag: "Food", tip: "Groceries: cheaper than takeout, harder than takeout.",
    cards: [
      { art: "🛒", t: "Supermarkets sell bundles.", b: "A bundle fills your fridge with meals for home. Cheaper per meal than eating out, if you actually cook them." },
      { art: "🧊", t: "Your fridge keeps count.", b: "The kitchen at home shows how many meals are left. When it's empty, it's back to the store." },
    ],
    hint: "Buy groceries at a supermarket", targets: [".map-pin", ".compact-dot", MAP],
    check: { ledger: ["groceries"] }, reward: { cash: 50 }, done: "Fridge stocked. Very adult of you.",
  },
  {
    id: "2.4", chapter: 2, tag: "Cooking", tip: "Let's get your cooking up.",
    cards: [
      { art: "🍳", t: "Cook at home.", b: "Tap the kitchen at home to cook a meal from your fridge. It brings back Energy for the price of the groceries." },
      { art: "📈", t: "Cooking is a skill.", b: "Every meal you cook practises it. At levels 3, 6 and 9 it opens cooking gigs, invites and perks." },
    ],
    hint: "Tap the kitchen at home to cook", targets: [HOME],
    check: { skill: "cooking" }, reward: { clout: 20 }, done: "You cooked. Nobody got hurt.",
  },
  {
    id: "2.5", chapter: 2, tag: "Mood", tip: "Mood is the vibe tax.",
    cards: [
      { art: "🙂", t: "Mood turns up your clout.", b: "Clout from going places is bigger in a good mood and smaller in a bad one." },
      { art: "🛋️", t: "Easy ways up.", b: "Sit down at home, eat, hang out at a park, have people over. Each stat panel row lists a few more." },
    ],
    hint: "Sit on your sofa at home for a while", targets: [HOME],
    check: { rest: "sit" }, reward: { clout: 15 }, done: "Vibes restored. Mostly.",
  },
  {
    id: "2.6", chapter: 2, tag: "Bills", tip: "Rent is due. Rent is always due.",
    cards: [
      { art: "🧾", t: "Rent comes every week.", b: "So do the phone bill and, if you have one, the car. Bills shows what's due and when." },
      { art: "🚨", t: "Late is bad. Eviction is worse.", b: "A red card on the home screen warns you when the bank is short. Miss rent long enough and you're back in the room share." },
      { art: "🧑‍🤝‍🧑", t: "Roommates split it.", b: "In the room share your roommate pays half. Living with a partner splits it too. Everyone else pays the whole thing." },
    ],
    hint: "Open Bills and pay one", targets: ['button[aria-label="Bills"]'],
    check: { bill: true }, reward: { cash: 100 }, done: "Bill paid. Your landlord felt nothing.",
  },
);

// ---- Chapter 3: Money (owner, Nov 20: "keep going"). The doc's skill-gig step waits for Chapter 6 (it needs a skill at level 3,
// weeks away) and the Market step is left out (it opens only when the owner switches the Market on).
const PHONE = "text:Phone";
STEPS.push(
  {
    id: "3.1", chapter: 3, tag: "Money", tip: "Rent won't pay itself. Neither will you, yet.",
    cards: [
      { art: "💸", t: "Money comes from a few places.", b: "Gigs and shifts now, a career job and businesses later, and selling things you don't need." },
      { art: "🧮", t: "Work backwards from rent.", b: "Your rent is due every week. Bills shows how much and when; everything else is for fun." },
    ],
    hint: "Open your Phone, then Gigs", targets: [PHONE],
    check: { seen: true }, reward: { clout: 15 }, done: "Gigs found. Hustle unlocked.",
  },
  {
    id: "3.2", chapter: 3, tag: "Gigs", tip: "Gigs: honest work, dishonest hours.",
    cards: [
      { art: "📋", t: "Take one, wait, collect.", b: "Accept a gig on the board, wait while it runs, then collect the pay. It costs a little Energy." },
      { art: "⬆️", t: "Bigger gigs open with rank.", b: "Pro gigs open at Rank 3 and the big ones at Rank 5. Confidence matters for the best ones." },
    ],
    hint: "Accept a gig, then collect it", targets: [PHONE],
    check: { ledger: ["gig"] }, reward: { cash: 100 }, done: "Paid. Don't spend it all on oat milk.",
  },
  {
    id: "3.3", chapter: 3, tag: "Shifts", tip: "Pick up a shift.",
    cards: [
      { art: "🧑‍🍳", t: "Places pay for shifts.", b: "Cafés, delis and shops have a shift in their list. Go there, work it, get paid on the spot." },
      { art: "🔋", t: "Shifts cost Energy.", b: "A couple a day at most. Sleep and food bring the Energy back." },
    ],
    hint: "Work a shift at a café, deli or shop", targets: [".map-pin", ".compact-dot", MAP],
    check: { ledger: ["shift"] }, reward: { cash: 50 }, done: "Shift done. Your feet hurt. Worth it.",
  },
  {
    id: "3.4", chapter: 3, tag: "Net worth", tip: "Your stuff is worth money. Some of it.",
    cards: [
      { art: "💎", t: "Net worth is everything you own.", b: "Cash, clothes, furniture, cars, businesses. Your rank counts it too, not just clout." },
      { art: "🏷️", t: "You can sell things back.", b: "Each piece shows what the game pays for it. Clothes lose value once worn. Some things are worth keeping." },
    ],
    hint: "Tap the diamond to see your net worth", targets: ['button[aria-label="Net worth"]'],
    check: { seen: true }, reward: { clout: 15 }, done: "You're worth something. Officially.",
  },
  {
    id: "3.5", chapter: 3, tag: "Careers", tip: "Time for a real job.",
    cards: [
      { art: "🎯", t: "Start with an aspiration.", b: "Corporate, influencer, streamer, celebrity, hustler, public servant or stay-at-home. It decides where you start." },
      { art: "🪜", t: "Every career is a ladder.", b: "Five levels, a boss, coworkers and a weekly review. Your aspiration's careers start you a level up." },
    ],
    hint: "Open Careers in your Phone and pick an aspiration", targets: [PHONE],
    check: { has: "aspiration" }, reward: { clout: 30 }, done: "Aspiration chosen. Manifesting.",
  },
  {
    id: "3.6", chapter: 3, tag: "Careers", tip: "Apply. Pretend you read the job description.",
    cards: [
      { art: "📝", t: "Apply for a job.", b: "Pick a career, answer the interview and you're in. Your skills decide where you start." },
      { art: "🏢", t: "One job at a time.", b: "Quit and you wait 2 days for that track; get fired and it's 7. Choose wisely, or at least quickly." },
    ],
    hint: "Apply for a job in Careers", targets: [PHONE],
    check: { has: "job" }, reward: { cash: 150 }, done: "Hired. Your mother is thrilled.",
  },
  {
    id: "3.7", chapter: 3, tag: "Careers", tip: "Clock in.",
    cards: [
      { art: "⏰", t: "A workday is the day's work.", b: "Go to your employer and tap Go to work. Pick hustle, steady or coast, then handle the day's tasks." },
      { art: "🔋", t: "It costs Energy and Mood.", b: "Work also practises the job's key skills. One workday a day, and no shifts after it." },
    ],
    hint: "Go to work at your employer", targets: [".map-pin", ".compact-dot", MAP],
    check: { has: "workday" }, reward: { cash: 100 }, done: "Clocked in, clocked out. Capitalism.",
  },
  {
    id: "3.8", chapter: 3, tag: "Careers", tip: "Office politics: optional, inevitable.",
    cards: [
      { art: "🤝", t: "Help someone, or don't.", b: "On a workday you get one move to help a coworker and one to get ahead of them." },
      { art: "🗂️", t: "People remember.", b: "Your work friend, your rival and your boss all keep score. Sabotage leaves grudges." },
    ],
    hint: "Make an office move on a workday", targets: [PHONE],
    check: { has: "office_move" }, reward: { clout: 20 }, done: "Politics played. Somebody noticed.",
  },
  {
    id: "3.9", chapter: 3, tag: "Careers", tip: "Friday is review day.",
    cards: [
      { art: "📈", t: "The weekly review pays you.", b: "Your wage, any tips, and a verdict on the week. Good weeks lead to promotions." },
      { art: "⚠️", t: "Bad weeks add strikes.", b: "A warning, then probation, then a demotion. Two good weeks in a row clear them." },
    ],
    hint: "Work this week, then open Careers for your review", targets: [PHONE],
    check: { ledger: ["career_pay"] }, reward: { clout: 30 }, done: "Payday. The best day.",
  },
  {
    id: "3.10", chapter: 3, tag: "Businesses", tip: "Be your own boss. Regret it later.", opens: { rank: 2 },
    cards: [
      { art: "🏪", t: "Buy a business.", b: "Businesses earn while you're away. Collect the takings in the Businesses app." },
      { art: "🪜", t: "Upgrade it.", b: "Each upgrade earns more. Climb the whole ladder and you can take it public." },
    ],
    hint: "Open Businesses in your Phone and buy one", targets: [PHONE],
    check: { has: "business" }, reward: { cash: 200 }, done: "Business owner. Put it in your bio.",
  },
  {
    id: "3.11", chapter: 3, tag: "Jobs board", tip: "Other people pay for errands.", opens: { rank: 2 },
    cards: [
      { art: "📌", t: "The Jobs board is players hiring players.", b: "Post a job, like decorating your home or running a business, or take one someone else posted." },
      { art: "⭐", t: "Ratings follow you.", b: "Clients rate the work. The game takes 5% of the pay." },
    ],
    hint: "Open Jobs in your Phone and take or post one", targets: [PHONE],
    check: { has: "board_job" }, reward: { clout: 20 }, done: "Networking, but make it paid.",
  },
);

// ---- Chapter 4: More clout (the clout basics are in Chapter 1).
STEPS.push(
  {
    id: "4.1", chapter: 4, tag: "Nightlife", tip: "Get on the list.",
    cards: [
      { art: "🚪", t: "Clubs have a door.", b: "Each club wants a certain clout to get in, or a cover. Some nights are free; the big ones aren't." },
      { art: "🕺", t: "Other ways past the rope.", b: "Rank 5 opens the exclusive door, Dance at level 3 gets you into every club, and a guest-list pass works once." },
    ],
    hint: "Go inside any club", targets: [".map-pin", ".compact-dot", MAP],
    check: { seen: true }, reward: { clout: 20 }, done: "You're in. Act like you've been here before.",
  },
  {
    id: "4.2", chapter: 4, tag: "Nightlife", tip: "VIP: same drinks, better lighting.",
    cards: [
      { art: "🍾", t: "Every club has a VIP floor.", b: "It's upstairs, behind the rope. Pay the cover, or get in free with enough clout." },
      { art: "📸", t: "Get seen in VIP.", b: "Once a day per club it pays twice the main floor's clout. That's the whole point of VIP." },
    ],
    hint: "Go up to a club's VIP floor and get seen", targets: [".map-pin", ".compact-dot", MAP],
    check: { ledger: ["vip"] }, reward: { clout: 40 }, done: "Seen in VIP. Your mother would be confused.",
  },
  {
    id: "4.3", chapter: 4, tag: "Places", tip: "Every place has its thing.",
    cards: [
      { art: "✨", t: "Signature activities.", b: "Each place has something only it does, once a New York day. Pick an option; your skills help it go well." },
      { art: "🗓️", t: "Happenings and regular cards.", b: "Some hours have a happening on. Visit a place on 3, 7 and 15 days and you become a regular, with a perk." },
    ],
    hint: "Do a place's signature activity", targets: ['button[aria-label^="Show "][aria-label$=" actions"]', ".map-pin", ".compact-dot", MAP],
    check: { ledger: ["place_life"] }, reward: { clout: 20 }, done: "Very on brand for that place.",
  },
  {
    id: "4.4", chapter: 4, tag: "Hunts", tip: "Saturday is hunt day.",
    cards: [
      { art: "🗺️", t: "A new treasure hunt every Saturday.", b: "Join it, follow the clues around the city and answer the question at each stop." },
      { art: "🎁", t: "The chest at the end.", b: "Finish the hunt for a big C$ and clout reward. A wrong answer only slows you down." },
    ],
    hint: "Join this week's hunt and solve a clue", targets: ['button[aria-label^="New treasure hunt"]', 'button[aria-label^="Treasure hunt"]', 'button[aria-label^="Tasks and goals"]'],
    check: { has: "hunt_step" }, reward: { clout: 30 }, done: "Clue solved. Very National Treasure of you.",
  },
  {
    id: "4.5", chapter: 4, tag: "Stories", tip: "Read the drama.",
    cards: [
      { art: "📰", t: "The city has a main story.", b: "New chapters land in News. The full blog posts tell you what really happened." },
      { art: "🔥", t: "Reading pays.", b: "Each full post you read pays 10 clout, once. Stories also send you tasks and events." },
    ],
    hint: "Open News in your Phone and read a full post", targets: [PHONE],
    check: { ledger: ["story_read"] }, reward: { cash: 50 }, done: "Caught up. You know things now.",
  },
  {
    id: "4.6", chapter: 4, tag: "Calendar", tip: "Mark your calendar.",
    cards: [
      { art: "📅", t: "Real-date events.", b: "Holidays, name days and big nights happen on their real dates. Invites show on your Phone two weeks out." },
      { art: "🎁", t: "Bring a gift, dress up.", b: "Some invites expect a gift box from the deli. Wearing something from the Shop pays extra clout." },
    ],
    hint: "Go to a calendar event when one is on", targets: ['button[aria-label="Events"]', PHONE],
    check: { ledger: ["calendar"] }, reward: { clout: 30 }, done: "You showed up. Half of life, apparently.",
  },
  {
    id: "4.7", chapter: 4, tag: "Clout Pass", tip: "The Clout Pass.",
    cards: [
      { art: "🎟️", t: "Tasks and goals fill the Pass.", b: "Daily tasks, all five and goals earn Pass XP. Each level has a free reward." },
      { art: "📆", t: "Three challenges a week.", b: "They pay extra XP. The paid row adds pieces you can't buy; VIP includes it." },
    ],
    hint: "Open the Clout Pass and collect a reward", targets: ['button[aria-label^="Clout Pass"]', 'button[aria-label^="Tasks and goals"]'],
    check: { ledger: ["season_free"] }, reward: { clout: 20 }, done: "Collected. Free stuff hits different.",
  },
  {
    id: "4.8", chapter: 4, tag: "On air", tip: "Get yourself on the radio.",
    cards: [
      { art: "📻", t: "Real Clout FM reads shoutouts.", b: "Send one with your handle. The best ones go on air for the whole city." },
      { art: "📺", t: "Clout TV has a Big Screen.", b: "Send a photo; picks rotate every three hours. Being on air or on screen pays clout." },
    ],
    hint: "Send Real Clout FM a shoutout from your Phone", targets: [PHONE],
    check: { has: "shoutout" }, reward: { clout: 20 }, done: "Shoutout sent. Fingers crossed.",
  },
);

// ---- Chapter 5: Home (Gary Pomeroy of No-Fee* Realty for the apartments). The doc's sublets step is left out: only renters
// of the bigger homes can list a room, and a step some players can't do would hold their chapter back.
const HOME_TAB = "text:Home";
STEPS.push(
  {
    id: "5.1", chapter: 5, tag: "Home", tip: "Make it yours.",
    cards: [
      { art: "🛋️", t: "Arrange your home.", b: "Tap the sofa button at home, then tap a piece to move or turn it. Save when it looks right." },
      { art: "📦", t: "Storage holds the rest.", b: "Pieces you've bought but not placed wait in storage. Put one away to make room." },
    ],
    hint: "Tap 🛋️ at home, move a piece and save", targets: ['button[aria-label^="Arrange your home"]', HOME_TAB],
    check: { has: "layout" }, reward: { clout: 15 }, done: "Feng shui achieved. Allegedly.",
  },
  {
    id: "5.2", chapter: 5, tag: "Home", tip: "Fif's has furniture. You have a floor.",
    cards: [
      { art: "🪑", t: "Furniture lives in the Shop.", b: "Under Furniture. Try it at home first: it appears where you'd put it before you pay." },
      { art: "⭐", t: "Nicer pieces score higher.", b: "Every bought piece you place counts toward your Crib Rating, the better the piece, the more." },
    ],
    hint: "Buy a piece in the Shop and place it at home", targets: ["text:Shop"],
    check: { has: "placed_piece" }, reward: { cash: 100 }, done: "New furniture. Very grown up.",
  },
  {
    id: "5.3", chapter: 5, tag: "Crib Rating", tip: "Your Crib Rating.",
    cards: [
      { art: "🏠", t: "Out of 100, for the place you live now.", b: "Rooms with a bought piece, the quality of what you've placed, and art on the walls." },
      { art: "🎉", t: "Milestones pay clout.", b: "40, 70 and 100 each pay once. A small place can hit 100 as easily as a penthouse." },
    ],
    hint: "Tap your Crib Rating at home", targets: ['button[aria-label^="Crib Rating"]', HOME_TAB],
    check: { seen: true }, reward: { clout: 15 }, done: "Rated. No notes. Well, some notes.",
  },
  {
    id: "5.4", chapter: 5, tag: "Build mode", tip: "Knock down a wall. Legally.",
    cards: [
      { art: "🔨", t: "Build mode changes the home itself.", b: "Add rooms; the walls and a doorway follow. Drag a room to move it, a corner to resize it." },
      { art: "🎨", t: "Floors and paint too.", b: "Pick each room's floor and the whole home's paint. It's priced as you go and paid when you build." },
    ],
    hint: "Tap 🔨 at home and build something", targets: ['button[aria-label^="Build mode"]', HOME_TAB],
    check: { has: "home_plan" }, reward: { cash: 100 }, done: "Renovated. The landlord will never know.",
  },
  {
    id: "5.5", chapter: 5, tag: "Outside", tip: "Touch grass. Your own grass.",
    cards: [
      { art: "🌳", t: "Every home has an Outside.", b: "Tap Outside at home to see your lawn, then build mode to lay a patio, a path or a pool." },
      { art: "🌷", t: "Plant things.", b: "Trees, hedges, flower beds, a grill, a hot tub. Each is paid when you build." },
    ],
    hint: "Go Outside and place a garden piece in build mode", targets: ['button[aria-label^="Build mode"]', HOME_TAB],
    check: { has: "garden" }, reward: { clout: 30 }, done: "A garden in Queens. Iconic.",
  },
  {
    id: "5.6", chapter: 5, tag: "Apartments", tip: "View a new apartment.",
    cards: [
      { art: "🏢", t: "Gary has listings.", b: "\"No fee. The asterisk is doing a lot of work.\" The Apartments app lists every rental with its weekly rent." },
      { art: "🔑", t: "Some need clout.", b: "Bigger places want a certain clout before they'll take you. Look around any of them first, for free." },
    ],
    hint: "Open Apartments in your Phone and look around one", targets: [PHONE],
    check: { seen: true }, reward: { clout: 20 }, done: "Toured. Gary will be in touch. Constantly.",
  },
  {
    id: "5.7", chapter: 5, tag: "Apartments", tip: "Moving up.",
    cards: [
      { art: "📦", t: "Moving costs the first week and a fee.", b: "Your old place's rent stops; the new one's starts a week later." },
      { art: "🧱", t: "What you built stays behind.", b: "Build mode's rooms belong to the home you built them in. Your furniture comes with you." },
    ],
    hint: "Move to a bigger rental in Apartments", targets: [PHONE],
    check: { has: "moved_up" }, reward: { cash: 200 }, done: "Moved up. Literally.",
  },
  {
    id: "5.8", chapter: 5, tag: "Houses", tip: "Own it.",
    cards: [
      { art: "🏡", t: "Houses end rent forever.", b: "A townhouse, a penthouse or a duplex. Buy one in the Shop and rent is a thing of your past." },
      { art: "💼", t: "They hold their value.", b: "A house counts toward your net worth and can be sold to a friend later." },
    ],
    hint: "Look at the houses in the Shop", targets: ["text:Shop"],
    check: { seen: true }, reward: { clout: 20 }, done: "Window shopping for a mortgage. Bold.",
  },
  {
    id: "5.9", chapter: 5, tag: "Hosting", tip: "Have people over.",
    cards: [
      { art: "🥳", t: "Host a hangout or a party.", b: "Invite your crew, your partner or people you chat with. A hangout starts now; a party can be planned." },
      { art: "🏠", t: "Your Crib Rating boosts it.", b: "Guests who stay two minutes pay you clout, more the better your home is rated." },
    ],
    hint: "Open your stats, then Mood, then Have people over", targets: ['button[aria-label="Expand stats"]'],
    check: { has: "hosted" }, reward: { clout: 30 }, done: "Hosted. Nobody broke anything.",
  },
);

// ---- Chapter 6: Skills, and Chapter 7: Style.
const SKILLS = 'button[aria-label^="Skills"]';
STEPS.push(
  {
    id: "6.1", chapter: 6, tag: "Skills", tip: "You're good at things. Some things.",
    cards: [
      { art: "🎯", t: "Nine skills, 0 to 10.", b: "Cooking, Dance, Aura, Smarts, Hustle and more. Doing things practises the skill that goes with them." },
      { art: "🕸️", t: "Skills get rusty.", b: "Leave one alone too long and it slips back. A little practice keeps it sharp." },
    ],
    hint: "Open Skills on the side of the screen", targets: [SKILLS],
    check: { seen: true }, reward: { clout: 15 }, done: "Self-awareness: unlocked.",
  },
  {
    id: "6.2", chapter: 6, tag: "Skills", tip: "Practice makes slightly better.",
    cards: [
      { art: "📋", t: "One daily task is a skill task.", b: "It says which skill and where to practise it. Skills shows it on top." },
      { art: "📍", t: "Every skill has its places.", b: "Dance at clubs, Cooking at home, Smarts at the library. Each skill lists where it's practised." },
    ],
    hint: "Do today's skill task", targets: [SKILLS],
    check: { has: "skill_task" }, reward: { cash: 50 }, done: "Practised. Your future self thanks you.",
  },
  {
    id: "6.3", chapter: 6, tag: "Skills", tip: "Level up.",
    cards: [
      { art: "⬆️", t: "A new best level pays clout.", b: "Ten times the level, once. Levels 5 and 10 come with a badge." },
      { art: "🔁", t: "Practice counts once per thing.", b: "Doing the same thing twice in a day doesn't count twice. Mix it up." },
    ],
    hint: "Get any skill to level 2", targets: [SKILLS],
    check: { has: "skill2" }, reward: { clout: 20 }, done: "Level 2. Practically an expert.",
  },
  {
    id: "6.4", chapter: 6, tag: "Perks", tip: "Perks: the good part.",
    cards: [
      { art: "🎁", t: "Levels 3, 6 and 9 open a perk.", b: "A skill gig, an invite or access. Dance 3 gets you past every club door; Dance 9 onto every VIP floor." },
      { art: "📈", t: "Perks use your level now.", b: "If a skill goes rusty below the level, its perk waits until you're back." },
    ],
    hint: "Get any skill to level 3", targets: [SKILLS],
    check: { has: "skill3" }, reward: { clout: 40 }, done: "Perk unlocked. You're a professional now.",
  },
  {
    id: "6.5", chapter: 6, tag: "Perks", tip: "Somebody wants you.",
    cards: [
      { art: "💌", t: "Skills bring invites.", b: "At their level, some skills get you invited somewhere. Accepting pays clout once." },
      { art: "🏅", t: "Level 9's invite has a badge.", b: "The top invites come with a perk badge for your profile." },
    ],
    hint: "Accept a skill invite in Skills", targets: [SKILLS],
    check: { ledger: ["skill_invite"] }, reward: { clout: 20 }, done: "Invited. Popular, even.",
  },
  {
    id: "7.1", chapter: 7, tag: "Style", tip: "Let's talk about your outfit.",
    cards: [
      { art: "👕", t: "Your Look is your wardrobe.", b: "Tops, bottoms, shoes and the cap your style came with, free. Mix them and save." },
      { art: "🧢", t: "Extras come from the Shop.", b: "Hats, jewellery, bags and the rest are Shop pieces. Once owned, they show up in Your Look." },
    ],
    hint: "Open Your Look, change a piece and save", targets: ['button[aria-label="Your look"]'],
    check: { has: "look_saved" }, reward: { clout: 15 }, done: "New fit. Very main character.",
  },
  {
    id: "7.2", chapter: 7, tag: "Shop", tip: "The Shop.",
    cards: [
      { art: "🛍️", t: "New in the Shop comes first.", b: "Every tab lists cheapest first. Some pieces want a certain clout before they'll sell to you." },
      { art: "🔥", t: "Buying pays clout.", b: "Each new piece pays a little clout, less for each one after. Try clothes on before you buy." },
    ],
    hint: "Buy a piece of clothing in the Shop", targets: ["text:Shop"],
    check: { has: "fashion" }, reward: { cash: 50 }, done: "Bought. Retail therapy is therapy.",
  },
  {
    id: "7.3", chapter: 7, tag: "Style", tip: "Dress for the door.",
    cards: [
      { art: "🎟️", t: "Events notice what you wear.", b: "A Shop piece on at an event pays dress-code clout. Some invites expect it." },
      { art: "🪞", t: "Wear it out.", b: "Put on something from the Shop in Your Look, then go to an event." },
    ],
    hint: "Wear a Shop piece and go to an event", targets: ['button[aria-label="Events"]'],
    check: { has: "dressed_out" }, reward: { clout: 30 }, done: "Dressed for it. The door noticed.",
  },
  {
    id: "7.4", chapter: 7, tag: "Couture", tip: "Gold means real money.",
    cards: [
      { art: "👑", t: "Clout Couture is real-money only.", b: "Numbered pieces in the Shop's Couture tab. Gold always means real money; C$ never buys it." },
      { art: "🎟️", t: "VIP is the other real-money thing.", b: "Unlimited chat, every side story and the Clout Pass. Optional, always." },
    ],
    hint: "Open the Shop and look at Couture", targets: ["text:Shop"],
    check: { seen: true }, reward: { clout: 15 }, done: "Looked. Didn't touch. Respect.",
  },
);

// ---- Chapter 8: People. Only the first three are needed for the chapter: dating, together plans and gifts need other people.
STEPS.push(
  {
    id: "8.1", chapter: 8, tag: "Crew", tip: "Invite your crew.",
    cards: [
      { art: "📨", t: "Bring your friends.", b: "Share your invite link. Each friend who joins pays you, and a full crew pays a bonus." },
      { art: "🧑‍🤝‍🧑", t: "Crews do things together.", b: "Crew outings, together bonuses, decorating each other's homes. It's more fun with people." },
    ],
    hint: "Tap Invite your Crew", targets: ["text:Invite your Crew"],
    check: { seen: true }, reward: { clout: 30 }, done: "Invites out. Popularity pending.",
  },
  {
    id: "8.2", chapter: 8, tag: "People", tip: "Meet people where they are.",
    cards: [
      { art: "👋", t: "Real players are out there.", b: "People with a blue name tag are other players. Tap one to see their card." },
      { art: "🛡️", t: "You're in charge.", b: "Block or report anyone from their card. Blocked players can't see or reach you." },
    ],
    hint: "Tap another player to open their card", targets: [".map-pin", ".compact-dot", MAP],
    check: { seen: true }, reward: { clout: 15 }, done: "Card opened. Very forward of you.",
  },
  {
    id: "8.3", chapter: 8, tag: "Messages", tip: "Slide into the DMs. Respectfully.",
    cards: [
      { art: "💬", t: "Message anyone you've met.", b: "From their card. Everyone gets 20 messages a day; VIP is unlimited." },
      { art: "🤝", t: "Chats open doors.", b: "People you talk to can be invited over, gifted things and hired on the Jobs board." },
    ],
    hint: "Send a player a message", targets: [PHONE],
    check: { has: "message" }, reward: { clout: 15 }, done: "Message sent. Now wait. Don't double text.",
  },
  {
    id: "8.4", chapter: 8, tag: "Together", tip: "Better together.", optional: true,
    cards: [
      { art: "🚕", t: "Plans with your crew pay more.", b: "Go somewhere together, share a ride, decorate someone's home. Together bonuses pay both of you." },
      { art: "📅", t: "Plan it in Messages.", b: "Pick a crewmate, pick a plan, meet there." },
    ],
    hint: "Make a together plan with a crewmate", targets: [PHONE],
    check: { ledger: ["together"] }, reward: { clout: 30 }, done: "Together bonus. Friendship, monetized.",
  },
  {
    id: "8.5", chapter: 8, tag: "Dating", tip: "A crush.", optional: true, opens: { day: 7 },
    cards: [
      { art: "💘", t: "Crushes are private until they match.", b: "Crush on someone from their card. If they crush back, it's a match." },
      { art: "🗓️", t: "Then plan a date night.", b: "A match can invite you to one of Lola's date spots, or you invite them." },
    ],
    hint: "Crush on a player from their card", targets: [PHONE],
    check: { has: "crush" }, reward: { clout: 15 }, done: "Crush logged. Your secret's safe.",
  },
  {
    id: "8.6", chapter: 8, tag: "Dating", tip: "Date night.", optional: true, opens: { day: 7 },
    cards: [
      { art: "🕯️", t: "Both of you show up.", b: "Be at the spot at the time. A date night that happens pays you both Mood and clout." },
      { art: "🌧️", t: "Rain checks happen.", b: "If one of you doesn't come, it's a rain check, or a stood up. Try again." },
    ],
    hint: "Go on a date night with a match", targets: [PHONE],
    check: { ledger: ["date_night"] }, reward: { clout: 40 }, done: "Date night done. Cute.",
  },
  {
    id: "8.7", chapter: 8, tag: "Couples", tip: "Make it official.", optional: true, opens: { day: 7 },
    cards: [
      { art: "💞", t: "Three dates, then ask.", b: "After three date nights you can make it official. Couples get a streak, anniversaries and gifts." },
      { art: "🧾", t: "Us keeps score.", b: "Your couple screen is in Messages: the streak, the next anniversary, the gift box." },
    ],
    hint: "Ask your match to make it official in Us", targets: [PHONE],
    check: { has: "couple" }, reward: { cash: 200 }, done: "It's official. Change your bio.",
  },
  {
    id: "8.8", chapter: 8, tag: "Couples", tip: "Move in together.", optional: true, opens: { day: 14 },
    cards: [
      { art: "🏠", t: "A week official, then move in.", b: "One of you hosts. The rent splits, and \"Home together\" pays you both once a day." },
      { art: "📦", t: "Either of you can move out.", b: "The host keeps the home; the other moves to the cheapest place, furniture and all." },
    ],
    hint: "Ask your partner to move in from Us", targets: [PHONE],
    check: { has: "moved_in" }, reward: { clout: 40 }, done: "Moved in. Toothbrushes merged.",
  },
  {
    id: "8.9", chapter: 8, tag: "Gifts", tip: "Gifts.", optional: true, opens: { rank: 2 },
    cards: [
      { art: "🎁", t: "Send a friend a Shop piece.", b: "Up to five a week. They can accept or decline; declined gifts come back." },
      { art: "🔒", t: "Gifts can't be flipped.", b: "An accepted gift can't be sold back to the game for 14 days." },
    ],
    hint: "Send a gift from a friend's card", targets: [PHONE],
    check: { has: "gift" }, reward: { clout: 20 }, done: "Gift sent. Generous. Suspicious.",
  },
  // ---- Chapter 9: Choices. Holding, Pablo and the Gala only happen to some players, so they're optional.
  {
    id: "9.1", chapter: 9, tag: "Choices", tip: "New York will test you.",
    cards: [
      { art: "🃏", t: "Situations come up.", b: "After a trip, a shift, a meal or a hangout, the city sometimes hands you a choice. Each option says what you get and what it costs." },
      { art: "⏳", t: "Some choices come back.", b: "A day or a week later, what you did can pay off, or catch up with you." },
      { art: "😇", t: "Halo or Hustler.", b: "Your choices slowly move a private meter. Both ends pay, in different ways. Only you see it." },
    ],
    hint: "Make a choice when one comes up", targets: [MAP],
    check: { has: "choice" }, reward: { clout: 20 }, done: "Decided. No take-backs.",
  },
  {
    id: "9.2", chapter: 9, tag: "Regulars", tip: "Do someone a favor.",
    cards: [
      { art: "🤝", t: "Regulars ask favors.", b: "Talk to the regular at a place and they may need a hand. Helping moves your friendship along." },
      { art: "❤️", t: "Friendly, Friend, Family.", b: "Friends treat you once a week. Family will do you a big favor once a month." },
    ],
    hint: "Talk to a regular and help with a favor", targets: [MAP],
    check: { has: "favor" }, reward: { cash: 50 }, done: "Favor done. They'll remember.",
  },
  {
    id: "9.3", chapter: 9, tag: "Holding", tip: "If you end up on the bench.", optional: true,
    cards: [
      { art: "🚔", t: "Some choices end at the precinct.", b: "Up to three hours in holding. You can pay bail, or call in a favor from Sgt. Bev." },
      { art: "📱", t: "Your phone still works.", b: "Holding stops tasks and trips, not your Phone. Time served counts down on its own." },
    ],
    hint: "Only if it happens: get out of holding", targets: [MAP],
    check: { has: "held" }, reward: { clout: 15 }, done: "Out. Sgt. Bev says don't come back.",
  },
  {
    id: "9.4", chapter: 9, tag: "Pablo", tip: "Pablo would like a word.", optional: true, opens: { rank: 2 },
    cards: [
      { art: "🧳", t: "There's a back room behind the luggage shop.", b: "Pablo invites a certain kind of player. His jobs pay well and come with Heat." },
      { art: "🌡️", t: "Heat cools down.", b: "Lie low and it drops. Get caught and it's a fine and the bench, never your home or job." },
    ],
    hint: "Only if Pablo invites you: open his back room", targets: [MAP],
    check: { has: "underworld" }, reward: { clout: 20 }, done: "You met Pablo. Don't tell anyone.",
  },
  {
    id: "9.5", chapter: 9, tag: "The Gala", tip: "The Gala.", optional: true,
    cards: [
      { art: "🥂", t: "Halo players get invited.", b: "The Charity Gala is on the rooftop once a week. Donate and be seen doing it." },
      { art: "📸", t: "Generosity pays clout.", b: "The bigger the gift, the bigger the thank-you." },
    ],
    hint: "Only with an invite: donate at the Gala", targets: [MAP],
    check: { ledger: ["gala_donation"] }, reward: { clout: 20 }, done: "Donated. Very philanthropic.",
  },
  // ---- Chapter 10: Big plays. Every step is a path; any three finish the chapter.
  {
    id: "10.1", chapter: 10, tag: "Campus", tip: "Go back to school.", optional: true,
    cards: [
      { art: "🎓", t: "Two campuses in Queens.", b: "Enrol at one. Students get a dorm option, classes, Friday exams and the campus leaderboard." },
      { art: "📜", t: "A degree helps your career.", b: "Pass three exams and your career starts a level higher." },
    ],
    hint: "Enrol at a campus from its card", targets: [".map-pin", ".compact-dot", MAP],
    check: { has: "enrolled" }, reward: { clout: 30 }, done: "Enrolled. Student loans: pending.",
  },
  {
    id: "10.2", chapter: 10, tag: "Campus", tip: "Go to class.", optional: true,
    cards: [
      { art: "📚", t: "Class is a daily task.", b: "When your campus is open, one of your five tasks is going to class." },
      { art: "🍽️", t: "Campus has more.", b: "The library, the dining hall and Greek Row's party nights." },
    ],
    hint: "Attend a class at your campus", targets: [".map-pin", ".compact-dot", MAP],
    check: { ledger: ["campus_class"] }, reward: { cash: 50 }, done: "Attended. Front row, even.",
  },
  {
    id: "10.3", chapter: 10, tag: "Campus", tip: "Pass an exam.", optional: true,
    cards: [
      { art: "📝", t: "Exams are on Fridays.", b: "Answer the questions; 70% passes. Three passes is a degree." },
      { art: "🙈", t: "Don't get caught.", b: "Cheating can pass an exam. It can also cost you the degree." },
    ],
    hint: "Sit an exam at your campus on a Friday", targets: [".map-pin", ".compact-dot", MAP],
    check: { has: "exam_pass" }, reward: { clout: 40 }, done: "Passed. Mom's framing it.",
  },
  {
    id: "10.4", chapter: 10, tag: "Homecoming", tip: "Run for Homecoming.", optional: true,
    cards: [
      { art: "👑", t: "Four weeks to the crown.", b: "Plan your days, keep your grades up, win over the cliques and beat the reigning royal." },
      { art: "🧑‍🏫", t: "The Dean is watching.", b: "Push too hard and you're off the ballot." },
    ],
    hint: "Declare for the crown in Crown HQ", targets: [".map-pin", ".compact-dot", MAP],
    check: { has: "crown_race" }, reward: { clout: 30 }, done: "Declared. Campaign posters printing.",
  },
  {
    id: "10.5", chapter: 10, tag: "Campaign", tip: "Run a campaign.", optional: true,
    cards: [
      { art: "🗳️", t: "Four challengers, one Mayor.", b: "Manage a challenger's campaign against Mayor Papa-Dani, one campaign week a day." },
      { art: "💼", t: "It's a full-time job.", b: "Your career goes on leave while it runs. The campaign pays you a fee." },
    ],
    hint: "Open Campaign in your Phone and pick a candidate", targets: [PHONE],
    check: { has: "campaign" }, reward: { clout: 40 }, done: "Campaign launched. Vote early.",
  },
  {
    id: "10.6", chapter: 10, tag: "Campaign", tip: "End your first campaign week.", optional: true,
    cards: [
      { art: "📊", t: "A week has steps.", b: "Tasks, the inbox, the budget, the calendar and decisions, then End week." },
      { art: "🗞️", t: "Results come the next day.", b: "The morning paper says how the polls moved." },
    ],
    hint: "Finish a campaign week in Campaign HQ", targets: [PHONE],
    check: { has: "campaign_week" }, reward: { cash: 150 }, done: "Week one done. The polls noticed.",
  },
  {
    id: "10.7", chapter: 10, tag: "Careers", tip: "Get promoted.", optional: true,
    cards: [
      { art: "📈", t: "Good weeks lead up.", b: "Strong reviews move you up the ladder: more pay, a new title, more clout." },
      { art: "🤝", t: "People help.", b: "Your work friend, the boss's trust and the big boss all count." },
    ],
    hint: "Keep working good weeks at your job", targets: [PHONE],
    check: { ledger: ["career_promo"] }, reward: { clout: 40 }, done: "Promoted. New title, same desk.",
  },
  {
    id: "10.8", chapter: 10, tag: "Businesses", tip: "Grow the business.", optional: true,
    cards: [
      { art: "🏗️", t: "Upgrades earn more.", b: "Each level of a business earns more while you're away." },
      { art: "📣", t: "The top of the ladder.", b: "Take a business all the way up and you can take it public." },
    ],
    hint: "Upgrade a business in the Businesses app", targets: [PHONE],
    check: { has: "biz_upgrade" }, reward: { clout: 30 }, done: "Upgraded. Investors are circling.",
  },
  // ---- Chapter 11: The city. Only the News is needed; the Big Screen and the Mayor are for those who want them.
  {
    id: "11.1", chapter: 11, tag: "News", tip: "Read the news. Or at least the headlines.",
    cards: [
      { art: "🗞️", t: "News is the city's front page.", b: "City items, Lola's Blotter, transit delays and the weekly column." },
      { art: "🌡️", t: "The city has moods too.", b: "Heatwaves, brownouts and festivals change prices and close places. \"Around the city\" lists what's on." },
    ],
    hint: "Open News in your Phone", targets: [PHONE],
    check: { seen: true }, reward: { clout: 15 }, done: "Informed. Dangerous, even.",
  },
  {
    id: "11.2", chapter: 11, tag: "Clout TV", tip: "Get on the Big Screen.", optional: true,
    cards: [
      { art: "📺", t: "Send Clout TV a photo.", b: "A photo of you, with your handle. Picks rotate every three hours." },
      { art: "🔥", t: "Being on screen pays.", b: "If yours is picked, the whole city sees it, and you get clout." },
    ],
    hint: "Open Clout TV in your Phone and send a photo", targets: [PHONE],
    check: { has: "tv" }, reward: { clout: 30 }, done: "Submitted. Practice your surprised face.",
  },
  {
    id: "11.3", chapter: 11, tag: "The Mayor", tip: "Write to the Mayor.", optional: true,
    cards: [
      { art: "✉️", t: "The Mayor app goes to the team.", b: "Bugs, ideas, complaints, praise. The team reads every letter and sometimes writes back." },
      { art: "🏛️", t: "Mayor Papa-Dani says hi.", b: "He'll take credit for anything good that comes of it." },
    ],
    hint: "Open the Mayor app in your Phone and send a letter", targets: [PHONE],
    check: { has: "mayor_letter" }, reward: { clout: 30 }, done: "Letter sent. The Mayor is \"looking into it\".",
  },
);

export const stepById = (id: string) => STEPS.find((s) => s.id === id);
export const chapterSteps = (n: number) => STEPS.filter((s) => s.chapter === n);

/** game_settings 'guide': what the server checks and pays, by step and chapter (tests/guide.test.ts compares). */
export function guideSettings() {
  return {
    steps: Object.fromEntries(STEPS.map((s) => [s.id, { chapter: s.chapter, check: s.check, cash: s.reward.cash ?? 0, clout: s.reward.clout ?? 0 }])),
    chapters: Object.fromEntries(CHAPTERS.filter((c) => c.live).map((c) => [String(c.n), {
      badge: c.badgeId, cash: c.reward.cash ?? 0, clout: c.reward.clout ?? 0, ...(c.item ? { item: c.item.sku } : {}),
      ...(c.need ? { need: c.need, all: chapterSteps(c.n).map((s) => s.id) } : { steps: chapterSteps(c.n).filter((s) => !s.optional).map((s) => s.id) }),
    }])),
  };
}

/** The player's Guide: steps paid, steps the game has seen done, chapters paid (guide_state). */
export interface GuideState { paid: string[]; ready: string[]; chapters: number[]; day: number; rank: number; skipped?: string[] }

/** Opens? A chapter is open from its day or rank (and only when its steps are written). */
export const chapterOpen = (c: GuideChapter, s: Pick<GuideState, "day" | "rank">) => c.live && (c.day === undefined || s.day >= c.day) && (c.rank === undefined || s.rank >= c.rank);

/** A step that opens later than its chapter is open yet? */
export const stepOpen = (st: GuideStep, s: Pick<GuideState, "day" | "rank">) =>
  (st.opens?.rank === undefined || s.rank >= st.opens.rank) && (st.opens?.day === undefined || s.day >= st.opens.day);

/** The one recommended step: the first unpaid, open step of the first open chapter, in order. Null when everything open is done. */
export function nextStep(s: GuideState): GuideStep | null {
  for (const c of CHAPTERS) {
    if (!chapterOpen(c, s)) continue;
    const step = chapterSteps(c.n).find((x) => !s.paid.includes(x.id) && stepOpen(x, s) && !(x.optional && s.skipped?.includes(x.id)));
    if (step) return step;
  }
  return null;
}

/** A finished chapter waiting to pay its badge and reward. */
export const chapterDone = (c: GuideChapter, paid: string[]) => (c.need
  ? chapterSteps(c.n).filter((x) => paid.includes(x.id)).length >= c.need
  : chapterSteps(c.n).filter((x) => !x.optional).every((x) => paid.includes(x.id)));
export const chapterDue = (s: GuideState) => CHAPTERS.find((c) => c.live && !s.chapters.includes(c.n) && chapterDone(c, s.paid)) ?? null;

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
