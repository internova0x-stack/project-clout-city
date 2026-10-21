// Location illustrations (C37) in a Monument Valley-inspired style, approved by the
// product owner on Oct 12, 2026. Each place is a small isometric island floating on a soft gradient sky:
// flat faces where the top catches the light, one side glows warm and the other
// sits in lavender shade, with gentle gradients on every face. Colors come from
// each place's own palette so locations keep their natural look.

import type { Place } from "@/lib/city";

type P = [number, number];
const S = 8.5; // world unit in px
const O: P = [160, 117]; // screen origin of world (0, 0, 0)

/** Isometric projection: x runs to the lower right, y to the lower left, z up. */
const iso = (x: number, y: number, z: number): P => [O[0] + (x - y) * 0.866 * S, O[1] + (x + y) * 0.5 * S - z * S];
const pts = (ps: P[]) => ps.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");

function mixHex(a: string, b: string, k: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = [16, 8, 0].map((sh) => Math.round(((pa >> sh) & 255) * (1 - k) + ((pb >> sh) & 255) * k));
  return `#${ch.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

interface Tone { top: string; warm: string; cool: string }
/** Monument Valley face tones: light top, warm lit side, lavender shaded side. */
function tone(base: string, night: boolean): Tone {
  return night
    ? { top: mixHex(base, "#E9D8FF", 0.25), warm: mixHex(base, "#FF9FA8", 0.18), cool: mixHex(base, "#3B2F72", 0.45) }
    : { top: mixHex(base, "#FFF6EE", 0.4), warm: mixHex(base, "#FFC3A8", 0.12), cool: mixHex(base, "#6E6A9A", 0.28) };
}

interface BoxSpec { x: number; y: number; z: number; w: number; d: number; h: number; color: string }

/** One box: top, right (+x, warm) and left (+y, cool) faces, each with a soft gradient. */
function Box({ b, night, children }: { b: BoxSpec; night: boolean; children?: React.ReactNode }) {
  const t = tone(b.color, night);
  const { x, y, z, w, d, h } = b;
  const top = [iso(x, y, z + h), iso(x + w, y, z + h), iso(x + w, y + d, z + h), iso(x, y + d, z + h)];
  const right = [iso(x + w, y, z), iso(x + w, y + d, z), iso(x + w, y + d, z + h), iso(x + w, y, z + h)];
  const left = [iso(x, y + d, z), iso(x + w, y + d, z), iso(x + w, y + d, z + h), iso(x, y + d, z + h)];
  return (
    <g>
      <polygon points={pts(right)} fill={t.warm} />
      <polygon points={pts(right)} fill={`url(#mv-shade-${night ? "n" : "d"})`} />
      <polygon points={pts(left)} fill={t.cool} />
      <polygon points={pts(left)} fill={`url(#mv-shade-${night ? "n" : "d"})`} />
      <polygon points={pts(top)} fill={t.top} />
      {children}
    </g>
  );
}

/** A rectangle drawn on a box's right (+x) face: u along y, v along z. */
function OnRight({ b, u, v, uw, vh, fill, opacity = 1 }: { b: BoxSpec; u: number; v: number; uw: number; vh: number; fill: string; opacity?: number }) {
  const x = b.x + b.w + 0.01;
  const p = [iso(x, b.y + u, b.z + v), iso(x, b.y + u + uw, b.z + v), iso(x, b.y + u + uw, b.z + v + vh), iso(x, b.y + u, b.z + v + vh)];
  return <polygon points={pts(p)} fill={fill} opacity={opacity} />;
}
/** A rectangle on a box's left (+y) face: u along x, v along z. */
function OnLeft({ b, u, v, uw, vh, fill, opacity = 1 }: { b: BoxSpec; u: number; v: number; uw: number; vh: number; fill: string; opacity?: number }) {
  const y = b.y + b.d + 0.01;
  const p = [iso(b.x + u, y, b.z + v), iso(b.x + u + uw, y, b.z + v), iso(b.x + u + uw, y, b.z + v + vh), iso(b.x + u, y, b.z + v + vh)];
  return <polygon points={pts(p)} fill={fill} opacity={opacity} />;
}

function windowsRight(b: BoxSpec, rows: number, cols: number, lit: string, dark: string, night: boolean) {
  const out: React.ReactNode[] = [];
  const uw = (b.d - 0.6) / cols;
  const vh = (b.h - 1.6) / rows;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const on = night ? (r * 3 + c * 5) % 4 !== 0 : false;
    out.push(<OnRight key={`r${r}-${c}`} b={b} u={0.4 + c * uw} v={1.2 + r * vh} uw={uw * 0.55} vh={vh * 0.55} fill={on ? lit : dark} />);
  }
  return out;
}
function windowsLeft(b: BoxSpec, rows: number, cols: number, lit: string, dark: string, night: boolean) {
  const out: React.ReactNode[] = [];
  const uw = (b.w - 0.6) / cols;
  const vh = (b.h - 1.6) / rows;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const on = night ? (r * 5 + c * 3) % 3 !== 0 : false;
    out.push(<OnLeft key={`l${r}-${c}`} b={b} u={0.4 + c * uw} v={1.2 + r * vh} uw={uw * 0.55} vh={vh * 0.55} fill={on ? lit : dark} />);
  }
  return out;
}

/** Small glowing lantern post, as in the reference. */
function Lantern({ x, y, z = 0, night }: { x: number; y: number; z?: number; night: boolean }) {
  const [px, py] = iso(x, y, z);
  return (
    <g>
      <rect x={px - 0.8} y={py - 14} width={1.6} height={14} fill={night ? "#3B2F72" : "#8E7CC8"} />
      <rect x={px - 3} y={py - 19} width={6} height={6} rx={1} fill="#FFD9A0" />
      {night && <circle cx={px} cy={py - 16} r={9} fill="url(#mv-glow)" />}
    </g>
  );
}

function Tree({ x, y, z = 0, night, size = 1 }: { x: number; y: number; z?: number; night: boolean; size?: number }) {
  const [px, py] = iso(x, y, z);
  const leaf = night ? "#2F6B5F" : "#5CC28F";
  return (
    <g>
      <rect x={px - 1} y={py - 8 * size} width={2} height={8 * size} fill={night ? "#3B2F2F" : "#8A5A3C"} />
      <polygon points={`${px},${py - 26 * size} ${px + 8 * size},${py - 8 * size} ${px},${py - 5 * size}`} fill={mixHex(leaf, "#FFF6EE", night ? 0 : 0.15)} />
      <polygon points={`${px},${py - 26 * size} ${px - 8 * size},${py - 8 * size} ${px},${py - 5 * size}`} fill={mixHex(leaf, night ? "#3B2F72" : "#8E7CC8", 0.35)} />
    </g>
  );
}

/** A sign plate on a box's left face, with the place name. */
function SignLeft({ b, text, color, ink, v, night }: { b: BoxSpec; text: string; color: string; ink: string; v: number; night: boolean }) {
  const y = b.y + b.d + 0.02;
  const a = iso(b.x + 0.5, y, b.z + v);
  const c = iso(b.x + b.w - 0.5, y, b.z + v + 1.6);
  const plate = [iso(b.x + 0.5, y, b.z + v), iso(b.x + b.w - 0.5, y, b.z + v), c, iso(b.x + 0.5, y, b.z + v + 1.6)];
  const cx = (a[0] + c[0]) / 2;
  const cy = (a[1] + c[1]) / 2;
  return (
    <g>
      <polygon points={pts(plate)} fill={color} />
      {night && <polygon points={pts(plate)} fill={color} opacity={0.5} filter="url(#mv-blur)" />}
      {/* Lies on the face: x runs along the face's 30° edge, y stays upright. */}
      <text x={0} y={2.2} fontSize={5.6} fontWeight={800} fill={ink} textAnchor="middle" fontFamily="system-ui, -apple-system, sans-serif"
        transform={`translate(${cx} ${cy}) matrix(0.866 0.5 0 1 0 0)`} letterSpacing={0.3}>
        {text.toUpperCase()}
      </text>
    </g>
  );
}

// Color themes (owner, Oct 13): deep blue gradients, red, yellow, green, purple, brown, grey,
// off-white and cream, spread across the places so neighbors never look alike. A theme sets
// the sky, the island and the main building color; the place's palette keeps its accents.
type ThemeName = "deepBlue" | "red" | "yellow" | "green" | "purple" | "brown" | "grey" | "offWhite" | "cream";
const THEMES: Record<ThemeName, { main: string; sky: [string, string, string]; isle: string }> = {
  deepBlue: { main: "#2E4FB8", sky: ["#D6E4FF", "#7FA2EE", "#2F4FA8"], isle: "#C9D8F5" },
  red: { main: "#D93A2F", sky: ["#FFE6DE", "#FFA898", "#D9584A"], isle: "#F6D2CA" },
  yellow: { main: "#F2B620", sky: ["#FFF8DC", "#FFE38F", "#F4BE3A"], isle: "#F8E7B4" },
  green: { main: "#2E9E6A", sky: ["#E2F6E6", "#A6DEB8", "#4FA87A"], isle: "#CDEBD3" },
  purple: { main: "#6B2BD9", sky: ["#EEE2FF", "#BFA2F2", "#7A4FD0"], isle: "#DCCFF2" },
  brown: { main: "#8A5A3C", sky: ["#F6E8DA", "#D9B394", "#8E6248"], isle: "#E8D3BF" },
  grey: { main: "#6B6F7A", sky: ["#F0F1F4", "#C4C8D2", "#7C8291"], isle: "#DADDE3" },
  offWhite: { main: "#F4F1EA", sky: ["#FFFFFF", "#E9EDF3", "#B9C3D3"], isle: "#EFEDE8" },
  cream: { main: "#F2E3C4", sky: ["#FFF9EC", "#F4E2BC", "#D8B98A"], isle: "#F3E6CB" },
};
const PLACE_THEME: Record<string, ThemeName> = {
  "velvet-static": "purple", "grind-and-gossip": "brown", "lucky-seven-deli": "red", "altitude-718": "deepBlue",
  "flushing-meadows": "green", "pedal-pushers": "yellow", "skybridge-tower": "grey", "skyline-pier": "deepBlue",
  "hunters-pier": "offWhite", "rockaway-diner": "red", "radiant-harbor": "cream", "pressed-iron-gym": "grey",
  unisphere: "deepBlue", "gantry-plaza": "brown", "low-light-lounge": "purple", "thread-count": "offWhite", "fifs-furniture": "yellow",
  "boulevard-motors": "red", "st-johnsons": "red", "queensborough-u": "deepBlue",
  "ditmars-deli": "green", "two-bros-pizza": "red", "neon-spoon": "deepBlue", "up-on-thirty": "purple",
  "steinway-fresh": "cream", "hellgate-hall": "red", "triborough-works": "grey", "ditmars-library": "brown",
  "precinct-114-half": "deepBlue", "engine-7": "red", "astoria-cc": "green", "harmony-chapel": "offWhite",
  "hell-gate-park": "green", "rep-count": "yellow", "astoria-blvd-station": "yellow", "reel-queens": "purple",
  "respawn-arena": "deepBlue", "the-sticky-floor": "green", "discount-disco": "yellow", "ultraviolet-society": "purple",
  "real-clout-fm": "red", "clout-tower": "deepBlue", "st-copays": "offWhite", "brownstone-sessions": "brown",
  "still-a-dollar-slice": "red", "white-sauce-cart": "yellow", "boiled-and-beloved": "deepBlue", "feta-compli": "deepBlue",
  "schlep-and-schmear": "brown",
};
function themeOf(place: Place) {
  return THEMES[PLACE_THEME[place.id] ?? "cream"];
}
/** The place with its theme's main color leading the palette, for the illustration only. */
function themed(place: Place): Place {
  const t = themeOf(place);
  return { ...place, palette: [t.main, place.palette[1], place.palette[2]] };
}

function sky(place: Place, night: boolean): [string, string, string] {
  const [a, b, c] = themeOf(place).sky;
  // Night keeps the theme's hue, deep and dusky.
  return night ? [mixHex(a, "#0E0B24", 0.86), mixHex(b, "#1B1640", 0.62), mixHex(c, "#2E2A5C", 0.42)] : [a, b, c];
}

