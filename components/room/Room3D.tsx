"use client";

import { sceneFailed, sceneReady, watchContext } from "@/lib/loadStats";
import { useEffect, useRef, useState } from "react";
import {
  ACESFilmicToneMapping, AmbientLight, BoxGeometry, CanvasTexture, CircleGeometry, Color, ConeGeometry, DoubleSide, MeshBasicMaterial, DirectionalLight, Fog, Group, HemisphereLight, Mesh,
  MeshStandardMaterial, OrthographicCamera, PCFSoftShadowMap, Plane, PlaneGeometry, PointLight, Raycaster, RepeatWrapping,
  RingGeometry, SRGBColorSpace, Scene, Sprite, SpriteMaterial, AdditiveBlending, Vector2, Vector3, WebGLRenderer, type Object3D,
} from "three";
import { randomLook, type Look } from "@/lib/look";
import type { CrowdMember } from "@/lib/partyRoom";
import { formatCash } from "@/lib/economy";
import {
  FACING, FURNITURE, GRID, INNER_WALL, applyLayout, freeSpot, isOwnedId, ownedItem, type OwnedPiece, clampItem, findPath, makeGrid, placementOk, snap, toLayout, useSpot,
  type LayoutEntry, type RoomItem, type RoomTemplate,
  openSpots,
} from "@/lib/rooms";
import { STARTING_STYLES, starterOutfit, type Outfit } from "@/lib/styles";
import { gogoPieces } from "@/lib/avatarCatalog";
import type { AvatarParts } from "../avatar/buildAvatar";
import { buildModelAvatar } from "../avatar/modelAvatar";
import { goldStatue } from "../avatar/goldStatue";
import { buildFurniture, makeKit, STATUE_TOP, tagItem, type Built, type Kit } from "./furniture";
import { frameWatch, lowGraphics, renderQuality, setAutoLowGraphics } from "@/lib/graphics";

// A walkable low-poly room (Design guide update 7): an isometric cutaway with the
// player's avatar, which walks where you tap, sits on seats, naps on the bed and
// walks up to counters to use them (tap the label over a thing). At home, tapping a
// piece of furniture selects it, and arrows around it move it (rotate in the bar); the layout is saved per player.
// Every room turns with a sideways slide and zooms with a pinch (v0.11, owner Oct 14).

const WALL_H = 2.7;
/** #19: walls between rooms stop at the waist (owner, Oct 14), so every room reads at once. */
const INNER_WALL_H_LOW = 1.05;
const WALK_SPEED = 1.5;
/** New bodies jog when the way is longer than RUN_FROM meters (owner, Oct 21), at RUN_SPEED. */
const RUN_FROM = 5;
const RUN_SPEED = 3;

type Mode = "idle" | "walk" | "sit" | "sleep" | "dance";

interface Actor {
  rig: Group;
  parts: AvatarParts | null;
  x: number;
  z: number;
  heading: number;
  mode: Mode;
  path: [number, number][];
  pending: RoomItem | null;
  phase: number;
  /** New bodies: a long walk is a jog (the run clip, at RUN_SPEED). */
  run?: boolean;
  /** Standing on something (a go-go dancer on her podium, the DJ on the stage). */
  y?: number;
}

export interface Room3DProps {
  template: RoomTemplate;
  /** A saved home layout (lib/rooms.ts LayoutEntry[]). */
  layout?: unknown;
  look: Look;
  outfit?: Outfit;
  daytime: boolean;
  /** Text on the room's sign (club, café, deli). */
  sign?: string;
  editable?: boolean;
  onUse?: (item: RoomItem) => void;
  /** A tap on one of the room's regulars (by index in template.npcs), e.g. for chatter. */
  onNpcTap?: (index: number) => void;
  /** #20: the room's people by index (the place's regular first): their names, for the hidden talk buttons. */
  npcNames?: string[];
  /** Which of npcNames is the place's regular: their name gets the pink pill, so they're easy to find. */
  npcHost?: number;
  onSaveLayout?: (layout: LayoutEntry[]) => Promise<boolean>;
  label: string;
  /** Screen space kept clear for the HUD (top) and panels (bottom), in px. */
  insetTop?: number;
  insetBottom?: number;
  /** #19 homes with stairs: which floor this is (bought pieces remember their floor). */
  floor?: number;
  /** #19 Fif's Furniture: pieces the player bought; placed ones come from the layout, the rest wait in storage. */
  owned?: OwnedPiece[];
  /** #19 "Try it at home": a piece from the Shop, placed for a look before buying. */
  trial?: { piece: OwnedPiece; price: number; canAfford: boolean };
  /** Buys the trial piece; the layout has it under the id "trial" where it stands. */
  onTrialBuy?: (layout: LayoutEntry[]) => Promise<boolean>;
  onTrialEnd?: () => void;
  /** Lets the screen hide overlapping chrome while furniture is being arranged. */
  onEditingChange?: (editing: boolean) => void;
  /**
   * v0.11 (spec section 11): the view turns in 90° steps, with the ↻ button or a sideways swipe
   * (the apartment). The two walls nearest the camera are cut away, whichever way it faces.
   */
  rotatable?: boolean;
  /**
   * v0.11 (owner, Oct 14): a front door by the spot you come in, with a doormat. It's scenery: the Map
   * button (or tab) is the way out, so there's no "Go out" label.
   */
  door?: boolean;
  /** Chip text that depends on game state, by item id (the party floor's "Check in 🎟️" then "Dance"). */
  labels?: Record<string, string>;
  /**
   * v0.11 party floors: the people at the party (real players and NPCs), standing at the
   * template's crowdSpots, real players with a green "online" dot (NPCs unmarked). Tapping a dot calls onCrowdTap.
   */
  crowd?: CrowdMember[];
  onCrowdTap?: (m: CrowdMember) => void;
  /**
   * True on party floors, where only the people given a crowd spot get a tag. Everywhere else every
   * real player here gets one. Either way it's their blue @handle tag (owner, Oct 15).
   */
  crowdDots?: boolean;
  /**
   * "dream" (the default, approved Oct 12, 2026) is the Monument Valley-inspired look:
   * gradient walls, warm-lit and lavender-shaded faces, soft shadows, haze and motes.
   * "natural" keeps the plain lighting for side-by-side previews.
   */
  mood?: "natural" | "dream";
  /** Called once, after the first frame with the player's avatar loaded (the launch screen waits for it). */
  onReady?: () => void;
  /**
   * Owner, Nov 6 ("tapping on a sit action doesn't make the player walk to a sit and sit"): an action started from a
   * list (Sit, Nap, Sleep, a place's Go). The avatar walks to the piece that does it and sits, lies down or uses it,
   * without calling onUse again. `key` changes for each new one. `use` is a piece's use kind ("sit", "sleep", "cook")
   * or a place action's id.
   */
  act?: { use: "sit" | "sleep" | "cook" | { action: string; index?: number; kind?: string; seconds?: number }; key: number } | null;
}

