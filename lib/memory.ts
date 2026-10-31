// The Content Engine, step 1: player memory (docs/CONTENT-ENGINE.md section 3; migration 0138). Every fact a system can
// write, in one list: storylets (step 2) read these keys, and tests/memory.test.ts checks this list against the writers
// (the migration's triggers and the servers' fact_note calls), so a key is never written without being listed here.

export interface FactDef {
  /** What it means, for whoever writes a storylet. */
  means: string;
  /** What the subject is ('' when there is none). */
  subject: string;
}

export const FACTS = {
  // Work
  "work.shift": { means: "Worked a casual shift", subject: "the place" },
  "work.gig": { means: "Finished a gig", subject: "the gig" },
  "work.skill_gig": { means: "Finished a skill gig", subject: "the gig" },
  "work.gigs_locked": { means: "Locked off the gig board for a while (expires)", subject: "" },
  "jobs.hired_out": { means: "Got paid for a Jobs board job", subject: "" },
  // Careers
  "career.hired": { means: "Got a job", subject: "the track" },
  "career.promoted": { means: "Promoted", subject: "the track" },
  "career.demoted": { means: "Demoted", subject: "the track" },
  "career.fired": { means: "Fired from a job", subject: "the track" },
  "career.quit": { means: "Quit a job", subject: "the track" },
  "career.lied_interview": { means: "Polished the truth in an interview", subject: "the track" },
  "career.helped": { means: "Helped a coworker with their task", subject: "track:who" },
  "career.shared_credit": { means: "Shared the credit", subject: "track:who" },
  "career.teamed_up": { means: "Teamed up on a project", subject: "track:who" },
  "career.took_credit": { means: "Took credit for a coworker's work", subject: "track:who" },
  "career.reported": { means: "Reported a coworker's mistakes", subject: "track:who" },
  "career.started_rumor": { means: "Fed the office gossip a rumor", subject: "track:who" },
  "career.caught_sabotage": { means: "Office sabotage traced back to them", subject: "track:who" },
  "career.covered": { means: "Covered a coworker's mistake", subject: "track:who" },
  "career.backed_boss": { means: "Backed the boss in a meeting", subject: "track:who" },
  "career.mentored": { means: "Mentored the new hire", subject: "track:who" },
  "career.undermined": { means: "Quietly undermined a coworker's task", subject: "track:who" },
  "career.went_over_head": { means: "Went over the boss's head", subject: "track:who" },
  "career.tried_pushout": { means: "Tried to push the boss out", subject: "track:who" },
  "career.pushed_out_boss": { means: "Pushed the boss out", subject: "the track" },
  "career.quit_for_business": { means: "Quit a job to run their businesses", subject: "the track" },
  // Business, home, money
  "business.bought": { means: "Bought a business", subject: "the business" },
  "business.upgraded": { means: "Upgraded a business", subject: "the business" },
  "business.went_public": { means: "Took a business public", subject: "the business" },
  "home.hosted": { means: "Had people over", subject: "" },
  "home.visited": { means: "Visited someone's home", subject: "" },
  "home.sublet_host": { means: "Rented out a spare room", subject: "" },
  "home.sublet_tenant": { means: "Sublets a room", subject: "" },
  "money.lotto_win": { means: "Won on a scratch card", subject: "" },
  "money.lotto_jackpot": { means: "Won a lotto pot", subject: "" },
  // Love and nightlife
  "dating.date": { means: "Went on a date night", subject: "" },
  "dating.official": { means: "Made a relationship official", subject: "the partner (player id)" },
  "dating.breakup": { means: "Broke up (value.byMe, value.reason)", subject: "the ex (player id)" },
  "nightlife.party": { means: "Went to a party", subject: "the party" },
  "nightlife.event": { means: "Went to a club event", subject: "the event" },
  // Campaigns, choices, the law
  "campaign.ran": { means: "Ran a campaign to the end", subject: "the candidate" },
  "campaign.won": { means: "Won an election (value.clean)", subject: "the candidate" },
  "campaign.won_dirty": { means: "Won an election dirty", subject: "the candidate" },
  "campaign.lost": { means: "Lost an election", subject: "the candidate" },
  "choice.made": { means: "Made a moral choice", subject: "dilemma:option" },
  "life.aspiration": { means: "Picked an aspiration in Careers", subject: "the aspiration (lib/aspirations.ts)" },
  "place.banned": { means: "Banned from a place (expires)", subject: "the place" },
  "police.held": { means: "Spent time in holding", subject: "" },
  "police.bailed": { means: "Paid bail", subject: "" },
  // Campus, stories, the city
  "campus.enrolled": { means: "Enrolled at a campus", subject: "the campus" },
  "campus.aced": { means: "Got an A on an exam", subject: "the course" },
  "campus.peeked": { means: "Peeked at exam answers", subject: "the course" },
  "campus.caught_cheating": { means: "Caught cheating on an exam", subject: "the course" },
  "campus.scholarship": { means: "Won a scholarship", subject: "" },
  "story.predicted": { means: "Got a story prediction right", subject: "" },
  "story.read": { means: "Read a story's full post", subject: "" },
  "hunt.finished": { means: "Finished a treasure hunt", subject: "" },
  "gossip.found": { means: "Found a piece of gossip", subject: "the gossip" },
  "skill.level_up": { means: "Reached a new skill level", subject: "the skill" },
  "transit.showtime": { means: "Watched the subway showtime dancers", subject: "" },
  // Threads: what storylets remember (content/choices/storylets.json `sets`), so a story can pick up where it left off.
  "thread.came_clean": { means: "Owned up to a partner about taking a coworker's credit", subject: "the coworker (track:who)" },
  "thread.lied_to_partner": { means: "Lied to a partner about taking a coworker's credit", subject: "the coworker (track:who)" },
  "thread.feud": { means: "In an open feud with a coworker", subject: "the coworker (track:who)" },
  "thread.sold_client_list": { means: "Sold a former employer's client list", subject: "the track" },
  "thread.covered_fraud": { means: "Signed off on a boss's fake numbers", subject: "" },
  "thread.reported_fraud": { means: "Reported a boss's fake numbers to HR", subject: "" },
  "thread.lent_money": { means: "Lent a crew member money from a lotto win", subject: "" },
  "thread.lola_source": { means: "Became Lola's anonymous source", subject: "" },
} as const satisfies Record<string, FactDef>;

