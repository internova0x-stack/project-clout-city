"use client";

import { useCallback, useEffect, useState } from "react";
import { Sheet } from "@/components/Sheet";
import {
  CAMPAIGN, cs, energyCost, meterLevel, slotCash,
  type Budget, type CampaignApi, type CampaignScreen, type CandidateCard, type CandidateId, type DebateStyle, type InboxOption, type MeterLevel, type OpId, type Preview, type SlotAction,
} from "@/lib/campaign";
import type { CampaignView } from "@/lib/campaignEngine";
import { RANKS } from "@/lib/ranks";

// Campaign Mode (docs/CAMPAIGN-MODE.md): the player manages a challenger's campaign against Mayor Papa-Dani. One
// sheet, opened from the Phone's Campaign app (or Campaign HQ on the map): the teaser before Rank 2, the candidate
// pick, HQ (this week, inbox, the map, the team) while a campaign runs, and election night at the end. Every choice
// shows the You get / It costs preview (owner, Oct 31: no risk labels, as on every card). The server decides everything; this only asks.

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const slotName = (i: number) => `${DAYS[Math.floor(i / 2)]} ${i % 2 ? "evening" : "day"}`;
const ENDING: Record<string, { title: string; line: string; emoji: string }> = {
  clean_win: { emoji: "🏛️", title: "Clean win", line: "Your candidate is Mayor-elect, and nobody found anything. Because there was nothing to find." },
  dirty_win: { emoji: "🕶️", title: "Dirty win", line: "Your candidate is Mayor-elect. Some things are still buried. Keep your phone on." },
  loss: { emoji: "📉", title: "Lost", line: "Papa-Dani keeps City Hall. He called to say you ran a great race. He meant it." },
};

/** A candidate's portrait (public/cast/candidate-<id>.webp; owner, Oct 29). */
function CandidateFace({ id, big = false }: { id: CandidateId; big?: boolean }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={`camp-cand-face${big ? " big" : ""}`} src={`/cast/candidate-${id}.webp`} alt="" aria-hidden="true" />;
}

type Tab = "week" | "inbox" | "map" | "allies" | "team";
type ViewTask = CampaignView["tasks"][number];
/** What a tapped task points the slot picker at (owner, Oct 29: tapping a task takes you there). */
type Hint = { kinds: string[]; place?: string; topic?: string };
const HINT_KINDS: Record<string, string[]> = { visit: ["rally", "tour"], rally: ["rally"], tour: ["tour"], gotv: ["gotv"], donors: ["donors"], rest: ["rest"], prep: ["prep"] };

