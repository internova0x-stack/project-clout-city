"use client";

// /preview/moves (development only): the new base bodies doing every move the game uses, side by side, for the owner
// to check before the rest of step 2 (owner, Oct 21: "Let me preview the additional animations you create"). The
// moves are the game's own: the idle (made from the walk), the walk, sitting and lying (Room3D's poses) and the four
// dances. ?skin=0-7 and ?build= change the look; ?bodies=new is implied. ?outfit=hoodie (stage 3) puts the hoodie
// template on all eight body types (rows) walking, sitting, lying, dancing and from the back. ?outfit=hair shows every
// hairstyle (columns) on both bodies from the front and the back, and under a cap. ?outfit=wardrobe shows every
// everyday template (stage 4): eight looks (columns) on both bodies standing, sitting and walking. ?outfit=anims shows
// both bodies (owner, Oct 21: assets/avatar-animations.json), in their base layer and dressed, standing, walking and
// doing each clip. ?outfit=sets shows every whole Shop outfit on both bodies, standing, sitting and walking;
// ?outfit=accessories every Shop accessory the same way.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AmbientLight, BoxGeometry, Clock, Color, DirectionalLight, Group, HemisphereLight, Mesh, MeshStandardMaterial, PerspectiveCamera, Scene, WebGLRenderer } from "three";
import { buildBaseAvatar } from "../avatar/baseAvatar";
import type { AvatarParts } from "../avatar/buildAvatar";
import { dance, poseLie, poseSit, resetLimbs } from "../room/Room3D";
import { BUILDS, DEFAULT_LOOK, HAIR_COLORS, SKIN_TONES, type Look } from "@/lib/look";
import { getStyle, starterOutfit, type Outfit } from "@/lib/styles";
import { OUTFIT_SETS } from "@/lib/avatarCatalog";
import { ACCESSORIES } from "@/lib/accessories";

const MOVES = ["Idle", "Walk", "Sit", "Lie down", "Dance: fist pump", "Dance: sway", "Dance: hands up", "Dance: twist", "Back"] as const;
type Move = (typeof MOVES)[number];
const ALL_MOVES: Move[] = ["Idle", "Walk", "Sit", "Lie down", "Dance: fist pump", "Dance: sway", "Dance: hands up", "Dance: twist"];
const GARMENT_MOVES: Move[] = ["Idle", "Walk", "Sit", "Lie down", "Dance: hands up", "Back"];
/** Hoodie colors per row (top, drawstrings), so one look doesn't hide a problem another shows. */
const HOODIES: [string, string][] = [["#3F5E3A", "#EDE6DA"], ["#E8E2D6", "#2B2B2B"], ["#C2354A", "#F4F1EA"], ["#2E3A55", "#E9C46A"]];
/** Phases that pick each dance style in Room3D's dance(): style = floor(phase × 7.3) mod 4. */
const DANCE_PHASE = [0.01, 0.14, 0.28, 0.42];

/** The clips columns (?outfit=anims): the label and the clip played ("idle" and "walk" are the standing and the walk). */
const CLIPS: [string, string][] = [["Standing", "idle"], ["Walk", "walk"], ["Run", "run"], ["Sit", "sit"], ["Sleep", "sleep"], ["Dance", "dance"], ["Wave", "wave"]];

