"use client";

// The Studio's Shop tab (the Shop Manager, migration 0099; docs/shop-manager.md): import catalog files, process their
// pictures, review each card with its readiness checks, approve now or schedule a drop, send back, edit, retire,
// restore and delete, with the audit log. Nothing goes live without approval here.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  EDITABLE, PRESENTATION_LABEL, SHOP_TABS, SLOTS, STATUS_LABEL, STYLE_LINES, STYLE_LINE_LABEL, cloutCurve, isReady, readiness,
  fileProgress, type CatalogItem, type CatalogStatus, type EditableField, type ShopFile, type ShopTab, type StyleLine,
} from "@/lib/shopCatalog";
import type { CoutureOwner, ShopAction, ShopAuditRow, ShopImportResult, StudioApi } from "@/lib/studio";
import { MAP_SKUS } from "@/lib/coutureMap";
import { editionLine, formatPrice, serialLabel, type Edition } from "@/lib/store";
import { ShopArt, ShopCardPreview } from "../city/ShopCard";
import { GraphicsSwitch } from "../GraphicsSwitch";

const TAB_LABEL: Record<ShopTab, string> = { fashion: "Fashion", accessories: "Accessories", home: "Furniture", cars: "Cars", houses: "Houses", luxury: "Luxury", makeup: "Makeup" };
const cash = (i: CatalogItem) => (i.realCash ? (i.priceUsdCents ? formatPrice(i.priceUsdCents, "usd") : "$–") : `C$${i.price.toLocaleString("en-US")}`);
const STATUSES: CatalogStatus[] = ["pending_review", "draft", "scheduled", "live", "retired"];
type Filters = { status: CatalogStatus | "all"; tab: ShopTab | "all"; line: string; tier: string; pres: string; money: boolean; ready: boolean; locked: boolean };
const NO_FILTERS: Filters = { status: "all", tab: "all", line: "", tier: "", pres: "", money: false, ready: false, locked: false };
const localInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

