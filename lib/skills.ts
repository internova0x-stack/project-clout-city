// Skills (owner, Oct 16; after a reference game's Skills tab): nine skills from 0 to 10, trained by
// doing things around the city. Each counted activity is 1 practice; a level needs the practice
// below. Skills you don't use for a week slowly get rusty. Safe to import anywhere.

export type SkillId = "cooking" | "charisma" | "fitness" | "smarts" | "music" | "hustle" | "dance" | "gossip" | "photography";

export interface SkillDef { id: SkillId; emoji: string; name: string; how: string }

export const SKILLS: readonly SkillDef[] = [
  { id: "cooking", emoji: "🍳", name: "Cooking", how: "Cook at home" },
  { id: "charisma", emoji: "😎", name: "Aura", how: "Chat, react, date, plan with your crew" },
  { id: "fitness", emoji: "💪", name: "Fitness", how: "Gyms, parks, walking places" },
  { id: "smarts", emoji: "📚", name: "Smarts", how: "Study at the library or on campus" },
  { id: "music", emoji: "🎸", name: "Music", how: "Open mics, lounge sets, live nights" },
  { id: "hustle", emoji: "💼", name: "Hustle", how: "Shifts, gigs, jobs, your businesses" },
  { id: "dance", emoji: "💃", name: "Dance", how: "Club nights and dance floors" },
  { id: "gossip", emoji: "🍵", name: "Gossip", how: "Listen in, find tea" },
  { id: "photography", emoji: "📸", name: "Photography", how: "Monuments, rooftops, postcards" },
];

export const MAX_LEVEL = 10;
/** Total practice needed for each level (index = level). */
export const LEVEL_AT = [0, 3, 8, 15, 25, 40, 60, 85, 115, 150, 200] as const;

/** Rust (as in the reference): after 7 days without practice, about a level every 20 days, never more than 2 under your best. */
export const RUST = { afterDays: 7, daysPerLevel: 20, maxBelowBest: 2 } as const;

export function levelFor(practice: number): number {
  let l = 0;
  while (l < MAX_LEVEL && practice >= LEVEL_AT[l + 1]) l++;
  return l;
}

/** How far into the current level, 0 to 1 (1 at the top level). */
export function levelProgress(practice: number): number {
  const l = levelFor(practice);
  if (l >= MAX_LEVEL) return 1;
  return (practice - LEVEL_AT[l]) / (LEVEL_AT[l + 1] - LEVEL_AT[l]);
}

export interface SkillState { id: SkillId; level: number; best: number; practice: number; rusty: boolean }

export const RUST_LINE = `Skills you don't use for ${RUST.afterDays} days slowly get rusty (about a level every ${RUST.daysPerLevel} days), never more than ${RUST.maxBelowBest} levels under your best. Using a skill stops it.`;

/** Badges at levels 5 and 10 (player_badges "skill-<id>-5|10"): emoji and name, or null for other ids. */
const MASTER: Record<SkillId, string> = {
  cooking: "Master Chef", charisma: "Smooth Operator", fitness: "Gym Rat Royalty", smarts: "Big Brain", music: "Headliner",
  hustle: "Hustle Legend", dance: "Floor Killer", gossip: "Tea Sommelier", photography: "Lens Legend",
};
export function skillBadge(id: string): { emoji: string; name: string } | null {
  if (id.startsWith("perk-")) return perkBadge(id);
  const m = id.match(/^skill-([a-z]+)-(5|10)$/);
  const def = m && SKILLS.find((s) => s.id === m[1]);
  if (!m || !def) return null;
  return { emoji: def.emoji, name: m[2] === "10" ? MASTER[def.id] : `${def.name} 5` };
}

// ---------------------------------------------------------------------------
// Skill perks (owner, Oct 19): skills open doors. At levels 3, 6 and 9 each skill unlocks a paid gig, an invite or
// an access. The server holds the same list (game_settings 'skill_perks', migration 0092; tests/skills.test.ts checks
// they match) and checks your level (rust counts: a rusty skill stops new perks until you train it back).
// ---------------------------------------------------------------------------

/** gig: once a week, takes Energy and time, pays C$ (and clout at level 9). invite: once, pays clout (a badge at 9).
    access: always on while you hold the level (door: past every club door; vip: every club's VIP floor). */
