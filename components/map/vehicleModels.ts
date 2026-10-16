// Low-poly 3D traffic for the city map (owner, Oct 16: "the cars are flat, not 3D"): cars, yellow
// cabs, SUVs, city buses and scooters with riders. Built in meters, front toward -z (north), so a
// compass bearing turns them. Headlights and taillights glow at night, with a pool of light ahead.

import {
  AdditiveBlending, BoxGeometry, CanvasTexture, CylinderGeometry, Group, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, PlaneGeometry, SphereGeometry,
} from "three";

export type VehicleKind = "car" | "suv" | "bus" | "moto";

/** Body colors by kind (the cab yellow makes a car a taxi). */
export const VEHICLE_COLORS: Record<VehicleKind, string[]> = {
  car: ["#F4F1EA", "#1F1B26", "#B9BEC6", "#C8352B", "#2F5DA8", "#F2B705", "#F2B705", "#5B6B7A"],
  suv: ["#1F1B26", "#F4F1EA", "#6B7078", "#2E4A3A", "#7A1F2B"],
  bus: ["#F4F1EA"],
  moto: ["#1F1B26", "#C8352B", "#2F5DA8"],
};
const CAB = "#F2B705";

const mats = new Map<string, MeshStandardMaterial>();
const glows: { mat: MeshStandardMaterial; day: number; night: number }[] = [];
function mat(color: string, glow?: { color: string; day: number; night: number }): MeshStandardMaterial {
  const key = glow ? `${color}|${glow.color}` : color;
  let m = mats.get(key);
  if (!m) {
    m = new MeshStandardMaterial({ color, roughness: 0.55, flatShading: true, emissive: glow?.color ?? "#000000", emissiveIntensity: glow?.day ?? 0 });
    if (glow) glows.push({ mat: m, day: glow.day, night: glow.night });
    mats.set(key, m);
  }
  return m;
}

const geos = new Map<string, BoxGeometry | CylinderGeometry | SphereGeometry | PlaneGeometry>();
function box(w: number, h: number, d: number) {
  const k = `b${w},${h},${d}`;
  if (!geos.has(k)) geos.set(k, new BoxGeometry(w, h, d));
  return geos.get(k) as BoxGeometry;
}
function wheelGeo(r: number, w: number) {
  const k = `w${r},${w}`;
  if (!geos.has(k)) {
    const g = new CylinderGeometry(r, r, w, 8);
    g.rotateZ(Math.PI / 2);
    geos.set(k, g);
  }
  return geos.get(k) as CylinderGeometry;
}

let beamMat: MeshBasicMaterial | null = null;
function beam(len: number, width: number): Mesh {
  if (!beamMat) {
    const c = document.createElement("canvas");
    c.width = 32;
    c.height = 64;
    const x = c.getContext("2d")!;
    const g = x.createLinearGradient(0, 64, 0, 0);
    g.addColorStop(0, "rgba(255,230,170,.9)");
    g.addColorStop(1, "rgba(255,230,170,0)");
    x.fillStyle = g;
    x.beginPath();
    x.moveTo(10, 64);
    x.lineTo(22, 64);
    x.lineTo(32, 0);
    x.lineTo(0, 0);
    x.fill();
    beamMat = new MeshBasicMaterial({ map: new CanvasTexture(c), transparent: true, opacity: 0.55, blending: AdditiveBlending, depthWrite: false });
  }
  const k = `p${len},${width}`;
  if (!geos.has(k)) geos.set(k, new PlaneGeometry(width, len));
  const m = new Mesh(geos.get(k) as PlaneGeometry, beamMat);
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = 2;
  m.name = "beam";
  return m;
}

const at = (m: Mesh, x: number, y: number, z: number) => { m.position.set(x, y, z); return m; };
const GLASS = "#2A3440";
const TIRE = "#16151B";
const head = () => mat("#FFF3DE", { color: "#FFE6AA", day: 0.2, night: 2.2 });
const tail = () => mat("#B3202C", { color: "#FF2D3D", day: 0.2, night: 2 });