/** Each place as a floating island scene. */
function Scene({ place, night }: { place: Place; night: boolean }) {
  const [a, b, c] = place.palette;
  const isleTone = themeOf(place).isle;
  const isle: BoxSpec = { x: -6, y: -6, z: -1, w: 12, d: 12, h: 1, color: night ? mixHex(isleTone, "#3B2F72", 0.45) : isleTone };
  const lit = "#FFE2A8";
  const glassDark = night ? "#2A2350" : "#9FB6D8";
  const base = <Box b={isle} night={night} />;
  switch (place.id) {
    // v0.14 On Air: Real Clout FM, a low studio with the ON AIR light and a lattice mast on the roof.
    case "real-clout-fm": {
      const studio: BoxSpec = { x: -5, y: -4, z: 0, w: 8, d: 7, h: 4, color: a };
      const mastBase = iso(1.5, -1.5, 4);
      const mastTop = iso(1.5, -1.5, 12);
      const onAir = night ? "#FF2E88" : "#FF4F9A";
      return (
        <>
          {base}
          <Box b={studio} night={night}>
            {windowsRight(studio, 1, 3, lit, glassDark, night)}
            <OnLeft b={studio} u={5.4} v={0} uw={1.8} vh={2.4} fill={night ? "#FFD58A" : "#3A2F45"} />
            <SignLeft b={studio} text={place.name} color="#14111A" ink={b} v={2.1} night={night} />
            <OnLeft b={studio} u={0.8} v={0.8} uw={2.4} vh={0.9} fill={onAir} />
          </Box>
          {night && <circle cx={iso(1.8, 3, 1.25)[0]} cy={iso(1.8, 3, 1.25)[1]} r={10} fill="url(#mv-glow)" />}
          {/* The mast: two rails, cross braces, and a light on top that blinks at night. */}
          {[-1, 1].map((k) => <line key={k} x1={mastBase[0] + k * 6} y1={mastBase[1]} x2={mastTop[0] + k * 0.8} y2={mastTop[1]} stroke={night ? "#E9D8FF" : "#5A5470"} strokeWidth={1.2} />)}
          {Array.from({ length: 7 }, (_, i) => {
            const t0 = i / 7, t1 = (i + 1) / 7;
            const y0 = mastBase[1] + (mastTop[1] - mastBase[1]) * t0, y1 = mastBase[1] + (mastTop[1] - mastBase[1]) * t1;
            const w0 = 6 - 5.2 * t0, w1 = 6 - 5.2 * t1;
            return <line key={i} x1={mastBase[0] - w0} y1={y0} x2={mastBase[0] + w1} y2={y1} stroke={night ? "#E9D8FF" : "#5A5470"} strokeWidth={0.7} opacity={0.8} />;
          })}
          <circle cx={mastTop[0]} cy={mastTop[1] - 2} r={2.4} fill="#FF2E88">
            {night && <animate attributeName="opacity" values="1;0.25;1" dur="1.6s" repeatCount="indefinite" />}
          </circle>
          {[6, 11].map((r) => <circle key={r} cx={mastTop[0]} cy={mastTop[1] - 2} r={r} fill="none" stroke="#FF2E88" strokeWidth={0.8} opacity={night ? 0.55 : 0.35} />)}
          <Lantern x={4} y={4} night={night} />
          <Tree x={-5.2} y={4.2} night={night} />
        </>
      );
    }
    // v0.14 On Air: the Clout Tower, a slim tower with the Big Screen on its face (Clout TV's ident).
    case "clout-tower": {
      const tower: BoxSpec = { x: -3, y: -3, z: 0, w: 5, d: 5, h: 12, color: a };
      const podium: BoxSpec = { x: -5, y: -1, z: 0, w: 9, d: 5, h: 2.4, color: mixHex(a, "#14111A", 0.25) };
      const sc = [iso(-2.7, 2.03, 4.6), iso(1.7, 2.03, 4.6), iso(1.7, 2.03, 10.6), iso(-2.7, 2.03, 10.6)];
      const mid = iso(-0.5, 2.03, 7.3);
      return (
        <>
          {base}
          <Box b={tower} night={night}>{windowsRight(tower, 4, 2, lit, glassDark, night)}</Box>
          <defs>
            <linearGradient id={`tv-screen-${night ? "n" : "d"}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#FF6A3D" />
              <stop offset="1" stopColor="#FF2E88" />
            </linearGradient>
          </defs>
          <polygon points={pts(sc)} fill="#14111A" />
          <polygon points={pts(sc.map(([x, y], i) => [x + (i === 0 || i === 3 ? 1.5 : -1.5), y + (i < 2 ? -1.2 : 1.2)] as P))} fill={`url(#tv-screen-${night ? "n" : "d"})`} />
          {night && <polygon points={pts(sc)} fill="#FF2E88" opacity={0.35} filter="url(#mv-blur)" />}
          <text x={0} y={0} fontSize={6.2} fontWeight={900} fill="#FFFFFF" textAnchor="middle" fontFamily="system-ui, -apple-system, sans-serif"
            transform={`translate(${mid[0]} ${mid[1]}) matrix(0.866 0.5 0 1 0 0)`}>CLOUT TV</text>
          <Box b={podium} night={night}>
            <SignLeft b={podium} text={place.name} color="#14111A" ink={b} v={0.5} night={night} />
          </Box>
          <circle cx={iso(-0.5, -0.5, 12)[0]} cy={iso(-0.5, -0.5, 12)[1] - 6} r={1.8} fill="#FF2E88" />
          <line x1={iso(-0.5, -0.5, 12)[0]} y1={iso(-0.5, -0.5, 12)[1]} x2={iso(-0.5, -0.5, 12)[0]} y2={iso(-0.5, -0.5, 12)[1] - 6} stroke={night ? "#E9D8FF" : "#5A5470"} strokeWidth={1} />
          <Lantern x={4.5} y={4.5} night={night} />
          <Lantern x={-5} y={4.5} night={night} />
        </>
      );
    }
    // #19 the two cheap clubs share the warehouse look, with their own names and colors.
    case "the-sticky-floor":
    case "discount-disco":
    case "velvet-static": {
      const hall: BoxSpec = { x: -5, y: -5, z: 0, w: 9, d: 7, h: 5, color: mixHex(c, "#6B2BD9", 0.35) };
      return (
        <>
          {base}
          <Box b={hall} night={night}>
            <OnLeft b={hall} u={3.5} v={0} uw={2.2} vh={2.6} fill={night ? "#FF6FB0" : "#3A2550"} />
            <OnRight b={hall} u={0.8} v={3.6} uw={5.4} vh={0.35} fill={a} />
            <SignLeft b={hall} text={place.name} color="#14111A" ink={a} v={3.2} night={night} />
          </Box>
          <Lantern x={3} y={4} night={night} />
          <Lantern x={-4} y={4.5} night={night} />
          {[0, 1, 2].map((i) => {
            const [px, py] = iso(-2.5 + i * 1.2, 3.6, 0);
            return <circle key={i} cx={px} cy={py - 4} r={2.2} fill={night ? "#FF9FCB" : "#3A3050"} />;
          })}
        </>
      );
    }
    // #19 the exclusive club: a glass box on the waterfront, no sign but its name in light.
    case "ultraviolet-society": {
      const box: BoxSpec = { x: -5, y: -4.5, z: 0, w: 9, d: 7, h: 5.4, color: mixHex(c, "#E8E0FF", 0.5) };
      const roof: BoxSpec = { x: -5.4, y: -4.9, z: 5.4, w: 9.8, d: 7.8, h: 0.4, color: "#2A2350" };
      return (
        <>
          {base}
          <Box b={box} night={night}>
            {[0, 1, 2, 3].map((i) => <OnLeft key={i} b={box} u={0.4 + i * 2.2} v={0.4} uw={1.9} vh={4.4} fill={night ? "#B48CFF" : glassDark} />)}
            {[0, 1, 2].map((i) => <OnRight key={i} b={box} u={0.4 + i * 2.2} v={0.4} uw={1.9} vh={4.4} fill={night ? "#8E63E6" : glassDark} />)}
            <SignLeft b={box} text={place.name} color="#0E0B1F" ink={a} v={4.6} night={night} />
          </Box>
          <Box b={roof} night={night} />
          {night && [[-2, 0], [2, 1]].map(([x, y]) => { const [px, py] = iso(x, y, 5.4); return <circle key={x} cx={px} cy={py - 10} r={12} fill={a} opacity={0.3} filter="url(#mv-blur)" />; })}
        </>
      );
    }
    case "grind-and-gossip": {
      const shop: BoxSpec = { x: -5, y: -5, z: 0, w: 8, d: 7, h: 5.8, color: mixHex(b, "#E9C7A0", 0.3) };
      return (
        <>
          {base}
          <Box b={shop} night={night}>
            {windowsRight(shop, 2, 3, lit, glassDark, night)}
            <OnLeft b={shop} u={0.6} v={0} uw={4.2} vh={2.6} fill={night ? lit : glassDark} opacity={0.9} />
            <OnLeft b={shop} u={5.3} v={0} uw={1.6} vh={2.6} fill={a} />
            {[0, 1, 2, 3, 4, 5].map((i) => <OnLeft key={i} b={shop} u={0.3 + i * 1.25} v={2.7} uw={0.62} vh={0.9} fill={i % 2 ? "#FFF6EE" : a} />)}
            <SignLeft b={shop} text="Grind & Gossip" color={c} ink="#FFF6EE" v={4.2} night={night} />
          </Box>
          {[[1.5, 4], [-2.5, 4.4]].map(([x, y]) => {
            const [px, py] = iso(x, y, 0);
            return (
              <g key={x}>
                <ellipse cx={px} cy={py - 6} rx={6} ry={2.6} fill={night ? "#E9D8FF" : "#FFFFFF"} />
                <rect x={px - 0.6} y={py - 6} width={1.2} height={6} fill="#3A2A20" />
                <circle cx={px + 2} cy={py - 8} r={1.2} fill={a} />
              </g>
            );
          })}
          <Tree x={5} y={-3} night={night} />
          <Lantern x={4.5} y={4.5} night={night} />
        </>
      );
    }
    case "st-copays": {
      // St. Copay's General Hospital (owner, Oct 17): a white wing, a glass tower, a red cross on top.
      const wing: BoxSpec = { x: -6, y: -3, z: 0, w: 11, d: 6, h: 3.6, color: "#F4F7FA" };
      const tower: BoxSpec = { x: -6, y: -3, z: 3.6, w: 5, d: 6, h: 6.4, color: "#E3EEF6" };
      const [cx, cy] = iso(-3.5, 0, 10.6);
      return (
        <>
          {base}
          <Box b={wing} night={night}>
            {windowsLeft(wing, 1, 5, lit, "#8FC7E8", night)}
            <OnRight b={wing} u={0.6} v={0} uw={2.6} vh={2.2} fill={night ? lit : "#BFE3F5"} opacity={0.9} />
            <SignLeft b={wing} text="EMERGENCY" color="#E5484D" ink="#FFFFFF" v={2.7} night={night} />
          </Box>
          <Box b={tower} night={night}>
            {windowsLeft(tower, 4, 2, lit, "#5FB3D9", night)}
            {windowsRight(tower, 4, 3, lit, "#5FB3D9", night)}
          </Box>
          <rect x={cx - 7} y={cy - 2.5} width={14} height={5} rx={1} fill="#E5484D" />
          <rect x={cx - 2.5} y={cy - 7} width={5} height={14} rx={1} fill="#E5484D" />
          {night && <circle cx={cx} cy={cy} r={12} fill="#FF5A5F" opacity={0.25} filter="url(#mv-blur)" />}
          <Tree x={5.5} y={3} night={night} />
          <Lantern x={4.5} y={-2.5} night={night} />
        </>
      );
    }
    case "brownstone-sessions": {
      // Brownstone Sessions (owner, Oct 17): a Fort Greene brownstone, a stoop and a glowing basement club.
      const house: BoxSpec = { x: -3.5, y: -4, z: 0, w: 6, d: 8, h: 9, color: "#9A5A3C" };
      const [hx, hy] = iso(-3.5, 1.2, 5.6);
      return (
        <>
          {base}
          <Box b={house} night={night}>
            {windowsLeft(house, 3, 2, lit, glassDark, night)}
            {windowsRight(house, 3, 3, lit, glassDark, night)}
            <OnLeft b={house} u={0.6} v={0.2} uw={4.6} vh={1.3} fill={night ? "#FFB347" : "#FFD9A0"} opacity={0.95} />
            <SignLeft b={house} text="SESSIONS" color="#14111A" ink="#FFB347" v={1.8} night={night} />
          </Box>
          {/* A neon music note over the door. */}
          <text x={hx + 6} y={hy - 2} fontSize={13} fontWeight={900} fill="#FF6A3D" textAnchor="middle" fontFamily="system-ui, -apple-system, sans-serif">♪</text>
          {night && <circle cx={hx + 6} cy={hy - 6} r={10} fill="#FF6A3D" opacity={0.25} filter="url(#mv-blur)" />}
          <Tree x={5} y={-3} night={night} />
          <Lantern x={4.5} y={4} night={night} />
        </>
      );
    }
    case "lucky-seven-deli": {
      // Sip & Spill (owner, Oct 16): the old deli as a glass-front mixer, teal upstairs, a giant teacup on the roof.
      const front: BoxSpec = { x: -5, y: -4, z: 0, w: 8, d: 6, h: 4.2, color: "#FF8A7A" };
      const upper: BoxSpec = { x: -5, y: -4, z: 4.2, w: 8, d: 6, h: 3.4, color: "#3FBFB2" };
      const [cx, cy] = iso(-1, -1, 7.6);
      const cupW = 3.6 * S, cupH = 2.6 * S;
      return (
        <>
          {base}
          <Box b={front} night={night}>
            <OnLeft b={front} u={0.4} v={0.2} uw={7.2} vh={2.8} fill={night ? lit : "#FFE6C8"} opacity={0.92} />
            <OnLeft b={front} u={0} v={3.1} uw={8} vh={0.9} fill="#FFF3DE" />
            <OnRight b={front} u={0.4} v={0.2} uw={5.2} vh={2.8} fill={night ? lit : "#FFE6C8"} opacity={0.85} />
            <SignLeft b={front} text="SIP & SPILL" color="#14111A" ink="#5FD4C9" v={3.2} night={night} />
          </Box>
          <Box b={upper} night={night}>
            {windowsLeft(upper, 1, 3, lit, glassDark, night)}
            {windowsRight(upper, 1, 2, lit, glassDark, night)}
          </Box>
          {/* The teacup: saucer, cup, coral rim, handle, steam. */}
          <ellipse cx={cx} cy={cy} rx={cupW * 0.75} ry={cupW * 0.26} fill="#FFF8EE" stroke="#E7D9C4" strokeWidth={0.8} />
          <path d={`M ${cx - cupW / 2} ${cy - cupH} L ${cx + cupW / 2} ${cy - cupH} L ${cx + cupW * 0.34} ${cy - 2} Q ${cx} ${cy + 2} ${cx - cupW * 0.34} ${cy - 2} Z`} fill="#FFF8EE" />
          <ellipse cx={cx} cy={cy - cupH} rx={cupW / 2} ry={cupW * 0.16} fill="#C9803F" stroke="#FF6A5C" strokeWidth={1.6} />
          <ellipse cx={cx + cupW * 0.52} cy={cy - cupH * 0.55} rx={cupW * 0.14} ry={cupH * 0.24} fill="none" stroke="#FFF8EE" strokeWidth={2.2} />
          {[0, 1, 2].map((i) => (
            <circle key={i} cx={cx + (i % 2 ? 2 : -2)} cy={cy - cupH - 5 - i * 5} r={2.6 - i * 0.5} fill={night ? "#BFF3EC" : "#FFFFFF"} opacity={0.85} />
          ))}
          {/* The cat stayed on, as head of security. */}
          {(() => {
            const [px, py] = iso(1.5, 3.2, 0);
            return (
              <g>
                <ellipse cx={px} cy={py - 3} rx={4} ry={2.4} fill="#E8A44A" />
                <circle cx={px + 3.5} cy={py - 6} r={2.4} fill="#E8A44A" />
                <polygon points={`${px + 2},${py - 8} ${px + 2.8},${py - 10.5} ${px + 3.8},${py - 8}`} fill="#E8A44A" />
              </g>
            );
          })()}
          <Lantern x={4.5} y={3.5} night={night} />
        </>
      );
    }
    case "altitude-718": {
      const tower: BoxSpec = { x: -3.5, y: -4, z: 0, w: 6, d: 6, h: 7.5, color: mixHex(b, "#8EA0C8", 0.45) };
      const deck: BoxSpec = { x: -4, y: -4.5, z: 7.5, w: 7, d: 7, h: 0.5, color: "#F2E6D8" };
      return (
        <>
          {base}
          <Box b={tower} night={night}>
            {windowsRight(tower, 3, 3, lit, glassDark, night)}
            {windowsLeft(tower, 3, 3, lit, glassDark, night)}
          </Box>
          <Box b={deck} night={night} />
          {[-2.5, 0, 2.2].map((x, i) => {
            const [px, py] = iso(x, -1 + i, 8);
            return (
              <g key={x}>
                <rect x={px - 0.5} y={py - 9} width={1} height={9} fill="#3A2A20" />
                <polygon points={`${px - 7},${py - 9} ${px + 7},${py - 9} ${px},${py - 14}`} fill={i % 2 ? a : "#FFF6EE"} />
              </g>
            );
          })}
          {Array.from({ length: 9 }).map((_, i) => {
            const [px, py] = iso(-4 + i * 0.85, 2.5, 9.2 - Math.sin((i / 8) * Math.PI) * 0.5);
            return <circle key={i} cx={px} cy={py} r={1.1} fill={night ? lit : "#FFE9B8"} />;
          })}
          <Tree x={4.5} y={4} night={night} size={0.9} />
        </>
      );
    }
    case "flushing-meadows": {
      const grass: BoxSpec = { ...isle, color: night ? "#5E8F86" : "#A8E0B8" };
      const plinth: BoxSpec = { x: -1.5, y: -1.5, z: 0, w: 3, d: 3, h: 1.4, color: "#E8E2EE" };
      const [gx, gy] = iso(0, 0, 5);
      return (
        <>
          <Box b={grass} night={night} />
          {(() => {
            const [fx, fy] = iso(0, 0, 0);
            return <ellipse cx={fx} cy={fy} rx={5.2 * S} ry={2.6 * S} fill={night ? "#3E6FA0" : "#9ED8F7"} opacity={0.85} />;
          })()}
          <Box b={plinth} night={night} />
          <circle cx={gx} cy={gy} r={30} fill="none" stroke={night ? "#C9D2E8" : "#B8C2D6"} strokeWidth={2.4} />
          <ellipse cx={gx} cy={gy} rx={30} ry={10} fill="none" stroke={night ? "#C9D2E8" : "#B8C2D6"} strokeWidth={1.8} />
          <ellipse cx={gx} cy={gy} rx={11} ry={30} fill="none" stroke={night ? "#C9D2E8" : "#B8C2D6"} strokeWidth={1.8} />
          <line x1={gx} y1={gy + 30} x2={gx} y2={iso(0, 0, 1.4)[1]} stroke="#B8C2D6" strokeWidth={2} />
          <Tree x={-5.5} y={3} night={night} />
          <Tree x={4.5} y={-5} night={night} size={1.1} />
          <Tree x={5} y={4} night={night} size={0.9} />
          <Lantern x={-4} y={5.5} night={night} />
        </>
      );
    }
    case "pedal-pushers": {
      const hub: BoxSpec = { x: -5.5, y: -4, z: 0, w: 9, d: 6, h: 4.5, color: mixHex(a, "#C9D2E8", 0.45) };
      return (
        <>
          {base}
          <Box b={hub} night={night}>
            {[0, 1].map((i) => <OnLeft key={i} b={hub} u={0.6 + i * 4.2} v={0} uw={3.6} vh={3} fill={mixHex(b, "#3A3540", 0.2)} />)}
            {[0, 1, 2, 3, 4].map((i) => <OnLeft key={`s${i}`} b={hub} u={0.6} v={0.4 + i * 0.55} uw={7.8} vh={0.12} fill="#14111A" opacity={0.25} />)}
            <SignLeft b={hub} text="Pedal Pushers" color={a} ink="#FFFFFF" v={3.2} night={night} />
          </Box>
          {[[-1, 3.8], [1.4, 3.8], [3.8, 3.8]].map(([x, y]) => {
            const [px, py] = iso(x, y, 0);
            return (
              <g key={x} stroke={night ? "#E9D8FF" : "#3A3540"} strokeWidth={1.1} fill="none">
                <circle cx={px - 4} cy={py - 3} r={3} />
                <circle cx={px + 4} cy={py - 3} r={3} />
                <path d={`M${px - 4} ${py - 3} L${px - 1} ${py - 8} L${px + 3} ${py - 8} L${px + 4} ${py - 3} M${px - 1} ${py - 8} L${px} ${py - 3}`} stroke={b} />
              </g>
            );
          })}
          <Lantern x={5} y={2} night={night} />
        </>
      );
    }
    case "skyline-pier": {
      const tower: BoxSpec = { x: -3.5, y: -5, z: 0, w: 6, d: 6, h: 8, color: mixHex(a, "#C9D2E8", 0.55) };
      const lobby: BoxSpec = { x: -4.5, y: 1, z: 0, w: 8, d: 2.2, h: 2.4, color: "#F2E6D8" };
      return (
        <>
          {base}
          <Box b={tower} night={night}>
            {[0, 1, 2, 3, 4].map((i) => <OnRight key={i} b={tower} u={0.4} v={2.8 + i} uw={5.2} vh={0.55} fill={night && i % 3 !== 1 ? lit : glassDark} opacity={0.85} />)}
          </Box>
          <Box b={lobby} night={night}>
            <OnLeft b={lobby} u={0.6} v={0} uw={4.4} vh={1.9} fill={night ? lit : glassDark} opacity={0.9} />
            <OnLeft b={lobby} u={5.4} v={0} uw={1.8} vh={2} fill={mixHex(c, "#3A3540", 0.2)} />
          </Box>
          {/* the canopy over the door, where Ray keeps his book */}
          <Box b={{ x: 0.6, y: 3.2, z: 2, w: 3, d: 1.6, h: 0.3, color: a }} night={night} />
          <Lantern x={-4.5} y={4.6} night={night} />
          <Tree x={5} y={-2} night={night} size={0.9} />
        </>
      );
    }
    case "hunters-pier": {
      const water: BoxSpec = { ...isle, color: night ? "#4F6FA8" : "#A9D8F2" };
      const deck: BoxSpec = { x: -2, y: -6, z: 0, w: 4, d: 12, h: 0.6, color: "#C9A27E" };
      const head: BoxSpec = { x: -4.5, y: 1, z: 0, w: 9, d: 4, h: 0.6, color: "#C9A27E" };
      return (
        <>
          <Box b={water} night={night} />
          {[-4, 0, 4].map((y) => {
            const [px, py] = iso(4, y, 0);
            return <path key={y} d={`M${px - 10} ${py} q5 -3 10 0 t10 0`} stroke="#FFFFFF" strokeWidth={1.2} fill="none" opacity={0.6} />;
          })}
          <Box b={deck} night={night} />
          <Box b={head} night={night}>
            {Array.from({ length: 10 }).map((_, i) => <OnLeft key={i} b={head} u={i * 0.9 + 0.2} v={0.6} uw={0.12} vh={1.2} fill={night ? "#E9D8FF" : "#5C4A3A"} />)}
            <OnLeft b={head} u={0} v={1.7} uw={9} vh={0.15} fill={night ? "#E9D8FF" : "#5C4A3A"} />
          </Box>
          {(() => {
            const [px, py] = iso(-0.5, 2.5, 0.6);
            return <rect x={px - 9} y={py - 4} width={18} height={2.4} rx={1} fill={mixHex(c, "#3A2A20", 0.3)} />;
          })()}
          {/* the skyline across the river */}
          {[[-6, -6, 4.5], [-4.2, -6.5, 6.5], [-2.4, -6.2, 4]].map(([x, y, h]) => (
            <Box key={x} b={{ x, y, z: 0, w: 1.6, d: 1.4, h, color: mixHex(a, "#C9D2E8", 0.5) }} night={night} />
          ))}
          <Lantern x={-4} y={4.6} z={0.6} night={night} />
          <Lantern x={4} y={4.6} z={0.6} night={night} />
        </>
      );
    }
    case "rockaway-diner": {
      const diner: BoxSpec = { x: -5.5, y: -3.5, z: 0, w: 10, d: 5.5, h: 3.8, color: "#E8EAF0" };
      const roof: BoxSpec = { x: -5.8, y: -3.8, z: 3.8, w: 10.6, d: 6.1, h: 0.5, color: a };
      return (
        <>
          {base}
          <Box b={diner} night={night}>
            <OnLeft b={diner} u={0} v={0.3} uw={10} vh={0.4} fill={a} />
            {[0, 1, 2, 3].map((i) => <OnLeft key={i} b={diner} u={0.6 + i * 2.3} v={1.1} uw={1.9} vh={1.7} fill={night ? lit : glassDark} opacity={0.9} />)}
            <OnRight b={diner} u={1.5} v={0} uw={1.8} vh={2.8} fill={mixHex(c, "#E8EAF0", 0.2)} />
            <OnLeft b={diner} u={0} v={3} uw={10} vh={0.25} fill="#B8C2D6" />
          </Box>
          <Box b={roof} night={night} />
          {(() => {
            const [px, py] = iso(-0.5, -1, 5.5);
            return (
              <g>
                <rect x={px - 0.8} y={py} width={1.6} height={8} fill="#B8C2D6" />
                <rect x={px - 17} y={py - 9} width={34} height={10} rx={5} fill={night ? "#FF6F7A" : a} />
                {night && <rect x={px - 17} y={py - 9} width={34} height={10} rx={5} fill="#FF6F7A" opacity={0.5} filter="url(#mv-blur)" />}
                <text x={px} y={py - 1.8} fontSize={6} fontWeight={800} fill="#FFF6EE" textAnchor="middle" fontFamily="system-ui, -apple-system, sans-serif">DINER</text>
              </g>
            );
          })()}
          <Lantern x={5} y={4} night={night} />
          <Tree x={-5.5} y={4} night={night} size={0.85} />
        </>
      );
    }
    case "radiant-harbor": {
      const nave: BoxSpec = { x: -5, y: -3, z: 0, w: 7, d: 6, h: 4.5, color: mixHex(b, "#FFFFFF", 0.3) };
      const steeple: BoxSpec = { x: 2, y: -2, z: 0, w: 2.6, d: 2.6, h: 8, color: mixHex(b, "#FFFFFF", 0.4) };
      const t = tone(mixHex(a, "#B9785A", 0.3), night);
      // A gable roof along x over the nave.
      const r = (x: number, y: number, z: number) => iso(x, y, z);
      const ridge = 4.5 + 2.6;
      return (
        <>
          {base}
          <Box b={nave} night={night}>
            {[0, 1, 2].map((i) => <OnLeft key={i} b={nave} u={0.8 + i * 2.2} v={1.2} uw={1} vh={2.2} fill={night ? lit : mixHex(a, "#9FB6D8", 0.4)} opacity={0.9} />)}
          </Box>
          <polygon points={pts([r(-5, 3, 4.5), r(2, 3, 4.5), r(2, 0, ridge), r(-5, 0, ridge)])} fill={t.cool} />
          <polygon points={pts([r(2, -3, 4.5), r(2, 3, 4.5), r(2, 0, ridge)])} fill={t.warm} />
          <Box b={steeple} night={night}>
            <OnRight b={steeple} u={0.7} v={0} uw={1.2} vh={2.2} fill={mixHex(c, "#3A2A20", 0.2)} />
            <OnRight b={steeple} u={0.75} v={5.2} uw={1.1} vh={1.4} fill={night ? lit : a} />
          </Box>
          {(() => {
            const top = iso(3.3, -0.7, 8);
            const apex: P = [top[0], top[1] - 24];
            return (
              <g>
                <polygon points={pts([iso(2, 0.6, 8), iso(4.6, 0.6, 8), apex])} fill={t.cool} />
                <polygon points={pts([iso(4.6, -2, 8), iso(4.6, 0.6, 8), apex])} fill={t.warm} />
                <rect x={apex[0] - 0.7} y={apex[1] - 9} width={1.4} height={9} fill={a} />
                <rect x={apex[0] - 3} y={apex[1] - 6.5} width={6} height={1.4} fill={a} />
              </g>
            );
          })()}
          <Lantern x={-4} y={4.6} night={night} />
          <Tree x={5.2} y={4} night={night} />
        </>
      );
    }
    case "pressed-iron-gym": {
      const gym: BoxSpec = { x: -5.5, y: -4.5, z: 0, w: 10, d: 7, h: 5, color: mixHex("#B5654A", c, 0.15) };
      return (
        <>
          {base}
          <Box b={gym} night={night}>
            {[0, 1, 2].map((i) => <OnLeft key={i} b={gym} u={0.5 + i * 3.2} v={0.6} uw={2.6} vh={2.6} fill={night ? lit : glassDark} opacity={0.9} />)}
            {windowsRight(gym, 1, 3, lit, glassDark, night)}
            <SignLeft b={gym} text="Pressed Iron" color="#1F1B26" ink={a} v={3.4} night={night} />
          </Box>
          {(() => {
            const [px, py] = iso(1, 4.2, 0);
            return (
              <g fill={night ? "#E9D8FF" : "#3B4252"}>
                <rect x={px - 7} y={py - 3.6} width={14} height={1.4} rx={0.6} />
                <rect x={px - 9} y={py - 6.5} width={3} height={7} rx={1} />
                <rect x={px + 6} y={py - 6.5} width={3} height={7} rx={1} />
              </g>
            );
          })()}
          <Lantern x={5} y={3.5} night={night} />
        </>
      );
    }
    case "unisphere": {
      const pool: BoxSpec = { ...isle, color: night ? "#7FA0C8" : "#CFE6F2" };
      const plinth: BoxSpec = { x: -1.2, y: -1.2, z: 0, w: 2.4, d: 2.4, h: 1.2, color: "#E8E2EE" };
      const [gx, gy] = iso(0, 0, 6.5);
      const steel = night ? "#D8E0F0" : "#8FA4B8";
      return (
        <>
          <Box b={pool} night={night} />
          {(() => {
            const [fx, fy] = iso(0, 0, 0);
            return <ellipse cx={fx} cy={fy} rx={5 * S} ry={2.5 * S} fill={night ? "#3E6FA0" : "#9ED8F7"} opacity={0.8} />;
          })()}
          {[-3, -1, 1, 3].map((x) => {
            const [px, py] = iso(x, 3.5, 0);
            return <rect key={x} x={px - 0.6} y={py - 10} width={1.2} height={10} fill="#FFFFFF" opacity={0.8} />;
          })}
          <Box b={plinth} night={night} />
          <circle cx={gx} cy={gy} r={34} fill={night ? "rgba(216,224,240,.12)" : "rgba(143,164,184,.15)"} stroke={steel} strokeWidth={2.6} />
          {[10, 22].map((ry) => <ellipse key={ry} cx={gx} cy={gy} rx={34} ry={ry} fill="none" stroke={steel} strokeWidth={1.4} />)}
          {[12, 24].map((rx) => <ellipse key={rx} cx={gx} cy={gy} rx={rx} ry={34} fill="none" stroke={steel} strokeWidth={1.4} />)}
          <path d={`M${gx - 20} ${gy - 12} q8 -6 16 -2 q6 4 14 -2`} fill="none" stroke={night ? "#E9D8FF" : "#5C7A96"} strokeWidth={3} strokeLinecap="round" />
          <ellipse cx={gx} cy={gy} rx={40} ry={9} fill="none" stroke={steel} strokeWidth={2} transform={`rotate(-22 ${gx} ${gy})`} />
          <line x1={gx} y1={gy + 34} x2={gx} y2={iso(0, 0, 1.2)[1]} stroke={steel} strokeWidth={2.4} />
          <Tree x={-5.2} y={3.6} night={night} />
          <Tree x={5} y={-4.6} night={night} size={0.9} />
          <Lantern x={4.6} y={4.6} night={night} />
        </>
      );
    }
    case "gantry-plaza": {
      const quay: BoxSpec = { x: -6, y: -6, z: -1, w: 12, d: 7, h: 1, color: night ? "#B8A8D8" : "#E8DCCF" };
      const river: BoxSpec = { x: -6, y: 1, z: -1.4, w: 12, d: 5, h: 1, color: night ? "#4F6FA8" : "#A9D8F2" };
      const steel = mixHex(a, night ? "#3B2F72" : "#8E7CC8", 0.2);
      const gantry = (x: number) => {
        const legs = [iso(x, -0.5, 0), iso(x, 1.5, 0)];
        const top = iso(x, 0.5, 6.5);
        return (
          <g key={x} stroke={steel} strokeWidth={3} strokeLinecap="round">
            <line x1={legs[0][0]} y1={legs[0][1]} x2={top[0]} y2={top[1]} />
            <line x1={legs[1][0]} y1={legs[1][1]} x2={top[0]} y2={top[1]} />
            <line x1={top[0] - 16} y1={top[1] - 2} x2={top[0] + 18} y2={top[1] + 8} strokeWidth={4} />
            <line x1={(legs[0][0] + top[0]) / 2} y1={(legs[0][1] + top[1]) / 2} x2={(legs[1][0] + top[0]) / 2} y2={(legs[1][1] + top[1]) / 2} strokeWidth={1.6} />
          </g>
        );
      };
      return (
        <>
          <Box b={river} night={night} />
          <Box b={quay} night={night} />
          {[-5, -3.2, -1.4].map((y, i) => (
            <Box key={y} b={{ x: 3.8, y, z: 0, w: 1.6, d: 1.4, h: [5, 7.5, 4][i], color: mixHex(c, "#C9D2E8", 0.55) }} night={night} />
          ))}
          {gantry(-3.5)}
          {gantry(0.5)}
          <OnRight b={quay} u={0.2} v={1.01} uw={6.6} vh={0.05} fill={b} />
          <Lantern x={-5} y={0.5} night={night} />
          <Lantern x={2.5} y={0.5} night={night} />
          {(() => {
            const [px, py] = iso(-1.5, 0.2, 0);
            return <rect x={px - 9} y={py - 4} width={18} height={2.4} rx={1} fill={mixHex("#5C4A3A", "#000", 0.1)} />;
          })()}
        </>
      );
    }
    case "low-light-lounge": {
      const hall: BoxSpec = { x: -5, y: -4.5, z: 0, w: 8.5, d: 6.5, h: 4.4, color: mixHex(b, "#7A2E3A", 0.25) };
      return (
        <>
          {base}
          <Box b={hall} night={night}>
            {[0, 1, 2].map((i) => <OnLeft key={i} b={hall} u={0.6 + i * 2.6} v={0.9} uw={1.8} vh={2} fill={night ? "#FFD08A" : mixHex(a, "#3A2430", 0.5)} opacity={0.95} />)}
            <OnLeft b={hall} u={0} v={3.1} uw={8.5} vh={0.35} fill={a} />
            <OnRight b={hall} u={2} v={0} uw={1.8} vh={2.8} fill="#2A1E2E" />
            <SignLeft b={hall} text="Low Light" color="#2A1E2E" ink="#E8C79A" v={3.5} night={night} />
          </Box>
          {/* the velvet rope */}
          {(() => {
            const p1 = iso(-1, 3.4, 0);
            const p2 = iso(2.5, 3.4, 0);
            return (
              <g>
                {[p1, p2].map((p, i) => <rect key={i} x={p[0] - 1} y={p[1] - 10} width={2} height={10} fill="#E8C79A" />)}
                <path d={`M${p1[0]} ${p1[1] - 8} Q${(p1[0] + p2[0]) / 2} ${(p1[1] + p2[1]) / 2 - 2} ${p2[0]} ${p2[1] - 8}`} fill="none" stroke="#B4232F" strokeWidth={2.4} />
              </g>
            );
          })()}
          <Lantern x={4.6} y={3.5} night={night} />
          <Tree x={-5.5} y={4} night={night} size={0.8} />
        </>
      );
    }
    case "fifs-furniture":
    case "thread-count": {
      const fifs = place.id === "fifs-furniture";
      const shop: BoxSpec = { x: -5, y: -4.5, z: 0, w: 8.5, d: 6.5, h: 5, color: mixHex(b, "#E8DCCF", 0.2) };
      const awning: BoxSpec = { x: -5, y: 2, z: 2.9, w: 8.5, d: 1.2, h: 0.25, color: a };
      return (
        <>
          {base}
          <Box b={shop} night={night}>
            <OnLeft b={shop} u={0.6} v={0} uw={5.2} vh={2.8} fill={night ? lit : "#DDEFF6"} opacity={0.9} />
            <OnLeft b={shop} u={6.4} v={0} uw={1.6} vh={2.8} fill={mixHex(c, "#000", 0.1)} />
            {windowsRight(shop, 1, 3, lit, glassDark, night)}
            <SignLeft b={shop} text={fifs ? "Fif's Furniture" : "Thread Count"} color="#2A2530" ink={a} v={3.6} night={night} />
            {/* mannequins in the window */}
            {[1.4, 3.2, 5].map((u, i) => {
              const [px, py] = iso(shop.x + u, shop.y + shop.d + 0.03, 0.2);
              return (
                fifs ? (
                  // Fif's: an armchair, a lamp and a sofa in the window.
                  <g key={u}>
                    <rect x={px - 6} y={py - 9} width={12} height={6} rx={1.5} fill={["#FF8A3D", "#40B589", "#6C8CFF"][i]} />
                    <rect x={px - 6} y={py - 13} width={12} height={4} rx={1.5} fill={mixHex(["#FF8A3D", "#40B589", "#6C8CFF"][i], "#000", 0.15)} />
                  </g>
                ) : (
                <g key={u}>
                  <circle cx={px} cy={py - 15} r={2.2} fill="#F4EDE6" />
                  <path d={`M${px - 4} ${py - 12} h8 l2 9 h-12z`} fill={["#E0457B", "#2A2530", "#6C8CFF"][i]} />
                </g>
                )
              );
            })}
          </Box>
          <Box b={awning} night={night}>
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <OnLeft key={i} b={awning} u={i * 1.06} v={0} uw={0.53} vh={0.25} fill="#FFFFFF" opacity={0.85} />)}
          </Box>
          <Lantern x={4.6} y={4.2} night={night} />
          <Tree x={-5.5} y={4.2} night={night} size={0.8} />
        </>
      );
    }
    case "boulevard-motors": {
      const show: BoxSpec = { x: -5.5, y: -4.5, z: 0, w: 9, d: 5.5, h: 4.2, color: "#E6E8EC" };
      const roof: BoxSpec = { x: -5.8, y: -4.8, z: 4.2, w: 9.6, d: 6.1, h: 0.4, color: a };
      const carAt = (x: number, y: number, col: string) => {
        const [px, py] = iso(x, y, 0);
        return (
          <g key={`${x}-${y}`}>
            <path d={`M${px - 11} ${py - 3} l3 -5 h6 l4 -4 h6 l4 4 h3 l1 5 z`} fill={col} />
            <path d={`M${px - 2} ${py - 8} l3 -3 h5 l3 3 z`} fill={night ? "#FFE2A8" : "#DDEFF6"} />
            <circle cx={px - 6} cy={py - 2} r={2.2} fill="#1F1B26" />
            <circle cx={px + 8} cy={py - 2} r={2.2} fill="#1F1B26" />
          </g>
        );
      };
      return (
        <>
          {base}
          <Box b={show} night={night}>
            <OnLeft b={show} u={0.4} v={0.2} uw={8.2} vh={2.2} fill={night ? lit : "#CFE6F2"} opacity={0.75} />
            <SignLeft b={show} text="Boulevard Motors" color={a} ink="#FFFFFF" v={2.5} night={night} />
          </Box>
          <Box b={roof} night={night} />
          {carAt(-2.5, 2.8, "#D93A2F")}
          {carAt(1.8, 3.2, "#2F5DA8")}
          {[[-5, 4.6, "#FF2E88"], [-4.4, 4.9, "#FFC21A"], [4.6, 4, "#6C8CFF"]].map(([x, y, col]) => {
            const [px, py] = iso(x as number, y as number, 0);
            return (
              <g key={`${x}`}>
                <line x1={px} y1={py} x2={px} y2={py - 22} stroke="#8E7CC8" strokeWidth={0.8} />
                <ellipse cx={px} cy={py - 25} rx={3.4} ry={4.2} fill={col as string} />
              </g>
            );
          })}
        </>
      );
    }
    case "st-johnsons": {
      // A campus around a lawn: the red brick chapel hall with its cupola, a dorm and the library.
      const lawn: BoxSpec = { ...isle, color: night ? "#5E8F6A" : "#BFE3B4" };
      const brick = mixHex(a, "#8A3A2E", 0.35);
      const hall: BoxSpec = { x: -5.6, y: -5.6, z: 0, w: 4.6, d: 4, h: 4.4, color: brick };
      const trim: BoxSpec = { x: -5.75, y: -5.75, z: 4.4, w: 4.9, d: 4.3, h: 0.3, color: "#F2E6D8" };
      const drum: BoxSpec = { x: -4.2, y: -4.5, z: 4.7, w: 1.8, d: 1.8, h: 1.4, color: "#F4EEE4" };
      const dorm: BoxSpec = { x: 0.6, y: -5.6, z: 0, w: 4.8, d: 3, h: 3.4, color: mixHex(brick, "#C9A08A", 0.25) };
      const library: BoxSpec = { x: -5.6, y: 0.8, z: 0, w: 3, d: 4.6, h: 2.8, color: mixHex(b, "#D9C4A0", 0.3) };
      const steps: BoxSpec = { x: -4.2, y: -1.6, z: 0, w: 1.8, d: 0.9, h: 0.35, color: "#E8E2D6" };
      const path1: BoxSpec = { x: -2.4, y: -1, z: 0, w: 1.2, d: 6.8, h: 0.05, color: night ? "#B8A8D8" : "#EADFCC" };
      const path2: BoxSpec = { x: -2.4, y: 1.4, z: 0, w: 8, d: 1.2, h: 0.05, color: night ? "#B8A8D8" : "#EADFCC" };
      const [sx, sy] = iso(-3.3, -3.6, 6.1);
      const win = night ? lit : "#F4EEE4";
      return (
        <>
          <Box b={lawn} night={night} />
          <Box b={path1} night={night} />
          <Box b={path2} night={night} />
          <Box b={hall} night={night}>
            {[0, 1, 2].map((i) => <OnLeft key={`a${i}`} b={hall} u={0.5 + i * 1.45} v={2.4} uw={0.8} vh={1.3} fill={win} opacity={0.95} />)}
            <OnLeft b={hall} u={1.75} v={0} uw={1.1} vh={1.9} fill={mixHex(c, "#000", 0.1)} />
            {windowsRight(hall, 2, 3, lit, mixHex(a, "#2A2530", 0.55), night)}
          </Box>
          <Box b={trim} night={night} />
          <Box b={drum} night={night}>
            {[0, 1].map((i) => <OnLeft key={i} b={drum} u={0.3 + i * 0.75} v={0.3} uw={0.4} vh={0.8} fill={night ? lit : mixHex(c, "#9FB6D8", 0.4)} />)}
          </Box>
          <polygon points={`${sx - 11},${sy + 4} ${sx},${sy - 20} ${sx + 11},${sy + 4}`} fill={night ? "#C9D2E8" : "#5C7A96"} />
          <line x1={sx} y1={sy - 20} x2={sx} y2={sy - 28} stroke={night ? "#FFE2A8" : "#F2B705"} strokeWidth={1.6} />
          <Box b={steps} night={night} />
          <Box b={dorm} night={night}>
            {windowsLeft(dorm, 2, 4, lit, mixHex(a, "#2A2530", 0.5), night)}
            {windowsRight(dorm, 2, 2, lit, mixHex(a, "#2A2530", 0.5), night)}
          </Box>
          <Box b={library} night={night}>
            {[0, 1, 2].map((i) => <OnRight key={i} b={library} u={0.5 + i * 1.4} v={0.6} uw={0.7} vh={1.6} fill={night ? lit : mixHex(c, "#9FB6D8", 0.45)} opacity={0.95} />)}
            <OnLeft b={library} u={0} v={2.3} uw={3} vh={0.3} fill="#F2E6D8" />
          </Box>
          <Tree x={2.2} y={-0.6} night={night} size={0.9} />
          <Tree x={4.6} y={4.2} night={night} />
          <Tree x={-0.4} y={4.6} night={night} size={0.85} />
          <Tree x={3.4} y={2.9} night={night} size={0.75} />
          <Lantern x={-1} y={0.2} night={night} />
          <Lantern x={1.2} y={3} night={night} />
        </>
      );
    }
    case "queensborough-u": {
      // A campus quad: the columned library, a glass science block, a clock tower and the student union.
      const quad: BoxSpec = { ...isle, color: night ? "#5E8F6A" : "#C6E8BC" };
      const plinth: BoxSpec = { x: -5.4, y: -5.6, z: 0, w: 6.2, d: 4, h: 0.6, color: "#E8E2D6" };
      const hall: BoxSpec = { x: -5.1, y: -5.4, z: 0.6, w: 5.6, d: 2.6, h: 3.3, color: mixHex(b, "#F4EEE4", 0.4) };
      const roof: BoxSpec = { x: -5.3, y: -5.6, z: 3.9, w: 6, d: 3.6, h: 0.45, color: "#F4EEE4" };
      const glass: BoxSpec = { x: 1.5, y: -5.6, z: 0, w: 4, d: 3.6, h: 6, color: mixHex(a, "#9FC4E8", 0.45) };
      const tower: BoxSpec = { x: -5.6, y: -0.8, z: 0, w: 1.6, d: 1.6, h: 6.4, color: mixHex(c, "#B88A6A", 0.55) };
      const union: BoxSpec = { x: -5.6, y: 1.6, z: 0, w: 3.4, d: 3.6, h: 2.6, color: mixHex(a, "#E8E2D0", 0.55) };
      const path: BoxSpec = { x: -1.8, y: -1.4, z: 0, w: 1.4, d: 7.2, h: 0.05, color: night ? "#B8A8D8" : "#EADFCC" };
      const path2: BoxSpec = { x: -1.8, y: 1.6, z: 0, w: 7.6, d: 1.2, h: 0.05, color: night ? "#B8A8D8" : "#EADFCC" };
      const front = roof.y + roof.d;
      const [p0, p1, peak] = [iso(-5.3, front, 4.35), iso(0.7, front, 4.35), iso(-2.3, front, 5.9)];
      const tt = [iso(-5.6, -0.8, 6.4), iso(-4, -0.8, 6.4), iso(-4, 0.8, 6.4), iso(-5.6, 0.8, 6.4)];
      const apex = iso(-4.8, 0, 8.4);
      const [cx, cy] = iso(-4.8, 0.82, 5.2);
      return (
        <>
          <Box b={quad} night={night} />
          <Box b={path} night={night} />
          <Box b={path2} night={night} />
          <Box b={plinth} night={night} />
          <Box b={hall} night={night}>
            {[0, 1, 2].map((i) => <OnLeft key={i} b={hall} u={0.9 + i * 1.6} v={0.5} uw={0.8} vh={1.9} fill={night ? lit : mixHex(a, "#2A2530", 0.45)} opacity={0.9} />)}
          </Box>
          {[-4.9, -3.6, -2.3, -1, 0.3].map((x) => <Box key={x} b={{ x, y: front - 0.5, z: 0.6, w: 0.4, d: 0.4, h: 3.3, color: "#FBF7F0" }} night={night} />)}
          <Box b={roof} night={night} />
          <polygon points={`${p0[0]},${p0[1]} ${peak[0]},${peak[1]} ${p1[0]},${p1[1]}`} fill={night ? "#D8D0E8" : "#FBF7F0"} />
          <polygon points={`${p0[0] + 10},${p0[1] - 1} ${peak[0]},${peak[1] + 5} ${p1[0] - 10},${p1[1] - 1}`} fill={mixHex(a, "#FFFFFF", 0.35)} opacity={0.6} />
          <Box b={tower} night={night} />
          <polygon points={pts([tt[1], tt[2], apex])} fill={tone("#5C7A96", night).warm} />
          <polygon points={pts([tt[2], tt[3], apex])} fill={tone("#5C7A96", night).cool} />
          <ellipse cx={cx} cy={cy} rx={5.5} ry={6.2} fill="#FBF7F0" stroke={mixHex(c, "#000", 0.2)} strokeWidth={0.8} />
          <line x1={cx} y1={cy} x2={cx} y2={cy - 4} stroke="#2A2530" strokeWidth={0.9} />
          <line x1={cx} y1={cy} x2={cx + 3} y2={cy + 1} stroke="#2A2530" strokeWidth={0.9} />
          <Box b={glass} night={night}>
            {windowsLeft(glass, 4, 4, lit, mixHex(a, "#2A3A5C", 0.4), night)}
            {windowsRight(glass, 4, 3, lit, mixHex(a, "#2A3A5C", 0.4), night)}
          </Box>
          <Box b={union} night={night}>
            {[0, 1].map((i) => <OnRight key={i} b={union} u={0.5 + i * 1.6} v={0.5} uw={1.1} vh={1.4} fill={night ? lit : mixHex(a, "#9FB6D8", 0.4)} opacity={0.95} />)}
            <OnLeft b={union} u={0} v={2.05} uw={3.4} vh={0.35} fill={a} />
          </Box>
          <SignLeft b={plinth} text="Library" color={a} ink="#FFFFFF" v={-0.45} night={night} />
          <Tree x={2.4} y={0.2} night={night} size={0.85} />
          <Tree x={4.8} y={4.4} night={night} />
          <Tree x={0.4} y={4.6} night={night} size={0.8} />
          <Lantern x={3.6} y={0.6} night={night} />
          <Lantern x={3.4} y={3.2} night={night} />
        </>
      );
    }
    // ---- v0.6 Astoria ----
    case "ditmars-deli": {
      const shop: BoxSpec = { x: -5, y: -4, z: 0, w: 8, d: 6, h: 4.6, color: "#EDE6D6" };
      const upper: BoxSpec = { x: -5, y: -4, z: 4.6, w: 8, d: 6, h: 3, color: mixHex("#B86A4A", c, 0.1) };
      return (
        <>
          {base}
          <Box b={shop} night={night}>
            <OnLeft b={shop} u={0.5} v={0} uw={4.8} vh={2.6} fill={night ? lit : glassDark} opacity={0.9} />
            <OnLeft b={shop} u={5.7} v={0} uw={1.7} vh={2.6} fill={mixHex(a, "#1F1B26", 0.4)} />
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <OnLeft key={i} b={shop} u={i} v={2.75} uw={0.5} vh={0.8} fill={i % 2 ? "#FFF6EE" : a} />)}
            <SignLeft b={shop} text="Deli & Dreams" color={a} ink="#FFFFFF" v={3.5} night={night} />
          </Box>
          <Box b={upper} night={night}>{windowsLeft(upper, 1, 3, lit, glassDark, night)}{windowsRight(upper, 1, 2, lit, glassDark, night)}</Box>
          {(() => { const [px, py] = iso(1.8, 3.2, 0); return (<g><ellipse cx={px} cy={py - 3} rx={3.6} ry={2.2} fill="#3A3540" /><circle cx={px + 3.2} cy={py - 5.6} r={2.2} fill="#3A3540" /><polygon points={`${px + 1.8},${py - 7.4} ${px + 2.5},${py - 9.6} ${px + 3.4},${py - 7.4}`} fill="#3A3540" /></g>); })()}
          <Lantern x={4.5} y={3.5} night={night} />
        </>
      );
    }
    case "two-bros-pizza": {
      const shop: BoxSpec = { x: -4.5, y: -4, z: 0, w: 7, d: 6, h: 5, color: mixHex(b, "#F4D9B0", 0.3) };
      return (
        <>
          {base}
          <Box b={shop} night={night}>
            <OnLeft b={shop} u={0.5} v={0} uw={4} vh={2.6} fill={night ? lit : glassDark} opacity={0.9} />
            <OnLeft b={shop} u={4.9} v={0} uw={1.6} vh={2.6} fill={c} />
            {[0, 1, 2, 3, 4, 5, 6].map((i) => <OnLeft key={i} b={shop} u={i} v={2.75} uw={0.5} vh={0.8} fill={i % 2 ? "#FFFFFF" : a} />)}
            <SignLeft b={shop} text="Two Bros Pizza" color="#2E9E6A" ink="#FFFFFF" v={3.6} night={night} />
          </Box>
          {(() => { const [px, py] = iso(3.6, 2.6, 0); return (<g><circle cx={px} cy={py - 12} r={7} fill="#FFC76B" /><circle cx={px} cy={py - 12} r={5.4} fill="#F2A33A" />{[[-2, -1], [2, 1], [0, 3]].map(([dx, dy]) => <circle key={`${dx}${dy}`} cx={px + dx} cy={py - 12 + dy} r={1.2} fill={a} />)}<rect x={px - 0.6} y={py - 5} width={1.2} height={5} fill="#3A3540" /></g>); })()}
          <Tree x={-5} y={4} night={night} size={0.8} />
        </>
      );
    }
    // The Hub (owner, Oct 16): four glass rings, one per floor, stacked off-center around a lit core,
    // each tilted its own way, neon on every rim, a halo and a spire on top.
    case "neon-spoon": {
      const ringAt = (cx: number, cy: number, z: number, r: number, h: number, tilt: number, rim: string, glass: string, key: number) => {
        const [px, py] = iso(cx, cy, z);
        const rx = r * S * 1.22, ry = r * S * 0.7, hh = h * S;
        const side = night ? mixHex(glass, "#3B2F72", 0.55) : mixHex(glass, "#6E6A9A", 0.22);
        const top = night ? mixHex(glass, "#E9D8FF", 0.2) : glass;
        return (
          <g key={key} transform={`rotate(${tilt} ${px} ${py})`}>
            <ellipse cx={px} cy={py} rx={rx * 0.94} ry={ry * 0.94} fill={side} />
            <rect x={px - rx * 0.94} y={py - hh} width={rx * 1.88} height={hh} fill={side} />
            {/* The lit band of windows round each floor. */}
            <rect x={px - rx * 0.9} y={py - hh * 0.72} width={rx * 1.8} height={hh * 0.38} fill={night ? "#FFE2A8" : "#BFE6F7"} opacity={night ? 0.85 : 0.9} />
            <ellipse cx={px} cy={py - hh} rx={rx} ry={ry} fill={top} />
            <ellipse cx={px} cy={py - hh} rx={rx} ry={ry} fill="none" stroke={rim} strokeWidth={2.2} />
            {night && <ellipse cx={px} cy={py - hh} rx={rx} ry={ry} fill="none" stroke={rim} strokeWidth={5} opacity={0.35} filter="url(#mv-blur)" />}
          </g>
        );
      };
      const [cx0, cy0] = iso(0, 0, 0);
      const [, coreTop] = iso(0, 0, 10.2);
      const halo = iso(0, 0, 11.0);
      return (
        <>
          {base}
          <rect x={cx0 - 7} y={coreTop} width={14} height={cy0 - coreTop} fill={night ? "#7FE0E8" : "#9ED8F7"} />
          {night && <rect x={cx0 - 7} y={coreTop} width={14} height={cy0 - coreTop} fill="#5FD4C9" opacity={0.4} filter="url(#mv-blur)" />}
          {[
            { x: 0, y: 0.4, z: 0.2, r: 4.6, h: 1.5, tilt: -3, rim: "#FF2E88", glass: "#E9F7FA" },
            { x: 0.5, y: -0.3, z: 2.5, r: 3.9, h: 1.4, tilt: 4, rim: "#5FD4C9", glass: "#DDF2F7" },
            { x: -0.4, y: 0.2, z: 4.7, r: 4.3, h: 1.4, tilt: -5, rim: "#FFB23D", glass: "#F2F0FA" },
            { x: 0.2, y: 0.2, z: 6.9, r: 3.3, h: 1.3, tilt: 3, rim: "#FF6A3D", glass: "#E9F7FA" },
          ].map((f, i) => ringAt(f.x, f.y, f.z + f.h, f.r, f.h, f.tilt, f.rim, f.glass, i))}
          <ellipse cx={halo[0]} cy={halo[1]} rx={18} ry={6.5} fill="none" stroke="#FF2E88" strokeWidth={2.4} transform={`rotate(-12 ${halo[0]} ${halo[1]})`} />
          <polygon points={`${halo[0] - 3},${halo[1]} ${halo[0] + 3},${halo[1]} ${halo[0]},${halo[1] - 12}`} fill={night ? "#E9D8FF" : "#B9C6CF"} />
          <circle cx={halo[0]} cy={halo[1] - 13} r={2.2} fill="#FF2E88" />
          {(() => {
            const [sx, sy] = iso(0, 4.6, 1.6);
            return (
              <g>
                <rect x={sx - 18} y={sy - 6} width={36} height={10} rx={2} fill="#14111A" />
                <text x={sx} y={sy + 1.6} fontSize={6} fontWeight={900} fill="#5FD4C9" textAnchor="middle" fontFamily="system-ui, -apple-system, sans-serif" letterSpacing={0.6}>THE HUB</text>
              </g>
            );
          })()}
          <Lantern x={5} y={4.5} night={night} />
          <Lantern x={-5} y={4.5} night={night} />
        </>
      );
    }
    case "up-on-thirty": {
      const bldg: BoxSpec = { x: -4, y: -4, z: 0, w: 7, d: 6, h: 6.5, color: mixHex("#E8C9A8", b, 0.3) };
      const deck: BoxSpec = { x: -4.4, y: -4.4, z: 6.5, w: 7.8, d: 6.8, h: 0.5, color: "#F4EDE6" };
      return (
        <>
          {base}
          <Box b={bldg} night={night}>{windowsLeft(bldg, 3, 3, lit, glassDark, night)}{windowsRight(bldg, 3, 2, lit, glassDark, night)}</Box>
          <Box b={deck} night={night} />
          {Array.from({ length: 10 }).map((_, i) => { const [px, py] = iso(-4 + i * 0.8, 2.3, 8.6 - Math.sin((i / 9) * Math.PI) * 0.6); return <circle key={i} cx={px} cy={py} r={1.1} fill={night ? lit : "#FFE9B8"} />; })}
          {[-2, 1].map((x) => { const [px, py] = iso(x, 0, 7); return (<g key={x}><rect x={px - 3} y={py - 5} width={6} height={1.2} rx={0.6} fill={c} /><rect x={px - 0.4} y={py - 4} width={0.8} height={4} fill={c} /><circle cx={px} cy={py - 6.5} r={1.2} fill={a} /></g>); })}
          <Tree x={4.6} y={3.8} night={night} size={0.9} />
        </>
      );
    }
    case "steinway-fresh": {
      const mart: BoxSpec = { x: -6, y: -4, z: 0, w: 11, d: 6, h: 4.2, color: "#F2EEE4" };
      return (
        <>
          {base}
          <Box b={mart} night={night}>
            <OnLeft b={mart} u={0.6} v={0} uw={7.4} vh={2.6} fill={night ? lit : glassDark} opacity={0.85} />
            <OnLeft b={mart} u={8.4} v={0} uw={2} vh={2.6} fill={mixHex(a, "#1F1B26", 0.3)} />
            <SignLeft b={mart} text="Fresh Mart" color={a} ink="#FFFFFF" v={2.8} night={night} />
          </Box>
          {[[-3.5, 3.6, "#E5484D"], [-1.5, 3.6, "#FFC21A"], [0.5, 3.6, "#5CC28F"]].map(([x, y, col]) => { const [px, py] = iso(x as number, y as number, 0); return (<g key={String(x)}><rect x={px - 4} y={py - 4} width={8} height={4} fill="#B8743A" /><circle cx={px - 1.8} cy={py - 5} r={1.6} fill={col as string} /><circle cx={px + 1.6} cy={py - 5} r={1.6} fill={col as string} /></g>); })}
          {(() => { const [px, py] = iso(3.6, 3.4, 0); return (<g stroke={night ? "#E9D8FF" : "#3A3540"} strokeWidth={1} fill="none"><path d={`M${px - 5} ${py - 9} h2 l2 6 h6 l1.5 -4.5 h-8.5`} /><circle cx={px - 0.5} cy={py - 1.5} r={1} /><circle cx={px + 4} cy={py - 1.5} r={1} /></g>); })()}
        </>
      );
    }
    case "hellgate-hall": {
      const hall: BoxSpec = { x: -5.5, y: -4.5, z: 0, w: 9.5, d: 7, h: 4.8, color: mixHex(c, b, 0.35) };
      const track: BoxSpec = { x: -6, y: 3.2, z: 6.2, w: 12, d: 1.2, h: 0.6, color: "#6B6570" };
      return (
        <>
          {base}
          <Box b={hall} night={night}>
            <OnLeft b={hall} u={3.6} v={0} uw={2.2} vh={2.4} fill={night ? a : "#3A2550"} />
            <OnRight b={hall} u={0.8} v={3.4} uw={5.4} vh={0.35} fill={a} />
            <SignLeft b={hall} text="Hellgate Hall" color="#14111A" ink={a} v={3.0} night={night} />
          </Box>
          {[-4.5, 4.5].map((x) => { const [px, py] = iso(x, 3.8, 0); const [, ty] = iso(x, 3.8, 6.2); return <rect key={x} x={px - 1} y={ty} width={2} height={py - ty} fill="#5A5460" />; })}
          <Box b={track} night={night} />
          {(() => { const car: BoxSpec = { x: -2.5, y: 3.2, z: 6.8, w: 5, d: 1.2, h: 1.4, color: "#C9D2E8" }; return <Box b={car} night={night}>{[0, 1, 2].map((i) => <OnLeft key={i} b={car} u={0.4 + i * 1.6} v={0.4} uw={1.1} vh={0.7} fill={night ? lit : glassDark} />)}</Box>; })()}
          {night && [[-2, 0], [2, 1]].map(([x, y]) => { const [px, py] = iso(x, y, 4.8); return <circle key={x} cx={px} cy={py - 10} r={10} fill={a} opacity={0.25} filter="url(#mv-blur)" />; })}
        </>
      );
    }
    case "triborough-works": {
      const t: BoxSpec = { x: -4, y: -4, z: 0, w: 7, d: 6, h: 9, color: mixHex(a, "#E6E8EC", 0.55) };
      return (
        <>
          {base}
          <Box b={t} night={night}>
            {windowsRight(t, 5, 3, lit, glassDark, night)}
            {windowsLeft(t, 5, 3, lit, glassDark, night)}
            <SignLeft b={t} text="Triborough Works" color={c} ink="#FFFFFF" v={0.3} night={night} />
          </Box>
          {(() => { const [px, py] = iso(-0.5, 1, 9); return <rect x={px - 0.6} y={py - 10} width={1.2} height={10} fill={c} />; })()}
          <Tree x={4.5} y={3.5} night={night} size={0.9} />
          <Lantern x={-5} y={4} night={night} />
        </>
      );
    }
    case "ditmars-library": {
      const hall: BoxSpec = { x: -5.5, y: -4, z: 0, w: 10, d: 6, h: 4.6, color: mixHex(b, "#E8D6BE", 0.3) };
      const roof: BoxSpec = { x: -5.8, y: -4.3, z: 4.6, w: 10.6, d: 6.6, h: 0.6, color: mixHex(a, "#F2E6D8", 0.4) };
      return (
        <>
          {base}
          <Box b={hall} night={night}>
            {[0, 1, 2, 3, 4].map((i) => <OnLeft key={i} b={hall} u={0.6 + i * 1.95} v={0.6} uw={0.6} vh={3.4} fill="#FFF6EE" opacity={0.9} />)}
            {[0, 1, 2, 3].map((i) => <OnLeft key={`w${i}`} b={hall} u={1.4 + i * 1.95} v={1} uw={0.9} vh={2.4} fill={night ? lit : glassDark} />)}
          </Box>
          <Box b={roof} night={night} />
          {(() => { const [px, py] = iso(-1, 2, 5.2); return <polygon points={`${px - 26},${py} ${px + 26},${py} ${px},${py - 12}`} fill={mixHex(a, "#F2E6D8", 0.3)} />; })()}
          <Tree x={5} y={3.8} night={night} />
          <Tree x={-5.6} y={4.2} night={night} size={0.8} />
        </>
      );
    }
    case "precinct-114-half": {
      const st: BoxSpec = { x: -5, y: -4, z: 0, w: 9, d: 6, h: 5.4, color: mixHex("#C9B8A8", b, 0.4) };
      return (
        <>
          {base}
          <Box b={st} night={night}>
            {windowsLeft(st, 2, 4, lit, glassDark, night)}
            <OnLeft b={st} u={3.6} v={0} uw={1.8} vh={2.2} fill={a} />
            <SignLeft b={st} text="114½ Precinct" color={a} ink="#FFFFFF" v={3.9} night={night} />
          </Box>
          {[-2.8, 3.6].map((x) => { const [px, py] = iso(x, 3.6, 0); return (<g key={x}><rect x={px - 0.5} y={py - 11} width={1} height={11} fill="#3A3540" /><circle cx={px} cy={py - 12.5} r={2} fill={night ? "#9FC2FF" : "#2F5FB3"} />{night && <circle cx={px} cy={py - 12.5} r={7} fill="url(#mv-glow)" />}</g>); })}
          {(() => { const [px, py] = iso(0.6, 4.3, 0); return (<g><rect x={px - 7} y={py - 5} width={14} height={4} rx={1.5} fill="#F4F1EA" /><rect x={px - 4} y={py - 7.4} width={8} height={2.6} rx={1} fill={a} /><circle cx={px - 4} cy={py - 0.8} r={1.4} fill="#14111A" /><circle cx={px + 4} cy={py - 0.8} r={1.4} fill="#14111A" /></g>); })()}
        </>
      );
    }
    case "engine-7": {
      const house: BoxSpec = { x: -5, y: -4, z: 0, w: 8.5, d: 6, h: 6, color: mixHex(a, "#B86A4A", 0.4) };
      return (
        <>
          {base}
          <Box b={house} night={night}>
            {[0, 1].map((i) => <OnLeft key={i} b={house} u={0.6 + i * 4} v={0} uw={3.4} vh={3.4} fill={a} />)}
            {[0, 1].map((i) => [0, 1, 2].map((r) => <OnLeft key={`${i}${r}`} b={house} u={0.8 + i * 4} v={0.4 + r * 1} uw={3} vh={0.5} fill={night ? lit : glassDark} opacity={0.75} />))}
            <SignLeft b={house} text="Engine 7" color="#F4E3C8" ink={c} v={4.3} night={night} />
          </Box>
          {(() => { const [px, py] = iso(1.8, 3.8, 0); return (<g><ellipse cx={px} cy={py - 3} rx={3.6} ry={2.2} fill="#FFFFFF" /><circle cx={px + 3.2} cy={py - 5.4} r={2.1} fill="#FFFFFF" />{[[-1.5, -3], [1, -2.2], [3.6, -5.8]].map(([dx, dy]) => <circle key={`${dx}`} cx={px + dx} cy={py + dy} r={0.6} fill="#14111A" />)}</g>); })()}
          <Lantern x={4.6} y={3.6} night={night} />
        </>
      );
    }
    case "astoria-cc": {
      const a1: BoxSpec = { x: -6, y: -4, z: 0, w: 7, d: 5.5, h: 4.4, color: mixHex(b, "#D9C9B0", 0.3) };
      const a2: BoxSpec = { x: 1.6, y: -4, z: 0, w: 4.4, d: 5.5, h: 6, color: mixHex(a, "#E8E2D0", 0.55) };
      return (
        <>
          {base}
          <Box b={a1} night={night}>{windowsLeft(a1, 2, 4, lit, glassDark, night)}<SignLeft b={a1} text="Community College" color={a} ink="#FFFFFF" v={3.3} night={night} /></Box>
          <Box b={a2} night={night}>{windowsLeft(a2, 3, 2, lit, glassDark, night)}{windowsRight(a2, 3, 3, lit, glassDark, night)}</Box>
          {(() => { const [px, py] = iso(-2, 3.6, 0); return (<g><rect x={px - 0.5} y={py - 16} width={1} height={16} fill="#3A3540" /><rect x={px + 0.5} y={py - 16} width={7} height={4.5} fill={a} /></g>); })()}
          <Tree x={4.6} y={3.8} night={night} />
        </>
      );
    }
    case "harmony-chapel": {
      const nave: BoxSpec = { x: -4, y: -3.5, z: 0, w: 7, d: 5, h: 4, color: mixHex(a, "#F4EDE6", 0.5) };
      const tower: BoxSpec = { x: -4, y: -3.5, z: 0, w: 2.4, d: 2.4, h: 7.4, color: mixHex(a, "#F4EDE6", 0.4) };
      return (
        <>
          {base}
          <Box b={nave} night={night}>
            {[0, 1, 2].map((i) => <OnLeft key={i} b={nave} u={1 + i * 2} v={1.2} uw={0.9} vh={2} fill={["#E5484D", "#6C8CFF", "#FFC21A"][i]} opacity={night ? 1 : 0.8} />)}
          </Box>
          {(() => { const [px, py] = iso(-0.5, 1, 4); return <polygon points={`${px - 22},${py} ${px + 22},${py} ${px},${py - 10}`} fill={mixHex(c, "#F4EDE6", 0.55)} />; })()}
          <Box b={tower} night={night}><OnRight b={tower} u={0.7} v={5} uw={1} vh={1.4} fill={night ? lit : glassDark} /></Box>
          {(() => { const [px, py] = iso(-2.8, -2.3, 7.4); return <polygon points={`${px - 7},${py} ${px + 7},${py} ${px},${py - 11}`} fill={mixHex(c, "#F4EDE6", 0.5)} />; })()}
          <Tree x={4.5} y={3.5} night={night} />
          <Lantern x={-5} y={4.5} night={night} />
        </>
      );
    }
    case "hell-gate-park": {
      const grass: BoxSpec = { ...isle, color: night ? "#5E8F86" : "#A8E0B8" };
      return (
        <>
          <Box b={grass} night={night} />
          {(() => { const [l, ly] = iso(-6, -3, 0); const [r, ry] = iso(6, -3, 0); const [mx, my] = iso(0, -3, 7); return (<g fill="none" stroke={night ? "#E8A0A0" : "#C9584A"} strokeWidth={2.4}><path d={`M${l} ${ly - 18} Q${mx} ${my - 4} ${r} ${ry - 18}`} />{[-4, -2, 0, 2, 4].map((x) => { const [px, py] = iso(x, -3, 0); return <line key={x} x1={px} y1={py - 14} x2={px} y2={py - 7} strokeWidth={1} />; })}<line x1={l} y1={ly - 8} x2={r} y2={ry - 8} strokeWidth={2.8} /></g>); })()}
          {(() => { const [fx, fy] = iso(0, 2.5, 0); return <ellipse cx={fx} cy={fy} rx={4 * S} ry={1.6 * S} fill={night ? "#3E6FA0" : "#9ED8F7"} opacity={0.9} />; })()}
          <Tree x={-5} y={4} night={night} />
          <Tree x={4.8} y={4.2} night={night} size={1.1} />
          <Tree x={5.2} y={0} night={night} size={0.8} />
          <Lantern x={-2} y={5.4} night={night} />
        </>
      );
    }
    case "rep-count": {
      const gym: BoxSpec = { x: -5.5, y: -4, z: 0, w: 10, d: 6, h: 4.6, color: mixHex(c, "#3A3540", 0.2) };
      return (
        <>
          {base}
          <Box b={gym} night={night}>
            <OnLeft b={gym} u={0.6} v={0.3} uw={8.8} vh={2.6} fill={night ? mixHex(a, lit, 0.4) : glassDark} opacity={0.9} />
            <SignLeft b={gym} text="Rep Count" color={a} ink="#FFFFFF" v={3.1} night={night} />
          </Box>
          {(() => { const [px, py] = iso(1.5, 3.8, 0); return (<g><rect x={px - 7} y={py - 4.6} width={14} height={1.2} rx={0.6} fill="#3A3540" />{[-7.5, 5.5].map((dx) => <rect key={dx} x={px + dx} y={py - 7} width={2} height={6} rx={0.6} fill={a} />)}</g>); })()}
          <Lantern x={-5} y={4.2} night={night} />
        </>
      );
    }
    case "astoria-blvd-station": {
      const deck: BoxSpec = { x: -6, y: -1.5, z: 4.5, w: 12, d: 3, h: 0.6, color: "#8E8A96" };
      const shelter: BoxSpec = { x: -2, y: -1.4, z: 5.1, w: 4, d: 2.8, h: 2, color: mixHex(a, "#E6E8EC", 0.6) };
      return (
        <>
          {base}
          {[-5, -1, 3].map((x) => { const [px, py] = iso(x, 0, 0); const [, ty] = iso(x, 0, 4.5); return <rect key={x} x={px - 1.2} y={ty} width={2.4} height={py - ty} fill="#6B6570" />; })}
          <Box b={deck} night={night} />
          <Box b={shelter} night={night}><OnLeft b={shelter} u={0.4} v={0.4} uw={3.2} vh={1.2} fill={night ? lit : glassDark} opacity={0.8} /></Box>
          {(() => { const [px, py] = iso(-4.5, 1.5, 5.1); return (<g><rect x={px - 0.5} y={py - 10} width={1} height={10} fill="#3A3540" /><circle cx={px} cy={py - 11.5} r={3} fill={a} /><text x={px} y={py - 9.8} fontSize={4} fontWeight={800} fill="#14111A" textAnchor="middle" fontFamily="system-ui, sans-serif">N</text></g>); })()}
          <Tree x={4.6} y={4.2} night={night} size={0.8} />
        </>
      );
    }
    case "reel-queens": {
      const hall: BoxSpec = { x: -5, y: -4, z: 0, w: 9, d: 6, h: 5.6, color: mixHex(a, "#7A1F3B", 0.45) };
      return (
        <>
          {base}
          <Box b={hall} night={night}>
            <OnLeft b={hall} u={2.6} v={0} uw={3.8} vh={2.3} fill={night ? lit : glassDark} opacity={0.9} />
            <OnLeft b={hall} u={0.4} v={2.6} uw={8.2} vh={1.5} fill={b} />
            <SignLeft b={hall} text="Now Showing" color={c} ink={b} v={2.7} night={night} />
            {Array.from({ length: 9 }).map((_, i) => <OnLeft key={i} b={hall} u={0.6 + i * 0.95} v={4.3} uw={0.3} vh={0.3} fill={night ? lit : "#FFE9B8"} />)}
          </Box>
          {(() => { const [px, py] = iso(4, -1, 5.6); return (<g><rect x={px - 2.6} y={py - 18} width={5.2} height={18} fill={a} />{["R", "E", "E", "L"].map((ch, i) => <text key={i} x={px} y={py - 14 + i * 4.2} fontSize={4} fontWeight={800} fill="#FFF6EE" textAnchor="middle" fontFamily="system-ui, sans-serif">{ch}</text>)}</g>); })()}
          <Lantern x={-5} y={4.4} night={night} />
        </>
      );
    }
    case "respawn-arena": {
      const arena: BoxSpec = { x: -5.5, y: -4.5, z: 0, w: 10, d: 7, h: 4.4, color: mixHex(c, a, 0.35) };
      return (
        <>
          {base}
          <Box b={arena} night={night}>
            <OnLeft b={arena} u={0.5} v={1.2} uw={9} vh={0.5} fill={b} />
            <OnLeft b={arena} u={3.8} v={0} uw={2.4} vh={2.2} fill={night ? b : "#2A2350"} />
            <SignLeft b={arena} text="Respawn Arena" color="#14111A" ink={b} v={2.4} night={night} />
            <OnRight b={arena} u={0.6} v={1} uw={5.8} vh={2.2} fill={night ? mixHex(a, lit, 0.3) : glassDark} opacity={0.85} />
          </Box>
          {(() => { const [px, py] = iso(-0.5, 0, 4.4); return (<g><rect x={px - 9} y={py - 10} width={18} height={9} rx={4.5} fill={b} /><circle cx={px - 4.5} cy={py - 5.5} r={1.4} fill={c} /><circle cx={px + 4} cy={py - 6.5} r={1} fill={c} /><circle cx={px + 5.6} cy={py - 4.8} r={1} fill={c} />{night && <circle cx={px} cy={py - 6} r={14} fill={b} opacity={0.25} filter="url(#mv-blur)" />}</g>); })()}
          <Lantern x={5} y={4} night={night} />
        </>
      );
    }
    // ---- Culture pack C2: Astoria food. Shopfronts for the slice shop, the taverna and the deli; carts under umbrellas. ----
    case "still-a-dollar-slice":
    case "feta-compli":
    case "schlep-and-schmear": {
      const sign = { "still-a-dollar-slice": "Still-a-Dollar", "feta-compli": "Feta Compli", "schlep-and-schmear": "Schlep & Schmear" }[place.id]!;
      const shop: BoxSpec = { x: -4.5, y: -4, z: 0, w: 7, d: 6, h: 4.8, color: mixHex(b, "#F4EDE6", 0.4) };
      const upper: BoxSpec = { x: -4.5, y: -4, z: 4.8, w: 7, d: 6, h: 2.6, color: mixHex("#B86A4A", c, 0.15) };
      return (
        <>
          {base}
          <Box b={shop} night={night}>
            <OnLeft b={shop} u={0.5} v={0} uw={4} vh={2.6} fill={night ? lit : glassDark} opacity={0.9} />
            <OnLeft b={shop} u={4.9} v={0} uw={1.6} vh={2.6} fill={mixHex(a, "#1F1B26", 0.35)} />
            {[0, 1, 2, 3, 4, 5, 6].map((i) => <OnLeft key={i} b={shop} u={i} v={2.75} uw={0.5} vh={0.8} fill={i % 2 ? "#FFFFFF" : a} />)}
            <SignLeft b={shop} text={sign} color={a} ink="#FFFFFF" v={3.6} night={night} />
          </Box>
          <Box b={upper} night={night}>{windowsLeft(upper, 1, 3, lit, glassDark, night)}{windowsRight(upper, 1, 2, lit, glassDark, night)}</Box>
          <Lantern x={3.8} y={3.2} night={night} />
          <Tree x={-5} y={4} night={night} size={0.8} />
        </>
      );
    }
    case "white-sauce-cart":
    case "boiled-and-beloved": {
      const cart: BoxSpec = { x: -2.2, y: -1.4, z: 0.8, w: 4.4, d: 2.8, h: 2.4, color: mixHex(b, "#E6E8EC", 0.3) };
      const pts = (z: number, r: number) => [[-r, -r], [r, -r], [r, r], [-r, r]].map(([x, y]) => iso(x, y, z).join(",")).join(" ");
      const [tx, ty] = iso(0, 0, 8.6);
      return (
        <>
          {base}
          {[[-1.8, -1], [1.8, -1], [-1.8, 1], [1.8, 1]].map(([x, y]) => { const [px, py] = iso(x, y, 0); return <circle key={`${x}${y}`} cx={px} cy={py - 1.6} r={1.6} fill="#3A3540" />; })}
          <Box b={cart} night={night}>
            <OnLeft b={cart} u={0.3} v={0.4} uw={3.8} vh={1.2} fill={night ? lit : "#FFFFFF"} opacity={0.85} />
          </Box>
          {(() => { const [px, py] = iso(0, 0, 3.2); return <rect x={px - 0.4} y={ty + 2} width={0.8} height={py - ty - 2} fill="#3A3540" />; })()}
          <polygon points={pts(7.2, 3.6)} fill={a} opacity={0.95} />
          {[[-3.6, -3.6], [3.6, -3.6], [3.6, 3.6], [-3.6, 3.6]].map(([x, y]) => { const [px, py] = iso(x, y, 7.2); return <line key={`${x}${y}`} x1={px} y1={py} x2={tx} y2={ty} stroke={c} strokeWidth={0.6} opacity={0.6} />; })}
          <Lantern x={-4.5} y={3.5} night={night} />
          <Tree x={4.6} y={4.2} night={night} size={0.8} />
        </>
      );
    }
    case "skybridge-tower":
    default: {
      const t1: BoxSpec = { x: -5.5, y: -4, z: 0, w: 4.2, d: 5, h: 8.5, color: mixHex(a, "#C9D2E8", 0.5) };
      const t2: BoxSpec = { x: 1.3, y: -4, z: 0, w: 4.2, d: 5, h: 6.5, color: mixHex(b, "#E8E2EE", 0.4) };
      const bridge: BoxSpec = { x: -1.3, y: -2.5, z: 4.2, w: 2.6, d: 2.2, h: 1.2, color: "#F2E6D8" };
      return (
        <>
          {base}
          <Box b={t1} night={night}>
            {windowsRight(t1, 4, 3, lit, glassDark, night)}
            {windowsLeft(t1, 4, 2, lit, glassDark, night)}
          </Box>
          <Box b={bridge} night={night}>
            <OnLeft b={bridge} u={0.3} v={0.3} uw={2.4} vh={0.8} fill={night ? lit : glassDark} />
          </Box>
          <Box b={t2} night={night}>
            {windowsRight(t2, 3, 3, lit, glassDark, night)}
            {windowsLeft(t2, 3, 2, lit, glassDark, night)}
          </Box>
          <Tree x={-0.2} y={4} night={night} size={0.9} />
          <Lantern x={4.5} y={4.5} night={night} />
        </>
      );
    }
  }
}

