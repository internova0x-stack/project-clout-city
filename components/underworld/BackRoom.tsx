"use client";

import { useCallback, useEffect, useState } from "react";
import { Sheet } from "@/components/Sheet";
import { UNDERWORLD, type OfferView, type UnderworldApi, type UnderworldScreen, type UnderworldView } from "@/lib/underworld";

// The underworld (spec section 31; migration 0148): Pablo's back room, behind the luggage counter. Before the invitation:
// a closed door and a hint. After: Pablo's line, Street Rep and its tier, Heat (how close the 114½ is), today's three jobs
// (You get / It costs, like every card), Whitlock & Hale's retainer, and what came back. The server decides everything;
// this only asks.

const cs = (n: number) => `C$${n.toLocaleString("en-US")}`;
const HEAT: Record<UnderworldView["heatBand"], { label: string; line: string }> = {
  cool: { label: "Cool", line: "Nobody at the 114½ knows your name." },
  warm: { label: "Warm", line: "Sgt. Bev has heard your name once. She wrote it down." },
  watched: { label: "Watched", line: "The 114½ is watching. Every job is riskier now." },
  glowing: { label: "Glowing", line: "You glow. Pablo won't work with you until you cool off." },
};

export function BackRoomSheet({ open, onClose, api, onToast, onGo, onChanged }: {
  open: boolean;
  onClose: () => void;
  api: UnderworldApi;
  onToast: (text: string) => void;
  /** Takes the player to Pablo's (the map, its card). */
  onGo: () => void;
  /** Cash, Energy, Mood or the player's place changed: the game refreshes its numbers. */
  onChanged: () => void;
}) {
  const [data, setData] = useState<UnderworldScreen | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<{ text: string; outcome?: UnderworldScreen["outcome"] } | null>(null);

  const run = useCallback(async (p: ReturnType<UnderworldApi["screen"]>) => {
    setBusy(true);
    const r = await p;
    setBusy(false);
    if (!r.ok) { setError(r.error); onToast(r.error); return null; }
    setError(null);
    setData(r.data);
    return r.data;
  }, [onToast]);

  useEffect(() => { if (open) { setLast(null); void run(api.screen()); } }, [open, api, run]);

  const v = data?.view ?? null;
  const seen = async () => { await run(api.seen()); };
  return (
    <Sheet open={open} onClose={onClose} label="Pablo's back room" tall>
      <div className="backroom stack-16">
        {!v && !error && <p className="meta">Knocking on the back door…</p>}
        {!v && error && <p className="error-text">{error}</p>}
        {v && !v.invited && (
          <div className="backroom-poster stack-8">
            <p className="overline">🧳 Pablo&apos;s Luggage &amp; Notary</p>
            <h2 className="display-lg" style={{ margin: 0 }}>The back door is shut</h2>
            <p className="subtext" style={{ margin: 0 }}>{v.hint}</p>
          </div>
        )}
        {v?.invited && v.intro && (
          <div className="backroom-poster stack-8">
            <p className="overline">🧳 The back room</p>
            <h2 className="display-lg" style={{ margin: 0 }}>Pablo will see you now</h2>
            {v.intro.map((l) => <p key={l} className="subtext" style={{ margin: 0 }}>{l}</p>)}
            <button className="btn btn-taxi" disabled={busy} onClick={seen}>Pull up a chair</button>
          </div>
        )}
        {v?.invited && !v.intro && (
          <>
            <div className="backroom-poster stack-8">
              <p className="overline">🧳 Pablo · the back room</p>
              <p className="subtext backroom-quote" style={{ margin: 0 }}>{v.greet}</p>
            </div>
            {v.landed.length > 0 && (
              <div className="card stack-8 backroom-landed">
                <p className="title" style={{ margin: 0 }}>🚨 It came back</p>
                {v.landed.map((l) => <p key={l.id} className="subtext" style={{ margin: 0 }}>{l.text}</p>)}
                <button className="btn btn-secondary" disabled={busy} onClick={seen}>Got it</button>
              </div>
            )}
            {last && (
              <div className={`card stack-4 backroom-receipt ${last.outcome ?? ""}`} role="status">
                <p className="title" style={{ margin: 0 }}>{last.outcome === "bust" ? "🚓 Busted" : last.outcome === "fizzle" ? "🤷 It didn't come off" : "💸 Done"}</p>
                <p className="subtext" style={{ margin: 0 }}>{last.text}</p>
              </div>
            )}
            <Meters v={v} />
            {v.crew.length > 0 && (
              <div className="stack-8">
                <p className="overline" style={{ margin: 0 }}>Pablo&apos;s crew</p>
                <div className="backroom-crew">
                  {v.crew.map((m) => {
                    const status = m.covers ? { icon: "🫡", text: "Has your back" } : m.loyalty >= UNDERWORLD.crew.payAt ? { icon: "💸", text: "Pays extra" } : { icon: "🤝", text: "Warming up" };
                    return (
                      <div key={m.id} className="card backroom-crewcard">
                        <span className="backroom-crew-emoji" aria-hidden="true">{m.emoji}</span>
                        <span className="backroom-crew-name">{m.name}</span>
                        <span className="backroom-crew-role">{m.role}</span>
                        <span className="careers-bar green" role="meter" aria-label={`${m.name}'s loyalty`} aria-valuenow={m.loyalty} aria-valuemin={0} aria-valuemax={100}>
                          <span style={{ width: `${m.loyalty}%` }} />
                        </span>
                        <span className="backroom-crew-status">{status.icon} {status.text}</span>
                      </div>
                    );
                  })}
                </div>
                <p className="meta" style={{ margin: 0 }}>
                  Do their jobs to win them over. At {UNDERWORLD.crew.payAt}, their jobs pay more. At {UNDERWORLD.crew.coverAt}, they take the fall for you once a week.
                </p>
              </div>
            )}
            {v.holding && <p className="card meta" style={{ margin: 0 }}>🚓 You&apos;re in holding at the 114½. Bail out from the precinct, or wait it out.</p>}
            {!v.here && !v.holding && (
              <div className="card stack-8">
                <p className="subtext" style={{ margin: 0 }}>Pablo only talks business in the back room, on 31st St.</p>
                <button className="btn btn-taxi" onClick={() => { onClose(); onGo(); }}>🧳 Go to Pablo&apos;s</button>
              </div>
            )}
            <div className="stack-12">
              <p className="overline" style={{ margin: 0 }}>Today&apos;s work</p>
              {v.offers.map((o) => (
                <Offer key={o.id} o={o} busy={busy} disabled={!v.here || v.holding || v.tooHot}
                  onDo={async (opt) => {
                    const r = await run(api.job(o.id, opt));
                    if (r?.receipt) { setLast({ text: r.receipt, outcome: r.outcome }); onChanged(); }
                  }} />
              ))}
              <p className="meta" style={{ margin: 0 }}>New work every New York day. A day without a job cools you off twice as fast.</p>
            </div>
            {v.table && (
              <div className="card stack-8 backroom-table">
                <p className="title" style={{ margin: 0 }}>🃏 {v.table.title}</p>
                <p className="subtext" style={{ margin: 0 }}>{v.table.blurb}</p>
                {v.table.open && (v.table.done
                  ? <p className="meta" style={{ margin: 0 }}>✔️ You sat in this week. Next week&apos;s chair is yours.</p>
                  : <button className="btn btn-taxi" disabled={busy || !v.here || v.holding || v.tooHot} onClick={async () => {
                      const r = await run(api.table());
                      if (r?.receipt) { setLast({ text: r.receipt, outcome: "win" }); onChanged(); }
                    }}>Pull up a chair · ⚡ {UNDERWORLD.table.energy}</button>)}
              </div>
            )}
            <div className="card stack-8">
              <p className="title" style={{ margin: 0 }}>⚖️ Whitlock &amp; Hale LLP</p>
              {v.lawyer.free ? <p className="subtext" style={{ margin: 0 }}>You work at Whitlock &amp; Hale. You are the lawyer. Fines halved, an hour less in holding.</p>
                : v.lawyer.on ? <p className="subtext" style={{ margin: 0 }}>On retainer until {v.lawyer.until}: fines halved, an hour less in holding.</p>
                : (
                  <>
                    <p className="subtext" style={{ margin: 0 }}>&quot;We never ask what you did. We bill for not asking.&quot; A week&apos;s retainer halves any fine and takes an hour off holding.</p>
                    <button className="btn btn-secondary" disabled={busy} onClick={async () => { if (await run(api.lawyer())) { onToast(`⚖️ Whitlock & Hale has you on retainer for a week. ${cs(v.lawyer.cost)}.`); onChanged(); } }}>
                      Put them on retainer · {cs(v.lawyer.cost)}
                    </button>
                  </>
                )}
            </div>
            {v.receipts.length > 0 && (
              <div className="stack-4">
                <p className="overline" style={{ margin: 0 }}>Lately</p>
                {v.receipts.map((r, i) => <p key={i} className="meta" style={{ margin: 0 }}>{r}</p>)}
              </div>
            )}
            <p className="meta" style={{ margin: 0 }}>{v.stats.jobs} jobs · {v.stats.busts} times caught · {cs(v.stats.earned)} earned. No violence, nothing real, and the police are the 114½.</p>
          </>
        )}
      </div>
    </Sheet>
  );
}

