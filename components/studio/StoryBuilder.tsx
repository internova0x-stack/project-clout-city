"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { PLACES, SHOP_ITEMS, placeById } from "@/lib/city";
import { BOROUGHS } from "@/lib/map/boroughs";
import type { Arc, Beat, Phase, StoryEffect, StoryEvent, StoryTask } from "@/lib/stories";
import { validateArcs } from "@/lib/storyValidation";
import {
  CHATTER_ROLES, EVIDENCE_KINDS, PHASES, SIDE_KINDS, WEEKDAYS, arcIdFrom, beatPrefix, cleanArc, newEffect, newPrediction, nextBeat,
  optionId, ownProblems, sideSku, slugify, taskSlug,
} from "@/lib/storyBuilder";
import type { StudioApi, StudioArc, StudioResult } from "@/lib/studio";
import { StoryPreview, describeEffect } from "./StoryPreview";

// The story builder (owner, Oct 17): write a story in the Studio instead of a JSON file. Basics, beats (news,
// evidence, a prediction, city changes) and extras (tasks, events, badges, chatter). It checks as you type with
// the same rules as an uploaded file, keeps a draft on this device, and saves through the same upload, so a new
// or changed story waits for review like any other.

const PLACE_LIST = [...PLACES].sort((a, b) => a.name.localeCompare(b.name));
const PLACE_TAGS = [...new Set(PLACES.flatMap((p) => p.tags))].sort();
const SHOP = [...SHOP_ITEMS].sort((a, b) => a.name.localeCompare(b.name));
const EFFECT_LABEL: Record<string, string> = {
  price_multiplier: "Price change", availability: "Close or restrict", place_state: "Place: event, action or note",
  task_injection: "Story tasks today", chatter_topic: "What people talk about", flag: "Story flag",
};
const ROLE_HINT: Record<string, string> = { bartender: "bars, clubs, lounges", barista: "cafés", doorman: "buildings", driver: "rides", clerk: "shops and delis" };
const DRAFT_PREFIX = "cc-studio-draft:";

