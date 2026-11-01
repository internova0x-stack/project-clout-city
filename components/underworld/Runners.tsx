"use client";

import { useCallback, useEffect, useState } from "react";
import { formatCash } from "@/lib/economy";
import { MARKETPLACE, cutLine, type UnderworldHire, type UnderworldHires, type UnderworldRunner } from "@/lib/marketplace";
import type { UnderworldApi, UnderworldScreen, UnderworldView } from "@/lib/underworld";
import { handle } from "@/lib/validation";
import { Avatar } from "../crew/Crew";

// Migration 0152: underworld jobs between players, in Pablo's back room. Hand one of today's offers to a friend Pablo also
// knows (a runner) for a cut held in escrow; they do it here like any job and take the risk; you get Pablo's take; both of
// you get Heat. Only NPC targets: Pablo's jobs never touch a real player.

export function Runners({ api, v, busy, onToast, onDone }: {
  api: UnderworldApi;
  v: UnderworldView;
  busy: boolean;
  onToast: (text: string) => void;
  /** A hire ran: the receipt, and the screen to show. */
  onDone: (r: UnderworldScreen) => void;
}) {
  const [hires, setHires] = useState<UnderworldHires | null>(null);
  const [runners, setRunners] = useState<UnderworldRunner[] | null>(null);
  const [posting, setPosting] = useState(false);
  const [job, setJob] = useState<string | null>(null);
  const [runner, setRunner] = useState<string | null>(null);
  const [cut, setCut] = useState<number>(MARKETPLACE.hire.cuts[1]);
  const [working, setWorking] = useState(false);
  const load = useCallback(async () => {
    if (!api.hires) return;
    const r = await api.hires();
    if (r.ok) setHires(r.data);
  }, [api]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (posting && !runners && api.runners) void api.runners().then((r) => setRunners(r.ok ? r.data : [])); }, [posting, runners, api]);
  if (!api.hires || !hires) return null;
  const waiting = hires.received.filter((h) => h.status === "offered");
  const open = v.offers.filter((o) => !o.done);
  const today = hires.sent.filter((h) => h.status === "offered" || h.status === "done").filter((h) => h.day === new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" }));
  const canPost = open.length > 0 && today.length < MARKETPLACE.hire.perDay;
  const disabled = busy || working || !v.here || v.holding || v.tooHot;
  const post = async () => {
    if (!api.hire || !job || !runner) return;
    setWorking(true);
    const r = await api.hire(job, runner, cut);
    setWorking(false);
    if (!r.ok) { onToast(r.error); return; }
    onToast(`🧳 Sent. ${formatCash(cut)} is held until they've done it, or back to you in ${MARKETPLACE.hire.hours} hours.`);
    setPosting(false); setJob(null); setRunner(null);
    void load();
  };
  return (
    <div className="stack-12">
      <p className="overline" style={{ margin: 0 }}>Runners</p>
      {waiting.map((h) => <HireCard key={h.id} h={h} disabled={disabled} declineOff={busy || working}
        onRun={async (opt) => {
          if (!api.runHire) return;
          setWorking(true);
          const r = await api.runHire(h.id, opt);
          setWorking(false);
          if (!r.ok) { onToast(r.error); return; }
          onDone(r.data);
          void load();
        }}
        onDecline={async () => {
          if (!api.declineHire) return;
          setWorking(true);
          const r = await api.declineHire(h.id);
          setWorking(false);
          if (!r.ok) { onToast(r.error); return; }
          onToast("Passed. The cut went back to them, no hard feelings. Pablo noticed, though.");
          void load();
        }} />)}
      {!posting ? (
        <button className="btn btn-secondary" disabled={!canPost || busy} onClick={() => setPosting(true)}>
          🏃 Send a runner{canPost ? "" : today.length ? " · one a day" : ""}
        </button>
      ) : (
        <div className="card stack-8">
          <p className="subtext" style={{ margin: 0 }}>Hand one of today&apos;s jobs to a friend Pablo also knows. They take the risk; you take Pablo&apos;s money and pay their cut. You both get a little warmer with the 114½.</p>
          <div className="stack-4" role="radiogroup" aria-label="Which job">
            {open.map((o) => (
              <button key={o.id} role="radio" aria-checked={job === o.id} className={`list-row crew-pick${job === o.id ? " on" : ""}`} onClick={() => setJob(o.id)}>
                <span className="date-avatar" aria-hidden="true">{o.emoji}</span>
                <span className="title one-line" style={{ flex: 1, textAlign: "left" }}>{o.title}</span>
              </button>
            ))}
          </div>
          <div className="stack-4" role="radiogroup" aria-label="Who runs it">
            {runners === null && <p className="meta" style={{ margin: 0 }}>Asking around…</p>}
            {runners?.length === 0 && <p className="meta" style={{ margin: 0 }}>None of your Crew or chats know Pablo yet. He doesn&apos;t do introductions.</p>}
            {runners?.map((p) => (
              <button key={p.id} role="radio" aria-checked={runner === p.id} disabled={!p.canTake} className={`list-row crew-pick${runner === p.id ? " on" : ""}`} onClick={() => setRunner(p.id)}>
                <Avatar style={p.style} />
                <span className="title one-line" style={{ flex: 1, textAlign: "left" }}>{handle(p.name)}{p.canTake ? "" : " · can't take jobs yet"}</span>
              </button>
            ))}
          </div>
          <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
            {MARKETPLACE.hire.cuts.map((c) => <button key={c} className="chip chip-sm" aria-pressed={cut === c} onClick={() => setCut(c)}>{formatCash(c)}</button>)}
          </div>
          <p className="meta" style={{ margin: 0 }}>{cutLine(cut)}. They have {MARKETPLACE.hire.hours} hours to do it or say no.</p>
          <button className="btn btn-taxi" disabled={!job || !runner || working || busy} onClick={() => void post()}>Send it · {formatCash(cut)}</button>
          <button className="btn btn-ghost" onClick={() => setPosting(false)}>Never mind</button>
        </div>
      )}
      {hires.sent.map((h) => (
        <p key={h.id} className="meta" style={{ margin: 0 }}>
          {h.emoji} {h.title} · {handle(h.withName)} · {h.status === "offered" ? "on it, maybe" : h.status === "done"
            ? h.outcome === "bust" ? "busted" : h.outcome === "fizzle" ? "didn't come off" : `done${h.pay ? `, +${formatCash(h.pay)} for you` : ""}`
            : h.status === "declined" ? "passed, cut returned" : "ran out of time, cut returned"}
        </p>
      ))}
    </div>
  );
}

