// Top-down vehicle sprites for the map, drawn on a canvas so they stay crisp at
// any zoom and need no image files. Each sprite points up (north); the map rotates
// it to the road's bearing. Names: veh-<kind>-<color index>-<d|n> (day or night,
// where night adds headlight beams and glowing taillights).

export type VehicleKind = "car" | "suv" | "bus" | "moto";

export const VEHICLE_COLORS: Record<VehicleKind, string[]> = {
  car: ["#F4F1EA", "#1F1B26", "#B9BEC6", "#C8352B", "#2F5DA8", "#F2B705", "#5B6B7A"],
  suv: ["#1F1B26", "#F4F1EA", "#6B7078", "#2E4A3A", "#7A1F2B"],
  bus: ["#F4F1EA"],
  moto: ["#1F1B26", "#C8352B", "#2F5DA8"],
};

/** Body size in CSS pixels at icon-size 1 (width, length). */
const SIZE: Record<VehicleKind, [number, number]> = { car: [11, 22], suv: [12, 25], bus: [14, 52], moto: [5, 13] };
const BEAM = 20; // headlight reach in CSS px at night
export const PIXEL_RATIO = 3;

export function vehicleIconName(kind: VehicleKind, color: number, night: boolean): string {
  return `veh-${kind}-${color}-${night ? "n" : "d"}`;
}

function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f));
  return `rgb(${ch.join(",")})`;
}

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

