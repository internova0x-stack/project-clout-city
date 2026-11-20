"use client";

// Plays a cutscene (components/cutscene/scripts.ts) over the game: a full-screen canvas, letterbox bars, the place line,
// typed subtitles, Skip, and the closing card. Downloaded only when a cutscene plays (GameShell imports it lazily).
// "Reduce motion" skips straight to the end. ?capture=1 (recording a video) moves time only when window.cutsceneSeek
// sets it.
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Clock, PerspectiveCamera, Scene, WebGLRenderer } from "three";
import { lowGraphics, renderQuality } from "@/lib/graphics";
import { ease } from "./sets";
import type { CutsceneScript } from "./scripts";

export function CutscenePlayer({ script, onDone, startAt = 0 }: { script: CutsceneScript; onDone: () => void; startAt?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [time, setTime] = useState(startAt);
  const [flash, setFlash] = useState(0);
  const [ready, setReady] = useState(false);
  const timeRef = useRef(startAt);
  const done = useRef(false);
  const finish = () => { if (!done.current) { done.current = true; onDone(); } };
  useEffect(() => setHost(document.body), []);
  useEffect(() => {
    if (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches && !script.card) finish();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!host || !ref.current) return;
    const canvas = ref.current;
    const q = renderQuality();
    const renderer = new WebGLRenderer({ canvas, antialias: q.antialias });
    renderer.setPixelRatio(lowGraphics() ? 1 : Math.min(2, window.devicePixelRatio || 1));
    const scene = new Scene();
    const cam = new PerspectiveCamera(40, 1, 0.1, 160);
    const staged = script.build(scene, cam);
    const resize = () => {
      const w = window.innerWidth, h = window.innerHeight;
      renderer.setSize(w, h, false); cam.aspect = w / h; cam.fov = w < h ? 58 : 40; cam.updateProjectionMatrix();
    };
    resize(); window.addEventListener("resize", resize);
    const clock = new Clock();
    let raf = 0, shown = -1, isReady = false;
    staged.ready.then(() => { isReady = true; setReady(true); clock.getDelta(); }).catch(() => finish());
    const capture = new URLSearchParams(location.search).has("capture");
    let lastT = timeRef.current;
    const w = window as unknown as { cutsceneSeek?: (t: number) => void; cutsceneReady?: () => boolean; cutsceneT?: number };
    w.cutsceneSeek = (t) => { timeRef.current = t; };
    w.cutsceneReady = () => isReady;
    const reduce = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce && script.card) timeRef.current = script.card.at;
    const frame = () => {
      let dt = Math.min(0.05, clock.getDelta());
      if (capture) { dt = Math.max(0, Math.min(0.1, timeRef.current - lastT)); lastT = timeRef.current; }
      else if (isReady) timeRef.current = Math.min(script.end, timeRef.current + dt);
      const t = timeRef.current;
      if (isReady) staged.stage(t, dt);
      renderer.render(scene, cam);
      const k = Math.round(t * 10);
      if (k !== shown) { shown = k; setTime(t); }
      if (staged.flash) setFlash(staged.flash(t));
      w.cutsceneT = t;
      if (!script.card && t >= script.end && !capture) { finish(); return; }
      raf = requestAnimationFrame(frame);
    };
    frame();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); staged.dispose(); renderer.dispose(); };
  }, [host]); // eslint-disable-line react-hooks/exhaustive-deps

  const shots = script.shots;
  const i = Math.max(0, shots.findLastIndex((s) => time >= s.at));
  const s = shots[i];
  const into = time - s.at;
  const card = script.card && time >= script.card.at ? script.card : null;
  const skip = () => {
    if (script.card) { timeRef.current = Math.max(timeRef.current, script.card.at); setTime(timeRef.current); }
    else finish();
  };
  const page = (
    <div className="cutscene" role="dialog" aria-modal="true" aria-label={script.card?.title ?? "Cutscene"}>
      <canvas ref={ref} className="cutscene-canvas" />
      <div className={`cutscene-bar top${card ? "" : " on"}`} />
      <div className={`cutscene-bar bottom${card ? "" : " on"}`} />
      {!ready && <div className="cutscene-loading" aria-live="polite">…</div>}
      {ready && !card && s.place && <div className="cutscene-place" style={{ opacity: into < 0.4 ? into / 0.4 : into > 3 ? 0 : 1 }}>{s.place}</div>}
      {ready && !card && s.line && (
        <div className="cutscene-sub" key={i}>
          <span className="cutscene-who">{s.who}</span>
          <span>{s.line.slice(0, Math.max(0, Math.floor(into * 32)))}</span>
        </div>
      )}
      {flash > 0 && <div className="cutscene-flash" style={{ opacity: flash }} />}
      {card && (
        <div className="cutscene-card" style={{ opacity: ease((time - card.at) / 0.8) }}>
          <span className="cutscene-card-tag">{card.tag}</span>
          <span className="cutscene-card-title">{card.title}</span>
          {card.names && <span className="cutscene-card-names">{card.names}</span>}
          <span className="cutscene-card-line">{card.line}</span>
          <button className="btn btn-taxi" onClick={finish}>{card.cta}</button>
        </div>
      )}
      {!card && <button className="cutscene-skip" onClick={skip}>Skip ›</button>}
    </div>
  );
  return host ? createPortal(page, host) : page;
}

export default CutscenePlayer;
