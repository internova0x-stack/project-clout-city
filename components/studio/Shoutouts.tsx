"use client";

import { useCallback, useEffect, useState } from "react";
import { RADIO, localAirTime, type ShoutoutAction, type StudioShoutout, type StudioShoutoutDay } from "@/lib/radio";
import type { StudioApi } from "@/lib/studio";
import { handle } from "@/lib/validation";

// v0.14 Real Clout FM (migration 0057): the Shoutouts queue. A day's requests in the order they came
// in; pick one to air on "The Wake-Up Call" at 9 a.m. New York, up to five more for the wall, or reject.

const STATUS: Record<StudioShoutout["status"], { label: string; cls: string }> = {
  pending: { label: "Waiting", cls: "draft" },
  on_air: { label: "On air", cls: "approved" },
  wall: { label: "On the wall", cls: "approved" },
  not_picked: { label: "Not picked", cls: "declined" },
  rejected: { label: "Rejected", cls: "declined" },
};

const nyDay = (offset = 0) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date(Date.now() + offset * 86_400_000));
const fmtDay = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

export function ShoutoutsTab({ api }: { api: StudioApi }) {
  const [date, setDate] = useState(nyDay());
  const [day, setDay] = useState<StudioShoutoutDay | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const load = useCallback(async () => {
    const r = await api.shoutouts!(date);
    if (r.ok) { setDay(r.data); setError(null); } else setError(r.error);
  }, [api, date]);
  useEffect(() => { setDay(null); void load(); }, [load]);
  const act = async (id: number, action: ShoutoutAction) => {
    setBusy(id);
    setError(null);
    const r = await api.shoutoutAction!(id, action);
    setBusy(null);
    if (r.ok) setDay(r.data); else setError(r.error);
  };
  const today = date === nyDay();
  const past = date < nyDay();
  const onWall = day?.items.filter((s) => s.status === "wall").length ?? 0;
  const onAir = day?.items.find((s) => s.status === "on_air");
  return (
    <section className="stack-12">
      <section className="studio-card stack-8">
        <div className="row" style={{ justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          <div className="stack-4">
            <h2 className="display-md" style={{ margin: 0 }}>📻 {RADIO.station}: {RADIO.show}</h2>
            <p className="meta" style={{ margin: 0 }}>
              Pick one shoutout for {RADIO.host} to read at 9:00 a.m. New York{day ? ` (${localAirTime(day.airsAt)} your time)` : ""}, and up to {day?.wallMax ?? 5} more for the wall.
              Nothing airs until you pick it. Requests nobody picks read “Not today” when the day ends.
            </p>
          </div>
          <div className="row" style={{ gap: 6 }}>
            <button className="chip" aria-pressed={date === nyDay(-1)} onClick={() => setDate(nyDay(-1))}>Yesterday</button>
            <button className="chip" aria-pressed={today} onClick={() => setDate(nyDay())}>Today</button>
          </div>
        </div>
        {day && (
          <span className="meta">
            {fmtDay(day.date)} · {day.items.length} of {day.cap} requests · {onAir ? `on air: ${handle(onAir.handle)}` : "nothing picked to air"} · {onWall} of {day.wallMax} on the wall
          </span>
        )}
      </section>
      {error && <div className="studio-note error"><span className="body-strong">{error}</span></div>}
      {day === null && !error && <p className="meta">Loading…</p>}
      {day?.items.length === 0 && <section className="studio-card"><p className="subtext" style={{ margin: 0 }}>No requests {today ? "yet today. The phones are quiet." : "that day."}</p></section>}
      {day?.items.map((s) => (
        <article key={s.id} className="studio-card stack-8">
          <div className="row" style={{ justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
            <span className="title">{handle(s.handle)}</span>
            <span className={`tag studio-review ${STATUS[s.status].cls}`}>{STATUS[s.status].label}</span>
          </div>
          <span className="body">“{s.message}”</span>
          <span className="meta">From player {s.player.name} · asked {new Date(s.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
            {s.status === "on_air" && s.airedAt ? ` · airs ${new Date(s.airedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : ""}</span>
          {!past && (
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              {s.status !== "on_air" && <button className="btn btn-night btn-sm" disabled={busy !== null} onClick={() => void act(s.id, "air")}>{onAir ? "Air this instead" : "Pick to air"}</button>}
              {s.status !== "wall" && <button className="btn btn-secondary btn-sm" disabled={busy !== null || onWall >= (day?.wallMax ?? 5)} onClick={() => void act(s.id, "wall")}>Add to the wall</button>}
              {(s.status === "on_air" || s.status === "wall" || s.status === "rejected") && <button className="btn btn-secondary btn-sm" disabled={busy !== null} onClick={() => void act(s.id, "pending")}>Undo</button>}
              {s.status !== "rejected" && <button className="btn btn-destructive btn-sm" disabled={busy !== null} onClick={() => void act(s.id, "reject")}>Reject</button>}
            </div>
          )}
        </article>
      ))}
    </section>
  );
}