export function ShopManagerTab({ api }: { api: StudioApi }) {
  const [items, setItems] = useState<CatalogItem[] | null>(null);
  const [files, setFiles] = useState<ShopFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<{ kind: "ok" | "error"; text: string; list?: string[] } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number; failed: number } | null>(null);
  const [f, setF] = useState<Filters>(NO_FILTERS);
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<string | null>(null);
  const [paste, setPaste] = useState<string | null>(null);
  const [dropAt, setDropAt] = useState("");

  const load = useCallback(async () => {
    const r = await api.shopList!();
    if (r.ok) { setItems(r.data); setError(null); } else setError(r.error);
  }, [api]);
  useEffect(() => { void load(); void api.shopFiles?.().then((r) => r.ok && setFiles(r.data)); }, [api, load]);

  // One per picture: items sharing a picture (a furniture line's colors) get it together.
  const waiting = useMemo(() => { const seen = new Set<string>(); return (items ?? []).filter((i) => i.sourceImage && i.imageStatus !== "ready" && !seen.has(i.sourceImage) && seen.add(i.sourceImage)).map((i) => i.sku); }, [items]);
  const counts = useMemo(() => Object.fromEntries(STATUSES.map((s) => [s, (items ?? []).filter((i) => i.status === s).length])) as Record<CatalogStatus, number>, [items]);
  /** Items in the chosen status (the category tabs count these). */
  const inStatus = useMemo(() => (items ?? []).filter((i) => f.status === "all" || i.status === f.status), [items, f.status]);
  const shown = useMemo(() => inStatus.filter((i) =>
    (f.tab === "all" || i.tab === f.tab) && (!f.line || i.styleLines.includes(f.line))
    && (!f.tier || i.tier === f.tier) && (!f.pres || i.presentation === f.pres) && (!f.money || i.realCash)
    && (!f.ready || isReady(i, { others: items ?? [] })) && (!f.locked || !i.wearable)
    && (!q.trim() || `${i.name} ${i.sku}`.toLowerCase().includes(q.trim().toLowerCase()))), [inStatus, items, f, q]);

  const notLoaded = useMemo(() => files.reduce((n, x) => n + fileProgress(x, items ?? []).notLoaded.length, 0), [files, items]);
  const lockedLive = useMemo(() => (items ?? []).filter((i) => i.status === "live" && !i.wearable).length, [items]);

  /** Processes pictures four at a time until none are left (a function stays inside its time limit). */
  const processAll = async (skus: string[]) => {
    if (!skus.length) return;
    const p = { done: 0, total: skus.length, failed: 0 };
    setProgress({ ...p });
    for (let i = 0; i < skus.length; i += 4) {
      const r = await api.shopProcessImages!(skus.slice(i, i + 4));
      if (!r.ok) { setNote({ kind: "error", text: r.error }); break; }
      p.done += Math.min(4, skus.length - i);
      p.failed += r.data.filter((x) => !x.ok).length;
      setProgress({ ...p });
    }
    await load();
    setProgress(null);
    setNote({ kind: p.failed ? "error" : "ok", text: `Processed ${p.done} picture${p.done === 1 ? "" : "s"}${p.failed ? `; ${p.failed} item${p.failed === 1 ? "" : "s"} failed (open them to retry)` : ""}.` });
  };

  const doImport = async (source: { file: string } | { json: string }) => {
    setBusy("import"); setNote(null);
    const r = await api.shopImport!(source);
    setBusy(null);
    if (!r.ok) return setNote({ kind: "error", text: r.error });
    const d: ShopImportResult = r.data;
    const parts = [
      d.added.length && `${d.added.length} new draft${d.added.length === 1 ? "" : "s"}`,
      d.updated.length && `${d.updated.length} updated`,
      d.unchanged.length && `${d.unchanged.length} unchanged`,
      d.kept.length && `${d.kept.length} already approved (not changed; use Edit)`,
      d.pictures.length && `pictures for ${d.pictures.reduce((n, p) => n + p.skus.length, 0)} items on sale`,
    ].filter(Boolean);
    setNote({ kind: d.problems.length || d.notFound.length ? "error" : "ok", text: `Imported: ${parts.join(", ") || "nothing new"}.`,
      list: [...d.problems, ...d.notFound.map((n) => `No item on sale is called "${n}"`)] });
    setPaste(null);
    await load();
    await processAll(d.toProcess);
  };

  /** Loads, one after another, every file that still has items the Studio doesn't have. */
  const loadMissing = async () => {
    for (const x of files) if (fileProgress(x, items ?? []).notLoaded.length) await doImport({ file: x.file });
  };

  const act = async (skus: string[], action: ShopAction, opts: { at?: string | null; note?: string } = {}) => {
    setBusy(action); setNote(null);
    const r = await api.shopAction!(skus, action, opts);
    setBusy(null);
    if (!r.ok) return setNote({ kind: "error", text: r.error });
    const { done, refused } = r.data;
    setNote({ kind: refused.length ? "error" : "ok", text: `${done.length} done${refused.length ? `, ${refused.length} refused` : ""}.`, list: refused.map((x) => `${x.sku}: ${x.reason}`) });
    setPicked(new Set());
    await load();
  };

  if (error) return <div className="studio-note error"><span className="body-strong">{error}</span></div>;
  if (!items) return <p className="meta">Loading the Shop…</p>;
  const item = open ? items.find((i) => i.sku === open) : undefined;
  if (item) return <ItemPage api={api} item={item} all={items} busy={busy} onBack={() => setOpen(null)} onChanged={load} act={act} process={processAll} />;

  const selectable = (i: CatalogItem) => i.status === "pending_review" && isReady(i, { others: items });
  // "Select all" picks what can really be sold: locked pieces (the mansion, waiting for Manhattan) are ticked by hand.
  const readyShown = shown.filter((i) => selectable(i) && i.wearable);
  return (
    <section className="stack-16">
      {note && (
        <div className={`studio-note ${note.kind}`}>
          <span className="body-strong">{note.text}</span>
          <button className="chip" onClick={() => setNote(null)}>OK</button>
          {!!note.list?.length && <ul>{note.list.slice(0, 30).map((l) => <li key={l} className="meta">{l}</li>)}</ul>}
        </div>
      )}
      <div className="studio-card stack-12">
        <span className="title">New avatar bodies</span>
        <span className="subtext">They stay off for players until every Shop outfit has a template that fits them. Turn them on here to see them in the game on this device.</span>
        <GraphicsSwitch kind="bodies" onToast={(t) => setNote({ kind: "ok", text: t })} />
      </div>
      <div className="studio-card stack-12">
        <span className="title">What&apos;s in the game</span>
        <span className="subtext">Players only see items that are live (or scheduled and dropped). Everything else is still with you: load it, check it, approve it.</span>
        <div className="shop-overview">
          <button onClick={() => setF({ ...NO_FILTERS, status: "live" })}><strong>{counts.live}</strong><span>Live in the game</span>{lockedLive ? <em>{lockedLive} locked (can&apos;t be bought yet)</em> : null}</button>
          <button onClick={() => setF({ ...NO_FILTERS, status: "scheduled" })}><strong>{counts.scheduled}</strong><span>Scheduled drops</span></button>
          <button className={counts.pending_review ? "todo" : ""} onClick={() => setF({ ...NO_FILTERS, status: "pending_review" })}><strong>{counts.pending_review}</strong><span>Waiting for your review</span></button>
          <button className={counts.draft ? "todo" : ""} onClick={() => setF({ ...NO_FILTERS, status: "draft" })}><strong>{counts.draft}</strong><span>Drafts</span></button>
          <button className={notLoaded ? "todo" : ""} onClick={() => document.getElementById("shop-files")?.scrollIntoView({ behavior: "smooth" })}><strong>{notLoaded}</strong><span>In files, not loaded yet</span></button>
          <button onClick={() => setF({ ...NO_FILTERS, status: "retired" })}><strong>{counts.retired}</strong><span>Retired</span></button>
        </div>
      </div>
      <div className="studio-card stack-12" id="shop-files">
        <span className="title">Import a catalog file</span>
        <span className="subtext">Files merged into content/shop show here. Loading makes drafts and processes their pictures; nothing goes live without your approval.</span>
        {files.map((x) => {
          const fp = fileProgress(x, items);
          const parts = [
            fp.notLoaded.length && `⚠️ ${fp.notLoaded.length} not loaded yet`,
            fp.byStatus.live && `${fp.byStatus.live} live`,
            fp.byStatus.scheduled && `${fp.byStatus.scheduled} scheduled`,
            fp.byStatus.pending_review && `${fp.byStatus.pending_review} need review`,
            fp.byStatus.draft && `${fp.byStatus.draft} drafts`,
            fp.byStatus.retired && `${fp.byStatus.retired} retired`,
          ].filter(Boolean);
          return (
            <div key={x.file} className="row" style={{ gap: 8, justifyContent: "space-between", flexWrap: "wrap" }}>
              <span style={{ minWidth: 0 }}>
                <span className="body-strong">{x.label}</span>
                <span className="meta" style={{ display: "block" }}>{x.file} · {x.items ? `${x.items} items` : ""}{x.items && x.pictures ? " · " : ""}{x.pictures ? `${x.pictures} pictures` : ""}{x.problems.length ? ` · ⚠️ ${x.problems.length} problems` : ""}</span>
                {parts.length > 0 && <span className={`meta${fp.notLoaded.length ? " shop-file-todo" : ""}`} style={{ display: "block" }}>{parts.join(" · ")}</span>}
              </span>
              <button className={`btn btn-sm ${fp.notLoaded.length || !x.items ? "btn-taxi" : "btn-secondary"}`} disabled={busy !== null || !!progress} onClick={() => void doImport({ file: x.file })}>
                {busy === "import" ? "…" : fp.notLoaded.length || !x.items ? "Load" : "Load again"}
              </button>
            </div>
          );
        })}
        {files.some((x) => fileProgress(x, items).notLoaded.length) && (
          <button className="btn btn-taxi btn-sm" style={{ alignSelf: "start" }} disabled={busy !== null || !!progress}
            onClick={() => void loadMissing()}>Load every file with items not loaded yet</button>
        )}
        {paste === null ? (
          <button className="chip" style={{ alignSelf: "start" }} onClick={() => setPaste("")}>Or paste a catalog file</button>
        ) : (
          <>
            <textarea className="studio-input" rows={4} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder='{ "items": [ … ] }' aria-label="Catalog JSON" />
            <button className="btn btn-taxi btn-sm" style={{ alignSelf: "start" }} disabled={!paste.trim() || busy !== null} onClick={() => void doImport({ json: paste })}>Check and import</button>
          </>
        )}
        {progress ? (
          <div className="stack-8" aria-live="polite">
            <span className="meta">Processing pictures: {progress.done} of {progress.total}{progress.failed ? ` (${progress.failed} failed)` : ""}</span>
            <div className="shop-progress"><span style={{ width: `${(100 * progress.done) / progress.total}%` }} /></div>
          </div>
        ) : waiting.length ? (
          <button className="btn btn-secondary btn-sm" style={{ alignSelf: "start" }} onClick={() => void processAll(waiting)}>Process {waiting.length} waiting picture{waiting.length === 1 ? "" : "s"}</button>
        ) : null}
      </div>

      <div className="shop-cats" role="tablist" aria-label="Category">
        <button role="tab" aria-selected={f.tab === "all"} className={f.tab === "all" ? "on" : ""} onClick={() => setF({ ...f, tab: "all" })}>All <span>{inStatus.length}</span></button>
        {SHOP_TABS.map((t) => (
          <button key={t} role="tab" aria-selected={f.tab === t} className={f.tab === t ? "on" : ""} onClick={() => setF({ ...f, tab: t })}>
            {TAB_LABEL[t]} <span>{inStatus.filter((i) => i.tab === t).length}</span>
          </button>
        ))}
      </div>
      <div className="row" style={{ gap: 6, flexWrap: "wrap" }} role="group" aria-label="Status">
        <button className="chip" aria-pressed={f.status === "all"} onClick={() => setF({ ...f, status: "all" })}>Every status {items.length}</button>
        {STATUSES.map((s) => <button key={s} className="chip" aria-pressed={f.status === s} onClick={() => setF({ ...f, status: s })}>{STATUS_LABEL[s]} {counts[s]}</button>)}
      </div>
      <div className="players-bar shop-filters">
        <input className="studio-input" type="search" placeholder="Search by name" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search items" />
        <select className="studio-input" value={f.line} onChange={(e) => setF({ ...f, line: e.target.value })} aria-label="Style line">
          <option value="">Every style line</option>{STYLE_LINES.map((s) => <option key={s} value={s}>{STYLE_LINE_LABEL[s]}</option>)}
        </select>
        <select className="studio-input" value={f.tier} onChange={(e) => setF({ ...f, tier: e.target.value })} aria-label="Tier">
          <option value="">Every tier</option><option value="budget">Budget</option><option value="mid">Mid</option><option value="luxury">Luxury</option>
        </select>
        <select className="studio-input" value={f.pres} onChange={(e) => setF({ ...f, pres: e.target.value })} aria-label="Presentation">
          <option value="">Everyone</option><option value="all">Male and Female</option><option value="f">Female only</option><option value="m">Male only</option>
        </select>
      </div>
      <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
        <button className="chip" aria-pressed={f.money} onClick={() => setF({ ...f, money: !f.money })}>✨ Real money</button>
        <button className="chip" aria-pressed={f.ready} onClick={() => setF({ ...f, ready: !f.ready })}>✅ Ready</button>
        <button className="chip" aria-pressed={f.locked} onClick={() => setF({ ...f, locked: !f.locked })}>🔒 Not wearable yet</button>
      </div>

      {picked.size > 0 && (
        <div className="studio-card shop-bulk">
          <span className="body-strong">{picked.size} selected</span>
          <button className="btn btn-taxi btn-sm" disabled={busy !== null} onClick={() => void act([...picked], "approve")}>Approve now</button>
          <span className="row" style={{ gap: 6, flexWrap: "wrap" }}>
            <input className="studio-input" type="datetime-local" value={dropAt} min={localInput(new Date())} onChange={(e) => setDropAt(e.target.value)} aria-label="Drop time" style={{ width: "auto" }} />
            <button className="btn btn-secondary btn-sm" disabled={!dropAt || busy !== null} onClick={() => void act([...picked], "approve", { at: new Date(dropAt).toISOString() })}>Schedule a drop</button>
          </span>
          <button className="chip" onClick={() => setPicked(new Set())}>Clear</button>
        </div>
      )}

      <div className="row" style={{ gap: 8, flexWrap: "wrap", justifyContent: "space-between" }}>
        <p className="meta" style={{ margin: 0 }}>{shown.length} item{shown.length === 1 ? "" : "s"}{readyShown.length ? ` · ${readyShown.length} ready to sell (tick them to approve together)` : ""}</p>
        {readyShown.length > 0 && (
          <button className="chip" onClick={() => setPicked(new Set(readyShown.map((i) => i.sku)))}>Select all {readyShown.length} ready</button>
        )}
      </div>
      {shown.length === 0 && <div className="studio-card"><p className="meta" style={{ margin: 0 }}>Nothing here.</p></div>}
      <div className="shop-grid">
        {shown.map((i) => <ItemCard key={i.sku} i={i} all={items} busy={busy !== null || !!progress} picked={picked.has(i.sku)} selectable={selectable(i)}
          onPick={(on) => { const n = new Set(picked); if (on) n.add(i.sku); else n.delete(i.sku); setPicked(n); }}
          onOpen={() => setOpen(i.sku)} act={act} process={processAll} />)}
      </div>
    </section>
  );
}