export default function Room3D(props: Room3DProps) {
  const { template, layout, look, outfit, sign, editable, label, insetTop = 120, insetBottom = 96, mood = "dream" } = props;
  // Clout Couture's statue is the player as they look now, in gold.
  const lookRef = useRef({ look, outfit });
  // Some shops keep their daytime lights on all night (the lotto's bright yellow room).
  const daytime = props.daytime || !!template.alwaysLit;
  const dream = mood === "dream";
  const hostRef = useRef<HTMLDivElement>(null);
  const chipsRef = useRef<Map<string, HTMLButtonElement>>(new Map());
  const bubblesRef = useRef<Map<number, HTMLButtonElement>>(new Map());
  const crowdTagsRef = useRef<Map<string, HTMLButtonElement>>(new Map());
  const crowdRef = useRef<{ member: CrowdMember; actor: Actor; spot: number; dance: boolean; leaving?: boolean }[]>([]);
  const propsRef = useRef(props);
  propsRef.current = props;
  const [failed, setFailed] = useState(false);
  const owned = props.owned ?? [];
  const ownedKey = owned.map((o) => o.id).join(",");
  const floorNo = props.floor ?? 1;
  const [items, setItems] = useState<RoomItem[]>(() => applyLayout(template, layout, owned, floorNo));
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  // Quarter turns of the view; it keeps counting (not mod 4) so each turn eases the short way round.
  const [turn, setTurn] = useState(0);
  const turnRef = useRef(turn);
  turnRef.current = turn;
  useEffect(() => setTurn(0), [template.id]);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const editRef = useRef({ editing, selected });
  editRef.current = { editing, selected };
  const savedRef = useRef<RoomItem[]>(items);
  useEffect(() => { propsRef.current.onEditingChange?.(editing); }, [editing]);
  const actionsRef = useRef<{
    goUse: (it: RoomItem, silent?: boolean) => void; talk: (i: number) => void; floorStep: (screen: number) => [number, number];
    sitNear: (near: RoomItem | null) => boolean; stroll: (seconds: number, dog: boolean) => void;
  } | null>(null);

  // Re-apply when the room or saved layout changes (not while arranging).
  const layoutKey = JSON.stringify(layout ?? null);
  useEffect(() => {
    const next = applyLayout(template, layout, propsRef.current.owned ?? [], propsRef.current.floor ?? 1);
    setItems(next);
    savedRef.current = next;
    setEditing(false);
    setSelected(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template.id, layoutKey, ownedKey, floorNo]);

  // #19 "Try it at home": drop the Shop's piece into a free spot and start arranging it.
  const trialKey = props.trial?.piece.id ?? "";
  useEffect(() => {
    const t = propsRef.current.trial;
    if (!t) return;
    const base = savedRef.current.filter((i) => i.id !== "trial");
    const spot = freeSpot(template, base, ownedItem({ ...t.piece, id: "trial" }, 0, 0, 0));
    if (!spot) { setNote("No room for it here. Move something first."); return; }
    setItems([...base, spot]);
    setEditing(true);
    setSelected("trial");
    setNote(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trialKey, template.id]);

  const world = useRef<{
    scene: Scene; camera: OrthographicCamera; kit: Kit; furniture: Group; built: Map<string, Built & { obj: Group; statue?: AvatarParts }>;
    me: Actor; npcs: Actor[]; ring: Mesh; floor: Mesh; dirty: boolean; fit: () => void;
  } | null>(null);

  // ---- Scene (per room and time of day) ----
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let renderer: WebGLRenderer;
    const quality = renderQuality();
    try {
      renderer = new WebGLRenderer({ antialias: quality.antialias, alpha: true, powerPreference: "low-power" });
    } catch {
      setFailed(true);
      sceneFailed("room", "no_webgl");
      return;
    }
    watchContext(renderer.domElement, "room");
    renderer.setPixelRatio(quality.pixelRatio);
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = template.dark ? 1.15 : 1.0;
    renderer.setClearColor(0x000000, 0);
    // Low graphics (lib/graphics.ts): no shadows, no antialiasing, 1x pixels.
    renderer.shadowMap.enabled = quality.shadows;
    renderer.shadowMap.type = PCFSoftShadowMap;
    renderer.domElement.style.touchAction = "none";
    host.appendChild(renderer.domElement);

    const night = !daytime || !!template.dark;
    const kit = makeKit();
    const scene = new Scene();
    // Transparent: the gradient behind the room is CSS (see roomBackdrop).

    // Lights
    // Night indoors reads as warm lamplight, not darkness; the club adds colored stage lights.
    if (dream) {
      // Monument Valley-style: warm peach key light on the faces it hits, cool lavender in the shade.
      scene.add(new HemisphereLight(night ? 0xffd6dc : 0xfff1e6, night ? 0x5a4a9a : 0xa498d6, template.dark ? 1.3 : night ? 1.2 : 1.35));
      scene.add(new AmbientLight(night ? 0xd8c4ff : 0xfff0ea, 0.25));
    } else {
      scene.add(new HemisphereLight(night ? 0xffe2c4 : 0xfff6e0, night ? 0x4a3050 : 0x8a7a6a, template.dark ? 1.05 : night ? 0.85 : 1.1));
      scene.add(new AmbientLight(night ? 0xffd9b8 : 0xffffff, template.dark ? 0.5 : night ? 0.35 : 0.25));
    }
    const sun = dream
      ? new DirectionalLight(night ? 0xffc4a8 : 0xffdfc4, template.dark ? 0.9 : night ? 1.0 : 1.5)
      : new DirectionalLight(night ? 0xffd2a8 : 0xfff1d6, template.dark ? 0.9 : night ? 0.85 : 1.6);
    sun.position.set(4, 7, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    const half = Math.max(template.w, template.d);
    Object.assign(sun.shadow.camera, { left: -half, right: half, top: half, bottom: -half, near: 0.5, far: 25 });
    sun.shadow.bias = -0.0008;
    if (dream) {
      sun.position.set(5, 8, 2.5); // light the right-facing walls, leave the left ones in lavender shade
      sun.shadow.intensity = 0.45;
      sun.shadow.radius = 6;
    }
    scene.add(sun);
    const glowLights: PointLight[] = [];
    if (template.dark) {
      for (const [c, x] of [[0xff2e88, -2], [0x8a5cff, 2], [0xffc21a, 0]] as const) {
        const l = new PointLight(c, 12, 11, 1.2);
        l.position.set(x, 2.3, 0);
        scene.add(l);
        glowLights.push(l);
      }
    }

    // The big clubs (owner, Nov 20, the references): a lighting rig over the floor, moving-head beams sweeping the room and
    // colored pools of light running across the floor. Additive, unlit and cheap; fewer of them on low graphics.
    const beams: { pivot: Group; mat: MeshBasicMaterial; seed: number }[] = [];
    const pools: { m: Mesh; seed: number }[] = [];
    if (template.clubLights) {
      const n = lowGraphics() ? 4 : 8;
      const spanX = template.w * 0.55, z0 = -template.d / 2 + 2.2;
      const rig = new Mesh(kit.geo(new BoxGeometry(spanX + 1, 0.12, 0.12)), kit.mat("#2A2A33", { metalness: 0.6 }));
      rig.position.set(0, 3.9, z0 + 1.2); scene.add(rig);
      const rig2 = rig.clone(); rig2.position.z = z0 + 5.5; scene.add(rig2);
      for (let i = 0; i < n; i++) {
        const pivot = new Group();
        const x = -spanX / 2 + (spanX * (i + 0.5)) / n;
        pivot.position.set(x, 3.85, i % 2 ? z0 + 5.5 : z0 + 1.2);
        const head = new Mesh(kit.geo(new BoxGeometry(0.22, 0.22, 0.22)), kit.mat("#14111A"));
        pivot.add(head);
        const mat = new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.16, blending: AdditiveBlending, depthWrite: false, side: DoubleSide });
        const cone = new Mesh(kit.geo(new ConeGeometry(0.75, 4.6, 16, 1, true)), mat);
        cone.position.y = -2.3;
        pivot.add(cone);
        scene.add(pivot);
        beams.push({ pivot, mat, seed: i * 1.37 });
      }
      for (let i = 0; i < (lowGraphics() ? 3 : 6); i++) {
        const m = new Mesh(kit.geo(new CircleGeometry(1.1, 24)), new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.32, blending: AdditiveBlending, depthWrite: false }));
        m.rotation.x = -Math.PI / 2; m.position.y = 0.03; scene.add(m);
        pools.push({ m, seed: i * 2.1 });
      }
    }

    // A rooftop (owner, Nov 20): the city all around beyond the parapet. Towers rise from far below the roof to well above
    // it, in rows behind the back and left walls; their windows light up at night. Seeded, so the view never changes.
    if (template.skyline) {
      const c = document.createElement("canvas");
      c.width = c.height = 64;
      const g2 = c.getContext("2d")!;
      g2.fillStyle = night ? "#2A2F3D" : "#E4E0D8"; g2.fillRect(0, 0, 64, 64);
      let seed = 7;
      const rnd = () => ((seed = (seed * 48271) % 2147483647) / 2147483647);
      for (let y = 3; y < 64; y += 8) for (let x = 3; x < 64; x += 8) {
        g2.fillStyle = night ? (rnd() < 0.55 ? (rnd() < 0.7 ? "#FFD58A" : "#9FD4FF") : "#3B4256") : rnd() < 0.15 ? "#B9CFE3" : "#7E97B0";
        g2.fillRect(x, y, 4, 5);
      }
      const win = new CanvasTexture(c);
      win.colorSpace = SRGBColorSpace; win.wrapS = win.wrapT = RepeatWrapping;
      const n = lowGraphics() ? 26 : 52;
      const tones = ["#8C95A6", "#A7A29A", "#6F7787", "#B9B3A8", "#7D8698"];
      const tower = (bw: number, bd: number, top: number, x: number, z: number, color: string) => {
        const h = top + 60;
        const t2 = win.clone(); t2.needsUpdate = true; t2.repeat.set(Math.max(1, Math.round(bw / 1.2)), Math.max(1, Math.round(h / 1.6)));
        const side = new MeshStandardMaterial({ color, map: t2, emissive: "#ffffff", emissiveMap: t2, emissiveIntensity: night ? 0.9 : 0.05, roughness: 0.9 });
        const roof = new MeshStandardMaterial({ color: night ? "#3A3D45" : "#9C9A94", roughness: 1 });
        const m = new Mesh(new BoxGeometry(bw, h, bd), [side, side, roof, side, side, side]);
        m.position.set(x, top - h / 2, z);
        scene.add(m);
      };
      // The roof's own building, under the deck.
      tower(template.w + 0.3, template.d + 0.3, -0.06, 0, 0, "#9A9488");
      // Neighbors: mostly lower than this roof close by (we're high up), a few taller towers farther off.
      for (let i = 0; i < n; i++) {
        const back = i % 3 !== 0;
        const away = 5 + rnd() * 30;
        const tall = away > 16 && rnd() < 0.45;
        const top = tall ? 2 + rnd() * 18 : -16 + rnd() * 13;
        const bw = 3 + rnd() * 5, bd = 3 + rnd() * 5;
        if (back) tower(bw, bd, top, -template.w / 2 - 16 + rnd() * (template.w + 26), -template.d / 2 - away, tones[i % tones.length]);
        else tower(bw, bd, top, -template.w / 2 - away, -template.d / 2 - 12 + rnd() * (template.d + 8), tones[i % tones.length]);
      }
    }

    // Room shell: floor, two cutaway walls, trim and a window or sign.
    const room = new Group();
    const floorTex = floorTexture(template, night, dream);
    const floor = new Mesh(new PlaneGeometry(template.w, template.d), new MeshStandardMaterial({ map: floorTex, roughness: 0.85 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    floor.userData.floor = true;
    room.add(floor);
    const wallMat = dream ? gradientWallMaterial(template, night) : kit.mat(template.wall, { roughness: 0.95 });
    const trimMat = kit.mat(template.wallAccent);
    // A roof terrace (owner, Nov 20) has a waist-high parapet instead of walls.
    const shellH = template.open ? 1.05 : WALL_H;
    const back = new Mesh(kit.geo(new BoxGeometry(template.w + 0.12, shellH, 0.12)), wallMat);
    back.position.set(-0.06, shellH / 2, -template.d / 2 - 0.06);
    back.receiveShadow = true;
    const left = new Mesh(kit.geo(new BoxGeometry(0.12, shellH, template.d)), wallMat);
    left.position.set(-template.w / 2 - 0.06, shellH / 2, 0);
    left.receiveShadow = true;
    const skirtB = new Mesh(kit.geo(new BoxGeometry(template.w, 0.12, 0.03)), trimMat);
    skirtB.position.set(0, 0.06, -template.d / 2 + 0.015);
    const skirtL = new Mesh(kit.geo(new BoxGeometry(0.03, 0.12, template.d)), trimMat);
    skirtL.position.set(-template.w / 2 + 0.015, 0.06, 0);
    // Rotatable rooms get all four walls; only the two away from the camera show (see aim()).
    const walls = { xNeg: new Group(), xPos: new Group(), zNeg: new Group(), zPos: new Group() };
    if (props.rotatable && !template.outdoor) {
      const front = new Mesh(kit.geo(new BoxGeometry(template.w + 0.12, shellH, 0.12)), wallMat);
      front.position.set(0.06, shellH / 2, template.d / 2 + 0.06);
      front.receiveShadow = true;
      const right = new Mesh(kit.geo(new BoxGeometry(0.12, shellH, template.d)), wallMat);
      right.position.set(template.w / 2 + 0.06, shellH / 2, 0);
      right.receiveShadow = true;
      const skirtF = new Mesh(kit.geo(new BoxGeometry(template.w, 0.12, 0.03)), trimMat);
      skirtF.position.set(0, 0.06, template.d / 2 - 0.015);
      const skirtR = new Mesh(kit.geo(new BoxGeometry(0.03, 0.12, template.d)), trimMat);
      skirtR.position.set(template.w / 2 - 0.015, 0.06, 0);
      walls.zPos.add(front, skirtF);
      walls.xPos.add(right, skirtR);
    }
    walls.xPos.visible = walls.zPos.visible = false;
    // The front door, in the front wall by the spawn point, and a doormat inside it.
    const doorX = Math.max(-template.w / 2 + 0.7, Math.min(template.w / 2 - 0.7, template.spawn[0]));
    if (props.door && !template.outdoor) {
      const frame = new Mesh(kit.geo(new BoxGeometry(1.12, 2.24, 0.16)), trimMat);
      frame.position.set(doorX, 1.12, template.d / 2 + 0.04);
      const door = new Mesh(kit.geo(new BoxGeometry(0.92, 2.1, 0.06)), kit.mat("#7A4A2E", { roughness: 0.7 }));
      door.position.set(doorX, 1.05, template.d / 2 - 0.03);
      const knob = new Mesh(kit.geo(new BoxGeometry(0.07, 0.07, 0.07)), kit.mat("#E8C46A", { metalness: 0.6, roughness: 0.3 }));
      knob.position.set(doorX + 0.32, 1.02, template.d / 2 - 0.08);
      walls.zPos.add(frame, door, knob);
      const mat = new Mesh(kit.geo(new BoxGeometry(1.0, 0.025, 0.6)), kit.mat("#5B3A2A", { roughness: 1 }));
      mat.position.set(doorX, 0.013, template.d / 2 - 0.42);
      mat.receiveShadow = true;
      room.add(mat);
    }
    if (template.outdoor) {
      // v0.9 monument plazas: no walls. The paving is a raised island over grass (or the river).
      const base = new Mesh(kit.geo(new BoxGeometry(template.w + 0.3, 0.5, template.d + 0.3)), kit.mat(template.wallAccent, { roughness: 0.9 }));
      base.position.set(0, -0.26, 0);
      base.receiveShadow = true;
      const rim = new Mesh(kit.geo(new BoxGeometry(template.w + 1.6, 0.35, template.d + 1.6)), kit.mat(template.outdoor.edge, { roughness: 1 }));
      rim.position.set(0, -0.55, 0);
      rim.receiveShadow = true;
      room.add(base, rim);
      if (template.outdoor.water) {
        const river = new Mesh(kit.geo(new BoxGeometry(template.w + 8, 0.1, 6)), kit.mat("#5B87B5", { roughness: 0.25, metalness: 0.2 }));
        river.position.set(0, -0.6, -template.d / 2 - 3.6);
        room.add(river);
      }
    } else {
      walls.zNeg.add(back, skirtB);
      walls.xNeg.add(left, skirtL);
      room.add(walls.xNeg, walls.xPos, walls.zNeg, walls.zPos);
    }
    if (template.window && !template.outdoor && !template.open) {
      const winTex = windowTexture(night);
      const win = new Mesh(kit.geo(new PlaneGeometry(1.8, 1.2)), kit.mat("#ffffff", { map: winTex, emissive: "#ffffff", emissiveIntensity: night ? 0.55 : 0.85 }));
      (win.material as MeshStandardMaterial).emissiveMap = winTex;
      win.position.set(-template.w / 2 + 0.01, 1.55, -template.d / 4);
      win.rotation.y = Math.PI / 2;
      const frame = new Mesh(kit.geo(new BoxGeometry(0.05, 1.32, 1.92)), kit.mat("#F4F1EA"));
      frame.position.set(-template.w / 2 + 0.005, 1.55, -template.d / 4);
      (template.outdoor ? room : walls.xNeg).add(frame, win);
    }
    if (sign && !template.outdoor && !template.open) {
      const signTex = signTexture(sign, template);
      const board = new Mesh(kit.geo(new PlaneGeometry(2.6, 0.65)), kit.mat("#ffffff", { map: signTex, emissive: "#ffffff", emissiveIntensity: template.dark ? 1.1 : 0.35 }));
      (board.material as MeshStandardMaterial).emissiveMap = signTex;
      board.position.set(template.dark ? 0 : 0.8, 2.15, -template.d / 2 + 0.01);
      walls.zNeg.add(board);
      // Turning rooms hang the sign on the front wall too, so whichever of the two is in view shows it.
      if (props.rotatable) {
        const front = board.clone();
        // Beside the front door, not over it.
        const side = doorX >= 0 ? -1 : 1;
        const fx = Math.max(-template.w / 2 + 1.4, Math.min(template.w / 2 - 1.4, doorX + side * 2.0));
        front.position.set(fx, 2.15, template.d / 2 - 0.01);
        front.rotation.y = Math.PI;
        walls.zPos.add(front);
      }
    }
    // #19 bigger homes: each room's own floor, waist-high walls between rooms, and posts at the doorways.
    const roomTexes: CanvasTexture[] = [];
    for (const rm of template.rooms ?? []) {
      const rw = rm.x1 - rm.x0, rd = rm.z1 - rm.z0;
      const tex = floorTexture({ ...template, w: rw, d: rd, floor: rm.floor, floorKind: rm.floorKind }, night, dream);
      roomTexes.push(tex);
      const f = new Mesh(kit.geo(new PlaneGeometry(rw, rd)), new MeshStandardMaterial({ map: tex, roughness: 0.85 }));
      f.rotation.x = -Math.PI / 2;
      f.position.set((rm.x0 + rm.x1) / 2, 0.003, (rm.z0 + rm.z1) / 2);
      f.receiveShadow = true;
      f.userData.floor = true;
      room.add(f);
    }
    const innerMat = kit.mat(template.wall, { roughness: 0.95 });
    // Big public floors (owner, Nov 20): walls between rooms stand full height, a dollhouse seen from above.
    const INNER_WALL_H = template.tallWalls ? WALL_H - 0.25 : INNER_WALL_H_LOW;
    for (const [x0, z0, x1, z1] of template.walls ?? []) {
      const alongX = z0 === z1;
      const len = alongX ? Math.abs(x1 - x0) : Math.abs(z1 - z0);
      const t = INNER_WALL * 2;
      const wall = new Mesh(kit.geo(new BoxGeometry(alongX ? len : t, INNER_WALL_H, alongX ? t : len)), innerMat);
      wall.position.set((x0 + x1) / 2, INNER_WALL_H / 2, (z0 + z1) / 2);
      wall.castShadow = wall.receiveShadow = true;
      const cap = new Mesh(kit.geo(new BoxGeometry(alongX ? len + 0.02 : t + 0.04, 0.05, alongX ? t + 0.04 : len + 0.02)), trimMat);
      cap.position.set(wall.position.x, INNER_WALL_H + 0.025, wall.position.z);
      room.add(wall, cap);
      // A post at each end inside the room: the doorway frames.
      for (const [px, pz] of [[x0, z0], [x1, z1]]) {
        if (Math.abs(px) >= template.w / 2 - 0.05 || Math.abs(pz) >= template.d / 2 - 0.05) continue;
        const post = new Mesh(kit.geo(new BoxGeometry(t + 0.04, INNER_WALL_H + 0.25, t + 0.04)), trimMat);
        post.position.set(px, (INNER_WALL_H + 0.25) / 2, pz);
        post.castShadow = true;
        room.add(post);
      }
    }
    // Recessed spotlights (owner, Nov 20: the reference's bright, expensive rooms): a small lit disc under the ceiling line
    // every 1.6 m along the two far walls, each washing the wall below it in warm light. Sprites, not lights: cheap on phones.
    if (template.spotlights && !template.outdoor && !template.open) {
      const washTex = (() => {
        const c = document.createElement("canvas");
        c.width = 64; c.height = 128;
        const g2 = c.getContext("2d")!;
        const grad = g2.createRadialGradient(32, 10, 2, 32, 30, 70);
        grad.addColorStop(0, "rgba(255,226,170,0.55)"); grad.addColorStop(0.4, "rgba(255,214,150,0.16)"); grad.addColorStop(1, "rgba(255,214,150,0)");
        g2.fillStyle = grad; g2.fillRect(0, 0, 64, 128);
        return new CanvasTexture(c);
      })();
      const washMat = new SpriteMaterial({ map: washTex, transparent: true, depthWrite: false, blending: AdditiveBlending, opacity: night ? 0.7 : 0.35 });
      const discMat = kit.mat("#FFF4DC", { emissive: "#FFE7B8", emissiveIntensity: 1.4 });
      const along = (len: number) => { const n = Math.max(2, Math.floor(len / 1.6)); return Array.from({ length: n }, (_, i) => -len / 2 + (i + 0.5) * (len / n)); };
      for (const x of along(template.w)) {
        const disc = new Mesh(kit.geo(new BoxGeometry(0.16, 0.02, 0.16)), discMat);
        disc.position.set(x, WALL_H - 0.04, -template.d / 2 + 0.16);
        const wash = new Sprite(washMat); wash.scale.set(1.0, 1.5, 1); wash.position.set(x, WALL_H - 0.8, -template.d / 2 + 0.03);
        walls.zNeg.add(disc, wash);
      }
      for (const z of along(template.d)) {
        const disc = new Mesh(kit.geo(new BoxGeometry(0.16, 0.02, 0.16)), discMat);
        disc.position.set(-template.w / 2 + 0.16, WALL_H - 0.04, z);
        const wash = new Sprite(washMat); wash.scale.set(1.0, 1.5, 1); wash.position.set(-template.w / 2 + 0.03, WALL_H - 0.8, z);
        walls.xNeg.add(disc, wash);
      }
    }
    scene.add(room);
    // Dream mood: haze toward the sky color, and a few slow motes of light.
    const motes: Mesh[] = [];
    if (dream) {
      scene.fog = new Fog(derivedBackdrop(template, daytime).haze, template.skyline ? 70 : 32, template.skyline ? 130 : 60);
      const moteMat = new MeshStandardMaterial({ color: "#ffffff", emissive: night ? "#FFE6B0" : "#ffffff", emissiveIntensity: 0.9, transparent: true, opacity: 0.85 });
      for (let i = 0; i < 9; i++) {
        const m = new Mesh(kit.geo(new BoxGeometry(0.07, 0.07, 0.07)), moteMat);
        const a = i * 2.39;
        m.position.set(Math.cos(a) * (template.w * 0.45 + (i % 3) * 0.5), 1.2 + (i % 4) * 0.55, Math.sin(a) * (template.d * 0.45 + (i % 2) * 0.6));
        m.rotation.set(i, i * 0.5, 0);
        m.userData.baseY = m.position.y;
        motes.push(m);
        scene.add(m);
      }
    }

    const furniture = new Group();
    scene.add(furniture);
    // A warm pool of light from the floor lamp after dark.
    const lampLight = night && !template.dark ? new PointLight(0xffc98a, 6, 6, 1.4) : null;
    if (lampLight) scene.add(lampLight);
    const ring = new Mesh(new RingGeometry(0.1, 0.13, 32), new MeshStandardMaterial({ color: "#40B589", emissive: "#40B589", transparent: true, opacity: 0.9 }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    ring.visible = false;
    scene.add(ring);

    // The player and the regulars.
    const me: Actor = { rig: new Group(), parts: null, x: template.spawn[0], z: template.spawn[1], heading: 0.6, mode: "idle", path: [], pending: null, phase: 0 };
    scene.add(me.rig);
    const npcs: Actor[] = (template.npcs ?? []).map((n, i) => {
      const a: Actor = { rig: new Group(), parts: null, x: n.x, z: n.z, heading: n.facing, mode: n.seated ? "sit" : n.dance ? "dance" : "idle", path: [], pending: null, phase: i * 1.7, y: n.y };
      let seed = (template.id.length * 977 + i * 7919) % 2147483647;
      const rand = () => ((seed = (seed * 48271) % 2147483647) / 2147483647);
      const look = randomLook(rand, STARTING_STYLES.map((s) => s.id));
      // The clubs' go-go dancers (owner, Nov 20) wear their stage costume.
      if (n.costume === "gogo") {
        const dancer: Look = { ...look, body: "curvy", covering: "none", glasses: "none" };
        const base = starterOutfit(STARTING_STYLES.find((st) => st.id === dancer.style) ?? STARTING_STYLES[0], "curvy", null);
        a.parts = buildModelAvatar(dancer, { pedestal: false, outfit: { ...base, accessory: "none", pieces: gogoPieces(i) } });
      } else a.parts = buildModelAvatar(look, { pedestal: false });
      castShadows(a.parts.root);
      a.rig.add(a.parts.root);
      if (n.seated) poseSit(a.parts, 0.78);
      const onFloor = (template.items.find((it) => it.kind === "danceFloor"));
      if (!n.seated && template.items.some((it) => it.kind === "danceFloor" && Math.abs(n.x - it.x) < 1.5 && Math.abs(n.z - it.z) < 1.5)) a.mode = "dance";
      void onFloor;
      scene.add(a.rig);
      return a;
    });

    // Isometric orthographic camera, fitted to the room inside the free screen area.
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
    const baseDir = new Vector3(1, 1.15, 1.35).normalize();
    const dir = baseDir.clone();
    camera.position.copy(dir.clone().multiplyScalar(30));
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    const yAxis = new Vector3(0, 1, 0);
    let angle = 0;
    // Pinch zoom (owner, Oct 14): 1 shows the whole room; closer in, the view centers on the player.
    const ZOOM_MAX = 2.6;
    // Big public floors (owner, Nov 20) open a little zoomed in on the player; a pinch out shows the whole floor.
    let zoom = template.w * template.d >= 200 ? 1.6 : 1;
    let zoomDirty = false;
    const playerAt = new Vector3();
    // Outdoor plazas start the camera over the player.
    const camTarget = new Vector3(template.outdoor ? template.spawn[0] : 0, 0, template.outdoor ? template.spawn[1] : 0);
    if (template.outdoor) { camera.position.copy(camTarget).addScaledVector(dir, 30); camera.updateMatrixWorld(); }
    const fit = () => {
      const w = host.clientWidth || 1;
      const h = host.clientHeight || 1;
      renderer.setSize(w, h, false);
      const right = new Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
      const up = new Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
      let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
      // Outdoor plazas are bigger than the screen: frame a window around the player, not the whole square.
      const [vw, vd] = template.outdoor?.view ?? [template.w, template.d];
      for (const x of [-vw / 2, vw / 2]) for (const z of [-vd / 2, vd / 2]) for (const y of [0, template.outdoor?.height ?? WALL_H]) {
        const p = new Vector3(x, y, z);
        const u = p.dot(right);
        const v = p.dot(up);
        minU = Math.min(minU, u); maxU = Math.max(maxU, u); minV = Math.min(minV, v); maxV = Math.max(maxV, v);
      }
      const top = Math.min(insetTop, h * 0.3);
      const bottom = Math.min(insetBottom, h * 0.45);
      const availH = Math.max(80, h - top - bottom);
      const s = Math.max((maxU - minU) / (w * 0.94), (maxV - minV) / (availH * 0.96)) / zoom;
      let cu = (minU + maxU) / 2;
      let cv = (minV + maxV) / 2;
      if (zoom > 1) {
        const pull = 1 - 1 / zoom;
        playerAt.set(me.x - camTarget.x, 0.9, me.z - camTarget.z);
        cu += (playerAt.dot(right) - cu) * pull;
        cv += (playerAt.dot(up) - cv) * pull;
      }
      camera.left = cu - (w / 2) * s;
      camera.right = cu + (w / 2) * s;
      camera.top = cv + (top + availH / 2) * s;
      camera.bottom = camera.top - h * s;
      camera.updateProjectionMatrix();
    };
    fit();
    // v0.11 rotatable rooms: point the camera `a` radians round the room and show the far walls.
    const aim = (a: number) => {
      angle = a;
      dir.copy(baseDir).applyAxisAngle(yAxis, a);
      camera.position.copy(camTarget).addScaledVector(dir, 30);
      camera.lookAt(camTarget);
      camera.updateMatrixWorld();
      walls.xNeg.visible = dir.x > -0.2;
      walls.xPos.visible = dir.x < 0.2;
      walls.zNeg.visible = dir.z > -0.2;
      walls.zPos.visible = dir.z < 0.2;
      if (!props.rotatable) walls.xPos.visible = walls.zPos.visible = false;
      fit();
    };
    const ro = new ResizeObserver(fit);
    ro.observe(host);

    world.current = { scene, camera, kit, furniture, built: new Map(), me, npcs, ring, floor, dirty: true, fit };

    // ---- Input ----
    const ray = new Raycaster();
    const ndc = new Vector2();
    const floorPlane = new Plane(new Vector3(0, 1, 0), 0);
    const hitFloor = (cx: number, cy: number) => {
      const r = renderer.domElement.getBoundingClientRect();
      ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const p = new Vector3();
      return ray.ray.intersectPlane(floorPlane, p) ? p : null;
    };
    const hitItem = (cx: number, cy: number): RoomItem | null => {
      const r = renderer.domElement.getBoundingClientRect();
      ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      for (const h of ray.intersectObjects(furniture.children, true)) {
        const id = h.object.userData.itemId as string | undefined;
        const it = id ? itemsRef.current.find((i) => i.id === id) : undefined;
        if (it && !(FURNITURE[it.kind].walkable && !it.use && !editRef.current.editing)) return it;
      }
      return null;
    };
    const hitNpc = (cx: number, cy: number): number => {
      if (!propsRef.current.onNpcTap) return -1;
      const r = renderer.domElement.getBoundingClientRect();
      ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const hit = ray.intersectObjects(npcs.map((n) => n.rig), true)[0];
      if (!hit) return -1;
      return npcs.findIndex((n) => { let o: Object3D | null = hit.object; while (o) { if (o === n.rig) return true; o = o.parent; } return false; });
    };
    const hitCrowd = (cx: number, cy: number): CrowdMember | null => {
      if (!crowdRef.current.length) return null;
      const r = renderer.domElement.getBoundingClientRect();
      ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const hit = ray.intersectObjects(crowdRef.current.filter((c) => !c.leaving).map((c) => c.actor.rig), true)[0];
      if (!hit) return null;
      return crowdRef.current.find((c) => { let o: Object3D | null = hit.object; while (o) { if (o === c.actor.rig) return true; o = o.parent; } return false; })?.member ?? null;
    };
    // New bodies (owner, Oct 21): a tap on a regular or a player is a hello: they wave, and so do you when you're
    // standing, facing them.
    const greet = (other: Actor) => {
      if (other.mode === "idle") other.parts?.play?.("wave", true);
      if (me.mode === "idle" && me.parts?.play) {
        me.heading = Math.atan2(other.x - me.x, other.z - me.z);
        me.parts.play("wave", true);
      }
    };
    const talk = (i: number) => {
      const n = npcs[i];
      if (!n || !propsRef.current.onNpcTap) return;
      if (n.mode === "idle") n.heading = Math.atan2(me.x - n.x, me.z - n.z); // they look over when you talk to them
      greet(n);
      propsRef.current.onNpcTap(i);
    };
    let down: { x: number; y: number; moved: boolean; sliding?: boolean; held?: boolean } | null = null;
    // Owner, Oct 14: no labels over things; a tap uses a piece, and press-and-hold picks it up to arrange.
    let holdTimer: ReturnType<typeof setTimeout> | null = null;
    const clearHold = () => { if (holdTimer) clearTimeout(holdTimer); holdTimer = null; };
    // Sliding (owner, Oct 14): a sideways drag turns the room with the finger, then it settles on the
    // nearest quarter turn (a quick flick of a quarter's third is enough to go on to the next one).
    let slide = 0;
    const slideAngle = (dx: number) => (-dx / Math.max(240, host.clientWidth * 0.8)) * (Math.PI / 2);
    const canSlide = () => !!propsRef.current.rotatable;
    const swipeTurn = (d: { x: number; y: number; sliding?: boolean }, e: PointerEvent) => {
      if (!d.sliding) return;
      const quarters = slideAngle(e.clientX - d.x) / (Math.PI / 2);
      const step = Math.abs(quarters) < 0.33 ? 0 : Math.sign(quarters) * Math.max(1, Math.round(Math.abs(quarters)));
      slide = 0;
      angle = turnRef.current * (Math.PI / 2) + slideAngle(e.clientX - d.x); // ease on from where the finger left it
      setTurn((t) => t + step);
    };
    const touches = new Map<number, { x: number; y: number }>();
    let pinch: { d: number; zoom: number } | null = null;
    const spread = () => { const [a, b] = [...touches.values()]; return Math.hypot(a.x - b.x, a.y - b.y) || 1; };
    const setZoom = (z: number) => { zoom = Math.min(ZOOM_MAX, Math.max(1, z)); zoomDirty = true; };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoom(zoom * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)));
    };
    const onDown = (e: PointerEvent) => {
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.size === 2) {
        // A second finger: it's a pinch, not a tap, a slide or a drag.
        pinch = { d: spread(), zoom };
        if (down?.sliding) slide = 0;
        down = null;
        return;
      }
      if (touches.size > 2) return;
      down = { x: e.clientX, y: e.clientY, moved: false };
      try { renderer.domElement.setPointerCapture(e.pointerId); } catch { /* a pointer the browser no longer tracks */ }
      clearHold();
      if (propsRef.current.editable && !editRef.current.editing) {
        const at = { x: e.clientX, y: e.clientY };
        holdTimer = setTimeout(() => {
          const it = hitItem(at.x, at.y);
          if (!down || down.moved || !it || !FURNITURE[it.kind].movable) return;
          down.held = true;
          setEditing(true);
          setSelected(it.id);
          setNote(null);
        }, 450);
      }
    };
    const onMove = (e: PointerEvent) => {
      if (touches.has(e.pointerId)) touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && touches.size === 2) return setZoom(pinch.zoom * (spread() / pinch.d));
      if (!down) return;
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) { down.moved = true; clearHold(); }
      const dx = e.clientX - down.x;
      if (!down.sliding && down.moved && canSlide() && Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(e.clientY - down.y) * 1.5) down.sliding = true;
      if (down.sliding) { slide = slideAngle(dx); return; }
    };
    const onUp = (e: PointerEvent) => {
      touches.delete(e.pointerId);
      if (pinch) { if (touches.size < 2) pinch = null; down = null; return; }
      clearHold();
      const d = down;
      down = null;
      if (!d || d.held) return;
      if (d.moved) return swipeTurn(d, e);
      const it = hitItem(e.clientX, e.clientY);
      if (editRef.current.editing) {
        setSelected(it && FURNITURE[it.kind].movable ? it.id : null);
        return;
      }
      if (it?.use) return goUse(it);
      // Meeting players: tap a real player's figure to open their card.
      const person = hitCrowd(e.clientX, e.clientY);
      if (person && !person.npc && propsRef.current.onCrowdTap) {
        const c = crowdRef.current.find((x) => x.member.key === person.key);
        if (c && c.actor.mode === "idle") c.actor.heading = Math.atan2(me.x - c.actor.x, me.z - c.actor.z);
        if (c) greet(c.actor);
        return propsRef.current.onCrowdTap(person);
      }
      const npc = hitNpc(e.clientX, e.clientY);
      if (npc >= 0) return talk(npc);
      const p = hitFloor(e.clientX, e.clientY);
      if (p) walkTo([p.x, p.z], null);
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointermove", onMove);
    renderer.domElement.addEventListener("pointerup", onUp);
    const onCancel = (e: PointerEvent) => { touches.delete(e.pointerId); pinch = null; down = null; slide = 0; };
    renderer.domElement.addEventListener("wheel", onWheel, { passive: false });
    renderer.domElement.addEventListener("pointercancel", onCancel);

    // ---- Loop ----
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    let raf = 0;
    let last = performance.now();
    const start = last;
    const proj = new Vector3();
    // Cheap phones (owner, Nov 1): too slow for full graphics → sharpness and shadows drop now, low graphics after.
    const watch = quality.shadows ? frameWatch() : null;
    const frame = (now: number) => {
      raf = 0;
      if (watch?.(now) === "slow") {
        setAutoLowGraphics();
        renderer.setPixelRatio(1);
        renderer.shadowMap.enabled = false;
        scene.traverse((o) => {
          const m = (o as { material?: { needsUpdate: boolean } | { needsUpdate: boolean }[] }).material;
          for (const x of Array.isArray(m) ? m : m ? [m] : []) x.needsUpdate = true;
        });
        fit();
      }
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = (now - start) / 1000;
      const wld = world.current;
      if (!wld) return;
      if (wld.dirty) syncFurniture();
      stepActor(me, dt, t, reduceMotion, (it) => arrive(it));
      // The dog on a dog-walking stroll (owner, Nov 16: "No dog walking"): it trots a step behind, then goes home.
      if (dog) {
        const bx = me.x - Math.sin(me.heading) * 0.75 + Math.cos(me.heading) * 0.35, bz = me.z - Math.cos(me.heading) * 0.75 - Math.sin(me.heading) * 0.35;
        const k = Math.min(1, dt * 5);
        dog.position.x += (bx - dog.position.x) * k;
        dog.position.z += (bz - dog.position.z) * k;
        dog.rotation.y = me.heading;
        const moving = me.mode === "walk";
        dog.position.y = moving && !reduceMotion ? Math.abs(Math.sin(t * 14)) * 0.04 : 0;
        if (!moving && now > dogUntil) { scene.remove(dog); dog = null; }
      }
      for (const n of npcs) stepActor(n, dt, t, reduceMotion);
      let gone = false;
      for (const c of crowdRef.current) {
        stepActor(c.actor, dt, t, reduceMotion);
        if (c.actor.mode !== "idle") continue;
        if (c.leaving) gone = true;
        else if (c.dance) c.actor.mode = "dance";
      }
      // Crowded places: whoever walked out reached the door.
      if (gone) crowdRef.current = crowdRef.current.filter((c) => {
        if (!c.leaving || c.actor.mode !== "idle") return true;
        scene.remove(c.actor.rig);
        c.actor.parts?.dispose();
        return false;
      });
      if (!reduceMotion) {
        for (const b of wld.built.values()) b.tick?.(t);
        motes.forEach((m, i) => { m.position.y = m.userData.baseY + Math.sin(t * 0.6 + i) * 0.12; m.rotation.y = t * 0.4 + i; });
        glowLights.forEach((l, i) => { l.position.x = Math.sin(t * 0.7 + i * 2.1) * 2.6; l.position.z = Math.cos(t * 0.5 + i) * 2; });
        beams.forEach(({ pivot, mat, seed }) => {
          pivot.rotation.z = Math.sin(t * 0.7 + seed) * 0.75;
          pivot.rotation.x = Math.cos(t * 0.55 + seed * 1.3) * 0.45;
          mat.color.setHSL((t * 0.05 + seed * 0.13) % 1, 1, 0.5);
          mat.opacity = Math.floor(t * 2.2 + seed) % 4 === 0 ? 0.34 : 0.2;
        });
        pools.forEach(({ m, seed }) => {
          m.position.x = Math.sin(t * 0.35 + seed) * template.w * 0.3;
          m.position.z = Math.cos(t * 0.27 + seed * 1.7) * template.d * 0.3;
          (m.material as MeshBasicMaterial).color.setHSL((t * 0.07 + seed * 0.2) % 1, 0.9, 0.55);
        });
      }
      // Ring: the tap target while walking, or the selected piece while arranging.
      const { editing: ed, selected: sel } = editRef.current;
      const selItem = ed && sel ? itemsRef.current.find((i) => i.id === sel) : undefined;
      if (selItem) {
        const f = FURNITURE[selItem.kind];
        ring.visible = true;
        ring.position.set(selItem.x, 0.03, selItem.z);
        ring.scale.setScalar((Math.max(f.w, f.d) / 2 + 0.3) / 0.115);
        const ok = placementOk(template, itemsRef.current, selItem);
        (ring.material as MeshStandardMaterial).color.set(ok ? "#40B589" : "#D93A2F");
        (ring.material as MeshStandardMaterial).emissive.set(ok ? "#40B589" : "#D93A2F");
      } else if (me.path.length) {
        const [gx, gz] = me.path[me.path.length - 1];
        ring.visible = true;
        ring.position.set(gx, 0.03, gz);
        ring.scale.setScalar(1.6 + Math.sin(t * 6) * 0.15);
        (ring.material as MeshStandardMaterial).color.set("#FFFFFF");
        (ring.material as MeshStandardMaterial).emissive.set("#FFC21A");
      } else ring.visible = false;
      // Rotatable rooms: ease toward the chosen quarter turn.
      const goal = turnRef.current * (Math.PI / 2);
      if (zoom > 1 || zoomDirty) { zoomDirty = false; fit(); }
      if (slide) aim(goal + slide); // following the finger
      else if (Math.abs(goal - angle) > 1e-3) aim(reduceMotion ? goal : angle + (goal - angle) * Math.min(1, dt * 9));
      // Outdoor plazas: the camera glides after the player, kept over the paving.
      if (template.outdoor) {
        const [vw, vd] = template.outdoor.view;
        const cx = Math.max(-(template.w - vw) / 2, Math.min((template.w - vw) / 2, me.x));
        const cz = Math.max(-(template.d - vd) / 2, Math.min((template.d - vd) / 2, me.z));
        const k = reduceMotion ? 1 : Math.min(1, dt * 3);
        camTarget.x += (cx - camTarget.x) * k;
        camTarget.z += (cz - camTarget.z) * k;
        camera.position.copy(camTarget).addScaledVector(dir, 30);
        camera.updateMatrixWorld();
      }
      // Tap chips above usable things (hidden while they're off screen).
      for (const it of itemsRef.current) {
        const el = chipsRef.current.get(it.id);
        if (!el) continue;
        proj.set(it.x, chipHeight(it), it.z).project(camera);
        el.style.visibility = Math.abs(proj.x) > 1.05 || Math.abs(proj.y) > 1.05 ? "hidden" : "";
        el.style.transform = `translate(${((proj.x + 1) / 2) * host.clientWidth}px, ${((1 - proj.y) / 2) * host.clientHeight}px) translate(-50%, -100%)`;
      }
      // Every real player here: their @handle tag over their head (owner, Oct 15).
      for (const c of crowdRef.current) {
        const el = crowdTagsRef.current.get(c.member.key);
        if (!el) continue;
        proj.set(c.actor.x, 1.95, c.actor.z).project(camera);
        el.style.visibility = Math.abs(proj.x) > 1.05 || Math.abs(proj.y) > 1.05 ? "hidden" : "";
        el.style.transform = `translate(${((proj.x + 1) / 2) * host.clientWidth}px, ${((1 - proj.y) / 2) * host.clientHeight}px) translate(-50%, -100%)`;
      }
      // v0.11: a speech bubble over everyone you can talk to.
      npcs.forEach((n, i) => {
        const el = bubblesRef.current.get(i);
        if (!el) return;
        proj.set(n.x, n.mode === "sit" ? 1.55 : 2.05, n.z).project(camera);
        el.style.visibility = Math.abs(proj.x) > 1.05 || Math.abs(proj.y) > 1.05 ? "hidden" : "";
        el.style.transform = `translate(${((proj.x + 1) / 2) * host.clientWidth}px, ${((1 - proj.y) / 2) * host.clientHeight}px) translate(6px, -100%)`;
      });
      renderer.render(scene, camera);
      if (!document.hidden) raf = requestAnimationFrame(frame);
    };
    const kick = () => { if (!raf && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); } };
    kick();
    document.addEventListener("visibilitychange", kick);

    function syncFurniture() {
      const wld = world.current!;
      wld.dirty = false;
      const cur = itemsRef.current;
      for (const [id, b] of wld.built) if (!cur.some((i) => i.id === id)) { furniture.remove(b.obj); wld.built.delete(id); b.statue?.dispose(); }
      for (const it of cur) {
        let b = wld.built.get(it.id);
        if (!b) {
          const made = buildFurniture(it, kit, { night, low: lowGraphics() });
          const obj = new Group();
          obj.add(made.group);
          const statue = it.kind === "statue" ? goldStatue(lookRef.current.look, lookRef.current.outfit) : undefined;
          if (statue) { statue.root.position.y = STATUE_TOP; obj.add(statue.root); }
          castShadows(obj);
          tagItem(obj, it.id);
          furniture.add(obj);
          b = { ...made, obj, statue };
          wld.built.set(it.id, b);
        }
        b.obj.position.set(it.x, 0, it.z);
        b.obj.rotation.y = (it.rot * Math.PI) / 2;
        if (lampLight && it.kind === "floorLamp") lampLight.position.set(it.x, 1.5, it.z);
      }
    }

    // Arranging arrows (owner, Oct 14: plain up, right, down, left): each screen direction moves the
    // piece along the floor direction that looks closest to it from where the camera is now.
    const floorStep = (screen: number): [number, number] => {
      const o = new Vector3(0, 0, 0).project(camera);
      const W = host.clientWidth, H = host.clientHeight;
      const ang = FLOOR_DIRS.map(([ax, az]) => {
        const p = new Vector3(ax, 0, az).project(camera);
        return Math.atan2(-(p.y - o.y) * H, (p.x - o.x) * W); // screen angle, y down
      });
      // Sort the floor directions clockwise starting from straight up: up, right, down, left. Each
      // arrow gets one, so the four arrows always cover the four directions.
      const fromUp = (x: number) => ((x + Math.PI / 2) % (2 * Math.PI) + 2 * Math.PI + Math.PI / 4) % (2 * Math.PI);
      const order = [0, 1, 2, 3].sort((i, j) => fromUp(ang[i]) - fromUp(ang[j]));
      return FLOOR_DIRS[order[screen]];
    };
    // Seats (owner, Nov 16: "I could not sit on the chair while eating"): a meal or a hangout sits you on the free seat
    // nearest its table or counter. Any chair, stool, bench or sofa counts, used or not, unless a seated regular has it.
    const SEATS = new Set(["chair", "stool", "barStool", "bench", "sofa", "armchair", "diningChair", "booth", "loveseat"]);
    const sitNear = (near: RoomItem | null): boolean => {
      const taken = (it: RoomItem) => npcs.some((n) => n.mode === "sit" && Math.hypot(n.x - it.x, n.z - it.z) < 0.6);
      const seats = itemsRef.current.filter((i) => (SEATS.has(i.kind) || i.use?.kind === "sit") && !taken(i));
      if (!seats.length) return false;
      const ox = near?.x ?? me.x, oz = near?.z ?? me.z;
      const seat = seats.sort((a, b) => Math.hypot(a.x - ox, a.z - oz) - Math.hypot(b.x - ox, b.z - oz))[0];
      goUse({ ...seat, use: { kind: "sit" } }, true);
      return true;
    };
    // A stroll (owner, Nov 16: the dog walk and the lap "did nothing"): laps of the room's open ground for the action's
    // seconds, with a dog at your heels for a dog walk.
    let dog: Group | null = null;
    let dogUntil = 0;
    const stroll = (seconds: number, withDog: boolean) => {
      const grid = makeGrid(template, itemsRef.current);
      const hw = template.w * 0.32, hd = template.d * 0.32;
      const corners: [number, number][] = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]];
      let at: [number, number] = [me.x, me.z];
      const start = corners.reduce((b, c, i) => (Math.hypot(c[0] - at[0], c[1] - at[1]) < Math.hypot(corners[b][0] - at[0], corners[b][1] - at[1]) ? i : b), 0);
      const path: [number, number][] = [];
      let length = 0;
      const want = Math.max(4, seconds) * WALK_SPEED;
      for (let i = 0; i < 16 && length < want; i++) {
        const goal = corners[(start + i) % 4];
        const leg = findPath(grid, at, goal).slice(1);
        for (const p of leg) { length += Math.hypot(p[0] - at[0], p[1] - at[1]); path.push(p); at = p; }
      }
      if (!path.length) return;
      if (me.mode === "sit" || me.mode === "sleep" || me.mode === "dance") standUp(me);
      me.pending = null;
      me.path = path;
      me.run = false;
      me.mode = "walk";
      if (withDog && !dog) {
        dog = buildDog();
        dog.position.set(me.x - 0.6, 0, me.z - 0.6);
        scene.add(dog);
      }
      dogUntil = performance.now() + seconds * 1000;
    };
    actionsRef.current = { goUse, talk, floorStep, sitNear, stroll };

    function walkTo(goal: [number, number], use: RoomItem | null) {
      const grid = makeGrid(template, itemsRef.current);
      const path = findPath(grid, [me.x, me.z], goal);
      if (me.mode === "sit" || me.mode === "sleep" || me.mode === "dance") standUp(me);
      me.pending = use;
      if (!path.length) {
        if (use) arrive(use);
        return;
      }
      me.path = path.slice(1);
      let way = 0;
      for (let i = 1; i < path.length; i++) way += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
      me.run = !!me.parts?.play && way > RUN_FROM;
      if (!me.path.length) arrive(use);
      else me.mode = "walk";
    }
    // An act from a list (props.act): walk there and pose, but the action already ran, so no onUse.
    let silent: RoomItem | null = null;
    function goUse(it: RoomItem, quiet = false) {
      silent = quiet ? it : null;
      walkTo(useSpot(it), it);
    }
    function arrive(it: RoomItem | null) {
      me.pending = null;
      if (!it?.use) return;
      const quiet = silent === it;
      silent = null;
      const onUse = (x: RoomItem) => { if (!quiet) propsRef.current.onUse?.(x); };
      const [fx, fz] = FACING[it.rot % 4];
      const b = world.current?.built.get(it.id);
      if (it.use.kind === "sit" && me.parts) {
        me.x = it.x - fx * 0.05;
        me.z = it.z - fz * 0.05;
        me.heading = (it.rot * Math.PI) / 2;
        me.mode = "sit";
        poseSit(me.parts, b?.seatY ?? 0.48);
        onUse(it);
        return;
      }
      if (it.use.kind === "sleep" && me.parts) {
        me.heading = (it.rot * Math.PI) / 2;
        me.x = it.x + fx * 0.85;
        me.z = it.z + fz * 0.85;
        me.mode = "sleep";
        poseLie(me.parts, b?.seatY ?? 0.5);
        onUse(it);
        return;
      }
      me.heading = Math.atan2(it.x - me.x, it.z - me.z);
      if (it.use.kind === "events") me.mode = "dance";
      onUse(it);
    }

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener("visibilitychange", kick);
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointermove", onMove);
      renderer.domElement.removeEventListener("pointerup", onUp);
      renderer.domElement.removeEventListener("pointercancel", onCancel);
      renderer.domElement.removeEventListener("wheel", onWheel);
      me.parts?.dispose();
      npcs.forEach((n) => n.parts?.dispose());
      kit.dispose();
      floorTex.dispose();
      roomTexes.forEach((t) => t.dispose());
      (floor.material as MeshStandardMaterial).dispose();
      floor.geometry.dispose();
      ring.geometry.dispose();
      (ring.material as MeshStandardMaterial).dispose();
      renderer.dispose();
      renderer.domElement.remove();
      world.current = null;
      actionsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template.id, daytime, sign, mood]);

  // ---- The player's avatar, re-dressed on Look or outfit changes ----
  const lookKey = JSON.stringify([look, outfit ?? null]);
  lookRef.current = { look, outfit };
  const readySent = useRef(false);
  const onReadyRef = useRef(props.onReady);
  onReadyRef.current = props.onReady;
  useEffect(() => {
    const w = world.current;
    if (!w) return;
    const parts = buildModelAvatar(look, { outfit, pedestal: false });
    castShadows(parts.root);
    const old = w.me.parts;
    w.me.rig.add(parts.root);
    w.me.parts = parts;
    w.me.mode = "idle";
    if (!readySent.current) {
      void (parts.ready ?? Promise.resolve()).then(() => requestAnimationFrame(() => {
        if (readySent.current) return;
        readySent.current = true;
        sceneReady("room");
        onReadyRef.current?.();
      }));
    }
    // The old outfit stays on screen until the new model has loaded, so a change never blinks.
    if (old) {
      parts.root.visible = false;
      void (parts.ready ?? Promise.resolve()).then(() => {
        w.me.rig.remove(old.root);
        old.dispose();
        parts.root.visible = true;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lookKey, template.id, daytime, sign, mood]);

  // v0.11 party floors and meeting players: the crowd follows who's here. A new scene places everyone at
  // once; after that (crowded places, owner Oct 15) whoever leaves the view walks out the door and
  // whoever joins it walks in, so the room changes one person at a time instead of being rebuilt.
  const crowdKey = JSON.stringify((props.crowd ?? []).map((m) => [m.key, m.npc ? null : m.look]));
  const crowdWorld = useRef<unknown>(null);
  useEffect(() => {
    const w = world.current;
    if (!w) return;
    const fresh = crowdWorld.current !== w;
    if (fresh) {
      for (const c of crowdRef.current) { c.actor.rig.parent?.remove(c.actor.rig); c.actor.parts?.dispose(); }
      crowdRef.current = [];
      crowdWorld.current = w;
    }
    // Party floors have set spots; anywhere else, free floor away from the door and the regulars.
    const members = props.crowd ?? [];
    const spots = template.crowdSpots ?? openSpots(template, itemsRef.current, members.length);
    const party = !!template.crowdSpots;
    const want = members.slice(0, spots.length);
    const keys = new Set(want.map((m) => m.key));
    const grid = makeGrid(template, itemsRef.current);
    for (const c of crowdRef.current) {
      if (c.leaving || keys.has(c.member.key)) continue;
      c.leaving = true;
      c.dance = false;
      c.actor.path = findPath(grid, [c.actor.x, c.actor.z], template.spawn);
      c.actor.mode = "walk";
      c.actor.parts?.setMotion?.("walk");
    }
    const used = new Set(crowdRef.current.filter((c) => !c.leaving).map((c) => c.spot));
    want.forEach((member, i) => {
      const have = crowdRef.current.find((c) => !c.leaving && c.member.key === member.key);
      if (have) { have.member = member; return; }
      let spot = 0;
      while (used.has(spot)) spot++;
      used.add(spot);
      const s = spots[spot] ?? spots[spots.length - 1];
      let seed = (member.key.length * 977 + i * 7919 + 13) % 2147483647;
      const rand = () => ((seed = (seed * 48271) % 2147483647) / 2147483647);
      const look = !member.npc && member.look ? member.look : randomLook(rand, STARTING_STYLES.map((x) => x.id));
      const path = fresh ? [] : findPath(grid, template.spawn, [s.x, s.z]);
      const [x, z] = path.length ? template.spawn : [s.x, s.z];
      // Party floors, and anyone whose spot is on a dance floor, dance (owner, Oct 15).
      const dances = party || onDanceFloor(itemsRef.current, s.x, s.z);
      const actor: Actor = { rig: new Group(), parts: buildModelAvatar(look, { pedestal: false }), x, z, heading: s.facing, mode: path.length ? "walk" : dances ? "dance" : "idle", path, pending: null, phase: i * 1.3 };
      castShadows(actor.parts!.root);
      actor.rig.add(actor.parts!.root);
      w.scene.add(actor.rig);
      crowdRef.current.push({ member, actor, spot, dance: dances });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crowdKey, template.id, daytime, sign, mood]);
  useEffect(() => () => {
    for (const c of crowdRef.current) { c.actor.rig.parent?.remove(c.actor.rig); c.actor.parts?.dispose(); }
    crowdRef.current = [];
  }, []);

  // Furniture moved or room changed: rebuild placements next frame.
  useEffect(() => {
    if (world.current) world.current.dirty = true;
  }, [items]);

  const usable = editing ? [] : items.filter((i) => i.use && i.label);
  const sel = items.find((i) => i.id === selected);

  const tapChip = (it: RoomItem) => actionsRef.current?.goUse(it);
  // props.act (owner, Nov 6): an action started from a list walks the avatar to its piece and plays it out there.
  const actKey = props.act?.key;
  useEffect(() => {
    const act = props.act;
    if (!act) return;
    const want = act.use;
    if (typeof want !== "string") {
      const strolls = /dog|lap|walk|run|jog/.test(want.action);
      const exact = itemsRef.current.find((i) => i.use?.kind === "action" && (i.use.actionId === want.action || (want.index !== undefined && i.use.actionId === `*${want.index}`))) ?? null;
      // Owner, Nov 16 ("what happens when Pet Also Sal is selected?"): an action with no piece of its own goes to the
      // piece it's about (the deli's cat), and a second meal at a counter goes to the counter.
      const about = /cat/.test(want.action) ? itemsRef.current.find((i) => i.kind === "cat") : null;
      const counter = want.kind === "eat" ? itemsRef.current.find((i) => i.use?.kind === "action" && i.use.actionId === "eat") : null;
      const matched = exact ?? (about ? { ...about, use: { kind: "action" as const, actionId: want.action } } : null) ?? counter ?? null;
      // A dog walk or a lap is a stroll; a meal or a hangout sits you near its table; else walk to its piece, or stroll.
      if (strolls && (want.kind === "shift" || want.kind === "visit" || want.kind === "hangout")) { actionsRef.current?.stroll(want.seconds ?? 8, /dog/.test(want.action)); return; }
      if ((want.kind === "eat" || want.kind === "hangout") && actionsRef.current?.sitNear(matched)) return;
      if (!matched && (want.kind === "shift" || want.kind === "visit")) { actionsRef.current?.stroll(want.seconds ?? 8, false); return; }
      if (matched && matched !== exact) { actionsRef.current?.goUse(matched, true); return; }
    }
    const fits = itemsRef.current.filter((i) => {
      const u = i.use;
      if (!u) return false;
      if (typeof want === "string") return u.kind === want;
      return u.kind === "action" && (u.actionId === want.action || (want.index !== undefined && u.actionId === `*${want.index}`));
    });
    // Sit on the sofa (then an armchair) rather than a stool; sleep in the bed.
    const rank = (k: string) => (want === "sit" ? ["sofa", "armchair", "bench"] : want === "sleep" ? ["bed"] : []).indexOf(k);
    const it = [...fits].sort((x, y) => (rank(x.kind) < 0 ? 99 : rank(x.kind)) - (rank(y.kind) < 0 ? 99 : rank(y.kind)))[0];
    if (it) actionsRef.current?.goUse(it, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actKey]);
  // Move the selected piece a grid step; clamped to the room. Overlaps are allowed on the way (the
  // ring turns red and Save waits) so a piece can pass another to reach a free spot.
  const nudge = (k: number) => {
    const step = actionsRef.current?.floorStep(k);
    if (!step) return;
    const [ax, az] = step;
    setNote(null);
    setItems((cur) => cur.map((i) => (i.id === editRef.current.selected ? clampItem(template, { ...i, x: snap(i.x + ax * GRID), z: snap(i.z + az * GRID) }) : i)));
  };
  // Hold an arrow to keep moving.
  const holdRef = useRef<{ t: ReturnType<typeof setTimeout> | null; i: ReturnType<typeof setInterval> | null }>({ t: null, i: null });
  const stopHold = () => {
    if (holdRef.current.t) clearTimeout(holdRef.current.t);
    if (holdRef.current.i) clearInterval(holdRef.current.i);
    holdRef.current = { t: null, i: null };
  };
  const startHold = (k: number) => {
    stopHold();
    nudge(k);
    holdRef.current.t = setTimeout(() => { holdRef.current.i = setInterval(() => nudge(k), 90); }, 350);
  };
  useEffect(() => stopHold, []);
  const spotTaken = !!sel && !placementOk(template, items, sel);
  // #19 Fif's Furniture: bought pieces not in the room are in storage.
  const stored = owned.filter((o) => !items.some((i) => i.id === o.id));
  const takeOut = (p: OwnedPiece) => {
    const spot = freeSpot(template, items, ownedItem(p, 0, 0, 0));
    if (!spot) { setNote("No free spot for it. Move or put away something first."); return; }
    setItems((cur) => [...cur, spot]);
    setSelected(p.id);
    setNote(null);
  };
  const putAway = (id: string) => { setItems((cur) => cur.filter((i) => i.id !== id)); setSelected(null); setNote(null); };
  const trial = props.trial;
  const endTrial = () => { setItems(savedRef.current); setEditing(false); setSelected(null); setNote(null); props.onTrialEnd?.(); };

  return (
    <div className="room3d layer" style={{ background: derivedBackdrop(template, daytime).css }}>
      <div ref={hostRef} className="layer" role="img" aria-label={label} />
      {failed && (
        <div className="layer" style={{ display: "grid", placeItems: "center", padding: 32, textAlign: "center" }}>
          <p className="subtext" style={{ color: "rgba(255,246,224,.7)" }}>This room needs WebGL, which this browser has switched off.</p>
        </div>
      )}
      {props.onNpcTap && !editing && (
        <div className="room-chips" aria-label="People you can talk to">
          {(template.npcs ?? []).map((_, i) => (
            <button
              key={i}
              ref={(el) => { if (el) bubblesRef.current.set(i, el); else bubblesRef.current.delete(i); }}
              // Owner, Oct 31: "Remove the chat bubbles": nothing over people's heads; tap the person to talk. The buttons stay,
              // hidden, for keyboards and screen readers.
              className="sr-only"
              onClick={() => actionsRef.current?.talk(i)}
              aria-label={props.npcNames?.[i] ? `Talk to ${props.npcNames[i]}` : "Talk"}
            />
          ))}
        </div>
      )}
      {(props.crowd?.length ?? 0) > 0 && !editing && (
        <div className="room-chips" aria-label="Players here">
          {/* Owner, Oct 15: every real player wears their @handle in a blue tag (NPCs blend into the crowd).
              Tap a tag, or the person, to open their card. On party floors, only those with a spot. */}
          {(props.crowdDots !== false ? props.crowd!.slice(0, template.crowdSpots?.length ?? 0) : props.crowd!).map((m) => m.npc ? null : (
            <button
              key={m.key}
              ref={(el) => { if (el) crowdTagsRef.current.set(m.key, el); else crowdTagsRef.current.delete(m.key); }}
              className="player-tag"
              onClick={() => props.onCrowdTap?.(m)}
              aria-label={m.crew ? `${m.name}, in your crew` : `${m.name}, a player here`}
            >
              {m.name.startsWith("@") ? m.name : `@${m.name}`}
            </button>
          ))}
        </div>
      )}
      {/* Owner, Oct 14: no labels over things (tap around to find out what they do). The buttons stay for
          keyboards and screen readers only. */}
      <div className="room-chips" aria-label="Things you can use">
        {usable.map((it) => (
          <button
            key={it.id}
            ref={(el) => { if (el) chipsRef.current.set(it.id, el); else chipsRef.current.delete(it.id); }}
            className="sr-only"
            onClick={() => tapChip(it)}
            aria-label={it.name}
          >
            {props.labels?.[it.id] ?? it.label}
          </button>
        ))}
      </div>
      {editable && !editing && (
        <button className="room-storage glass-hud" style={{ top: `calc(${insetTop - 44}px + var(--safe-top))` }} onClick={() => { setEditing(true); setSelected(null); setNote(null); }}
          aria-label={stored.length ? `Arrange your home, ${stored.length} in storage` : "Arrange your home"}>
          🛋️{stored.length > 0 ? ` 📦 ${stored.length}` : ""}
        </button>
      )}
      {(editable || trial) && editing && (
        <div className="room-edit" style={{ top: `calc(${insetTop - 48}px + var(--safe-top))` }}>
          {editing ? (
            <div className="room-edit-bar glass-hud" role="group" aria-label="Arrange furniture">
              <span className="meta" style={{ color: "var(--text-1)" }}>{note ?? (spotTaken ? "That spot's taken. Keep it moving." : sel ? `Use the arrows to move the ${FURNITURE[sel.kind].label.toLowerCase()}` : "Tap a piece to move it")}</span>
              {/* Owner, Oct 14: one row. Rotate and the arrows on the left, Cancel and Save on the right. */}
              <div className="room-edit-row">
                <div className="room-edit-tools" role="group" aria-label={sel ? `Move the ${FURNITURE[sel.kind].label.toLowerCase()}` : "Move"}>
                  <button className="chip" disabled={!sel} onClick={() => sel && setItems((cur) => cur.map((i) => (i.id === sel.id ? { ...i, rot: (i.rot + 1) % 4 } : i)))}>↻ Rotate</button>
                  {ARROW_ORDER.map((k) => (
                    <button
                      key={ARROWS[k].name}
                      className="room-arrow"
                      disabled={!sel}
                      aria-label={`Move ${ARROWS[k].name}`}
                      onPointerDown={(e) => { e.preventDefault(); if (sel) startHold(k); }}
                      onPointerUp={stopHold}
                      onPointerLeave={stopHold}
                      onPointerCancel={stopHold}
                      onKeyDown={(e) => { if (sel && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); nudge(k); } }}
                    >
                      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" style={{ transform: `rotate(${ARROWS[k].turn}deg)` }}>
                        <path d="M12 20V5M5.5 11.5 12 5l6.5 6.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  ))}
                </div>
                <div className="room-edit-tools">
                {sel && isOwnedId(sel.id) && <button className="chip" onClick={() => putAway(sel.id)}>📦 Put away</button>}
                {trial ? (
                  <>
                    <button className="chip" onClick={endTrial}>Back</button>
                    <button
                      className="chip"
                      aria-pressed="true"
                      disabled={saving || !trial.canAfford || items.some((i) => !placementOk(template, items, i))}
                      onClick={async () => {
                        setSaving(true);
                        const ok = (await props.onTrialBuy?.(toLayout(items, floorNo))) ?? false;
                        setSaving(false);
                        if (ok) { setEditing(false); setSelected(null); setNote(null); props.onTrialEnd?.(); }
                      }}
                    >
                      {saving ? "…" : trial.canAfford ? `Buy · ${formatCash(trial.price)}` : "Can't afford it"}
                    </button>
                  </>
                ) : (
                <>
                <button className="chip" onClick={() => { setItems(savedRef.current); setEditing(false); setSelected(null); setNote(null); }}>Cancel</button>
                <button
                  className="chip"
                  aria-pressed="true"
                  disabled={saving || items.some((i) => !placementOk(template, items, i))}
                  onClick={async () => {
                    setSaving(true);
                    const ok = (await props.onSaveLayout?.(toLayout(items, floorNo))) ?? true;
                    setSaving(false);
                    if (ok) { savedRef.current = items; setEditing(false); setSelected(null); setNote(null); }
                  }}
                >
                  {saving ? "…" : "Save"}
                </button>
                </>
                )}
                </div>
              </div>
              {!trial && stored.length > 0 && (
                <div className="room-storage-row" role="group" aria-label="In storage">
                  <span className="meta">📦 In storage</span>
                  {stored.map((p) => (
                    <button key={p.id} className="chip" onClick={() => takeOut(p)} aria-label={`Place the ${p.name}`}>
                      <span aria-hidden="true">{p.emoji}</span> {p.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

/** The four floor directions a piece can move (one grid step a tap), in turn round the room. */
const FLOOR_DIRS: [number, number][] = [[0, -1], [1, 0], [0, 1], [-1, 0]];
/** The arranging arrows, clockwise from up (the order floorStep expects). */
const ARROWS = [
  // One drawn arrow turned four ways (#16, owner Oct 14): text arrows came out in different sizes and greys on iPhone.
  { name: "up", turn: 0 },
  { name: "right", turn: 90 },
  { name: "down", turn: 180 },
  { name: "left", turn: 270 },
] as const;
/** The order the arrows sit in the bar (owner, Oct 14): up, right, left, down. */
const ARROW_ORDER = [0, 1, 3, 2];

// ---------------------------------------------------------------------------
// Animation and poses
// ---------------------------------------------------------------------------
function stepActor(a: Actor, dt: number, t: number, reduce: boolean, onArrive?: (it: RoomItem | null) => void) {
  poseActor(a, dt, t, reduce, onArrive);
  // The modeled avatar plays its clip, then takes the limb turns set above.
  // Reduced motion freezes standing and dancing; sitting and lying still settle into their pose.
  a.parts?.update?.(reduce && a.mode !== "walk" && a.mode !== "sit" && a.mode !== "sleep" ? 0 : dt);
}

function poseActor(a: Actor, dt: number, t: number, reduce: boolean, onArrive?: (it: RoomItem | null) => void) {
  const p = a.parts;
  a.rig.position.set(a.x, a.y ?? 0, a.z);
  if (!p) return;
  if (a.mode === "walk") {
    const target = a.path[0];
    if (!target) {
      a.mode = "idle";
      a.run = false;
      resetLimbs(p);
      p.play?.(null);
      p.setMotion?.("idle");
      onArrive?.(a.pending);
      return;
    }
    const dx = target[0] - a.x;
    const dz = target[1] - a.z;
    const dist = Math.hypot(dx, dz);
    const step = (a.run ? RUN_SPEED : WALK_SPEED) * dt;
    if (dist <= step) {
      a.x = target[0];
      a.z = target[1];
      a.path.shift();
    } else {
      a.x += (dx / dist) * step;
      a.z += (dz / dist) * step;
    }
    if (dist > 0.01) a.heading = turnToward(a.heading, Math.atan2(dx, dz), dt * 10);
    a.phase += dt * 9;
    // The modeled avatar walks with its own clip.
    if (p.setMotion) {
      if (p.hips) resetLimbs(p); // off the dance floor: no dance pose on top of the walk
      p.setMotion("walk");
      p.play?.(a.run ? "run" : null);
      a.rig.rotation.y = a.heading;
      return;
    }
    const s = Math.sin(a.phase);
    p.legs[0].rotation.x = s * 0.55;
    p.legs[1].rotation.x = -s * 0.55;
    p.knees[0].rotation.x = Math.max(0, -s) * 0.7;
    p.knees[1].rotation.x = Math.max(0, s) * 0.7;
    p.arms[0].rotation.x = -s * 0.45;
    p.arms[1].rotation.x = s * 0.45;
    p.body.position.y = Math.abs(s) * 0.03;
  } else if (a.mode === "dance" && !reduce) {
    // New bodies dance with their own clip; the others with the poses drawn in code.
    if (p.play) p.play("dance");
    else dance(p, t, a.phase);
  } else if (a.mode === "idle" && !reduce) {
    p.torso.scale.y = 1 + Math.sin(t * 2.1 + a.phase) * 0.008;
  }
  a.rig.rotation.y = a.heading;
}

/**
 * Dancing (owner, Oct 15), drawn in code on the shared skeleton: four styles on a 120 BPM beat. Each
 * person's phase picks their style and puts them a little off the beat, so a crowd never moves as one.
 * Turns are in the avatar's own frame; arms[0] and forearms[0] are on its -x side.
 */
const BEAT = Math.PI * 4; // 2 beats a second
export function dance(p: AvatarParts, t: number, phase: number) {
  const style = Math.abs(Math.floor(phase * 7.3)) % 4;
  const b = (t + (phase % 1) * 0.12) * BEAT;
  const s = Math.sin(b), c = Math.cos(b);
  const half = Math.sin(b / 2);
  const bounce = Math.abs(s);
  const [la, ra] = p.arms;
  const [lf, rf] = p.forearms ?? [];
  p.body.position.y = bounce * 0.045;
  p.head.rotation.set(0.1 * bounce, 0, 0);
  p.root.rotation.y = 0;
  for (const k of p.knees) k.rotation.x = 0;
  for (const l of p.legs) l.rotation.x = 0;
  if (style === 0) {
    // Fist pump: one arm punching up on the beat, the other at the hip.
    ra.rotation.set(-2.5 + 0.45 * s, 0, 0.2);
    la.rotation.set(-0.5 + 0.2 * c, 0, -0.25);
    rf?.rotation.set(-0.35, 0, 0);
    lf?.rotation.set(-1.5, 0, 0);
    p.hips?.rotation.set(0, 0.12 * half, 0.07 * half);
    p.chest?.rotation.set(0.05 * bounce, -0.1 * half, 0);
    p.knees[0].rotation.x = 0.25 * bounce;
    p.knees[1].rotation.x = 0.25 * bounce;
  } else if (style === 1) {
    // Sway: hips side to side on the half beat, arms loose and swinging.
    p.hips?.rotation.set(0, 0.1 * half, 0.16 * half);
    p.chest?.rotation.set(0, -0.08 * half, -0.12 * half);
    la.rotation.set(-0.45 + 0.25 * half, 0, -0.45 - 0.2 * half);
    ra.rotation.set(-0.45 - 0.25 * half, 0, 0.45 - 0.2 * half);
    lf?.rotation.set(-1.0 - 0.3 * c, 0, 0);
    rf?.rotation.set(-1.0 + 0.3 * c, 0, 0);
    p.knees[0].rotation.x = 0.35 * Math.max(0, half);
    p.knees[1].rotation.x = 0.35 * Math.max(0, -half);
  } else if (style === 2) {
    // Hands up: both arms high, waving in turn, a bigger bounce.
    p.body.position.y = bounce * 0.07;
    la.rotation.set(-2.7 + 0.25 * s, 0, -0.35);
    ra.rotation.set(-2.7 - 0.25 * s, 0, 0.35);
    lf?.rotation.set(-0.3 - 0.2 * c, 0, 0);
    rf?.rotation.set(-0.3 + 0.2 * c, 0, 0);
    p.hips?.rotation.set(0, 0, 0.06 * half);
    p.chest?.rotation.set(-0.08 * bounce, 0, 0);
    p.head.rotation.set(-0.15 * bounce, 0, 0);
    p.knees[0].rotation.x = 0.3 * bounce;
    p.knees[1].rotation.x = 0.3 * bounce;
  } else {
    // Twist: hips and chest turning against each other, elbows bent and pumping, feet stepping.
    p.hips?.rotation.set(0, 0.3 * s, 0);
    p.chest?.rotation.set(0, -0.22 * s, 0);
    la.rotation.set(-0.35 - 0.35 * s, 0, -0.3);
    ra.rotation.set(-0.35 + 0.35 * s, 0, 0.3);
    lf?.rotation.set(-1.5, 0, 0);
    rf?.rotation.set(-1.5, 0, 0);
    p.legs[0].rotation.x = -0.18 * Math.max(0, s);
    p.legs[1].rotation.x = -0.18 * Math.max(0, -s);
    p.knees[0].rotation.x = 0.4 * Math.max(0, s);
    p.knees[1].rotation.x = 0.4 * Math.max(0, -s);
  }
}

function turnToward(cur: number, target: number, k: number) {
  let d = target - cur;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return cur + d * Math.min(1, k);
}

export function resetLimbs(p: AvatarParts) {
  p.head.rotation.set(0, 0, 0);
  p.hips?.rotation.set(0, 0, 0);
  p.chest?.rotation.set(0, 0, 0);
  p.forearms?.forEach((o) => o.rotation.set(0, 0, 0));
  for (const o of [...p.legs, ...p.knees]) o.rotation.set(0, 0, 0);
  p.arms.forEach((o, i) => o.rotation.set(0, 0, (i === 0 ? -1 : 1) * 0.13));
  p.body.position.y = 0;
  p.root.position.set(0, 0, 0);
  p.root.rotation.set(0, 0, 0);
}

function standUp(a: Actor) {
  if (a.parts) {
    resetLimbs(a.parts);
    a.parts.pose?.(null);
    a.parts.play?.(null);
  }
  a.mode = "idle";
}

/** Whether a floor point is on one of the room's dance floors (they're square). */
function onDanceFloor(items: RoomItem[], x: number, z: number): boolean {
  return items.some((it) => it.kind === "danceFloor" && Math.abs(x - it.x) <= 1.4 && Math.abs(z - it.z) <= 1.4);
}

/** Hips on the seat, thighs forward, shins down (new bodies: their sit clip, on the seat). */
export function poseSit(p: AvatarParts, seatY: number) {
  resetLimbs(p);
  if (p.pose) return p.pose("sit", seatY);
  p.root.position.set(0, seatY + 0.04 - (p.hipY ?? 0.9), -0.12);
  for (const l of p.legs) l.rotation.x = -Math.PI / 2;
  for (const k of p.knees) k.rotation.x = Math.PI / 2;
  p.arms[0].rotation.x = -0.35;
  p.arms[1].rotation.x = -0.35;
}

/** On the back, head toward the headboard (new bodies: their sleep clip, on the mattress). */
export function poseLie(p: AvatarParts, mattressY: number) {
  resetLimbs(p);
  if (p.pose) return p.pose("lie", mattressY);
  p.root.rotation.x = -Math.PI / 2;
  p.root.position.set(0, mattressY + 0.14, 0);
}

function castShadows(o: Object3D) {
  o.traverse((c) => { if ((c as Mesh).isMesh) { c.castShadow = true; c.receiveShadow = true; } });
}

function chipHeight(it: RoomItem) {
  const tall: Partial<Record<RoomItem["kind"], number>> = { wardrobe: 2.3, bar: 1.6, cafeCounter: 1.7, deliCounter: 1.6, danceFloor: 0.6, bed: 1.1 };
  return tall[it.kind] ?? 1.2;
}

// ---------------------------------------------------------------------------
// Canvas textures
// ---------------------------------------------------------------------------
function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d")!] as const;
}

function floorTexture(t: RoomTemplate, night: boolean, dream = false): CanvasTexture {
  const px = 128;
  const [c, g] = canvas(px * t.w, px * t.d);
  const base = new Color(t.floor);
  if (night && !t.dark) base.multiplyScalar(0.8);
  g.fillStyle = base.getStyle();
  g.fillRect(0, 0, c.width, c.height);
  if (t.floorKind === "wood") {
    const plank = px * 0.22;
    for (let y = 0; y < c.height; y += plank) {
      const off = ((y / plank) % 3) * px * 0.7;
      g.fillStyle = "rgba(0,0,0,0.12)";
      g.fillRect(0, y, c.width, 2);
      for (let x = -off; x < c.width; x += px * 2.1) g.fillRect(x, y, 2, plank);
      g.fillStyle = `rgba(255,255,255,${0.03 + ((y / plank) % 4) * 0.015})`;
      g.fillRect(0, y + 2, c.width, plank - 2);
    }
  } else if (t.floorKind === "tile" || t.floorKind === "checker") {
    const s = px * 0.5;
    for (let y = 0; y < c.height; y += s) for (let x = 0; x < c.width; x += s) {
      if (t.floorKind === "checker" && ((x + y) / s) % 2 === 0) { g.fillStyle = "rgba(20,17,26,0.55)"; g.fillRect(x, y, s, s); }
      g.strokeStyle = "rgba(0,0,0,0.15)";
      g.strokeRect(x, y, s, s);
    }
  } else {
    for (let i = 0; i < 900; i++) {
      g.fillStyle = `rgba(255,255,255,${Math.random() * 0.04})`;
      g.fillRect(Math.random() * c.width, Math.random() * c.height, 3, 3);
    }
  }
  if (dream) {
    // A soft light pool toward the front-right corner, fading to a cooler back corner.
    const gl = g.createLinearGradient(0, 0, c.width, c.height);
    gl.addColorStop(0, night ? "rgba(90,74,154,0.28)" : "rgba(156,140,217,0.22)");
    gl.addColorStop(0.55, "rgba(255,255,255,0)");
    gl.addColorStop(1, night ? "rgba(255,184,160,0.18)" : "rgba(255,226,200,0.3)");
    g.fillStyle = gl;
    g.fillRect(0, 0, c.width, c.height);
  }
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = tex.wrapT = RepeatWrapping;
  return tex;
}

function windowTexture(night: boolean): CanvasTexture {
  const [c, g] = canvas(360, 240);
  const sky = g.createLinearGradient(0, 0, 0, 240);
  sky.addColorStop(0, night ? "#0E1A33" : "#7FB3E8");
  sky.addColorStop(1, night ? "#2A2350" : "#F6C9A0");
  g.fillStyle = sky;
  g.fillRect(0, 0, 360, 240);
  g.fillStyle = night ? "#0A0F1E" : "#6F7F99";
  for (let i = 0; i < 12; i++) {
    const x = i * 32;
    const h = 60 + ((i * 53) % 110);
    g.fillRect(x, 240 - h, 26, h);
    if (night) {
      g.fillStyle = "#FFD58A";
      for (let wy = 240 - h + 8; wy < 236; wy += 14) for (let wx = x + 4; wx < x + 22; wx += 8) if ((wx * wy) % 3) g.fillRect(wx, wy, 4, 6);
      g.fillStyle = "#0A0F1E";
    }
  }
  g.fillStyle = "#F4F1EA";
  g.fillRect(178, 0, 4, 240);
  g.fillRect(0, 118, 360, 4);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

function signTexture(text: string, t: RoomTemplate): CanvasTexture {
  const [c, g] = canvas(1024, 256);
  g.fillStyle = t.dark ? "#0B0910" : t.wallAccent;
  g.fillRect(0, 0, 1024, 256);
  g.font = "800 112px system-ui, -apple-system, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  if (t.dark) {
    g.shadowColor = "#FF2E88";
    g.shadowBlur = 36;
    g.fillStyle = "#FF6FB0";
  } else g.fillStyle = "#FFFFFF";
  g.fillText(text.toUpperCase(), 512, 132, 960);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

/** Walls that fade from a lighter, sky-tinted top to a warmer base (dream mood). */
function gradientWallMaterial(t: RoomTemplate, night: boolean): MeshStandardMaterial {
  const [c, g] = canvas(4, 256);
  const base = new Color(t.wall);
  const top = base.clone().lerp(new Color(night ? "#E6D8FF" : "#FFFFFF"), night ? 0.15 : 0.35);
  // Shade toward the room's own accent so natural colors stay natural.
  const bottom = base.clone().lerp(new Color(t.wallAccent), night ? 0.3 : 0.2).lerp(new Color(night ? "#3A2C5E" : "#ffffff"), night ? 0.15 : 0);
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, top.getStyle());
  grad.addColorStop(1, bottom.getStyle());
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 256);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  return new MeshStandardMaterial({ map: tex, roughness: 0.95, flatShading: true });
}

/**
 * The gradient behind a room, derived from the room's own interior colors (its
 * walls, accent and floor), so each place's sky is an offshoot of its inside.
 */
export function derivedBackdrop(t: RoomTemplate, daytime: boolean): { css: string; haze: string } {
  const night = !(daytime || t.alwaysLit) || !!t.dark;
  const hsl = (hex: string) => { const o = { h: 0, s: 0, l: 0 }; new Color(hex).getHSL(o, SRGBColorSpace); return o; };
  const wall = hsl(t.wall);
  const accent = hsl(t.wallAccent);
  // Hue drifts from the walls (top) toward the accent (bottom), with saturation lifted
  // to a pastel so even beige rooms get a warm, delightful sky.
  const mix = (a: number, b: number, k: number) => { let d = b - a; if (d > 0.5) d -= 1; if (d < -0.5) d += 1; return (a + d * k + 1) % 1; };
  const sat = (x: number, min: number) => Math.min(0.85, Math.max(min, x * 1.4));
  const stop = (h: number, s: number, l: number) => new Color().setHSL(h, s, l, SRGBColorSpace).getStyle(SRGBColorSpace);
  const hTop = mix(wall.h, accent.h, 0.1);
  const hMid = mix(wall.h, accent.h, 0.5);
  const hBot = mix(accent.h, (accent.h + 0.94) % 1, 0.5); // a touch cooler at the base, like dusk
  const top = night ? stop(hTop, sat(wall.s, 0.4), 0.2) : stop(hTop, sat(wall.s, 0.55), 0.9);
  const mid = night ? stop(hMid, sat(accent.s, 0.45), 0.32) : stop(hMid, sat(accent.s, 0.5), 0.8);
  const bot = night ? stop(hBot, sat(accent.s, 0.45), 0.42) : stop(hBot, sat(accent.s, 0.45), 0.7);
  const glow = night ? `hsla(${Math.round(accent.h * 360)},80%,70%,.45)` : `hsla(${Math.round(hTop * 360)},90%,96%,.75)`;
  return {
    css: `radial-gradient(85% 45% at 72% 16%, ${glow}, transparent 70%), linear-gradient(180deg, ${top} 0%, ${mid} 52%, ${bot} 100%)`,
    haze: mid,
  };
}

/** A small dog for the dog-walking stroll: boxes in a warm brown, a darker snout and a wagging-ready tail. */
function buildDog(): Group {
  const g = new Group();
  const coat = new MeshStandardMaterial({ color: "#B07A4A", roughness: 0.8 });
  const dark = new MeshStandardMaterial({ color: "#4A2E1E", roughness: 0.8 });
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, m = coat) => {
    const b = new Mesh(new BoxGeometry(w, h, d), m);
    b.position.set(x, y, z);
    b.castShadow = true;
    g.add(b);
  };
  box(0.2, 0.16, 0.42, 0, 0.2, 0);
  box(0.17, 0.16, 0.17, 0, 0.32, 0.25);
  box(0.09, 0.07, 0.1, 0, 0.29, 0.37, dark);
  box(0.05, 0.08, 0.04, -0.06, 0.43, 0.23, dark);
  box(0.05, 0.08, 0.04, 0.06, 0.43, 0.23, dark);
  for (const [x, z] of [[-0.07, 0.15], [0.07, 0.15], [-0.07, -0.15], [0.07, -0.15]]) box(0.05, 0.13, 0.05, x, 0.065, z);
  box(0.04, 0.04, 0.16, 0, 0.27, -0.26);
  return g;
}
