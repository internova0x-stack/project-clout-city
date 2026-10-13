"use client";

import { useEffect, useRef, useState } from "react";
import {
  ACESFilmicToneMapping, DirectionalLight, HemisphereLight, PerspectiveCamera, PointLight, SRGBColorSpace,
  Scene, SpotLight, WebGLRenderer,
} from "three";
import type { Look } from "@/lib/look";
import { getStyle, type Outfit } from "@/lib/styles";
import { buildAvatar, type AvatarParts } from "./buildAvatar";

/**
 * The avatar on its stage. Every Look change re-dresses it instantly
 * (Clarifications section 1, build note 2). Drag sideways to spin it.
 */
export default function Avatar3D({
  look,
  framing = "full",
  interactive = true,
  label,
  outfit,
}: {
  look: Look;
  framing?: "full" | "room";
  interactive?: boolean;
  label?: string;
  /** Worn Shop items over the starting style's outfit. */
  outfit?: Outfit;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{ scene: Scene; parts: AvatarParts | null; spin: number } | null>(null);
  const [failed, setFailed] = useState(false);

  // ---- Renderer, lights and the render loop (once) ----
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
    } catch {
      setFailed(true);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    host.appendChild(renderer.domElement);

    const scene = new Scene();
    const camera = new PerspectiveCamera(framing === "room" ? 28 : 30, 1, 0.1, 50);
    if (framing === "room") {
      camera.position.set(0, 1.05, 5.0);
      camera.lookAt(0, 1.05, 0);
    } else {
      camera.position.set(0, 1.15, 4.4);
      camera.lookAt(0, 1.0, 0);
    }

    scene.add(new HemisphereLight(0xfff6e0, 0x2e2236, 1.15));
    const key = new DirectionalLight(0xfff1d6, 1.7);
    key.position.set(-3, 5, 4);
    scene.add(key);
    const fill = new DirectionalLight(0xffd9a8, 0.45);
    fill.position.set(3, 2, 3);
    scene.add(fill);
    const rim = new PointLight(0xff2e88, 6, 8, 2);
    rim.position.set(0, 2.2, -2.2);
    scene.add(rim);
    const spot = new SpotLight(0xffc21a, 9, 12, Math.PI / 7, 0.6, 1.5);
    spot.position.set(0, 6, 1.5);
    spot.target.position.set(0, 0, 0);
    scene.add(spot, spot.target);

    sceneRef.current = { scene, parts: null, spin: 0 };

    const resize = () => {
      const w = host.clientWidth || 1;
      const h = host.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    let raf = 0;
    let visible = true;
    let nextBlink = 2 + Math.random() * 3;
    let blinkUntil = 0;
    let turnTarget = 0;
    let nextTurn = 4;
    const start = performance.now();

    const frame = (now: number) => {
      raf = 0;
      const t = (now - start) / 1000;
      const s = sceneRef.current;
      const parts = s?.parts;
      if (parts && s) {
        if (!reduceMotion) {
          parts.torso.scale.y = 1 + Math.sin(t * 2.1) * 0.008;
          parts.body.position.y = Math.sin(t * 2.1) * 0.008;
          if (t > nextBlink) { blinkUntil = t + 0.12; nextBlink = t + 2.5 + Math.random() * 3; }
          const eyeY = t < blinkUntil ? 0.1 : 1;
          for (const eye of parts.eyes) eye.scale.y = eyeY;
          if (t > nextTurn) { turnTarget = turnTarget === 0 ? (Math.random() < 0.5 ? -0.32 : 0.32) : 0; nextTurn = t + 2 + Math.random() * 3; }
          parts.head.rotation.y += (turnTarget - parts.head.rotation.y) * 0.04;
        }
        parts.root.rotation.y = s.spin;
      }
      renderer.render(scene, camera);
      if (visible && !document.hidden) raf = requestAnimationFrame(frame);
    };
    const kick = () => { if (!raf && visible && !document.hidden) raf = requestAnimationFrame(frame); };
    kick();

    const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; kick(); });
    io.observe(host);
    document.addEventListener("visibilitychange", kick);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", kick);
      sceneRef.current?.parts?.dispose();
      sceneRef.current = null;
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [framing]);

  // ---- Re-dress on every Look change ----
  useEffect(() => {
    const s = sceneRef.current;
    if (!s) return;
    const parts = buildAvatar(look, { pedestal: framing === "full", outfit });
    if (s.parts) {
      parts.head.rotation.y = s.parts.head.rotation.y;
      s.scene.remove(s.parts.root);
      s.parts.dispose();
    }
    s.scene.add(parts.root);
    s.parts = parts;
  }, [look.style, look.body, look.build, look.skin, look.hair, look.hairColor, look.eyes, look.glasses, look.covering, look.fit && JSON.stringify(look.fit), framing, outfit && JSON.stringify(outfit)]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Drag to spin ----
  const dragX = useRef<number | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    if (!interactive) return;
    dragX.current = e.clientX;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (dragX.current === null || !sceneRef.current) return;
    sceneRef.current.spin += (e.clientX - dragX.current) * 0.012;
    dragX.current = e.clientX;
  };
  const onPointerUp = () => { dragX.current = null; };

  const style = getStyle(look.style);
  if (failed) {
    return (
      <div className="avatar-canvas" style={{ display: "grid", placeItems: "center", fontSize: 96 }} role="img" aria-label={label ?? `Your character in ${style.label}`}>
        {style.emoji}
      </div>
    );
  }
  return (
    <div
      ref={hostRef}
      className="avatar-canvas"
      role="img"
      aria-label={label ?? `Your character wearing the ${style.label} style`}
      style={{ touchAction: interactive ? "pan-y" : "auto", cursor: interactive ? "grab" : "default" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    />
  );
}
