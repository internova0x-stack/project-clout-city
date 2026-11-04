"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Sheet } from "@/components/Sheet";
import { celebrate } from "@/components/Celebrate";
import { firstTime } from "@/components/seenOnce";
import { campusById } from "@/lib/campus";
import { ACTIVITIES, RACE, tierOf, type Activity, type RaceView, type Slot } from "@/lib/schoolRace";
import type { SchoolApi, SchoolResult, SchoolScreen } from "@/lib/schoolApi";

// Crown HQ, the Homecoming race (docs/SCHOOL-RACE.md; the owner's Big Name on Campus artifact): before declaring, the
// Declare screen; while running, Campaign HQ's layout for a semester (the head, Crown funds, GPA/Rep/Energy, then Week,
// Inbox, Squad, Allies and Budget), the open card as the Moral Choices card above the tabs; when it's over, Homecoming night.
// Friday's verdict and the Homecoming result are results cards (components/ResultCard.tsx), once per device each.
// The server decides everything; this only asks.

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const EXAM_DAY = 4;
const HOMECOMING_DAY = 5;
const ACT = Object.fromEntries(ACTIVITIES.map((a) => [a.id, a])) as Record<Activity, (typeof ACTIVITIES)[number]>;
const WEEKS = [["The New Kid", "Find your people"], ["Rush Week", "Pick a side, pass a midterm"], ["The Scandal", "{rival} fights back"], ["Homecoming", "The votes come in"]];
const cs = (n: number) => `C$${Math.round(n).toLocaleString("en-US")}`;
const first = (name: string) => name.split(" ")[0];

type Tab = "week" | "inbox" | "squad" | "allies" | "budget";
type Run = (p: Promise<SchoolResult<SchoolScreen>>) => Promise<SchoolScreen | null>;

