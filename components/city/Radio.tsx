"use client";

import { useEffect, useState } from "react";
import {
  RADIO, cleanHandle, localAirTime, maskWords, messageProblem, type RadioApi, type RadioState, type Shoutout,
} from "@/lib/radio";
import { handle as at } from "@/lib/validation";

// v0.14 Real Clout FM (migration 0057): the Radio app on the Phone and the on-air banner. The owner
// picks one shoutout a day in the Studio; DJ Sharm Almight reads it on "The Wake-Up Call" at 9 a.m.
// New York, and every player sees it once as a banner.

type Reason = "harassment" | "spam" | "inappropriate" | "other";
const REASONS: { id: Reason; label: string }[] = [
  { id: "harassment", label: "Targets someone" },
  { id: "inappropriate", label: "Inappropriate" },
  { id: "spam", label: "Spam" },
  { id: "other", label: "Something else" },
];

/** The show's artwork: a sunrise over the Queens skyline, a mic, the dial. */
export function WakeUpArt({ small = false }: { small?: boolean }) {
  return (
    <div className={`radio-art${small ? " small" : ""}`} aria-hidden="true">
      <svg viewBox="0 0 320 150" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="ra-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2E6F7E" />
            <stop offset=".55" stopColor="#F2A07B" />
            <stop offset="1" stopColor="#FFD9A0" />
          </linearGradient>
          <radialGradient id="ra-sun" cx=".5" cy=".5" r=".5">
            <stop offset="0" stopColor="#FFF1C9" />
            <stop offset="1" stopColor="#FFB45E" />
          </radialGradient>
        </defs>
        <rect width="320" height="150" fill="url(#ra-sky)" />
        <circle cx="214" cy="104" r="40" fill="url(#ra-sun)" />
        {[0, 1, 2].map((i) => <circle key={i} cx="214" cy="104" r={52 + i * 14} fill="none" stroke="#FFF1C9" strokeOpacity={0.35 - i * 0.1} strokeWidth="2" />)}
        <path d="M0 150V112h18V96h14v16h10V84h20v28h12V100h16v-8h14v20h12V90h8V78h10v34h14V104h20v8h14V98h16v14h12v-6h18v6h10V92h22v20h16v38Z" fill="#1E3A44" />
        <g transform="translate(286 44) scale(.62)">
          <rect x="0" y="0" width="26" height="44" rx="13" fill="#F4F1EA" />
          {[10, 17, 24, 31].map((y) => <rect key={y} x="5" y={y} width="16" height="2" rx="1" fill="#C9B79C" />)}
          <path d="M-6 26a19 19 0 0 0 38 0" fill="none" stroke="#F4F1EA" strokeWidth="3" />
          <rect x="11.5" y="45" width="3" height="12" fill="#F4F1EA" />
        </g>
      </svg>
      <div className="radio-art-text">
        <span className="radio-dial">88.8 · {RADIO.station}</span>
        <span className="radio-show">{RADIO.show}</span>
        <span className="radio-host">with {RADIO.host}</span>
      </div>
    </div>
  );
}

function ReportRow({ s, api, onDone }: { s: Shoutout; api: RadioApi; onDone: (text: string) => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!open) return <button className="radio-report" onClick={() => setOpen(true)} aria-label={`Report ${at(s.handle)}'s shoutout`}>⚑ Report</button>;
  return (
    <div className="radio-report-pick" role="group" aria-label="Why report it?">
      {REASONS.map((r) => (
        <button key={r.id} className="chip" disabled={busy} onClick={async () => {
          setBusy(true);
          const res = await api.report(s.id, r.id, "");
          setBusy(false);
          setOpen(false);
          onDone(res.ok ? "Reported. A moderator will look at it." : res.error);
        }}>{r.label}</button>
      ))}
      <button className="chip" onClick={() => setOpen(false)}>Cancel</button>
    </div>
  );
}