function Meters({ v }: { v: UnderworldView }) {
  const span = v.next ? v.next.at - UNDERWORLD.tiers.filter((t) => t.at <= v.rep).slice(-1)[0].at : 1;
  const into = v.next ? v.rep - (v.next.at - span) : 1;
  return (
    <div className="card stack-12">
      <div className="careers-meter">
        <span className="careers-meter-label">{v.tier.emoji} Street Rep</span>
        <span className="careers-bar green"><span style={{ width: `${Math.round((into / span) * 100)}%` }} /></span>
        <span className="careers-meter-n">{v.rep}</span>
      </div>
      <p className="meta" style={{ margin: 0 }}><b>{v.tier.name}</b>{v.next ? ` · ${v.next.at - v.rep} more to ${v.next.name}: bigger jobs, bigger money.` : " · the top. Everybody on 30th Avenue knows."}</p>
      <div className="careers-meter">
        <span className="careers-meter-label">🚨 Heat</span>
        <span className={`careers-bar ${v.heat >= UNDERWORLD.heat.watched ? "red" : ""}`}><span style={{ width: `${v.heat}%` }} /></span>
        <span className="careers-meter-n">{v.heat}</span>
      </div>
      <p className="meta" style={{ margin: 0 }}><b>{HEAT[v.heatBand].label}</b> · {HEAT[v.heatBand].line}</p>
    </div>
  );
}

