"use client";

// Studio Players (owner, Oct 15; migration 0055): every player who signed up, their profile and activity,
// and ban or unban. Message texts never show here (only how many were sent); reported chats are in Reports.

import { useEffect, useState } from "react";
import { PLAYER_FILTERS, PLAYER_SORTS, changesLine, homeName, timelineLine, type PlayerFilter, type PlayerList, type PlayerProfile, type PlayerSort } from "@/lib/adminPlayers";
import { duration } from "@/lib/insights";
import { RANKS } from "@/lib/ranks";
import { recentWhen } from "@/lib/recent";
import { formatPrice } from "@/lib/store";
import { getStyle, type StyleId } from "@/lib/styles";
import type { StudioApi } from "@/lib/studio";

const n = (x: number) => x.toLocaleString("en-US");
const cash = (x: number) => `C$${n(x)}`;
const day = (at: string | null) => (at ? new Date(at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "–");
const when = (at: string | null) => (at ? recentWhen(at) : "never");
const face = (style: string) => getStyle(style as StyleId).emoji;
const rankOf = (level: number) => RANKS[Math.max(0, Math.min(RANKS.length - 1, level - 1))];

export function PlayersTab({ api }: { api: StudioApi }) {
  const [query, setQuery] = useState("");
  const [typed, setTyped] = useState("");
  const [filter, setFilter] = useState<PlayerFilter>("all");
  const [sort, setSort] = useState<PlayerSort>("joined");
  const [list, setList] = useState<PlayerList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  // Search as you type, a beat after the last key.
  useEffect(() => { const t = setTimeout(() => setQuery(typed.trim()), 300); return () => clearTimeout(t); }, [typed]);
  useEffect(() => {
    let stop = false;
    setError(null);
    void api.players!(query, filter, sort, 0).then((r) => { if (!stop) { if (r.ok) setList(r.data); else setError(r.error); } });
    return () => { stop = true; };
  }, [api, query, filter, sort, nonce]);
  const more = async () => {
    if (!list) return;
    const r = await api.players!(query, filter, sort, list.rows.length);
    if (r.ok) setList({ total: r.data.total, rows: [...list.rows, ...r.data.rows] });
  };

  if (open) return <PlayerPage api={api} id={open} onBack={() => { setOpen(null); setNonce((x) => x + 1); }} />;
  return (
    <section className="stack-16">
      <div className="players-bar">
        <input className="studio-input" type="search" placeholder="Search @handle or email" value={typed} onChange={(e) => setTyped(e.target.value)} aria-label="Search players" />
        <select className="studio-input players-sort" value={sort} onChange={(e) => setSort(e.target.value as PlayerSort)} aria-label="Sort by">
          {PLAYER_SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </div>
      <div className="row" style={{ gap: 6, flexWrap: "wrap" }} role="group" aria-label="Show">
        {PLAYER_FILTERS.map((f) => <button key={f.id} className="chip" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>{f.label}</button>)}
      </div>
      {error && <div className="studio-note error"><span className="body-strong">{error}</span></div>}
      {!list && !error && <p className="meta">Loading…</p>}
      {list && (
        <div className="studio-card players-list">
          <p className="meta" style={{ margin: "0 0 4px" }}>{n(list.total)} player{list.total === 1 ? "" : "s"}</p>
          {list.rows.length === 0 && <p className="meta" style={{ margin: 0 }}>Nobody matches that.</p>}
          {list.rows.map((p) => {
            const r = rankOf(p.rank);
            return (
              <button key={p.id} className="players-row" onClick={() => setOpen(p.id)}>
                <span className="players-face" aria-hidden="true">{face(p.style)}</span>
                <span className="players-who">
                  <span className="body-strong one-line">@{p.name}</span>
                  <span className="meta one-line">{p.email ?? "no email"}</span>
                  <span className="players-tags">
                    {p.vip && <span className="players-tag vip">👑 VIP</span>}
                    {p.spendCents > 0 && <span className="players-tag paying">{formatPrice(p.spendCents)}</span>}
                    {!p.movedIn && <span className="players-tag">No home yet</span>}
                    {p.openReports > 0 && <span className="players-tag flag">🚩 {p.openReports}</span>}
                    {p.banned && <span className="players-tag banned">Banned</span>}
                  </span>
                </span>
                <span className="players-nums">
                  <span className="body-strong tabular">{r?.emoji} {n(p.clout)}</span>
                  <span className="meta tabular">{cash(p.netWorth)}</span>
                  <span className="meta">seen {when(p.lastSeen)}</span>
                </span>
              </button>
            );
          })}
          {list.rows.length < list.total && <button className="chip" style={{ alignSelf: "center", marginTop: 8 }} onClick={() => void more()}>Show more</button>}
        </div>
      )}
    </section>
  );
}

function PlayerPage({ api, id, onBack }: { api: StudioApi; id: string; onBack: () => void }) {
  const [data, setData] = useState<PlayerProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    let stop = false;
    void api.player!(id).then((r) => { if (!stop) { if (r.ok) setData(r.data); else setError(r.error); } });
    return () => { stop = true; };
  }, [api, id, nonce]);
  const act = async (ban: boolean) => {
    setBusy(true);
    const r = await api.playerBan!(id, ban, reason);
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setConfirm(false);
    setReason("");
    setNonce((x) => x + 1);
  };
  if (error && !data) return <div className="stack-12"><button className="chip" onClick={onBack}>‹ All players</button><div className="studio-note error"><span className="body-strong">{error}</span></div></div>;
  if (!data) return <p className="meta">Loading…</p>;
  const { profile: p, numbers: k, safety, timeline, sessions } = data;
  const r = rankOf(p.rank);
  const tiles: [string, string, string?][] = [
    ["Clout", n(k.clout), r ? `${r.emoji} ${r.title}` : undefined],
    ["Cash", cash(k.cash), `net worth ${cash(k.netWorth)}`],
    ["Spent", formatPrice(k.spendCents), `${n(k.purchases)} purchase${k.purchases === 1 ? "" : "s"}`],
    ["Time played", duration(k.secondsPlayed), `${n(k.sessions)} sessions · ${n(k.daysActive)} days`],
    ["Messages sent", n(k.messagesSent), "texts stay private"],
    ["Around the city", `${n(k.placesVisited)} places`, `${n(k.businesses)} business${k.businesses === 1 ? "" : "es"}`],
  ];
  const facts: [string, React.ReactNode][] = [
    ["Email", p.email ?? "–"],
    ["Style", getStyle(p.style as StyleId).label],
    ["Traits", p.traits?.length ? p.traits.join(", ") : "–"],
    ["Home", p.houseSku ? "Owns a house" : homeName(p.homeId) ?? "Not moved in"],
    ["Car", p.carSku ? `${p.carSku} (${p.carMode ?? "owned"})` : "–"],
    ["Birth lottery", p.birthCash != null ? cash(p.birthCash) : "–"],
    ["Joined", day(p.joinedAt)],
    ["Moved in", day(p.movedInAt)],
    ["First party", day(p.firstPartyAt)],
    ["Last seen", when(p.lastSeen)],
    ["Invited by", p.invitedBy ? `@${p.invitedBy.name}` : "–"],
    ["Invited", `${n(p.invitedCount)} friend${p.invitedCount === 1 ? "" : "s"} · crew of ${n(p.crewSize)} · code ${p.inviteCode}`],
    ["VIP", p.vip ? `Since ${day(p.vipSince)}` : p.chatForever ? "Chat forever" : "No"],
    ["Stats", `Energy ${k.energy} · Mood ${k.mood} · Confidence ${k.confidence}`],
  ];
  return (
    <section className="stack-16">
      <button className="chip" style={{ alignSelf: "flex-start" }} onClick={onBack}>‹ All players</button>
      <div className="studio-card player-head">
        <span className="players-face big" aria-hidden="true">{face(p.style)}</span>
        <div className="stack-4" style={{ flex: 1, minWidth: 0 }}>
          <h2 className="display-md" style={{ margin: 0 }}>@{p.name}</h2>
          <span className="meta">{r?.emoji} {r?.title} · joined {day(p.joinedAt)} · seen {when(p.lastSeen)}</span>
          <span className="players-tags">
            {p.admin && <span className="players-tag">Studio admin</span>}
            {p.vip && <span className="players-tag vip">👑 VIP</span>}
            {p.banned && <span className="players-tag banned">Banned {day(p.bannedAt)}{p.banReason ? ` · ${p.banReason}` : ""}</span>}
            {p.mutedUntil && new Date(p.mutedUntil) > new Date() && <span className="players-tag flag">Muted until {day(p.mutedUntil)}</span>}
          </span>
        </div>
        {!p.admin && !confirm && (
          p.banned
            ? <button className="chip player-unban" onClick={() => setConfirm(true)}>Unban</button>
            : <button className="chip player-ban" onClick={() => setConfirm(true)}>Ban</button>
        )}
      </div>
      {confirm && (
        <div className="studio-card stack-8">
          <span className="body-strong">{p.banned ? `Unban @${p.name}?` : `Ban @${p.name}?`}</span>
          <span className="meta">{p.banned ? "They can play and chat again right away." : "They'll see a suspended screen next time they open the game, and can't chat or be seen."}</span>
          <textarea className="studio-input" rows={2} maxLength={300} placeholder={p.banned ? "Why (optional)" : "Reason (kept in the log)"} value={reason} onChange={(e) => setReason(e.target.value)} />
          <span className="row" style={{ gap: 8 }}>
            <button className="chip" onClick={() => { setConfirm(false); setReason(""); }}>Cancel</button>
            <button className={`chip ${p.banned ? "player-unban" : "player-ban"}`} disabled={busy} onClick={() => void act(!p.banned)}>{busy ? "…" : p.banned ? "Unban" : "Ban"}</button>
          </span>
          {error && <span className="meta" style={{ color: "var(--red-text)" }}>{error}</span>}
        </div>
      )}

      <div className="studio-tiles">
        {tiles.map(([label, value, sub]) => (
          <div key={label} className="studio-card studio-tile">
            <span className="overline">{label}</span>
            <span className="display-lg tabular">{value}</span>
            {sub && <span className="meta">{sub}</span>}
          </div>
        ))}
      </div>

      <div className="insights-two">
        <div className="studio-card stack-8">
          <span className="overline">Activity</span>
          {timeline.length === 0 && <p className="meta" style={{ margin: 0 }}>Nothing yet.</p>}
          <div className="player-timeline">
            {timeline.map((e, i) => {
              const line = timelineLine(e);
              const change = changesLine(e);
              return (
                <div key={i} className="player-event">
                  <span className="player-event-emoji" aria-hidden="true">{line.emoji}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span className="body" style={{ display: "block" }}>{line.text}{line.detail ? <span className="meta"> · {line.detail}</span> : null}</span>
                    {change && <span className={`meta tabular${(e.cash ?? 0) < 0 ? " neg" : ""}`}>{change}</span>}
                  </span>
                  <span className="meta tabular" title={new Date(e.at).toLocaleString("en-US")}>{recentWhen(e.at)}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="stack-12">
          <div className="studio-card stack-8">
            <span className="overline">Profile</span>
            <dl className="player-facts">
              {facts.map(([k2, v]) => (<div key={k2}><dt>{k2}</dt><dd>{v}</dd></div>))}
            </dl>
          </div>
          <div className="studio-card stack-8">
            <span className="overline">Safety</span>
            <span className="meta">{safety.reportsAgainst.length} report{safety.reportsAgainst.length === 1 ? "" : "s"} about them · {safety.reportsMade} made · blocked {safety.blocked} · blocked by {safety.blockedBy}</span>
            {safety.reportsAgainst.map((x) => (
              <div key={x.id} className="ledger-row" style={{ padding: "4px 0" }}>
                <span className="body">🚩 {x.reason} {x.by ? <span className="meta">by @{x.by}</span> : null}</span>
                <span className="meta">{x.status} · {recentWhen(x.at)}</span>
              </div>
            ))}
            {safety.actions.map((a, i) => (
              <div key={i} className="ledger-row" style={{ padding: "4px 0" }}>
                <span className="body">{a.action === "ban" ? "⛔ Banned" : "🔓 Unbanned"}{a.reason ? <span className="meta"> · {a.reason}</span> : null}</span>
                <span className="meta">{a.by ? `@${a.by} · ` : ""}{recentWhen(a.at)}</span>
              </div>
            ))}
            <p className="meta" style={{ margin: 0 }}>Chat texts stay private. Reported conversations are in Reports.</p>
          </div>
          <div className="studio-card stack-8">
            <span className="overline">Recent sessions</span>
            {sessions.length === 0 && <p className="meta" style={{ margin: 0 }}>None recorded yet (sessions count from migration 0053).</p>}
            {sessions.map((s) => (
              <div key={s.startedAt} className="ledger-row" style={{ padding: "4px 0" }}>
                <span className="body">{new Date(s.startedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                <span className="body-strong tabular">{duration(s.seconds)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