function HireCard({ h, disabled, declineOff, onRun, onDecline }: { h: UnderworldHire; disabled: boolean; declineOff: boolean; onRun: (option: string) => void; onDecline: () => void }) {
  const [sel, setSel] = useState<string | null>(null);
  return (
    <div className="card stack-12 backroom-job">
      <p className="title" style={{ margin: 0 }}><span aria-hidden="true">{h.emoji}</span> {h.title}</p>
      <p className="meta" style={{ margin: 0 }}>For {handle(h.withName)} · {cutLine(h.cut)}. You do it, you wear it: the Heat, the fines, the holding. Their take is theirs.</p>
      <div className="choice-options" role="radiogroup" aria-label="How you do it">
        {(h.options ?? []).map((x) => (
          <button key={x.id} role="radio" aria-checked={sel === x.id} className="choice-opt" disabled={disabled} onClick={() => setSel(x.id)}>
            <span className="choice-opt-row"><span className="choice-opt-label">{x.label}</span><span className="meta">⚡ {x.energy}</span></span>
            {sel === x.id && <span className="choice-opt-more"><span><b>You get</b> {x.get}</span><span><b>It costs</b> {x.cost}</span></span>}
          </button>
        ))}
      </div>
      <div className="row" style={{ gap: 8 }}>
        <button className="btn btn-ghost" style={{ flex: 1 }} disabled={declineOff} onClick={onDecline}>No thanks</button>
        <button className="btn btn-taxi" style={{ flex: 1 }} disabled={disabled || !sel} onClick={() => sel && onRun(sel)}>Run it</button>
      </div>
    </div>
  );
}
