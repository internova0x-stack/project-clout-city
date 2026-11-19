"use client";

// /preview/cutscene (development only): a prototype of an in-game cutscene (owner, Nov 19: "I can add much more in terms
// of animations, virtual goods, cutscenes, without affecting performance"; "Yes" to a mock-up of going official). It uses
// the game's own avatars and clips on a small rooftop set built from boxes, a scripted camera with hard cuts, letterbox
// bars, subtitles and a title card. Nothing downloads beyond the avatars the game already loads. ?shot=0-5 starts at a shot.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AdditiveBlending, BoxGeometry, CanvasTexture, Clock, Color, ConeGeometry, CylinderGeometry, DirectionalLight, Fog, Group, HemisphereLight,
  Mesh, MeshBasicMaterial, MeshStandardMaterial, PerspectiveCamera, PlaneGeometry, PointLight, RepeatWrapping, Scene, SphereGeometry, Sprite,
  SpriteMaterial, SRGBColorSpace, Vector3, WebGLRenderer,
} from "three";
import { buildBaseAvatar } from "../avatar/baseAvatar";
import type { AvatarParts } from "../avatar/buildAvatar";
import { dance, resetLimbs } from "../room/Room3D";
import { glowTexture } from "../map/streetLife";
import { DEFAULT_LOOK, HAIR_COLORS, SKIN_TONES, type Look } from "@/lib/look";
import { getStyle, starterOutfit } from "@/lib/styles";

/** The script: when each shot starts (seconds), and what the screen says. */
const SHOTS = [
  { at: 0, place: "Ditmars Heights Rooftop · 11:48 PM" },
  { at: 3.5 },
  { at: 7, who: "You", line: "Three dates. So… what are we?" },
  { at: 10.5, who: "@marco.qns", line: "Honestly? Official. Lola's already typing." },
  { at: 14 },
  { at: 18.5, card: true },
] as const;
const END = 23;

const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const v = (x: number, y: number, z: number) => new Vector3(x, y, z);

/** Lit windows for the skyline (one texture, repeated per tower). */
function windowsTexture(): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  g.fillStyle = "#1B2140"; g.fillRect(0, 0, 64, 64);
  for (let y = 4; y < 64; y += 10) for (let x = 4; x < 64; x += 10) {
    if (Math.random() < 0.55) { g.fillStyle = Math.random() < 0.7 ? "#FFD58A" : "#9FD4FF"; g.fillRect(x, y, 5, 6); }
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace; t.wrapS = t.wrapT = RepeatWrapping;
  return t;
}
/** A heart for the rising hearts. */
function heartTexture(): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  g.font = "52px serif"; g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText("💖", 32, 36);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

