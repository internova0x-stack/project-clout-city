"use client";

// /preview/gestures (development only; moments phase 3): every gesture (components/avatar/gestures.ts) on a pair of avatars,
// side by side, for the owner to check before they go into the game. ?pick=hold,hug picks columns, ?size= the tile size.

import { useEffect, useRef } from "react";
import { AmbientLight, CircleGeometry, Color, DirectionalLight, Group, HemisphereLight, Mesh, MeshStandardMaterial, PerspectiveCamera, Scene, WebGLRenderer } from "three";
import { buildBaseAvatar } from "../avatar/baseAvatar";
import type { AvatarParts } from "../avatar/buildAvatar";
import { gesture, type Gesture } from "../avatar/gestures";
import { DEFAULT_LOOK, SKIN_TONES, type Look } from "@/lib/look";
import { getStyle, starterOutfit } from "@/lib/styles";

const COLS: [Gesture, string][] = [["hold", "Hold hands, walking"], ["hug", "Hug"], ["toast", "Toast"], ["selfie", "Selfie"], ["cheer", "Cheer"]];

const A: Look = { ...DEFAULT_LOOK, body: "curvy", skin: SKIN_TONES[1], hair: "long", hairColor: "#3B2417", style: "pilates_princess" } as Look;
const B: Look = { ...DEFAULT_LOOK, body: "straight", skin: SKIN_TONES[2], hair: "short", hairColor: "#14100E", style: "bodega_drip" } as Look;

export function Gestures({ pick, size = 300 }: { pick?: string; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const cols = pick ? COLS.filter(([g]) => pick.split(",").includes(g)) : COLS;
  useEffect(() => {
    const canvas = ref.current!;
    const renderer = new WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(1);
    renderer.setSize(cols.length * size, size, false);
    renderer.setScissorTest(true);
    const tiles = cols.map(([g]) => {
      const scene = new Scene();
      scene.background = new Color("#F3E6E8");
      scene.add(new HemisphereLight(0xffffff, 0x8a7f70, 1.6), new AmbientLight(0xffffff, 0.4));
      const sun = new DirectionalLight(0xffffff, 1.6); sun.position.set(2, 4, 3); scene.add(sun);
      const floor = new Mesh(new CircleGeometry(1.6, 32), new MeshStandardMaterial({ color: "#E2CFC9" }));
      floor.rotation.x = -Math.PI / 2; scene.add(floor);
      const solo = g === "toast" || g === "selfie" || g === "cheer";
      const people: { parts: AvatarParts; rig: Group; side: "left" | "right" }[] = [];
      for (const [i, look] of (solo ? [A] : [A, B]).entries()) {
        const parts = buildBaseAvatar(look, { pedestal: false, outfit: starterOutfit(getStyle(look.style), look.body, null) });
        const rig = new Group();
        rig.add(parts.root);
        if (g === "hold") { rig.position.x = i === 0 ? -0.33 : 0.33; }
        if (g === "hug") { rig.position.z = i === 0 ? -0.17 : 0.17; rig.rotation.y = i === 0 ? 0 : Math.PI; }
        scene.add(rig);
        parts.setMotion?.(g === "hold" ? "walk" : "idle");
        people.push({ parts, rig, side: i === 0 ? "left" : "right" });
      }
      const cam = new PerspectiveCamera(30, 1, 0.1, 50);
      if (g === "hug") cam.position.set(3.4, 1.5, 0.4); else cam.position.set(0.6, 1.4, 4.2);
      cam.lookAt(0, 0.95, 0);
      return { g, scene, cam, people };
    });
    let raf = 0, last = performance.now();
    const t0 = last;
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const t = (now - t0) / 1000;
      tiles.forEach((tile, i) => {
        for (const p of tile.people) {
          gesture(p.parts, tile.g, t, p.side);
          p.parts.update?.(dt);
        }
        renderer.setViewport(i * size, 0, size, size);
        renderer.setScissor(i * size, 0, size, size);
        renderer.render(tile.scene, tile.cam);
      });
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); tiles.forEach((x) => x.people.forEach((p) => p.parts.dispose())); renderer.dispose(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <main style={{ padding: 12, background: "#fff", minHeight: "100vh" }}>
      <div style={{ display: "flex", width: cols.length * size }}>
        {cols.map(([g, label]) => <div key={g} style={{ width: size, textAlign: "center", font: "600 14px system-ui", color: "#17141C" }}>{label}</div>)}
      </div>
      <canvas ref={ref} style={{ width: cols.length * size, height: size }} />
    </main>
  );
}