export function AvatarMoves({ skin = 3, build, outfit, size, pick }: { skin?: number; build?: Look["build"]; outfit?: string; size?: number; pick?: string }) {
  const garment = outfit === "hoodie";
  const hairs = outfit === "hair";
  const wardrobe = outfit === "wardrobe";
  const anims = outfit === "anims";
  const sets = outfit === "sets";
  const extras = outfit === "accessories";
  const LOOKS: [string, Partial<Outfit>][] = [
    ["Tee + trousers", { top: "tee", topColor: "#F4F1EA", topAccent: "#2B2B2B", bottom: "pants", bottomColor: "#2E3A55" }],
    ["Crop + skirt", { top: "crop", topColor: "#E86A92", topAccent: "#2B2B2B", bottom: "skirt", bottomColor: "#2B2B2B" }],
    ["Vest + shorts", { top: "vest", topColor: "#3A3F47", topAccent: "#C9A227", bottom: "shorts", bottomColor: "#C2AE86" }],
    ["Zip jacket + leggings", { top: "zip", topColor: "#E0186F", topAccent: "#14111A", bottom: "leggings", bottomColor: "#14111A" }],
    ["Cardigan + trousers", { top: "cardigan", topColor: "#8FA36B", topAccent: "#F4F1EA", bottom: "pants", bottomColor: "#5A3A22" }],
    ["Blazer + trousers", { top: "blazer", topColor: "#1F1B26", topAccent: "#C9A227", bottom: "pants", bottomColor: "#1F1B26" }],
    ["Puffer + shorts + boots", { top: "puffer", topColor: "#F2A541", topAccent: "#14111A", bottom: "shorts", bottomColor: "#3A3F47", shoes: "boots", shoeColor: "#5A3A22", shoeAccent: "#2B2B2B" }],
    ["Hoodie + skirt + boots", { top: "hoodie", topColor: "#6C8CFF", topAccent: "#F4F1EA", bottom: "skirt", bottomColor: "#B33A3A", shoes: "boots", shoeColor: "#14111A", shoeAccent: "#F4F1EA" }],
  ];
  const WARDROBE_ROWS: [string, "curvy" | "straight", string][] = [["Female", "curvy", "Idle"], ["Female, sitting", "curvy", "Sit"], ["Male", "straight", "Idle"], ["Male, walking", "straight", "Walk"]];
  const HAIR_COLS = ["short", "buzz", "long", "ponytail", "bun", "braids", "curls", "locs", "long + cap"];
  const picked = (all: string[]) => (pick ? all.filter((c) => pick.split(",").includes(c)) : all);
  const moves: string[] = extras ? picked(Object.keys(ACCESSORIES)) : sets ? picked(OUTFIT_SETS.map((o) => o.id)) : anims ? CLIPS.map((c) => c[0]) : wardrobe ? LOOKS.map((l) => l[0]) : hairs ? HAIR_COLS : garment ? GARMENT_MOVES : ALL_MOVES;
  const cell = size ?? (garment ? 170 : 220);
  const rowsOf = (): { look: Look; outfit?: Outfit; label: string; back?: boolean; move?: string; bare?: boolean }[] => {
    if (anims) return (["curvy", "straight"] as const).flatMap((body, b) => [true, false].map((bare) => ({
      look: { ...DEFAULT_LOOK, body, build: body === "curvy" ? "curvy" : "athletic", skin: SKIN_TONES[(skin + b * 3) % 8], hair: bare ? "bald" : body === "curvy" ? "long" : "short", hairColor: HAIR_COLORS[b], covering: "none", accessory: "none", style: "bodega_drip" } as Look,
      outfit: { ...starterOutfit(getStyle(body === "curvy" ? "pilates_princess" : "bodega_drip"), body, null), accessory: "none" } as Outfit,
      label: `${body === "curvy" ? "Female" : "Male"}${bare ? ", base layer" : ", dressed"}`, bare,
    })));
    if (sets || extras) return WARDROBE_ROWS.map(([label, body, move], i) => ({
      look: { ...DEFAULT_LOOK, body, build: body === "curvy" ? "curvy" : "athletic", skin: SKIN_TONES[(skin + i * 2) % 8], hair: body === "curvy" ? "long" : "short", hairColor: HAIR_COLORS[i % 3], covering: "none", glasses: "none", style: "bodega_drip" } as Look,
      outfit: starterOutfit(getStyle("bodega_drip"), body, null), label, move,
    }));
    if (wardrobe) return WARDROBE_ROWS.map(([label, body, move], i) => ({
      look: { ...DEFAULT_LOOK, body, build: body === "curvy" ? "curvy" : "athletic", skin: SKIN_TONES[(skin + i * 2) % 8], hair: body === "curvy" ? "long" : "short", hairColor: HAIR_COLORS[i % 3], covering: "none", style: "bodega_drip" } as Look,
      outfit: starterOutfit(getStyle("bodega_drip"), body, null), label, move,
    }));
    if (hairs) return (["curvy", "straight"] as const).flatMap((body, b) => [false, true].map((back) => ({
      look: { ...DEFAULT_LOOK, body, build: body === "curvy" ? "curvy" : "athletic", skin: SKIN_TONES[(skin + b * 3) % 8], hairColor: HAIR_COLORS[b ? 0 : 1], covering: "none", style: "bodega_drip" } as Look,
      outfit: { ...starterOutfit(getStyle("bodega_drip"), body, null), top: "hoodie", topColor: b ? "#2E3A55" : "#C2354A", topAccent: "#F4F1EA", set: undefined },
      label: `${body === "curvy" ? "Female" : "Male"}, ${back ? "back" : "front"}`, back,
    })));
    if (!garment) return [
      { look: { ...DEFAULT_LOOK, body: "curvy", build: build ?? "curvy", skin: SKIN_TONES[skin] ?? SKIN_TONES[3], hair: "long", hairColor: HAIR_COLORS[1], covering: "none", style: "influencer_soft_glam" }, label: "Female, curvy" },
      { look: { ...DEFAULT_LOOK, body: "straight", build: build ?? "athletic", skin: SKIN_TONES[(skin + 3) % 8] ?? SKIN_TONES[5], hair: "short", hairColor: HAIR_COLORS[0], covering: "none", style: "bodega_drip" }, label: "Male, athletic" },
    ];
    return (["curvy", "straight"] as const).flatMap((body) => BUILDS[body].map((b, i) => {
      const look: Look = { ...DEFAULT_LOOK, body, build: b.id, skin: SKIN_TONES[(skin + i * 2) % 8], hair: body === "curvy" ? (i % 2 ? "ponytail" : "long") : (i % 2 ? "buzz" : "short"), hairColor: HAIR_COLORS[i % 3], covering: "none", style: "bodega_drip" };
      const [top, accent] = HOODIES[i];
      return { look, outfit: { ...starterOutfit(getStyle(look.style), body, null), top: "hoodie", topColor: top, topAccent: accent, set: undefined }, label: `${body === "curvy" ? "Female" : "Male"}, ${b.label.toLowerCase()}` };
    }));
  };
  const rows = rowsOf();
  const ref = useRef<HTMLCanvasElement>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => setHost(document.body), []);
  useEffect(() => {
    if (!host || !ref.current) return;
    const canvas = ref.current;
    const cols = moves.length;
    const renderer = new WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(1);
    renderer.setSize(cols * cell, rows.length * (cell + 24), false);
    renderer.setScissorTest(true);
    const tiles: { scene: Scene; cam: PerspectiveCamera; parts: AvatarParts; move: string; rig: Group }[] = [];
    rows.forEach(({ look: base, outfit: rowOutfit, back, move: rowMove, bare }) => moves.forEach((col) => {
      const look: Look = hairs ? { ...base, hair: col.split(" ")[0] as Look["hair"], covering: col.endsWith("cap") ? "cap" : "none" } : base;
      const move = sets || extras ? rowMove! : anims ? CLIPS.find((c) => c[0] === col)![1] : hairs ? (back ? "Back" : "Idle") : wardrobe ? rowMove! : col;
      const o: Outfit | undefined = extras ? { ...rowOutfit!, top: "tee", topColor: "#F4F1EA", topAccent: "#2B2B2B", extras: [ACCESSORIES[col]] } : sets ? { ...rowOutfit!, set: col } : wardrobe ? { ...rowOutfit!, shoes: undefined, set: undefined, ...LOOKS.find((l) => l[0] === col)![1] } as Outfit : rowOutfit;
      const scene = new Scene();
      scene.background = new Color("#EDE6DA");
      scene.add(new HemisphereLight(0xffffff, 0x8a7f70, 1.6), new AmbientLight(0xffffff, 0.4));
      const sun = new DirectionalLight(0xffffff, 1.6); sun.position.set(2, 4, 3); scene.add(sun);
      const rig = new Group();
      const parts = buildBaseAvatar(look, { pedestal: false, outfit: o, bare });
      rig.add(parts.root);
      rig.rotation.y = move === "Walk" || move === "walk" || move === "run" ? -0.5 : move === "Back" ? Math.PI + 0.35 : move === "sleep" ? 0 : 0.35;
      scene.add(rig);
      if (anims) {
        // Sitting and lying go through the game's own poseSit and poseLie, onto a seat and a bed as in the rooms.
        const box = (w: number, h: number, d: number, z: number, color: string) => {
          const m = new Mesh(new BoxGeometry(w, h, d), new MeshStandardMaterial({ color, roughness: 0.9 }));
          m.position.set(0, h / 2, z);
          rig.add(m);
        };
        if (move === "sit") { poseSit(parts, 0.46); box(0.55, 0.46, 0.5, -0.12, "#8C6A4F"); }
        else if (move === "sleep") { poseLie(parts, 0.5); box(1.1, 0.5, 2.0, -0.85, "#B9C4D6"); rig.position.z = 0.85; }
        else parts.play?.(move === "idle" || move === "walk" ? null : move);
      }
      const lying = move === "Lie down" || move === "sleep";
      const cam = new PerspectiveCamera(lying ? 34 : 30, 1, 0.1, 50);
      if (lying) { cam.position.set(1.6, 2.6, 2.2); cam.lookAt(0, 0.4, 0); } else if (hairs) { cam.position.set(0, 1.45, 1.5); cam.lookAt(0, 1.4, 0); } else { cam.position.set(0, 1.05, 4.1); cam.lookAt(0, 0.85, 0); }
      tiles.push({ scene, cam, parts, move, rig });
    }));
    const clock = new Clock();
    let raf = 0, t = 0;
    const frame = () => {
      const dt = Math.min(0.05, clock.getDelta());
      t += dt;
      tiles.forEach((tile, i) => {
        const { parts, move } = tile;
        if (anims) parts.setMotion?.(move === "walk" ? "walk" : "idle");
        else if (move === "Walk") parts.setMotion?.("walk");
        else parts.setMotion?.("idle");
        if (move === "Sit") poseSit(parts, 0.46);
        else if (move === "Lie down") poseLie(parts, 0.4);
        else if (move.startsWith("Dance")) dance(parts, t, DANCE_PHASE[MOVES.indexOf(move as Move) - 4]);
        else if (!anims) resetLimbs(parts);
        parts.update?.(dt);
        const col = i % cols, row = Math.floor(i / cols);
        const x = col * cell, y = (rows.length - 1 - row) * (cell + 24);
        renderer.setViewport(x, y, cell, cell);
        renderer.setScissor(x, y, cell, cell);
        renderer.render(tile.scene, tile.cam);
      });
      raf = requestAnimationFrame(frame);
    };
    Promise.all(tiles.map((x) => x.parts.ready)).then(() => { (window as unknown as { movesReady: boolean }).movesReady = true; });
    frame();
    return () => { cancelAnimationFrame(raf); tiles.forEach((x) => x.parts.dispose()); renderer.dispose(); };
  }, [skin, build, outfit, size, pick, host]);
  const page = (
    <main style={{ position: "fixed", inset: 0, overflow: "auto", zIndex: 50, padding: 16, background: "#EDE6DA", color: "#17141C" }}>
      <h1 className="display-md" style={{ margin: "0 0 8px" }}>{extras ? "Shop accessories on the new bodies" : sets ? "Whole outfits on the new bodies" : anims ? "New bodies and their animations" : wardrobe ? "The everyday wardrobe" : hairs ? "Every hairstyle" : garment ? "The hoodie on every body type" : "New bodies: every move"}</h1>
      <p className="meta" style={{ margin: "0 0 12px" }}>{extras ? "Hats, glasses and earrings fit the head; necklaces, the scarf, bags and the watch are made for each body and move with it." : sets ? "Every Shop outfit set, made from the game's own garments in its colors, with its hat." : anims ? "Each body in its plain base layer, then dressed (clothes, sneakers and hair are rebuilt from the new bodies). Every clip is moved onto the body's own skeleton." : wardrobe ? "Every top, bottom and the boots players can own, cut from the body itself so they bend with every pose." : hairs ? "Grown from each body's own scalp, so it fits the head. Under a hat only the lengths show." : garment
        ? "Rows: the four female and four male body types. The hoodie is cut from the body itself, so it bends with every pose."
        : "Top: Female, curvy. Bottom: Male, athletic. The idle is made from the walk; sitting, lying and dancing are the game's own poses."}</p>
      <div style={{ display: "flex" }}>
        {(garment || hairs || wardrobe || anims || sets || extras) && (
          <div style={{ width: 110, paddingTop: 18, fontSize: 12, fontWeight: 700 }}>
            {rows.map((r) => <div key={r.label} style={{ height: cell + 24, display: "flex", alignItems: "center" }}>{r.label}</div>)}
          </div>
        )}
        <div>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${moves.length}, ${cell}px)`, fontSize: 12, fontWeight: 700 }}>
            {moves.map((m) => <span key={m} style={{ textAlign: "center" }}>{m}</span>)}
          </div>
          <canvas ref={ref} style={{ display: "block", width: moves.length * cell, height: rows.length * (cell + 24) }} />
        </div>
      </div>
    </main>
  );
  // Above the preview's phone frame: the grid needs the whole window.
  return host ? createPortal(page, host) : page;
}
