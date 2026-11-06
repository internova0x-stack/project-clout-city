"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CAMPUS, CAMPUSES, COURSES, EXAM_PASS_PERCENT, campusById, courseById, examPassed, gradeLine, menuFor, roommateNote,
  type CampusApi, type CampusId, type CampusState, type ExamQuestion, type Leaderboard, type SubmitResult,
} from "@/lib/campus";
import { ASPIRE } from "@/lib/aspirations";
import { formatCash } from "@/lib/economy";
import { celebrate } from "../Celebrate";
import { Sheet } from "../Sheet";

type Tab = "classes" | "exams" | "dining" | "pride";

/**
 * Campus life (v0.15, spec section 18): enrol, pick the week's courses, go to class, take Friday's exams, eat at the
 * dining hall, see the dorm and the school-vs-school leaderboard. Everything is checked on the server (migration 0072);
 * the sheet opens from anywhere, but classes, exams and the dining hall need you on campus.
 */
export function CampusSheet({
  open, onClose, campusId, api, here, onDone, dorm, tab: initialTab,
}: {
  open: boolean;
  onClose: () => void;
  /** v0.15 campus areas: the tab to open on (the lecture desks, the library's exam table, the dining hall). */
  tab?: Tab;
  /** The campus whose card this was opened from. */
  campusId: CampusId;
  api: CampusApi;
  /** The player is standing on this campus. */
  here: boolean;
  /** After anything that changes cash, Energy or clout: a toast, and the city refreshes. */
  onDone: (toast: string) => void;
  /** The campus dorm: its rent, whether the player lives there, and moving in (the Apartments rules). */
  dorm?: { rent: number; livesHere: boolean; onMove: () => void };
}) {
  const campus = campusById(campusId)!;
  const [s, setS] = useState<CampusState | null>(null);
  const [board, setBoard] = useState<Leaderboard | null>(null);
  const [tab, setTab] = useState<Tab>(initialTab ?? "classes");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picks, setPicks] = useState<string[]>([]);
  const [quiz, setQuiz] = useState<{ course: string; questions: ExamQuestion[]; answers: (number | null)[]; at: number; peek: boolean } | null>(null);
  const [result, setResult] = useState<(SubmitResult & { course: string }) | null>(null);

  const load = useCallback(async () => {
    const [st, lb] = await Promise.all([api.state(), api.leaderboard()]);
    if (st.ok) setS(st.data);
    if (lb.ok) setBoard(lb.data);
  }, [api]);
  useEffect(() => {
    if (!open) return;
    setError(null);
    void load();
  }, [open, load]);

  const enrolledHere = s?.campus === campusId;
  const other = s?.campus && s.campus !== campusId ? campusById(s.campus) : null;
  // Visitors see the dining hall and the leaderboard only.
  const view: Tab = enrolledHere ? tab : tab === "pride" ? "pride" : "dining";

  async function act<T>(key: string, fn: () => Promise<{ ok: true; data: T } | { ok: false; error: string }>, after?: (d: T) => void) {
    setBusy(key);
    setError(null);
    const r = await fn();
    setBusy(null);
    if (!r.ok) return setError(r.error);
    after?.(r.data);
  }

  const enrol = () => act("enrol", () => api.enrol(campusId), (d) => { setS(d); onDone(`Welcome to ${campus.name}. Go ${campus.mascot}! 🎓`); });
  const lockIn = () => act("pick", () => api.pick(picks), (d) => { setS(d); setPicks([]); });
  const attend = (id: string) => act(`attend:${id}`, () => api.attend(id), (d) => {
    void load();
    onDone(`📚 ${courseById(id)?.name}: +${d.clout} clout · +${d.confidence} Confidence${d.streak > 1 ? ` · 🔥 ${d.streak}-day streak` : ""}${d.taskCash ? ` · ✅ Go to class: +C$${d.taskCash}` : ""}`);
  });
  const startExam = (id: string) => act(`exam:${id}`, () => api.exam(id), (q) => {
    setResult(null);
    setQuiz({ course: id, questions: q, answers: q.map(() => null), at: 0, peek: false });
  });
  const submit = () => {
    if (!quiz) return;
    const answers = quiz.answers.map((a) => a ?? -1);
    void act("submit", () => api.submit(quiz.course, answers, quiz.peek), (d) => {
      setQuiz(null);
      setResult({ ...d, course: quiz.course });
      void load();
      showExamResult(d, quiz.course);
      // The results card replaces the scholarship toast; an empty message only refreshes the city (the cash).
      if (d.scholarship) onDone("");
    });
  };
  // The exam's results screen (owner, Nov 4): the grade as the hero, the score against the pass line, what you keep.
  function showExamResult(d: SubmitResult, courseId: string) {
    const course = courseById(courseId);
    const passed = examPassed(d);
    const short = Math.max(0, EXAM_PASS_PERCENT - d.percent);
    const keep = [
      ...(d.scholarship ? [`${formatCash(d.scholarship)} scholarship`] : []),
      passed ? `${d.grade} on your transcript` : "Your attendance marks",
      "Your enrollment",
      "Your class streaks",
    ];
    celebrate({
      rung: 3,
      emoji: course?.emoji ?? "📝",
      tag: "Exam results",
      title: d.caught ? "Caught peeking" : passed ? (d.grade === "A" ? "Top of the class" : "You passed") : "So close",
      cta: "Back to campus",
      twist: "stamp",
      result: {
        tone: passed ? "win" : "warn",
        stamp: d.caught ? { text: "CAUGHT", tone: "bad" } : passed ? { text: "PASSED", tone: "good" } : { text: "RETAKE", tone: "warn" },
        big: d.grade,
        unit: `Exam · ${course?.name ?? "Course"}`,
        story: d.caught ? "The professor saw everything. Next Friday, eyes on your own paper."
          : passed ? (d.scholarship ? `A ${d.weekGpa?.toFixed(2)} week. The scholarship committee noticed.` : gradeLine(d))
          : `${short} point${short === 1 ? "" : "s"} short of a C. New exams next Friday.`,
        meter: {
          label: "Score", have: d.percent, need: EXAM_PASS_PERCENT, max: 100,
          say: passed ? `${d.percent}% · pass line ${EXAM_PASS_PERCENT}%` : d.caught ? `${d.percent}% before the F` : `${d.percent}% · ${short} to pass`,
        },
        keep,
      },
    });
    if (!passed || !api.degree) return;
    // The third pass at C or better is a degree: careers start a level higher (lib/aspirations.ts, migration 0143).
    void api.degree().then((r) => {
      if (!r.ok || r.data.exams !== ASPIRE.degreeExams) return;
      celebrate({
        rung: 3,
        emoji: "🎓",
        tag: "Degree",
        title: "You have a degree",
        line: `${ASPIRE.degreeExams} exams passed. New careers can start you a level higher. Frame it; your mom already did.`,
        art: "stage",
        rewards: [{ text: "+1 starting level" }, { text: `${campus.short} alum` }],
        cta: "Back to campus",
      });
    });
  }
  const eat = () => act("eat", () => api.eat(), (d) => onDone(`🍽️ ${formatCash(-d.cash)} · +${-d.energy} Energy. ${menuFor(s?.today ?? "").split(":")[0]} survived.`));

  return (
    <Sheet open={open} onClose={() => { setQuiz(null); setResult(null); onClose(); }} label={campus.name} tall>
      <div className="stack-16 campus">
        <div className="campus-head" style={{ paddingRight: 44 }}>
          <span className="campus-crest" aria-hidden="true">{campus.emoji}</span>
          <div className="stack-4" style={{ minWidth: 0 }}>
            <h2 className="display-lg" style={{ margin: 0 }}>{campus.short}</h2>
            <p className="subtext" style={{ margin: 0 }}>
              {enrolledHere ? `You're a student. Home of ${campus.mascot}.` : other ? `Visiting. You go to ${other.short}.` : `You're visiting. Home of ${campus.mascot}.`}
            </p>
          </div>
        </div>

        {error && <p className="error-text" role="alert" style={{ margin: 0 }}>{error}</p>}
        {!s && <p className="subtext">Checking the registrar…</p>}

        {s && !s.campus && (
          <div className="card stack-8">
            {/* Owner, Nov 6 ("I don't get what is going on on the Queensborough screens"): what a student gets, plainly. */}
            <p className="title" style={{ margin: 0 }}>Become a student here</p>
            <ul className="campus-perks">
              <li><span aria-hidden="true">📚</span><span><b>Classes:</b> pick {CAMPUS.coursesPerWeek} a week. Each class is +{CAMPUS.attend.clout} clout and +{CAMPUS.attend.confidence} Confidence, and a daily task.</span></li>
              <li><span aria-hidden="true">📝</span><span><b>Friday exams:</b> a {CAMPUS.scholarship.gpa} GPA pays a {formatCash(CAMPUS.scholarship.cash)} scholarship. Pass three for a degree, which can start your career a level higher.</span></li>
              <li><span aria-hidden="true">🛏️</span><span><b>A dorm room:</b> the cheapest rent in the city.</span></li>
              <li><span aria-hidden="true">🍽️</span><span><b>The dining hall</b> at half price ({formatCash(CAMPUS.dining.student)}).</span></li>
              <li><span aria-hidden="true">👑</span><span><b>Run for Homecoming</b> royalty in University HQ.</span></li>
            </ul>
            <p className="meta" style={{ margin: 0 }}>Free to enroll. One campus at a time; switching takes a week of paperwork.</p>
            <button className="btn btn-taxi" disabled={!here || busy !== null} onClick={() => void enrol()}>
              {here ? (busy === "enrol" ? "Filling in forms…" : "Enroll here") : "Go there to enroll"}
            </button>
          </div>
        )}

        {s && other && (
          <div className="card stack-8">
            <p className="subtext" style={{ margin: 0 }}>
              Transferring takes a week of paperwork{s.transferOn && s.transferOn > s.today ? `: you can switch from ${new Date(`${s.transferOn}T12:00:00Z`).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}` : ""}.
            </p>
            {s.transferOn !== null && s.transferOn <= s.today && (
              <button className="btn btn-secondary" disabled={!here || busy !== null} onClick={() => void enrol()}>
                {here ? `Transfer to ${campus.short}` : "Go there to transfer"}
              </button>
            )}
          </div>
        )}

        {s && (
          <div className="segmented" role="tablist">
            {(enrolledHere ? (["classes", "exams", "dining", "pride"] as Tab[]) : (["dining", "pride"] as Tab[])).map((t) => (
              <button key={t} role="tab" aria-pressed={view === t} onClick={() => setTab(t)}>
                {{ classes: "Classes", exams: "Exams", dining: "Dining hall", pride: "Rivalry" }[t]}
              </button>
            ))}
          </div>
        )}

        {/* ---- Classes ---- */}
        {s && enrolledHere && view === "classes" && (
          s.courses.length === 0 ? (
            <div className="stack-8">
              <p className="title" style={{ margin: 0 }}>Pick this week&apos;s three courses</p>
              <p className="subtext" style={{ margin: 0 }}>Go to each class once a day for a streak. Fridays bring the exams.</p>
              <div className="campus-courses">
                {COURSES.map((c) => {
                  const on = picks.includes(c.id);
                  return (
                    <button key={c.id} className={`campus-course pick${on ? " on" : ""}`} aria-pressed={on}
                      onClick={() => setPicks((p) => on ? p.filter((x) => x !== c.id) : p.length < CAMPUS.coursesPerWeek ? [...p, c.id] : p)}>
                      <span className="campus-course-emoji" aria-hidden="true">{c.emoji}</span>
                      <span className="stack-4" style={{ minWidth: 0, flex: 1, textAlign: "left" }}>
                        <span className="title" style={{ display: "block" }}>{c.name}</span>
                        <span className="subtext" style={{ display: "block" }}>{c.blurb}</span>
                      </span>
                      {on && <span className="campus-tick" aria-hidden="true">✓</span>}
                    </button>
                  );
                })}
              </div>
              <button className="btn btn-taxi" disabled={picks.length !== CAMPUS.coursesPerWeek || busy !== null} onClick={() => void lockIn()}>
                {picks.length === CAMPUS.coursesPerWeek ? "Lock in my schedule" : `Pick ${CAMPUS.coursesPerWeek - picks.length} more`}
              </button>
            </div>
          ) : (
            <div className="stack-8">
              {s.courses.map((cs) => {
                const c = courseById(cs.id);
                if (!c) return null;
                return (
                  <div key={c.id} className="campus-course">
                    <span className="campus-course-emoji" aria-hidden="true">{c.emoji}</span>
                    <span className="stack-4" style={{ minWidth: 0, flex: 1 }}>
                      <span className="title" style={{ display: "block" }}>{c.name}</span>
                      <span className="subtext" style={{ display: "block" }}>{c.professor} · {cs.daysThisWeek} this week{cs.streak > 0 ? ` · 🔥 ${cs.streak}` : ""}</span>
                    </span>
                    {cs.attendedToday ? <span className="tag tag-positive">Went today</span> : (
                      <button className="btn btn-taxi btn-sm" disabled={!here || busy !== null} onClick={() => void attend(c.id)}>
                        {here ? "Go to class" : "On campus"}
                      </button>
                    )}
                  </div>
                );
              })}
              <p className="meta" style={{ margin: "4px 0 0" }}>
                Each class: {CAMPUS.attend.energy} Energy for +{CAMPUS.attend.confidence} Confidence, +{CAMPUS.attend.clout} clout and Smarts practice. Miss a day and the streak resets.
              </p>
              {dorm && (
                <div className="card stack-4 campus-dorm">
                  <p className="title" style={{ margin: 0 }}>🛏️ Your dorm room · {formatCash(dorm.rent)} a week</p>
                  <p className="subtext" style={{ margin: 0 }}>
                    {dorm.livesHere ? `Roommate's note today: "${roommateNote(s.today)}"` : "The cheapest rent in the city, a mini fridge and a roommate. Students only."}
                  </p>
                  {!dorm.livesHere && <button className="btn btn-secondary btn-sm" disabled={busy !== null} onClick={dorm.onMove}>See the room</button>}
                </div>
              )}
            </div>
          )
        )}

        {/* ---- Exams ---- */}
        {s && enrolledHere && view === "exams" && !quiz && (
          <div className="stack-8">
            {result && (
              <div className={`card campus-result grade-${result.grade}`}>
                <span className="campus-grade" aria-label={`Grade ${result.grade}`}>{result.grade}</span>
                <div className="stack-4" style={{ minWidth: 0 }}>
                  <p className="title" style={{ margin: 0 }}>{courseById(result.course)?.name} · {result.correct}/{CAMPUS.quizSize} right · {result.percent}%</p>
                  <p className="subtext" style={{ margin: 0 }}>{gradeLine(result)}</p>
                  {result.weekGpa !== null && <p className="meta" style={{ margin: 0 }}>This week&apos;s GPA: {result.weekGpa.toFixed(2)}{result.scholarship ? ` · Scholarship +${formatCash(result.scholarship)}` : ""}</p>}
                </div>
              </div>
            )}
            {!s.examsOpen && (
              <div className="card stack-4">
                <p className="title" style={{ margin: 0 }}>Exams open Friday</p>
                <p className="subtext" style={{ margin: 0 }}>Friday to Sunday, five questions per course. Your grade is half attendance, half answers. A week&apos;s GPA of {CAMPUS.scholarship.gpa} or better pays a {formatCash(CAMPUS.scholarship.cash)} scholarship.</p>
              </div>
            )}
            {s.courses.map((cs) => {
              const c = courseById(cs.id);
              if (!c) return null;
              return (
                <div key={c.id} className="campus-course">
                  <span className="campus-course-emoji" aria-hidden="true">{c.emoji}</span>
                  <span className="stack-4" style={{ minWidth: 0, flex: 1 }}>
                    <span className="title" style={{ display: "block" }}>{c.name}</span>
                    <span className="subtext" style={{ display: "block" }}>{cs.daysThisWeek} of {CAMPUS.attendDaysForFull} classes for full attendance marks</span>
                  </span>
                  {cs.exam ? <span className={`campus-grade-chip grade-${cs.exam.grade}`}>{cs.exam.grade}</span> : (
                    <button className="btn btn-taxi btn-sm" disabled={!s.examsOpen || !here || busy !== null} onClick={() => void startExam(c.id)}>
                      {!s.examsOpen ? "Friday" : here ? "Take exam" : "On campus"}
                    </button>
                  )}
                </div>
              );
            })}
            <div className="card campus-gpa">
              <span className="title">GPA</span>
              <span className="display-md">{s.gpa !== null ? s.gpa.toFixed(2) : "—"}</span>
              {s.scholarshipPaid && <span className="tag tag-positive">Scholarship paid this week</span>}
            </div>
          </div>
        )}
        {quiz && view === "exams" && (() => {
          const q = quiz.questions[quiz.at];
          const last = quiz.at === quiz.questions.length - 1;
          const answered = quiz.answers[quiz.at] !== null;
          return (
            <div className="stack-12 campus-quiz">
              <p className="overline" style={{ margin: 0 }}>{courseById(quiz.course)?.name} · Question {quiz.at + 1} of {quiz.questions.length}</p>
              <p className="title" style={{ margin: 0, fontSize: 18 }}>{q.prompt}</p>
              <div className="stack-8">
                {q.choices.map((ch, i) => (
                  <button key={i} className={`campus-choice${quiz.answers[quiz.at] === i ? " on" : ""}`} aria-pressed={quiz.answers[quiz.at] === i}
                    onClick={() => setQuiz({ ...quiz, answers: quiz.answers.map((a, j) => (j === quiz.at ? i : a)) })}>
                    {ch}
                  </button>
                ))}
              </div>
              {last && (
                <label className="check-row campus-peek">
                  <input type="checkbox" checked={quiz.peek} onChange={(e) => setQuiz({ ...quiz, peek: e.target.checked })} />
                  <span>👀 Peek at your neighbor&apos;s paper: one more right answer, and a {Math.round(CAMPUS.peek.caughtChance * 100)}% chance of getting caught (an F).</span>
                </label>
              )}
              <div className="row" style={{ gap: 8 }}>
                {quiz.at > 0 && <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setQuiz({ ...quiz, at: quiz.at - 1 })}>Back</button>}
                {last ? (
                  <button className="btn btn-taxi" style={{ flex: 2 }} disabled={quiz.answers.some((a) => a === null) || busy !== null} onClick={submit}>
                    {busy === "submit" ? "Grading…" : "Hand it in"}
                  </button>
                ) : (
                  <button className="btn btn-taxi" style={{ flex: 2 }} disabled={!answered} onClick={() => setQuiz({ ...quiz, at: quiz.at + 1 })}>Next</button>
                )}
              </div>
            </div>
          );
        })()}

        {/* ---- Dining hall (students and visitors) ---- */}
        {s && view === "dining" && (
          <div className="card stack-8 campus-dining">
            <p className="overline" style={{ margin: 0 }}>Today at the dining hall</p>
            <p className="title" style={{ margin: 0 }}>{menuFor(s.today)}</p>
            <p className="subtext" style={{ margin: 0 }}>
              {enrolledHere ? `Student price ${formatCash(CAMPUS.dining.student)}` : `Visitor price ${formatCash(CAMPUS.dining.visitor)} (students pay ${formatCash(CAMPUS.dining.student)})`} · +{-CAMPUS.dining.energy} Energy
            </p>
            <button className="btn btn-taxi" disabled={!here || busy !== null} onClick={() => void eat()}>{here ? "Grab a tray" : "Go there to eat"}</button>
          </div>
        )}

        {/* ---- School pride: the leaderboard ---- */}
        {s && view === "pride" && board && (
          <div className="stack-8">
            <p className="subtext" style={{ margin: 0 }}>Which campus studies harder this week. Students score for their school: 1 point a class, 5 a grade point. Resets Monday.</p>
            {board.campuses.map((row, i) => {
              const c = campusById(row.campus) ?? CAMPUSES[0];
              const top = board.campuses[0]?.score || 1;
              return (
                <div key={row.campus} className={`card campus-board${row.campus === s.campus ? " mine" : ""}`}>
                  <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
                    <span className="title">{i === 0 ? "🏆 " : ""}{c.emoji} {c.short}</span>
                    <span className="body-strong">{row.score.toLocaleString()}</span>
                  </div>
                  <div className="campus-bar"><span style={{ width: `${Math.max(4, (row.score / top) * 100)}%` }} /></div>
                  <span className="meta">{row.students.toLocaleString()} students · {row.classes.toLocaleString()} classes · {row.points.toLocaleString()} grade points</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Sheet>
  );
}
