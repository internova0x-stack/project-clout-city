// Campus life (v0.15 "Campus", docs/08-new-features-spec.md section 18; owner, Oct 18): the two parody
// universities in Queens. Courses, grades, the dining hall's daily menu and the dorm roommate's notes.
// Pure data and math, safe to import anywhere: exam answers live only in the database (migration 0072).
// The server (campus_* functions) is authoritative; this file mirrors its rules for display.

export type CampusId = "st-johnsons" | "queensborough-u";

export const CAMPUSES: readonly { id: CampusId; name: string; short: string; emoji: string; dorm: string; mascot: string }[] = [
  { id: "st-johnsons", name: "St. Johnsons University", short: "St. Johnsons", emoji: "🎓", dorm: "sj_dorm", mascot: "the Red Pigeons" },
  { id: "queensborough-u", name: "Queensborough University", short: "Queensborough", emoji: "🏛️", dorm: "qu_dorm", mascot: "the Fighting Bagels" },
];

export const campusById = (id: string | null | undefined) => CAMPUSES.find((c) => c.id === id);

/** Starting numbers (the database's game_settings 'campus' row is the truth; tests/campus.test.ts keeps them equal). */
export const CAMPUS = {
  /** Courses a player takes each week. */
  coursesPerWeek: 3,
  /** Questions in each Friday quiz. */
  quizSize: 5,
  /** Attending a class: Energy it costs, and what it gives. */
  attend: { energy: 10, confidence: 4, clout: 5 },
  /** Grade = attendance (days this week, capped) and the quiz, half each. */
  attendDaysForFull: 4,
  /** A week's GPA at or above this pays the scholarship once. */
  scholarship: { gpa: 3.5, cash: 300 },
  /** "Peek at your neighbor's paper": one extra correct answer, but a chance of getting caught (an F). */
  peek: { bonus: 1, caughtChance: 0.35 },
  /** Switching campus: wait this many days ("transfer paperwork"). */
  transferDays: 7,
  /** The dining hall: the student price for enrolled players, everyone else pays the visitor price. */
  dining: { student: 6, visitor: 12, energy: -25 },
} as const;

export interface Course { id: string; name: string; professor: string; emoji: string; blurb: string }

/** The course catalog (both campuses). Invented courses and professors. */
export const COURSES: readonly Course[] = [
  { id: "main-character-101", name: "Intro to Main Character Energy", professor: "Prof. Delphine Vale", emoji: "✨", blurb: "Walk into a room like the soundtrack started." },
  { id: "8am-regret-101", name: "8 AM Regret 101", professor: "Dr. Morris Pruitt", emoji: "⏰", blurb: "Attendance is the whole grade. The professor is also asleep." },
  { id: "napping-301", name: "Advanced Napping 301", professor: "Prof. Ines Holloway", emoji: "😴", blurb: "Library naps, bus naps, and the forbidden nap: during the exam." },
  { id: "group-project", name: "Group Project Survival", professor: "Dr. Kwame Osei", emoji: "🧑‍🤝‍🧑", blurb: "Four names on the slide. One person did it. You know who." },
  { id: "dining-hall-econ", name: "Dining Hall Economics", professor: "Prof. Rosa Delgado", emoji: "🍽️", blurb: "Supply, demand and the last clean fork." },
  { id: "subway-studies", name: "Subway Studies", professor: "Dr. Leon Marchetti", emoji: "🚇", blurb: "Delays, showtime and the etiquette of the pole." },
  { id: "intro-to-clout", name: "Clout Theory", professor: "Prof. Yuki Tanabe", emoji: "🔥", blurb: "Why strangers care, and how to make them care more." },
  { id: "finance-for-broke", name: "Personal Finance for the Broke", professor: "Dr. Abe Fontaine", emoji: "💸", blurb: "Budgeting, coupons and pretending you already ate." },
];

export const courseById = (id: string) => COURSES.find((c) => c.id === id);

/** Grade points (4.0 scale) and letters. */
export const GRADES = [
  { letter: "A", points: 4, min: 90 },
  { letter: "B", points: 3, min: 80 },
  { letter: "C", points: 2, min: 70 },
  { letter: "D", points: 1, min: 60 },
  { letter: "F", points: 0, min: 0 },
] as const;

/** A course's percent for the week: attendance (days, capped) and quiz answers, half each. Mirrors campus_grade(). */
export function coursePercent(daysAttended: number, correct: number): number {
  const attend = Math.min(1, Math.max(0, daysAttended) / CAMPUS.attendDaysForFull);
  const quiz = Math.min(1, Math.max(0, correct) / CAMPUS.quizSize);
  return Math.round(50 * attend + 50 * quiz);
}

export function gradeFor(percent: number) {
  return GRADES.find((g) => percent >= g.min) ?? GRADES[GRADES.length - 1];
}

/** GPA from grade letters, to two decimals; null with no grades. */
export function gpa(letters: readonly string[]): number | null {
  const pts = letters.map((l) => GRADES.find((g) => g.letter === l)?.points).filter((p): p is (typeof GRADES)[number]["points"] => p !== undefined).map(Number);
  if (!pts.length) return null;
  return Math.round((pts.reduce((a, b) => a + b, 0) / pts.length) * 100) / 100;
}

/** Exams open Friday through Sunday, New York time (isodow 5 to 7). */
export const examOpen = (isoDow: number) => isoDow >= 5;

/** The dining hall's dish of the day: same for everyone on a New York date. */
const MENU = [
  "Mystery Meat Monday: it's chicken. Probably.",
  "Taco Tuesday: the tacos are a rumor, the line is real.",
  "Waffle Wednesday: the machine has a 40-minute wait and a fan club.",
  "Theme Night Thursday: \"Around the World\", which tonight means ketchup.",
  "Fried Friday: everything is fried, including the salad.",
  "Brunch Saturday: one pancake per student, enforced by a very tired man.",
  "Leftover Sunday: the week, reheated.",
] as const;

/** The dish for a New York date (YYYY-MM-DD): Monday's menu on Mondays. */
export function menuFor(nyDate: string): string {
  const d = new Date(`${nyDate}T12:00:00Z`).getUTCDay(); // 0 = Sunday
  return MENU[(d + 6) % 7];
}

/** The dorm roommate's sticky notes, one a day. */
export const ROOMMATE_NOTES = [
  "Borrowed your hoodie. It's in the dryer. The dryer is at my cousin's.",
  "Microwaved fish again. Opened a window. Closed it. It was cold.",
  "My alarm is set for 5 AM for \"discipline\". I'm sleeping through it for growth.",
  "Ate your yogurt. Replaced it with a better yogurt. Ate that too.",
  "Started a podcast in our room. You're a guest. Episode 1 is tonight.",
  "Our RA says we need to \"talk about the plant\". What plant?",
  "Took a group photo for the campus page. You blinked. It's up.",
] as const;

export function roommateNote(nyDate: string): string {
  const days = Math.floor(new Date(`${nyDate}T12:00:00Z`).getTime() / 86_400_000);
  return ROOMMATE_NOTES[((days % ROOMMATE_NOTES.length) + ROOMMATE_NOTES.length) % ROOMMATE_NOTES.length];
}
