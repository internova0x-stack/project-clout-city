// The sound kit (owner, Nov 3: "build with the reward sounds"; the Sound Lab and Celebrations artifacts). Every sound is
// synthesized live with the Web Audio API, like the music (lib/music.ts): no files, nothing licensed, and every note
// from the music's key (A C D E G), so a coin over any chord sounds right. Browsers allow audio only after a tap, so the
// context starts on the first one (`unlockSfx`). A device's choice lives in `cc-sfx-muted` (Settings → Sounds), apart
// from the music's switch; "reduce motion" doesn't silence sounds.
//   coin(step)  cash lands (each reward within 2 s climbs one note: the combo)
//   sparkle     clout lands
//   tick        a daily task done          jingle     a banner (rung 2)
//   fanfare     a takeover (rung 3), with a twist: chest (hunt), chimes (people), register (money)
//   anthem      a legend (rung 4)           heart      a friendship level

import { music } from "./music.ts";

type Twist = "chest" | "chimes" | "register" | "stamp";
const KEY = "cc-sfx-muted";
const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
// The five notes of the music's key, climbing from A4.
const PENTA = [69, 72, 74, 76, 79, 81, 84, 86, 88, 91, 93, 96, 98, 100];

let ctx: AudioContext | null = null;
let out: GainNode | null = null;
let mutedCache: boolean | null = null;
const lastAt: Record<string, number> = {};
let combo = { step: 0, at: 0 };

export function sfxMuted(): boolean {
  if (mutedCache !== null) return mutedCache;
  try { mutedCache = localStorage.getItem(KEY) === "1"; } catch { mutedCache = false; }
  return mutedCache;
}
export function setSfxMuted(m: boolean) {
  mutedCache = m;
  try { localStorage.setItem(KEY, m ? "1" : "0"); } catch { /* private mode */ }
}

function audio(): AudioContext | null {
  if (typeof window === "undefined" || sfxMuted()) return null;
  if (ctx) { if (ctx.state !== "running") void ctx.resume(); return ctx.state === "closed" ? null : ctx; }
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  try {
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    comp.connect(ctx.destination);
    out = ctx.createGain(); out.gain.value = 0.7; out.connect(comp);
    document.addEventListener("visibilitychange", () => { if (!ctx) return; if (document.hidden) void ctx.suspend(); else void ctx.resume(); });
  } catch { ctx = null; }
  return ctx;
}

/** Starts the context on the first finished tap (phones only allow audio from one). Returns the cleanup. */
export function unlockSfx(): () => void {
  const events = ["pointerup", "touchend", "click", "keydown"] as const;
  const tap = () => { if (!sfxMuted()) audio(); };
  for (const e of events) window.addEventListener(e, tap, { passive: true });
  return () => { for (const e of events) window.removeEventListener(e, tap); };
}

