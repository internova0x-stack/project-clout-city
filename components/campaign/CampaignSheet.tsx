"use client";

import { useCallback, useEffect, useState } from "react";
import { Sheet } from "@/components/Sheet";
import {
  CAMPAIGN, RISK_LABEL, cs,
  type CampaignApi, type CampaignScreen, type CandidateCard, type CandidateId, type Channel, type DebateStyle, type InboxOption, type OpId, type Preview, type SlotAction,
} from "@/lib/campaign";
import type { CampaignView } from "@/lib/campaignEngine";

// Campaign Mode (docs/CAMPAIGN-MODE.md): the player manages a challenger's campaign against Mayor Papa-Dani. One
// sheet, opened from the Phone's Campaign app (or Campaign HQ on the map): the teaser before Rank 2, the candidate
// pick, HQ (this week, inbox, the map, the team) while a campaign runs, and election night at the end. Every choice
// shows the You get / It costs / Risk preview (spec section 6.2). The server decides everything; this only asks.

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const slotName = (i: number) => `${DAYS[Math.floor(i / 2)]} ${i % 2 ? "evening" : "day"}`;
const ENDING: Record<string, { title: string; line: string; emoji: string }> = {
  clean_win: { emoji: "🏛️", title: "Clean win", line: "Your candidate is Mayor-elect, and nobody found anything. Because there was nothing to find." },
  dirty_win: { emoji: "🕶️", title: "Dirty win", line: "Your candidate is Mayor-elect. Some things are still buried. Keep your phone on." },
  loss: { emoji: "📉", title: "Lost", line: "Papa-Dani keeps City Hall. He called to say you ran a great race. He meant it." },
};

type Tab = "week" | "inbox" | "map" | "team";

