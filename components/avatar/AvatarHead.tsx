"use client";

import { useEffect, useState } from "react";
import {
  ACESFilmicToneMapping, DirectionalLight, HemisphereLight, PerspectiveCamera, Quaternion, SRGBColorSpace, Scene, Vector3, WebGLRenderer, type Bone,
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
    let live = true;
    void (parts.ready ?? Promise.resolve()).then(() => {
      if (live) {
        parts.update?.(0);
        // Aimed at the head itself (its bone, the head's base, plus 10 cm to its middle): bodies, body types and
        // heights differ (the new bodies' heads sit lower than the old 1.6 m).
        scene.updateMatrixWorld(true);
        let headY = 1.6;
        parts.root.traverse((o) => { if ((o as Bone).isBone && o.name === "Head") headY = o.getWorldPosition(new Vector3()).y + 0.1; });
        // The new bodies' headwear holder is the head's middle with +z the face: turn the avatar to face the camera
        // (the standing clip turns the head now and then), and aim at it.
        if (parts.headwear?.parent) {
          const face = new Vector3(0, 0, 1).applyQuaternion(parts.headwear.getWorldQuaternion(new Quaternion()));
          parts.root.rotation.y -= Math.atan2(face.x, face.z);
          scene.updateMatrixWorld(true);
          headY = parts.headwear.getWorldPosition(new Vector3()).y;
        }
        // Close in (owner, Oct 21: "a little bigger"), the head a touch above the middle so the rank pill under the
        // bubble leaves the chin clear.
        camera.position.set(0, headY + 0.01, 1.12);
        camera.lookAt(0, headY - 0.035, 0);
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