interface ToneOpts { type?: OscillatorType; gain?: number; attack?: number; glide?: number; detune?: number; dest?: AudioNode }
function tone(f: number, t: number, dur: number, o: ToneOpts = {}) {
  const c = ctx!, osc = c.createOscillator(), g = c.createGain();
  osc.type = o.type ?? "sine"; osc.frequency.setValueAtTime(f, t); osc.detune.value = o.detune ?? 0;
  if (o.glide) osc.frequency.exponentialRampToValueAtTime(o.glide, t + dur * 0.8);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(o.gain ?? 0.3, t + (o.attack ?? 0.005)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(o.dest ?? out!); osc.start(t); osc.stop(t + dur + 0.05);
}
const bell = (f: number, t: number, dur = 0.5, gain = 0.22) => { tone(f, t, dur, { gain }); tone(f * 2.76, t, dur * 0.45, { gain: gain * 0.35 }); tone(f * 5.4, t, dur * 0.2, { gain: gain * 0.12 }); };
function noise(t: number, dur: number, o: { gain?: number; freq?: number; q?: number; type?: BiquadFilterType; am?: number } = {}) {
  const c = ctx!, n = Math.max(1, Math.floor(c.sampleRate * dur)), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (o.am ? 0.55 + 0.45 * Math.sin((i / c.sampleRate) * o.am * 6.283) : 1);
  const s = c.createBufferSource(); s.buffer = buf;
  const f = c.createBiquadFilter(); f.type = o.type ?? "bandpass"; f.frequency.value = o.freq ?? 2000; f.Q.value = o.q ?? 1;
  const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(o.gain ?? 0.2, t + Math.min(0.03, dur / 3)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(out!); s.start(t); s.stop(t + dur + 0.02);
}
const click = (t: number, gain = 0.1, freq = 3200) => noise(t, 0.018, { gain, freq, q: 2 });
function chord(notes: number[], t: number, dur: number, gain = 0.04) {
  const c = ctx!, f = c.createBiquadFilter(); f.type = "lowpass";
  f.frequency.setValueAtTime(600, t); f.frequency.exponentialRampToValueAtTime(3000, t + 0.35); f.frequency.exponentialRampToValueAtTime(1400, t + dur); f.connect(out!);
  notes.forEach((n, i) => tone(hz(n), t + i * 0.015, dur, { type: "sawtooth", gain, attack: 0.06, dest: f, detune: i % 2 ? 7 : -7 }));
}
const thump = (t: number, gain = 0.5) => { tone(150, t, 0.35, { glide: 46, gain }); noise(t, 0.1, { gain: 0.2, freq: 900, q: 0.8 }); };

/** Plays one sound by name (silently skipped when muted, before a tap, or within 80 ms of the same sound). */
function play(name: string, fn: (t: number) => void) {
  const c = audio();
  if (!c) return;
  const now = performance.now();
  if (lastAt[name] && now - lastAt[name] < 80) return;
  lastAt[name] = now;
  try { fn(c.currentTime + 0.01); } catch { /* a sound never breaks the game */ }
}

const TWISTS: Record<Twist, (t: number) => void> = {
  chest: (t) => { tone(110, t + 0.02, 0.4, { glide: 170, type: "sawtooth", gain: 0.03 }); for (let i = 0; i < 10; i++) bell(hz(84 + (i % 5) * 2 + (i > 4 ? 12 : 0)), t + 0.9 + i * 0.04, 0.3, 0.05); },
  chimes: (t) => { ([[79, 0.95], [84, 1.15], [83, 1.35], [88, 1.55]] as const).forEach(([n, d]) => bell(hz(n), t + d, 0.8, 0.12)); },
  register: (t) => { noise(t + 0.95, 0.06, { gain: 0.2, freq: 3000, q: 3 }); bell(hz(96), t + 1, 0.6, 0.18); noise(t + 0.6, 1.6, { gain: 0.04, freq: 1200, q: 0.6, am: 7 }); },
  stamp: (t) => thump(t + 1.0, 0.35),
};

export const sfx = {
  /** Cash lands: a click and a two-note bell; rewards within 2 s climb the scale. */
  coin() {
    const now = performance.now();
    combo = { step: now - combo.at < 2000 ? Math.min(combo.step + 1, 6) : 0, at: now };
    const step = combo.step;
    play(`coin${step}`, (t) => { click(t, 0.08, 5000); bell(hz(PENTA[4 + step]), t + 0.01, 0.35, 0.2); bell(hz(PENTA[6 + step]), t + 0.075, 0.5, 0.18); });
  },
  sparkle() { play("sparkle", (t) => { [88, 91, 93, 96].forEach((n, i) => bell(hz(n), t + i * 0.045, 0.32, 0.11)); noise(t, 0.35, { gain: 0.04, freq: 9000, type: "highpass" }); }); },
  tick() { play("tick", (t) => { tone(520, t, 0.09, { glide: 1250, gain: 0.22 }); click(t + 0.005, 0.05, 2400); tone(hz(84), t + 0.05, 0.18, { gain: 0.07, type: "triangle" }); }); },
  heart() { play("heart", (t) => { tone(hz(72), t, 0.16, { glide: hz(76), gain: 0.2, type: "triangle" }); tone(hz(79), t + 0.12, 0.28, { glide: hz(84), gain: 0.2, type: "triangle" }); [91, 93, 96].forEach((n, i) => bell(hz(n), t + 0.2 + i * 0.05, 0.25, 0.06)); }); },
  /** Rung 2, the banner: three notes up the scale. */
  jingle() { play("jingle", (t) => { [76, 79, 84].forEach((n, i) => { tone(hz(n), t + i * 0.09, 0.3, { type: "triangle", gain: 0.18 }); bell(hz(n + 12), t + i * 0.09, 0.25, 0.05); }); }); },
  /** Rung 3, the takeover: a stamp, da-da-da DAAA, the chord opening; the music steps back. */
  fanfare(twist?: Twist) {
    play("fanfare", (t) => {
      music().duck(2);
      thump(t, 0.4);
      ([[67, 0.1], [72, 0.22], [76, 0.34]] as const).forEach(([n, d]) => tone(hz(n), t + d, 0.16, { type: "triangle", gain: 0.13 }));
      tone(hz(79), t + 0.48, 0.9, { type: "triangle", gain: 0.15 });
      chord([48, 55, 60, 64, 67, 72], t + 0.48, 1.5);
      noise(t + 0.48, 1.2, { gain: 0.06, freq: 7000, type: "highpass" });
      [88, 91, 96].forEach((n, i) => bell(hz(n), t + 0.7 + i * 0.08, 0.5, 0.07));
      if (twist) TWISTS[twist](t);
    });
  },
  /** Rung 4, the legend: a drum roll, a crash and a short original anthem; the music steps back longer. */
  anthem() {
    play("anthem", (t) => {
      music().duck(6);
      for (let i = 0; i < 18; i++) noise(t + i * 0.045, 0.05, { gain: 0.03 + i * 0.004, freq: 1500, q: 0.7 });
      thump(t + 0.85, 0.5); noise(t + 0.85, 1.8, { gain: 0.1, freq: 7000, type: "highpass" });
      ([[72, 0.85, 0.35], [76, 1.2, 0.35], [79, 1.55, 0.6], [77, 2.15, 0.3], [76, 2.45, 0.3], [74, 2.75, 0.5], [79, 3.3, 0.35], [83, 3.65, 0.35], [84, 4.0, 1.2]] as const)
        .forEach(([n, d, l]) => { tone(hz(n), t + d, l, { type: "triangle", gain: 0.15 }); tone(hz(n + 12), t + d, l, { gain: 0.05 }); });
      chord([48, 55, 60, 64, 67, 72, 76], t + 4.0, 1.8);
    });
  },
};
export type SfxTwist = Twist;
