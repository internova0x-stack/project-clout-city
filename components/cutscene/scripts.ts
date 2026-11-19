// The game's cutscenes (owner, Nov 19: "add cutscenes early in first play"; "Work on the cutscenes"): short scripted
// scenes with the game's own avatars on sets built from boxes (components/cutscene/sets.ts), played by CutscenePlayer.
// Each script says when its shots start and what the screen says, builds its set, and moves everyone for a time t.
import {
  BoxGeometry, Color, CylinderGeometry, DirectionalLight, Fog, Group, HemisphereLight, Mesh, MeshBasicMaterial, PlaneGeometry,
  PointLight, SphereGeometry, Sprite, type PerspectiveCamera, type Scene, type Vector3,
} from "three";
import { buildBaseAvatar } from "../avatar/baseAvatar";
import type { AvatarParts } from "../avatar/buildAvatar";
import { dance, resetLimbs } from "../room/Room3D";
import { DEFAULT_LOOK, HAIR_COLORS, SKIN_TONES, type Look } from "@/lib/look";
import { getStyle, starterOutfit, type Outfit } from "@/lib/styles";
import { ease, fireworks, glow, lerp, placer, risers, skyline, solid, v } from "./sets";

export interface Shot { at: number; place?: string; who?: string; line?: string }
export interface CutsceneCard { tag: string; title: string; names?: string; line: string; cta: string }
export interface Staged { ready: Promise<unknown>; stage(t: number, dt: number): void; dispose(): void; flash?(t: number): number }
export interface CutsceneScript {
  id: "arrival" | "party" | "official";
  end: number;
  shots: Shot[];
  /** A closing card (else the scene ends on its last frame and hands back). */
  card?: CutsceneCard & { at: number };
  build(scene: Scene, cam: PerspectiveCamera): Staged;
}

/** The player as the game dresses them. */
export interface Cast { look: Look; outfit?: Outfit; name?: string }

const avatar = (c: Cast) => buildBaseAvatar(c.look, { pedestal: false, outfit: c.outfit ?? starterOutfit(getStyle(c.look.style), c.look.body, c.look.fit ?? null) });
const extra = (body: "curvy" | "straight", i: number, style: string): Cast => ({
  look: { ...DEFAULT_LOOK, body, build: body === "curvy" ? "curvy" : "athletic", skin: SKIN_TONES[(i * 3 + 1) % 8], hair: body === "curvy" ? (i % 2 ? "ponytail" : "long") : (i % 2 ? "buzz" : "short"), hairColor: HAIR_COLORS[i % 3], covering: "none", style } as Look,
});
/** Each avatar rides in its own rig: the avatar's update() owns its root's position (the walk's bob). */
function rigOf(scene: Scene, p: AvatarParts) { const g = new Group(); g.add(p.root); scene.add(g); return g; }
/** Back to standing after a dance (the base bodies re-place themselves on their feet). */
function stand(p: AvatarParts) { resetLimbs(p); p.pose?.(null); }
const at = (shots: Shot[], t: number) => { const i = shots.findLastIndex((s) => t >= s.at); return { i, into: t - shots[Math.max(0, i)].at }; };