/** A draft kept on this device, by key ("new" for a story not saved yet). */
export function loadDraft(key: string): { arc: Arc; at: number } | null {
  try {
    const raw = localStorage.getItem(DRAFT_PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function saveDraft(key: string, arc: Arc) {
  try { localStorage.setItem(DRAFT_PREFIX + key, JSON.stringify({ arc, at: Date.now() })); } catch { /* storage off: nothing kept */ }
}
export function clearDraft(key: string) {
  try { localStorage.removeItem(DRAFT_PREFIX + key); } catch { /* nothing to clear */ }
}

type Update = (f: (a: Arc) => void) => void;

export function StoryBuilder({ initial, isNew, arcs, api, busy, checksHost, onSave, onClose }: {
  initial: Arc; isNew: boolean; arcs: StudioArc[]; api: StudioApi; busy: string | null; checksHost: HTMLElement | null;
  onSave: (json: string, id: string) => Promise<StudioResult | void>; onClose: () => void;
}) {
  const [draft, setDraft] = useState<Arc>(initial);
  const [idTouched, setIdTouched] = useState(!isNew);
  const [openBeat, setOpenBeat] = useState<number | null>(initial.beats.length ? null : 0);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [preview, setPreview] = useState(false);
  const [support, setSupport] = useState<Arc[]>([]);
  const draftKey = isNew ? "new" : initial.id;

  const update: Update = (f) => setDraft((a) => { const x = structuredClone(a); f(x); if (isNew && !idTouched) x.id = arcIdFrom(x.title); return x; });

  // Keep the draft on this device as it changes.
  useEffect(() => {
    const t = setTimeout(() => { saveDraft(draftKey, draft); setSavedAt(Date.now()); }, 600);
    return () => clearTimeout(t);
  }, [draft, draftKey]);

  // A side story is checked with its main story (and the main story's other sides).
  const parentId = draft.type === "side" ? draft.parent_arc_id ?? "" : draft.id;
  useEffect(() => {
    let gone = false;
    if (!parentId || !arcs.some((a) => a.id === parentId)) { setSupport([]); return; }
    api.content(parentId).then((r) => { if (!gone && r.ok) setSupport(r.arcs); });
    return () => { gone = true; };
  }, [parentId, api, arcs]);

  const clean = useMemo(() => cleanArc(draft), [draft]);
  const problems = useMemo(() => {
    if (!clean.id) return ["Give the story a title."];
    try {
      return ownProblems(validateArcs([...support.filter((a) => a.id !== clean.id), clean]), clean.id);
    } catch (e) {
      return [`The checker couldn't read this draft: ${(e as Error).message}`];
    }
  }, [clean, support]);
  const previewContent = useMemo(() => (clean.type === "main" ? [clean, ...support.filter((a) => a.type === "side" && a.id !== clean.id)] : [...support.filter((a) => a.id !== clean.id), clean]), [clean, support]);
  const previewMain = previewContent.find((a) => a.type === "main");
  const sorted = [...draft.beats].map((b, i) => ({ b, i })).sort((x, y) => x.b.day - y.b.day);
  const lastBeatDay = Math.max(0, ...draft.beats.map((b) => b.day));

  const download = () => {
    const blob = new Blob([JSON.stringify(clean, null, 2) + "\n"], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${clean.id || "story"}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const checks = (
    <div className="studio-card stack-8 builder-checks">
      <span className="overline">Checks</span>
      {problems.length === 0
        ? <span className="builder-check ok">✓ Everything checks out. Ready to save for review.</span>
        : problems.slice(0, 12).map((p) => <span key={p} className="builder-check bad">✕ {p.replace(`${clean.id}: `, "")}</span>)}
      {problems.length > 12 && <span className="meta">…and {problems.length - 12} more</span>}
      <span className="meta">The same checks as an uploaded file. Saving waits until they pass.</span>
    </div>
  );

  const mains = arcs.filter((a) => a.type === "main" && a.id !== draft.id);
  return (
    <section className="stack-16 builder">
      {checksHost ? createPortal(checks, checksHost) : checks}

      {/* 1 · Basics */}
      <div className="studio-card stack-12">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <span className="overline">{isNew ? "New story" : `Editing ${initial.title || initial.id}`} · 1 of 3 · Basics</span>
          <span className="meta">{savedAt ? "Draft saved on this device" : ""}</span>
        </div>
        <div className="builder-row">
          <Field label="Title" grow><input className="studio-input" value={draft.title} onChange={(e) => update((a) => { a.title = e.target.value; })} placeholder="The Bodega Cat Heist" /></Field>
          <Field label="Emoji"><input className="studio-input" style={{ width: 80, textAlign: "center" }} value={draft.emoji ?? ""} onChange={(e) => update((a) => { a.emoji = e.target.value; })} /></Field>
        </div>
        <div className="builder-row" style={{ alignItems: "center" }}>
          <span className="meta">Id</span>
          <input className="studio-input builder-id" value={draft.id} disabled={!isNew} onChange={(e) => { setIdTouched(true); const v = slugify(e.target.value); setDraft((a) => ({ ...a, id: v })); }} />
          <span className="meta">Beats are named {beatPrefix(draft.id || "story")}-1, {beatPrefix(draft.id || "story")}-2… {!isNew && "The id can't change once saved."}</span>
        </div>
        <div className="builder-row">
          <Field label="Type" grow>
            <div className="segmented" role="group" aria-label="Type">
              <button aria-pressed={draft.type === "main"} onClick={() => update((a) => { a.type = "main"; a.tier = "free"; delete a.parent_arc_id; delete a.sku; a.start_weekday ??= "sunday"; })}>Main story · free</button>
              <button aria-pressed={draft.type === "side"} onClick={() => update((a) => { a.type = "side"; a.tier = "premium"; a.parent_arc_id ??= mains[0]?.id ?? ""; a.kind ??= "insider"; a.teaser ??= ""; a.beats.forEach((b) => { delete b.prediction; b.effects = b.effects.filter((e) => e.type === "flag"); }); })}>Side story · paid</button>
            </div>
          </Field>
          {draft.type === "main" ? (
            <Field label="Day 1 is a" grow>
              <select className="studio-input" value={draft.start_weekday ?? "sunday"} onChange={(e) => update((a) => { a.start_weekday = e.target.value; })}>
                {WEEKDAYS.map((w) => <option key={w} value={w}>{w[0].toUpperCase() + w.slice(1)}</option>)}
              </select>
            </Field>
          ) : (
            <Field label="Runs with" grow>
              <select className="studio-input" value={draft.parent_arc_id ?? ""} onChange={(e) => update((a) => { a.parent_arc_id = e.target.value; })}>
                <option value="">Pick a main story</option>
                {mains.map((m) => <option key={m.id} value={m.id}>{m.title || m.id}</option>)}
              </select>
            </Field>
          )}
        </div>
        {draft.type === "main" ? (
          <Field label="Prompt (what the News app asks players)"><input className="studio-input" value={draft.prompt ?? ""} onChange={(e) => update((a) => { a.prompt = e.target.value; })} placeholder="Queens has a whodunit. Think you can crack it?" /></Field>
        ) : (
          <>
            <Field label="Teaser (the pitch on the unlock card)"><input className="studio-input" value={draft.teaser ?? ""} onChange={(e) => update((a) => { a.teaser = e.target.value; })} /></Field>
            <div className="builder-row">
              <Field label="Kind" grow>
                <select className="studio-input" value={draft.kind ?? "insider"} onChange={(e) => update((a) => { a.kind = e.target.value; })}>
                  {SIDE_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
                </select>
              </Field>
              <Field label="Product code" grow><input className="studio-input" value={draft.sku || sideSku(draft.id || "story")} onChange={(e) => update((a) => { a.sku = e.target.value; })} /></Field>
            </div>
            <span className="meta">Side stories are paid (VIP members read them free), hold no predictions and change nothing in the city for everyone.</span>
          </>
        )}
      </div>

      {/* 2 · Beats */}
      <div className="studio-card stack-12">
        <span className="overline">2 of 3 · Beats</span>
        {draft.beats.length === 0 && <span className="subtext">No beats yet. A beat is one day&apos;s news drop.</span>}
        {sorted.map(({ b, i }, k) => (
          <BeatCard key={b.id} arc={draft} beat={b} index={i} open={openBeat === i} onToggle={() => setOpenBeat((o) => (o === i ? null : i))}
            update={update} first={k === 0} last={k === sorted.length - 1} lastBeatDay={lastBeatDay}
            onMove={(by) => update((a) => {
              const order = [...a.beats].sort((x, y) => x.day - y.day);
              const j = k + by;
              if (j < 0 || j >= order.length) return;
              const [d1, d2] = [order[k].day, order[j].day];
              order[k].day = d2; order[j].day = d1;
              a.beats.sort((x, y) => x.day - y.day);
            })}
            onRemove={() => { update((a) => { const id = a.beats[i].id; a.beats.splice(i, 1); a.beats.forEach((x) => { if (x.prediction?.reveal_beat === id) x.prediction.reveal_beat = ""; }); }); setOpenBeat(null); }} />
        ))}
        <button className="btn btn-secondary builder-add" onClick={() => { update((a) => { a.beats.push(nextBeat(a)); }); setOpenBeat(draft.beats.length); }}>
          ＋ Add beat (Day {lastBeatDay + 1})
        </button>
      </div>

      {/* 3 · Extras */}
      <div className="studio-card stack-12">
        <span className="overline">3 of 3 · Extras (optional)</span>
        <Fold title="Story tasks" note={`${draft.tasks?.length ?? 0} · things players do for clout, added to their day by a beat`}><TasksEditor arc={draft} update={update} /></Fold>
        <Fold title="Events" note={`${draft.events?.length ?? 0} · happenings at places that beats can start or cancel`}><EventsEditor arc={draft} update={update} /></Fold>
        {draft.type === "main" && <Fold title="Badges" note={`${draft.badges?.length ?? 0} · for predictions, a clean sweep, or a shadow guess`}><BadgesEditor arc={draft} update={update} /></Fold>}
        {draft.type === "main" && <Fold title="What the regulars say (chatter)" note={`${Object.keys(draft.chatter ?? {}).length} topic(s) · lines by phase of the story`}><ChatterEditor arc={draft} update={update} /></Fold>}
        {draft.type === "main" && <Fold title="Advanced" note="where the story happens · answer key (kept on the server)"><AdvancedEditor arc={draft} update={update} /></Fold>}
      </div>

      {preview && previewMain && (
        <div className="studio-card stack-12">
          <span className="overline">Preview as a player{clean.type === "side" ? ` (inside ${previewMain.title})` : ""}</span>
          <StoryPreview key={JSON.stringify(previewMain.beats.length)} content={previewContent} arcId={previewMain.id} lastDay={Math.max(1, ...previewMain.beats.map((b) => b.day))} />
        </div>
      )}

      <div className="builder-bar">
        <span className="meta">{problems.length ? `${problems.length} check${problems.length === 1 ? "" : "s"} to fix` : "All checks pass"}</span>
        <button className="btn btn-secondary btn-sm" onClick={onClose}>Close</button>
        <button className="btn btn-secondary btn-sm" disabled={!previewMain || !clean.beats.length} onClick={() => setPreview((v) => !v)}>{preview ? "Hide preview" : "Preview as a player"}</button>
        <button className="btn btn-secondary btn-sm" disabled={!clean.id} onClick={download}>Download file</button>
        <button className="btn btn-taxi btn-sm" disabled={problems.length > 0 || busy !== null} onClick={() => onSave(JSON.stringify(clean), clean.id)}>
          {busy === "upload" ? "Saving…" : "Save for review"}
        </button>
      </div>
    </section>
  );
}

// ---- Small pieces ----------------------------------------------------------

function Field({ label, children, grow = false, hint }: { label: string; children: ReactNode; grow?: boolean; hint?: string }) {
  return (
    <label className="builder-field" style={grow ? { flex: 1, minWidth: 0 } : undefined}>
      <span className="overline">{label}</span>
      {children}
      {hint && <span className="meta">{hint}</span>}
    </label>
  );
}

function Fold({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`builder-fold${open ? " open" : ""}`}>
      <button className="builder-fold-head" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="title">{title}</span><span className="meta" style={{ flex: 1, textAlign: "left" }}>{note}</span><span aria-hidden="true">{open ? "▴" : "▾"}</span>
      </button>
      {open && <div className="builder-fold-body stack-12">{children}</div>}
    </div>
  );
}

/** Picks several from a list (and, with allowNew, adds ones that aren't on it yet). */
function TagPicker({ value, options, onChange, allowNew = false, placeholder = "Add…" }: { value: string[]; options: string[]; onChange: (v: string[]) => void; allowNew?: boolean; placeholder?: string }) {
  const [typed, setTyped] = useState("");
  const add = (t: string) => { const v = t.trim(); if (v && !value.includes(v)) onChange([...value, v]); };
  return (
    <div className="builder-tags">
      {value.map((t) => <span key={t} className="builder-tag">{t.replace(/_/g, " ")}<button aria-label={`Remove ${t}`} onClick={() => onChange(value.filter((x) => x !== t))}>×</button></span>)}
      {allowNew ? (
        <input className="studio-input builder-tag-input" value={typed} placeholder={placeholder} list={`tags-${options.length}`}
          onChange={(e) => setTyped(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(typed.replace(/\s+/g, "_").toLowerCase()); setTyped(""); } }}
          onBlur={() => { if (typed.trim()) { add(typed.replace(/\s+/g, "_").toLowerCase()); setTyped(""); } }} />
      ) : (
        <select className="studio-input builder-tag-input" value="" onChange={(e) => add(e.target.value)}>
          <option value="">{placeholder}</option>
          {options.filter((o) => !value.includes(o)).map((o) => <option key={o} value={o}>{o.replace(/_/g, " ")}</option>)}
        </select>
      )}
      {allowNew && <datalist id={`tags-${options.length}`}>{options.map((o) => <option key={o} value={o} />)}</datalist>}
    </div>
  );
}

const num = (v: string) => (v === "" ? NaN : Number(v));

function DaySelect({ value, from, to, onChange, none }: { value: number | undefined; from: number; to: number; onChange: (d: number | undefined) => void; none?: string }) {
  return (
    <select className="studio-input" value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}>
      {none && <option value="">{none}</option>}
      {Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i).map((d) => <option key={d} value={d}>Day {d}</option>)}
    </select>
  );
}

// ---- Beats -----------------------------------------------------------------

function BeatCard({ arc, beat, index, open, onToggle, update, first, last, lastBeatDay, onMove, onRemove }: {
  arc: Arc; beat: Beat; index: number; open: boolean; onToggle: () => void; update: Update; first: boolean; last: boolean; lastBeatDay: number;
  onMove: (by: -1 | 1) => void; onRemove: () => void;
}) {
  const set = (f: (b: Beat) => void) => update((a) => f(a.beats[index]));
  const n = beat.news[0] ?? { headline: "" };
  const [confirm, setConfirm] = useState(false);
  return (
    <div className={`builder-beat${open ? " open" : ""}`}>
      <div className="builder-beat-head">
        <span className="hud-number builder-day">D{beat.day}</span>
        <button className="builder-beat-title" onClick={onToggle} aria-expanded={open}>
          <span className="title">{n.headline || <span className="meta">Untitled beat</span>}</span>
          <span className="meta">{beat.id}{beat.prediction ? ` · prediction ${beat.prediction.id}` : ""}{beat.evidence ? " · evidence" : ""}{beat.effects.length ? ` · ${beat.effects.length} city change${beat.effects.length === 1 ? "" : "s"}` : ""}</span>
        </button>
        <span className="builder-beat-tools">
          <button className="chip" aria-label="Earlier" disabled={first} onClick={() => onMove(-1)}>↑</button>
          <button className="chip" aria-label="Later" disabled={last} onClick={() => onMove(1)}>↓</button>
          {confirm ? <button className="chip builder-danger" onClick={onRemove}>Remove?</button> : <button className="chip" onClick={() => setConfirm(true)}>Remove</button>}
        </span>
      </div>
      {open && (
        <div className="stack-12 builder-beat-body">
          <div className="builder-row">
            <Field label="Day"><DaySelect value={beat.day} from={1} to={Math.max(lastBeatDay + 1, beat.day, 14)} onChange={(d) => set((b) => { b.day = d ?? 1; })} /></Field>
            {arc.type === "side" && (
              <label className="builder-check-row"><input type="checkbox" checked={!!beat.points_at_answer} onChange={(e) => set((b) => { b.points_at_answer = e.target.checked || undefined; })} /> Points at the answer (only after voting closes)</label>
            )}
          </div>
          {beat.news.map((item, k) => (
            <div key={k} className="stack-12">
              {beat.news.length > 1 && <div className="row" style={{ justifyContent: "space-between" }}><span className="overline">News item {k + 1}</span>{k > 0 && <button className="chip" onClick={() => set((b) => { b.news.splice(k, 1); })}>Remove</button>}</div>}
              <Field label="Headline"><input className="studio-input" value={item.headline} onChange={(e) => set((b) => { b.news[k].headline = e.target.value; })} /></Field>
              {k === 0 && arc.type === "main" && beat.day > 1 && (
                <Field label="Previously (one line catching players up)"><textarea className="studio-input" rows={2} value={item.previously ?? ""} onChange={(e) => set((b) => { b.news[k].previously = e.target.value; })} /></Field>
              )}
              <Field label="Story"><textarea className="studio-input" rows={5} value={item.body ?? ""} onChange={(e) => set((b) => { b.news[k].body = e.target.value; })} /></Field>
              <Field label={arc.type === "main" ? "Hook (the last line, every main beat has one)" : "Hook (optional)"}><textarea className="studio-input" rows={2} value={item.hook ?? ""} onChange={(e) => set((b) => { b.news[k].hook = e.target.value; })} /></Field>
            </div>
          ))}
          <div className="builder-chips">
            <button className="chip" onClick={() => set((b) => { b.news.push({ headline: "" }); })}>＋ News item</button>
            <Toggle on={!!beat.evidence} label="Evidence card" onClick={() => set((b) => { b.evidence = b.evidence ? undefined : { title: "", kind: "document", lines: [""] }; })} />
            {arc.type === "main" && <Toggle on={!!beat.prediction} label="Prediction" onClick={() => update((a) => { const b = a.beats[index]; b.prediction = b.prediction ? undefined : newPrediction(a, b); })} />}
            <Toggle on={beat.card_note !== undefined} label="Card note" onClick={() => set((b) => { b.card_note = b.card_note === undefined ? "" : undefined; })} />
          </div>
          {beat.card_note !== undefined && <Field label="Card note (a line on the News card, like “Voting closed”)"><input className="studio-input" value={beat.card_note} onChange={(e) => set((b) => { b.card_note = e.target.value; })} /></Field>}
          {beat.evidence && (
            <div className="builder-sub stack-12">
              <span className="overline">Evidence card</span>
              <div className="builder-row">
                <Field label="Title" grow><input className="studio-input" value={beat.evidence.title} onChange={(e) => set((b) => { b.evidence!.title = e.target.value; })} /></Field>
                <Field label="Kind">
                  <select className="studio-input" value={beat.evidence.kind} onChange={(e) => set((b) => { b.evidence!.kind = e.target.value; })}>
                    {[...new Set([...EVIDENCE_KINDS, beat.evidence.kind])].map((k) => <option key={k} value={k}>{k}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Lines (one per line)"><textarea className="studio-input" rows={4} value={beat.evidence.lines.join("\n")} onChange={(e) => set((b) => { b.evidence!.lines = e.target.value.split("\n"); })} /></Field>
            </div>
          )}
          {beat.prediction && <PredictionEditor arc={arc} beat={beat} index={index} update={update} />}
          <EffectsEditor arc={arc} beat={beat} index={index} update={update} />
        </div>
      )}
    </div>
  );
}

function Toggle({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return <button className={`chip builder-toggle${on ? " on" : ""}`} aria-pressed={on} onClick={onClick}>{on ? "✓" : "＋"} {label}</button>;
}

function PredictionEditor({ arc, beat, index, update }: { arc: Arc; beat: Beat; index: number; update: Update }) {
  const p = beat.prediction!;
  const set = (f: (p: NonNullable<Beat["prediction"]>) => void) => update((a) => f(a.beats[index].prediction!));
  const later = arc.beats.filter((b) => b.day > beat.day).sort((a, b) => a.day - b.day);
  const badges = arc.badges ?? [];
  return (
    <div className="builder-sub stack-12">
      <span className="overline">Prediction {p.id}</span>
      <Field label="Question"><input className="studio-input" value={p.question} onChange={(e) => set((x) => { x.question = e.target.value; })} placeholder="Who has Mr. Whiskers?" /></Field>
      {p.options.map((o, k) => (
        <div key={o.id} className="builder-option">
          <input type="radio" name={`answer-${beat.id}`} checked={p.correct === o.id} onChange={() => set((x) => { x.correct = o.id; })} aria-label={`${o.label || "Option"} is the answer`} />
          <input className="studio-input" value={o.label} placeholder={`Option ${k + 1}`} onChange={(e) => set((x) => { x.options[k].label = e.target.value; })}
            onBlur={() => set((x) => {
              // Ids follow the label once it's written (only while nothing else points at them).
              const opt = x.options[k];
              if (/^[a-z]$/.test(opt.id) && opt.label.trim()) {
                const id = optionId(opt.label, x.options.filter((_, j) => j !== k).map((y) => y.id));
                if (x.correct === opt.id) x.correct = id;
                if (x.roasts?.[opt.id] !== undefined) { x.roasts[id] = x.roasts[opt.id]; delete x.roasts[opt.id]; }
                opt.id = id;
              }
            })} />
          {p.correct === o.id ? <span className="meta builder-answer">the answer</span>
            : <input className="studio-input builder-roast" value={p.roasts?.[o.id] ?? ""} placeholder="Roast if they pick this (optional)" onChange={(e) => set((x) => { x.roasts = { ...(x.roasts ?? {}), [o.id]: e.target.value }; })} />}
          {p.options.length > 2 && <button className="chip" aria-label="Remove option" onClick={() => set((x) => { x.options.splice(k, 1); if (x.correct === o.id) x.correct = x.options[0].id; })}>×</button>}
        </div>
      ))}
      <button className="chip" style={{ alignSelf: "flex-start" }} onClick={() => set((x) => { const letters = "abcdefgh".split("").filter((l) => !x.options.some((y) => y.id === l)); x.options.push({ id: letters[0] ?? `o${x.options.length + 1}`, label: "" }); })}>＋ Option</button>
      <div className="builder-row">
        <Field label="Voting closes"><DaySelect value={p.closes_at.day} from={beat.day} to={Math.max(beat.day, ...later.map((b) => b.day))} onChange={(d) => set((x) => { x.closes_at.day = d ?? beat.day; })} /></Field>
        <Field label="At (New York)"><input className="studio-input" type="time" value={p.closes_at.time} onChange={(e) => set((x) => { x.closes_at.time = e.target.value; })} /></Field>
        <Field label="Revealed in" grow>
          <select className="studio-input" value={p.reveal_beat} onChange={(e) => set((x) => { x.reveal_beat = e.target.value; })}>
            <option value="">Pick a later beat</option>
            {later.map((b) => <option key={b.id} value={b.id}>D{b.day} · {b.news[0]?.headline || b.id}</option>)}
          </select>
        </Field>
      </div>
      <div className="builder-row">
        <Field label="Clout for a right guess"><input className="studio-input" type="number" min={0} value={Number.isNaN(p.reward.clout) ? "" : p.reward.clout} onChange={(e) => set((x) => { x.reward.clout = num(e.target.value); })} style={{ width: 120 }} /></Field>
        <Field label="Badge (optional)" grow>
          <select className="studio-input" value={p.reward.badge ?? ""} onChange={(e) => set((x) => { x.reward.badge = e.target.value || undefined; })}>
            <option value="">None</option>
            {badges.map((b) => <option key={b.id || b.name} value={b.id || slugify(b.name)}>{b.emoji} {b.name}</option>)}
          </select>
        </Field>
        <label className="builder-check-row"><input type="checkbox" checked={!!p.changeable} onChange={(e) => set((x) => { x.changeable = e.target.checked; })} /> Players can change their guess</label>
      </div>
    </div>
  );
}

// ---- City changes (effects) ------------------------------------------------

function EffectsEditor({ arc, beat, index, update }: { arc: Arc; beat: Beat; index: number; update: Update }) {
  const [adding, setAdding] = useState(false);
  const types = arc.type === "side" ? ["flag"] : ["price_multiplier", "availability", "place_state", "task_injection", "chatter_topic", "flag"];
  return (
    <div className="builder-sub stack-12">
      <span className="overline">City changes</span>
      {arc.type === "side" && <span className="meta">Side stories only set story flags; they don&apos;t change the city for everyone.</span>}
      {beat.effects.map((e, k) => (
        <div key={k} className="builder-effect stack-8">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <span className="title">{EFFECT_LABEL[e.type] ?? e.type}</span>
            <button className="chip" onClick={() => update((a) => { a.beats[index].effects.splice(k, 1); })}>Remove</button>
          </div>
          <EffectFields arc={arc} beat={beat} e={e} set={(f) => update((a) => f(a.beats[index].effects[k]))} />
          <span className="meta">{describeEffect(e)}</span>
        </div>
      ))}
      {adding ? (
        <div className="builder-chips">
          {types.map((t) => <button key={t} className="chip" onClick={() => { update((a) => { a.beats[index].effects.push(newEffect(t as StoryEffect["type"], a.beats[index])); }); setAdding(false); }}>{EFFECT_LABEL[t]}</button>)}
          <button className="chip" onClick={() => setAdding(false)}>Cancel</button>
        </div>
      ) : <button className="chip" style={{ alignSelf: "flex-start" }} onClick={() => setAdding(true)}>＋ City change</button>}
    </div>
  );
}

function EffectFields({ arc, beat, e, set }: { arc: Arc; beat: Beat; e: StoryEffect; set: (f: (e: StoryEffect) => void) => void }) {
  const lastDay = Math.max(beat.day + 1, ...arc.beats.map((b) => b.day), 14);
  const addedTags = arc.beats.flatMap((b) => b.effects.flatMap((x) => x.add_tags ?? []));
  const tags = [...new Set([...PLACE_TAGS, ...addedTags])].sort();
  const expires = (required: boolean) => (
    <Field label={required ? "Until" : "Until (optional)"}><DaySelect value={e.expires_day} from={beat.day + 1} to={lastDay + 1} none={required ? undefined : "Stays"} onChange={(d) => set((x) => { x.expires_day = d; })} /></Field>
  );
  const reason = <Field label="Reason players see" grow><input className="studio-input" value={e.reason ?? ""} onChange={(ev) => set((x) => { x.reason = ev.target.value; })} placeholder="Fans are packing Sarah's booth" /></Field>;
  switch (e.type) {
    case "price_multiplier":
      return (
        <>
          <Field label="Places with these tags"><TagPicker value={e.tags ?? []} options={tags} onChange={(v) => set((x) => { x.tags = v; })} placeholder="Add a tag…" /></Field>
          <div className="builder-row">
            <Field label="What costs more">
              <select className="studio-input" value={e.applies_to ?? "visit_price"} onChange={(ev) => set((x) => { x.applies_to = ev.target.value as StoryEffect["applies_to"]; })}>
                <option value="visit_price">Visits</option><option value="event_entry">Event entry</option><option value="shop_price">Shop</option>
              </select>
            </Field>
            <Field label="Times"><input className="studio-input" type="number" step="0.1" min="0.1" value={Number.isNaN(e.multiplier) ? "" : e.multiplier ?? ""} onChange={(ev) => set((x) => { x.multiplier = num(ev.target.value); })} style={{ width: 100 }} /></Field>
            {expires(true)}
          </div>
          <div className="builder-row">{reason}</div>
        </>
      );
    case "availability":
      return (
        <>
          <div className="builder-row">
            <Field label="State">
              <select className="studio-input" value={e.state ?? "closed"} onChange={(ev) => set((x) => { x.state = ev.target.value as StoryEffect["state"]; })}>
                <option value="closed">Closed</option><option value="restricted">Restricted</option><option value="open">Open</option>
              </select>
            </Field>
            <Field label="What" grow>
              <select className="studio-input" value={e.sku !== undefined ? "sku" : "tags"} onChange={(ev) => set((x) => { if (ev.target.value === "sku") { x.sku = ""; delete x.tags; } else { x.tags = []; delete x.sku; } })}>
                <option value="tags">Places with tags</option><option value="sku">A Shop item</option>
              </select>
            </Field>
            {expires(e.state !== "open")}
          </div>
          {e.sku !== undefined ? (
            <Field label="Shop item">
              <select className="studio-input" value={e.sku} onChange={(ev) => set((x) => { x.sku = ev.target.value; })}>
                <option value="">Pick an item</option>
                {SHOP.map((i) => <option key={i.sku} value={i.sku}>{i.emoji} {i.name}</option>)}
              </select>
            </Field>
          ) : <Field label="Places with these tags"><TagPicker value={e.tags ?? []} options={tags} onChange={(v) => set((x) => { x.tags = v; })} placeholder="Add a tag…" /></Field>}
          {e.state === "restricted" && <Field label="Still allowed (actions or kinds)"><TagPicker value={e.allow ?? []} options={[]} allowNew onChange={(v) => set((x) => { x.allow = v; })} placeholder="Type and press Enter" /></Field>}
          <div className="builder-row">{reason}</div>
        </>
      );
    case "place_state": {
      const place = e.place ? placeById(e.place) : undefined;
      const unlocks = place?.actions.filter((x) => x.storyUnlock) ?? [];
      const events = arc.events ?? [];
      return (
        <>
          <div className="builder-row">
            <Field label="Place" grow>
              <select className="studio-input" value={e.place ?? ""} onChange={(ev) => set((x) => { x.place = ev.target.value; delete x.unlock_action; })}>
                <option value="">Pick a place</option>
                {PLACE_LIST.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.neighborhood}</option>)}
              </select>
            </Field>
            {expires(false)}
          </div>
          <div className="builder-row">
            <Field label="Start an event" grow>
              <select className="studio-input" value={e.spawn_event ?? ""} onChange={(ev) => set((x) => { x.spawn_event = ev.target.value || undefined; })}>
                <option value="">None</option>{events.map((v) => <option key={v.id || v.name} value={v.id || slugify(v.name)}>{v.name}</option>)}
              </select>
            </Field>
            <Field label="Cancel an event" grow>
              <select className="studio-input" value={e.cancel_event ?? ""} onChange={(ev) => set((x) => { x.cancel_event = ev.target.value || undefined; })}>
                <option value="">None</option>{events.map((v) => <option key={v.id || v.name} value={v.id || slugify(v.name)}>{v.name}</option>)}
              </select>
            </Field>
          </div>
          {!events.length && <span className="meta">Add events under Extras to start or cancel them here.</span>}
          <div className="builder-row">
            <Field label="Unlock an action" grow>
              <select className="studio-input" value={e.unlock_action ?? ""} disabled={!unlocks.length} onChange={(ev) => set((x) => { x.unlock_action = ev.target.value || undefined; })}>
                <option value="">{unlocks.length ? "None" : "No story actions at this place"}</option>
                {unlocks.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
              </select>
            </Field>
            <Field label="Card note at the place" grow><input className="studio-input" value={e.note ?? ""} onChange={(ev) => set((x) => { x.note = ev.target.value; })} /></Field>
          </div>
          <Field label="New tags on the place (so other changes can find it)"><TagPicker value={e.add_tags ?? []} options={tags} allowNew onChange={(v) => set((x) => { x.add_tags = v; })} placeholder="Type and press Enter" /></Field>
        </>
      );
    }
    case "task_injection": {
      const tasks = (arc.tasks ?? []).map((t) => taskSlug(t.id) || slugify(t.label)).filter(Boolean);
      return (
        <>
          <Field label="Add these story tasks to players' day"><TagPicker value={(e.add ?? []).map(taskSlug)} options={tasks} onChange={(v) => set((x) => { x.add = v; })} placeholder="Pick a task…" /></Field>
          <Field label="Take these away"><TagPicker value={(e.remove ?? []).map(taskSlug)} options={tasks} onChange={(v) => set((x) => { x.remove = v; })} placeholder="Pick a task…" /></Field>
          {!tasks.length && <span className="meta">Write story tasks under Extras first.</span>}
        </>
      );
    }
    case "chatter_topic":
      return (
        <div className="builder-row">
          <Field label="Topic" grow>
            <select className="studio-input" value={e.topic ?? ""} onChange={(ev) => set((x) => { x.topic = ev.target.value; })}>
              <option value="">Pick a topic</option>
              {Object.keys(arc.chatter ?? {}).map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Phase">
            <select className="studio-input" value={e.phase ?? "early"} onChange={(ev) => set((x) => { x.phase = ev.target.value as Phase; })}>
              {PHASES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </Field>
          <Field label="Priority"><input className="studio-input" type="number" min={1} value={e.priority ?? 1} onChange={(ev) => set((x) => { x.priority = num(ev.target.value); })} style={{ width: 90 }} /></Field>
        </div>
      );
    case "flag":
      return <Field label="Flag name"><input className="studio-input" value={e.set ?? ""} onChange={(ev) => set((x) => { x.set = slugify(ev.target.value).replace(/-/g, "_"); })} placeholder="theo_spotted" /></Field>;
    default:
      return <span className="meta">This kind of change is kept as the file has it.</span>;
  }
}

// ---- Extras ----------------------------------------------------------------

function TasksEditor({ arc, update }: { arc: Arc; update: Update }) {
  const tasks = arc.tasks ?? [];
  const set = (k: number, f: (t: StoryTask) => void) => update((a) => f(a.tasks![k]));
  const kindOf = (t: StoryTask) => (t.do.event !== undefined ? "event" : t.do.share !== undefined ? "share" : t.do.evidence !== undefined ? "evidence" : "place");
  return (
    <>
      {tasks.map((t, k) => {
        const kind = kindOf(t);
        const place = t.do.place ? placeById(t.do.place) : undefined;
        return (
          <div key={k} className="builder-effect stack-8">
            <div className="builder-row">
              <Field label="Task (what players see)" grow><input className="studio-input" value={t.label} onChange={(e) => set(k, (x) => { x.label = e.target.value; if (!x.id || x.id.endsWith(":")) x.id = ""; })} onBlur={() => set(k, (x) => { if (!taskSlug(x.id)) x.id = `story:${arc.id}:${slugify(x.label)}`; })} placeholder="Leave flowers at Skyline Pier" /></Field>
              <Field label="Clout"><input className="studio-input" type="number" min={0} disabled={arc.type === "side"} value={arc.type === "side" ? 0 : Number.isNaN(t.clout) ? "" : t.clout} onChange={(e) => set(k, (x) => { x.clout = num(e.target.value); })} style={{ width: 90 }} /></Field>
              <button className="chip" style={{ alignSelf: "flex-end" }} onClick={() => update((a) => { a.tasks!.splice(k, 1); })}>Remove</button>
            </div>
            <div className="builder-row">
              <Field label="Done by">
                <select className="studio-input" value={kind} onChange={(e) => set(k, (x) => { x.do = e.target.value === "event" ? { event: "" } : e.target.value === "share" ? { share: "" } : e.target.value === "evidence" ? { evidence: "" } : { place: "", action: "" }; })}>
                  <option value="place">An action at a place</option><option value="event">Going to an event</option><option value="share">Sharing a beat</option><option value="evidence">Opening a beat&apos;s evidence</option>
                </select>
              </Field>
              {kind === "place" && (
                <>
                  <Field label="Place" grow>
                    <select className="studio-input" value={t.do.place ?? ""} onChange={(e) => set(k, (x) => { x.do = { place: e.target.value, action: "" }; })}>
                      <option value="">Pick a place</option>{PLACE_LIST.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Action" grow>
                    <select className="studio-input" value={t.do.action ?? ""} onChange={(e) => set(k, (x) => { x.do.action = e.target.value; })}>
                      <option value="">Pick an action</option>{(place?.actions ?? []).map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
                    </select>
                  </Field>
                </>
              )}
              {kind === "event" && (
                <Field label="Event" grow>
                  <select className="studio-input" value={t.do.event ?? ""} onChange={(e) => set(k, (x) => { x.do.event = e.target.value; })}>
                    <option value="">Pick an event</option>{(arc.events ?? []).map((v) => <option key={v.id || v.name} value={v.id || slugify(v.name)}>{v.name}</option>)}
                  </select>
                </Field>
              )}
              {(kind === "share" || kind === "evidence") && (
                <Field label="Beat" grow>
                  <select className="studio-input" value={(kind === "share" ? t.do.share : t.do.evidence) ?? ""} onChange={(e) => set(k, (x) => { if (kind === "share") x.do.share = e.target.value; else x.do.evidence = e.target.value; })}>
                    <option value="">Pick a beat</option>
                    {arc.beats.filter((b) => kind === "share" || b.evidence).map((b) => <option key={b.id} value={b.id}>D{b.day} · {b.news[0]?.headline || b.id}</option>)}
                  </select>
                </Field>
              )}
            </div>
          </div>
        );
      })}
      <button className="chip" style={{ alignSelf: "flex-start" }} onClick={() => update((a) => { a.tasks = [...(a.tasks ?? []), { id: "", label: "", do: { place: "", action: "" }, clout: a.type === "side" ? 0 : 20 }]; })}>＋ Story task</button>
      <span className="meta">A task shows up on the day a beat adds it (City changes → Story tasks today).</span>
    </>
  );
}

function EventsEditor({ arc, update }: { arc: Arc; update: Update }) {
  const events = arc.events ?? [];
  const set = (k: number, f: (e: StoryEvent) => void) => update((a) => f(a.events![k]));
  return (
    <>
      {events.map((v, k) => (
        <div key={k} className="builder-effect stack-8">
          <div className="builder-row">
            <Field label="Event" grow><input className="studio-input" value={v.name} onChange={(e) => set(k, (x) => { x.name = e.target.value; })} onBlur={() => set(k, (x) => { if (!x.id) x.id = `${beatPrefix(arc.id || "story")}-${slugify(x.name)}`.slice(0, 40); })} placeholder="Candlelight vigil" /></Field>
            <Field label="Place" grow>
              <select className="studio-input" value={v.place} onChange={(e) => set(k, (x) => { x.place = e.target.value; })}>
                <option value="">Pick a place</option>{PLACE_LIST.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
            <button className="chip" style={{ alignSelf: "flex-end" }} onClick={() => update((a) => { a.events!.splice(k, 1); })}>Remove</button>
          </div>
          <Field label="Blurb"><textarea className="studio-input" rows={2} value={v.blurb} onChange={(e) => set(k, (x) => { x.blurb = e.target.value; })} /></Field>
          <div className="builder-row">
            <label className="builder-check-row"><input type="checkbox" checked={v.attendable} onChange={(e) => set(k, (x) => { x.attendable = e.target.checked; })} /> Players can go</label>
            {v.attendable && (["energy", "clout", "mood"] as const).map((f) => (
              <Field key={f} label={f === "energy" ? "Energy it costs" : f === "clout" ? "Clout" : "Mood"}><input className="studio-input" type="number" min={0} value={v[f] ?? 0} onChange={(e) => set(k, (x) => { x[f] = num(e.target.value); })} style={{ width: 90 }} /></Field>
            ))}
          </div>
        </div>
      ))}
      <button className="chip" style={{ alignSelf: "flex-start" }} onClick={() => update((a) => { a.events = [...(a.events ?? []), { id: "", name: "", place: "", attendable: true, energy: 10, clout: 20, mood: 3, blurb: "" }]; })}>＋ Event</button>
      <span className="meta">A beat starts an event with City changes → Place: event, action or note.</span>
    </>
  );
}

function BadgesEditor({ arc, update }: { arc: Arc; update: Update }) {
  const badges = arc.badges ?? [];
  const preds = arc.beats.flatMap((b) => (b.prediction ? [b.prediction.id] : []));
  const ids = badges.map((b) => b.id || slugify(b.name));
  return (
    <>
      {badges.map((b, k) => (
        <div key={k} className="builder-row">
          <Field label="Emoji"><input className="studio-input" style={{ width: 64, textAlign: "center" }} value={b.emoji} onChange={(e) => update((a) => { a.badges![k].emoji = e.target.value; })} /></Field>
          <Field label="Name" grow><input className="studio-input" value={b.name} onChange={(e) => update((a) => { a.badges![k].name = e.target.value; })} onBlur={() => update((a) => { if (!a.badges![k].id) a.badges![k].id = slugify(a.badges![k].name); })} /></Field>
          <Field label="Line" grow><input className="studio-input" value={b.line} onChange={(e) => update((a) => { a.badges![k].line = e.target.value; })} /></Field>
          <button className="chip" style={{ alignSelf: "flex-end" }} onClick={() => update((a) => { a.badges!.splice(k, 1); })}>Remove</button>
        </div>
      ))}
      <button className="chip" style={{ alignSelf: "flex-start" }} onClick={() => update((a) => { a.badges = [...(a.badges ?? []), { id: "", name: "", emoji: "🏅", line: "" }]; })}>＋ Badge</button>
      {badges.length > 0 && (
        <div className="builder-row">
          <Field label="Clean sweep badge (every prediction right)" grow>
            <select className="studio-input" value={arc.bonus_badge?.badge ?? ""} onChange={(e) => update((a) => { a.bonus_badge = e.target.value ? { badge: e.target.value, requires: preds } : undefined; })}>
              <option value="">None</option>{ids.map((id, k) => <option key={id} value={id}>{badges[k].emoji} {badges[k].name}</option>)}
            </select>
          </Field>
          <Field label="Shadow guess badge (archive readers)" grow>
            <select className="studio-input" value={arc.shadow_badge ?? ""} onChange={(e) => update((a) => { a.shadow_badge = e.target.value || undefined; })}>
              <option value="">None</option>{ids.map((id, k) => <option key={id} value={id}>{badges[k].emoji} {badges[k].name}</option>)}
            </select>
          </Field>
        </div>
      )}
      {arc.bonus_badge && <span className="meta">The clean sweep needs {arc.bonus_badge.requires.join(", ") || "no predictions yet"}.<button className="chip" style={{ marginLeft: 8 }} onClick={() => update((a) => { a.bonus_badge!.requires = preds; })}>Use every prediction</button></span>}
      <span className="meta">A prediction&apos;s own badge is picked in its beat.</span>
    </>
  );
}

function ChatterEditor({ arc, update }: { arc: Arc; update: Update }) {
  const topics = Object.keys(arc.chatter ?? {});
  const [phase, setPhase] = useState<Phase>("early");
  const [newTopic, setNewTopic] = useState("");
  return (
    <>
      <span className="meta">While the story runs, the regulars say these instead of their everyday lines: 2 or 3 lines each. Beats pick the topic and phase with City changes → What people talk about.</span>
      <div className="segmented" role="group" aria-label="Phase">
        {PHASES.map((p) => <button key={p} aria-pressed={phase === p} onClick={() => setPhase(p)}>{p}</button>)}
      </div>
      {topics.map((t) => (
        <div key={t} className="builder-effect stack-8">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <span className="title">Topic: {t}</span>
            <button className="chip" onClick={() => update((a) => { delete a.chatter![t]; })}>Remove topic</button>
          </div>
          {CHATTER_ROLES.map((role) => (
            <Field key={role} label={`${role} · ${ROLE_HINT[role]}`}>
              <textarea className="studio-input" rows={3} value={(arc.chatter?.[t]?.[phase]?.[role] ?? []).join("\n")} placeholder="One line per line"
                onChange={(e) => update((a) => { const c = (a.chatter![t][phase] ??= {}); c[role] = e.target.value.split("\n"); })} />
            </Field>
          ))}
        </div>
      ))}
      <div className="builder-row">
        <Field label="New topic" grow><input className="studio-input" value={newTopic} onChange={(e) => setNewTopic(e.target.value)} placeholder={arc.id || "topic-id"} /></Field>
        <button className="chip" style={{ alignSelf: "flex-end" }} onClick={() => { const t = slugify(newTopic || arc.id); if (t) update((a) => { a.chatter = { ...(a.chatter ?? {}), [t]: a.chatter?.[t] ?? {} }; }); setNewTopic(""); }}>＋ Topic</button>
      </div>
    </>
  );
}

function AdvancedEditor({ arc, update }: { arc: Arc; update: Update }) {
  const [key, setKey] = useState(JSON.stringify(arc.answer_key ?? {}, null, 2));
  const [bad, setBad] = useState(false);
  return (
    <>
      <Field label="Where the story happens">
        <div className="builder-chips">
          {BOROUGHS.map((b) => {
            const on = (arc.borough_scope ?? []).includes(b.id);
            return <Toggle key={b.id} on={on} label={b.name} onClick={() => update((a) => { a.borough_scope = on ? (a.borough_scope ?? []).filter((x) => x !== b.id) : [...(a.borough_scope ?? []), b.id]; })} />;
          })}
        </div>
      </Field>
      <Field label="Answer key (JSON, kept on the server, never sent to players)">
        <textarea className="studio-input builder-mono" rows={4} value={key} onChange={(e) => {
          setKey(e.target.value);
          try { const v = JSON.parse(e.target.value || "{}"); setBad(false); update((a) => { a.answer_key = v; }); } catch { setBad(true); }
        }} />
      </Field>
      {bad && <span className="meta reason">That isn&apos;t valid JSON yet; the last valid answer key is kept.</span>}
    </>
  );
}