export type PerkKind = "gig" | "invite" | "access";
export interface SkillPerk {
  id: string;
  skill: SkillId;
  level: 3 | 6 | 9;
  kind: PerkKind;
  emoji: string;
  name: string;
  blurb: string;
  pay?: number;
  clout?: number;
  energy?: number;
  waitMinutes?: number;
  access?: "door" | "vip";
  badge?: string;
}

const gig = (skill: SkillId, level: 3 | 6 | 9, emoji: string, name: string, blurb: string, pay: number, clout = 0): SkillPerk => ({
  id: `${skill}-${level}`, skill, level, kind: "gig", emoji, name, blurb, pay, ...(clout ? { clout } : {}),
  energy: { 3: 25, 6: 50, 9: 75 }[level], waitMinutes: { 3: 60, 6: 120, 9: 240 }[level],
});
const invite = (skill: SkillId, level: 3 | 6 | 9, emoji: string, name: string, blurb: string, badge?: string): SkillPerk => ({
  id: `${skill}-${level}`, skill, level, kind: "invite", emoji, name, blurb, clout: { 3: 50, 6: 150, 9: 500 }[level], ...(badge ? { badge } : {}),
});

export const SKILL_PERKS: readonly SkillPerk[] = [
  gig("cooking", 3, "🥘", "Cater a block-party potluck", "Forty neighbors, one folding table, zero allergy labels.", 150),
  gig("cooking", 6, "🍽️", "Private chef on an Astoria rooftop", "Tasting menu for a couple who say 'elevated' a lot.", 600),
  gig("cooking", 9, "👨‍🍳", "Cook a celebrity's dinner party", "They'll take credit for the risotto. You'll take the check.", 2000, 100),
  invite("charisma", 3, "🥂", "Plus-one at a gallery opening", "Stand near the art. Nod. Leave before the speeches."),
  invite("charisma", 6, "🎞️", "Red carpet at a movie premiere", "Four seconds of fame between two people you've never heard of."),
  invite("charisma", 9, "🏆", "The Cloutie Awards: you're presenting", "Read the envelope. Mispronounce nobody. Become a meme anyway.", "Cloutie Presenter"),
  gig("fitness", 3, "🏋️", "Personal trainer for a day", "Count to ten with conviction. That's the job.", 120),
  gig("fitness", 6, "🏃", "Pace a charity 5K", "Run slow enough that the sponsors can keep up.", 400),
  gig("fitness", 9, "📣", "Face of a sportswear launch", "Sweat on cue under a ring light.", 1500, 100),
  gig("smarts", 3, "✏️", "Tutor a freshman", "Explain the syllabus to someone who will not read the syllabus.", 100),
  gig("smarts", 6, "❓", "Host trivia night", "Defend the answer key against a table of lawyers.", 350),
  invite("smarts", 9, "🎤", "Speak at Big Ideas Night", "Eighteen minutes, one headset mic, zero slides that work.", "Big Ideas Speaker"),
  gig("music", 3, "🎙️", "Paid open-mic slot", "Three songs and a tip jar that's mostly receipts.", 120),
  gig("music", 6, "🎷", "Lounge residency night", "Background music for people who are definitely listening.", 500),
  gig("music", 9, "🎆", "Headline the park festival stage", "The crowd knows the chorus. You barely do. Perfect.", 2000, 100),
  gig("hustle", 3, "📦", "Rush delivery shifts", "Every package is 'urgent'. None of them are.", 150),
  invite("hustle", 6, "🤝", "Founders' mixer", "Everyone's pivoting. Nobody knows to what."),
  invite("hustle", 9, "💸", "Investor dinner", "The tasting menu is free. The networking costs your soul.", "Seed Round Regular"),
  { id: "dance-3", skill: "dance", level: 3, kind: "access", emoji: "🎟️", name: "The bouncer waves you in", blurb: "Past every club door, whatever your clout. Your moves are the guest list.", access: "door" },
  gig("dance", 6, "🕺", "Paid dance-off at a club", "Win the circle, win the cash, lose a shoe.", 400),
  { id: "dance-9", skill: "dance", level: 9, kind: "access", emoji: "💎", name: "Every club's VIP floor, on the house", blurb: "Clubs want you upstairs where people can see you.", access: "vip" },
  invite("gossip", 3, "☕", "Coffee with the block's loudest regular", "They talk, you listen, the barista takes notes."),
  gig("gossip", 6, "🗞️", "Guest column in the News", "Six hundred words, allegedly.", 300),
  invite("gossip", 9, "🔮", "Off-the-record brunch with a columnist", "Mimosas, blind items and a napkin NDA.", "Off the Record"),
  gig("photography", 3, "📷", "Shoot a birthday party", "Two hundred photos of the same cake.", 120),
  gig("photography", 6, "👗", "Fashion week backstage shoot", "Capture the chaos. Crop out the crying.", 600),
  gig("photography", 9, "🖼️", "Your own gallery show", "Big prints, small wine, enormous price tags.", 1500, 100),
];

