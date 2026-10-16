"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { TV, tvDay, tvTime, type TvApi, type TvFeature, type TvMine, type TvState } from "@/lib/cloutTv";
import { cleanHandle as cleanTvHandle } from "@/lib/radio";
import { openPhoto } from "@/lib/tvUpload";
import { PhotoCropper } from "./PhotoCropper";
import { handle as at } from "@/lib/validation";
import { ChevronRightIcon, CloseIcon } from "../icons";

// v0.14 Clout TV (migration 0058): "Make it to the big screen". The Clout TV app on the Phone (today's
// featured player, past features, your own photos, the submit form), the full-photo viewer, and the
// home card on a featured day.

const MINE_NOTE: Record<TvMine["status"], string> = {
  pending: "Waiting for the producers. If it's picked, it goes into the rotation.",
  approved: "Picked! It's in the rotation: one photo goes up every 3 hours. You'll get a text when it's yours.",
  featured: "You were on the Big Screen",
  rejected: "Not this time. Try another photo tomorrow.",
  withdrawn: "Withdrawn.",
  taken_down: "Taken off the Big Screen.",
};

/** The station's bumper: a lit screen with the logo, scanlines and a red REC dot. */
export function TvBumper() {
  return (
    <div className="tv-bumper" aria-hidden="true">
      <span className="tv-bumper-rec">● LIVE</span>
      <span className="tv-bumper-logo">CLOUT<b>TV</b></span>
      <span className="tv-bumper-sub">Make it to the Big Screen</span>
    </div>
  );
}

/** Falling confetti that swings like pendulums (owner, Oct 16). Generated once per open; skipped with Reduce Motion (CSS). */
function Confetti() {
  const [pieces] = useState(() => {
    const colors = ["#FA2D48", "#FFC21A", "#7FE3F0", "#FFF3DE", "#FF6A3D"];
    let seed = Date.now() % 9973;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    return Array.from({ length: 44 }, (_, i) => ({
      i,
      left: rnd() * 96 + 2,
      fall: 3.4 + rnd() * 1.8,
      delay: rnd() * 2,
      w: [6, 8, 10][Math.floor(rnd() * 3)],
      h: [4, 5, 12][Math.floor(rnd() * 3)],
      color: colors[Math.floor(rnd() * colors.length)],
      swing: (28 + rnd() * 20) * (rnd() < 0.5 ? -1 : 1),
      arm: -(30 + rnd() * 25),
      period: 0.9 + rnd() * 0.5,
    }));
  });
  return (
    <div className="tv-confetti" aria-hidden="true">
      {pieces.map((p) => (
        <i key={p.i} style={{ left: `${p.left}%`, animationDuration: `${p.fall}s`, animationDelay: `${p.delay}s` }}>
          <s style={{ width: p.w, height: p.h, background: p.color, ["--swing" as string]: `${p.swing}deg`, ["--arm" as string]: `${p.arm}px`, animationDuration: `${p.period}s` }} />
        </i>
      ))}
    </div>
  );
}

/**
 * The Big Screen, up close (owner, Oct 16): tapping the Clout Tower (or the home card, or a photo in the
 * Clout TV app) opens the photo in the billboard's frame. Anyone can tap it, so the copy is about the
 * player on it: "@handle made it to the Big Screen", "Now the whole city knows their name".
 */
export function TvViewer({ f, live, onClose }: { f: TvFeature; live?: { nextAt: string } | null; onClose: () => void }) {
  // Over the whole game, even when opened from inside the Phone.
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="tv-viewer" role="dialog" aria-modal="true" aria-label={`${at(f.handle)} made it to the Big Screen`}>
      <div className="tv-viewer-scrim" onClick={onClose} aria-hidden="true" />
      <div className="tv-viewer-glow" aria-hidden="true" />
      <button className="icon-round tv-viewer-close" onClick={onClose} aria-label="Close"><CloseIcon size={18} /></button>
      <div className="tv-viewer-body">
        <span className="tv-live">{live ? <><span className="tv-live-dot" aria-hidden="true" />LIVE ON CLOUT TV</> : <>ON CLOUT TV · {tvDay(f.date).toUpperCase()}</>}</span>
        <h2 className="tv-headline"><span className="tv-headline-who">{at(f.handle)} made it to the</span><span className="tv-headline-big">Big Screen</span></h2>
        <figure className="tv-viewer-pic">
          {f.url ? <img src={f.url} alt={`${at(f.handle)} on the Big Screen`} /> : <div className="tv-viewer-missing">Photo unavailable</div>}
          <figcaption><em>CLOUT TV</em><span>{at(f.handle)}</span></figcaption>
        </figure>
        <p className="tv-viewer-line">Now the <mark>whole city</mark> knows their name</p>
        <span className="tv-viewer-meta">{live ? `On the Clout Tower until ${tvTime(live.nextAt)}` : `Was on the Clout Tower · ${tvTime(f.at)}`}</span>
      </div>
      <Confetti />
    </div>,
    document.body,
  );
}