function ShoutoutCard({ s, api, onToast, onAir = false }: { s: Shoutout; api: RadioApi; onToast: (t: string) => void; onAir?: boolean }) {
  return (
    <article className={`radio-shoutout${onAir ? " on-air" : ""}`}>
      {onAir && <span className="radio-live"><span className="radio-live-dot" aria-hidden="true" /> On air</span>}
      <span className="title">{at(s.handle)} says…</span>
      <span className="body">“{s.message}”</span>
      <ReportRow s={s} api={api} onDone={onToast} />
    </article>
  );
}

/** What happened to the player's own request. Rejections read like any other no, once the day ends. */
function MineNote({ mine, today }: { mine: NonNullable<RadioState["mine"]>; today: string }) {
  const over = mine.date < today;
  if (mine.status === "on_air") return <div className="radio-mine good">🎙️ You made it. {RADIO.host} read your shoutout on {RADIO.show}.</div>;
  if (mine.status === "wall") return <div className="radio-mine good">📌 You&apos;re on today&apos;s shoutout wall.</div>;
  if (over || mine.status === "not_picked") return <div className="radio-mine">Not today. Try again tomorrow.</div>;
  return <div className="radio-mine">📨 Your shoutout is in. If {RADIO.host} picks it, you&apos;ll hear it at 9:00 a.m. New York.</div>;
}

export function RadioApp({ api, onToast }: { api: RadioApi; onToast: (t: string) => void }) {
  const [s, setS] = useState<RadioState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(false);
  const load = async () => {
    const r = await api.state();
    if (r.ok) { setS(r.data); setError(null); } else setError(r.error);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, [api]);

  if (error) return <div className="card stack-4"><p className="body" style={{ margin: 0 }}>{error}</p></div>;
  if (!s) return <p className="meta">Tuning in…</p>;
  if (form) return <RequestForm s={s} api={api} onCancel={() => setForm(false)} onSent={(text) => { setForm(false); onToast(text); void load(); }} />;

  const airedToday = s.onAir?.date === s.today;
  // Your own request: today's, or yesterday's answer until you ask again.
  const yesterday = new Date(Date.parse(`${s.today}T12:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
  const showMine = !!s.mine && s.mine.date >= yesterday;
  return (
    <div className="stack-12 radio-app">
      <WakeUpArt />
      {s.onAir ? (
        <div className="stack-8">
          <p className="overline" style={{ margin: 0 }}>{airedToday ? "Today's shoutout" : `Last shoutout · ${new Date(`${s.onAir.date}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}`}</p>
          <ShoutoutCard s={s.onAir} api={api} onToast={onToast} onAir={airedToday} />
        </div>
      ) : (
        <div className="card stack-4">
          <span className="title" style={{ display: "block" }}>Nobody on air yet</span>
          <span className="meta">The show airs at 9:00 a.m. New York ({localAirTime(s.airsAt)} your time). One shoutout a day, picked by the station.</span>
        </div>
      )}
      {!airedToday && s.onAir && <p className="meta" style={{ margin: 0 }}>Today&apos;s airs at 9:00 a.m. New York ({localAirTime(s.airsAt)} your time).</p>}
      {s.wall.length > 0 && (
        <div className="stack-8">
          <p className="overline" style={{ margin: 0 }}>Shoutout wall</p>
          {s.wall.map((w) => <ShoutoutCard key={w.id} s={w} api={api} onToast={onToast} />)}
        </div>
      )}
      {showMine && s.mine && <MineNote mine={s.mine} today={s.today} />}
      {!s.requestedToday && (
        s.left > 0 ? (
          <div className="stack-4">
            <button className="btn btn-night" onClick={() => setForm(true)}>🎙️ Request a shoutout</button>
            <span className="meta" style={{ textAlign: "center" }}>{s.left} spot{s.left === 1 ? "" : "s"} left on today&apos;s list · one a day</span>
          </div>
        ) : (
          <button className="btn btn-secondary" disabled>Today&apos;s list is full. Try again tomorrow.</button>
        )
      )}
    </div>
  );
}