export function CampaignSheet({ open, onClose, api, clout, onToast }: {
  open: boolean;
  onClose: () => void;
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
        {data && !data.unlocked && <Teaser data={data} clout={clout} />}
        {data && data.unlocked && !running && !(v?.phase === "over" && v.ending) && !picked && (
          <Pick data={data} onPick={setPicked} />
        )}
        {data && data.unlocked && picked && !running && (
          <CandidateDetail data={data} card={data.candidates.find((c) => c.id === picked)!} busy={busy}
            onBack={() => setPicked(null)}
            onStart={async (seed) => { const r = await run(api.start(picked, seed)); if (r) { setPicked(null); setTab("week"); } }} />
        )}
        {data && v && running && (
          <Hq data={data} v={v} busy={busy} tab={tab} setTab={setTab} api={api} run={run} />
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
  const need = 100;
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
            <span className="camp-cand-emoji" aria-hidden="true">{c.emoji}</span>
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
        <p className="subtext" style={{ margin: 0 }}>You run the campaign: the money, the calendar, the meetings, the dirty work (or not). Four campaign weeks, one a day.</p>
      </div>
      {!data.canStart && data.nextStartOn && (
        <div className="card"><p className="subtext" style={{ margin: 0 }}>Your next campaign opens {fmtDay(data.nextStartOn)}. Campaign managers need a week off. Legally.</p></div>
      )}
      <div className="stack-8">
        {data.candidates.map((c) => (
          <button key={c.id} className="select-card camp-cand" onClick={() => onPick(c.id)}>
            <span className="camp-cand-emoji" aria-hidden="true">{c.emoji}</span>
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
      <button className="btn btn-ghost" style={{ alignSelf: "flex-start", paddingLeft: 0 }} onClick={onBack}>‹ All candidates</button>
      <div className="camp-poster">
        <Bunting />
        <span className="camp-cand-emoji big" aria-hidden="true">{card.emoji}</span>
        <p className="overline">{card.title}</p>
        <h2 className="display-lg" style={{ margin: 0 }}>{card.name}</h2>
        <p className="title" style={{ margin: 0 }}>"{card.slogan}"</p>
      </div>
      <p className="body" style={{ margin: 0 }}>{card.bio}</p>
      <div className="stack-8">
        <p className="overline" style={{ margin: 0 }}>What they're running on</p>
        {card.issues.map((i) => (
          <div key={i.title} className="card camp-issue"><span className="title">{i.title}</span><span className="subtext">{i.line}</span></div>
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

function Hq({ data, v, busy, tab, setTab, api, run }: { data: CampaignScreen; v: CampaignView; busy: boolean; tab: Tab; setTab: (t: Tab) => void; api: CampaignApi; run: Run }) {
  const card = data.candidates.find((c) => c.id === v.candidate)!;
  const newMail = v.inbox.filter((m) => m.status === "new").length;
  return (
    <div className="stack-16">
      <div className="camp-head">
        <span className="camp-cand-emoji" aria-hidden="true">{card.emoji}</span>
        <span className="stack-2" style={{ flex: 1 }}>
          <span className="overline">Week {v.week} of {v.weeks}{v.debateWeek ? " · Debate week" : v.week === v.weeks ? " · Election week" : ""}</span>
          <span className="title">{card.name}</span>
        </span>
      </div>
      <Polls you={v.you} mayor={v.mayor} short={card.short} />
      <Meters v={v} />
      {v.pending.length > 0 ? (
        <SituationCard v={v} busy={busy} onChoose={(s, c) => run(api.choose(s, c))} />
      ) : (
        <>
          <div className="segmented" role="group" aria-label="Campaign HQ">
            <button aria-pressed={tab === "week"} onClick={() => setTab("week")}>This week</button>
            <button aria-pressed={tab === "inbox"} onClick={() => setTab("inbox")}>Inbox{newMail ? ` (${newMail})` : ""}</button>
            <button aria-pressed={tab === "map"} onClick={() => setTab("map")}>Map</button>
            <button aria-pressed={tab === "team"} onClick={() => setTab("team")}>Team</button>
          </div>
          {tab === "week" && <Week data={data} v={v} busy={busy} api={api} run={run} onInbox={() => setTab("inbox")} />}
          {tab === "inbox" && <Inbox v={v} busy={busy} onReply={(m, o) => run(api.reply(m, o))} />}
          {tab === "map" && <MapTab v={v} short={card.short} />}
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

function Meters({ v }: { v: CampaignView }) {
  return (
    <div className="camp-meters">
      <span className="camp-chip" title="Campaign cash not yet committed this week">💵 {cs(v.free)}</span>
      {(v.favors > 0 || v.shown.favors) && <span className="camp-chip">🤝 {v.favors} Favor{v.favors === 1 ? "" : "s"}</span>}
      {v.heat !== null && <span className="camp-chip" title="How close people are to finding out">🔥 Heat {v.heat}</span>}
      {v.integrity !== null && <span className="camp-chip">⚖️ Integrity {v.integrity}</span>}
      {v.morale !== null && <span className="camp-chip">💪 Morale {v.morale}</span>}
      {v.intel > 0 && <span className="camp-chip">🗂️ Intel {v.intel}</span>}
    </div>
  );
}

function PreviewLines({ p }: { p: Preview }) {
  return (
    <span className="camp-preview">
      <span><b>You get</b> {p.get}</span>
      <span><b>It costs</b> {p.cost}</span>
      <span className={`camp-risk ${p.risk}`}><b>Risk</b> {RISK_LABEL[p.risk]}: {p.why}{p.later ? " · ⏳ may come back later" : ""}</span>
    </span>
  );
}

function Week({ data, v, busy, api, run, onInbox }: { data: CampaignScreen; v: CampaignView; busy: boolean; api: CampaignApi; run: Run; onInbox: () => void }) {
  const [editing, setEditing] = useState<number | null>(null);
  const [debate, setDebate] = useState(false);
  const waiting = v.phase === "waiting";
  const newMail = v.inbox.filter((m) => m.status === "new").length;
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
          <Budget v={v} busy={busy} onSave={(b) => run(api.budget(b))} />
          <div className="stack-8">
            <p className="overline" style={{ margin: 0 }}>The calendar</p>
            {v.slots.map((s, i) => (
              <button key={i} className="camp-slot" disabled={busy || s?.kind === "meeting"} onClick={() => setEditing(i)}>
                <span className="meta">{slotName(i)}</span>
                <span className="title">{s ? slotLabel(s, v) : <span className="meta">Free</span>}</span>
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
      {editing !== null && <SlotPicker v={v} data={data} index={editing} busy={busy} onClose={() => setEditing(null)}
        onSet={async (a) => { const r = await run(api.slot(editing, a)); if (r) setEditing(null); }} />}
      {debate && <Debate v={v} busy={busy} onClose={() => setDebate(false)} onStyle={(s) => run(api.debate(s), false)} />}
    </div>
  );
}

function Paper({ v }: { v: CampaignView }) {
  const r = v.recap!;
  return (
    <div className="card camp-paper stack-8">
      <p className="overline" style={{ margin: 0 }}>📰 The morning paper · week {r.week}</p>
      <p className="title" style={{ margin: 0 }}>{r.headline}</p>
      <ul className="camp-lines">{r.lines.map((l, i) => <li key={i}>{l}</li>)}</ul>
      <span className="meta">Poll: {r.you.toFixed(1)} vs {r.mayor.toFixed(1)} ({r.change >= 0 ? "+" : ""}{r.change})</span>
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

const ACTIVITIES: { kind: SlotAction["kind"]; label: string; p: Preview; place?: boolean }[] = [
  { kind: "rally", label: "📣 Rally", place: true, p: { get: "A good lift in one place", cost: "One slot", risk: "low", why: "Weather, crowds" } },
  { kind: "tour", label: "🚶 Tour stop", place: true, p: { get: "A small lift, shows you care", cost: "One slot", risk: "low", why: "Safe and slow" } },
  { kind: "donors", label: "📞 Donor calls", p: { get: "Campaign cash", cost: "One slot", risk: "low", why: "Some donors want things later" } },
  { kind: "rest", label: "😴 Rest", p: { get: "Team morale +8", cost: "One slot", risk: "low", why: "The Mayor doesn't rest" } },
];

function SlotPicker({ v, index, busy, onClose, onSet }: { v: CampaignView; data: CampaignScreen; index: number; busy: boolean; onClose: () => void; onSet: (a: SlotAction | null) => void }) {
  const [kind, setKind] = useState<string | null>(null);
  const [op, setOp] = useState<OpId>("fake_news");
  const [cutout, setCutout] = useState(false);
  const current = v.slots[index];
  const placeList = (k: "rally" | "tour" | "gotv") => (
    <div className="stack-8">
      {v.places.map((p) => (
        <button key={p.id} className="camp-slot" disabled={busy} onClick={() => onSet({ kind: k, place: p.id })}>
          <span className="title">{p.name}</span>
          <span className="meta">{p.cares} · {p.you.toFixed(0)} vs {p.mayor.toFixed(0)}</span>
        </button>
      ))}
    </div>
  );
  const refused = v.refuses.includes(op);
  return (
    <Sheet open onClose={onClose} label={slotName(index)}>
      <div className="stack-16">
        <h3 className="display-md" style={{ margin: 0 }}>{slotName(index)}</h3>
        {!kind && (
          <div className="stack-8">
            {ACTIVITIES.map((a) => (
              <button key={a.kind} className="camp-option" disabled={busy} onClick={() => (a.place ? setKind(a.kind) : onSet({ kind: a.kind } as SlotAction))}>
                <span className="title">{a.label}</span><PreviewLines p={a.p} />
              </button>
            ))}
            {v.week <= CAMPAIGN.debateWeek && (
              <button className="camp-option" onClick={() => setKind("prep")}>
                <span className="title">📚 Debate prep</span><PreviewLines p={{ get: "Facts answers land on that topic", cost: "One slot", risk: "low", why: "Only helps on debate night" }} />
              </button>
            )}
            {v.week === v.weeks && (
              <button className="camp-option" onClick={() => setKind("gotv")}>
                <span className="title">🗳️ Get out the vote</span><PreviewLines p={{ get: "Turnout in one place on Election Day", cost: "One slot", risk: "low", why: "Only counts on the day" }} />
              </button>
            )}
            {v.heat !== null && (
              <button className="camp-option dark" onClick={() => setKind("op")}>
                <span className="title">🕶️ Shadow op</span><PreviewLines p={{ get: "Fast damage to the Mayor's machine", cost: "Cash, Favors, Integrity", risk: "high", why: "Traces can surface weeks later", later: true }} />
              </button>
            )}
            {current && <button className="btn btn-ghost" disabled={busy} onClick={() => onSet(null)}>Clear this slot</button>}
          </div>
        )}
        {(kind === "rally" || kind === "tour" || kind === "gotv") && placeList(kind)}
        {kind === "prep" && (
          <div className="stack-8">
            {[["rent", "Rent and housing"], ["transit", "The 7 train"], ["safety", "Safety"], ["money", "Campaign money"], ["weak", "Your candidate's weak spot"]].map(([id, label]) => (
              <button key={id} className="camp-slot" disabled={busy} onClick={() => onSet({ kind: "prep", topic: id })}>
                <span className="title">{label}</span>{v.prepped.includes(id) && <span className="meta">Prepped ✓</span>}
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
              ? { get: "The Mayor -2 in a place, -0.5 everywhere", cost: "1 Favor + C$5,000, Heat +8, Integrity -5", risk: "high", why: "35% it's fact-checked within two weeks", later: true }
              : { get: "One of his allies switches: you +1.5, him -1.5, and a check", cost: "C$15,000 or 3 Favors, Heat +6, Integrity -4", risk: "high", why: "Some allies double-cross", later: true }} />
            <label className="row" style={{ gap: 8 }}><input type="checkbox" checked={cutout} onChange={(e) => setCutout(e.target.checked)} /> Use a cut-out (+50% cost, harder to trace, may go off-script)</label>
            {refused && <p className="subtext" style={{ margin: 0 }}>Your candidate won't do this. Booking it talks them round: team morale -10.</p>}
            <div className="stack-8">
              {(op === "fake_news" ? v.places.map((p) => ({ id: p.id, name: p.name, sub: `Mayor ${p.mayor.toFixed(0)}` })) : v.mayorAllies.map((a) => ({ id: a.id, name: a.name, sub: a.role }))).map((t) => (
                <button key={t.id} className="camp-slot" disabled={busy} onClick={() => onSet({ kind: "op", op, target: t.id, cutout, persuaded: refused || undefined })}>
                  <span className="title">{t.name}</span><span className="meta">{t.sub}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {kind && <button className="btn btn-ghost" onClick={() => setKind(null)}>‹ Back</button>}
      </div>
    </Sheet>
  );
}

function Budget({ v, busy, onSave }: { v: CampaignView; busy: boolean; onSave: (b: Record<Channel, number>) => void }) {
  const [b, setB] = useState(v.budget);
  const [last, setLast] = useState(v.budget);
  if (v.budget !== last) { setLast(v.budget); setB(v.budget); }
  const committed = v.budget.digital + v.budget.street + v.budget.tv;
  const room = v.free + committed;
  const total = b.digital + b.street + b.tv;
  const step = (c: Channel, d: number) => setB((x) => ({ ...x, [c]: Math.max(0, Math.min(x[c] + d, x[c] + room - total)) }));
  const ROWS: [Channel, string, string][] = [["digital", "📱 Digital", "Cheap and fast. Volatile."], ["street", "🚪 Street teams", "Slow, durable, best where you visit."], ["tv", "📺 TV", "Expensive, broad, big swings."]];
  const dirty = b.digital !== v.budget.digital || b.street !== v.budget.street || b.tv !== v.budget.tv;
  return (
    <div className="card stack-12">
      <div className="row" style={{ justifyContent: "space-between" }}><span className="title">This week's budget</span><span className="meta">{cs(room - total)} left</span></div>
      {ROWS.map(([c, label, line]) => (
        <div key={c} className="row" style={{ justifyContent: "space-between", gap: 8 }}>
          <span className="stack-2"><span className="title">{label}</span><span className="meta">{line}</span></span>
          <span className="row" style={{ gap: 6 }}>
            <button className="icon-round" aria-label={`Less ${c}`} onClick={() => step(c, -1000)}>−</button>
            <span className="hud-number" style={{ minWidth: 64, textAlign: "center" }}>{cs(b[c])}</span>
            <button className="icon-round" aria-label={`More ${c}`} onClick={() => step(c, 1000)}>+</button>
          </span>
        </div>
      ))}
      {dirty && <button className="btn btn-secondary" disabled={busy} onClick={() => onSave(b)}>Save the budget</button>}
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
            <PreviewLines p={{ get: "Money in your own bank", cost: "Integrity -6", risk: "medium", why: "It leaves a paper trail", later: true }} /></button>
          <button className="camp-option" disabled={busy} onClick={() => onPick("skim", "lot")}><span className="title">Skim a lot ({cs(v.dilemmas.skim)})</span>
            <PreviewLines p={{ get: "More money in your own bank", cost: "Integrity -12", risk: "high", why: "Big trails get found; you'd pay it back", later: true }} /></button>
          <button className="btn btn-ghost" disabled={busy} onClick={() => onPick("skim", "leave")}>Leave it alone</button>
        </div>
      )}
      {v.dilemmas.charity && (
        <div className="card stack-8">
          <p className="title" style={{ margin: 0 }}>🥫 The food pantry needs a hand</p>
          <button className="camp-option" disabled={busy} onClick={() => onPick("charity", "public")}><span className="title">Donate C$3,000, publicly</span>
            <PreviewLines p={{ get: "+2 where you're weakest, a news beat", cost: "C$3,000", risk: "low", why: "Could be called a stunt" }} /></button>
          <button className="camp-option" disabled={busy} onClick={() => onPick("charity", "anon")}><span className="title">Donate C$3,000, anonymously</span>
            <PreviewLines p={{ get: "Integrity +5, a loyal ally", cost: "C$3,000", risk: "low", why: "Nobody will know. That's the point" }} /></button>
          <button className="btn btn-ghost" disabled={busy} onClick={() => onPick("charity", "none")}>Not this time</button>
        </div>
      )}
    </div>
  );
}

function Inbox({ v, busy, onReply }: { v: CampaignView; busy: boolean; onReply: (m: string, o: string) => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const list = [...v.inbox].sort((a, b) => Number(b.status === "new") - Number(a.status === "new"));
  if (!list.length) return <p className="meta">No messages. Suspicious.</p>;
  const m = list.find((x) => x.message.id === open);
  if (m) {
    return (
      <div className="stack-12">
        <button className="btn btn-ghost" style={{ alignSelf: "flex-start", paddingLeft: 0 }} onClick={() => setOpen(null)}>‹ Inbox</button>
        <span className={`tag ${m.message.label === "Verified" ? "tag-positive" : m.message.label === "Anonymous" ? "tag-event" : "tag-neutral"}`} style={{ alignSelf: "flex-start" }}>{m.message.label}</span>
        <p className="title" style={{ margin: 0 }}>{m.message.subject}</p>
        <p className="body ph-sensitive" style={{ margin: 0 }}>{m.message.body}</p>
        {m.status === "new" ? m.message.options.map((o: InboxOption) => (
          <button key={o.id} className="camp-option" disabled={busy} onClick={async () => { onReply(m.message.id, o.id); setOpen(null); }}>
            <span className="title">{o.label}{o.meeting && <span className="meta"> · books a slot</span>}</span><PreviewLines p={o} />
          </button>
        )) : <p className="meta">{m.status === "expired" ? "Expired. They noticed." : `Answered: ${m.message.options.find((o) => o.id === m.option)?.label ?? ""}`}</p>}
      </div>
    );
  }
  return (
    <div className="stack-8">
      {list.map((x) => (
        <button key={x.message.id} className={`camp-mail${x.status === "new" ? " new" : ""}`} onClick={() => setOpen(x.message.id)}>
          <span className="title">{x.message.subject}</span>
          <span className="meta">{x.message.label} · {x.status === "new" ? "expires when the week ends" : x.status}</span>
        </button>
      ))}
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

function Team({ v }: { v: CampaignView }) {
  return (
    <div className="stack-12">
      {v.staff ? v.staff.map((s) => (
        <div key={s.id} className="card stack-2">
          <span className="title">{s.name}{s.out && <span className="tag tag-neutral" style={{ marginLeft: 6 }}>Gone</span>}</span>
          <span className="meta">{s.role} · {s.job}</span>
          <span className="meta">Morale {s.morale} · Loyalty {s.loyalty}</span>
        </div>
      )) : <p className="meta">Your team: Sol, Priya, Theo and Marisol. You'll get to know them.</p>}
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
  return (
    <div className="stack-12">
      <p className="overline" style={{ margin: 0 }}>⚡ Something's happening · {v.pending.length} to decide</p>
      <div className="card camp-situation stack-8">
        <span className="camp-sit-icon" aria-hidden="true">{s.icon}</span>
        <p className="title" style={{ margin: 0 }}>{s.text}</p>
      </div>
      {s.choices.map((c) => (
        <button key={c.id} className="camp-option" disabled={busy} onClick={() => onChoose(s.id, c.id)}>
          <span className="title">{c.label}</span><PreviewLines p={c} />
        </button>
      ))}
    </div>
  );
}

const STYLES: DebateStyle[] = ["facts", "charm", "attack", "deflect", "own"];
const STYLE_LABEL: Record<DebateStyle, { label: string; p: Preview }> = {
  facts: { label: "📊 Facts", p: { get: "Strong if you prepped this topic", cost: "Nothing", risk: "medium", why: "Weak if unprepared" } },
  charm: { label: "😊 Charm", p: { get: "Works when morale is high", cost: "Nothing", risk: "medium", why: "Can look evasive" } },
  attack: { label: "🎯 Attack", p: { get: "Hits hard with intel on him", cost: "Uses one intel", risk: "high", why: "Backlash if it seems unfair" } },
  deflect: { label: "↪️ Deflect", p: { get: "Gets you off a weak spot", cost: "A little trust", risk: "medium", why: "Obvious if overused" } },
  own: { label: "🙋 Own it", p: { get: "Stops a scandal's bleeding", cost: "A short-term hit", risk: "low", why: "Only works on a real problem" } },
};

function Debate({ v, busy, onClose, onStyle }: { v: CampaignView; busy: boolean; onClose: () => void; onStyle: (s: DebateStyle) => Promise<CampaignScreen | null> }) {
  const [last, setLast] = useState<{ delta: number; line: string } | null>(null);
  const d = v.debate!;
  const q = d.questions[d.round];
  return (
    <Sheet open onClose={onClose} label="The debate" tall>
      <div className="stack-16">
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
    </Sheet>
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