// ---------------------------------------------------------------------------------------------------------------------
// Arriving: the 7 train pulls into an elevated platform at dusk, you step off and look at the skyline.
export function arrivalScript(you: Cast): CutsceneScript {
  const shots: Shot[] = [
    { at: 0, place: "Queensboro Plaza · Day 1 · 7:12 PM" },
    { at: 4.2 },
    { at: 7.6, who: "Lola", line: "Welcome to New York. Nobody knows you. Yet." },
    { at: 11.4, who: you.name ?? "You", line: "Give me a year. Maybe a week." },
  ];
  return {
    id: "arrival", end: 17.5, shots,
    card: { at: 14.6, tag: "Day 1", title: "Welcome to Clout City", line: "Rent is due in a week. Clout is due forever.", cta: "Let's go" },
    build(scene, cam) {
      scene.background = new Color("#F08A5D");
      scene.fog = new Fog("#E9876A", 20, 70);
      scene.add(new HemisphereLight(0xffd2a8, 0x3a2a44, 1.0));
      const sun = new DirectionalLight(0xffb07a, 1.4); sun.position.set(8, 6, -10); scene.add(sun);
      const add = placer(scene);
      // A sunset gradient behind the skyline: three bands.
      for (const [y, c] of [[22, "#5B3A7A"], [14, "#C9567A"], [7, "#F2A35E"]] as const) add(new Mesh(new PlaneGeometry(200, 9), new MeshBasicMaterial({ color: c, fog: false })), 0, y, -60);
      add(new Mesh(new SphereGeometry(2.2, 18, 12), new MeshBasicMaterial({ color: "#FFE3A6", fog: false })), 6, 4.5, -58);
      // The platform: concrete, the yellow edge, a canopy on green columns, a railing on the city side.
      add(new Mesh(new BoxGeometry(22, 0.4, 4), solid("#8E8A86")), 0, -0.2, 0);
      add(new Mesh(new BoxGeometry(22, 0.02, 0.3), solid("#E8C33A")), 0, 0.01, 1.85);
      for (let x = -9; x <= 9; x += 4.5) add(new Mesh(new CylinderGeometry(0.09, 0.09, 3.2, 8), solid("#3F6B4E")), x, 1.6, -1.2);
      add(new Mesh(new BoxGeometry(22, 0.15, 3.4), solid("#3F6B4E")), 0, 3.25, -0.4);
      add(new Mesh(new BoxGeometry(22, 0.06, 0.06), solid("#3F6B4E")), 0, 1.0, -1.95);
      for (let x = -10; x <= 10; x += 1) add(new Mesh(new BoxGeometry(0.04, 1.0, 0.04), solid("#3F6B4E")), x, 0.5, -1.95);
      // A station sign.
      add(new Mesh(new BoxGeometry(2.4, 0.5, 0.06), solid("#14111A")), -3, 2.6, -1.15);
      const dot = add(new Mesh(new CylinderGeometry(0.17, 0.17, 0.02, 16), solid("#B933AD", "#B933AD", 0.4)), -3.9, 2.6, -1.11);
      dot.rotation.x = Math.PI / 2;
      // The tracks and the train (purple 7 train cars with lit windows).
      add(new Mesh(new BoxGeometry(60, 0.2, 2.6), solid("#4A4340")), 0, -0.6, 3.3);
      const train = new Group();
      for (let c = 0; c < 4; c++) {
        const car = new Mesh(new BoxGeometry(5.6, 2.4, 2.4), solid("#C9CDD3"));
        car.position.set(c * 5.8, 0.9, 0); train.add(car);
        const band = new Mesh(new BoxGeometry(5.62, 0.25, 2.42), solid("#B933AD")); band.position.set(c * 5.8, 0.2, 0); train.add(band);
        for (let w = -2; w <= 2; w++) { const win = new Mesh(new BoxGeometry(0.7, 0.6, 2.44), solid("#FFE7B0", "#FFD58A", 0.9)); win.position.set(c * 5.8 + w * 1.05, 1.35, 0); train.add(win); }
      }
      train.position.set(30, 0, 3.3); scene.add(train);
      skyline(scene, { count: 40, z: -34, base: -6, spread: 1.6, tall: 18 });
      const me = avatar(you);
      const rig = rigOf(scene, me);
      const stage = (t: number, dt: number) => {
        // The train glides in and stops with you in the open door; you step off, walk to the rail and turn round.
        const arrive = ease(t / 4);
        train.position.x = lerp(30, -2.9, arrive);
        const step = ease((t - 4.4) / 1.6), toRail = ease((t - 6.2) / 2.2);
        const x = lerp(0, 0.6, toRail), z = lerp(lerp(3.2, 1.2, step), -1.2, toRail);
        rig.position.set(x, step > 0 ? 0 : -9, z);
        me.setMotion?.((step > 0 && step < 1) || (toRail > 0 && toRail < 1) ? "walk" : "idle");
        const turn = ease((t - 11.2) / 0.9);
        rig.rotation.y = toRail < 1 ? Math.PI : lerp(Math.PI, 0, turn);
        if (t > 12.6 && t < 14.4) me.play?.("wave"); else me.play?.(null);
        me.update?.(dt);
        const { i, into } = at(shots, t);
        if (i <= 0) { cam.position.set(lerp(-6, -3, ease(into / 4)), 2.2, 9); cam.lookAt(lerp(6, 1, arrive), 1, 2); }
        else if (i === 1) { cam.position.set(3.4, 1.55, -0.9); cam.lookAt(x, 1.1, z); }
        else if (i === 2) { cam.position.set(x + lerp(0.4, 0.1, into / 3.8), 1.65, z + 2.6 - into * 0.15); cam.lookAt(x - 2, 3.2, -30); }
        else { cam.position.set(x + 0.5, 1.55, z + 2.3 - into * 0.08); cam.lookAt(x, 1.45, z); }
      };
      return { ready: Promise.resolve(me.ready), stage, dispose: () => me.dispose() };
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// The first party: Peyton Pastel's launch at Velvet Static. You sneak past the coat check and photobomb her selfie.
export function partyScript(you: Cast, host = "Peyton Pastel"): CutsceneScript {
  const shots: Shot[] = [
    { at: 0, place: "Velvet Static · 11:02 PM" },
    { at: 3.4, who: "Coat check", line: "Brittany? …Sure. Go on." },
    { at: 6.8, who: host, line: "Okay everyone, CONTENT. Say 'pastel'!" },
    { at: 10.2 },
  ];
  return {
    id: "party", end: 13.6, shots,
    build(scene, cam) {
      scene.background = new Color("#140E22");
      scene.fog = new Fog("#140E22", 10, 30);
      scene.add(new HemisphereLight(0x9f8cff, 0x140e22, 0.5));
      const add = placer(scene);
      // The room: a dark floor with a lit dance floor, walls, a small stage, the coat check by the door, a bar.
      add(new Mesh(new BoxGeometry(16, 0.2, 12), solid("#1E1830")), 0, -0.1, 0);
      const tiles: Mesh[] = [];
      for (let x = -3; x <= 3; x++) for (let z = -2; z <= 2; z++) {
        const m = add(new Mesh(new BoxGeometry(0.95, 0.04, 0.95), solid("#2A2140", "#FF8FC8", 0.4)), x, 0.02, z);
        tiles.push(m);
      }
      add(new Mesh(new BoxGeometry(16, 6, 0.3), solid("#241B38")), 0, 3, -6);
      add(new Mesh(new BoxGeometry(0.3, 6, 12), solid("#241B38")), -8, 3, 0);
      add(new Mesh(new BoxGeometry(4, 0.5, 2), solid("#3A2D58")), 0, 0.25, -4.6);
      add(new Mesh(new BoxGeometry(2.2, 1.1, 0.6), solid("#5B4A7A")), 5.4, 0.55, 3.4);   // the coat check
      add(new Mesh(new BoxGeometry(0.6, 1.1, 4), solid("#3A2D58")), -6.6, 0.55, 0);      // the bar
      // A neon sign and moving coloured lights.
      add(new Mesh(new BoxGeometry(5, 0.6, 0.05), solid("#FFB3DE", "#FF7FC8", 1.6)), 0, 4.2, -5.82);
      const lights = [["#FF7FC8", 0], ["#8FD8FF", 2.1], ["#C9A8FF", 4.2]].map(([c, ph]) => {
        const l = new PointLight(new Color(c as string), 14, 12, 1.4); scene.add(l); return { l, ph: ph as number };
      });
      const halo = glow("255,190,230");
      for (let i = 0; i < 8; i++) { const s = new Sprite(halo); s.scale.set(1.4, 1.4, 1); add(s, -7 + i * 2, 5.4, -5.5); }
      // The cast: you, the host on the stage with her phone, three dancers.
      const me = avatar(you);
      const peyton = avatar({ look: { ...extra("curvy", 4, "influencer_soft_glam").look, hairColor: "#F3C6E0" } as Look });
      const dancers = [extra("straight", 1, "bodega_drip"), extra("curvy", 2, "pilates_princess"), extra("straight", 3, "night_owl_goth")].map(avatar);
      const rigs = { me: rigOf(scene, me), peyton: rigOf(scene, peyton), dancers: dancers.map((d) => rigOf(scene, d)) };
      rigs.peyton.position.set(0, 0.5, -4.6);
      dancers.forEach((_, k) => { rigs.dancers[k].position.set([-1.8, 1.4, -0.2][k], 0, [0.6, -0.4, 1.6][k]); rigs.dancers[k].rotation.y = [0.6, -0.8, 2.6][k]; });
      const phone = new Mesh(new BoxGeometry(0.09, 0.17, 0.02), solid("#1B1B1F", "#BFE6FF", 0.6));
      rigs.peyton.add(phone); phone.position.set(0.3, 1.22, 0.38);
      const flashAt = shots[3].at + 0.5;
      const stage = (t: number, dt: number) => {
        const k = t * 0.9;
        lights.forEach(({ l, ph }) => l.position.set(Math.sin(k + ph) * 4, 3.4, Math.cos(k * 1.3 + ph) * 3));
        tiles.forEach((m, i) => { ((m.material as ReturnType<typeof solid>).emissiveIntensity = 0.25 + 0.6 * Math.max(0, Math.sin(t * 4 + i * 1.7))); });
        dancers.forEach((d, i) => { dance(d, t + i * 0.4, [0.01, 0.28, 0.42][i]); d.update?.(dt); });
        // You walk in from the door, past the coat check, to just behind the host's shoulder.
        const inn = ease((t - 2.4) / 3.6), up = ease((t - 7.6) / 2.2);
        const x = lerp(6.4, lerp(3.2, 0.55, up), Math.min(1, inn * 1.4)), z = lerp(5.2, lerp(2.4, -5.25, up), inn);
        rigs.me.position.set(x, up > 0.6 ? 0.5 * ease((up - 0.6) / 0.4) : 0, z);
        rigs.me.rotation.y = inn < 1 || up < 1 ? Math.atan2(0.55 - x, -5.25 - z) : 0.1;
        me.setMotion?.((inn > 0 && inn < 1) || (up > 0 && up < 1) ? "walk" : "idle");
        if (t > flashAt - 0.3 && t < flashAt + 1.6) me.play?.("wave"); else me.play?.(null);
        me.update?.(dt);
        // The host faces her phone, with the room behind her.
        rigs.peyton.rotation.y = -0.15;
        peyton.update?.(dt);
        const { i, into } = at(shots, t);
        if (i <= 0) { cam.position.set(lerp(7, 4, ease(into / 3.4)), 3.2, 9); cam.lookAt(0, 1.2, -1); }
        else if (i === 1) { cam.position.set(3.6, 1.6, 6.6); cam.lookAt(x, 1.2, z); }
        else if (i === 2) { cam.position.set(1.6, 1.7, -1.8); cam.lookAt(0.2, 1.5, -4.8); }
        else { cam.position.set(0.3, 1.45, -2.2); cam.lookAt(0.3, 1.3, -5.0); }
      };
      const flash = (t: number) => Math.max(0, 1 - Math.abs(t - flashAt) / 0.35);
      return { ready: Promise.all([me.ready, peyton.ready, ...dancers.map((d) => d.ready)]), stage, flash, dispose: () => { me.dispose(); peyton.dispose(); dancers.forEach((d) => d.dispose()); } };
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Going official: a rooftop at night, string lights, the skyline, a slow dance and fireworks.
export function officialScript(you: Cast, partner: Cast): CutsceneScript {
  const them = partner.name ?? "them";
  const shots: Shot[] = [
    { at: 0, place: "Ditmars Heights Rooftop · 11:48 PM" },
    { at: 3.5 },
    { at: 7, who: you.name ?? "You", line: "Three dates. So… what are we?" },
    { at: 10.5, who: them, line: "Honestly? Official. Lola's already typing." },
    { at: 14 },
  ];
  return {
    // No card of its own: the game's "It's official" celebration follows it (GameShell takeCouple).
    id: "official", end: 20.5, shots,
    build(scene, cam) {
      scene.background = new Color("#0E1430");
      scene.fog = new Fog("#0E1430", 18, 60);
      scene.add(new HemisphereLight(0x8aa0ff, 0x1a1420, 0.55));
      const moon = new DirectionalLight(0xb8c8ff, 0.6); moon.position.set(-6, 10, -8); scene.add(moon);
      const add = placer(scene);
      add(new Mesh(new BoxGeometry(14, 0.2, 10), solid("#3A3540")), 0, -0.1, 0);
      for (const [x, z, w, d] of [[0, -5, 14, 0.3], [-7, 0, 0.3, 10], [7, 0, 0.3, 10]] as const) add(new Mesh(new BoxGeometry(w, 0.9, d), solid("#5B4A52")), x, 0.45, z);
      const tower = new Group();
      const part = placer(tower);
      part(new Mesh(new CylinderGeometry(0.9, 0.9, 1.6, 12), solid("#6B4A33")), 0, 2.6, 0);
      for (const [x, z] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) part(new Mesh(new BoxGeometry(0.1, 1.8, 0.1), solid("#2B2228")), x, 0.9, z);
      tower.position.set(-4.6, 0, -3.2); scene.add(tower);
      add(new Mesh(new BoxGeometry(1.8, 0.45, 0.5), solid("#8A6A4A")), 3.4, 0.25, -3.8);
      const bulbMat = new MeshBasicMaterial({ color: "#FFD58A" });
      const halo = glow();
      for (const [z0, z1] of [[-4.6, -1], [-1, 2.6]] as const) for (let i = 0; i <= 14; i++) {
        const k = i / 14, x = lerp(-6.4, 6.4, k), y = 2.6 - Math.sin(k * Math.PI) * 0.7, z = lerp(z0, z1, 0.5);
        add(new Mesh(new SphereGeometry(0.06, 6, 5), bulbMat), x, y, z);
        const s = new Sprite(halo); s.scale.set(0.7, 0.7, 1); add(s, x, y, z);
      }
      const warm = new PointLight(0xffc47a, 6, 9, 1.6); warm.position.set(0, 2.2, -1); scene.add(warm);
      skyline(scene);
      add(new Mesh(new SphereGeometry(1.6, 16, 12), new MeshBasicMaterial({ color: "#FFF4D6", fog: false })), 9, 11, -40);
      const a = avatar(you), b = avatar(partner);
      const rigA = rigOf(scene, a), rigB = rigOf(scene, b);
      const fw = fireworks(scene);
      const hearts = risers(scene, "💖");
      const fired = new Set<number>();
      let wasDancing = false;
      const stage = (t: number, dt: number) => {
        const youAt = v(-0.55, 0, -1.6);
        const walk = ease((t - 3.6) / 3.2);
        rigA.position.copy(youAt);
        rigB.position.set(lerp(4.6, 0.6, walk), 0, lerp(1.8, -1.6, walk));
        rigA.rotation.y = lerp(Math.PI, Math.PI / 2, ease((t - 5.2) / 1.2));
        rigB.rotation.y = walk < 1 ? Math.atan2(0.6 - 4.6, -1.6 - 1.8) : -Math.PI / 2;
        b.setMotion?.(walk > 0 && walk < 1 ? "walk" : "idle");
        a.setMotion?.("idle");
        const dancing = t >= shots[4].at;
        // Reset the limbs only when a dance stops (resetLimbs every frame sinks the base bodies into the floor).
        if (dancing) { dance(a, t, 0.28); dance(b, t + 0.4, 0.14); wasDancing = true; } else if (wasDancing) { stand(a); stand(b); wasDancing = false; }
        if (t >= shots[3].at + 0.6 && t < shots[4].at) b.play?.("wave"); else if (!dancing) b.play?.(null);
        a.update?.(dt); b.update?.(dt);
        if (dancing) for (const [i, when, color] of [[0, 14.3, "#FF6FA3"], [1, 15.2, "#FFD58A"], [2, 16.0, "#9FD4FF"], [3, 16.9, "#B98CFF"], [4, 17.6, "#FF6FA3"]] as const) {
          if (t >= when && !fired.has(i)) { fired.add(i); fw.burst(v(-8 + i * 4, 10 + (i % 2) * 2, -26), color, t); }
        }
        fw.update(t, dt);
        hearts(dancing, t - shots[4].at, v(0, 1.4, -1.6));
        const { i, into } = at(shots, t);
        let pos: Vector3, look: Vector3;
        if (i <= 0) { pos = v(lerp(-2, 1.5, ease(into / 3.5)), lerp(6, 3.2, ease(into / 3.5)), lerp(12, 7, ease(into / 3.5))); look = v(0, 2.5, -14); }
        else if (i === 1) { pos = v(6.5, 1.6, 2.5 - into * 0.15); look = v(lerp(3, 0.4, ease(into / 3.5)), 1.1, -0.6); }
        else if (i === 2) { pos = v(1.9, 1.5, 0.9); look = v(-0.3, 1.2, -1.6); }
        else if (i === 3) { pos = v(-1.9, 1.5, 0.9); look = v(0.3, 1.2, -1.6); }
        else if (t < 18.5) { const k = into * 0.32; pos = v(Math.sin(k) * 4.5, 1.4 + into * 0.35, -1.6 + Math.cos(k) * 4.5); look = v(0, 1.4 + into * 0.25, -1.6); }
        else { pos = v(0, 4.5, 5.5); look = v(0, 3, -10); }
        cam.position.copy(pos); cam.lookAt(look);
      };
      return { ready: Promise.all([a.ready, b.ready]), stage, dispose: () => { a.dispose(); b.dispose(); } };
    },
  };
}

/** A partner's look from what the couple screen knows (their style; else a default New Yorker). */
export function partnerCast(p: { name: string; style?: string; look?: unknown } | null | undefined, yourBody: "curvy" | "straight"): Cast {
  const body = yourBody === "curvy" ? "straight" : "curvy";
  const base = extra(body, 2, p?.style || "bodega_drip");
  const l = p?.look && typeof p.look === "object" ? { ...base.look, ...(p.look as Partial<Look>) } as Look : base.look;
  return { look: l, name: p?.name };
}