export function CrownHQ({ open, onClose, api, me, onToast }: {
  open: boolean;
  onClose: () => void;
  api: SchoolApi;
  /** The player's face (AvatarHead) for the head, the IDs and Homecoming night. */
  me: ReactNode;
  onToast: (text: string) => void;
}) {
  const [data, setData] = useState<SchoolScreen | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run: Run = useCallback(async (p) => {
    setBusy(true);
    const r = await p;
    setBusy(false);
    if (!r.ok) { setError(r.error); onToast(r.error); return null; }
    setError(null);
    setData(r.data);
    return r.data;
  }, [onToast]);

  useEffect(() => { if (open) void run(api.screen()); }, [open, api, run]);

  // Friday's verdict, once per verdict per device (cc-seen:crown-verdict).
  const v = data?.view ?? null;
  const verdict = v?.verdict ?? null;
  useEffect(() => {
    if (!open || !v || !verdict || v.phase === "over") return;
    if (!firstTime("crown-verdict", `${v.id}:${verdict.week}`)) return;
    const ok = verdict.eligible;
    const tier = tierOf(verdict.rep, v.crown);
    celebrate({
      rung: 3, emoji: ok ? "🔥" : "📉", tag: `Week ${verdict.week} · Friday`, title: ok ? tier : "Off the ballot, for now",
      cta: ok ? (verdict.week >= v.weeks - 1 ? "Homecoming's next" : `${v.weeks - verdict.week} weeks to go`) : "Plan a better week",
      result: {
        tone: ok ? "win" : "warn", amount: verdict.repGained, plain: true, unit: "Rep this week",
        story: ok ? "People know your name. So does your professor." : "Great week to be seen. Rough week to be graded.",
        stamp: verdict.strike ? { text: v.strikes >= RACE.strikes ? "PROBATION" : "WARNING", tone: "warn" } : undefined,
        meter: { label: "📚 GPA", have: verdict.gpa, need: RACE.eligibleGpa, max: 4,
          say: ok ? `${(verdict.gpa - RACE.eligibleGpa).toFixed(2)} above the line.` : `${(RACE.eligibleGpa - verdict.gpa).toFixed(2)} short. Two study nights fix it.` },
        keep: ok ? [tier, "Your cliques", "Your dorm"] : ["Your Rep", "Your squad", "Your shot"],
      },
    });
  }, [open, v, verdict]);

  const label = !v || v.phase === "over" ? (v?.result ? "Homecoming night" : "Homecoming") : "Crown HQ";
  return (
    <Sheet open={open} onClose={onClose} label={label} tall>
      <div className="camp">
        {!data && !error && <p className="meta">Checking the ballot…</p>}
        {!data && error && <p className="error-text">{error}</p>}
        {data && (!v || (v.phase === "over" && !v.result)) && <Declare data={data} busy={busy} onGo={() => void run(api.declare()).then((d) => d?.receipt && onToast(d.receipt))} />}
        {data && v && v.phase === "running" && <Hq data={data} v={v} busy={busy} api={api} run={run} me={me} onToast={onToast} />}
        {data && v && v.phase === "over" && v.result && <Homecoming v={v} me={me} />}
      </div>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------------------------------------------

function Declare({ data, busy, onGo }: { data: SchoolScreen; busy: boolean; onGo: () => void }) {
  const campus = data.campus ? campusById(data.campus) : null;
  const queen = data.crown === "queen";
  const rival = data.rival;
  const starts = new Date(`${data.startsOn}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" });
  return (
    <div className="stack-16">
      <div className="camp-poster">
        <div className="camp-bunting" aria-hidden="true" />
        <p className="overline">👑 Homecoming{campus ? ` · ${campus.short}` : ""}</p>
        <h2 className="display-lg" style={{ margin: 0 }}>Declare for the crown</h2>
        <p className="subtext" style={{ margin: 0 }}>Three years. Undefeated. You have one semester.</p>
      </div>
      <div className="card crown-steps">
        {WEEKS.map(([t, d], i) => (
          <div key={t} className="list-row static">
            <span className="num">{i + 1}</span>
            <span className="stack-2"><span className="title" style={{ display: "block" }}>{t}</span><span className="meta">{d.replace("{rival}", rival ? first(rival.name) : "The champ")}</span></span>
          </div>
        ))}
      </div>
      <div className="card row" style={{ gap: 12 }}>
        {rival
          // eslint-disable-next-line @next/next/no-img-element
          ? <span className="camp-avatar big" aria-hidden="true"><img src={`/cast/${rival.portrait}.webp`} alt="" /></span>
          : <span style={{ fontSize: 26 }} aria-hidden="true">👑</span>}
        <span className="stack-2" style={{ flex: 1, minWidth: 0 }}>
          <span className="title">Running for Homecoming {queen ? "Queen" : "King"}</span>
          {rival && <span className="meta">Your rival: {rival.name}, {queen ? "Queen" : "King"} three years running.</span>}
        </span>
      </div>
      <div className="fx-row" style={{ marginTop: 0 }}>
        <span className="fx">📚 Keep a {RACE.eligibleGpa.toFixed(1)} GPA</span>
        <span className="fx">🗓️ {RACE.weeks} weeks</span>
        <span className="fx fx-clout">👑 +{RACE.rewards.crown} clout</span>
      </div>
      {data.blockText && data.block !== "running" && <p className="meta" style={{ margin: 0, color: "var(--red-text)" }}>{data.blockText}</p>}
      <div className="stack-8">
        <button className="btn btn-taxi" style={{ width: "100%" }} disabled={busy || !data.canDeclare} onClick={onGo}>I&apos;m running</button>
        <p className="meta" style={{ textAlign: "center", margin: 0 }}>Starts {starts} · Homecoming in {RACE.weeks} weeks</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------

function Hq({ data, v, busy, api, run, me, onToast }: { data: SchoolScreen; v: RaceView; busy: boolean; api: SchoolApi; run: Run; me: ReactNode; onToast: (t: string) => void }) {
  const [tab, setTab] = useState<Tab>("week");
  const [later, setLater] = useState<string | null>(null);
  const [made, setMade] = useState<{ emoji: string; receipt: string; line: string } | null>(null);
  const read = useReadMail(v.id);
  const unread = v.inbox.filter((m) => m.status === "new" && !read.has(m.id)).length;
  const card = v.pending && later !== v.pending.id ? v.pending : null;
  const planned = Object.values(v.budget).reduce((a, b) => a + b, 0);
  const rival = first(v.rival.name);
  const week = WEEKS[Math.min(v.weeks, Math.max(1, v.week)) - 1][0];
  return (
    <div className="stack-16">
      <div className="camp-head">
        <span className="camp-avatar big" aria-hidden="true">{me}</span>
        <span className="stack-2" style={{ flex: 1, textAlign: "left", minWidth: 0 }}>
          <span className="overline">Week {v.week} of {v.weeks} · {week}</span>
          <span className="title">Your run for the crown</span>
          <span className="meta">{v.tier} · {v.rival.lead > 0 ? `${rival} leads by ${v.rival.lead} Rep` : `You lead ${rival}`}</span>
        </span>
      </div>
      <div className="card camp-funds">
        <div className="balance-hero">
          <span className="overline">👑 Crown funds</span>
          <span className="balance-big">{cs(data.bank)}</span>
        </div>
        <div className="camp-funds-row">
          <span><span className="meta">Free to spend</span><b>{cs(Math.max(0, data.bank - planned))}</b></span>
          <span><span className="meta">Planned</span><b>{cs(planned)}</b></span>
          <span><span className="meta">Work shifts</span><b>+{cs(workAhead(v) * RACE.acts.work.cash)}</b></span>
        </div>
      </div>
      <Meters v={v} />
      {made ? (
        <div className="stack-12">
          <div className="choice-head"><span className="choice-icon" aria-hidden="true">{made.emoji}</span></div>
          <p className="choice-receipt">{made.receipt}</p>
          {made.line && <p className="choice-effects">{made.line}</p>}
          <button className="btn btn-taxi" onClick={() => setMade(null)}>Moving on</button>
        </div>
      ) : card ? (
        <ChoiceCard card={card} busy={busy} onSkip={() => setLater(card.id)}
          onChoose={async (o) => {
            const opt = card.options.find((x) => x.id === o)!;
            const d = await run(api.choose(card.id, o));
            if (d) setMade({ emoji: card.emoji, receipt: d.receipt ?? opt.label, line: `${opt.get} · ${opt.cost}` });
          }} />
      ) : (
        <>
          {v.pending && (
            <button className="card crown-later" onClick={() => setLater(null)}>
              <span style={{ fontSize: 22 }} aria-hidden="true">{v.pending.emoji}</span>
              <span className="stack-2" style={{ flex: 1, minWidth: 0 }}><span className="title">A decision is waiting</span><span className="meta">The week won&apos;t move until you make it.</span></span>
              <span className="meta">Open ›</span>
            </button>
          )}
          <div className="segmented" role="group" aria-label="Crown HQ">
            <button aria-pressed={tab === "week"} onClick={() => setTab("week")}>Week</button>
            <button aria-pressed={tab === "inbox"} onClick={() => setTab("inbox")}><span className="seg-label">Inbox{unread ? <span className="seg-badge">{unread}</span> : null}</span></button>
            <button aria-pressed={tab === "squad"} onClick={() => setTab("squad")}>Squad</button>
            <button aria-pressed={tab === "allies"} onClick={() => setTab("allies")}>Allies</button>
            <button aria-pressed={tab === "budget"} onClick={() => setTab("budget")}>Budget</button>
          </div>
          {tab === "week" && <Week data={data} v={v} busy={busy} onSet={(d, s, a) => void run(api.slot(d, s, a))} />}
          {tab === "inbox" && <Inbox v={v} busy={busy} read={read} onReply={async (m, o) => { const d = await run(api.reply(m, o)); if (d?.receipt) onToast(d.receipt); }} />}
          {tab === "squad" && <Squad v={v} />}
          {tab === "allies" && <Allies v={v} />}
          {tab === "budget" && <Budget data={data} v={v} busy={busy} onSet={(b) => void run(api.budget(b))} />}
        </>
      )}
    </div>
  );
}

/** Work shifts still ahead this week (the planner's C$80 each). */
function workAhead(v: RaceView): number {
  let n = 0;
  v.plan.forEach((d, i) => { if (i >= v.locked) d.forEach((a) => { if (a === "work") n++; }); });
  return n;
}

function Meter({ name, value, max, cls, low, line, shown }: { name: string; value: number; max: number; cls: string; low: boolean; line?: number; shown: string }) {
  return (
    <div className={`camp-meter crown ${cls}${low ? " low" : ""}`}>
      <div className="camp-meter-top"><span className="camp-meter-name">{name}</span><span className="hud-number">{shown}</span></div>
      <div className="camp-meter-bar" role="meter" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-label={`${name} ${shown}`}>
        <span className="fill" style={{ width: `${Math.max(0, Math.min(100, (value / max) * 100))}%` }} />
        {line !== undefined && <span className="crown-line" style={{ left: `${(line / max) * 100}%` }} />}
      </div>
    </div>
  );
}

function Meters({ v }: { v: RaceView }) {
  return (
    <div className="card stack-12">
      <div className="camp-meter-grid" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
        <Meter name="📚 GPA" value={v.gpa} max={4} cls="gpa" low={v.gpa < RACE.eligibleGpa} line={RACE.eligibleGpa} shown={v.gpa.toFixed(2)} />
        <Meter name="🔥 Rep" value={v.rep} max={100} cls="rep" low={false} shown={String(v.rep)} />
        <Meter name="⚡ Energy" value={v.energy} max={100} cls="nrg" low={v.energy < RACE.tired} shown={String(v.energy)} />
      </div>
      <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
        <span className={`tag ${v.eligible ? "tag-positive" : "tag-event"}`}>{v.eligible ? "✓ On the ballot" : "Off the ballot"}</span>
        {v.strikes > 0 && <span className="tag tag-event">{v.strikes >= RACE.strikes ? "📝 Academic probation" : "📝 A warning"}</span>}
        {v.energy < RACE.tired && <span className="tag tag-neutral">😴 Running on fumes</span>}
      </div>
    </div>
  );
}

function ChoiceCard({ card, busy, onChoose, onSkip }: { card: NonNullable<RaceView["pending"]>; busy: boolean; onChoose: (o: string) => void; onSkip: () => void }) {
  const [sel, setSel] = useState<string | null>(null);
  return (
    <div className="stack-16">
      <div className="choice-head">
        <span className="choice-icon" aria-hidden="true">{card.emoji}</span>
        <span className="overline">{card.over}</span>
        <p className="choice-title">{card.title}</p>
      </div>
      <div className="choice-options" role="radiogroup" aria-label="Your choice">
        {card.options.map((o) => (
          <button key={o.id} role="radio" aria-checked={sel === o.id} className="choice-opt" disabled={busy} onClick={() => setSel(o.id)}>
            <span className="choice-opt-row"><span className="choice-opt-label">{o.label}</span></span>
            {sel === o.id && (
              <span className="choice-opt-more">
                <span><b>You get</b> {o.get}</span>
                <span><b>It costs</b> {o.cost}</span>
              </span>
            )}
          </button>
        ))}
      </div>
      <button className="btn btn-taxi" disabled={busy || !sel} onClick={() => sel && onChoose(sel)}>Decide</button>
      <button className="btn btn-ghost" disabled={busy} onClick={onSkip}>Not now</button>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// The week: seven days, a day and a night slot each; a tap opens the picker.

function Week({ data, v, busy, onSet }: { data: SchoolScreen; v: RaceView; busy: boolean; onSet: (d: number, s: Slot, a: Activity) => void }) {
  const [picking, setPicking] = useState<{ day: number; slot: Slot } | null>(null);
  const lastWeek = v.week === v.weeks;
  const nights = v.plan.filter((d, i) => i >= v.locked && ["party", "hang", "club", "date"].includes(d[1])).length;
  const examEve = (d: number, s: Slot) => d === EXAM_DAY - 1 && s === 1;
  return (
    <div className="stack-12">
      <p className="meta" style={{ margin: 0 }}>{lastWeek ? "Homecoming is Saturday. Keep your GPA over the line." : `Friday's exam sets your GPA. ${nights} social night${nights === 1 ? "" : "s"} planned.`}</p>
      <div className="crown-days">
        <div className="crown-dayrow"><span /><span className="overline">Day</span><span className="overline">Night</span></div>
        {v.plan.map((d, i) => {
          const homecoming = lastWeek && i >= HOMECOMING_DAY;
          return (
            <div key={i} className="crown-dayrow">
              <span className={`overline${i === EXAM_DAY ? " exam" : ""}`}>{DAYS[i]}{i === EXAM_DAY ? " 📝" : homecoming && i === HOMECOMING_DAY ? " 👑" : ""}</span>
              {d.map((a, s) => {
                const past = i < v.locked;
                const label = homecoming ? (i === HOMECOMING_DAY ? "Homecoming" : "Recovery") : ACT[a].name;
                return (
                  <button key={s} className={`crown-slot${examEve(i, s as Slot) && a === "party" ? " hot" : ""}`} disabled={busy || past || homecoming}
                    aria-label={`${DAYS[i]} ${s ? "night" : "day"}: ${label}${past ? ", played" : ""}`}
                    onClick={() => setPicking({ day: i, slot: s as Slot })}>
                    <span className="e" aria-hidden="true">{homecoming ? (i === HOMECOMING_DAY ? "👑" : "🛌") : ACT[a].emoji}</span>{label}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
      <Picker at={picking} current={picking ? v.plan[picking.day][picking.slot] : null} can={data.can} examEve={!!picking && examEve(picking.day, picking.slot)}
        onClose={() => setPicking(null)} onPick={(a) => { if (picking) onSet(picking.day, picking.slot, a); setPicking(null); }} />
    </div>
  );
}

function Picker({ at, current, can, examEve, onClose, onPick }: {
  at: { day: number; slot: Slot } | null; current: Activity | null; can: SchoolScreen["can"]; examEve: boolean; onClose: () => void; onPick: (a: Activity) => void;
}) {
  const list = ACTIVITIES.filter((a) => !a.needs || can[a.needs]);
  return (
    <Sheet open={!!at} onClose={onClose} label="Pick an activity">
      {at && (
        <div className="stack-12">
          <div className="stack-2"><span className="overline">{DAYS[at.day]} · {at.slot ? "Night" : "Day"}</span><span className="display-sm">What are you doing?</span></div>
          <div className="choice-options" role="radiogroup" aria-label="Activities">
            {list.map((a) => (
              <button key={a.id} role="radio" aria-checked={a.id === current} className="choice-opt crown-pick" onClick={() => onPick(a.id)}>
                <span className="choice-opt-row"><span className="e" aria-hidden="true">{a.emoji}</span><span className="choice-opt-label">{a.name}</span></span>
                <span className="fx-row" style={{ marginTop: 0 }}>
                  <span className="fx fx-pay">{a.get}</span><span className="fx fx-cost">{a.cost}</span>
                  {examEve && a.id === "party" && <span className="fx fx-warn">⚠️ The night before your exam</span>}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </Sheet>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Inbox, Squad, Allies (Campaign HQ's layouts)

function Face({ id, name, size, big }: { id: string; name: string; size?: number; big?: boolean }) {
  const [broken, setBroken] = useState(false);
  const style = size ? { width: size, height: size } : undefined;
  if (id === "unknown") return <span className={`camp-avatar anon${big ? " big" : ""}`} style={style} aria-hidden="true">📵</span>;
  return (
    <span className={`camp-avatar${big ? " big" : ""}`} style={style} aria-hidden="true">
      {broken ? name.split(" ").map((w) => w[0]).join("").slice(0, 2) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/cast/school-${id}.webp`} alt="" loading="lazy" onError={() => setBroken(true)} />
      )}
    </span>
  );
}

function useReadMail(race: string) {
  const key = `cc-crown-read:${race}`;
  const [ids, setIds] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    try { setIds(new Set(JSON.parse(localStorage.getItem(key) ?? "[]") as string[])); } catch { setIds(new Set()); }
  }, [key]);
  const mark = useCallback((id: string) => setIds((cur) => {
    if (cur.has(id)) return cur;
    const next = new Set(cur).add(id);
    try { localStorage.setItem(key, JSON.stringify([...next])); } catch { /* private mode */ }
    return next;
  }), [key]);
  return { has: (id: string) => ids.has(id), mark };
}

function mailDay(at: string): string {
  const d = new Date(`${at}T12:00:00Z`);
  return d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
}

function Inbox({ v, busy, read, onReply }: { v: RaceView; busy: boolean; read: ReturnType<typeof useReadMail>; onReply: (m: string, o: string) => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  useEffect(() => { if (open) read.mark(open); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const list = [...v.inbox].sort((a, b) => Number(b.status === "new" && b.options.length > 0) - Number(a.status === "new" && a.options.length > 0) || b.at.localeCompare(a.at));
  if (!list.length) return <p className="meta">No messages. Nobody knows you yet.</p>;
  const m = list.find((x) => x.id === open);
  if (m) {
    return (
      <div className="stack-12">
        <button className="btn btn-ghost" style={{ width: "auto", paddingLeft: 0 }} onClick={() => setOpen(null)}>‹ Inbox</button>
        <div className="camp-thread-head">
          <Face id={m.from.id} name={m.from.name} big />
          <span className="stack-2" style={{ flex: 1, minWidth: 0 }}><span className="title">{m.from.name}</span><span className="meta">{m.from.role}</span></span>
        </div>
        <span className="camp-thread-time">{mailDay(m.at)}</span>
        <div className="camp-bubble them"><b>{m.subject}</b><span>{m.body}</span></div>
        {m.status === "answered" && m.sent && <div className="camp-bubble me">{m.sent}<span className="camp-bubble-meta">Sent ✓</span></div>}
        {m.status === "expired" && m.options.length > 0 && <p className="meta" style={{ textAlign: "center" }}>You never replied. They noticed.</p>}
        {m.status === "new" && m.options.length > 0 && (
          <div className="stack-8" role="radiogroup" aria-label="Your reply">
            <p className="overline" style={{ margin: "4px 0 0" }}>Pick your reply · expires when the week ends</p>
            {m.options.map((o) => (
              <button key={o.id} role="radio" aria-checked={sel === o.id} className="camp-option radio" disabled={busy} onClick={() => setSel(o.id)}>
                <span className="title">{o.label}</span>
                <span className="fx-row" style={{ marginTop: 6 }}><span className="fx fx-pay">{o.get}</span><span className="fx fx-cost">{o.cost}</span></span>
              </button>
            ))}
            <button className="btn btn-taxi" disabled={busy || !sel} onClick={() => { if (sel) { onReply(m.id, sel); setSel(null); setOpen(null); } }}>Send reply</button>
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="camp-inbox" role="list">
      {list.map((x) => {
        const isUnread = x.status === "new" && !read.has(x.id);
        return (
          <button key={x.id} role="listitem" className={`camp-mail-row${isUnread ? " unread" : ""}`} onClick={() => { setSel(null); setOpen(x.id); }}
            aria-label={`${isUnread ? "Unread. " : ""}${x.from.name}: ${x.subject}`}>
            <span className="camp-unread-dot" aria-hidden="true" />
            <Face id={x.from.id} name={x.from.name} />
            <span className="camp-mail-text">
              <span className="camp-mail-top"><span className="camp-mail-from">{x.from.name}</span><span className="camp-mail-time">{mailDay(x.at)}</span></span>
              <span className="camp-mail-subject">{x.subject}</span>
              <span className="camp-mail-preview">{x.status === "answered" ? `✓ Replied: ${x.sent ?? ""}` : x.status === "expired" && x.options.length ? "Expired · no reply" : x.body}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function Squad({ v }: { v: RaceView }) {
  return (
    <div className="stack-12">
      {v.squad.map((p) => (
        <div key={p.id} className="card camp-ally camp-staff">
          <Face id={p.id} name={p.name} size={56} />
          <span className="stack-2" style={{ flex: 1, minWidth: 0 }}>
            <span className="title">{p.name}{p.out && <span className="tag tag-neutral" style={{ marginLeft: 6 }}>Gone</span>}</span>
            <span className="meta">{p.age ? `${p.age} · ` : ""}{p.role}</span>
            {p.vibe && <span className="camp-vibe">{p.vibe}</span>}
            <span className="camp-staff-stats"><span>💪 Morale <b>{p.morale}</b></span><span>🤞 Loyalty <b>{p.loyalty}</b></span></span>
          </span>
        </div>
      ))}
      {v.log.length > 0 && (
        <div className="stack-4">
          <p className="overline" style={{ margin: 0 }}>What happened</p>
          <ul className="camp-lines">{[...v.log].reverse().map((l, i) => <li key={i}><b>W{l.week}</b> {l.text}</li>)}</ul>
        </div>
      )}
    </div>
  );
}

const STANDING: Record<string, { label: string; tone: string }> = {
  "2": { label: "Close ally", tone: "good" }, "1": { label: "Ally", tone: "good" }, "0": { label: "Undecided", tone: "mid" },
  "-1": { label: "Cool", tone: "bad" }, "-2": { label: "Against you", tone: "bad" },
};

function Allies({ v }: { v: RaceView }) {
  const rival = first(v.rival.name);
  const st = (a: RaceView["allies"][number]) => Math.max(-2, Math.min(2, Math.round(a.standing)));
  const list = [...v.allies].sort((a, b) => b.standing - a.standing);
  const mine = list.filter((a) => st(a) >= 1).length;
  const theirs = list.filter((a) => a.rivalSide && st(a) < 1).length;
  return (
    <div className="stack-12">
      <div className="card camp-allies-sum">
        <span className="stack-2"><span className="camp-count">{mine}</span><span className="meta">on your side</span></span>
        <span className="stack-2"><span className="camp-count">{theirs}</span><span className="meta">with {rival}</span></span>
        <span className="stack-2"><span className="camp-count">{list.length - mine - theirs}</span><span className="meta">up for grabs</span></span>
      </div>
      {list.map((a) => {
        const s = STANDING[String(st(a))];
        const theirsNow = a.rivalSide && st(a) < 1;
        return (
          <div key={a.id} className="card camp-ally">
            <span className="camp-avatar" aria-hidden="true" style={{ fontSize: 24, background: "var(--surface-card)" }}>{a.emoji}</span>
            <span className="stack-2" style={{ flex: 1, minWidth: 0 }}><span className="title">{a.name}</span><span className="camp-vibe">{a.lead}</span></span>
            <span className="stack-2" style={{ alignItems: "flex-end", alignSelf: "flex-start" }}>
              <span className={`camp-standing ${theirsNow ? "mayor" : s.tone}`}>{theirsNow ? `${rival}'s` : s.label}</span>
              <span className={`camp-trust ${s.tone}`} aria-hidden="true">{[0, 1, 2, 3].map((n) => <i key={n} className={n < st(a) + 2 ? "on" : ""} />)}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Budget: five lines in C$50 steps, landing when the week ends.

const LINES: { id: keyof RaceView["budget"]; emoji: string; label: string; say: string }[] = [
  { id: "party", emoji: "🎉", label: "Throw a party", say: "Big Rep. Noise complaints happen." },
  { id: "look", emoji: "👟", label: "The look", say: "Being seen in something new" },
  { id: "merch", emoji: "🏷️", label: "“Vote Me” merch", say: "Clique votes, slowly" },
  { id: "tutor", emoji: "📚", label: "A tutor", say: "GPA insurance" },
  { id: "squad", emoji: "🤝", label: "Squad pay", say: "Keeps their morale up" },
];

function Budget({ data, v, busy, onSet }: { data: SchoolScreen; v: RaceView; busy: boolean; onSet: (b: Partial<RaceView["budget"]>) => void }) {
  const step = RACE.budget.step;
  const out = Object.values(v.budget).reduce((a, b) => a + b, 0);
  const inn = workAhead(v) * RACE.acts.work.cash;
  const net = inn - out;
  return (
    <div className="card stack-12">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span className="title">💰 This week&apos;s budget</span>
        <span className="meta">{cs(Math.max(0, data.bank - out))} left</span>
      </div>
      {LINES.map((l) => (
        <div key={l.id} className="camp-budget-row">
          <span className="stack-2"><span className="title">{l.emoji} {l.label}</span><span className="meta">{l.say}</span></span>
          <span className="row" style={{ gap: 6 }}>
            <button className="icon-round" aria-label={`Less ${l.label}`} disabled={busy || v.budget[l.id] === 0} onClick={() => onSet({ [l.id]: v.budget[l.id] - step })}>−</button>
            <span className="hud-number" style={{ minWidth: 64, textAlign: "center" }}>{cs(v.budget[l.id])}</span>
            <button className="icon-round" aria-label={`More ${l.label}`} disabled={busy || v.budget[l.id] >= RACE.budget.max || data.bank - out < step} onClick={() => onSet({ [l.id]: v.budget[l.id] + step })}>+</button>
          </span>
        </div>
      ))}
      <div className="camp-ledger" aria-label="The week added up">
        {inn > 0 && <div className="camp-ledger-row in"><span>💼 Work shifts</span><b>+{cs(inn)}</b></div>}
        <div className="camp-ledger-row"><span>🧾 Planned spending <span className="meta">(paid Monday)</span></span><b>−{cs(out)}</b></div>
        <div className={`camp-ledger-total ${net >= 0 ? "up" : "down"}`}><span>This week</span><b>{net >= 0 ? "+" : "−"}{cs(Math.abs(net))}</b></div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Homecoming night: election night's layout, the votes clique by clique, You vs the rival.

function Homecoming({ v, me }: { v: RaceView; me: ReactNode }) {
  const res = v.result!;
  const rival = first(v.rival.name);
  const rows = res.cliques.map((c) => ({ ...c, a: v.allies.find((x) => x.id === c.id) }));
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (shown >= rows.length) return;
    const t = setTimeout(() => setShown((n) => n + 1), shown === 0 ? 500 : 650);
    return () => clearTimeout(t);
  }, [shown, rows.length]);
  const all = shown >= rows.length;
  const you = rows.slice(0, shown).reduce((a, r) => a + r.you, 0);
  const them = rows.slice(0, shown).reduce((a, r) => a + r.rival, 0);
  const won = res.ending === "crown" || res.ending === "dirty";
  const crownWord = v.crown === "queen" ? "Queen" : "King";
  useEffect(() => {
    if (!all || !firstTime("crown-result", v.id)) return;
    const share = Math.round((res.you / Math.max(1, res.you + res.rival)) * 100);
    const gap = Math.abs(res.you - res.rival);
    const mine = res.cliques.filter((c) => c.you > c.rival).length;
    celebrate({
      rung: 3, emoji: won ? "👑" : res.ending === "ineligible" ? "📉" : "🥈", tag: `Homecoming · ${campusById(v.campus)?.short ?? "Campus"}`,
      title: won ? tierOf(100, v.crown) : res.ending === "ineligible" ? "Off the ballot" : "So close",
      cta: won ? "Wear the crown" : "Run it back",
      result: {
        tone: won ? "win" : "warn", big: String(res.you),
        unit: res.ending === "ineligible" ? "votes · your GPA kept you off" : `votes · ${gap} ${won ? "ahead of" : "short of"} ${rival}`,
        story: won ? winLine(v) : lossLine(v),
        stamp: won ? { text: res.ending === "dirty" ? "CROWNED*" : "CROWNED", tone: "good" } : { text: res.ending === "ineligible" ? "INELIGIBLE" : "RUNNER-UP", tone: "warn" },
        meter: { label: "🗳️ Your share", have: share, need: 50, max: 100, say: won ? `${res.cliques.length} cliques voted. ${mine} were yours.` : "Two cliques away from the crown." },
        keep: won ? ["👑 by your name", v.tier, `+${RACE.rewards.crown} clout`] : [v.tier, "Your squad", `+${RACE.rewards.runnerUp} clout`],
      },
    });
  }, [all]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="stack-16">
      <div className="camp-poster">
        <div className="camp-bunting" aria-hidden="true" />
        <p className="overline">👑 Homecoming night</p>
        <h2 className="display-lg" style={{ margin: 0 }}>You vs {rival}</h2>
        <p className="subtext" style={{ margin: 0 }}>The votes come in clique by clique.</p>
      </div>
      <div className="card stack-8">
        <div className="crown-vs">
          <span><span className="crown-face">{me}</span><span className="meta">You</span><span className="crown-vote">{you}</span></span>
          <span className="overline">VS</span>
          <span className="r">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="crown-face" src={`/cast/school-${v.rival.id}.webp`} alt="" />
            <span className="meta">{rival}</span><span className="crown-vote">{them}</span>
          </span>
        </div>
        <div className="camp-poll"><span className="you" style={{ width: `${you + them ? (you / (you + them)) * 100 : 50}%` }} /><span className="mayor" /></div>
      </div>
      <div className="stack-8">
        {rows.slice(0, shown).map((r) => (
          <div key={r.id} className="card crown-q">
            <div className="row" style={{ justifyContent: "space-between" }}><span className="title">{r.a?.emoji} {r.a?.name ?? r.id}</span><span className="hud-number">{r.you} – {r.rival}</span></div>
            <p className="meta" style={{ margin: "4px 0 0" }}>{r.you > r.rival ? "Yours" : `${rival} holds it`}</p>
          </div>
        ))}
      </div>
      {all && (
        <div className="card stack-8 camp-ending">
          {won
            ? <span className="camp-winner" style={{ display: "block", overflow: "hidden" }}>{me}</span>
            // eslint-disable-next-line @next/next/no-img-element
            : <img className="camp-winner" src={`/cast/school-${v.rival.id}.webp`} alt={v.rival.name} />}
          <p className="display-md" style={{ margin: 0 }}>{won ? `Homecoming ${crownWord}` : res.ending === "ineligible" ? "Off the ballot" : "Runner-up"}</p>
          <p className="subtext" style={{ margin: 0 }}>{won ? winLine(v) : lossLine(v)}</p>
          {res.ending === "dirty" && <p className="meta" style={{ margin: 0 }}>Half the campus thinks you played dirty. Half is plenty.</p>}
        </div>
      )}
    </div>
  );
}

const winLine = (v: RaceView) => `${first(v.rival.name)} has been dethroned. ${v.crown === "queen" ? "She's" : "He's"} taking it well. ${v.crown === "queen" ? "She" : "He"} is not.`;
const lossLine = (v: RaceView) => `${first(v.rival.name)} keeps the crown. Again. The speech ran long.`;
