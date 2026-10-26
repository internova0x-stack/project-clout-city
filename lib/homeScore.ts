// The home score (migration 0120, owner Oct 26; spec section 26): 0 to 100 for how well a home is furnished, relative to
// the home, so a beautifully done room share can reach 100 as well as a penthouse. The server's home_score() is the
// one that pays; this mirror shows it at once and explains it. Safe to import anywhere.

/** Mirrors game_settings 'home_score' (checked by tests/homeScore.test.ts against the migration). */
export const HOME_SCORE = {
  /** Points for each room that has at least one bought piece placed. */
  roomPoints: 10,
  rooms: ["living", "bedroom", "dining", "decor"],
  /** Quality: the stars of every distinct piece placed (a line counts once), against the home's target. */
  qualityPoints: 40,
  targets: { astoria_share: 8, astoria_studio: 10, sj_dorm: 8, qu_dorm: 8, jackson_heights_1br: 14, sunnyside_gardens: 16, lic_highrise: 18 },
  houseTarget: 24,
  /** Wall art: points per distinct painting placed, up to artPoints. */
  artPoints: 20,
  artEach: 5,
  /** Clout once, the first time the score reaches each (ledger 'home_score', ref the score). */
  milestones: [{ score: 40, clout: 50 }, { score: 70, clout: 100 }, { score: 100, clout: 250 }],
} as const;

export const HOME_TIERS: { min: number; label: string }[] = [
  { min: 100, label: "Iconic" }, { min: 80, label: "Magazine-ready" }, { min: 60, label: "Stylish" },
  { min: 40, label: "Cozy" }, { min: 20, label: "Moved in" }, { min: 0, label: "Bare walls" },
];
export const tierFor = (score: number) => HOME_TIERS.find((t) => score >= t.min)!.label;

/** A placed piece: its room at Fif's (or "art"), its line and its stars. */
export interface ScoredPiece { room: string; line: string; stars: number }

export interface HomeScore {
  score: number;
  tier: string;
  rooms: Record<string, boolean>;
  quality: { stars: number; target: number; points: number };
  art: { count: number; points: number };
}

export function qualityTarget(homeId: string | null | undefined, houseSku: string | null | undefined): number {
  if (houseSku) return HOME_SCORE.houseTarget;
  return (HOME_SCORE.targets as Record<string, number>)[homeId ?? ""] ?? 10;
}

export function homeScore(pieces: ScoredPiece[], target: number): HomeScore {
  const rooms = Object.fromEntries(HOME_SCORE.rooms.map((r) => [r, pieces.some((p) => p.room === r)]));
  const lines = new Map<string, ScoredPiece>();
  for (const p of pieces) if (p.room !== "art" && !lines.has(p.line)) lines.set(p.line, p);
  const stars = [...lines.values()].reduce((n, p) => n + Math.min(4, Math.max(1, p.stars)), 0);
  const qualityPts = Math.min(HOME_SCORE.qualityPoints, Math.round((HOME_SCORE.qualityPoints * stars) / target));
  const artCount = new Set(pieces.filter((p) => p.room === "art").map((p) => p.line)).size;
  const artPts = Math.min(HOME_SCORE.artPoints, artCount * HOME_SCORE.artEach);
  const roomPts = Object.values(rooms).filter(Boolean).length * HOME_SCORE.roomPoints;
  const score = Math.min(100, roomPts + qualityPts + artPts);
  return { score, tier: tierFor(score), rooms, quality: { stars, target, points: qualityPts }, art: { count: artCount, points: artPts } };
}

const ROOM_LABEL: Record<string, string> = { living: "living room", bedroom: "bedroom", dining: "dining area", decor: "decor" };
const ROOM_HINT: Record<string, string> = {
  living: "a sofa, a rug or a lamp", bedroom: "a bed, a nightstand or a desk", dining: "a table or a chair", decor: "a plant or a piano",
};

/** What to do next, biggest gain first (at most three). */
export function homeTips(s: HomeScore): { text: string; gain: number; room?: string }[] {
  const tips: { text: string; gain: number; room?: string }[] = [];
  for (const r of HOME_SCORE.rooms) {
    if (!s.rooms[r]) tips.push({ text: `Buy something for your ${ROOM_LABEL[r]}: ${ROOM_HINT[r]}`, gain: HOME_SCORE.roomPoints, room: r });
  }
  if (s.art.points < HOME_SCORE.artPoints) tips.push({ text: s.art.count ? "Hang another painting" : "Hang a painting", gain: HOME_SCORE.artEach, room: "art" });
  if (s.quality.points < HOME_SCORE.qualityPoints) {
    const perStar = HOME_SCORE.qualityPoints / s.quality.target;
    tips.push({ text: "Better pieces: a ★★★★ piece counts most", gain: Math.min(HOME_SCORE.qualityPoints - s.quality.points, Math.round(perStar * 4)) });
  }
  return tips.sort((a, b) => b.gain - a.gain).slice(0, 3);
}

/** The next milestone not reached yet. */
export function nextMilestone(score: number) {
  return HOME_SCORE.milestones.find((m) => m.score > score) ?? null;
}
