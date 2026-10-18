"use client";

// Studio → Affiliates (spec section 21, step 1; migration 0087): the creators we work with and their /c/<slug>
// links. Admins add creators (rate, length, welcome gift), make custom links, copy them or show a QR code, and
// retire them. Numbers here are clicks and sign-ups; money columns come with commissions (step 2).

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import QRCode from "qrcode";
import {
  GIFT_DEFAULT, GIFT_MAX, LANDS, LENGTHS, RATE, cleanSlug, conversion, creatorUrl, giftItems, landsLabel, lengthLabel,
  normalizeCreatorCode, slugProblem, type Affiliates, type Creator, type CreatorInput, type CreatorLink, type Lands, type Length, type LinkInput,
} from "@/lib/creators";
import { itemBySku } from "@/lib/city";
import type { StudioApi } from "@/lib/studio";

const PERIODS = [7, 30, 90, 0] as const;
const n = (x: number) => x.toLocaleString("en-US");
const pct = (x: number | null) => (x === null ? "–" : `${x}%`);
const origin = () => (process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== "undefined" ? window.location.origin : "")).replace(/\/+$/, "");
const giftText = (c: Pick<Creator, "giftCash" | "giftItem">) =>
  [c.giftCash > 0 ? `C$${n(c.giftCash)}` : null, c.giftItem ? itemBySku(c.giftItem)?.name ?? c.giftItem : null].filter(Boolean).join(" + ") || "None";

export function AffiliatesTab({ api, preview = false }: { api: StudioApi; preview?: boolean }) {
  const [view, setView] = useState<"creators" | "links">("creators");
  const [days, setDays] = useState<(typeof PERIODS)[number]>(30);
  const [data, setData] = useState<Affiliates | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const [editing, setEditing] = useState<Creator | "new" | null>(null);
  useEffect(() => {
    let stop = false;
    void api.affiliates!(days).then((r) => { if (!stop) { if (r.ok) { setData(r.data); setError(null); } else setError(r.error); } });
    return () => { stop = true; };
  }, [api, days, nonce]);
  const reload = (message?: string) => { setOk(message ?? null); setNonce((x) => x + 1); };

  const creators = data?.creators ?? [];
  const totals = useMemo(() => creators.reduce((t, c) => ({ clicks: t.clicks + c.clicks, signups: t.signups + c.signups, byCode: t.byCode + c.byCode }), { clicks: 0, signups: 0, byCode: 0 }), [creators]);
  const period = days === 0 ? "All time" : `Last ${days} days`;

  if (editing) {
    return (
      <CreatorForm
        api={api}
        creator={editing === "new" ? null : editing}
        taken={creators.filter((c) => editing === "new" || c.id !== editing.id).map((c) => c.code)}
        onBack={() => setEditing(null)}
        onSaved={(message) => { setEditing(null); reload(message); }}
      />
    );
  }
  return (
    <section className="stack-16">
      <div className="row" style={{ gap: 8, flexWrap: "wrap", justifyContent: "space-between", alignItems: "center" }}>
        <div className="row" style={{ gap: 6 }} role="group" aria-label="View">
          <button className="chip" aria-pressed={view === "creators"} onClick={() => setView("creators")}>Creators</button>
          <button className="chip" aria-pressed={view === "links"} onClick={() => setView("links")}>Links</button>
        </div>
        <div className="row" style={{ gap: 6, flexWrap: "wrap" }} role="group" aria-label="Period">
          {PERIODS.map((p) => <button key={p} className="chip" aria-pressed={days === p} onClick={() => setDays(p)}>{p === 0 ? "All time" : `Last ${p} days`}</button>)}
        </div>
      </div>
      {preview && <p className="meta" style={{ margin: 0 }}>Preview: sample creators; nothing is saved.</p>}
      {error && <div className="studio-note error"><span className="body-strong">{error}</span></div>}
      {ok && <div className="studio-note ok"><span className="body-strong">{ok}</span><button className="chip" onClick={() => setOk(null)}>OK</button></div>}
      {!data && !error && <p className="meta">Loading…</p>}
      {data && (<>
        <div className="studio-tiles aff-tiles">
          {([
            ["Active creators", n(creators.filter((c) => c.status === "active").length), `${n(creators.length)} in all`],
            ["Clicks", n(totals.clicks), period],
            ["Sign-ups", n(totals.signups), `${n(totals.byCode)} typed a code`],
            ["Click to sign-up", pct(conversion(totals.signups - totals.byCode, totals.clicks)), "through links"],
          ] as const).map(([label, value, sub]) => (
            <div key={label} className="studio-card studio-tile">
              <span className="overline">{label}</span>
              <span className="display-lg tabular">{value}</span>
              <span className="meta">{sub}</span>
            </div>
          ))}
        </div>
        {view === "creators"
          ? <CreatorsTable creators={creators} onAdd={() => setEditing("new")} onOpen={setEditing} />
          : <LinksView api={api} creators={creators} onChanged={reload} onError={setError} />}
      </>)}
    </section>
  );
}

