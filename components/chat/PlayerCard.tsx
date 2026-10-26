"use client";

import { useEffect, useRef, useState } from "react";
import { DAILY_LIMIT, REPORT_REASONS, chatTime, type ChatApi, type ReportReason, type ChatMessage, type ChatStatus, type PlayerCard } from "@/lib/chat";
import { REACTIONS, icebreakers } from "@/lib/meet";
import { placeById } from "@/lib/city";
import { messagesLeftLine } from "./Messages";
import { ECONOMY, formatCash, formatShort } from "@/lib/economy";
import { getStyle, type StyleId } from "@/lib/styles";
import { Sheet } from "../Sheet";
import { RankChip } from "../game/Ranks";
import { rankFor } from "@/lib/ranks";
import type { DatingApi } from "@/lib/dating";
import { CrushButton } from "../dating/Dating";
import { ratingLine } from "@/lib/together";
import { handle } from "@/lib/validation";
import { SKILLS, type SkillId } from "@/lib/skills";
import { recentLine, recentWhen } from "@/lib/recent";

/** C28: another player's profile card, opened from the leaderboard, with "Message". */
export function PlayerCardSheet({ playerId, api, onClose, onMessage, dating, onToast, placeName, hour = 20, onOutOfMessages }: {
  playerId: string | null; api: ChatApi; onClose: () => void;
  onMessage: (p: { id: string; name: string; style: string }) => void;
  /** v0.5: the crush button (C40) on people you're connected to. */
  dating?: { api: DatingApi; onCrushChange: () => void };
  onToast?: (text: string) => void;
  /** Meeting players (owner, Oct 15): the place's name for icebreakers, the city-clock hour, and the unlimited chat offer. */
  placeName?: (placeId: string) => string | undefined;
  hour?: number;
  onOutOfMessages?: () => void;
}) {
  const [card, setCard] = useState<PlayerCard | null | undefined>(undefined);
  const [status, setStatus] = useState<ChatStatus | null>(null);
  const [thread, setThread] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  // Skills (migration 0056): their top three, under the numbers.
  const [topSkills, setTopSkills] = useState<{ id: SkillId; level: number }[]>([]);
  // Block and Report right on the card (owner, Oct 15): a small confirm under the links.
  const [confirm, setConfirm] = useState<"block" | "report" | null>(null);
  const [reason, setReason] = useState<ReportReason>("harassment");
  const blockThem = async () => {
    if (!card) return;
    setBusy(true);
    const r = await api.block(card.id, true);
    setBusy(false);
    if (!r.ok) return onToast?.(r.error);
    onToast?.(`${handle(card.name)} is blocked. You won't see each other's messages.`);
    onClose();
  };
  const reportThem = async () => {
    if (!card) return;
    setBusy(true);
    const r = await api.report(card.id, null, reason, "");
    setBusy(false);
    if (!r.ok) return onToast?.(r.error);
    setConfirm(null);
    onToast?.("Thanks. Our review team will take a look.");
  };
  const toggle = async (on: boolean) => {
    if (!card || !dating) return;
    setBusy(true);
    const r = await dating.api.crush(card.id, on);
    setBusy(false);
    if (!r.ok) return onToast?.(r.error);
    setCard({ ...card, crush: r.data });
    onToast?.(!on ? "Crush taken back. Nobody ever knew." : r.data.matched ? "It's mutual 👀" : "Crush saved. They'll only find out if it's mutual.");
    dating.onCrushChange();
  };
  useEffect(() => {
    if (!playerId) return;
    setCard(undefined);
    setThread([]);
    setDraft("");
    void api.card(playerId).then((r) => setCard(r.ok ? r.data : null));
    void api.status().then((r) => setStatus(r.ok ? r.data : null));
    void api.thread(playerId).then((r) => setThread(r.ok && !r.data.blocked ? r.data.messages.slice(-6) : []));
    setTopSkills([]);
    void api.skills?.(playerId).then((r) => { if (r.ok) setTopSkills(r.data); });
  }, [playerId, api]);
  // Meeting players: react, break the ice, or say something, right on the card.
  const meet = !!card && !card.isMe && !card.blocked && card.canMessage !== undefined;
  const together = !!card && (!!card.herePlace || !!card.crew);
  const out = !!status && !status.unlimited && status.left <= 0;
  const send = async (body: string) => {
    if (out && onOutOfMessages) return onOutOfMessages();
    if (!card || !body.trim() || sending) return;
    setSending(true);
    const r = await api.send(card.id, body);
    setSending(false);
    if (!r.ok) return r.error === DAILY_LIMIT && onOutOfMessages ? onOutOfMessages() : onToast?.(r.error);
    setDraft("");
    setStatus((s) => (s ? { ...s, left: r.data.left ?? s.left } : s));
    setThread((t) => [...t, { id: Date.now(), mine: true, body: body.trim(), at: new Date().toISOString(), kind: "text" as const }].slice(-6));
  };
  const react = async (emoji: string) => {
    if (!card || !api.react || sending) return;
    setSending(true);
    const r = await api.react(card.id, emoji);
    setSending(false);
    if (!r.ok) return onToast?.(r.error);
    setThread((t) => [...t, r.data].slice(-6));
  };
  const ice = card ? icebreakers(card.herePlace ? placeName?.(card.herePlace) ?? null : null, hour, card.id.length + new Date().getDate(), !!card.herePlace && !!placeById(card.herePlace)?.tags.includes("campus")) : [];
  const style = card ? getStyle(card.style as StyleId) : null;
  const hood = card ? ECONOMY.homes.find((h) => h.id === card.homeId)?.neighborhood ?? "Queens" : "";
  return (
    <Sheet open={!!playerId} onClose={onClose} label="Player">
      {card === undefined ? (
        <p className="meta">Looking them up…</p>
      ) : card === null ? (
        <p className="body">That player isn&apos;t around anymore.</p>
      ) : (
        <div className="stack-16">
          <div className="row" style={{ gap: 12 }}>
            <span className="chat-avatar" style={{ width: 56, height: 56, fontSize: 26, border: "3px solid var(--taxi-400)" }} aria-hidden="true">{style?.emoji}</span>
            <span style={{ minWidth: 0 }}>
              <span className="display-md" style={{ display: "block" }}>{handle(card.name)}</span>
              <span className="meta" style={{ display: "block" }}>{style?.label} · {hood}</span>
              {/* Player ranks (owner, Oct 15): the higher of their clout or net worth. */}
              <span className="row" style={{ gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                <RankChip rank={rankFor(card.clout, card.netWorth ?? 0)} />
                {card.vipSince && <span className="tag tag-gold">👑 VIP</span>}
              </span>
              {card.partner && <span className="partner-line" style={{ marginTop: 6 }}>💞 Dating {handle(card.partner.name)}</span>}
              {card.sublet && <span className="partner-line" style={{ marginTop: 6, display: "flex" }}>{card.sublet.role === "sub" ? `🏠 Subletting from ${handle(card.sublet.name)}` : `🔑 Hosting ${handle(card.sublet.name)}`}</span>}
            </span>
          </div>
          {/* Meeting players: react, break the ice or say something, right under their name. */}
          {meet && card.herePlace && (
            <p className="meta here-with" style={{ margin: 0 }}><span className="dot-green" aria-hidden="true" /> Here with you at {placeName?.(card.herePlace) ?? "the same place"}</p>
          )}
          {meet && !card.canMessage && (
            <p className="meta" style={{ margin: 0 }}>{card.name} only takes messages from their crew.</p>
          )}
          {meet && card.canMessage && (
            <div className="meet stack-12">
              {thread.length > 0 && (
                <div className="meet-thread">
                  {thread.map((m) => (
                    <span key={m.id} className={`bubble${m.mine ? " mine" : ""}${m.kind === "reaction" ? " reaction" : ""}`}>
                      <span>{m.body}</span><span className="bubble-time">{chatTime(m.at)}</span>
                    </span>
                  ))}
                </div>
              )}
              {together && api.react && (
                <div className="stack-8">
                  <p className="overline" style={{ margin: 0 }}>React · free</p>
                  <div className="meet-reactions">
                    {REACTIONS.map((e) => (
                      <button key={e} className="meet-react" disabled={sending} onClick={() => void react(e)} aria-label={`React ${e}`}>{e}</button>
                    ))}
                  </div>
                </div>
              )}
              {thread.length === 0 && (
                <div className="stack-8">
                  <p className="overline" style={{ margin: 0 }}>Break the ice</p>
                  {ice.map((line) => (
                    <button key={line} className="meet-ice" onClick={() => { setDraft(line); input.current?.focus(); }}>💬 {line}</button>
                  ))}
                </div>
              )}
              <div className="chat-composer">
                <input
                  ref={input}
                  className="chat-input"
                  value={draft}
                  maxLength={500}
                  placeholder={out ? "Out of messages until midnight." : `Say something to ${card.name}`}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void send(draft); }}
                  aria-label={`Message ${card.name}`}
                />
                <button className="icon-round chat-send" disabled={sending || (!out && !draft.trim())} onClick={() => void send(draft)} aria-label="Send">↑</button>
              </div>
              <div className="row meet-foot">
                <span className={`meta${status && !status.unlimited && status.left <= 3 ? " low" : ""}`}>{messagesLeftLine(status)}</span>
                {out && onOutOfMessages
                  ? <button className="linkish" onClick={onOutOfMessages}>✨ Get unlimited chat</button>
                  : (
                    <span className="meet-links">
                      <button className="meet-link chat" onClick={() => onMessage({ id: card.id, name: card.name, style: card.style })}>Open chat</button>
                      <button className="meet-link block" onClick={() => setConfirm(confirm === "block" ? null : "block")} aria-expanded={confirm === "block"}>Block</button>
                      <button className="meet-link report" onClick={() => setConfirm(confirm === "report" ? null : "report")} aria-expanded={confirm === "report"}>Report</button>
                    </span>
                  )}
              </div>
              {confirm === "block" && (
                <div className="meet-confirm">
                  <span className="body">Block {handle(card.name)}? Neither of you can message the other, and they won&apos;t see you around.</span>
                  <span className="row" style={{ gap: 8 }}>
                    <button className="chip" onClick={() => setConfirm(null)}>Cancel</button>
                    <button className="chip meet-confirm-block" disabled={busy} onClick={() => void blockThem()}>Block</button>
                  </span>
                </div>
              )}
              {confirm === "report" && (
                <div className="meet-confirm">
                  <span className="body">What&apos;s wrong? Your chats with {handle(card.name)} go to our review team.</span>
                  <span className="chip-row" role="group" aria-label="Reason" style={{ flexWrap: "wrap" }}>
                    {REPORT_REASONS.map((r) => <button key={r.id} className="chip" aria-pressed={reason === r.id} onClick={() => setReason(r.id)}>{r.label}</button>)}
                  </span>
                  <span className="row" style={{ gap: 8 }}>
                    <button className="chip" onClick={() => setConfirm(null)}>Cancel</button>
                    <button className="chip meet-confirm-block" disabled={busy} onClick={() => void reportThem()}>Send report</button>
                  </span>
                </div>
              )}
            </div>
          )}
          <div className="profile-kpis">
            <span className="profile-kpi"><b>🔥 {formatShort(card.clout)}</b><span>Clout</span></span>
            <span className="profile-kpi"><b>{card.rank != null ? `#${card.rank.toLocaleString()}` : "—"}</b><span>In Queens</span></span>
            <span className="profile-kpi"><b>{card.netWorth != null ? formatCash(card.netWorth) : "—"}</b><span>Net worth</span></span>
          </div>
          {topSkills.length > 0 && (
            <div className="card-skills" aria-label="Top skills">
              {topSkills.map((k) => {
                const def = SKILLS.find((d) => d.id === k.id);
                return def ? <span key={k.id} className="card-skill">{def.emoji} {def.name} <b>{k.level}</b></span> : null;
              })}
            </div>
          )}
          <p className="meta" style={{ margin: 0 }}>
            🏅 {card.badges} {card.badges === 1 ? "badge" : "badges"} · In the city since {new Date(card.joined).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
            {card.vipSince && ` · VIP since ${new Date(card.vipSince).toLocaleDateString("en-US", { month: "short", year: "numeric" })}`}
            {card.jobs && card.jobs.hired > 0 && <><br />{ratingLine(card.jobs)} on the Jobs board</>}
          </p>
          {card.recent && card.recent.some((r) => recentLine(r)) && (
            <div className="stack-4">
              <p className="overline" style={{ margin: 0 }}>Recently</p>
              <div>
                {card.recent.map((r) => {
                  const line = recentLine(r);
                  return line && (
                    <div key={`${r.kind}:${r.ref}`} className="profile-recent">
                      <span aria-hidden="true">{line.emoji}</span><span>{line.text}</span><span>{recentWhen(r.at)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {dating && card.crush && !card.blocked && (card.crush.eligible || card.crush.crushed) && (
            <p className="meta" style={{ margin: 0 }}>
              {card.crush.matched ? `💗 Matched with ${card.name}` : card.crush.crushed ? "Crush saved" : "Tap the heart to mark a crush"} · {card.crush.count} of {card.crush.max} crushes. They only find out if it&apos;s mutual.
            </p>
          )}
          {card.isMe ? (
            <p className="meta" style={{ margin: 0 }}>That&apos;s you. Looking good.</p>
          ) : meet && card.canMessage ? (
            dating && card.crush && (card.crush.eligible || card.crush.crushed)
              ? <div className="row" style={{ gap: 10 }}><CrushButton status={card.crush} busy={busy} onToggle={(on) => void toggle(on)} showCount={false} /></div>
              : null
          ) : (
            <div className="row" style={{ gap: 10 }}>
              <button className="btn btn-taxi" style={{ flex: 1 }} onClick={() => onMessage({ id: card.id, name: card.name, style: card.style })}>
                {card.blocked ? "Blocked · open the chat" : `Message ${card.name}`}
              </button>
              {dating && card.crush && !card.blocked && <CrushButton status={card.crush} busy={busy} onToggle={(on) => void toggle(on)} showCount={false} />}
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}
