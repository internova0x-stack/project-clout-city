// Weekly exam questions (v0.15 campus life, docs/08-new-features-spec.md section 18): one file per week in
// content/exams/<monday>.json, five questions for every course in the catalog. Server and scripts only: the files carry
// the answers, which must never reach a player's bundle. The game server stores each valid week with
// content_import_exams() (migration 0077); players only ever get the questions (campus_exam).
import { CAMPUS, COURSES } from "./campus.ts";

export interface ExamQuestionFile { prompt: string; choices: string[]; answer: number }
export interface ExamWeekFile { week: string; courses: Record<string, ExamQuestionFile[]> }
/** One row for content_import_exams(). */
export interface ExamRow { course: string; position: number; prompt: string; choices: string[]; answer: number }

const isMonday = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && new Date(`${d}T12:00:00Z`).getUTCDay() === 1;

/** The Studio's rules for an exam week: a Monday, every course, five questions each, 2 to 5 choices, a real answer. */
export function validateExamWeek(raw: unknown): { ok: true; week: string; rows: ExamRow[] } | { ok: false; problems: string[] } {
  const problems: string[] = [];
  const w = raw as Partial<ExamWeekFile> | null;
  if (!w || typeof w !== "object") return { ok: false, problems: ["not a JSON object"] };
  if (typeof w.week !== "string" || !isMonday(w.week)) problems.push("week: a Monday, as YYYY-MM-DD");
  const courses = w.courses && typeof w.courses === "object" ? w.courses : {};
  const rows: ExamRow[] = [];
  for (const id of Object.keys(courses)) if (!COURSES.some((c) => c.id === id)) problems.push(`courses: "${id}" isn't in the catalog`);
  const seen = new Set<string>();
  for (const c of COURSES) {
    const qs = courses[c.id];
    if (!Array.isArray(qs) || qs.length !== CAMPUS.quizSize) { problems.push(`${c.id}: exactly ${CAMPUS.quizSize} questions`); continue; }
    qs.forEach((q, i) => {
      const where = `${c.id} #${i + 1}`;
      if (typeof q?.prompt !== "string" || q.prompt.trim().length < 10 || q.prompt.length > 140) problems.push(`${where}: prompt of 10 to 140 characters`);
      else if (seen.has(q.prompt.trim().toLowerCase())) problems.push(`${where}: the same prompt is used twice this week`);
      else seen.add(q.prompt.trim().toLowerCase());
      const ok = Array.isArray(q?.choices) && q.choices.length >= 2 && q.choices.length <= 5
        && q.choices.every((x) => typeof x === "string" && x.trim().length > 0 && x.length <= 60)
        && new Set(q.choices.map((x) => x.trim().toLowerCase())).size === q.choices.length;
      if (!ok) problems.push(`${where}: 2 to 5 different choices of up to 60 characters`);
      if (!Number.isInteger(q?.answer) || q.answer < 0 || q.answer >= (q?.choices?.length ?? 0)) problems.push(`${where}: answer is the index of the right choice`);
      if (ok && Number.isInteger(q.answer)) rows.push({ course: c.id, position: i + 1, prompt: q.prompt.trim(), choices: q.choices.map((x) => x.trim()), answer: q.answer });
    });
  }
  return problems.length ? { ok: false, problems } : { ok: true, week: w.week!, rows };
}