function CreatorsTable({ creators, onAdd, onOpen }: { creators: Creator[]; onAdd: () => void; onOpen: (c: Creator) => void }) {
  return (
    <div className="studio-card stack-12">
      <div className="row" style={{ justifyContent: "space-between", gap: 8 }}>
        <span className="overline">Creators</span>
        <button className="btn btn-taxi btn-sm" onClick={onAdd}>＋ Add a creator</button>
      </div>
      {creators.length === 0 ? (
        <p className="meta" style={{ margin: 0 }}>No creators yet. Add the first one; their main link is made from their code.</p>
      ) : (
        <div className="insights-table-wrap">
          <table className="insights-table aff-table">
            <thead><tr>
              <th scope="col">Creator</th><th scope="col">Code</th><th scope="col">Rate</th><th scope="col">Length</th><th scope="col">Welcome gift</th>
              <th scope="col">Clicks</th><th scope="col">Sign-ups</th><th scope="col">Click → sign-up</th><th scope="col">Status</th>
            </tr></thead>
            <tbody>
              {creators.map((c) => (
                <tr key={c.id} className="aff-row" onClick={() => onOpen(c)} tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") onOpen(c); }}>
                  <td><span className="body-strong">{c.name}</span>{c.handle && <span className="meta" style={{ display: "block" }}>{c.handle}</span>}</td>
                  <td><code className="aff-code">{c.code}</code></td>
                  <td className="tabular">{c.rate}%{c.rate >= RATE.high && <span className="aff-tag high">High</span>}</td>
                  <td>{lengthLabel(c.months)}</td>
                  <td>{giftText(c)}</td>
                  <td className="tabular">{n(c.clicks)}</td>
                  <td className="tabular">{n(c.signups)}{c.byCode > 0 && <span className="meta"> ({n(c.byCode)} code)</span>}</td>
                  <td className="tabular">{pct(conversion(c.signups - c.byCode, c.clicks))}</td>
                  <td><span className={`aff-tag ${c.status}`}>{c.status === "active" ? "Active" : "Paused"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="meta" style={{ margin: 0 }}>Tap a creator to change their rate, length or gift. A new rate applies to payments from then on; a player keeps the length set when they signed up.</p>
    </div>
  );
}

function CreatorForm({ api, creator, taken, onBack, onSaved }: { api: StudioApi; creator: Creator | null; taken: string[]; onBack: () => void; onSaved: (message: string) => void }) {
  const [f, setF] = useState<CreatorInput>(() => creator ? {
    id: creator.id, name: creator.name, handle: creator.handle ?? "", email: creator.email ?? "", code: creator.code, rate: creator.rate,
    months: creator.months, giftCash: creator.giftCash, giftItem: creator.giftItem, status: creator.status, termsAt: creator.termsAt ?? "", note: creator.note ?? "",
  } : { name: "", handle: "", email: "", code: "", rate: RATE.base, months: 24, giftCash: GIFT_DEFAULT, giftItem: null, status: "active", termsAt: "", note: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof CreatorInput>(k: K, v: CreatorInput[K]) => setF((x) => ({ ...x, [k]: v }));
  const code = normalizeCreatorCode(f.code);
  const codeTaken = !!code && taken.includes(code);
  const customRate = f.rate !== RATE.base && f.rate !== RATE.high;
  const problem = !f.name.trim() ? "Give the creator a name." : !code ? "Codes are 3 to 16 letters and numbers." : codeTaken ? "Another creator already has that code."
    : !(f.rate >= 0 && f.rate <= RATE.max) ? `The rate goes from 0 to ${RATE.max}%.` : !(f.giftCash >= 0 && f.giftCash <= GIFT_MAX) ? `The gift goes up to C$${n(GIFT_MAX)}.` : null;
  const save = async () => {
    if (problem || !code) return setError(problem);
    setBusy(true);
    setError(null);
    const r = await api.creatorSave!({ ...f, code });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    onSaved(creator ? `Saved ${f.name.trim()}.` : `Added ${f.name.trim()}. Their link is ${creatorUrl(origin(), code.toLowerCase())}.`);
  };
  return (
    <section className="stack-16">
      <button className="chip" style={{ alignSelf: "flex-start" }} onClick={onBack}>‹ All creators</button>
      <div className="studio-card stack-16 aff-form">
        <h2 className="display-md" style={{ margin: 0 }}>{creator ? creator.name : "Add a creator"}</h2>
        <div className="aff-grid">
          <label className="stack-4"><span className="overline">Name</span><input className="studio-input" value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Tasha Glow" maxLength={60} /></label>
          <label className="stack-4"><span className="overline">Handle</span><input className="studio-input" value={f.handle} onChange={(e) => set("handle", e.target.value)} placeholder="@tashaglow on TikTok" maxLength={60} /></label>
          <label className="stack-4"><span className="overline">Email (their creator page sign-in)</span><input className="studio-input" type="email" value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="tasha@example.com" maxLength={200} /></label>
          <label className="stack-4">
            <span className="overline">Creator code</span>
            <input className="studio-input aff-code-input" value={f.code} onChange={(e) => set("code", e.target.value.toUpperCase())} placeholder="TASHA" maxLength={16} aria-invalid={codeTaken || (!!f.code && !code)} />
            <span className={codeTaken || (f.code && !code) ? "error-text" : "meta"}>
              {codeTaken ? "Taken." : f.code && !code ? "3 to 16 letters and numbers." : creator ? "Typed at sign-up. Their links stay as they are." : `Typed at sign-up. Their first link: /c/${(code ?? "code").toLowerCase()}`}
            </span>
          </label>
        </div>

        <div className="stack-8">
          <span className="overline">Rate (on net revenue)</span>
          <div className="row" style={{ gap: 6, flexWrap: "wrap", alignItems: "center" }} role="group" aria-label="Rate">
            <button className="chip" aria-pressed={f.rate === RATE.base} onClick={() => set("rate", RATE.base)}>{RATE.base}% · base</button>
            <button className="chip" aria-pressed={f.rate === RATE.high} onClick={() => set("rate", RATE.high)}>{RATE.high}% · high performer</button>
            <label className="row aff-rate" style={{ gap: 6 }}>
              <span className="meta">Custom</span>
              <input className="studio-input" type="number" min={0} max={RATE.max} step={0.5} value={f.rate} onChange={(e) => set("rate", Number(e.target.value))} aria-label="Custom rate" data-custom={customRate} />
              <span className="meta">%</span>
            </label>
          </div>
        </div>

        <div className="stack-8">
          <span className="overline">How long they earn on each player</span>
          <div className="row" style={{ gap: 6, flexWrap: "wrap" }} role="group" aria-label="Length">
            {LENGTHS.map((l) => <button key={String(l.months)} className="chip" aria-pressed={f.months === l.months} onClick={() => set("months", l.months as Length)}>{l.label}</button>)}
          </div>
          <span className="meta">Counted from each player&apos;s sign-up, renewals included.</span>
        </div>

        <div className="aff-grid">
          <label className="stack-4">
            <span className="overline">Welcome gift: C$</span>
            <input className="studio-input" type="number" min={0} max={GIFT_MAX} step={50} value={f.giftCash} onChange={(e) => set("giftCash", Number(e.target.value))} />
          </label>
          <label className="stack-4">
            <span className="overline">Welcome gift: Shop item</span>
            <select className="studio-input" value={f.giftItem ?? ""} onChange={(e) => set("giftItem", e.target.value || null)}>
              <option value="">No item</option>
              {giftItems().map((i) => <option key={i.sku} value={i.sku}>{i.emoji} {i.name} (C${n(i.price)})</option>)}
            </select>
          </label>
          <label className="stack-4"><span className="overline">Terms agreed on</span><input className="studio-input" type="date" value={f.termsAt} onChange={(e) => set("termsAt", e.target.value)} /></label>
          <label className="stack-4">
            <span className="overline">Status</span>
            <select className="studio-input" value={f.status} onChange={(e) => set("status", e.target.value as CreatorInput["status"])}>
              <option value="active">Active</option>
              <option value="paused">Paused: links still land, nothing counts</option>
            </select>
          </label>
        </div>
        <label className="stack-4"><span className="overline">Note (admins only)</span><textarea className="studio-input" rows={2} value={f.note} onChange={(e) => set("note", e.target.value)} maxLength={500} placeholder="Deal terms, who manages them, anything worth remembering" /></label>

        <p className="meta" style={{ margin: 0 }}>The gift is in-game only (C$ and a Shop piece, paid once at sign-up). Never VIP or anything sold for real money.</p>
        {error && <p className="error-text" role="alert" style={{ margin: 0 }}>{error}</p>}
        <div className="row" style={{ gap: 8 }}>
          <button className="btn btn-taxi btn-sm" disabled={busy || !!problem} onClick={() => void save()}>{busy ? "Saving…" : creator ? "Save changes" : "Add creator"}</button>
          <button className="btn btn-secondary btn-sm" onClick={onBack}>Cancel</button>
        </div>
      </div>
      {creator && (
        <div className="studio-card stack-8">
          <span className="overline">{creator.name}&apos;s links</span>
          {creator.links.map((l) => (
            <div key={l.id} className="aff-link-line">
              <code className="aff-code">/c/{l.slug}</code>
              <span className="meta">{l.label} · lands on {landsLabel(l.lands).toLowerCase()}{l.status === "retired" ? " · retired" : ""}</span>
              <span className="tabular meta">{n(l.clicks)} clicks · {n(l.signups)} sign-ups</span>
            </div>
          ))}
          <p className="meta" style={{ margin: 0 }}>Make more links in the Links view.</p>
        </div>
      )}
    </section>
  );
}

function LinksView({ api, creators, onChanged, onError }: { api: StudioApi; creators: Creator[]; onChanged: (message?: string) => void; onError: (e: string) => void }) {
  const [showRetired, setShowRetired] = useState(false);
  const [qr, setQr] = useState<{ link: CreatorLink; creator: Creator } | null>(null);
  const [copied, setCopied] = useState<number | null>(null);
  const rows = creators.flatMap((c) => c.links.map((l) => ({ c, l }))).filter(({ l }) => showRetired || l.status === "active")
    .sort((a, b) => b.l.clicks - a.l.clicks || b.l.createdAt.localeCompare(a.l.createdAt));
  const retiredCount = creators.reduce((t, c) => t + c.links.filter((l) => l.status === "retired").length, 0);
  const copy = async (l: CreatorLink) => {
    try { await navigator.clipboard.writeText(creatorUrl(origin(), l.slug)); setCopied(l.id); setTimeout(() => setCopied(null), 1500); }
    catch { onError("Couldn't copy. Select the link and copy it by hand."); }
  };
  const status = async (l: CreatorLink, s: "active" | "retired") => {
    const r = await api.linkStatus!(l.id, s);
    if (!r.ok) return onError(r.error);
    onChanged(s === "retired" ? `Retired /c/${l.slug}. It still lands visitors in the city, but stops counting.` : `/c/${l.slug} counts again.`);
  };
  return (
    <div className="stack-16">
      {creators.length > 0 ? <NewLink api={api} creators={creators} onCreated={onChanged} /> : <p className="meta">Add a creator first; links belong to a creator.</p>}
      <div className="studio-card stack-12">
        <div className="row" style={{ justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          <span className="overline">Links</span>
          {retiredCount > 0 && <button className="chip" aria-pressed={showRetired} onClick={() => setShowRetired((x) => !x)}>Show retired ({retiredCount})</button>}
        </div>
        {rows.length === 0 ? <p className="meta" style={{ margin: 0 }}>No links yet.</p> : (
          <div className="insights-table-wrap">
            <table className="insights-table aff-table">
              <thead><tr>
                <th scope="col">Link</th><th scope="col">Creator</th><th scope="col">Lands on</th><th scope="col">Campaign</th>
                <th scope="col">Clicks</th><th scope="col">Sign-ups</th><th scope="col">Click → sign-up</th><th scope="col"><span className="sr-only">Actions</span></th>
              </tr></thead>
              <tbody>
                {rows.map(({ c, l }) => (
                  <tr key={l.id} className={l.status === "retired" ? "aff-retired" : undefined}>
                    <td><code className="aff-code">/c/{l.slug}</code><span className="meta" style={{ display: "block" }}>{l.label}{l.status === "retired" ? " · retired" : ""}</span></td>
                    <td>{c.name}{c.status === "paused" && <span className="aff-tag paused" style={{ marginLeft: 6 }}>Paused</span>}</td>
                    <td>{landsLabel(l.lands)}</td>
                    <td>{l.campaign ?? "–"}{l.videoUrl && <> · <a href={l.videoUrl} target="_blank" rel="noreferrer">video</a></>}</td>
                    <td className="tabular">{n(l.clicks)}</td>
                    <td className="tabular">{n(l.signups)}</td>
                    <td className="tabular">{pct(conversion(l.signups, l.clicks))}</td>
                    <td>
                      <span className="row" style={{ gap: 4, flexWrap: "nowrap" }}>
                        <button className="chip" onClick={() => void copy(l)}>{copied === l.id ? "Copied" : "Copy"}</button>
                        <button className="chip" onClick={() => setQr({ link: l, creator: c })}>QR</button>
                        {l.status === "active"
                          ? <button className="chip" onClick={() => void status(l, "retired")}>Retire</button>
                          : <button className="chip" onClick={() => void status(l, "active")}>Bring back</button>}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="meta" style={{ margin: 0 }}>Links are never deleted, so an old video&apos;s numbers stay. A retired link still lands visitors in the city; it just stops counting clicks and sign-ups.</p>
      </div>
      {qr && <QrCard link={qr.link} creator={qr.creator} onClose={() => setQr(null)} />}
    </div>
  );
}

function NewLink({ api, creators, onCreated }: { api: StudioApi; creators: Creator[]; onCreated: (message?: string) => void }) {
  const blank = (creatorId: string): LinkInput => ({ creatorId, slug: "", label: "", lands: "home", campaign: "", videoUrl: "" });
  const [f, setF] = useState<LinkInput>(() => blank(creators.find((c) => c.status === "active")?.id ?? creators[0].id));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof LinkInput>(k: K, v: LinkInput[K]) => setF((x) => ({ ...x, [k]: v }));
  const slug = cleanSlug(f.slug);
  const taken = creators.some((c) => c.links.some((l) => l.slug === slug));
  const problem = slug ? (slugProblem(slug) ?? (taken ? "That link is taken. Links are never deleted, so pick another." : null)) : null;
  const creator = creators.find((c) => c.id === f.creatorId);
  const suggest = creator ? `${creator.code.toLowerCase()}-` : "";
  const create = async () => {
    if (!slug || problem) return;
    setBusy(true);
    setError(null);
    const r = await api.linkSave!({ ...f, slug, label: f.label.trim() || "Link" });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setF(blank(f.creatorId));
    onCreated(`Made ${creatorUrl(origin(), slug)}. Copy it from the list.`);
  };
  return (
    <div className="studio-card stack-12">
      <span className="overline">Make a link</span>
      <div className="aff-grid">
        <label className="stack-4">
          <span className="overline">Creator</span>
          <select className="studio-input" value={f.creatorId} onChange={(e) => set("creatorId", e.target.value)}>
            {creators.map((c) => <option key={c.id} value={c.id}>{c.name}{c.status === "paused" ? " (paused)" : ""}</option>)}
          </select>
        </label>
        <label className="stack-4">
          <span className="overline">Link</span>
          <span className="aff-slug">
            <span className="meta">/c/</span>
            <input className="studio-input" value={f.slug} onChange={(e) => set("slug", e.target.value)} onFocus={() => { if (!f.slug) set("slug", suggest); }}
              placeholder={`${suggest}tiktok`} maxLength={40} aria-invalid={!!problem} />
          </span>
          <span className={problem ? "error-text" : "meta"}>{problem ?? (slug ? creatorUrl(origin(), slug) : "Letters, numbers and hyphens.")}</span>
        </label>
        <label className="stack-4"><span className="overline">Label</span><input className="studio-input" value={f.label} onChange={(e) => set("label", e.target.value)} placeholder="TikTok bio, Halloween video" maxLength={60} /></label>
        <label className="stack-4">
          <span className="overline">Lands on</span>
          <select className="studio-input" value={f.lands} onChange={(e) => set("lands", e.target.value as Lands)}>
            {LANDS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
          </select>
        </label>
        <label className="stack-4"><span className="overline">Campaign (optional)</span><input className="studio-input" value={f.campaign} onChange={(e) => set("campaign", e.target.value)} placeholder="Halloween" maxLength={60} /></label>
        <label className="stack-4"><span className="overline">Video link (optional)</span><input className="studio-input" type="url" value={f.videoUrl} onChange={(e) => set("videoUrl", e.target.value)} placeholder="https://…" maxLength={300} /></label>
      </div>
      <p className="meta" style={{ margin: 0 }}>Guests land on the city with sign-up ready; players who already have an account go straight to that screen.</p>
      {error && <p className="error-text" role="alert" style={{ margin: 0 }}>{error}</p>}
      <button className="btn btn-taxi btn-sm" style={{ alignSelf: "flex-start" }} disabled={busy || !slug || !!problem} onClick={() => void create()}>{busy ? "Making…" : "Make link"}</button>
    </div>
  );
}

function QrCard({ link, creator, onClose }: { link: CreatorLink; creator: Creator; onClose: () => void }) {
  const url = creatorUrl(origin(), link.slug);
  const [svg, setSvg] = useState<string | null>(null);
  const [png, setPng] = useState<string | null>(null);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);
  useEffect(() => {
    const opts = { margin: 2, color: { dark: "#14111A", light: "#FFFFFF" }, errorCorrectionLevel: "M" as const };
    void QRCode.toString(url, { ...opts, type: "svg" }).then(setSvg);
    void QRCode.toDataURL(url, { ...opts, width: 1024 }).then(setPng);
  }, [url]);
  return (
    createPortal(<div className="aff-qr-back" onClick={onClose}>
    <div className="studio-card stack-12 aff-qr" role="dialog" aria-modal="true" aria-label={`QR code for ${url}`} onClick={(e) => e.stopPropagation()}>
      <div className="row" style={{ justifyContent: "space-between", gap: 8 }}>
        <span className="overline">QR code · {creator.name}</span>
        <button className="chip" onClick={onClose} aria-label="Close">✕</button>
      </div>
      {/* The library's own SVG markup for our URL. */}
      {svg ? <div className="aff-qr-img" dangerouslySetInnerHTML={{ __html: svg }} /> : <p className="meta">Drawing…</p>}
      <code className="aff-code" style={{ alignSelf: "center" }}>{url}</code>
      {png && <a className="btn btn-secondary btn-sm" style={{ alignSelf: "center" }} href={png} download={`clout-city-${link.slug}.png`}>Save as PNG</a>}
    </div>
    </div>, document.body)
  );
}
