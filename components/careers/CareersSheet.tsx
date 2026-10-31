"use client";

import { useCallback, useEffect, useState } from "react";
import { Sheet } from "@/components/Sheet";
import { PLACES } from "@/lib/city";
import { ASPIRATIONS, ASPIRE, aspirationById, aspirationName, changeOn, type AspirationId, type AspirationState } from "@/lib/aspirations";
import { CAREER, INTERVIEW, OFFICE, type Answer, type CareerApi, type CareerScreen, type CareerView, type OfficeAction, type Target, type TrackCard, type TrackId, type WorkStyle } from "@/lib/careers";

// Careers (spec section 30; migration 0135): the Phone's Careers app. Without a job: the three tracks, where you'd start
// and what each needs, then a short interview card. With one: the job card (title, pay, performance, the people), today's
// workday (pace, then the manager's tasks, then how the day went), the last review and the ladder. The server decides
// everything; this only asks.

const placeName = (id: string) => PLACES.find((p) => p.id === id)?.name ?? id;
const cs = (n: number) => `C$${n.toLocaleString("en-US")}`;

export function CareersSheet({ open, onClose, api, onToast, onGo, onChanged, onWorkdayDone }: {
  open: boolean;
  onClose: () => void;
  api: CareerApi;
  onToast: (text: string) => void;
  /** Takes the player to the job's place (the map, its card). */
  onGo: (place: string) => void;
  /** Something changed Energy, Mood, cash or clout: the game refreshes its numbers. */
  onChanged: () => void;
  /** The day's last task is done (a situation card may follow, like after a shift). */
  onWorkdayDone: () => void;
}) {
  const [data, setData] = useState<CareerScreen | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [applying, setApplying] = useState<TrackCard | null>(null);
  const [picking, setPicking] = useState(false);

  const run = useCallback(async (p: ReturnType<CareerApi["screen"]>, toast = true) => {
    setBusy(true);
    const r = await p;
    setBusy(false);
    if (!r.ok) { setError(r.error); onToast(r.error); return null; }
    setError(null);
    setData(r.data);
    if (toast && r.data.receipt) onToast(r.data.receipt);
    return r.data;
  }, [onToast]);

  useEffect(() => { if (open) { setApplying(null); setPicking(false); void run(api.screen(), false); } }, [open, api, run]);

  const job = data?.job?.status === "employed" ? data.job : null;
  // Aspirations (migration 0143): the welcome screen until the player picks one (never before the migration: null).
  const asp = data?.aspiration ?? null;
  const welcome = !!data && !!asp && (!asp.aspiration || picking);
  return (
    <Sheet open={open} onClose={onClose} label={job ? job.employer : "Careers"} tall>
      <div className="careers stack-16">
        {!data && !error && <p className="meta">Checking the job listings…</p>}
        {!data && error && <p className="error-text">{error}</p>}
        {welcome && asp && (
          <Welcome state={asp} busy={busy} today={new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" })}
            onCancel={asp.aspiration ? () => setPicking(false) : undefined}
            onPick={async (id) => { if (await run(api.aspire(id), false)) { setPicking(false); onToast(`${aspirationById(id)!.emoji} Aspiration set: ${aspirationName(id)}.`); } }} />
        )}
        {!welcome && asp?.aspiration && <AspirationChip state={asp} onChange={() => setPicking(true)} />}
        {!welcome && data && job && (
          <Job data={data} v={job} busy={busy}
            onGo={() => { onClose(); onGo(job.place); }}
            onStart={async (style) => { if (await run(api.start(style), false)) onChanged(); }}
            onTask={async (i, o) => {
              const r = await run(api.task(i, o), false);
              if (r) { onChanged(); if (r.job?.today?.done) onWorkdayDone(); }
            }}
            onOffice={async (a, w) => { if (await run(api.office(a, w))) onChanged(); }}
            onQuit={async (reason) => { if (await run(api.quit(reason))) onChanged(); }}
            onStick={async () => { await run(api.stick()); }} />
        )}
        {!welcome && data && !job && !applying && <Listings data={data} onApply={setApplying} />}
        {!welcome && data && !job && applying && (
          <Interview card={applying} canConnect={data.canConnect} busy={busy} onBack={() => setApplying(null)}
            onAnswer={async (a) => { const r = await run(api.apply(applying.id, a)); if (r?.job) setApplying(null); }} />
        )}
      </div>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------------------------------------------

function Listings({ data, onApply }: { data: CareerScreen; onApply: (t: TrackCard) => void }) {
  const [openId, setOpenId] = useState<TrackId | null>(null);
  const ended = data.job && data.job.status !== "employed" ? data.job : null;
  return (
    <>
      <div className="careers-poster">
        <p className="overline">💼 Careers</p>
        <h2 className="display-lg" style={{ margin: 0 }}>Get a real job</h2>
        <p className="subtext" style={{ margin: 0 }}>A weekly paycheck, a title, a manager who has opinions. Gigs still pay more per hour. This pays every week.</p>
      </div>
      {ended && (
        <div className="card stack-4">
          <p className="title" style={{ margin: 0 }}>{ended.status === "fired" ? "📦 You were fired" : "👋 You quit"} from {ended.employer}</p>
          <p className="meta" style={{ margin: 0 }}>{ended.status === "fired" ? "They'll take you back in a week, at the bottom. Other tracks are open now." : "You can go back in two days, one level below where you left."}</p>
        </div>
      )}
      <div className="stack-12">
        {data.tracks.map((t) => {
          const start = t.ladder[t.start - 1];
          const can = !t.missing.length && !t.reapplyOn;
          return (
            <div key={t.id} className="card careers-track stack-12">
              <button className="careers-track-head" onClick={() => setOpenId(openId === t.id ? null : t.id)} aria-expanded={openId === t.id}>
                <span className="careers-emoji" aria-hidden="true">{t.emoji}</span>
                <span className="careers-col" style={{ flex: 1, minWidth: 0 }}>
                  <span className="title">{t.name} · {t.employer}</span>
                  <span className="meta">Start as {start.title} · {cs(start.salary)} a week · {placeName(t.place)}</span>
                  {t.headStart > 0 && <span className="meta careers-headstart">⭐ {t.headStart === 2 ? "Two levels" : "A level"} of head start from your {headStartWhy(data.aspiration, t.id)}</span>}
                </span>
                <span className="careers-chev" aria-hidden="true">{openId === t.id ? "▴" : "▾"}</span>
              </button>
              <p className="subtext" style={{ margin: 0 }}>{t.blurb}</p>
              {openId === t.id && (
                <div className="stack-12">
                  <div className="careers-ladder">
                    {t.ladder.map((l, i) => (
                      <div key={l.title} className={`careers-rung${i + 1 === t.start ? " here" : ""}`}>
                        <span className="careers-rung-n">{i + 1}</span>
                        <span className="careers-col" style={{ flex: 1, minWidth: 0 }}>
                          <span className="careers-rung-title">{l.title}</span>
                          {l.needs.length > 0 && <span className="meta">Needs {l.needs.join(", ")}</span>}
                        </span>
                        <span className="careers-rung-pay">{cs(l.salary)}</span>
                      </div>
                    ))}
                  </div>
                  <p className="meta" style={{ margin: 0 }}>🔑 Key skills: {t.keySkills.join(" and ")}</p>
                  <p className="meta" style={{ margin: 0 }}>👔 {t.manager}</p>
                  {t.perks.map((p) => <p key={p.text} className="meta" style={{ margin: 0 }}>🎁 {p.text}{p.level > 1 ? ` (from level ${p.level})` : ""}</p>)}
                </div>
              )}
              {t.reapplyOn ? <p className="meta" style={{ margin: 0 }}>⏳ They'll see you again from {t.reapplyOn}.</p>
                : t.missing.length ? <p className="meta" style={{ margin: 0 }}>🔒 To apply: {t.missing.join(", ")}. Practice skills around the city.</p> : null}
              <button className="btn btn-taxi" disabled={!can} onClick={() => onApply(t)}>Apply</button>
            </div>
          );
        })}
      </div>
      <p className="meta">One job at a time. Every employer is invented.</p>
    </>
  );
}

function Interview({ card, canConnect, busy, onBack, onAnswer }: { card: TrackCard; canConnect: boolean; busy: boolean; onBack: () => void; onAnswer: (a: Answer) => void }) {
  const [sel, setSel] = useState<Answer | null>(null);
  return (
    <div className="stack-16">
      <button className="btn btn-ghost" style={{ alignSelf: "flex-start" }} onClick={onBack}>‹ All jobs</button>
      <div className="choice-head">
        <span className="choice-icon" aria-hidden="true">🤝</span>
        <span className="overline">Interview · {card.employer}</span>
        <p className="choice-title">{card.manager.split(" · ")[0]} looks up from your résumé: "So. Why should we hire you?"</p>
      </div>
      <div className="choice-options" role="radiogroup" aria-label="Your answer">
        {INTERVIEW.map((o) => {
          const off = o.id === "connection" && !canConnect;
          return (
            <button key={o.id} role="radio" aria-checked={sel === o.id} className="choice-opt" disabled={busy || off} onClick={() => setSel(o.id)}>
              <span className="choice-opt-row"><span className="choice-opt-label">{o.label}</span></span>
              {off && <span className="meta">Needs a crew or {CAREER.connectionClout} clout</span>}
              {sel === o.id && (
                <span className="choice-opt-more">
                  <span><b>You get</b> {o.get}</span>
                  <span><b>It costs</b> {o.cost}</span>
                </span>
              )}
            </button>
          );
        })}
      </div>
      <button className="btn btn-taxi" disabled={busy || !sel} onClick={() => sel && onAnswer(sel)}>Answer</button>
    </div>
  );
}

function Meter({ label, value, tone = "neon" }: { label: string; value: number; tone?: "neon" | "green" | "red" }) {
  return (
    <div className="careers-meter">
      <span className="careers-meter-label">{label}</span>
      <span className={`careers-bar ${tone}`}><span style={{ width: `${value}%` }} /></span>
      <span className="careers-meter-n">{value}</span>
    </div>
  );
}

function Job({ data, v, busy, onGo, onStart, onTask, onOffice, onQuit, onStick }: {
  data: CareerScreen; v: CareerView; busy: boolean;
  onGo: () => void; onStart: (s: WorkStyle) => void; onTask: (i: number, o: string) => void; onOffice: (a: OfficeAction, w: Target) => void;
  onQuit: (reason?: "business") => void; onStick: () => void;
}) {
  const [style, setStyle] = useState<WorkStyle>("steady");
  const [confirmQuit, setConfirmQuit] = useState(false);
  const here = v.remote || data.atPlace === v.place;
  const tone = (n: number) => (n >= 60 ? "green" : n < 40 ? "red" : "neon");
  return (
    <>
      <div className="card stack-12">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <span className="careers-col">
            <span className="overline">Level {v.level} of {v.levels}</span>
            <span className="display-md">{v.title}</span>
            <span className="meta">{v.employer} · {placeName(v.place)}</span>
          </span>
          <span className="careers-pay">{cs(v.salary)}<small>/week</small></span>
        </div>
        <Meter label="Performance" value={v.performance} tone={tone(v.performance)} />
        <p className="meta" style={{ margin: 0 }}>
          📅 {v.workedThisWeek} of {CAREER.expectedDays} workdays · review {v.daysToReview === 0 ? "today" : `in ${v.daysToReview} day${v.daysToReview > 1 ? "s" : ""}`}
          {v.warnings > 0 ? " · ⚠️ on a warning" : ""}
        </p>
      </div>

      {v.quitCard && (
        <div className="card stack-12 careers-quitcard">
          <p className="title" style={{ margin: 0 }}>😩 You dread coming in</p>
          <p className="subtext" style={{ margin: 0 }}>
            Work mood {v.workMood}. Sunday nights feel like a sentence. Is {v.employer} still worth it?
          </p>
          <div className="choice-options">
            <button className="choice-opt" disabled={busy} onClick={onStick}>
              <span className="choice-opt-row"><span className="choice-opt-label">💪 Stick it out</span></span>
              <span className="choice-opt-more"><span><b>You get</b> The paycheck, a little calm</span><span><b>It costs</b> Another week of this</span></span>
            </button>
            <button className="choice-opt" disabled={busy} onClick={() => onQuit()}>
              <span className="choice-opt-row"><span className="choice-opt-label">🚪 Hand in your notice</span></span>
              <span className="choice-opt-more"><span><b>You get</b> Your evenings back, a lighter mood</span><span><b>It costs</b> This week's pay, and the job</span></span>
            </button>
            <button className="choice-opt" disabled={busy || !data.businesses} onClick={() => onQuit("business")}>
              <span className="choice-opt-row"><span className="choice-opt-label">🏪 Quit to run your business</span></span>
              <span className="choice-opt-more">
                {data.businesses ? <><span><b>You get</b> Your own boss, a better mood</span><span><b>It costs</b> This week's pay, and the job</span></>
                  : <span>Needs a business of your own (Phone → Businesses).</span>}
              </span>
            </button>
          </div>
        </div>
      )}

      {v.review && (
        <div className={`card stack-8 careers-review ${v.review.outcome}`}>
          <p className="title" style={{ margin: 0 }}>📋 Your review</p>
          {v.review.lines.map((l) => <p key={l} className="subtext" style={{ margin: 0 }}>{l}</p>)}
        </div>
      )}

      {/* Today's workday */}
      {!v.today && v.canWork && (
        <div className="card stack-12">
          <p className="title" style={{ margin: 0 }}>Today's workday</p>
          {!here ? (
            <>
              <p className="subtext" style={{ margin: 0 }}>Work is at {placeName(v.place)}. Head there to clock in.</p>
              <button className="btn btn-taxi" onClick={onGo}>Go to {placeName(v.place)}</button>
            </>
          ) : (
            <>
              <div className="choice-options" role="radiogroup" aria-label="Your pace today">
                {(Object.keys(CAREER.styles) as WorkStyle[]).map((k) => {
                  const st = CAREER.styles[k];
                  return (
                    <button key={k} role="radio" aria-checked={style === k} className="choice-opt" disabled={busy} onClick={() => setStyle(k)}>
                      <span className="choice-opt-row">
                        <span className="choice-opt-label">{st.emoji} {st.label}</span>
                        <span className="meta">⚡ {st.energy}</span>
                      </span>
                      {style === k && <span className="choice-opt-more"><span>{st.blurb}</span></span>}
                    </button>
                  );
                })}
              </div>
              <button className="btn btn-taxi" disabled={busy || data.energy < CAREER.styles[style].energy} onClick={() => onStart(style)}>
                {data.energy < CAREER.styles[style].energy ? `Not enough Energy (${data.energy})` : "Clock in"}
              </button>
            </>
          )}
        </div>
      )}
      {v.today && <Workday v={v} busy={busy} onTask={onTask} />}
      {v.officeLeft && <Office v={v} busy={busy} onOffice={onOffice} />}
      {!v.today && !v.canWork && (
        <div className="card"><p className="subtext" style={{ margin: 0 }}>✅ You've worked today. Come back tomorrow.</p></div>
      )}

      {/* The people */}
      <div className="card stack-8">
        <p className="title" style={{ margin: 0 }}>The people</p>
        <Meter label={`${v.people.manager.emoji} ${v.people.manager.name.split(" ")[0]} · boss`} value={v.trust.manager} tone={tone(v.trust.manager)} />
        <Meter label={`${v.people.friend.emoji} ${v.people.friend.name}${v.lifer ? " 💛" : ""}`} value={v.trust.friend} tone={tone(v.trust.friend)} />
        <Meter label={`${v.people.rival.emoji} ${v.people.rival.name}`} value={v.trust.rival} tone={tone(v.trust.rival)} />
        <Meter label={`${v.people.bigBoss.emoji} ${v.people.bigBoss.name.split(" ")[0]} · big boss`} value={v.bigBoss} tone={tone(v.bigBoss)} />
        <p className="meta" style={{ margin: 0 }}>How much each of them trusts you. {v.people.manager.style}. {v.people.bigBoss.name} {v.people.bigBoss.title}.</p>
        {v.lifer && <p className="meta" style={{ margin: 0 }}>💛 {v.people.friend.name} is a friend for life: they never fall far, and they cover a missed day a week.</p>}
        {v.ally && <p className="meta" style={{ margin: 0 }}>{v.people.newHire.emoji} {v.people.newHire.name}, the new hire you mentored, has your back: they&apos;ll tip you off before the next payback.</p>}
        {v.grudges.map((g) => (
          <p key={g.who} className="careers-grudge">😠 {g.who === "manager" ? v.people.manager.name.split(" ")[0] : v.people[g.who].name} is holding a grudge{g.level >= 3 ? " (a big one)" : g.level === 2 ? " (a real one)" : ""}. Expect payback at work. Helping or sharing credit cools it.</p>
        ))}
        {v.guarded && <p className="careers-grudge">🧱 People here have caught you twice. They're guarded now: trust grows half as fast.</p>}
        <Meter label="💼 Work mood" value={v.workMood} tone={tone(v.workMood)} />
      </div>

      {v.next ? (
        <div className="card stack-4">
          <p className="title" style={{ margin: 0 }}>Next up: {v.next.title} · {cs(v.next.salary)}</p>
          <p className="meta" style={{ margin: 0 }}>
            Performance {CAREER.promote.perf}+, your boss's trust, and {v.level} good review{v.level > 1 ? "s" : ""} at this level
            {v.next.missing.length ? `. You also need ${v.next.missing.join(" and ")}.` : "."}
          </p>
        </div>
      ) : <div className="card"><p className="subtext" style={{ margin: 0 }}>👑 Top of the ladder. Act like it.</p></div>}

      {v.log.length > 0 && (
        <div className="stack-4">
          <p className="overline">History</p>
          {v.log.slice(0, 5).map((l, i) => <p key={i} className="meta" style={{ margin: 0 }}>{l.day} · {l.text}</p>)}
        </div>
      )}

      {!confirmQuit ? (
        <button className="btn btn-ghost" disabled={busy} onClick={() => setConfirmQuit(true)}>Quit this job</button>
      ) : (
        <div className="card stack-8">
          <p className="subtext" style={{ margin: 0 }}>Quit {v.employer}? Payday for this week is gone, and they'll take you back in two days, one level down.</p>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setConfirmQuit(false)}>Stay</button>
            <button className="btn btn-destructive" style={{ flex: 1 }} disabled={busy} onClick={() => { setConfirmQuit(false); onQuit(); }}>Quit</button>
          </div>
        </div>
      )}
    </>
  );
}

/** Office politics (part 2): one collaborate and one sabotage move a workday, aimed at someone. */
function Office({ v, busy, onOffice }: { v: CareerView; busy: boolean; onOffice: (a: OfficeAction, w: Target) => void }) {
  const [sel, setSel] = useState<OfficeAction | null>(null);
  const [who, setWho] = useState<Target | null>(null);
  const left = v.officeLeft!;
  const def = OFFICE.find((o) => o.id === sel);
  const name = (w: Target) => (w === "manager" ? `${v.people.manager.name.split(" ")[0]} (boss)` : w === "hire" ? `${v.people.newHire.name} (new hire)` : v.people[w].name);
  // Pushing the boss out: once a job, with the big boss on your side and strong performance.
  const locked = (id: OfficeAction) => (id === "team" && !!v.team) || (id === "pushout" && v.pushout !== "ready");
  const row = (kind: "collab" | "sabotage", title: string) => (
    <div className="stack-8">
      <p className="overline" style={{ margin: 0 }}>{title}{left[kind] ? "" : " · done today"}</p>
      <div className="choice-options" role="radiogroup" aria-label={title}>
        {OFFICE.filter((o) => o.kind === kind).map((o) => (
          <button key={o.id} role="radio" aria-checked={sel === o.id} className="choice-opt" disabled={busy || !left[kind] || locked(o.id)}
            onClick={() => { setSel(o.id); setWho(o.targets.length === 1 ? o.targets[0] : null); }}>
            <span className="choice-opt-row"><span className="choice-opt-label">{o.emoji} {o.label}</span></span>
            {o.id === "pushout" && v.pushout !== "ready" && (
              <span className="meta">{v.pushout === "done" ? "Once a job, and you've had yours." : `Needs ${v.people.bigBoss.name.split(" ")[0]}'s trust ${CAREER.office.pushout.bigBoss}+ and performance ${CAREER.office.pushout.perf}+.`}</span>
            )}
            {sel === o.id && <span className="choice-opt-more"><span><b>You get</b> {o.get}</span><span><b>It costs</b> {o.cost}</span></span>}
          </button>
        ))}
      </div>
    </div>
  );
  return (
    <div className="card stack-12">
      <p className="title" style={{ margin: 0 }}>Office politics</p>
      <p className="meta" style={{ margin: 0 }}>One move each way a workday. People remember.{v.team ? ` Joint project with ${v.team.name}: judged at your review.` : ""}</p>
      {row("collab", "Work with someone")}
      {row("sabotage", "Work against someone")}
      {def && (
        <>
          <div className="chip-row careers-who" role="group" aria-label="Who">
            {def.targets.map((t) => (
              <button key={t} className="chip" aria-pressed={who === t} onClick={() => setWho(t)}>{name(t)}</button>
            ))}
          </div>
          <button className="btn btn-taxi" disabled={busy || !who} onClick={() => { if (who) { onOffice(def.id, who); setSel(null); setWho(null); } }}>
            {who ? `${def.label.replace("their", `${name(who).split(" ")[0]}'s`)}` : "Pick who"}
          </button>
        </>
      )}
    </div>
  );
}

function Workday({ v, busy, onTask }: { v: CareerView; busy: boolean; onTask: (i: number, o: string) => void }) {
  const day = v.today!;
  const [sel, setSel] = useState<Record<number, string>>({});
  const st = CAREER.styles[day.style];
  const nextOpen = day.tasks.find((t) => !t.picked);
  return (
    <div className="card stack-12">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <p className="title" style={{ margin: 0 }}>Today · {st.emoji} {st.label}</p>
        <span className="meta">{day.tasks.filter((t) => t.picked).length}/{day.tasks.length} tasks</span>
      </div>
      {day.tasks.map((t) => (
        <div key={t.index} className="careers-task stack-8">
          <p className="careers-task-title"><span aria-hidden="true">{t.emoji}</span> {t.title}</p>
          {t.picked ? (
            <p className="subtext" style={{ margin: 0 }}>{t.result} <span className={`careers-delta ${t.perf >= 0 ? "up" : "down"}`}>{t.perf >= 0 ? "▲" : "▼"} {Math.abs(t.perf)}</span></p>
          ) : t === nextOpen ? (
            <>
              <div className="choice-options" role="radiogroup" aria-label="What you do">
                {t.options.map((o) => (
                  <button key={o.id} role="radio" aria-checked={sel[t.index] === o.id} className="choice-opt" disabled={busy} onClick={() => setSel({ ...sel, [t.index]: o.id })}>
                    <span className="choice-opt-row"><span className="choice-opt-label">{o.label}</span></span>
                    {sel[t.index] === o.id && (
                      <span className="choice-opt-more"><span><b>You get</b> {o.get}</span><span><b>It costs</b> {o.cost}</span></span>
                    )}
                  </button>
                ))}
              </div>
              <button className="btn btn-taxi" disabled={busy || !sel[t.index]} onClick={() => onTask(t.index, sel[t.index])}>Do it</button>
            </>
          ) : <p className="meta" style={{ margin: 0 }}>Up next.</p>}
        </div>
      ))}
      {day.done && (
        <div className="careers-summary stack-4">
          <p className="overline">End of the day</p>
          {day.summary.map((l) => <p key={l} className="subtext" style={{ margin: 0 }}>{l}</p>)}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Aspirations (owner, Oct 31; migration 0143)

function headStartWhy(a: AspirationState | null | undefined, track: TrackId): string {
  const mine = a?.aspiration && aspirationById(a.aspiration)?.tracks.includes(track);
  return [mine ? "aspiration" : null, a?.degree ? "degree" : null].filter(Boolean).join(" and ");
}

function Welcome({ state, busy, today, onPick, onCancel }: {
  state: AspirationState; busy: boolean; today: string;
  onPick: (id: AspirationId) => void; onCancel?: () => void;
}) {
  const [sel, setSel] = useState<AspirationId | null>(state.aspiration);
  const lockedUntil = changeOn(state.chosenAt, today);
  return (
    <div className="stack-16">
      <div className="careers-poster">
        <p className="overline">💼 Welcome to Careers</p>
        <h2 className="display-lg" style={{ margin: 0 }}>What&apos;s your aspiration?</h2>
        <p className="subtext" style={{ margin: 0 }}>
          This is where you manage your work life: your job, your boss, your coworkers and your climb. Pick where you&apos;re
          headed and the city opens a door or two.
        </p>
      </div>
      <div className="stack-8" role="radiogroup" aria-label="Aspirations">
        {ASPIRATIONS.map((x) => {
          const on = sel === x.id;
          const blocked = !!lockedUntil && !!state.aspiration && state.aspiration !== x.id;
          return (
            <button key={x.id} role="radio" aria-checked={on} disabled={blocked || busy}
              className={`card careers-aspiration${on ? " on" : ""}`} onClick={() => setSel(x.id)}>
              <span className="careers-emoji" aria-hidden="true">{x.emoji}</span>
              <span className="careers-col" style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                <span className="title">{x.name}</span>
                <span className="subtext">{x.tagline}</span>
                {x.perks.map((p) => <span key={p} className="meta">⭐ {p}</span>)}
                {x.later.length > 0 && <span className="meta">🔜 Coming soon: {x.later.join(", ")}</span>}
              </span>
            </button>
          );
        })}
      </div>
      <p className="meta" style={{ margin: 0 }}>
        {state.degree ? "🎓 Your degree (3 passed exams) adds a level too. " : `🎓 Pass ${ASPIRE.degreeExams} campus exams (${state.exams} so far) for a degree: another level of head start. `}
        {lockedUntil && state.aspiration ? `You can pick a new aspiration from ${lockedUntil}.` : `You can change it once every ${ASPIRE.changeDays} days.`}
      </p>
      <button className="btn btn-taxi" disabled={!sel || busy || sel === state.aspiration}
        onClick={() => sel && onPick(sel)}>
        {sel ? "Choose" : "Pick one"}
      </button>
      {onCancel && <button className="btn btn-ghost" onClick={onCancel}>Back</button>}
    </div>
  );
}

function AspirationChip({ state, onChange }: { state: AspirationState; onChange: () => void }) {
  const a = aspirationById(state.aspiration)!;
  return (
    <button className="careers-aspiration-chip" onClick={onChange} aria-label="Your aspiration: change it">
      <span aria-hidden="true">{a.emoji}</span> {aspirationName(a.id)}{state.degree ? " · 🎓" : ""} <span className="meta">· Change</span>
    </button>
  );
}