export function CampaignSheet({ open, onClose, api, clout, onToast, focusTask = null, onFocused }: {
  open: boolean;
  onClose: () => void;
  /** A task tapped in the Tasks sheet: HQ opens on the place that does it. */
  focusTask?: string | null;
  onFocused?: () => void;
  api: CampaignApi;
  /** The manager's clout, for the teaser's progress to Rank 2. */
  clout: number;
  onToast: (text: string) => void;
}) {
  const [data, setData] = useState<CampaignScreen | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>("week");
  const [picked, setPicked] = useState<CandidateId | null>(null);

  const run = useCallback(async (p: ReturnType<CampaignApi["screen"]>, toast = true) => {
    setBusy(true);
    const r = await p;
    setBusy(false);
    if (!r.ok) { setError(r.error); onToast(r.error); return null; }
    setError(null);
    setData(r.data);
    if (toast && r.data.receipt) onToast(r.data.receipt);
    return r.data;
  }, [onToast]);

  useEffect(() => { if (open) void run(api.screen(), false); }, [open, api, run]);

  const v = data?.view ?? null;
  const running = !!v && v.phase !== "over";
  const label = !data ? "Campaign" : !data.unlocked ? "Upcoming election" : running ? "Campaign HQ" : "Campaign";

  return (
    <Sheet open={open} onClose={onClose} label={label} tall>
      <div className="camp">
        {!data && !error && <p className="meta">Calling the campaign office…</p>}
        {!data && error && <p className="error-text">{error}</p>}
        {data && !data.unlocked && <Teaser data={data} clout={data.clout ?? clout} />}
        {data && data.unlocked && !running && !(v?.phase === "over" && v.ending) && !picked && (
          <Pick data={data} onPick={setPicked} />
        )}
        {data && data.unlocked && picked && !running && (
          <CandidateDetail data={data} card={data.candidates.find((c) => c.id === picked)!} busy={busy}
            onBack={() => setPicked(null)}
            onStart={async (seed) => { const r = await run(api.start(picked, seed)); if (r) { setPicked(null); setTab("week"); } }} />
        )}
        {data && v && running && (
          <Hq data={data} v={v} busy={busy} tab={tab} setTab={setTab} api={api} run={run} focusTask={focusTask} onFocused={onFocused} />
        )}
        {data && v && v.phase === "over" && v.ending && !picked && (
          <ElectionNight data={data} v={v} onNew={() => setPicked(null)} />
        )}
        {data && v?.phase === "over" && !v.ending && !running && (
          <div className="card stack-8"><p className="title" style={{ margin: 0 }}>🗳️ Polls are closed</p><p className="subtext" style={{ margin: 0 }}>Results come in tomorrow morning. Get some sleep. You won't.</p></div>
        )}
      </div>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------------------------------------------

function Bunting() {
  return <div className="camp-bunting" aria-hidden="true" />;
}

/** Before Rank 2: the election is coming, the four candidates, and how far the player is from running one. */
function Teaser({ data, clout }: { data: CampaignScreen; clout: number }) {
  const need = RANKS[CAMPAIGN.unlockRank - 1].clout;
  return (
    <div className="stack-16">
      <div className="camp-poster">
        <Bunting />
        <p className="overline">🗳️ Upcoming election</p>
        <h2 className="display-lg" style={{ margin: 0 }}>Become a campaign manager</h2>
        <p className="subtext" style={{ margin: 0 }}>Four challengers want Mayor Papa-Dani's job. Every one of them needs someone to run their campaign. Babe, that's you.</p>
      </div>
      <div className="card stack-8">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <span className="title">Unlocks at Rank {CAMPAIGN.unlockRank}</span>
          <span className="hud-number">{Math.min(clout, need)}/{need} 🔥</span>
        </div>
        <div className="camp-bar"><span style={{ width: `${Math.min(100, (clout / need) * 100)}%` }} /></div>
        <p className="meta" style={{ margin: 0 }}>Earn clout with your daily tasks, a gig, or showing up somewhere fabulous.</p>
      </div>
      <div className="stack-8">
        {data.candidates.map((c) => (
          <div key={c.id} className="card camp-cand-row">
            <CandidateFace id={c.id} />
            <span className="stack-2">
              <span className="title">{c.name}</span>
              <span className="meta">{c.title} · "{c.slogan}"</span>
            </span>
          </div>
        ))}
      </div>
      <p className="meta">A satire. Every candidate, donor and scandal is invented.</p>
    </div>
  );
}

function Pick({ data, onPick }: { data: CampaignScreen; onPick: (id: CandidateId) => void }) {
  return (
    <div className="stack-16">
      <div className="camp-poster">
        <Bunting />
        <p className="overline">🗳️ The race for City Hall</p>
        <h2 className="display-lg" style={{ margin: 0 }}>Pick your candidate</h2>
        <p className="subtext" style={{ margin: 0 }}>You run it: money, calendar, dirty work (or not). Four weeks, one a day.</p>
      </div>
      {!data.canStart && data.nextStartOn && (
        <div className="card"><p className="subtext" style={{ margin: 0 }}>Your next campaign opens {fmtDay(data.nextStartOn)}. Campaign managers need a week off. Legally.</p></div>
      )}
      <div className="stack-8">
        {data.candidates.map((c) => (
          <button key={c.id} className="select-card camp-cand" onClick={() => onPick(c.id)}>
            <CandidateFace id={c.id} />
            <span className="stack-2" style={{ flex: 1 }}>
              <span className="title">{c.name}{data.wonBefore.includes(c.id) && <span className="tag tag-positive" style={{ marginLeft: 6 }}>Won before</span>}</span>
              <span className="meta">{c.title}</span>
              <span className="subtext">"{c.slogan}"</span>
            </span>
            <span aria-hidden="true">›</span>
          </button>
        ))}
      </div>
      <p className="meta">A satire. Every candidate, donor and scandal is invented. Papa-Dani is sometimes right.</p>
    </div>
  );
}

function CandidateDetail({ data, card, busy, onBack, onStart }: { data: CampaignScreen; card: CandidateCard; busy: boolean; onBack: () => void; onStart: (seed: number) => void }) {
  const [seed, setSeed] = useState(0);
  const maxSeed = Math.max(0, Math.min(CAMPAIGN.seedMax, data.bank));
  return (
    <div className="stack-16">
      <button className="btn btn-ghost" style={{ width: "auto", paddingLeft: 0 }} onClick={onBack}>‹ All candidates</button>
      <div className="camp-poster">
        <Bunting />
        <CandidateFace id={card.id} big />
        <p className="overline">{card.title}</p>
        <h2 className="display-lg" style={{ margin: 0 }}>{card.name}</h2>
        <p className="title" style={{ margin: 0 }}>"{card.slogan}"</p>
      </div>
      <p className="body" style={{ margin: 0 }}>{card.bio}</p>
      <div className="stack-8">
        <p className="overline" style={{ margin: 0 }}>What they're running on</p>
        {card.issues.map((i) => (
          <div key={i.title} className="card camp-issue">
            {i.emoji && <span className="camp-issue-emoji" aria-hidden="true">{i.emoji}</span>}
            <span className="stack-2"><span className="title">{i.title}</span><span className="subtext">{i.line}</span></span>
          </div>
        ))}
      </div>
      <div className="card stack-4">
        <span className="meta">Starts with {cs(card.cash)} and Integrity {card.integrity}</span>
        <span className="meta">Satire target: {card.satire}</span>
      </div>
      <div className="card stack-8">
        <span className="title">Put in some of your own money?</span>
        <span className="subtext">Up to {cs(CAMPAIGN.seedMax)} from your bank. It stays in the campaign.</span>
        <input type="range" min={0} max={maxSeed} step={100} value={Math.min(seed, maxSeed)} onChange={(e) => setSeed(Number(e.target.value))} aria-label="Seed money" disabled={maxSeed === 0} />
        <span className="hud-number">{cs(Math.min(seed, maxSeed))}</span>
      </div>
      <button className="btn btn-taxi" disabled={busy || !data.canStart} onClick={() => onStart(Math.min(seed, maxSeed))}>
        {data.canStart ? `Run ${card.short}'s campaign ›` : data.nextStartOn ? `Opens ${fmtDay(data.nextStartOn)}` : "Not yet"}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// HQ
// ---------------------------------------------------------------------------------------------------------------

type Run = (p: ReturnType<CampaignApi["screen"]>, toast?: boolean) => Promise<CampaignScreen | null>;

function Hq({ data, v, busy, tab, setTab, api, run, focusTask, onFocused }: {
  data: CampaignScreen; v: CampaignView; busy: boolean; tab: Tab; setTab: (t: Tab) => void; api: CampaignApi; run: Run; focusTask: string | null; onFocused?: () => void;
}) {
  const card = data.candidates.find((c) => c.id === v.candidate)!;
  const read = useReadMail(v.id);
  const newMail = v.inbox.filter((m) => m.status === "new" && !read.has(m.message.id)).length;
  const [mail, setMail] = useState<string | null>(null);
  // Owner, Nov 4: the candidate's face opens their profile.
  const [profile, setProfile] = useState(false);
  const [editing, setEditing] = useState<{ index: number; hint?: Hint } | null>(null);
  // A task goes where it's done: its message in the Inbox, or the slot picker on a free slot, set to the right action.
  const openTask = useCallback((t: ViewTask) => {
    if (t.done === "reply" || t.done === "meeting") { setMail(t.target ?? null); setTab("inbox"); return; }
    const free = v.slots.findIndex((s) => !s);
    const index = free >= 0 ? free : v.slots.findIndex((s) => s?.kind !== "meeting");
    if (index < 0) return;
    setEditing({ index, hint: { kinds: HINT_KINDS[t.done] ?? [], place: t.done === "prep" ? undefined : t.target, topic: t.done === "prep" ? t.target : undefined } });
    setTab("week");
  }, [v.slots, setTab]);
  useEffect(() => {
    if (!focusTask || v.pending.length) return;
    const t = v.tasks.find((x) => x.id === focusTask);
    if (t) openTask(t);
    onFocused?.();
  }, [focusTask, v.pending.length, v.tasks, openTask, onFocused]);
  if (profile) return <CandidateProfile card={card} v={v} onBack={() => setProfile(false)} />;
  return (
    <div className="stack-16">
      <button className="camp-head camp-head-btn" onClick={() => setProfile(true)} aria-label={`${card.name}'s profile`}>
        <CandidateFace id={card.id} />
        <span className="stack-2" style={{ flex: 1, textAlign: "left" }}>
          <span className="overline">Week {v.week} of {v.weeks}{v.debateWeek ? " · Debate week" : v.week === v.weeks ? " · Election week" : ""}</span>
          <span className="title">{card.name}</span>
          <span className="meta">{card.title} · Profile ›</span>
        </span>
      </button>
      <Funds v={v} />
      <Polls you={v.you} mayor={v.mayor} short={card.short} />
      <Meters v={v} short={card.short} />
      {v.pending.length > 0 ? (
        <SituationCard v={v} busy={busy} onChoose={(s, c) => run(api.choose(s, c))} />
      ) : (
        <>
          <div className="segmented" role="group" aria-label="Campaign HQ">
            <button aria-pressed={tab === "week"} onClick={() => { setEditing(null); setTab("week"); }}>Week</button>
            <button aria-pressed={tab === "inbox"} onClick={() => { setMail(null); setTab("inbox"); }}><span className="seg-label">Inbox{newMail ? <span className="seg-badge">{newMail}</span> : null}</span></button>
            <button aria-pressed={tab === "map"} onClick={() => setTab("map")}>Map</button>
            <button aria-pressed={tab === "allies"} onClick={() => setTab("allies")}>Allies</button>
            <button aria-pressed={tab === "team"} onClick={() => setTab("team")}>Team</button>
          </div>
          {tab === "week" && <Week data={data} v={v} busy={busy} api={api} run={run} onInbox={() => { setMail(null); setTab("inbox"); }} editing={editing} setEditing={setEditing} onTask={openTask} />}
          {tab === "inbox" && <Inbox key={mail ?? ""} initial={mail} v={v} busy={busy} read={read} onReply={(m, o) => run(api.reply(m, o))} />}
          {tab === "map" && <MapTab v={v} short={card.short} />}
          {tab === "allies" && <Allies v={v} />}
          {tab === "team" && <Team v={v} />}
        </>
      )}
    </div>
  );
}

function Polls({ you, mayor, short }: { you: number; mayor: number; short: string }) {
  const total = Math.max(1, you + mayor);
  return (
    <div className="card stack-8">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span className="title">{short} {you.toFixed(1)}%</span>
        <span className="title">Papa-Dani {mayor.toFixed(1)}%</span>
      </div>
      <div className="camp-poll"><span className="you" style={{ width: `${(you / total) * 100}%` }} /><span className="mayor" /></div>
      <span className="meta">Queens poll · margin of error ±2 · the rest are undecided</span>
    </div>
  );
}

/** The campaign's money, like a bank balance (owner, Nov 4). */
function Funds({ v }: { v: CampaignView }) {
  return (
    <div className="card camp-funds">
      <div className="balance-hero">
        <span className="overline">🏦 Campaign funds</span>
        <span className="balance-big">{cs(v.cash)}</span>
      </div>
      <div className="camp-funds-row">
        <span><span className="meta">Free to spend</span><b>{cs(v.free)}</b></span>
        <span><span className="meta">Planned</span><b>{cs(v.cash - v.free)}</b></span>
        <span><span className="meta">Raised so far</span><b>{cs(v.raised)}</b></span>
      </div>
    </div>
  );
}

const LEVEL: Record<MeterLevel, string> = { low: "Low", medium: "Medium", high: "High" };
type MeterId = "momentum" | "energy" | "morale" | "integrity";
/** What each level does, in a line (owner, Nov 4: "so players know when each is low, medium, high"). */
const METER_LINES: Record<MeterId, Record<MeterLevel, string>> = {
  momentum: { high: "Favors come to you. So do the Mayor's attacks.", medium: "Steady. A good week pushes it up.", low: "Donors are waiting to see. Win a week to turn it round." },
  energy: { high: "{c} is fresh: rallies land a little better.", medium: "{c} is holding up.", low: "{c} is tired: rallies land worse and off-script moments get likelier. Book a rest." },
  morale: { high: "The team works harder for you.", medium: "The team is fine. Bonuses and rest help.", low: "The team is slipping. Rest days and bonuses help." },
  integrity: { high: "A clean win is in reach.", medium: `A clean win needs ${CAMPAIGN.cleanIntegrity}.`, low: "Scandals stick. A clean win is out of reach for now." },
};

function MeterBar({ id, emoji, label, value, after }: { id: MeterId; emoji: string; label: string; value: number; after?: number }) {
  const lv = meterLevel(value);
  const plan = after !== undefined && after !== value ? Math.max(0, Math.min(100, after)) : null;
  return (
    <div className={`camp-meter ${lv}`} data-meter={id}>
      <div className="camp-meter-top">
        <span className="camp-meter-name">{emoji} {label}</span>
        <span className={`camp-level ${lv}`}>{LEVEL[lv]}</span>
      </div>
      <div className="camp-meter-bar" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} aria-label={`${label} ${value} of 100, ${LEVEL[lv]}`}>
        <span className="fill" style={{ width: `${value}%` }} />
        {plan !== null && plan < value && <span className="plan" style={{ left: `${plan}%`, width: `${value - plan}%` }} />}
        <i style={{ left: `${CAMPAIGN.meters.low}%` }} /><i style={{ left: `${CAMPAIGN.meters.high}%` }} />
      </div>
    </div>
  );
}

/** Momentum, Energy, Morale and Integrity as bars, then the smaller counts as chips. */
function Meters({ v, short }: { v: CampaignView; short: string }) {
  const bars: { id: MeterId; emoji: string; label: string; value: number; after?: number }[] = [
    { id: "momentum", emoji: "🚀", label: "Momentum", value: v.momentum },
    { id: "energy", emoji: "⚡", label: "Energy", value: v.energy, after: v.energy - v.energyPlan },
    ...(v.morale !== null ? [{ id: "morale" as const, emoji: "💪", label: "Morale", value: v.morale }] : []),
    ...(v.integrity !== null ? [{ id: "integrity" as const, emoji: "⚖️", label: "Integrity", value: v.integrity }] : []),
  ];
  // The lines for the meters that are low or high (medium says little), most urgent first.
  const notes = bars.filter((b) => meterLevel(b.value) !== "medium").sort((a, b) => Number(meterLevel(b.value) === "low") - Number(meterLevel(a.value) === "low"));
  const allies = v.allies.filter((a) => a.trust >= 1).length;
  return (
    <div className="card stack-12">
      <div className="camp-meter-grid">{bars.map((b) => <MeterBar key={b.id} {...b} />)}</div>
      {v.energyPlan > 0 && <span className="meta">⚡ This week&apos;s calendar uses {v.energyPlan} Energy.</span>}
      {notes.length > 0 && (
        <ul className="camp-meter-notes">
          {notes.slice(0, 2).map((b) => <li key={b.id} className={meterLevel(b.value)}><b>{b.label}:</b> {METER_LINES[b.id][meterLevel(b.value)].replace("{c}", short)}</li>)}
        </ul>
      )}
      <div className="camp-meters">
        {(v.favors > 0 || v.shown.favors) && <span className="camp-chip">🤝 {v.favors} Favor{v.favors === 1 ? "" : "s"}</span>}
        <span className="camp-chip">🫂 {allies} {allies === 1 ? "Ally" : "Allies"}</span>
        {v.heat !== null && <span className="camp-chip" title="How close people are to finding out">🔥 Heat {v.heat}</span>}
        {v.intel > 0 && <span className="camp-chip">🗂️ Intel {v.intel}</span>}
      </div>
    </div>
  );
}

function PreviewLines({ p }: { p: Preview }) {
  return (
    <span className="camp-preview">
      <span><b>You get</b> {p.get}</span>
      <span><b>It costs</b> {p.cost}</span>
    </span>
  );
}

function Week({ data, v, busy, api, run, onInbox, editing, setEditing, onTask }: {
  data: CampaignScreen; v: CampaignView; busy: boolean; api: CampaignApi; run: Run; onInbox: () => void;
  editing: { index: number; hint?: Hint } | null; setEditing: (e: { index: number; hint?: Hint } | null) => void; onTask: (t: ViewTask) => void;
}) {
  const [debate, setDebate] = useState(false);
  const waiting = v.phase === "waiting";
  const newMail = v.inbox.filter((m) => m.status === "new").length;
  if (editing !== null) {
    return <SlotPicker key={editing.index} v={v} data={data} index={editing.index} hint={editing.hint} busy={busy} onClose={() => setEditing(null)}
      onSet={async (a) => { const r = await run(api.slot(editing.index, a)); if (r) setEditing(null); }} />;
  }
  if (debate && v.debate) return <Debate v={v} busy={busy} onClose={() => setDebate(false)} onStyle={(st) => run(api.debate(st), false)} />;
  return (
    <div className="stack-16">
      {v.recap && v.recap.week === v.week - 1 && <Paper v={v} />}
      {waiting && (
        <div className="card stack-8">
          <p className="title" style={{ margin: 0 }}>⏳ Results arrive tomorrow morning</p>
          <p className="subtext" style={{ margin: 0 }}>The week is out of your hands. Lola is writing the headline. Come back tomorrow for the morning paper.</p>
        </div>
      )}
      {!waiting && (
        <>
          {v.tasks.length > 0 && (
            <div className="card stack-8">
              <p className="overline" style={{ margin: 0 }}>🗳️ This week's tasks · +{CAMPAIGN.taskClout} 🔥 each</p>
              {v.tasks.map((t) => (
                <button key={t.id} className={`camp-task${t.isDone ? " done" : ""}`} disabled={busy} onClick={() => onTask(t)}>
                  <span className="title">{t.isDone ? "✓ " : ""}{t.title}</span>
                  <span className="meta">{t.isDone ? "On the calendar. Pays at End Week." : t.tag}</span>
                  {!t.isDone && <span className="camp-task-how">👉 {t.how} ›</span>}
                </button>
              ))}
            </div>
          )}
          {newMail > 0 && <button className="card camp-nudge" onClick={onInbox}>📬 {newMail} message{newMail === 1 ? "" : "s"} waiting. They expire when the week ends.</button>}
          {v.debateWeek && (
            <div className="card stack-8">
              <p className="title" style={{ margin: 0 }}>🎤 Debate Thursday</p>
              {v.debate?.done
                ? <p className="subtext" style={{ margin: 0 }}>{v.debate.won ? "Won" : "Lost"} the debate (crowd {v.debate.crowd > 0 ? "+" : ""}{v.debate.crowd}).</p>
                : <><p className="subtext" style={{ margin: 0 }}>Four questions, live. Prep slots this week help Facts. Intel helps Attack.</p>
                    <button className="btn btn-secondary" onClick={() => setDebate(true)}>{v.debate?.round ? "Back on stage ›" : "Take the stage ›"}</button></>}
            </div>
          )}
          <BudgetCard v={v} busy={busy} onSave={(b) => run(api.budget(b))} />
          <div className="stack-8">
            <p className="overline" style={{ margin: 0 }}>📅 The calendar</p>
            {v.slots.map((s, i) => (
              <button key={i} className="camp-slot" disabled={busy || s?.kind === "meeting"} onClick={() => setEditing({ index: i })}>
                <span className="meta">{slotName(i)}</span>
                <span className="title">{s ? slotLabel(s, v) : <span className="meta">Free</span>}</span>
                {s && slotCash(s) > 0 && <span className="camp-slot-cost">{cs(slotCash(s))}</span>}
              </button>
            ))}
          </div>
          <Dilemmas v={v} busy={busy} onPick={(id, c) => run(api.dilemma(id, c))} />
          <button className="btn btn-taxi" disabled={busy || v.endedToday || (v.debateWeek && !v.debate?.done)} onClick={() => run(api.endWeek())}>
            {v.endedToday ? "One week a day. See you tomorrow." : v.debateWeek && !v.debate?.done ? "Debate first" : v.week === v.weeks ? "End the campaign: Election Day ›" : `End week ${v.week} ›`}
          </button>
          <p className="meta" style={{ margin: 0 }}>Results arrive the next morning. Nothing moves while you're away.</p>
        </>
      )}
    </div>
  );
}

function Paper({ v }: { v: CampaignView }) {
  const r = v.recap!;
  // Owner, Oct 30 (fewer words up front): the headline, the poll move and the top two stories; the rest on tap.
  const [all, setAll] = useState(false);
  const lines = all ? r.lines : r.lines.slice(0, 2);
  return (
    <div className="card camp-paper stack-8">
      <p className="overline" style={{ margin: 0 }}>📰 The morning paper · week {r.week}</p>
      <p className="title" style={{ margin: 0 }}>{r.headline}</p>
      <span className="meta">Poll: {r.you.toFixed(1)} vs {r.mayor.toFixed(1)} ({r.change >= 0 ? "+" : ""}{r.change})</span>
      <ul className="camp-lines">{lines.map((l, i) => <li key={i}>{l}</li>)}</ul>
      {r.lines.length > 2 && (
        <button className="link-row" onClick={() => setAll((a) => !a)} aria-expanded={all}>
          <span className="meta">{all ? "Show less" : `${r.lines.length - 2} more ${r.lines.length - 2 === 1 ? "story" : "stories"}`}</span>
        </button>
      )}
    </div>
  );
}

function slotLabel(s: SlotAction, v: CampaignView): string {
  const place = (id: string) => v.places.find((p) => p.id === id)?.name ?? id;
  switch (s.kind) {
    case "rally": return `📣 Rally in ${place(s.place)}`;
    case "tour": return `🚶 Tour stop in ${place(s.place)}`;
    case "donors": return "📞 Donor calls";
    case "prep": return `📚 Debate prep: ${s.topic === "weak" ? "your weak spot" : s.topic}`;
    case "rest": return "😴 Rest day";
    case "gotv": return `🗳️ Get out the vote: ${place(s.place)}`;
    case "meeting": { const m = v.inbox.find((x) => x.message.id === s.message); return `🤝 Meeting: ${m?.message.subject ?? "a meeting"}`; }
    case "op": return `🕶️ ${s.op === "fake_news" ? "Fake News" : "Poach Ally"}${s.cutout ? " (cut-out)" : ""}`;
  }
}

/** "One slot · C$800 · ⚡ 12": what a calendar stop costs in cash and the candidate's Energy (owner, Nov 4). */
const slotCostLine = (kind: string) => ["One slot", slotCash({ kind }) ? cs(slotCash({ kind })) : null, energyCost({ kind }) > 0 ? `⚡ ${energyCost({ kind })} Energy` : null].filter(Boolean).join(" · ");
const ACTIVITIES: { kind: SlotAction["kind"]; label: string; p: Preview; place?: boolean }[] = [
  { kind: "rally", label: "📣 Rally", place: true, p: { get: "A good lift in one place", cost: slotCostLine("rally") } },
  { kind: "tour", label: "🚶 Tour stop", place: true, p: { get: "A small lift, shows you care", cost: slotCostLine("tour") } },
  { kind: "donors", label: "📞 Donor calls", p: { get: "Campaign cash", cost: slotCostLine("donors") } },
  { kind: "rest", label: "😴 Rest", p: { get: `Team morale +8, ⚡ Energy +${-energyCost({ kind: "rest" })}`, cost: "One slot" } },
];

function SlotPicker({ v, index, hint, busy, onClose, onSet }: { v: CampaignView; data: CampaignScreen; index: number; hint?: Hint; busy: boolean; onClose: () => void; onSet: (a: SlotAction | null) => void }) {
  // A tapped task opens straight on its action when there's only one (and on the top list, marked, when there's a choice).
  const [kind, setKind] = useState<string | null>(hint?.kinds.length === 1 && ["rally", "tour", "gotv", "prep"].includes(hint.kinds[0]) ? hint.kinds[0] : null);
  const mine = (k: string) => !!hint?.kinds.includes(k);
  const TASK = <span className="tag tag-positive camp-task-tag">📌 Your task</span>;
  const [op, setOp] = useState<OpId>("fake_news");
  const [cutout, setCutout] = useState(false);
  const current = v.slots[index];
  const placeList = (k: "rally" | "tour" | "gotv") => (
    <div className="stack-8">
      {v.places.map((p) => (
        <button key={p.id} className={`camp-slot${mine(k) && hint?.place === p.id ? " hint" : ""}`} disabled={busy} onClick={() => onSet({ kind: k, place: p.id })}>
          <span className="title">{p.name}{mine(k) && hint?.place === p.id && TASK}</span>
          <span className="meta">{p.cares} · {p.you.toFixed(0)} vs {p.mayor.toFixed(0)}</span>
        </button>
      ))}
    </div>
  );
  const refused = v.refuses.includes(op);
  return (
      <div className="stack-16">
        <button className="btn btn-ghost" style={{ width: "auto", paddingLeft: 0 }} onClick={kind ? () => setKind(null) : onClose}>‹ {kind ? "Back" : "The week"}</button>
        <h3 className="display-md" style={{ margin: 0 }}>{slotName(index)}</h3>
        {!kind && (
          <div className="stack-8">
            {ACTIVITIES.map((a) => (
              <button key={a.kind} className={`camp-option${mine(a.kind) ? " hint" : ""}`} disabled={busy} onClick={() => (a.place ? setKind(a.kind) : onSet({ kind: a.kind } as SlotAction))}>
                <span className="title">{a.label}{mine(a.kind) && TASK}</span><PreviewLines p={a.p} />
              </button>
            ))}
            {v.week <= CAMPAIGN.debateWeek && (
              <button className={`camp-option${mine("prep") ? " hint" : ""}`} onClick={() => setKind("prep")}>
                <span className="title">📚 Debate prep{mine("prep") && TASK}</span><PreviewLines p={{ get: "Facts answers land on that topic", cost: slotCostLine("prep") }} />
              </button>
            )}
            {v.week === v.weeks && (
              <button className={`camp-option${mine("gotv") ? " hint" : ""}`} onClick={() => setKind("gotv")}>
                <span className="title">🗳️ Get out the vote{mine("gotv") && TASK}</span><PreviewLines p={{ get: "Turnout in one place on Election Day", cost: slotCostLine("gotv") }} />
              </button>
            )}
            {v.heat !== null && (
              <button className="camp-option dark" onClick={() => setKind("op")}>
                <span className="title">🕶️ Shadow op</span><PreviewLines p={{ get: "Fast damage to the Mayor's machine", cost: "Cash, Favors, Integrity" }} />
              </button>
            )}
            {current && <button className="btn btn-ghost" disabled={busy} onClick={() => onSet(null)}>Clear this slot</button>}
          </div>
        )}
        {(kind === "rally" || kind === "tour" || kind === "gotv") && placeList(kind)}
        {kind === "prep" && (
          <div className="stack-8">
            {[["rent", "Rent and housing"], ["transit", "The 7 train"], ["safety", "Safety"], ["money", "Campaign money"], ["weak", "Your candidate's weak spot"]].map(([id, label]) => (
              <button key={id} className={`camp-slot${hint?.topic === id ? " hint" : ""}`} disabled={busy} onClick={() => onSet({ kind: "prep", topic: id })}>
                <span className="title">{label}{hint?.topic === id && TASK}</span>{v.prepped.includes(id) && <span className="meta">Prepped ✓</span>}
              </button>
            ))}
          </div>
        )}
        {kind === "op" && (
          <div className="stack-12">
            <div className="segmented" role="group" aria-label="Op">
              <button aria-pressed={op === "fake_news"} onClick={() => setOp("fake_news")}>Fake News</button>
              <button aria-pressed={op === "poach_ally"} onClick={() => setOp("poach_ally")}>Poach Ally</button>
            </div>
            <PreviewLines p={op === "fake_news"
              ? { get: "The Mayor -2 in a place, -0.5 everywhere", cost: "1 Favor + C$5,000, Heat +8, Integrity -5" }
              : { get: "One of his allies switches: you +1.5, him -1.5, and a check", cost: "C$15,000 or 3 Favors, Heat +6, Integrity -4" }} />
            <label className="row" style={{ gap: 8 }}><input type="checkbox" checked={cutout} onChange={(e) => setCutout(e.target.checked)} /> Use a cut-out (+50% cost, harder to trace, may go off-script)</label>
            {refused && <p className="subtext" style={{ margin: 0 }}>Your candidate won't do this. Booking it talks them round: team morale -10.</p>}
            {op === "poach_ally" && !v.mayorAllies.length && <p className="subtext" style={{ margin: 0 }}>Every one of the Mayor&apos;s allies is already on your side.</p>}
            <div className="stack-8">
              {(op === "fake_news" ? v.places.map((p) => ({ id: p.id, name: p.name, sub: `Mayor ${p.mayor.toFixed(0)}` })) : v.mayorAllies.map((a) => ({ id: a.id, name: a.name, sub: a.role }))).map((t) => (
                <button key={t.id} className="camp-slot" disabled={busy} onClick={() => onSet({ kind: "op", op, target: t.id, cutout, persuaded: refused || undefined })}>
                  <span className="title">{t.name}</span><span className="meta">{t.sub}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
  );
}

type Line = "digital" | "street" | "tv" | "staff" | "community";
const BUDGET_ROWS: { id: Line; label: string; line: string; group: "ads" | "people" }[] = [
  { id: "digital", label: "📱 Digital ads", line: "Cheap and fast. Volatile.", group: "ads" },
  { id: "street", label: "🚪 Street teams", line: "Slow, durable, best where you visit.", group: "ads" },
  { id: "tv", label: "📺 TV", line: "Expensive, broad, big swings.", group: "ads" },
  { id: "staff", label: "👥 Staff bonuses", line: `Morale +${CAMPAIGN.money.staff.morale} per ${cs(CAMPAIGN.money.staff.per)}, up to +${CAMPAIGN.money.staff.maxMorale}.`, group: "people" },
  { id: "community", label: "🎁 Community giving", line: `Integrity +${CAMPAIGN.money.community.integrity} per ${cs(CAMPAIGN.money.community.per)} and a small lift everywhere.`, group: "people" },
];

/**
 * The week's money (owner, Nov 4): ads, bonuses and giving in steps of C$500, then the whole week added up: what
 * comes in, what goes out (payroll and the calendar too) and what's left.
 */
function BudgetCard({ v, busy, onSave }: { v: CampaignView; busy: boolean; onSave: (b: Budget) => void }) {
  const norm = (x: Budget): Required<Budget> => ({ digital: x.digital, street: x.street, tv: x.tv, staff: x.staff ?? 0, community: x.community ?? 0 });
  const [b, setB] = useState(norm(v.budget));
  const [last, setLast] = useState(v.budget);
  if (v.budget !== last) { setLast(v.budget); setB(norm(v.budget)); }
  const saved = norm(v.budget);
  const sum = (x: Required<Budget>) => x.digital + x.street + x.tv + x.staff + x.community;
  const room = v.free + sum(saved);
  const total = sum(b);
  const step = CAMPAIGN.money.step;
  const move = (c: Line, d: number) => setB((x) => ({ ...x, [c]: Math.max(0, Math.min(x[c] + d, x[c] + room - total)) }));
  const dirty = (Object.keys(b) as Line[]).some((k) => b[k] !== saved[k]);
  const m = v.money;
  const ads = b.digital + b.street + b.tv;
  const comingIn = m.small + m.donors;
  const goingOut = ads + b.staff + b.community + m.calendar + m.payroll;
  const net = comingIn - goingOut;
  return (
    <div className="card stack-12">
      <div className="row" style={{ justifyContent: "space-between" }}><span className="title">💰 This week&apos;s budget</span><span className="meta">{cs(room - total)} left to plan</span></div>
      {BUDGET_ROWS.map((r, i) => (
        <div key={r.id} className={`camp-budget-row${i === 3 ? " first-people" : ""}`}>
          <span className="stack-2"><span className="title">{r.label}</span><span className="meta">{r.line}</span></span>
          <span className="row" style={{ gap: 6 }}>
            <button className="icon-round" aria-label={`Less ${r.label}`} disabled={busy || b[r.id] === 0} onClick={() => move(r.id, -step)}>−</button>
            <span className="hud-number" style={{ minWidth: 72, textAlign: "center" }}>{cs(b[r.id])}</span>
            <button className="icon-round" aria-label={`More ${r.label}`} disabled={busy || room - total < step} onClick={() => move(r.id, step)}>+</button>
          </span>
        </div>
      ))}
      {dirty && <button className="btn btn-secondary" disabled={busy} onClick={() => onSave(b)}>Save the budget</button>}
      <div className="camp-ledger" aria-label="The week added up">
        <p className="overline" style={{ margin: 0 }}>The week, added up</p>
        <div className="camp-ledger-row in"><span>💵 Small donors <span className="meta">(about)</span></span><b>+{cs(m.small)}</b></div>
        {m.donors > 0 && <div className="camp-ledger-row in"><span>📞 Donor calls <span className="meta">(about)</span></span><b>+{cs(m.donors)}</b></div>}
        {ads > 0 && <div className="camp-ledger-row"><span>📣 Ads</span><b>−{cs(ads)}</b></div>}
        {b.staff > 0 && <div className="camp-ledger-row"><span>👥 Staff bonuses</span><b>−{cs(b.staff)}</b></div>}
        {b.community > 0 && <div className="camp-ledger-row"><span>🎁 Community giving</span><b>−{cs(b.community)}</b></div>}
        {m.calendar > 0 && <div className="camp-ledger-row"><span>📅 Calendar (rallies, tours, turnout)</span><b>−{cs(m.calendar)}</b></div>}
        <div className="camp-ledger-row"><span>🧾 Team payroll</span><b>−{cs(m.payroll)}</b></div>
        {m.ops > 0 && <div className="camp-ledger-row paid"><span>🕶️ Shadow ops <span className="meta">(already paid)</span></span><b>{cs(m.ops)}</b></div>}
        <div className={`camp-ledger-total ${net >= 0 ? "up" : "down"}`}><span>This week</span><b>{net >= 0 ? "+" : "−"}{cs(Math.abs(net))}</b></div>
        <span className="meta">Funds after End Week: about {cs(Math.max(0, v.cash + net))}{dirty ? " (once saved)" : ""}.</span>
      </div>
    </div>
  );
}

function Dilemmas({ v, busy, onPick }: { v: CampaignView; busy: boolean; onPick: (id: "skim" | "charity", c: string) => void }) {
  if (v.dilemmas.skim === null && !v.dilemmas.charity) return null;
  return (
    <div className="stack-8">
      {v.dilemmas.skim !== null && (
        <div className="card stack-8">
          <p className="title" style={{ margin: 0 }}>🧾 The books have a little wiggle room</p>
          <p className="subtext" style={{ margin: 0 }}>Nobody checks the stationery line. You could move some of it to your own account.</p>
          <button className="camp-option" disabled={busy} onClick={() => onPick("skim", "little")}><span className="title">Skim a little ({cs(Math.floor(v.dilemmas.skim / 2))})</span>
            <PreviewLines p={{ get: "Money in your own bank", cost: "Integrity -6" }} /></button>
          <button className="camp-option" disabled={busy} onClick={() => onPick("skim", "lot")}><span className="title">Skim a lot ({cs(v.dilemmas.skim)})</span>
            <PreviewLines p={{ get: "More money in your own bank", cost: "Integrity -12" }} /></button>
          <button className="btn btn-ghost" disabled={busy} onClick={() => onPick("skim", "leave")}>Leave it alone</button>
        </div>
      )}
      {v.dilemmas.charity && (
        <div className="card stack-8">
          <p className="title" style={{ margin: 0 }}>🥫 The food pantry needs a hand</p>
          <button className="camp-option" disabled={busy} onClick={() => onPick("charity", "public")}><span className="title">Donate C$3,000, publicly</span>
            <PreviewLines p={{ get: "+2 where you're weakest, a news beat", cost: "C$3,000" }} /></button>
          <button className="camp-option" disabled={busy} onClick={() => onPick("charity", "anon")}><span className="title">Donate C$3,000, anonymously</span>
            <PreviewLines p={{ get: "Integrity +5, a loyal ally", cost: "C$3,000" }} /></button>
          <button className="btn btn-ghost" disabled={busy} onClick={() => onPick("charity", "none")}>Not this time</button>
        </div>
      )}
    </div>
  );
}

/** Messages this device has opened, per campaign (read/unread is a convenience, kept on the device). */
function useReadMail(campaign: string) {
  const key = `cc-camp-read:${campaign}`;
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
type ReadMail = ReturnType<typeof useReadMail>;

/** "9:41 AM" today, "Yesterday", "Mon" this week, "Nov 2" before that; "Week 2" for mail from before time stamps. */
function mailTime(at: string | undefined, week: number): string {
  if (!at) return `Week ${week}`;
  const d = new Date(at), now = new Date();
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((day(now) - day(d)) / 86_400_000);
  if (days <= 0) return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (days === 1) return "Yesterday";
  if (days < 7) return d.toLocaleDateString("en-US", { weekday: "short" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Who a message is from: a stakeholder, or an unknown number. */
type Who = { id: string; name: string; role: string; initials: string; anon: boolean };
const initialsOf = (name: string) => name.replace(/^(Dean|Pastor|Auntie)\s+/, "").split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
function sender(v: CampaignView, from: string): Who {
  const s = v.allies.find((a) => a.id === from) ?? v.staff.find((a) => a.id === from);
  if (!s) return { id: from, name: "Unknown number", role: "No caller ID", initials: "?", anon: true };
  return { id: s.id, name: s.name, role: s.role, initials: initialsOf(s.name), anon: false };
}

/** A cast member's portrait (public/cast/campaign-<id>.webp; owner, Nov 4), initials until it loads or if it's missing. */
function Avatar({ who, big = false, size }: { who: Who; big?: boolean; size?: number }) {
  const [broken, setBroken] = useState(false);
  const style = size ? { width: size, height: size } : undefined;
  if (who.anon) return <span className={`camp-avatar anon${big ? " big" : ""}`} style={style} aria-hidden="true">🕶️</span>;
  return (
    <span className={`camp-avatar${big ? " big" : ""}`} style={style} aria-hidden="true">
      {broken ? who.initials : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/cast/campaign-${who.id}.webp`} alt="" loading="lazy" onError={() => setBroken(true)} />
      )}
    </span>
  );
}

/** The campaign's inbox as a messaging app (owner, Nov 4): who, when, a preview, read and unread. */
function Inbox({ v, busy, onReply, read, initial = null }: { v: CampaignView; busy: boolean; onReply: (m: string, o: string) => void; read: ReadMail; initial?: string | null }) {
  const [open, setOpen] = useState<string | null>(initial);
  // Replies are radio choices, sent with one button (owner, Oct 29).
  const [sel, setSel] = useState<string | null>(null);
  useEffect(() => { if (open) read.mark(open); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const when = (x: CampaignView["inbox"][number]) => (x.at ? Date.parse(x.at) : 0) + x.message.week * 1000;
  const list = [...v.inbox].sort((a, b) => Number(b.status === "new") - Number(a.status === "new") || when(b) - when(a));
  if (!list.length) return <p className="meta">No messages. Suspicious.</p>;
  const m = list.find((x) => x.message.id === open);
  if (m) {
    const who = sender(v, m.message.from);
    const mine = m.message.options.find((o) => o.id === m.option);
    return (
      <div className="stack-12">
        <button className="btn btn-ghost" style={{ width: "auto", paddingLeft: 0 }} onClick={() => setOpen(null)}>‹ Inbox</button>
        <div className="camp-thread-head">
          <Avatar who={who} big />
          <span className="stack-2" style={{ flex: 1, minWidth: 0 }}>
            <span className="title">{who.name}</span>
            <span className="meta">{who.role}</span>
          </span>
          <span className={`tag ${m.message.label === "Verified" ? "tag-positive" : m.message.label === "Anonymous" ? "tag-event" : "tag-neutral"}`}>{m.message.label}</span>
        </div>
        <span className="camp-thread-time">{mailTime(m.at, m.message.week)}</span>
        <div className="camp-bubble them">
          <b>{m.message.subject}</b>
          <span className="ph-sensitive">{m.message.body}</span>
        </div>
        {m.status === "answered" && mine && <div className="camp-bubble me">{mine.label}<span className="camp-bubble-meta">Sent ✓</span></div>}
        {m.status === "expired" && <p className="meta" style={{ textAlign: "center" }}>You never replied. They noticed.</p>}
        {m.status === "new" && (
          <div className="stack-8" role="radiogroup" aria-label="Your reply">
            <p className="overline" style={{ margin: "4px 0 0" }}>Pick your reply · expires when the week ends</p>
            {m.message.options.map((o: InboxOption) => (
              <button key={o.id} role="radio" aria-checked={sel === o.id} className="camp-option radio" disabled={busy} onClick={() => setSel(o.id)}>
                <span className="title">{o.label}{o.meeting && <span className="meta"> · books a slot</span>}</span><PreviewLines p={o} />
              </button>
            ))}
            <button className="btn btn-taxi" disabled={busy || !sel || !m.message.options.some((o) => o.id === sel)}
              onClick={() => { if (sel) { onReply(m.message.id, sel); setSel(null); setOpen(null); } }}>Send reply</button>
          </div>
        )}
      </div>
    );
  }
  const unread = list.filter((x) => x.status === "new" && !read.has(x.message.id)).length;
  return (
    <div className="camp-inbox" role="list" aria-label={`Inbox, ${unread} unread`}>
      {list.map((x) => {
        const who = sender(v, x.message.from);
        const isUnread = x.status === "new" && !read.has(x.message.id);
        return (
          <button key={x.message.id} role="listitem" className={`camp-mail-row${isUnread ? " unread" : ""}`} onClick={() => { setSel(null); setOpen(x.message.id); }}
            aria-label={`${isUnread ? "Unread. " : ""}${who.name}: ${x.message.subject}`}>
            <span className="camp-unread-dot" aria-hidden="true" />
            <Avatar who={who} />
            <span className="camp-mail-text">
              <span className="camp-mail-top"><span className="camp-mail-from">{who.name}</span><span className="camp-mail-time">{mailTime(x.at, x.message.week)}</span></span>
              <span className="camp-mail-subject">{x.message.subject}</span>
              <span className="camp-mail-preview">
                {x.status === "answered" ? "✓ Replied: " + (x.message.options.find((o) => o.id === x.option)?.label ?? "") : x.status === "expired" ? "Expired · no reply" : x.message.body}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

const STANDING: Record<string, { label: string; tone: string }> = {
  "2": { label: "Close ally", tone: "good" }, "1": { label: "Ally", tone: "good" }, "0": { label: "Undecided", tone: "mid" },
  "-1": { label: "Cool", tone: "bad" }, "-2": { label: "Against you", tone: "bad" },
};

/** Who's with the campaign (owner, Nov 4: "a way to track allies"): every stakeholder and where they stand. */
function Allies({ v }: { v: CampaignView }) {
  const groups = [
    { title: "On your side", list: v.allies.filter((a) => a.trust >= 1) },
    { title: "Still deciding", list: v.allies.filter((a) => a.trust === 0 && !a.mayorAlly) },
    { title: "With Papa-Dani", list: v.allies.filter((a) => a.trust < 1 && a.mayorAlly) },
    { title: "Cool on you", list: v.allies.filter((a) => a.trust < 0 && !a.mayorAlly) },
  ].filter((g) => g.list.length);
  const mine = v.allies.filter((a) => a.trust >= 1).length;
  return (
    <div className="stack-12">
      <div className="card camp-allies-sum">
        <span className="stack-2"><span className="camp-count">{mine}</span><span className="meta">on your side</span></span>
        <span className="stack-2"><span className="camp-count">{v.mayorAllies.length}</span><span className="meta">with Papa-Dani</span></span>
        <span className="stack-2"><span className="camp-count">{v.allies.length - mine - v.mayorAllies.length}</span><span className="meta">up for grabs</span></span>
      </div>
      <p className="meta" style={{ margin: 0 }}>Answer their messages and meet them to win them over. A message left to expire cools them off.</p>
      {groups.map((g) => (
        <div key={g.title} className="stack-8">
          <p className="overline" style={{ margin: 0 }}>{g.title}</p>
          {g.list.map((a) => {
            const st = STANDING[String(Math.max(-2, Math.min(2, a.trust)))];
            const who = sender(v, a.id);
            return (
              <div key={a.id} className="card camp-ally">
                <Avatar who={who} />
                <span className="stack-2" style={{ flex: 1, minWidth: 0 }}>
                  <span className="title">{a.name}</span>
                  <span className="meta">{a.age ? `${a.age} · ` : ""}{a.role}</span>
                  {a.vibe && <span className="camp-vibe">{a.vibe}</span>}
                </span>
                <span className="stack-2" style={{ alignItems: "flex-end", alignSelf: "flex-start" }}>
                  <span className={`camp-standing ${a.mayorAlly && a.trust < 1 ? "mayor" : st.tone}`}>{a.mayorAlly && a.trust < 1 ? "Mayor's ally" : st.label}</span>
                  <span className={`camp-trust ${st.tone}`} aria-hidden="true">{[0, 1, 2, 3].map((n) => <i key={n} className={n < a.trust + 2 ? "on" : ""} />)}</span>
                </span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/** The candidate's profile (owner, Nov 4: "a profile page for each candidate when players click on the profile pic"). */
function CandidateProfile({ card, v, onBack }: { card: CandidateCard; v: CampaignView; onBack: () => void }) {
  return (
    <div className="stack-16">
      <button className="btn btn-ghost" style={{ width: "auto", paddingLeft: 0 }} onClick={onBack}>‹ Campaign HQ</button>
      <div className="camp-poster">
        <Bunting />
        <CandidateFace id={card.id} big />
        <p className="overline">{card.title}</p>
        <h2 className="display-lg" style={{ margin: 0 }}>{card.name}</h2>
        <p className="title" style={{ margin: 0 }}>&quot;{card.slogan}&quot;</p>
      </div>
      <div className="stack-8">
        <p className="overline" style={{ margin: 0 }}>Bio</p>
        <p className="body" style={{ margin: 0 }}>{card.bio}</p>
      </div>
      <div className="stack-8">
        <p className="overline" style={{ margin: 0 }}>Running on</p>
        {card.issues.map((i) => (
          <div key={i.title} className="card camp-issue">
            {i.emoji && <span className="camp-issue-emoji" aria-hidden="true">{i.emoji}</span>}
            <span className="stack-2"><span className="title">{i.title}</span><span className="subtext">{i.line}</span></span>
          </div>
        ))}
      </div>
      <div className="card stack-4">
        <span className="title">In this race</span>
        <span className="meta">Week {v.week} of {v.weeks} · {v.you.toFixed(1)}% vs Papa-Dani&apos;s {v.mayor.toFixed(1)}%</span>
        <span className="meta">Started with {cs(card.cash)} and Integrity {card.integrity}</span>
        <span className="meta">Satire target: {card.satire}</span>
      </div>
    </div>
  );
}

function MapTab({ v, short }: { v: CampaignView; short: string }) {
  return (
    <div className="stack-8">
      {v.places.map((p) => {
        const t = Math.max(1, p.you + p.mayor);
        return (
          <div key={p.id} className="card stack-4">
            <div className="row" style={{ justifyContent: "space-between" }}><span className="title">{p.name}</span><span className="meta">{p.you > p.mayor ? `${short} leads` : "Papa-Dani leads"}</span></div>
            <div className="camp-poll small"><span className="you" style={{ width: `${(p.you / t) * 100}%` }} /><span className="mayor" /></div>
            <span className="meta">{p.you.toFixed(1)} vs {p.mayor.toFixed(1)} · cares about {p.cares.toLowerCase()}</span>
          </div>
        );
      })}
    </div>
  );
}

/** The team, from day one, with faces and who they are (owner, Nov 4). Morale and loyalty show once the team has had a week. */
function Team({ v }: { v: CampaignView }) {
  return (
    <div className="stack-12">
      {v.staff.map((s) => (
        <div key={s.id} className="card camp-ally camp-staff">
          <Avatar who={{ id: s.id, name: s.name, role: s.role, initials: initialsOf(s.name), anon: false }} size={56} />
          <span className="stack-2" style={{ flex: 1, minWidth: 0 }}>
            <span className="title">{s.name}{s.out && <span className="tag tag-neutral" style={{ marginLeft: 6 }}>Gone</span>}</span>
            <span className="meta">{s.age ? `${s.age} · ` : ""}{s.role} · {s.job}</span>
            {s.vibe && <span className="camp-vibe">{s.vibe}</span>}
            {v.shown.team && (
              <span className="camp-staff-stats">
                <span>💪 Morale <b>{s.morale}</b></span><span>🤞 Loyalty <b>{s.loyalty}</b></span>
              </span>
            )}
          </span>
        </div>
      ))}
      {!v.shown.team && <p className="meta" style={{ margin: 0 }}>Their morale and loyalty show after your first week together.</p>}
      {v.log.length > 0 && (
        <div className="stack-4">
          <p className="overline" style={{ margin: 0 }}>What happened</p>
          <ul className="camp-lines">{[...v.log].reverse().map((l, i) => <li key={i}><b>W{l.week}</b> {l.text}</li>)}</ul>
        </div>
      )}
    </div>
  );
}

function SituationCard({ v, busy, onChoose }: { v: CampaignView; busy: boolean; onChoose: (s: string, c: string) => void }) {
  const p = v.pending[0];
  const s = p.situation;
  // Choices are radio picks, decided with one button (owner, Oct 29), like the Inbox's replies.
  const [sel, setSel] = useState<{ sit: string; choice: string } | null>(null);
  const picked = sel?.sit === s.id ? sel.choice : null;
  return (
    <div className="stack-12">
      <p className="overline" style={{ margin: 0 }}>⚡ Something's happening · {v.pending.length} to decide</p>
      <div className="card camp-situation stack-8">
        <span className="camp-sit-icon" aria-hidden="true">{s.icon}</span>
        <p className="title" style={{ margin: 0 }}>{s.text}</p>
      </div>
      <div className="stack-8" role="radiogroup" aria-label="Your call">
        <p className="overline" style={{ margin: "4px 0 0" }}>Make the call</p>
        {s.choices.map((c) => (
          <button key={c.id} role="radio" aria-checked={picked === c.id} className="camp-option radio" disabled={busy} onClick={() => setSel({ sit: s.id, choice: c.id })}>
            <span className="title">{c.label}</span><PreviewLines p={c} />
          </button>
        ))}
        <button className="btn btn-taxi" disabled={busy || !picked} onClick={() => { if (picked) { onChoose(s.id, picked); setSel(null); } }}>Decide</button>
      </div>
    </div>
  );
}

const STYLES: DebateStyle[] = ["facts", "charm", "attack", "deflect", "own"];
const STYLE_LABEL: Record<DebateStyle, { label: string; p: Preview }> = {
  facts: { label: "📊 Facts", p: { get: "Strong if you prepped this topic", cost: "Nothing" } },
  charm: { label: "😊 Charm", p: { get: "Works when morale is high", cost: "Nothing" } },
  attack: { label: "🎯 Attack", p: { get: "Hits hard with intel on him", cost: "Uses one intel" } },
  deflect: { label: "↪️ Deflect", p: { get: "Gets you off a weak spot", cost: "A little trust" } },
  own: { label: "🙋 Own it", p: { get: "Stops a scandal's bleeding", cost: "A short-term hit" } },
};

function Debate({ v, busy, onClose, onStyle }: { v: CampaignView; busy: boolean; onClose: () => void; onStyle: (s: DebateStyle) => Promise<CampaignScreen | null> }) {
  const [last, setLast] = useState<{ delta: number; line: string } | null>(null);
  const d = v.debate!;
  const q = d.questions[d.round];
  return (
      <div className="stack-16">
        <button className="btn btn-ghost" style={{ width: "auto", paddingLeft: 0 }} onClick={onClose}>‹ The week</button>
        <p className="overline" style={{ margin: 0 }}>🎤 The debate · round {Math.min(d.round + 1, d.questions.length)} of {d.questions.length}</p>
        <div className="camp-crowd" aria-label={`Crowd ${d.crowd}`}><span style={{ left: `${50 + Math.max(-45, Math.min(45, d.crowd * 6))}%` }} /></div>
        <span className="meta">Crowd {d.crowd > 0 ? "+" : ""}{d.crowd}</span>
        {last && <div className={`card ${last.delta > 0 ? "camp-good" : "camp-bad"}`}><span className="title">{last.delta > 0 ? `+${last.delta}` : last.delta}</span> <span className="subtext">{last.line}</span></div>}
        {!d.done && q ? (
          <>
            <div className="card"><p className="title" style={{ margin: 0 }}>{q}</p></div>
            <p className="meta" style={{ margin: 0 }}>Call the play:</p>
            {STYLES.map((s) => (
              <button key={s} className="camp-option" disabled={busy} onClick={async () => { const r = await onStyle(s); if (r?.round) setLast(r.round); }}>
                <span className="title">{STYLE_LABEL[s].label}</span><PreviewLines p={STYLE_LABEL[s].p} />
              </button>
            ))}
          </>
        ) : (
          <div className="stack-12">
            <p className="display-md" style={{ margin: 0 }}>{d.won ? "You won the debate 🎉" : "Rough night 😬"}</p>
            <p className="subtext" style={{ margin: 0 }}>The snap poll is in. Now get back to the calendar.</p>
            <button className="btn btn-taxi" onClick={onClose}>Back to HQ</button>
          </div>
        )}
      </div>
  );
}

function ElectionNight({ data, v, onNew }: { data: CampaignScreen; v: CampaignView; onNew: () => void }) {
  const card = data.candidates.find((c) => c.id === v.candidate)!;
  const results = [...(v.election ?? [])].sort((a, b) => Math.abs(b.you - b.mayor) - Math.abs(a.you - a.mayor));
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (shown >= results.length) return;
    const t = setTimeout(() => setShown((n) => n + 1), 700);
    return () => clearTimeout(t);
  }, [shown, results.length]);
  const e = ENDING[v.ending ?? "loss"];
  const all = shown >= results.length;
  return (
    <div className="stack-16">
      <div className="camp-poster">
        <Bunting />
        <p className="overline">🗳️ Election night</p>
        <h2 className="display-lg" style={{ margin: 0 }}>{card.name} vs Papa-Dani</h2>
        <p className="subtext" style={{ margin: 0 }}>Results arrive place by place. The closest one reports last.</p>
      </div>
      <div className="stack-8">
        {results.slice(0, shown).map((r) => {
          const name = v.places.find((p) => p.id === r.place)?.name ?? r.place;
          return (
            <div key={r.place} className="card stack-4 camp-result">
              <div className="row" style={{ justifyContent: "space-between" }}><span className="title">{name}</span><span className="meta">Turnout {r.turnout}%</span></div>
              <div className="camp-poll small"><span className="you" style={{ width: `${r.you}%` }} /><span className="mayor" /></div>
              <span className="meta">{card.short} {r.you}% · Papa-Dani {r.mayor}% · {r.you > r.mayor ? `${card.short} takes it` : "Papa-Dani holds it"}</span>
            </div>
          );
        })}
      </div>
      {all && (
        <div className="card stack-8 camp-ending">
          <span className="camp-cand-emoji big" aria-hidden="true">{e.emoji}</span>
          <p className="display-md" style={{ margin: 0 }}>{e.title}</p>
          <p className="subtext" style={{ margin: 0 }}>{e.line}</p>
          <p className="meta" style={{ margin: 0 }}>📞 Papa-Dani: "{v.ending === "loss" ? "Great race, neighbor! My door's always open. Literally, the hinge is broken." : "Congratulations, neighbor! The ribbon scissors are in the top drawer."}"</p>
          {data.canStart ? <button className="btn btn-taxi" onClick={onNew}>Run another campaign ›</button>
            : data.nextStartOn ? <p className="meta" style={{ margin: 0 }}>Your next campaign opens {fmtDay(data.nextStartOn)}.</p> : null}
        </div>
      )}
    </div>
  );
}

function fmtDay(day: string): string {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" });
}
