// The preview's in-memory campus (v0.15), standing in for the campus_* functions (migration 0072).
// Its sample questions are preview-only; the real exam bank lives in the database.
// Presets (?campus=): "" not enrolled, "pick" enrolled with no courses yet, "week" mid-week, "friday" exams open,
// "done" every exam taken and the scholarship paid.

import {
  CAMPUS, coursePercent, gradeFor, type AttendResult, type CampusApi, type CampusId, type CampusResult,
  type CampusState, type CourseState, type ExamQuestion, type Leaderboard, type SubmitResult,
} from "./campus.ts";

const SAMPLE: { q: ExamQuestion; answer: number }[] = [
  { q: { prompt: "The best time to leave for an 8 AM class is:", choices: ["7:15 AM", "7:59 AM", "8:10 AM, with a coffee", "Never"] }, answer: 1 },
  { q: { prompt: "The group chat is silent for three days. This means:", choices: ["Everyone is working hard", "Nobody has started", "The chat was deleted", "You are the group now"] }, answer: 1 },
  { q: { prompt: "The scarcest resource in the dining hall is:", choices: ["A clean fork", "A free table", "Vegetables", "Patience"] }, answer: 0 },
  { q: { prompt: "A power nap should last:", choices: ["20 minutes", "2 hours", "Until a stranger wakes you", "The whole semester"] }, answer: 0 },
  { q: { prompt: "Clout is best defined as:", choices: ["How much strangers care that you exist", "Money", "Followers", "A feeling"] }, answer: 0 },
];

const ok = <T,>(data: T): Promise<CampusResult<T>> => Promise.resolve({ ok: true, data });
const fail = <T,>(error: string): Promise<CampusResult<T>> => Promise.resolve({ ok: false, error });

function nyToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
}
function mondayOf(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

export function createCampusSim(preset = "", opts: { here?: () => CampusId | null } = {}): CampusApi {
  const today = nyToday();
  const week = mondayOf(today);
  const friday = preset === "friday" || preset === "done";
  const picked = ["main-character-101", "napping-301", "group-project"];
  const s: CampusState = {
    campus: preset ? "st-johnsons" : null,
    enrolledOn: preset ? week : null,
    transferOn: null,
    week,
    today,
    examsOpen: friday,
    scheduleLocked: preset === "week" || friday,
    courses: preset && preset !== "pick" ? picked.map((id, i): CourseState => ({
      id, attendedToday: i === 0, daysThisWeek: friday ? 4 : 2 - (i === 2 ? 1 : 0), streak: friday ? 4 : 2 + (i === 0 ? 1 : 0),
      exam: preset === "done" ? { grade: i === 2 ? "B" : "A", percent: i === 2 ? 88 : 96, correct: 5, caught: false } : null,
    })) : [],
    gpa: preset === "done" ? 3.67 : null,
    weekGpa: preset === "done" ? 3.67 : null,
    scholarshipPaid: preset === "done",
  };
  if (s.campus) s.transferOn = new Date(new Date(`${week}T12:00:00Z`).getTime() + CAMPUS.transferDays * 86_400_000).toISOString().slice(0, 10);
  const board: Leaderboard = {
    week,
    campuses: [
      { campus: "queensborough-u", students: 1840, classes: 9120, points: 2210, score: 9120 + 5 * 2210 },
      { campus: "st-johnsons", students: 1702, classes: 8890, points: 2304, score: 8890 + 5 * 2304 },
    ].sort((a, b) => b.score - a.score) as Leaderboard["campuses"],
  };
  // Without opts.here the sheet's own "you're here" check stands in (the preview passes it from the city).
  const away = (c: CampusId | null) => !!opts.here && opts.here() !== c;
  const copy = () => JSON.parse(JSON.stringify(s)) as CampusState;

  return {
    state: () => ok(copy()),
    enrol(campus) {
      if (away(campus)) return fail("You're not there yet. Go there first.");
      if (s.campus === campus) return fail("You already go here. Your student ID agrees.");
      s.campus = campus;
      s.enrolledOn = today;
      return ok(copy());
    },
    pick(courses) {
      if (!s.campus) return fail("Enroll here first. The registrar has a form. Of course it does.");
      if (new Set(courses).size !== CAMPUS.coursesPerWeek) return fail("Pick exactly three different courses.");
      if (s.scheduleLocked) return fail("You've already been to class this week. Your schedule is set until Monday.");
      s.courses = courses.map((id) => ({ id, attendedToday: false, daysThisWeek: 0, streak: 0, exam: null }));
      return ok(copy());
    },
    attend(course): Promise<CampusResult<AttendResult>> {
      const c = s.courses.find((x) => x.id === course);
      if (!s.campus) return fail("Enroll here first. The registrar has a form. Of course it does.");
      if (away(s.campus)) return fail("You're not there yet. Go there first.");
      if (!c) return fail("You're not taking that course this week.");
      if (c.attendedToday) return fail("You already went to that class today. Overachiever.");
      c.attendedToday = true;
      c.daysThisWeek += 1;
      c.streak += 1;
      s.scheduleLocked = true;
      return ok({ clout: CAMPUS.attend.clout, confidence: CAMPUS.attend.confidence, energy: -CAMPUS.attend.energy, streak: c.streak });
    },
    exam(course) {
      const c = s.courses.find((x) => x.id === course);
      if (!s.examsOpen) return fail("Exams open Friday. Until then, it's just vibes and attendance.");
      if (!c) return fail("You're not taking that course this week.");
      if (c.exam) return fail("You already took that exam. No retakes, no matter how nicely you ask.");
      return ok(SAMPLE.map((x) => x.q));
    },
    submit(course, answers, peek): Promise<CampusResult<SubmitResult>> {
      const c = s.courses.find((x) => x.id === course);
      if (!c || c.exam) return fail("You already took that exam. No retakes, no matter how nicely you ask.");
      let correct = SAMPLE.filter((x, i) => answers[i] === x.answer).length;
      let caught = false;
      if (peek) {
        correct = Math.min(CAMPUS.quizSize, correct + CAMPUS.peek.bonus);
        caught = Math.random() < CAMPUS.peek.caughtChance;
      }
      const percent = coursePercent(c.daysThisWeek, correct);
      const grade = caught ? "F" : gradeFor(percent).letter;
      c.exam = { grade, percent, correct, caught };
      const done = s.courses.every((x) => x.exam);
      const pts = (g: string) => ({ A: 4, B: 3, C: 2, D: 1 } as Record<string, number>)[g] ?? 0;
      const weekGpa = done ? Math.round((s.courses.reduce((a, x) => a + pts(x.exam!.grade), 0) / s.courses.length) * 100) / 100 : null;
      const scholarship = done && weekGpa! >= CAMPUS.scholarship.gpa && !s.scholarshipPaid ? CAMPUS.scholarship.cash : 0;
      if (scholarship) s.scholarshipPaid = true;
      s.weekGpa = weekGpa;
      s.gpa = weekGpa ?? s.gpa;
      return ok({ grade, percent, correct, caught, weekGpa, scholarship });
    },
    eat() {
      const at = opts.here ? opts.here() : s.campus ?? "st-johnsons";
      if (!at) return fail("You're not there yet. Go there first.");
      return ok({ cash: -(at === s.campus ? CAMPUS.dining.student : CAMPUS.dining.visitor), energy: -CAMPUS.dining.energy });
    },
    leaderboard: () => ok(JSON.parse(JSON.stringify(board)) as Leaderboard),
  };
}

