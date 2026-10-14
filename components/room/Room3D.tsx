"use client";

import { useEffect, useRef, useState } from "react";
import {
  ACESFilmicToneMapping, AmbientLight, BoxGeometry, CanvasTexture, Color, DirectionalLight, Fog, Group, HemisphereLight, Mesh,
  MeshStandardMaterial, OrthographicCamera, PCFSoftShadowMap, Plane, PlaneGeometry, PointLight, Raycaster, RepeatWrapping,
  RingGeometry, SRGBColorSpace, Scene, Vector2, Vector3, WebGLRenderer, type Object3D,
} from "three";
import { randomLook, type Look } from "@/lib/look";
import type { CrowdMember } from "@/lib/partyRoom";
import {
  FACING, FURNITURE, applyLayout, findPath, makeGrid, placementOk, snap, toLayout, useSpot,
  type LayoutEntry, type RoomItem, type RoomTemplate,
} from "@/lib/rooms";
import { STARTING_STYLES, type Outfit } from "@/lib/styles";
import { buildAvatar, type AvatarParts } from "../avatar/buildAvatar";
import { buildFurniture, makeKit, tagItem, type Built, type Kit } from "./furniture";

// A walkable low-poly room (Design guide update 7): an isometric cutaway with the
// player's avatar, which walks where you tap, sits on seats, naps on the bed and
// walks up to counters to use them (tap the label over a thing). At home, tapping a
// piece of furniture selects it to drag and rotate; the layout is saved per player.
// Every room turns with a sideways slide and zooms with a pinch (v0.11, owner Oct 14).

const WALL_H = 2.7;
const WALK_SPEED = 1.5;

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
  onSaveLayout?: (layout: LayoutEntry[]) => Promise<boolean>;
  label: string;
  /** Screen space kept clear for the HUD (top) and panels (bottom), in px. */
  insetTop?: number;
  insetBottom?: number;
  /** Lets the screen hide overlapping chrome while furniture is being arranged. */
  onEditingChange?: (editing: boolean) => void;
  /**
   * v0.11 (spec section 11): the view turns in 90° steps, with the ↻ button or a sideways swipe
   * (the apartment). The two walls nearest the camera are cut away, whichever way it faces.
   */
  rotatable?: boolean;
  /**
   * v0.11 (owner, Oct 14): a front door by the spot you come in, with a doormat and a "Go out" label;
   * tapping it walks you out (to the map). The door shows on the front wall when the view turns to it.
   */
  onExit?: () => void;
  /**
   * v0.11 party floors: the people at the party (real players and NPCs, marked), standing at the
   * template's crowdSpots, each with a name tag. Tapping a real player's tag calls onCrowdTap.
   */
  crowd?: CrowdMember[];
  onCrowdTap?: (m: CrowdMember) => void;
  /**
   * "dream" (the default, approved Oct 12, 2026) is the Monument Valley-inspired look:
   * gradient walls, warm-lit and lavender-shaded faces, soft shadows, haze and motes.
   * "natural" keeps the plain lighting for side-by-side previews.
   */
  mood?: "natural" | "dream";
}