function RequestForm({ s, api, onCancel, onSent }: { s: RadioState; api: RadioApi; onCancel: () => void; onSent: (text: string) => void }) {
  const [handle, setHandle] = useState("");
  const [message, setMessage] = useState("");
  const [mine, setMine] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const masked = maskWords(message, s.words);
  const problem = messageProblem(message);
  const clean = cleanHandle(handle);
  const len = message.trim().length;
  const ready = !!clean && len > 0 && !problem && mine && !busy;
  return (
    <form className="stack-12 radio-form" onSubmit={async (e) => {
      e.preventDefault();
      if (!ready) return;
      setBusy(true);
      setError(null);
      const r = await api.request(handle, message, mine);
      setBusy(false);
      if (!r.ok) return setError(r.error);
      onSent(`Sent to ${RADIO.station}. If it's picked, it airs at 9:00 a.m. New York.`);
    }}>
      <WakeUpArt small />
      <label className="stack-4">
        <span className="overline">Your Instagram handle</span>
        <span className={`field${handle && !clean ? " error" : ""}`}><input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@your.instagram" autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={RADIO.handleMax + 1} aria-label="Your Instagram handle" /></span>
        {handle && !clean ? <span className="meta radio-problem">Letters, numbers, dots and underscores only.</span>
          : <span className="meta">Your IG handle, not your Clout City name. It&apos;s read out on air.</span>}
      </label>
      <label className="stack-4">
        <span className="row" style={{ justifyContent: "space-between" }}>
          <span className="overline">Your shoutout</span>
          <span className={`meta${len > RADIO.messageMax ? " radio-problem" : ""}`}>{len}/{RADIO.messageMax}</span>
        </span>
        <span className={`field radio-area${problem ? " error" : ""}`}><textarea value={masked} onChange={(e) => setMessage(e.target.value)} rows={3} placeholder="Good morning Queens! …" aria-label="Your shoutout" /></span>
        {problem && <span className="meta radio-problem">{problem}</span>}
      </label>
      <label className="radio-check">
        <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} />
        <span className="body">This Instagram handle is mine.</span>
      </label>
      <p className="meta" style={{ margin: 0 }}>The station picks one shoutout a day, plus a few for the wall. Shoutouts can&apos;t name or tag anyone else.</p>
      {error && <p className="body radio-problem" style={{ margin: 0 }}>{error}</p>}
      <div className="row" style={{ gap: 8 }}>
        <button type="button" className="btn btn-secondary" style={{ width: "auto", flex: "none" }} onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-night radio-submit" disabled={!ready}>{busy ? "Requesting…" : "Request shoutout"}</button>
      </div>
    </form>
  );
}

/** The on-air banner: today's shoutout, once per device, for about 8 seconds. */
export function RadioBanner({ s, api, onToast, onOpen, onDone }: { s: Shoutout; api: RadioApi; onToast: (t: string) => void; onOpen: () => void; onDone: () => void }) {
  const [hold, setHold] = useState(false);
  useEffect(() => {
    if (hold) return;
    const t = setTimeout(onDone, RADIO.bannerMs);
    return () => clearTimeout(t);
  }, [hold, onDone]);
  return (
    <div className="radio-banner glass-hud" role="status" onPointerDown={() => setHold(true)}>
      <button className="radio-banner-main" onClick={onOpen}>
        <span className="radio-banner-icon" aria-hidden="true">📻</span>
        <span className="radio-banner-text">
          <span className="radio-banner-who">{RADIO.station}: {at(s.handle)} says…</span>
          <span className="radio-banner-msg">“{s.message}”</span>
        </span>
      </button>
      <div className="radio-banner-actions">
        <ReportRow s={s} api={api} onDone={(t) => { onToast(t); onDone(); }} />
        <button className="radio-report" onClick={onDone} aria-label="Dismiss">✕</button>
      </div>
    </div>
  );
}
