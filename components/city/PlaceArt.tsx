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
    : { top: mixHex(base, "#FFF6EE", 0.45), warm: mixHex(base, "#FFC3A8", 0.18), cool: mixHex(base, "#8E7CC8", 0.38) };
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

function sky(place: Place, night: boolean): [string, string, string] {
  const [a, b] = place.palette;
  return night
    ? [mixHex(b, "#1B1640", 0.7), mixHex(a, "#2E2A5C", 0.6), mixHex(a, "#8E5AA8", 0.55)]
    : [mixHex(b, "#FFF6EE", 0.78), mixHex(a, "#FCE6DA", 0.72), mixHex(a, "#C9B6E8", 0.6)];
}

/** Each place as a floating island scene. */
function Scene({ place, night }: { place: Place; night: boolean }) {
  const [a, b, c] = place.palette;
  const isle: BoxSpec = { x: -6, y: -6, z: -1, w: 12, d: 12, h: 1, color: night ? "#B8A8D8" : "#F2D6CF" };
  const lit = "#FFE2A8";
  const glassDark = night ? "#2A2350" : "#9FB6D8";
  const base = <Box b={isle} night={night} />;
  switch (place.id) {
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
    case "lucky-seven-deli": {
      const deli: BoxSpec = { x: -5, y: -4, z: 0, w: 8, d: 6, h: 5, color: "#E9E2D0" };
      const upper: BoxSpec = { x: -5, y: -4, z: 5, w: 8, d: 6, h: 2.8, color: mixHex("#C97F5A", c, 0.1) };
      return (
        <>
          {base}
          <Box b={deli} night={night}>
            <OnLeft b={deli} u={0.5} v={0} uw={4.6} vh={2.7} fill={night ? lit : glassDark} opacity={0.9} />
            <OnLeft b={deli} u={5.5} v={0} uw={1.8} vh={2.7} fill={mixHex(a, "#1F1B26", 0.35)} />
            <OnLeft b={deli} u={0} v={2.9} uw={8} vh={1} fill={a} />
            <OnRight b={deli} u={0.5} v={0.6} uw={5} vh={2.2} fill={night ? lit : glassDark} opacity={0.75} />
            <SignLeft b={deli} text="Open 24 hrs" color={b} ink="#14111A" v={3.9} night={night} />
          </Box>
          <Box b={upper} night={night}>
            {windowsLeft(upper, 1, 3, lit, glassDark, night)}
            {windowsRight(upper, 1, 2, lit, glassDark, night)}
          </Box>
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
      <Scene place={place} night={night} />
    </svg>
  );
}