export default function Room3D(props: Room3DProps) {
  const { template, layout, look, outfit, sign, editable, label, insetTop = 120, insetBottom = 96, mood = "dream" } = props;
  // Some shops keep their daytime lights on all night (the lotto's bright yellow room).
  const daytime = props.daytime || !!template.alwaysLit;
  const dream = mood === "dream";
  const hostRef = useRef<HTMLDivElement>(null);
  const chipsRef = useRef<Map<string, HTMLButtonElement>>(new Map());
  const bubblesRef = useRef<Map<number, HTMLButtonElement>>(new Map());
  const exitRef = useRef<HTMLButtonElement | null>(null);
  const crowdTagsRef = useRef<Map<string, HTMLButtonElement>>(new Map());
  const crowdRef = useRef<{ member: CrowdMember; actor: Actor }[]>([]);
  const propsRef = useRef(props);
  propsRef.current = props;
  const [failed, setFailed] = useState(false);
  const [items, setItems] = useState<RoomItem[]>(() => applyLayout(template, layout));
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
  const actionsRef = useRef<{ goUse: (it: RoomItem) => void; talk: (i: number) => void; goExit: () => void } | null>(null);

  // Re-apply when the room or saved layout changes (not while arranging).
  const layoutKey = JSON.stringify(layout ?? null);
  useEffect(() => {
    const next = applyLayout(template, layout);
    setItems(next);
    savedRef.current = next;
    setEditing(false);
    setSelected(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template.id, layoutKey]);

  const world = useRef<{
    scene: Scene; camera: OrthographicCamera; kit: Kit; furniture: Group; built: Map<string, Built & { obj: Group }>;
    me: Actor; npcs: Actor[]; ring: Mesh; floor: Mesh; dirty: boolean; fit: () => void;
  } | null>(null);

  // ---- Scene (per room and time of day) ----
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
    renderer.toneMappingExposure = template.dark ? 1.15 : 1.0;
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = true;
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
    const back = new Mesh(kit.geo(new BoxGeometry(template.w + 0.12, WALL_H, 0.12)), wallMat);
    back.position.set(-0.06, WALL_H / 2, -template.d / 2 - 0.06);
    back.receiveShadow = true;
    const left = new Mesh(kit.geo(new BoxGeometry(0.12, WALL_H, template.d)), wallMat);
    left.position.set(-template.w / 2 - 0.06, WALL_H / 2, 0);
    left.receiveShadow = true;
    const skirtB = new Mesh(kit.geo(new BoxGeometry(template.w, 0.12, 0.03)), trimMat);
    skirtB.position.set(0, 0.06, -template.d / 2 + 0.015);
    const skirtL = new Mesh(kit.geo(new BoxGeometry(0.03, 0.12, template.d)), trimMat);
    skirtL.position.set(-template.w / 2 + 0.015, 0.06, 0);
    // Rotatable rooms get all four walls; only the two away from the camera show (see aim()).
    const walls = { xNeg: new Group(), xPos: new Group(), zNeg: new Group(), zPos: new Group() };
    if (props.rotatable && !template.outdoor) {
      const front = new Mesh(kit.geo(new BoxGeometry(template.w + 0.12, WALL_H, 0.12)), wallMat);
      front.position.set(0.06, WALL_H / 2, template.d / 2 + 0.06);
      front.receiveShadow = true;
      const right = new Mesh(kit.geo(new BoxGeometry(0.12, WALL_H, template.d)), wallMat);
      right.position.set(template.w / 2 + 0.06, WALL_H / 2, 0);
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
    if (props.onExit && !template.outdoor) {
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
    if (template.window && !template.outdoor) {
      const winTex = windowTexture(night);
      const win = new Mesh(kit.geo(new PlaneGeometry(1.8, 1.2)), kit.mat("#ffffff", { map: winTex, emissive: "#ffffff", emissiveIntensity: night ? 0.55 : 0.85 }));
      (win.material as MeshStandardMaterial).emissiveMap = winTex;
      win.position.set(-template.w / 2 + 0.01, 1.55, -template.d / 4);
      win.rotation.y = Math.PI / 2;
      const frame = new Mesh(kit.geo(new BoxGeometry(0.05, 1.32, 1.92)), kit.mat("#F4F1EA"));
      frame.position.set(-template.w / 2 + 0.005, 1.55, -template.d / 4);
      (template.outdoor ? room : walls.xNeg).add(frame, win);
    }
    if (sign && !template.outdoor) {
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
    scene.add(room);
    // Dream mood: haze toward the sky color, and a few slow motes of light.
    const motes: Mesh[] = [];
    if (dream) {
      scene.fog = new Fog(derivedBackdrop(template, daytime).haze, 32, 60);
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
      const a: Actor = { rig: new Group(), parts: null, x: n.x, z: n.z, heading: n.facing, mode: n.seated ? "sit" : "idle", path: [], pending: null, phase: i * 1.7 };
      let seed = (template.id.length * 977 + i * 7919) % 2147483647;
      const rand = () => ((seed = (seed * 48271) % 2147483647) / 2147483647);
      a.parts = buildAvatar(randomLook(rand, STARTING_STYLES.map((s) => s.id)), { pedestal: false });
      castShadows(a.parts.root);
      a.rig.add(a.parts.root);
      if (n.seated) poseSit(a.parts, 0.78);
      const onFloor = (template.items.find((it) => it.kind === "danceFloor"));
      if (onFloor && Math.abs(n.x - onFloor.x) < 1.5 && Math.abs(n.z - onFloor.z) < 1.5) a.mode = "dance";
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
    let zoom = 1;
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
    const talk = (i: number) => {
      const n = npcs[i];
      if (!n || !propsRef.current.onNpcTap) return;
      if (n.mode === "idle") n.heading = Math.atan2(me.x - n.x, me.z - n.z); // they look over when you talk to them
      propsRef.current.onNpcTap(i);
    };
    let down: { x: number; y: number; drag: RoomItem | null; moved: boolean; sliding?: boolean } | null = null;
    // Sliding (owner, Oct 14): a sideways drag turns the room with the finger, then it settles on the
    // nearest quarter turn (a quick flick of a quarter's third is enough to go on to the next one).
    let slide = 0;
    const slideAngle = (dx: number) => (-dx / Math.max(240, host.clientWidth * 0.8)) * (Math.PI / 2);
    const canSlide = (d: { drag: RoomItem | null }) => !!propsRef.current.rotatable && !editRef.current.editing && !d.drag;
    const swipeTurn = (d: { x: number; y: number; drag: RoomItem | null; sliding?: boolean }, e: PointerEvent) => {
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
      const { editing: ed, selected: sel } = editRef.current;
      const it = ed ? hitItem(e.clientX, e.clientY) : null;
      down = { x: e.clientX, y: e.clientY, drag: ed && it && it.id === sel ? it : null, moved: false };
      try { renderer.domElement.setPointerCapture(e.pointerId); } catch { /* a pointer the browser no longer tracks */ }
    };
    const onMove = (e: PointerEvent) => {
      if (touches.has(e.pointerId)) touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && touches.size === 2) return setZoom(pinch.zoom * (spread() / pinch.d));
      if (!down) return;
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) down.moved = true;
      const dx = e.clientX - down.x;
      if (!down.sliding && down.moved && canSlide(down) && Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(e.clientY - down.y) * 1.5) down.sliding = true;
      if (down.sliding) { slide = slideAngle(dx); return; }
      if (down.drag && down.moved) {
        const p = hitFloor(e.clientX, e.clientY);
        if (!p) return;
        const next = itemsRef.current.map((i) => (i.id === down!.drag!.id ? { ...i, x: snap(p.x), z: snap(p.z) } : i));
        setItems(next);
      }
    };
    const onUp = (e: PointerEvent) => {
      touches.delete(e.pointerId);
      if (pinch) { if (touches.size < 2) pinch = null; down = null; return; }
      const d = down;
      down = null;
      if (!d) return;
      if (d.drag) {
        if (d.moved) {
          const moved = itemsRef.current.find((i) => i.id === d.drag!.id)!;
          if (!placementOk(template, itemsRef.current, moved)) {
            setItems((cur) => cur.map((i) => (i.id === d.drag!.id ? d.drag! : i)));
            setNote("That spot's taken. Try somewhere else.");
          }
        }
        return;
      }
      if (d.moved) return swipeTurn(d, e);
      const it = hitItem(e.clientX, e.clientY);
      if (editRef.current.editing) {
        setSelected(it && FURNITURE[it.kind].movable ? it.id : null);
        return;
      }
      // Owner, Oct 14: tapping a piece of furniture at home selects it for arranging (move, rotate);
      // its label above it is how you use it.
      if (it && propsRef.current.editable && FURNITURE[it.kind].movable) {
        setEditing(true);
        setSelected(it.id);
        setNote(null);
        return;
      }
      if (it?.use) return goUse(it);
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
    const frame = (now: number) => {
      raf = 0;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = (now - start) / 1000;
      const wld = world.current;
      if (!wld) return;
      if (wld.dirty) syncFurniture();
      stepActor(me, dt, t, reduceMotion, (it) => arrive(it));
      for (const n of npcs) stepActor(n, dt, t, reduceMotion);
      for (const c of crowdRef.current) stepActor(c.actor, dt, t, reduceMotion);
      if (!reduceMotion) {
        for (const b of wld.built.values()) b.tick?.(t);
        motes.forEach((m, i) => { m.position.y = m.userData.baseY + Math.sin(t * 0.6 + i) * 0.12; m.rotation.y = t * 0.4 + i; });
        glowLights.forEach((l, i) => { l.position.x = Math.sin(t * 0.7 + i * 2.1) * 2.6; l.position.z = Math.cos(t * 0.5 + i) * 2; });
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
      // v0.11: the "Go out" label over the doormat.
      if (exitRef.current) {
        // Just under the doormat, so it doesn't sit on the player (who starts on the mat).
        proj.set(doorX, 0, template.d / 2 - 0.12).project(camera);
        exitRef.current.style.visibility = Math.abs(proj.x) > 1.05 || Math.abs(proj.y) > 1.05 ? "hidden" : "";
        exitRef.current.style.transform = `translate(${((proj.x + 1) / 2) * host.clientWidth}px, ${((1 - proj.y) / 2) * host.clientHeight}px) translate(-50%, 6px)`;
      }
      // v0.11 party floors: a name tag over each person at the party.
      for (const c of crowdRef.current) {
        const el = crowdTagsRef.current.get(c.member.key);
        if (!el) continue;
        proj.set(c.actor.x, 2.1, c.actor.z).project(camera);
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
      for (const [id, b] of wld.built) if (!cur.some((i) => i.id === id)) { furniture.remove(b.obj); wld.built.delete(id); }
      for (const it of cur) {
        let b = wld.built.get(it.id);
        if (!b) {
          const made = buildFurniture(it, kit, { night });
          const obj = new Group();
          obj.add(made.group);
          castShadows(obj);
          tagItem(obj, it.id);
          furniture.add(obj);
          b = { ...made, obj };
          wld.built.set(it.id, b);
        }
        b.obj.position.set(it.x, 0, it.z);
        b.obj.rotation.y = (it.rot * Math.PI) / 2;
        if (lampLight && it.kind === "floorLamp") lampLight.position.set(it.x, 1.5, it.z);
      }
    }

    actionsRef.current = { goUse, talk, goExit };

    let exiting = false;
    function goExit() {
      walkTo([doorX, template.d / 2 - 0.45], null);
      exiting = true;
      if (me.mode !== "walk") arrive(null);
    }
    function walkTo(goal: [number, number], use: RoomItem | null) {
      exiting = false;
      const grid = makeGrid(template, itemsRef.current);
      const path = findPath(grid, [me.x, me.z], goal);
      if (me.mode === "sit" || me.mode === "sleep" || me.mode === "dance") standUp(me);
      me.pending = use;
      if (!path.length) {
        if (use) arrive(use);
        return;
      }
      me.path = path.slice(1);
      if (!me.path.length) arrive(use);
      else me.mode = "walk";
    }
    function goUse(it: RoomItem) {
      walkTo(useSpot(it), it);
    }
    function arrive(it: RoomItem | null) {
      me.pending = null;
      if (exiting && !it) {
        exiting = false;
        me.heading = 0; // facing the door
        propsRef.current.onExit?.();
        return;
      }
      if (!it?.use) return;
      const [fx, fz] = FACING[it.rot % 4];
      const b = world.current?.built.get(it.id);
      if (it.use.kind === "sit" && me.parts) {
        me.x = it.x - fx * 0.05;
        me.z = it.z - fz * 0.05;
        me.heading = (it.rot * Math.PI) / 2;
        me.mode = "sit";
        poseSit(me.parts, b?.seatY ?? 0.48);
        propsRef.current.onUse?.(it);
        return;
      }
      if (it.use.kind === "sleep" && me.parts) {
        me.heading = (it.rot * Math.PI) / 2;
        me.x = it.x + fx * 0.85;
        me.z = it.z + fz * 0.85;
        me.mode = "sleep";
        poseLie(me.parts, b?.seatY ?? 0.5);
        propsRef.current.onUse?.(it);
        return;
      }
      me.heading = Math.atan2(it.x - me.x, it.z - me.z);
      if (it.use.kind === "events") me.mode = "dance";
      propsRef.current.onUse?.(it);
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
  useEffect(() => {
    const w = world.current;
    if (!w) return;
    const parts = buildAvatar(look, { outfit, pedestal: false });
    castShadows(parts.root);
    const old = w.me.parts;
    if (old) { w.me.rig.remove(old.root); old.dispose(); }
    w.me.rig.add(parts.root);
    w.me.parts = parts;
    w.me.mode = "idle";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lookKey, template.id, daytime, sign, mood]);

  // v0.11 party floors: (re)build the crowd when who's here changes.
  const crowdKey = JSON.stringify((props.crowd ?? []).map((m) => [m.key, m.npc ? null : m.look]));
  useEffect(() => {
    const w = world.current;
    if (!w) return;
    for (const c of crowdRef.current) { w.scene.remove(c.actor.rig); c.actor.parts?.dispose(); }
    const spots = template.crowdSpots ?? [];
    crowdRef.current = (props.crowd ?? []).slice(0, spots.length).map((member, i) => {
      const s = spots[i];
      let seed = (member.key.length * 977 + i * 7919 + 13) % 2147483647;
      const rand = () => ((seed = (seed * 48271) % 2147483647) / 2147483647);
      const look = !member.npc && member.look ? member.look : randomLook(rand, STARTING_STYLES.map((x) => x.id));
      const actor: Actor = { rig: new Group(), parts: buildAvatar(look, { pedestal: false }), x: s.x, z: s.z, heading: s.facing, mode: "dance", path: [], pending: null, phase: i * 1.3 };
      castShadows(actor.parts!.root);
      actor.rig.add(actor.parts!.root);
      w.scene.add(actor.rig);
      return { member, actor };
    });
    return () => {
      for (const c of crowdRef.current) { w.scene.remove(c.actor.rig); c.actor.parts?.dispose(); }
      crowdRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crowdKey, template.id, daytime, sign, mood]);

  // Furniture moved or room changed: rebuild placements next frame.
  useEffect(() => {
    if (world.current) world.current.dirty = true;
  }, [items]);

  const usable = editing ? [] : items.filter((i) => i.use && i.label);
  const sel = items.find((i) => i.id === selected);

  const tapChip = (it: RoomItem) => actionsRef.current?.goUse(it);

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
              className="npc-bubble"
              onClick={() => actionsRef.current?.talk(i)}
              aria-label="Talk"
            >
              <span aria-hidden="true">💬</span>
            </button>
          ))}
        </div>
      )}
      {(props.crowd?.length ?? 0) > 0 && !editing && (
        <div className="room-chips" aria-label="People at the party">
          {props.crowd!.slice(0, template.crowdSpots?.length ?? 0).map((m) => (
            <button
              key={m.key}
              ref={(el) => { if (el) crowdTagsRef.current.set(m.key, el); else crowdTagsRef.current.delete(m.key); }}
              className={`crowd-tag${m.npc ? " npc" : ""}${!m.npc && m.crew ? " crew" : ""}`}
              disabled={m.npc}
              onClick={() => props.onCrowdTap?.(m)}
              aria-label={m.npc ? `${m.name}, an NPC` : m.name}
            >
              {m.npc ? <span className="npc-mark">NPC</span> : <>{m.crew ? "👯 " : ""}{m.name.split(" ")[0]}</>}
            </button>
          ))}
        </div>
      )}
      {props.onExit && !editing && !template.outdoor && (
        <div className="room-chips" aria-label="The door">
          <button ref={exitRef} className="room-chip room-exit glass-hud" onClick={() => actionsRef.current?.goExit()}>🚪 Go out</button>
        </div>
      )}
      <div className="room-chips" aria-label="Things you can use">
        {usable.map((it) => (
          <button
            key={it.id}
            ref={(el) => { if (el) chipsRef.current.set(it.id, el); else chipsRef.current.delete(it.id); }}
            className="room-chip glass-hud"
            onClick={() => tapChip(it)}
          >
            {it.label}
          </button>
        ))}
      </div>
      {editable && editing && (
        <div className="room-edit" style={{ top: `calc(${insetTop - 48}px + var(--safe-top))` }}>
          {editing ? (
            <div className="room-edit-bar glass-hud" role="group" aria-label="Arrange furniture">
              <span className="meta" style={{ color: "var(--text-1)" }}>{note ?? (sel ? `Drag the ${FURNITURE[sel.kind].label.toLowerCase()} to move it` : "Tap a piece of furniture")}</span>
              <div className="row" style={{ gap: 6 }}>
                <button className="chip" disabled={!sel} onClick={() => sel && setItems((cur) => cur.map((i) => (i.id === sel.id ? { ...i, rot: (i.rot + 1) % 4 } : i)))}>↻ Rotate</button>
                <button className="chip" onClick={() => { setItems(savedRef.current); setEditing(false); setSelected(null); setNote(null); }}>Cancel</button>
                <button
                  className="chip"
                  aria-pressed="true"
                  disabled={saving || items.some((i) => !placementOk(template, items, i))}
                  onClick={async () => {
                    setSaving(true);
                    const ok = (await props.onSaveLayout?.(toLayout(items))) ?? true;
                    setSaving(false);
                    if (ok) { savedRef.current = items; setEditing(false); setSelected(null); setNote(null); }
                  }}
                >
                  {saving ? "…" : "Save"}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Animation and poses
// ---------------------------------------------------------------------------
function stepActor(a: Actor, dt: number, t: number, reduce: boolean, onArrive?: (it: RoomItem | null) => void) {
  const p = a.parts;
  a.rig.position.set(a.x, 0, a.z);
  if (!p) return;
  if (a.mode === "walk") {
    const target = a.path[0];
    if (!target) {
      a.mode = "idle";
      resetLimbs(p);
      onArrive?.(a.pending);
      return;
    }
    const dx = target[0] - a.x;
    const dz = target[1] - a.z;
    const dist = Math.hypot(dx, dz);
    const step = WALK_SPEED * dt;
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
    const s = Math.sin(a.phase);
    p.legs[0].rotation.x = s * 0.55;
    p.legs[1].rotation.x = -s * 0.55;
    p.knees[0].rotation.x = Math.max(0, -s) * 0.7;
    p.knees[1].rotation.x = Math.max(0, s) * 0.7;
    p.arms[0].rotation.x = -s * 0.45;
    p.arms[1].rotation.x = s * 0.45;
    p.body.position.y = Math.abs(s) * 0.03;
  } else if (a.mode === "dance" && !reduce) {
    a.phase += dt * 6;
    const s = Math.sin(a.phase);
    p.body.position.y = Math.abs(s) * 0.06;
    p.arms[0].rotation.x = -2.4 + s * 0.4;
    p.arms[1].rotation.x = -2.4 - s * 0.4;
    p.arms[0].rotation.z = -0.3;
    p.arms[1].rotation.z = 0.3;
    p.legs[0].rotation.x = Math.max(0, s) * 0.3;
    p.legs[1].rotation.x = Math.max(0, -s) * 0.3;
    p.root.rotation.y = Math.sin(t * 1.3 + a.phase * 0.1) * 0.5;
  } else if (a.mode === "idle" && !reduce) {
    p.torso.scale.y = 1 + Math.sin(t * 2.1 + a.phase) * 0.008;
  }
  a.rig.rotation.y = a.heading;
}

function turnToward(cur: number, target: number, k: number) {
  let d = target - cur;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return cur + d * Math.min(1, k);
}

function resetLimbs(p: AvatarParts) {
  for (const o of [...p.legs, ...p.knees]) o.rotation.set(0, 0, 0);
  p.arms.forEach((o, i) => o.rotation.set(0, 0, (i === 0 ? -1 : 1) * 0.13));
  p.body.position.y = 0;
  p.root.position.set(0, 0, 0);
  p.root.rotation.set(0, 0, 0);
}

function standUp(a: Actor) {
  if (a.parts) resetLimbs(a.parts);
  a.mode = "idle";
}

/** Hips on the seat, thighs forward, shins down. */
function poseSit(p: AvatarParts, seatY: number) {
  resetLimbs(p);
  p.root.position.set(0, seatY + 0.04 - 0.9, -0.12);
  for (const l of p.legs) l.rotation.x = -Math.PI / 2;
  for (const k of p.knees) k.rotation.x = Math.PI / 2;
  p.arms[0].rotation.x = -0.35;
  p.arms[1].rotation.x = -0.35;
}

/** On the back, head toward the headboard. */
function poseLie(p: AvatarParts, mattressY: number) {
  resetLimbs(p);
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
