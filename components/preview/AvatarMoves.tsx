"use client";

// /preview/moves (development only): the new base bodies doing every move the game uses, side by side, for the owner
// to check before the rest of step 2 (owner, Oct 21: "Let me preview the additional animations you create"). The
// moves are the game's own: the idle (made from the walk), the walk, sitting and lying (Room3D's poses) and the four
// dances. ?skin=0-7 and ?build= change the look; ?bodies=new is implied.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AmbientLight, Clock, Color, DirectionalLight, Group, HemisphereLight, PerspectiveCamera, Scene, WebGLRenderer } from "three";
import { buildBaseAvatar } from "../avatar/baseAvatar";
import type { AvatarParts } from "../avatar/buildAvatar";
import { dance, poseLie, poseSit, resetLimbs } from "../room/Room3D";
import { DEFAULT_LOOK, HAIR_COLORS, SKIN_TONES, type Look } from "@/lib/look";

const MOVES = ["Idle", "Walk", "Sit", "Lie down", "Dance: fist pump", "Dance: sway", "Dance: hands up", "Dance: twist"] as const;
/** Phases that pick each dance style in Room3D's dance(): style = floor(phase × 7.3) mod 4. */
const DANCE_PHASE = [0.01, 0.14, 0.28, 0.42];

export function AvatarMoves({ skin = 3, build }: { skin?: number; build?: Look["build"] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => setHost(document.body), []);
  useEffect(() => {
    if (!host || !ref.current) return;
    const canvas = ref.current;
    const cols = MOVES.length, rows = 2, cell = 220;
    const renderer = new WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(1);
    renderer.setSize(cols * cell, rows * (cell + 24), false);
    renderer.setScissorTest(true);
    const looks: Look[] = [
      { ...DEFAULT_LOOK, body: "curvy", build: build ?? "curvy", skin: SKIN_TONES[skin] ?? SKIN_TONES[3], hair: "long", hairColor: HAIR_COLORS[1], covering: "none", style: "influencer_soft_glam" },
      { ...DEFAULT_LOOK, body: "straight", build: build ?? "athletic", skin: SKIN_TONES[(skin + 3) % 8] ?? SKIN_TONES[5], hair: "short", hairColor: HAIR_COLORS[0], covering: "none", style: "bodega_drip" },
    ];
    const tiles: { scene: Scene; cam: PerspectiveCamera; parts: AvatarParts; move: (typeof MOVES)[number]; rig: Group }[] = [];
    looks.forEach((look) => MOVES.forEach((move) => {
      const scene = new Scene();
      scene.background = new Color("#EDE6DA");
      scene.add(new HemisphereLight(0xffffff, 0x8a7f70, 1.6), new AmbientLight(0xffffff, 0.4));
      const sun = new DirectionalLight(0xffffff, 1.6); sun.position.set(2, 4, 3); scene.add(sun);
      const rig = new Group();
      const parts = buildBaseAvatar(look, { pedestal: false });
      rig.add(parts.root);
      rig.rotation.y = move === "Walk" ? -0.5 : 0.35;
      scene.add(rig);
      const lying = move === "Lie down";
      const cam = new PerspectiveCamera(lying ? 34 : 30, 1, 0.1, 50);
      if (lying) { cam.position.set(1.6, 2.6, 2.2); cam.lookAt(0, 0.4, 0); } else { cam.position.set(0, 1.05, 4.1); cam.lookAt(0, 0.85, 0); }
      tiles.push({ scene, cam, parts, move, rig });
    }));
    const clock = new Clock();
    let raf = 0, t = 0;
    const frame = () => {
      const dt = Math.min(0.05, clock.getDelta());
      t += dt;
      tiles.forEach((tile, i) => {
        const { parts, move } = tile;
        if (move === "Walk") parts.setMotion?.("walk");
        else parts.setMotion?.("idle");
        if (move === "Sit") poseSit(parts, 0.46);
        else if (move === "Lie down") poseLie(parts, 0.4);
        else if (move.startsWith("Dance")) dance(parts, t, DANCE_PHASE[MOVES.indexOf(move) - 4]);
        else resetLimbs(parts);
        parts.update?.(dt);
        const col = i % cols, row = Math.floor(i / cols);
        const x = col * cell, y = (rows - 1 - row) * (cell + 24);
        renderer.setViewport(x, y, cell, cell);
        renderer.setScissor(x, y, cell, cell);
        renderer.render(tile.scene, tile.cam);
      });
      raf = requestAnimationFrame(frame);
    };
    Promise.all(tiles.map((x) => x.parts.ready)).then(() => { (window as unknown as { movesReady: boolean }).movesReady = true; });
    frame();
    return () => { cancelAnimationFrame(raf); tiles.forEach((x) => x.parts.dispose()); renderer.dispose(); };
  }, [skin, build, host]);
  const page = (
    <main style={{ position: "fixed", inset: 0, overflow: "auto", zIndex: 50, padding: 16, background: "#EDE6DA", color: "#17141C" }}>
      <h1 className="display-md" style={{ margin: "0 0 8px" }}>New bodies: every move</h1>
      <p className="meta" style={{ margin: "0 0 12px" }}>Top: Female, curvy. Bottom: Male, athletic. The idle is made from the walk; sitting, lying and dancing are the game&apos;s own poses.</p>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${MOVES.length}, 220px)`, fontSize: 12, fontWeight: 700 }}>
        {MOVES.map((m) => <span key={m} style={{ textAlign: "center" }}>{m}</span>)}
      </div>
      <canvas ref={ref} style={{ display: "block", width: MOVES.length * 220, height: 2 * 244 }} />
    </main>
  );
  // Above the preview's phone frame: the grid needs the whole window.
  return host ? createPortal(page, host) : page;
}