/** One item in the list: its picture, details, where it stands, and the quick actions for its status. */
function ItemCard({ i, all, busy, picked, selectable, onPick, onOpen, act, process }: {
  i: CatalogItem; all: CatalogItem[]; busy: boolean; picked: boolean; selectable: boolean; onPick: (on: boolean) => void; onOpen: () => void;
  act: (skus: string[], action: ShopAction, opts?: { at?: string | null; note?: string }) => Promise<void>; process: (skus: string[]) => Promise<void>;
}) {
  const checks = readiness(i, { others: all });
  const blockers = checks.filter((c) => c.blocking && !c.ok);
  const inGame = i.status === "live" || i.status === "scheduled";
  const where = i.status === "live" ? (i.wearable ? "In the game: on sale" : "In the game, locked: players see it but can't buy it yet")
    : i.status === "scheduled" ? `Drops ${i.goLiveAt ? new Date(i.goLiveAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "soon"}`
    : i.status === "pending_review" ? (blockers.length ? `Not in the game: ${blockers.length} thing${blockers.length === 1 ? "" : "s"} to fix before approval`
      : i.wearable ? "Not in the game: ready for your approval" : "Not in the game: ready, but once approved it shows locked until it works in the game")
    : i.status === "draft" ? (i.note ? `Not in the game: sent back (${i.note})` : i.sourceImage && i.imageStatus !== "ready" ? "Not in the game: its picture needs processing" : "Not in the game: draft")
    : "Retired: off sale, owners keep it";
  return (
    <article className={`shop-item${picked ? " picked" : ""}`}>
      <button className="shop-item-pic" onClick={onOpen} aria-label={`Open ${i.name}`}>
        <ShopArt image={i.images?.card} emoji={i.emoji} size={96} />
      </button>
      <div className="shop-item-body">
        <div className="row" style={{ gap: 8, justifyContent: "space-between", alignItems: "start" }}>
          <button className="shop-item-name" onClick={onOpen}>{i.name}</button>
          {i.status === "pending_review" && <input type="checkbox" aria-label={`Select ${i.name}`} disabled={!selectable} checked={picked} onChange={(e) => onPick(e.target.checked)} />}
        </div>
        <span className="meta">{TAB_LABEL[i.tab]}{i.slot ? ` · ${i.slot}` : ""} · {PRESENTATION_LABEL[i.presentation]}{i.tier ? ` · ${i.tier}` : ""}{i.collection ? ` · ${i.collection}` : ""}</span>
        {i.description && <span className="subtext shop-item-desc">{i.description}</span>}
        <span className="row" style={{ gap: 10 }}>
          <span className="body-strong tabular">{cash(i)}</span>
          <span className="meta tabular">🔥 {i.clout} clout</span>
          {i.editionSize ? <span className="meta">{i.editionSize} made</span> : null}
        </span>
        <span className="players-tags">
          <span className={`players-tag shop-status ${i.status}`}>{STATUS_LABEL[i.status]}</span>
          {i.realCash && <span className="players-tag vip">✨ Real money</span>}
          {!i.wearable && <span className="players-tag">🔒 Locked</span>}
          {i.imageStatus === "failed" && <span className="players-tag flag">Picture failed</span>}
          {i.sold && <span className="players-tag">Owned by players</span>}
        </span>
        <span className={`meta shop-item-where${inGame ? " in" : ""}`}>{where}</span>
        <div className="row shop-item-actions">
          {i.status === "pending_review" && (
            <button className="btn btn-taxi btn-sm" disabled={busy || blockers.length > 0} title={blockers.map((b) => `${b.label}: ${b.detail}`).join("; ") || undefined}
              onClick={() => void act([i.sku], "approve")}>Approve: on sale now</button>
          )}
          {i.status === "draft" && i.sourceImage && i.imageStatus !== "ready" && (
            <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void process([i.sku])}>{i.imageStatus === "failed" ? "Retry picture" : "Process picture"}</button>
          )}
          {i.status === "scheduled" && <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void act([i.sku], "unschedule")}>Back to review</button>}
          {i.status === "live" && <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void act([i.sku], "retire")}>Retire</button>}
          {i.status === "retired" && <button className="btn btn-taxi btn-sm" disabled={busy} onClick={() => void act([i.sku], "restore")}>Restore</button>}
          <button className="chip" onClick={onOpen}>Details and edit</button>
        </div>
      </div>
    </article>
  );
}

