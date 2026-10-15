// Player ranks (owner, Oct 15): one list of satirical American status titles. A player holds the higher
// of two ladders: clout (fame gets you there) or net worth (money does). The clout steps match the
// game's own gates (pro gigs, big gigs and the exclusive door, free VIP), checked by tests/ranks.test.ts.
// Shown on the profile, player cards and the Everyone here list; crossing one shows the rank-up reveal.
// Dependency-free so tests can import it.

export interface Rank {
  /** 1 to 10. */
  level: number;
  title: string;
  emoji: string;
  clout: number;
  netWorth: number;
  /** The rank-up reveal's line. */
  line: string;
}

export const RANKS: Rank[] = [
  { level: 1, title: "Ramen Noodle Era", emoji: "🍜", clout: 0, netWorth: 0, line: "Everyone starts here." },
  { level: 2, title: "Student Loan Survivor", emoji: "🎓", clout: 100, netWorth: 25_000, line: "Still paying off a degree in vibes." },
  { level: 3, title: "Side Hustler", emoji: "💼", clout: 500, netWorth: 50_000, line: "Three gigs, zero days off. Pro gigs are open to you now." },
  { level: 4, title: "Group Chat Famous", emoji: "💬", clout: 1_000, netWorth: 100_000, line: "Legendary among eleven people." },
  { level: 5, title: "On the List", emoji: "📋", clout: 2_000, netWorth: 250_000, line: "The bouncer nods now. Big breaks and the Ultraviolet Society door are open." },
  { level: 6, title: "Local Celebrity", emoji: "📸", clout: 5_000, netWorth: 500_000, line: "Recognized at the grocery store. VIP at the medium clubs is on the house." },
  { level: 7, title: "Nepo Baby Energy", emoji: "🍼", clout: 15_000, netWorth: 1_000_000, line: "Acts like their parents got them the job. Every VIP rope opens." },
  { level: 8, title: "New Money Rich", emoji: "💸", clout: 50_000, netWorth: 2_500_000, line: "Everything you own is still in the box it came in." },
  { level: 9, title: "Self-Made Billionaire*", emoji: "🛥️", clout: 150_000, netWorth: 5_000_000, line: "Congratulations on doing it all by yourself.* *Terms and conditions apply." },
  { level: 10, title: "God Status", emoji: "✨", clout: 500_000, netWorth: 10_000_000, line: "The city speaks your name in hushed tones." },
];

/** The highest rank either clout or net worth reaches. */
export function rankFor(clout: number, netWorth: number): Rank {
  let out = RANKS[0];
  for (const r of RANKS) if (clout >= r.clout || netWorth >= r.netWorth) out = r;
  return out;
}

/** What's left to the next rank, either way (null at God Status). */
export function nextRank(clout: number, netWorth: number): { rank: Rank; clout: number; netWorth: number; progress: number } | null {
  const now = rankFor(clout, netWorth);
  const next = RANKS[now.level];
  if (!next) return null;
  // Progress is whichever ladder is further along, from this rank's step to the next.
  const part = (have: number, from: number, to: number) => Math.max(0, Math.min(1, (have - from) / (to - from)));
  const progress = Math.max(part(clout, now.clout, next.clout), part(netWorth, now.netWorth, next.netWorth));
  return { rank: next, clout: Math.max(0, next.clout - clout), netWorth: Math.max(0, next.netWorth - netWorth), progress };
}

/** "312 clout or C$40,000 to On the List". */
export function nextRankLine(clout: number, netWorth: number): string {
  const n = nextRank(clout, netWorth);
  if (!n) return "Top of the city. Nowhere left to climb.";
  return `${n.clout.toLocaleString("en-US")} clout or C$${n.netWorth.toLocaleString("en-US")} to ${n.rank.title}`;
}
