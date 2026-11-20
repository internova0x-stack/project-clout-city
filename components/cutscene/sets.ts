// Shared pieces for the cutscenes (components/cutscene): low-poly sets made from boxes, a skyline with lit windows,
// fireworks, glows and the easing helpers. Nothing here downloads anything.
import {
  AdditiveBlending, BoxGeometry, CanvasTexture, Color, Mesh, MeshBasicMaterial, MeshStandardMaterial, RepeatWrapping, SRGBColorSpace,
  SphereGeometry, Sprite, SpriteMaterial, Vector3, type Object3D, type Scene,
} from "three";

export const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
export const v = (x: number, y: number, z: number) => new Vector3(x, y, z);

export const solid = (color: string, emissive?: string, ei = 0) =>
  new MeshStandardMaterial({ color, roughness: 0.85, flatShading: true, emissive: emissive ?? "#000000", emissiveIntensity: ei });

export function placer(parent: Scene | Object3D) {
  return <T extends Object3D>(m: T, x: number, y: number, z: number) => { m.position.set(x, y, z); parent.add(m); return m; };
}

/** Lit windows (one texture, repeated per tower). */
export function windowsTexture(lit = 0.55): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  g.fillStyle = "#1B2140"; g.fillRect(0, 0, 64, 64);
  for (let y = 4; y < 64; y += 10) for (let x = 4; x < 64; x += 10) {
    if (Math.random() < lit) { g.fillStyle = Math.random() < 0.7 ? "#FFD58A" : "#9FD4FF"; g.fillRect(x, y, 5, 6); }
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace; t.wrapS = t.wrapT = RepeatWrapping;
  return t;
}

/** An emoji as a sprite texture (hearts, a camera flash). */
export function emojiTexture(emoji: string): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  g.font = "52px serif"; g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText(emoji, 32, 36);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

/** A soft round glow for lights. */
export function glow(color = "255,200,120"): SpriteMaterial {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, `rgba(${color},1)`); grad.addColorStop(1, `rgba(${color},0)`);
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  const t = new CanvasTexture(c);
  return new SpriteMaterial({ map: t, transparent: true, opacity: 0.6, blending: AdditiveBlending, depthWrite: false });
}

/** A skyline across the river: `count` towers along x at depth z, lit windows, from y = base. */
export function skyline(scene: Scene, opts: { count?: number; z?: number; base?: number; spread?: number; tall?: number } = {}) {
  const add = placer(scene);
  const win = windowsTexture();
  const n = opts.count ?? 46, z = opts.z ?? -22, base = opts.base ?? -4, spread = opts.spread ?? 1.35, tall = opts.tall ?? 13;
  for (let i = 0; i < n; i++) {
    const w = 1.2 + Math.random() * 2.2, h = 3 + Math.random() * tall, d = 1.5 + Math.random() * 2;
    const t = win.clone(); t.needsUpdate = true; t.repeat.set(Math.max(1, Math.round(w)), Math.max(1, Math.round(h / 2)));
    const m = new Mesh(new BoxGeometry(w, h, d), new MeshStandardMaterial({ map: t, emissiveMap: t, emissive: "#ffffff", emissiveIntensity: 0.85, roughness: 1 }));
    add(m, -n * spread / 2 + i * spread + Math.random() * 0.6, base + h / 2, z - Math.random() * 10);
  }
}

/** Fireworks: call burst() to fire one, update() each frame. */
export function fireworks(scene: Scene) {
  const geo = new SphereGeometry(0.12, 5, 4);
  const sparks: { m: Mesh; vel: Vector3; born: number }[] = [];
  return {
    burst(at: Vector3, color: string, t0: number) {
      for (let i = 0; i < 26; i++) {
        const m = new Mesh(geo, new MeshBasicMaterial({ color: new Color(color), transparent: true, blending: AdditiveBlending, depthWrite: false, fog: false }));
        m.position.copy(at); scene.add(m);
        const a = Math.random() * Math.PI * 2, b = Math.acos(2 * Math.random() - 1), sp = 3 + Math.random() * 2;
        sparks.push({ m, vel: v(Math.sin(b) * Math.cos(a) * sp, Math.cos(b) * sp, Math.sin(b) * Math.sin(a) * sp * 0.4), born: t0 });
      }
    },
    update(t: number, dt: number) {
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i], age = t - s.born;
        if (age > 2.2 || age < 0) { scene.remove(s.m); sparks.splice(i, 1); continue; }
        s.m.position.addScaledVector(s.vel, dt); s.vel.y -= 2.2 * dt;
        (s.m.material as MeshBasicMaterial).opacity = 1 - age / 2.2;
      }
    },
  };
}

/** Sprites that float up from a point (hearts, notes). */
export function risers(scene: Scene, emoji: string, count = 10) {
  const mat = new SpriteMaterial({ map: emojiTexture(emoji), transparent: true, depthWrite: false });
  const list = Array.from({ length: count }, (_, i) => { const s = new Sprite(mat.clone()); s.scale.set(0.35, 0.35, 1); s.visible = false; scene.add(s); return { s, seed: i }; });
  return (on: boolean, t: number, at: Vector3) => list.forEach(({ s, seed }) => {
    const age = t - seed * 0.35;
    s.visible = on && age > 0;
    if (!s.visible) return;
    const k = (age % 2.6) / 2.6;
    s.position.set(at.x + lerp(-0.6, 0.6, (seed % 5) / 4) + Math.sin(age * 3 + seed) * 0.15, at.y + k * 2.2, at.z + (seed % 2 ? 0.2 : -0.2));
    (s.material as SpriteMaterial).opacity = 1 - k;
  });
}