export function Cutscene({ startShot = 0 }: { startShot?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [time, setTime] = useState<number>(SHOTS[Math.min(startShot, SHOTS.length - 1)].at);
  const [run, setRun] = useState(0);
  const timeRef = useRef<number>(time);
  useEffect(() => setHost(document.body), []);

  useEffect(() => {
    if (!host || !ref.current) return;
    const canvas = ref.current;
    const renderer = new WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    const scene = new Scene();
    scene.background = new Color("#0E1430");
    scene.fog = new Fog("#0E1430", 18, 60);
    scene.add(new HemisphereLight(0x8aa0ff, 0x1a1420, 0.55));
    const moonLight = new DirectionalLight(0xb8c8ff, 0.6); moonLight.position.set(-6, 10, -8); scene.add(moonLight);

    const solid = (color: string, emissive?: string, ei = 0) => new MeshStandardMaterial({ color, roughness: 0.85, flatShading: true, emissive: emissive ?? "#000000", emissiveIntensity: ei });
    const add = (m: Mesh, x: number, y: number, z: number) => { m.position.set(x, y, z); scene.add(m); return m; };
    // The roof: tar floor, parapet, a water tower, a bench and a few planters.
    add(new Mesh(new BoxGeometry(14, 0.2, 10), solid("#3A3540")), 0, -0.1, 0);
    for (const [x, z, w, d] of [[0, -5, 14, 0.3], [-7, 0, 0.3, 10], [7, 0, 0.3, 10]] as const) add(new Mesh(new BoxGeometry(w, 0.9, d), solid("#5B4A52")), x, 0.45, z);
    const tower = new Group();
    const part = (m: Mesh, x: number, y: number, z: number) => { m.position.set(x, y, z); tower.add(m); };
    part(new Mesh(new CylinderGeometry(0.9, 0.9, 1.6, 12), solid("#6B4A33")), 0, 2.6, 0);
    part(new Mesh(new ConeGeometry(1.0, 0.7, 12), solid("#4A3626")), 0, 3.75, 0);
    for (const [x, z] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) part(new Mesh(new BoxGeometry(0.1, 1.8, 0.1), solid("#2B2228")), x, 0.9, z);
    tower.position.set(-4.6, 0, -3.2); scene.add(tower);
    add(new Mesh(new BoxGeometry(1.8, 0.45, 0.5), solid("#8A6A4A")), 3.4, 0.25, -3.8);
    for (const x of [-2.2, 1.6]) {
      add(new Mesh(new BoxGeometry(0.7, 0.5, 0.7), solid("#6E5A4A")), x, 0.25, -4.3);
      add(new Mesh(new SphereGeometry(0.42, 7, 6), solid("#3F7A4A")), x, 0.75, -4.3);
    }
    // String lights: two droops of warm bulbs with a soft glow each.
    const bulbMat = new MeshBasicMaterial({ color: "#FFD58A" });
    const glowMat = new SpriteMaterial({ map: glowTexture("round", "255,200,120"), transparent: true, opacity: 0.6, blending: AdditiveBlending, depthWrite: false });
    for (const [z0, z1] of [[-4.6, -1], [-1, 2.6]] as const) for (let i = 0; i <= 14; i++) {
      const k = i / 14, x = lerp(-6.4, 6.4, k), y = 2.6 - Math.sin(k * Math.PI) * 0.7, z = lerp(z0, z1, 0.5) + Math.sin(k * 9) * 0.05;
      add(new Mesh(new SphereGeometry(0.06, 6, 5), bulbMat), x, y, z);
      const s = new Sprite(glowMat); s.scale.set(0.7, 0.7, 1); s.position.set(x, y, z); scene.add(s);
    }
    const warm = new PointLight(0xffc47a, 6, 9, 1.6); warm.position.set(0, 2.2, -1); scene.add(warm);
    // The skyline across the river: towers with lit windows, and the moon.
    const win = windowsTexture();
    for (let i = 0; i < 46; i++) {
      const w = 1.2 + Math.random() * 2.2, h = 3 + Math.random() * 13, d = 1.5 + Math.random() * 2;
      const t = win.clone(); t.needsUpdate = true; t.repeat.set(Math.max(1, Math.round(w)), Math.max(1, Math.round(h / 2)));
      const m = new Mesh(new BoxGeometry(w, h, d), new MeshStandardMaterial({ map: t, emissiveMap: t, emissive: "#ffffff", emissiveIntensity: 0.85, roughness: 1 }));
      add(m, -30 + i * 1.35 + Math.random() * 0.6, h / 2 - 4, -22 - Math.random() * 10);
    }
    add(new Mesh(new SphereGeometry(1.6, 16, 12), new MeshBasicMaterial({ color: "#FFF4D6", fog: false })), 9, 11, -40);

    // The two of you: the game's own avatars and clips.
    const lookA: Look = { ...DEFAULT_LOOK, body: "curvy", build: "curvy", skin: SKIN_TONES[4], hair: "long", hairColor: HAIR_COLORS[1], covering: "none", style: "influencer_soft_glam" } as Look;
    const lookB: Look = { ...DEFAULT_LOOK, body: "straight", build: "athletic", skin: SKIN_TONES[2], hair: "short", hairColor: HAIR_COLORS[0], covering: "none", style: "bodega_drip" } as Look;
    const you: AvatarParts = buildBaseAvatar(lookA, { pedestal: false, outfit: starterOutfit(getStyle(lookA.style), "curvy", null) });
    const them: AvatarParts = buildBaseAvatar(lookB, { pedestal: false, outfit: starterOutfit(getStyle(lookB.style), "straight", null) });
    // Each avatar rides in its own rig: the avatar's update() owns its root's position (the walk's bob).
    const rigYou = new Group(), rigThem = new Group();
    rigYou.add(you.root); rigThem.add(them.root);
    scene.add(rigYou, rigThem);

    // Fireworks over the river and hearts rising from the two of you (shot 4).
    const sparkGeo = new SphereGeometry(0.12, 5, 4);
    const sparks: { m: Mesh; vel: Vector3; born: number }[] = [];
    const burst = (at: Vector3, color: string, t0: number) => {
      for (let i = 0; i < 26; i++) {
        const m = new Mesh(sparkGeo, new MeshBasicMaterial({ color, transparent: true, blending: AdditiveBlending, depthWrite: false, fog: false }));
        m.position.copy(at); scene.add(m);
        const a = Math.random() * Math.PI * 2, b = Math.acos(2 * Math.random() - 1), sp = 3 + Math.random() * 2;
        sparks.push({ m, vel: v(Math.sin(b) * Math.cos(a) * sp, Math.cos(b) * sp, Math.sin(b) * Math.sin(a) * sp * 0.4), born: t0 });
      }
    };
    const heartMat = new SpriteMaterial({ map: heartTexture(), transparent: true, depthWrite: false });
    const hearts = Array.from({ length: 10 }, (_, i) => { const s = new Sprite(heartMat.clone()); s.scale.set(0.35, 0.35, 1); s.visible = false; scene.add(s); return { s, seed: i }; });
    const fired = new Set<number>();

    const cam = new PerspectiveCamera(40, 1, 0.1, 120);
    const resize = () => {
      const w = window.innerWidth, h = window.innerHeight;
      renderer.setSize(w, h, false); cam.aspect = w / h; cam.fov = w < h ? 58 : 40; cam.updateProjectionMatrix();
    };
    resize(); window.addEventListener("resize", resize);

    /** Where everyone is and where the camera looks at time t. */
    const stage = (t: number, dt: number) => {
      const youAt = v(-0.55, 0, -1.6);
      // Shot 1: you at the parapet, looking at the skyline. Shots 2+: they walk in from the stairs, you turn.
      const walk = ease((t - 3.6) / 3.2);
      const themAt = v(lerp(4.6, 0.6, walk), 0, lerp(1.8, -1.6, walk));
      rigYou.position.copy(youAt);
      rigThem.position.copy(themAt);
      const turn = ease((t - 5.2) / 1.2);
      rigYou.rotation.y = lerp(Math.PI, Math.PI / 2, turn); // back to us, then toward them
      rigThem.rotation.y = walk < 1 ? Math.atan2(0.6 - 4.6, -1.6 - 1.8) : -Math.PI / 2;
      them.setMotion?.(walk > 0 && walk < 1 ? "walk" : "idle");
      you.setMotion?.("idle");
      const dancing = t >= SHOTS[4].at && t < SHOTS[5].at;
      if (dancing) { dance(you, t, 0.28); dance(them, t + 0.4, 0.14); }
      else { resetLimbs(you); resetLimbs(them); }
      if (t >= SHOTS[3].at + 0.6 && t < SHOTS[4].at) them.play?.("wave"); else if (!dancing) them.play?.(null);
      you.update?.(dt); them.update?.(dt);

      // Fireworks and hearts.
      if (dancing) {
        for (const [i, at, color] of [[0, 14.3, "#FF6FA3"], [1, 15.2, "#FFD58A"], [2, 16.0, "#9FD4FF"], [3, 16.9, "#B98CFF"], [4, 17.6, "#FF6FA3"]] as const) {
          if (t >= at && !fired.has(i)) { fired.add(i); burst(v(-8 + i * 4, 10 + (i % 2) * 2, -26), color, t); }
        }
      }
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i], age = t - s.born;
        if (age > 2.2 || age < 0) { scene.remove(s.m); sparks.splice(i, 1); continue; }
        s.m.position.addScaledVector(s.vel, dt); s.vel.y -= 2.2 * dt;
        (s.m.material as MeshBasicMaterial).opacity = 1 - age / 2.2;
      }
      hearts.forEach(({ s, seed }) => {
        const age = t - SHOTS[4].at - seed * 0.35;
        s.visible = dancing && age > 0;
        if (!s.visible) return;
        const k = (age % 2.6) / 2.6;
        s.position.set(lerp(-0.6, 0.6, (seed % 5) / 4) + Math.sin(age * 3 + seed) * 0.15, 1.4 + k * 2.2, -1.6 + (seed % 2 ? 0.2 : -0.2));
        (s.material as SpriteMaterial).opacity = 1 - k;
      });

      // The camera, shot by shot (hard cuts between, slow moves within).
      const shot = SHOTS.findLastIndex((s) => t >= s.at);
      const into = t - SHOTS[shot].at;
      let pos: Vector3, look: Vector3;
      if (shot === 0) { pos = v(lerp(-2, 1.5, ease(into / 3.5)), lerp(6, 3.2, ease(into / 3.5)), lerp(12, 7, ease(into / 3.5))); look = v(0, 2.5, -14); }
      else if (shot === 1) { pos = v(6.5, 1.6, 2.5 - into * 0.15); look = v(lerp(3, 0.4, ease(into / 3.5)), 1.1, -0.6); }
      else if (shot === 2) { pos = v(1.9, 1.5, 0.9 + into * -0.05); look = v(-0.3, 1.2, -1.6); }
      else if (shot === 3) { pos = v(-1.9, 1.5, 0.9 + into * -0.05); look = v(0.3, 1.2, -1.6); }
      else if (shot === 4) { const a = into * 0.32; pos = v(Math.sin(a) * 4.5, 1.4 + into * 0.35, -1.6 + Math.cos(a) * 4.5); look = v(0, 1.4 + into * 0.25, -1.6); }
      else { pos = v(0, 4.5, 5.5); look = v(0, 3, -10); }
      cam.position.copy(pos); cam.lookAt(look);
    };

    const clock = new Clock();
    let raf = 0;
    let shown = -1;
    let ready = false;
    Promise.all([you.ready, them.ready]).then(() => { ready = true; clock.getDelta(); });
    // ?capture=1 (recording a video): time only moves when the recorder sets it, one exact step a frame.
    const capture = new URLSearchParams(location.search).has("capture");
    let lastT = timeRef.current;
    (window as unknown as { cutsceneSeek?: (t: number) => void }).cutsceneSeek = (t) => { timeRef.current = t; };
    (window as unknown as { cutsceneReady?: () => boolean }).cutsceneReady = () => ready;
    const frame = () => {
      let dt = Math.min(0.05, clock.getDelta());
      if (capture) { dt = Math.max(0, Math.min(0.1, timeRef.current - lastT)); lastT = timeRef.current; }
      else if (ready) timeRef.current = Math.min(END, timeRef.current + dt);
      const t = timeRef.current;
      stage(t, dt);
      renderer.render(scene, cam);
      const q = Math.round(t * 10);
      if (q !== shown) { shown = q; setTime(t); }
      (window as unknown as { cutsceneT: number }).cutsceneT = t;
      raf = requestAnimationFrame(frame);
    };
    frame();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); you.dispose(); them.dispose(); renderer.dispose(); };
  }, [host, run]);

  const shot = SHOTS.findLastIndex((s) => time >= s.at);
  const s = SHOTS[shot] as { at: number; place?: string; who?: string; line?: string; card?: boolean };
  const into = time - s.at;
  const letterbox = !s.card;
  const skip = () => { timeRef.current = SHOTS[5].at; setTime(SHOTS[5].at); };
  const replay = () => { timeRef.current = 0; setTime(0); setRun((n) => n + 1); };
  const page = (
    <main className="cutscene">
      <canvas ref={ref} className="cutscene-canvas" />
      <div className={`cutscene-bar top${letterbox ? " on" : ""}`} />
      <div className={`cutscene-bar bottom${letterbox ? " on" : ""}`} />
      {s.place && <div className="cutscene-place" style={{ opacity: into < 0.4 ? into / 0.4 : into > 3 ? 0 : 1 }}>{s.place}</div>}
      {s.line && (
        <div className="cutscene-sub" key={shot}>
          <span className="cutscene-who">{s.who}</span>
          <span>{s.line.slice(0, Math.max(0, Math.floor(into * 32)))}</span>
        </div>
      )}
      {s.card && (
        <div className="cutscene-card" style={{ opacity: ease(into / 0.8) }}>
          <span className="cutscene-card-tag">Relationship</span>
          <span className="cutscene-card-title">💞 It&apos;s official</span>
          <span className="cutscene-card-names">You &amp; @marco.qns</span>
          <span className="cutscene-card-line">Your couple streak starts tonight. Lola has already posted about it.</span>
          <button className="btn btn-taxi" onClick={replay}>Watch again</button>
        </div>
      )}
      {!s.card && <button className="cutscene-skip" onClick={skip}>Skip ›</button>}
    </main>
  );
  return host ? createPortal(page, host) : page;
}