export function TvHomeCard({ f, onOpen, onDismiss }: { f: TvFeature; onOpen: () => void; onDismiss: () => void }) {
  return (
    <div className="story-prompt tv-prompt" role="status">
      <button className="story-prompt-main" onClick={onOpen}>
        {f.url ? <img className="tv-prompt-thumb" src={f.url} alt="" /> : <span className="story-prompt-tile" aria-hidden="true">📺</span>}
        <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
          <span className="overline" style={{ display: "block", color: "rgba(20,17,26,.7)" }}>Now on Clout TV</span>
          <span className="title" style={{ display: "block", color: "var(--night-900)" }}>{at(f.handle)} made it to the Big Screen</span>
        </span>
        <ChevronRightIcon size={18} />
      </button>
      <button className="story-prompt-close" onClick={onDismiss} aria-label="Dismiss"><CloseIcon size={14} /></button>
    </div>
  );
}

export function TvApp({ api, onToast, onChange }: { api: TvApi; onToast: (t: string) => void; onChange?: (s: TvState) => void }) {
  const [s, setS] = useState<TvState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(false);
  const [view, setView] = useState<TvFeature | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const load = async () => {
    const r = await api.state();
    if (r.ok) { setS(r.data); setError(null); onChange?.(r.data); } else setError(r.error);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, [api]);

  if (error) return <div className="card stack-4"><p className="body" style={{ margin: 0 }}>{error}</p></div>;
  if (!s) return <p className="meta">Warming up the screen…</p>;
  if (form) return <SubmitForm api={api} onCancel={() => setForm(false)} onSent={() => { setForm(false); onToast("Sent to Clout TV. The producers look at every photo."); void load(); }} />;

  const withdraw = async (m: TvMine) => {
    setBusy(m.id);
    const r = await api.withdraw(m.id);
    setBusy(null);
    onToast(r.ok ? (m.status === "featured" ? "Taken off the Big Screen. Your photo is deleted." : "Withdrawn. Your photo is deleted.") : r.error);
    void load();
  };
  return (
    <div className="stack-12 tv-app">
      <TvBumper />
      {s.featured ? (
        <button className="tv-feature" onClick={() => setView(s.featured)}>
          {s.featured.url ? <img src={s.featured.url} alt={`${at(s.featured.handle)} on Clout TV today`} /> : <span className="tv-viewer-missing">Photo unavailable</span>}
          <span className="tv-feature-cap"><span className="tv-viewer-on">📺 On the Big Screen now · next at {tvTime(s.nextAt)}</span><span className="title">{at(s.featured.handle)}</span></span>
        </button>
      ) : (
        <div className="card stack-4">
          <span className="title" style={{ display: "block" }}>Make it BIG in NY</span>
          <span className="meta">Nobody&apos;s on the Big Screen right now. A new player goes up on the Clout Tower in Astoria every 3 hours. Could be you.</span>
        </div>
      )}
      {s.mine.length > 0 && (
        <div className="stack-8">
          <p className="overline" style={{ margin: 0 }}>Your photos</p>
          {s.mine.map((m) => (
            <div key={m.id} className="tv-mine">
              {m.url ? <img src={m.url} alt="" /> : <span className="tv-mine-ph" aria-hidden="true">📷</span>}
              <span className="tv-mine-text">
                <span className="body-strong">{at(m.handle)} · {tvDay(m.date)}</span>
                <span className="meta">{m.onNow ? "📺 You're on the Big Screen right now!" : m.status === "featured" && m.featuredAt ? `${MINE_NOTE.featured} on ${tvDay(m.featuredAt.slice(0, 10))}.` : MINE_NOTE[m.status]}</span>
                {(m.status === "pending" || m.status === "approved" || m.status === "featured") && (
                  <button className="radio-report" disabled={busy !== null} onClick={() => void withdraw(m)}>{busy === m.id ? "…" : "Withdraw"}</button>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
      {s.submittedToday
        ? <button className="btn btn-secondary" disabled>One photo a day. Come back tomorrow.</button>
        : s.left > 0
          ? <div className="stack-4"><button className="btn btn-night" onClick={() => setForm(true)}>📸 Make it to the Big Screen</button>
              <span className="meta" style={{ textAlign: "center" }}>{s.left} of 20 spots left today · one photo each</span></div>
          : <button className="btn btn-secondary" disabled>Today&apos;s 20 photos are in. Try again tomorrow.</button>}
      {s.archive.length > 0 && (
        <div className="stack-8">
          <p className="overline" style={{ margin: 0 }}>Past features</p>
          <div className="tv-archive">
            {s.archive.map((f) => (
              <button key={f.id} className="tv-archive-item" onClick={() => setView(f)}>
                {f.url ? <img src={f.url} alt={`${at(f.handle)}, ${tvDay(f.date)}`} /> : <span className="tv-mine-ph">📷</span>}
                <span className="meta">{at(f.handle)}</span>
                <span className="meta">{tvDay(f.date)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {view && <TvViewer f={view} live={view.id === s.featured?.id ? { nextAt: s.nextAt } : null} onClose={() => setView(null)} />}
    </div>
  );
}

function SubmitForm({ api, onCancel, onSent }: { api: TvApi; onCancel: () => void; onSent: () => void }) {
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null);
  // The picked photo, while it's being fitted to the billboard.
  const [cropping, setCropping] = useState<ImageBitmap | null>(null);
  const [handle, setHandle] = useState("");
  const [self, setSelf] = useState(false);
  const [adult, setAdult] = useState(false);
  const [publicOk, setPublicOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  // The form opens at its top, upload button first (the app may have been scrolled down).
  useEffect(() => { formRef.current?.closest(".phone-app-screen")?.scrollTo(0, 0); }, []);
  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo.url); }, [photo]);
  const clean = cleanTvHandle(handle);
  if (cropping) {
    return (
      <PhotoCropper img={cropping} onCancel={() => { cropping.close(); setCropping(null); }}
        onDone={(blob, url) => {
          if (blob.size > TV.maxBytes) { setError("That photo is too big. Pick a smaller one."); }
          else setPhoto({ blob, url });
          cropping.close();
          setCropping(null);
        }} />
    );
  }
  const ready = !!photo && !!clean && self && adult && publicOk && !busy;
  return (
    <form ref={formRef} className="stack-12 radio-form" onSubmit={async (e) => {
      e.preventDefault();
      if (!ready || !photo || !api.upload) return;
      setBusy(true);
      setError(null);
      const up = await api.upload(photo.blob);
      if (!up.ok) { setBusy(false); return setError(up.error); }
      const r = await api.submit(up.data, handle, self, adult, publicOk);
      setBusy(false);
      if (!r.ok) return setError(r.error);
      onSent();
    }}>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/heic" hidden onChange={async (e) => {
        const f = e.target.files?.[0];
        e.target.value = "";
        if (!f) return;
        setError(null);
        try {
          setCropping(await openPhoto(f));
        } catch {
          setError("That file didn't open as a photo. Try a JPEG or PNG.");
        }
      }} />
      <p className="overline" style={{ margin: 0 }}>Step 1 · Your photo</p>
      {photo ? (
        <>
          <button type="button" className="tv-pick has" onClick={() => input.current?.click()} aria-label="Change your photo">
            <img src={photo.url} alt="Your photo, as the Big Screen shows it" />
          </button>
          <button type="button" className="btn btn-secondary btn-sm" style={{ alignSelf: "center" }} onClick={() => input.current?.click()}>🔄 Change or re-crop photo</button>
        </>
      ) : (
        <div className="tv-pick">
          <span className="tv-pick-icon" aria-hidden="true">📸</span>
          <span className="body-strong">A photo of you for the Big Screen</span>
          <span className="meta">JPEG, PNG or WebP. You&apos;ll fit it to the billboard next.</span>
          <button type="button" className="btn btn-night btn-sm" onClick={() => input.current?.click()}>⬆️ Upload a photo</button>
        </div>
      )}
      <p className="overline" style={{ margin: "4px 0 0" }}>Step 2 · Your details</p>
      <label className="stack-4">
        <span className="overline">Your Instagram handle</span>
        <span className={`field${handle && !clean ? " error" : ""}`}><input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@your.instagram" autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={31} aria-label="Your Instagram handle" /></span>
        {handle && !clean ? <span className="meta radio-problem">Letters, numbers, dots and underscores only.</span>
          : <span className="meta">Your IG handle, not your Clout City name. It shows under your photo.</span>}
      </label>
      <div className="stack-8">
        <label className="radio-check"><input type="checkbox" checked={self} onChange={(e) => setSelf(e.target.checked)} /><span className="body">It&apos;s a photo of me, or one I took.</span></label>
        <label className="radio-check"><input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} /><span className="body">I&apos;m 18 or over.</span></label>
        <label className="radio-check"><input type="checkbox" checked={publicOk} onChange={(e) => setPublicOk(e.target.checked)} /><span className="body">It can be shown publicly in the game.</span></label>
      </div>
      <p className="meta" style={{ margin: 0 }}>One photo a day, 20 a day across the city. The producers look at every photo first; picked ones take turns on the screen, 3 hours each. Photos of other people, anything explicit, or a brand as the star won&apos;t be picked. You can withdraw yours any time.</p>
      {error && <p className="body radio-problem" style={{ margin: 0 }}>{error}</p>}
      <div className="row" style={{ gap: 8 }}>
        <button type="button" className="btn btn-secondary" style={{ width: "auto", flex: "none" }} onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-night radio-submit" disabled={!ready}>{busy ? "Sending…" : "Submit photo"}</button>
      </div>
    </form>
  );
}