function Offer({ o, busy, disabled, onDo }: { o: OfferView; busy: boolean; disabled: boolean; onDo: (option: string) => void }) {
  const [sel, setSel] = useState<string | null>(null);
  return (
    <div className={`card stack-12 backroom-job${o.done ? " done" : ""}`}>
      <p className="title" style={{ margin: 0 }}><span aria-hidden="true">{o.emoji}</span> {o.title}</p>
      {o.crew && <p className="meta" style={{ margin: 0 }}>{o.crew.emoji} {o.crew.name}&apos;s job</p>}
      {o.done ? <p className="meta" style={{ margin: 0 }}>✔️ Done for today.</p> : (
        <>
          <div className="choice-options" role="radiogroup" aria-label="How you do it">
            {o.options.map((x) => (
              <button key={x.id} role="radio" aria-checked={sel === x.id} className="choice-opt" disabled={busy || disabled} onClick={() => setSel(x.id)}>
                <span className="choice-opt-row"><span className="choice-opt-label">{x.label}</span><span className="meta">⚡ {x.energy}</span></span>
                {sel === x.id && <span className="choice-opt-more"><span><b>You get</b> {x.get}</span><span><b>It costs</b> {x.cost}</span></span>}
              </button>
            ))}
          </div>
          <button className="btn btn-taxi" disabled={busy || disabled || !sel} onClick={() => sel && onDo(sel)}>Do it</button>
        </>
      )}
    </div>
  );
}
