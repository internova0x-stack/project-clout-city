"use client";

import { useCallback, useEffect, useState } from "react";
import { TV, type StudioBigScreen, type StudioTvSubmission, type TvAction } from "@/lib/cloutTv";
import type { StudioApi } from "@/lib/studio";
import { handle } from "@/lib/validation";

// v0.14 Clout TV (migration 0058): the Big Screen queue. Photos are never approved on their own:
// approve into the rotation (one every 3 hours), show one now, reject, or take one down. Reject photos showing
// other people without consent, nudity, anyone who looks underage, hate symbols, or real brands as the
// main subject (owner, Oct 16).

const STATUS: Record<StudioTvSubmission["status"], { label: string; cls: string }> = {
  pending: { label: "Waiting", cls: "draft" },
  approved: { label: "In the rotation", cls: "approved" },
  featured: { label: "Has been on screen", cls: "approved" },
  rejected: { label: "Rejected", cls: "declined" },
  withdrawn: { label: "Withdrawn", cls: "declined" },
  taken_down: { label: "Taken down", cls: "declined" },
};
const TABS = [["pending", "To review"], ["approved", "Rotation"], ["featured", "On screen & past"], ["all", "All"]] as const;
const at = (iso: string) => new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export function BigScreenTab({ api }: { api: StudioApi }) {
  const [status, setStatus] = useState<(typeof TABS)[number][0]>("pending");
  const [board, setBoard] = useState<StudioBigScreen | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const load = useCallback(async () => {
    const r = await api.bigScreen!(status);
    if (r.ok) { setBoard(r.data); setError(null); } else setError(r.error);
  }, [api, status]);
  useEffect(() => { setBoard(null); void load(); }, [load]);
  const act = async (id: number, action: TvAction) => {
    if (action === "take_down" && !window.confirm("Take this photo off the big screen? The next one in the rotation goes up at once.")) return;
    setBusy(id);
    setError(null);
    const r = await api.bigScreenAction!(id, action);
    setBusy(null);
    if (!r.ok) return setError(r.error);
    void load();
  };
  const rows = board?.items ?? null;
  const onNow = rows?.find((s) => s.onNow);
  return (
    <section className="stack-12">
      <section className="studio-card stack-8">
        <h2 className="display-md" style={{ margin: 0 }}>📺 {TV.station}: the big screen</h2>
        <p className="meta" style={{ margin: 0 }}>
          Approve photos into the rotation: a new one goes up every 3 hours (12, 3, 6 and 9 o&apos;clock New York), oldest approval first,
          and its player gets a text from Clout TV. Show now puts any photo up at once. With nobody waiting, the last photo stays up.
          Reject photos showing other people without consent, nudity, anyone who looks underage, hate symbols, or real brands as the main subject.
        </p>
        {board && (
          <span className="meta">
            {onNow ? `On the screen now: ${handle(onNow.handle)}` : "Nothing on the screen yet"} · next slot {new Date(board.nextAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
            {" · "}{board.today} of {board.cap} photos sent today
          </span>
        )}
        <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
          {TABS.map(([id, label]) => <button key={id} className="chip" aria-pressed={status === id} onClick={() => setStatus(id)}>{label}</button>)}
        </div>
      </section>
      {error && <div className="studio-note error"><span className="body-strong">{error}</span></div>}
      {rows === null && !error && <p className="meta">Loading…</p>}
      {rows?.length === 0 && <section className="studio-card"><p className="subtext" style={{ margin: 0 }}>{status === "pending" ? "Nothing waiting. Queens is camera shy today." : status === "approved" ? "The rotation is empty: approve some photos, or the last one stays up." : "Nothing here yet."}</p></section>}
      <div className="tv-queue">
        {rows?.map((s, i) => (
          <article key={s.id} className={`studio-card stack-8 tv-queue-card${s.onNow ? " on-now" : ""}`}>
            <div className="tv-queue-photo">{s.url ? <img src={s.url} alt={`Photo from ${handle(s.handle)}`} /> : <span className="meta">Photo unavailable</span>}</div>
            <div className="row" style={{ justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
              <span className="title">{handle(s.handle)}</span>
              <span className={`tag studio-review ${s.onNow ? "approved" : STATUS[s.status].cls}`}>
                {s.onNow ? "On the screen now" : status === "approved" ? `Up next #${i + 1}` : STATUS[s.status].label}
              </span>
            </div>
            <span className="meta">From player {s.player.name} · sent {at(s.at)}{s.featuredAt ? ` · went up ${at(s.featuredAt)}` : ""}</span>
            <ul className="tv-confirms">
              <li>✔ Photo of them, or one they took · {at(s.confirmed.self)}</li>
              <li>✔ 18 or over · {at(s.confirmed.adult)}</li>
              <li>✔ OK to show publicly in the game · {at(s.confirmed.public)}</li>
            </ul>
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              {s.status === "pending" && <button className="btn btn-night btn-sm" disabled={busy !== null} onClick={() => void act(s.id, "approve")}>Approve</button>}
              {(s.status === "pending" || s.status === "approved" || (s.status === "featured" && !s.onNow)) && (
                <button className="btn btn-secondary btn-sm" disabled={busy !== null} onClick={() => void act(s.id, "show_now")}>Show now</button>
              )}
              {(s.status === "pending" || s.status === "approved") && <button className="btn btn-destructive btn-sm" disabled={busy !== null} onClick={() => void act(s.id, "reject")}>Reject</button>}
              {s.status === "featured" && <button className="btn btn-destructive btn-sm" disabled={busy !== null} onClick={() => void act(s.id, "take_down")}>Take down</button>}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