function lights(g: Group, w: number, y: number, len: number) {
  for (const s of [-1, 1]) {
    g.add(at(new Mesh(box(0.35, 0.18, 0.08), head()), s * (w / 2 - 0.3), y, -len / 2 - 0.02));
    g.add(at(new Mesh(box(0.35, 0.16, 0.08), tail()), s * (w / 2 - 0.3), y, len / 2 + 0.02));
  }
  g.add(at(beam(len * 1.6, w * 1.6), 0, 0.06, -len / 2 - len * 0.8));
}

function wheels(g: Group, w: number, len: number, r: number) {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(at(new Mesh(wheelGeo(r, 0.28), mat(TIRE)), sx * (w / 2 - 0.05), r, sz * (len / 2 - r * 1.6)));
}

function car(color: string, suv: boolean): Group {
  const g = new Group();
  const [w, len, bodyH, cabH] = suv ? [1.95, 4.8, 0.95, 0.75] : [1.8, 4.5, 0.7, 0.6];
  const body = mat(color);
  g.add(at(new Mesh(box(w, bodyH, len), body), 0, 0.35 + bodyH / 2, 0));
  g.add(at(new Mesh(box(w - 0.15, cabH, suv ? 2.9 : 2.3), mat(GLASS)), 0, 0.35 + bodyH + cabH / 2, suv ? 0.35 : 0.25));
  g.add(at(new Mesh(box(w - 0.12, 0.1, suv ? 2.7 : 2.0), body), 0, 0.35 + bodyH + cabH + 0.05, suv ? 0.35 : 0.3));
  if (color === CAB && !suv) g.add(at(new Mesh(box(0.7, 0.25, 0.3), mat("#FFF3DE", { color: "#FFE6AA", day: 0.3, night: 1.8 })), 0, 0.35 + bodyH + cabH + 0.22, 0.3));
  wheels(g, w, len, 0.34);
  lights(g, w, 0.35 + bodyH * 0.6, len);
  return g;
}

function bus(): Group {
  const g = new Group();
  const [w, len, h] = [2.55, 12, 2.7];
  g.add(at(new Mesh(box(w, h, len), mat("#F4F1EA")), 0, 0.4 + h / 2, 0));
  g.add(at(new Mesh(box(w + 0.02, 0.95, len - 1.2), mat(GLASS, { color: "#FFD58A", day: 0, night: 0.9 })), 0, 0.4 + h * 0.66, 0.3));
  g.add(at(new Mesh(box(w + 0.03, 0.35, len + 0.02), mat("#2F8F8A")), 0, 0.4 + h * 0.3, 0));
  g.add(at(new Mesh(box(w - 0.4, 0.9, 0.06), mat(GLASS)), 0, 0.4 + h * 0.62, -len / 2 - 0.02));
  wheels(g, w, len, 0.5);
  lights(g, w, 0.9, len);
  return g;
}

function moto(color: string): Group {
  const g = new Group();
  g.add(at(new Mesh(box(0.45, 0.45, 1.9), mat(color)), 0, 0.6, 0));
  g.add(at(new Mesh(wheelGeo(0.33, 0.14), mat(TIRE)), 0, 0.33, -0.7));
  g.add(at(new Mesh(wheelGeo(0.33, 0.14), mat(TIRE)), 0, 0.33, 0.7));
  g.add(at(new Mesh(box(0.5, 0.7, 0.4), mat("#3B3A44")), 0, 1.15, 0.15));
  if (!geos.has("helmet")) geos.set("helmet", new SphereGeometry(0.2, 8, 6));
  g.add(at(new Mesh(geos.get("helmet") as SphereGeometry, mat(color)), 0, 1.65, 0.1));
  g.add(at(new Mesh(box(0.2, 0.14, 0.08), head()), 0, 0.85, -0.97));
  g.add(at(beam(3, 1.6), 0, 0.06, -2.5));
  return g;
}

export function buildVehicle(kind: VehicleKind, color: string): Group {
  const g = kind === "bus" ? bus() : kind === "moto" ? moto(color) : car(color, kind === "suv");
  g.traverse((o) => { (o as Mesh).frustumCulled = false; });
  return g;
}

/** Lights up the shared materials; each vehicle shows its headlight beam only at night. */
export function setVehiclesNight(night: boolean) {
  for (const g of glows) g.mat.emissiveIntensity = night ? g.night : g.day;
}