/** Draws one sprite; returns ImageData for map.addImage, or null for an unknown name. */
export function drawVehicleIcon(name: string): ImageData | null {
  const m = /^veh-(car|suv|bus|moto)-(\d+)-(d|n)$/.exec(name);
  if (!m) return null;
  const kind = m[1] as VehicleKind;
  const color = VEHICLE_COLORS[kind][Number(m[2]) % VEHICLE_COLORS[kind].length];
  const night = m[3] === "n";
  const [w, l] = SIZE[kind];
  // Square canvas, so the body sits at the center whichever way the map rotates it;
  // the beam extends forward into the top half.
  const side = Math.max(l, w) + 2 * (night ? BEAM : 2);
  const px = Math.ceil(side * PIXEL_RATIO);
  const canvas = document.createElement("canvas");
  canvas.width = px;
  canvas.height = px;
  const c = canvas.getContext("2d");
  if (!c) return null;
  c.scale(PIXEL_RATIO, PIXEL_RATIO);
  const x = (side - w) / 2;
  const y = (side - l) / 2;

  if (night) {
    // Headlight beams: two soft cones ahead of the vehicle.
    const lamps = kind === "moto" ? [w / 2] : [w * 0.25, w * 0.75];
    for (const lx of lamps) {
      const g = c.createRadialGradient(x + lx, y, 0, x + lx, y, BEAM);
      g.addColorStop(0, "rgba(255,240,190,0.75)");
      g.addColorStop(1, "rgba(255,240,190,0)");
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(x + lx, y + 1);
      c.lineTo(x + lx - BEAM * 0.38, y - BEAM);
      c.lineTo(x + lx + BEAM * 0.38, y - BEAM);
      c.closePath();
      c.fill();
    }
  }

  // Soft shadow
  c.fillStyle = "rgba(0,0,0,0.28)";
  roundRect(c, x + 0.8, y + 1.2, w, l, kind === "moto" ? w / 2 : 2.5);
  c.fill();

  const glass = night ? "#0B0A10" : "#25303D";
  const lamp = night ? "#FFF6D0" : "#F7F3E3";
  const tail = night ? "#FF3B30" : "#B3261E";

  if (kind === "moto") {
    c.fillStyle = color;
    roundRect(c, x, y + 1, w, l - 2, w / 2);
    c.fill();
    c.fillStyle = "#14111A";
    c.fillRect(x - 1.5, y + 3, w + 3, 1); // handlebars
    c.fillStyle = "#3A3540";
    c.beginPath();
    c.arc(x + w / 2, y + l * 0.55, 2.2, 0, Math.PI * 2); // rider's helmet
    c.fill();
    c.fillStyle = lamp;
    c.fillRect(x + w / 2 - 0.8, y, 1.6, 1.2);
    c.fillStyle = tail;
    c.fillRect(x + w / 2 - 0.8, y + l - 1.2, 1.6, 1.2);
  } else if (kind === "bus") {
    c.fillStyle = color;
    roundRect(c, x, y, w, l, 2);
    c.fill();
    c.strokeStyle = "rgba(0,0,0,0.35)";
    c.lineWidth = 0.6;
    c.stroke();
    c.fillStyle = "#2F5DA8"; // side stripes
    c.fillRect(x, y + 4, 1.1, l - 8);
    c.fillRect(x + w - 1.1, y + 4, 1.1, l - 8);
    c.fillStyle = glass;
    c.fillRect(x + 1.2, y + 1, w - 2.4, 3); // windshield
    c.fillStyle = shade(color, -0.12);
    for (let i = 0; i < 3; i++) roundRect(c, x + 3, y + 10 + i * 13, w - 6, 6, 1), c.fill(); // roof units
    c.fillStyle = lamp;
    c.fillRect(x + 1, y, 2, 0.9);
    c.fillRect(x + w - 3, y, 2, 0.9);
    c.fillStyle = tail;
    c.fillRect(x + 1, y + l - 0.9, 2, 0.9);
    c.fillRect(x + w - 3, y + l - 0.9, 2, 0.9);
  } else {
    const suv = kind === "suv";
    c.fillStyle = color;
    roundRect(c, x, y, w, l, suv ? 2 : 3);
    c.fill();
    c.strokeStyle = "rgba(0,0,0,0.35)";
    c.lineWidth = 0.6;
    c.stroke();
    // Mirrors
    c.fillStyle = shade(color, -0.25);
    c.fillRect(x - 1, y + l * 0.3, 1.2, 1.6);
    c.fillRect(x + w - 0.2, y + l * 0.3, 1.2, 1.6);
    // Windshield and rear window
    c.fillStyle = glass;
    c.beginPath();
    c.moveTo(x + 1.4, y + l * 0.36);
    c.lineTo(x + 2.4, y + l * 0.22);
    c.lineTo(x + w - 2.4, y + l * 0.22);
    c.lineTo(x + w - 1.4, y + l * 0.36);
    c.closePath();
    c.fill();
    const rearTop = suv ? 0.8 : 0.74;
    c.fillRect(x + 1.8, y + l * rearTop, w - 3.6, l * 0.1);
    // Roof (lighter), with rails on SUVs
    c.fillStyle = shade(color, color === "#F4F1EA" ? -0.06 : 0.12);
    c.fillRect(x + 1.6, y + l * 0.37, w - 3.2, l * (rearTop - 0.39));
    if (suv) {
      c.fillStyle = "rgba(0,0,0,0.45)";
      c.fillRect(x + 1.6, y + l * 0.39, 0.6, l * 0.36);
      c.fillRect(x + w - 2.2, y + l * 0.39, 0.6, l * 0.36);
    }
    // Lights
    c.fillStyle = lamp;
    c.fillRect(x + 1, y + 0.2, 2.2, 1);
    c.fillRect(x + w - 3.2, y + 0.2, 2.2, 1);
    c.fillStyle = tail;
    c.fillRect(x + 1, y + l - 1.1, 2.2, 1);
    c.fillRect(x + w - 3.2, y + l - 1.1, 2.2, 1);
  }

  if (night) {
    // Taillight glow
    const g = c.createRadialGradient(x + w / 2, y + l, 0, x + w / 2, y + l, w);
    g.addColorStop(0, "rgba(255,59,48,0.45)");
    g.addColorStop(1, "rgba(255,59,48,0)");
    c.fillStyle = g;
    c.fillRect(x - w / 2, y + l - 2, w * 2, w);
  }
  return c.getImageData(0, 0, px, px);
}