function ItemPage({ api, item, all, busy, onBack, onChanged, act, process }: {
  api: StudioApi; item: CatalogItem; all: CatalogItem[]; busy: string | null; onBack: () => void; onChanged: () => Promise<void>;
  act: (skus: string[], action: ShopAction, opts?: { at?: string | null; note?: string }) => Promise<void>; process: (skus: string[]) => Promise<void>;
}) {
  const [log, setLog] = useState<ShopAuditRow[] | null>(null);
  const [edit, setEdit] = useState<Partial<Pick<CatalogItem, EditableField>> | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [backNote, setBackNote] = useState("");
  const [at, setAt] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => { void api.shopAudit!(item.sku).then((r) => r.ok && setLog(r.data)); }, [api, item.sku, item.status, item.updatedAt]);
  const checks = readiness(item, { others: all });
  const ready = checks.every((c) => c.ok || !c.blocking);
  const save = async () => {
    if (!edit) return;
    const r = await api.shopEdit!(item.sku, edit);
    if (!r.ok) return setErr(r.error);
    setErr(null); setEdit(null); await onChanged();
  };
  const field = (k: EditableField, label: string, input: React.ReactNode) => (
    <label className="stack-4"><span className="meta">{label}</span>{input}</label>
  );
  const v = <K extends EditableField>(k: K) => (edit && k in edit ? edit[k] : item[k]) as CatalogItem[K];
  const set = <K extends EditableField>(k: K, val: CatalogItem[K]) => setEdit({ ...(edit ?? {}), [k]: val });
  return (
    <section className="stack-16">
      <button className="chip" style={{ alignSelf: "start" }} onClick={onBack}>← Back to the Shop list</button>
      <div className="studio-card stack-12">
        <div className="row" style={{ gap: 12, alignItems: "flex-start" }}>
          <ShopArt image={item.images?.detail ?? item.images?.card} emoji={item.emoji} size={120} big />
          <span style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
            <span className="title">{item.name}</span>
            <span className="meta">{item.sku} · {STATUS_LABEL[item.status]}{item.status === "scheduled" && item.goLiveAt ? ` for ${new Date(item.goLiveAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}` : ""}</span>
            <span className="meta">{item.file ? `From ${item.file}` : "On sale before the Shop Manager"}{item.collection ? ` · ${item.collection}` : ""}{item.sold ? " · Someone owns it" : ""}</span>
            {item.note && <span className="meta">📝 {item.note}</span>}
          </span>
        </div>
        <div className="shop-previews">
          <ShopCardPreview item={{ ...item, ...(edit ?? {}) } as CatalogItem} />
          <ShopCardPreview item={{ ...item, ...(edit ?? {}) } as CatalogItem} dark />
        </div>
        <ul className="shop-checks">
          {checks.map((c) => <li key={c.id}><span aria-hidden="true">{c.ok ? "✅" : c.blocking ? "⛔" : "⚠️"}</span> <span className="body-strong">{c.label}</span> <span className="meta">{c.detail}</span></li>)}
        </ul>
        {item.sourceImage && item.imageStatus !== "ready" && (
          <button className="btn btn-secondary btn-sm" style={{ alignSelf: "start" }} onClick={() => void process([item.sku])}>{item.imageStatus === "failed" ? "Retry picture" : "Process picture"}</button>
        )}
      </div>

      <div className="studio-card stack-12">
        {item.status === "pending_review" && (
          <>
            <button className="btn btn-taxi" disabled={!ready || busy !== null} onClick={() => void act([item.sku], "approve")}>Approve: on sale now</button>
            <span className="row" style={{ gap: 6, flexWrap: "wrap" }}>
              <input className="studio-input" type="datetime-local" value={at} min={localInput(new Date())} onChange={(e) => setAt(e.target.value)} aria-label="Go-live time" style={{ width: "auto" }} />
              <button className="btn btn-secondary btn-sm" disabled={!ready || !at || busy !== null} onClick={() => void act([item.sku], "approve", { at: new Date(at).toISOString() })}>Schedule a drop (with Lola's News item)</button>
            </span>
            <span className="row" style={{ gap: 6, flexWrap: "wrap" }}>
              <input className="studio-input" value={backNote} onChange={(e) => setBackNote(e.target.value)} placeholder="Note for the writer" aria-label="Note" />
              <button className="btn btn-secondary btn-sm" disabled={!backNote.trim() || busy !== null} onClick={() => void act([item.sku], "send_back", { note: backNote })}>Send back</button>
            </span>
          </>
        )}
        {item.status === "scheduled" && <button className="btn btn-secondary btn-sm" onClick={() => void act([item.sku], "unschedule")}>Back to review</button>}
        {item.status === "live" && <button className="btn btn-secondary btn-sm" onClick={() => void act([item.sku], "retire")}>Retire: stop selling (owners keep it)</button>}
        {item.status === "retired" && <button className="btn btn-taxi btn-sm" onClick={() => void act([item.sku], "restore")}>Restore: back on sale</button>}
        {item.edition && <DropControl api={api} sku={item.sku} edition={item.edition} onChanged={onChanged} />}
        {MAP_SKUS.has(item.sku) && api.shopCoutureOwners && <CoutureOwners api={api} sku={item.sku} />}
        {item.status !== "scheduled" && (
          confirmDelete ? (
            <span className="row" style={{ gap: 6 }}>
              <span className="meta">Delete {item.name} for good?</span>
              <button className="btn btn-secondary btn-sm" onClick={() => { setConfirmDelete(false); void act([item.sku], "delete").then(onBack); }}>Delete</button>
              <button className="chip" onClick={() => setConfirmDelete(false)}>Keep it</button>
            </span>
          ) : (
            <button className="chip" style={{ alignSelf: "start" }} disabled={item.sold} title={item.sold ? "Someone owns this: retire it instead" : undefined} onClick={() => setConfirmDelete(true)}>
              {item.sold ? "Can't delete: someone owns it (retire instead)" : "Delete"}
            </button>
          )
        )}
      </div>

      <div className="studio-card stack-12">
        <span className="title">Edit</span>
        {err && <span className="error-text">{err}</span>}
        <div className="shop-edit">
          {field("name", "Name", <input className="studio-input" value={v("name")} onChange={(e) => set("name", e.target.value)} />)}
          {field("emoji", "Emoji (shown without a picture)", <input className="studio-input" value={v("emoji")} onChange={(e) => set("emoji", e.target.value)} />)}
          {field("description", "Description", <textarea className="studio-input" rows={2} value={v("description")} onChange={(e) => set("description", e.target.value)} />)}
          {item.realCash
            ? field("priceUsdCents", "Price ($): the next checkout uses it; past buyers aren't touched", <input className="studio-input" type="number" step="0.01" min="0.5" value={((v("priceUsdCents") ?? 0) / 100).toFixed(2)} onChange={(e) => set("priceUsdCents", Math.round(Number(e.target.value) * 100))} />)
            : field("price", "Price (C$)", <input className="studio-input" type="number" min="1" value={v("price")} onChange={(e) => set("price", Math.round(Number(e.target.value)))} />)}
          {field("clout", `Clout (the curve says ${cloutCurve(v("price"))})`, <input className="studio-input" type="number" min="0" value={v("clout")} onChange={(e) => set("clout", Math.round(Number(e.target.value)))} />)}
          {item.realCash && field("editionSize", "Edition size per drop", <input className="studio-input" type="number" min="1" value={v("editionSize") ?? ""} onChange={(e) => set("editionSize", e.target.value ? Math.round(Number(e.target.value)) : null)} />)}
          {field("tab", "Tab", <select className="studio-input" value={v("tab")} onChange={(e) => set("tab", e.target.value as ShopTab)}>{SHOP_TABS.map((t) => <option key={t} value={t}>{TAB_LABEL[t]}</option>)}</select>)}
          {field("slot", "Slot", <select className="studio-input" value={v("slot") ?? ""} onChange={(e) => set("slot", e.target.value || null)}><option value="">None</option>{SLOTS[v("tab")].map((s) => <option key={s} value={s}>{s}</option>)}</select>)}
          {field("presentation", "Presentation", <select className="studio-input" value={v("presentation")} onChange={(e) => set("presentation", e.target.value as CatalogItem["presentation"])}>{(["all", "f", "m"] as const).map((p) => <option key={p} value={p}>{PRESENTATION_LABEL[p]}</option>)}</select>)}
          {field("tier", "Tier", <select className="studio-input" value={v("tier") ?? ""} onChange={(e) => set("tier", (e.target.value || null) as CatalogItem["tier"])}><option value="">None</option><option value="budget">Budget</option><option value="mid">Mid</option><option value="luxury">Luxury</option></select>)}
          {field("stars", "Stars", <select className="studio-input" value={v("stars")} onChange={(e) => set("stars", Number(e.target.value))}>{[1, 2, 3, 4].map((s) => <option key={s} value={s}>{"★".repeat(s)}</option>)}</select>)}
        </div>
        <div className="row" style={{ gap: 6, flexWrap: "wrap" }} role="group" aria-label="Style lines">
          {STYLE_LINES.map((s) => {
            const on = v("styleLines").includes(s);
            return <button key={s} className="chip" aria-pressed={on} onClick={() => set("styleLines", on ? v("styleLines").filter((x) => x !== s) : [...v("styleLines"), s])}>{STYLE_LINE_LABEL[s as StyleLine]}</button>;
          })}
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn btn-taxi btn-sm" disabled={!edit} onClick={() => void save()}>Save changes</button>
          {edit && <button className="chip" onClick={() => { setEdit(null); setErr(null); }}>Undo</button>}
        </div>
      </div>

      <div className="studio-card stack-8">
        <span className="title">History</span>
        {!log ? <span className="meta">Loading…</span> : log.length === 0 ? <span className="meta">No changes yet.</span> : log.map((a, n) => (
          <div key={n} className="meta">
            <span className="body-strong">{a.action.replace(/_/g, " ")}</span> · {new Date(a.at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
            {a.note ? ` · ${a.note}` : ""}
            {a.action === "edit" && a.after ? ` · ${Object.keys(a.after as object).filter((k) => (EDITABLE as readonly string[]).includes(k)).join(", ")}` : ""}
          </div>
        ))}
      </div>
    </section>
  );
}

/** Clout Couture (migration 0102): where the drop stands, and the next drop once it has sold out (numbering continues). */
function DropControl({ api, sku, edition, onChanged }: { api: StudioApi; sku: string; edition: Edition; onChanged: () => Promise<void> | void }) {
  const [size, setSize] = useState(String(edition.size));
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const n = Number(size);
  return (
    <span className="stack-8">
      <span className="meta">
        Numbered: {editionLine(edition)} · {serialLabel(1 + edition.dropEnd - edition.size)} to {serialLabel(edition.dropEnd)} · {edition.issued} issued in all
      </span>
      {edition.soldOut && api.shopNewDrop && (
        <span className="row" style={{ gap: 6, flexWrap: "wrap" }}>
          <input className="studio-input" type="number" min={1} value={size} onChange={(e) => setSize(e.target.value)} aria-label="Copies in the next drop" style={{ width: 90 }} />
          <button className="btn btn-taxi btn-sm" disabled={busy || !(n >= 1)} onClick={async () => {
            setBusy(true); setMsg(null);
            const r = await api.shopNewDrop!(sku, n);
            setBusy(false);
            if (!r.ok) return setMsg(r.error);
            setMsg(`Drop ${edition.drop + 1} is on sale, with Lola's News item.`);
            await onChanged();
          }}>Open drop {edition.drop + 1} ({n >= 1 ? n : "?"} copies)</button>
        </span>
      )}
      {msg && <span className="meta">{msg}</span>}
    </span>
  );
}

/**
 * Clout Couture on the map (migration 0104): who owns this yacht, jet or statue and the name the map shows. A name on a
 * hull or banner can be hidden (the edition number shows instead); the week's statue can come off the plaza (refund it in
 * Stripe if that's the call).
 */
function CoutureOwners({ api, sku }: { api: StudioApi; sku: string }) {
  const [owners, setOwners] = useState<CoutureOwner[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const load = useCallback(async () => {
    const r = await api.shopCoutureOwners!(sku);
    if (r.ok) setOwners(r.data); else setMsg(r.error);
  }, [api, sku]);
  useEffect(() => { void load(); }, [load]);
  if (!owners) return msg ? <span className="meta">{msg}</span> : null;
  const plaza = sku === "plaza-statue";
  return (
    <span className="stack-8">
      <span className="body-strong">{plaza ? "Statues and their weeks" : "On the map"}</span>
      {!owners.length && <span className="meta">Nobody owns one yet.</span>}
      {owners.map((o) => (
        <span key={o.player} className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span className="meta" style={{ flex: 1, minWidth: 160 }}>
            {o.edition ? `No. ${String(o.edition).padStart(4, "0")} · ` : ""}{o.displayName}{o.hidden ? ` (shows as ${o.shown})` : ""}{plaza ? ` · ${o.week ?? "not booked"}` : ""}
          </span>
          {!plaza && api.shopCoutureName && (
            <button className="chip" onClick={async () => {
              const r = await api.shopCoutureName!(o.player, sku, !o.hidden);
              setMsg(r.ok ? (o.hidden ? `${o.displayName}'s name is back.` : `${o.displayName}'s name is hidden.`) : r.error);
              await load();
            }}>{o.hidden ? "Show name" : "Hide name"}</button>
          )}
          {plaza && o.week && api.shopPlazaRemove && (
            <>
              <input className="studio-input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason" aria-label="Reason" style={{ width: 160 }} />
              <button className="chip" disabled={!reason.trim()} onClick={async () => {
                const r = await api.shopPlazaRemove!(o.week!, reason);
                setMsg(r.ok ? "Off the plaza. Refund it in Stripe if that's the call." : r.error);
                setReason("");
                await load();
              }}>Take it down</button>
            </>
          )}
        </span>
      ))}
      {msg && <span className="meta">{msg}</span>}
    </span>
  );
}
