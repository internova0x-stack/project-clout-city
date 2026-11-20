"use client";
// /preview/models (development only): every modeled piece (components/room/models.ts) on a turntable-free grid, each
// fitted to a 1.6 m footprint and facing the camera as the rooms place it (+z), labelled, for checking turns and looks.
import { useEffect, useRef, useState } from "react";
import { AmbientLight, Color, DirectionalLight, HemisphereLight, PerspectiveCamera, Scene, WebGLRenderer } from "three";
import { MODELS, placedModel } from "../room/models";

export function ModelsPreview({ pick }: { pick?: string }) {
  const ids = Object.keys(MODELS).filter((k) => !pick || pick.split(",").some((p) => k.includes(p)));
  const ref = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const cell = 220, cols = 6, rows = Math.ceil(ids.length / cols);
  useEffect(() => {
    const canvas = ref.current!;
    const r = new WebGLRenderer({ canvas, antialias: true });
    r.setPixelRatio(1); r.setSize(cols * cell, rows * cell, false); r.setScissorTest(true);
    const tiles = ids.map((id) => {
      const scene = new Scene(); scene.background = new Color("#EDE6DA");
      scene.add(new HemisphereLight(0xffffff, 0x8a7f70, 1.5), new AmbientLight(0xffffff, 0.5));
      const sun = new DirectionalLight(0xffffff, 1.8); sun.position.set(2, 4, 3); scene.add(sun);
      const cam = new PerspectiveCamera(32, 1, 0.1, 50); cam.position.set(2.2, 2.6, 4.6); cam.lookAt(0, 0.55, 0);
      const p = placedModel(id, 1.6, 1.6).then((m) => { if (m) scene.add(m); });
      return { scene, cam, p };
    });
    Promise.all(tiles.map((t) => t.p)).then(() => {
      tiles.forEach((t, i) => {
        const x = (i % cols) * cell, y = (rows - 1 - Math.floor(i / cols)) * cell;
        r.setViewport(x, y, cell, cell); r.setScissor(x, y, cell, cell); r.render(t.scene, t.cam);
      });
      setReady(true);
      (window as unknown as { modelsReady: boolean }).modelsReady = true;
    });
    return () => r.dispose();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <main style={{ padding: 12, background: "#fff" }}>
      <div style={{ position: "relative", width: cols * cell }}>
        <canvas ref={ref} style={{ width: cols * cell, height: rows * cell, display: "block" }} />
        {ready && ids.map((id, i) => (
          <span key={id} style={{ position: "absolute", left: (i % cols) * cell + 6, top: Math.floor(i / cols) * cell + 4, font: "600 12px system-ui", color: "#333" }}>{id}</span>
        ))}
      </div>
    </main>
  );
}