export function PlaceArt({ place, daytime }: { place: Place; daytime: boolean }) {
  const night = !daytime;
  const [s0, s1, s2] = sky(place, night);
  // Ids are unique per place and time so several illustrations can share a page.
  const skyId = `mv-sky-${place.id}-${night ? "n" : "d"}`;
  return (
    <svg viewBox="0 0 320 180" className="place-art" role="img" aria-label={`${place.name} illustration`}>
      <defs>
        <linearGradient id={skyId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={s0} />
          <stop offset="0.55" stopColor={s1} />
          <stop offset="1" stopColor={s2} />
        </linearGradient>
        <linearGradient id={`mv-shade-${night ? "n" : "d"}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity={night ? 0.06 : 0.18} />
          <stop offset="1" stopColor={night ? "#1B1640" : "#6E5BA8"} stopOpacity={night ? 0.25 : 0.14} />
        </linearGradient>
        <radialGradient id="mv-glow">
          <stop offset="0" stopColor="#FFD9A0" stopOpacity="0.7" />
          <stop offset="1" stopColor="#FFD9A0" stopOpacity="0" />
        </radialGradient>
        <filter id="mv-blur"><feGaussianBlur stdDeviation="2.4" /></filter>
      </defs>
      <rect width="320" height="180" fill={`url(#${skyId})`} />
      {/* soft distant motes, and stars at night */}
      {Array.from({ length: night ? 22 : 8 }).map((_, i) => (
        <rect key={i} x={(i * 71) % 320} y={(i * 37) % 70} width={night ? 1.4 : 2.4} height={night ? 1.4 : 2.4}
          fill="#FFFFFF" opacity={night ? 0.7 : 0.55} transform={`rotate(45 ${(i * 71) % 320} ${(i * 37) % 70})`} />
      ))}
      {/* the island's reflection on the haze below */}
      <ellipse cx={160} cy={172} rx={120} ry={10} fill={night ? "#0E0B24" : "#8E7CC8"} opacity={0.18} />
      <Scene place={themed(place)} night={night} />
    </svg>
  );
}