export type FactKey = keyof typeof FACTS;

/** One remembered thing, as player_memory returns it. */
export interface Fact { key: FactKey; subject: string; value: Record<string, unknown>; count: number; first: string; last: string; expires: string | null }

/** What's true about the player now (player_snapshot). */
export interface Snapshot {
  rank: number; clout: number; bank: number; meter: number; band: "halo" | "middle" | "hustler";
  home: string | null; at: string | null;
  job: { track: string; level: number; workMood: number } | null;
  businesses: string[]; partner: string | null; campus: string | null; campaign: string | null;
  marks: ("ban" | "gig_lock" | "holding")[]; crew: number; skills: Record<string, number>;
  /** Migration 0140: the city conditions in force now (kinds), added by the server from city_conditions_now(). */
  conditions?: string[];
}

export interface Memory { snapshot: Snapshot; facts: Fact[] }

/** The office move a careers action writes (lib/careers.ts OFFICE ids → fact keys). */
export const OFFICE_FACT: Record<"help" | "share" | "team" | "credit" | "report" | "rumor" | "cover" | "back" | "mentor" | "undermine" | "overhead" | "pushout", FactKey> = {
  help: "career.helped", share: "career.shared_credit", team: "career.teamed_up",
  credit: "career.took_credit", report: "career.reported", rumor: "career.started_rumor",
  cover: "career.covered", back: "career.backed_boss", mentor: "career.mentored",
  undermine: "career.undermined", overhead: "career.went_over_head", pushout: "career.tried_pushout",
};