export const perksFor = (skill: SkillId) => SKILL_PERKS.filter((p) => p.skill === skill);

/** The reward line under a perk: "Gig · C$600", "Invite · 500 clout + a badge", "Always on". */
export function perkReward(p: SkillPerk): string {
  if (p.kind === "gig") return `Gig · C$${(p.pay ?? 0).toLocaleString("en-US")}${p.clout ? ` + ${p.clout} clout` : ""} · weekly`;
  if (p.kind === "invite") return `Invite · ${p.clout} clout${p.badge ? " + a badge" : ""}`;
  return p.access === "door" ? "Always on · every club door" : "Always on · every VIP floor";
}

/** The server's copy of the list (game_settings 'skill_perks'): no emoji or copy, just the rules. */
export function skillPerksSeed() {
  return SKILL_PERKS.map(({ id, skill, level, kind, pay, clout, energy, waitMinutes, access, badge }) =>
    ({ id, skill, level, kind, ...(pay ? { pay } : {}), ...(clout ? { clout } : {}), ...(energy ? { energy } : {}), ...(waitMinutes ? { waitMinutes } : {}), ...(access ? { access } : {}), ...(badge ? { badge } : {}) }));
}

/** What the server says about your perks (skill_perks_state, migration 0092). */
export interface PerksState {
  /** Effective level per skill (rust counted). */
  levels: Record<SkillId, number>;
  /** This week's skill gigs (week = Monday, New York). */
  gigs: { perk: string; accepted_at: string | null; ready_at: string | null; collected_at: string | null }[];
  /** Invites already accepted. */
  invites: string[];
}

export type PerkStatus = "locked" | "take" | "working" | "collect" | "done" | "rsvp" | "went" | "on";
export function perkStatus(p: SkillPerk, s: PerksState, nowMs: number): PerkStatus {
  if ((s.levels[p.skill] ?? 0) < p.level) return "locked";
  if (p.kind === "access") return "on";
  if (p.kind === "invite") return s.invites.includes(p.id) ? "went" : "rsvp";
  const g = s.gigs.find((x) => x.perk === p.id);
  if (!g?.accepted_at) return "take";
  if (g.collected_at) return "done";
  return g.ready_at && new Date(g.ready_at).getTime() <= nowMs ? "collect" : "working";
}
/** A perk the level has opened (for the door and the VIP floor). */
export const perkOn = (s: PerksState | undefined, access: "door" | "vip") =>
  !!s && SKILL_PERKS.some((p) => p.access === access && (s.levels[p.skill] ?? 0) >= p.level);

/** Badges from level-9 invites (player_badges "perk-<id>"). */
export function perkBadge(id: string): { emoji: string; name: string } | null {
  const p = id.startsWith("perk-") ? SKILL_PERKS.find((x) => `perk-${x.id}` === id) : null;
  return p?.badge ? { emoji: p.emoji, name: p.badge } : null;
}

export const PERK_ERRORS: Record<string, string> = {
  unknown_perk: "That offer isn't on the table.",
  skill_locked: "Your skill isn't there yet. Train it up (rusty skills count as their current level).",
  gig_done_week: "You did that one this week. They'll call again Monday.",
  gig_active: "Finish your current gig first.",
  no_energy: "Not enough Energy. Eat something, or sleep it off until tomorrow.",
  not_ready: "Not done yet. Good work takes time; so does mediocre work.",
};
