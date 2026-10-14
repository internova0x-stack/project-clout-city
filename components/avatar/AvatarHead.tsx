"use client";

import { useEffect, useState } from "react";
import {
  ACESFilmicToneMapping, DirectionalLight, HemisphereLight, PerspectiveCamera, SRGBColorSpace, Scene, WebGLRenderer,
} from "three";
import type { Look } from "@/lib/look";
import { getStyle, type Outfit } from "@/lib/styles";
import { buildModelAvatar } from "./modelAvatar";

/**
 * The avatar's head as a still image for small places like the home-screen bubble (v0.7 step 3).
 * Renders once per look into a throwaway WebGL context, so no render loop stays running.
 */
export default function AvatarHead({ look, outfit, size = 120 }: { look: Look; outfit?: Outfit; size?: number }) {
  const [src, setSrc] = useState<string | null>(null);
  const key = JSON.stringify([look, outfit ?? null]);
  useEffect(() => {
    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    } catch {
      return;
    }
    renderer.setPixelRatio(1);
    renderer.setSize(size * 2, size * 2, false);
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = ACESFilmicToneMapping;
    const scene = new Scene();
    scene.add(new HemisphereLight(0xfff6e0, 0xffd3b5, 1.4));
    const key = new DirectionalLight(0xfff1d6, 1.6);
    key.position.set(-2, 3, 4);
    scene.add(key);
    const parts = buildModelAvatar(look, { pedestal: false, outfit });
    scene.add(parts.root);
    const camera = new PerspectiveCamera(30, 1, 0.1, 20);
    camera.position.set(0, 1.62, 1.55);
    camera.lookAt(0, 1.6, 0);
    let live = true;
    void (parts.ready ?? Promise.resolve()).then(() => {
      if (live) {
        parts.update?.(0);
        renderer.render(scene, camera);
        setSrc(renderer.domElement.toDataURL("image/png"));
      }
      parts.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    });
    return () => { live = false; };
  }, [key, size]); // eslint-disable-line react-hooks/exhaustive-deps

  return src
    ? <img src={src} alt="" width={size} height={size} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
    : <span style={{ display: "grid", placeItems: "center", width: "100%", height: "100%", fontSize: size / 3 }}>{getStyle(look.style).emoji}</span>;
}
