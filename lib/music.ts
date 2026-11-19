// Background music (Clarifications section 11), generated live with the Web Audio API, so there is no licensed track
// at all. Several styles (owner, Nov 19; lib/musicStyles.ts) switch with a crossfade by where the player is
// (lib/musicMap.ts, `setScene`), and the Phone's Music app (components/phone/MusicApp.tsx) can pause, skip to another
// style and set the volume (kept on the device). Browsers block audio until a tap, so start() is called from a tap.
import { MUSIC_STYLES, MUSIC_STYLE_IDS, type MusicStyle, type MusicStyleId } from "./musicStyles.ts";

const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);
const on = (pattern: string, i: number) => pattern[i] === "x";
/** Master loudness at full volume; the default volume (0.5) is the old fixed level. */
const FULL = 0.32;

export interface MusicNow {
  style: MusicStyleId;
  name: string;
  /** True when the player skipped to a style; false while the place picks it. */
  picked: boolean;
  paused: boolean;
  muted: boolean;
  volume: number;
  playing: boolean;
}

interface Bus { gain: GainNode; filter: BiquadFilterNode }

class Music {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private buses = new Map<MusicStyleId, Bus>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextTime = 0;
  private step = 0;
  private muted = false;
  private paused = readLocal("cc_music_paused") === "1";
  private volume = clampVol(Number(readLocal("cc_music_volume") ?? 0.5));
  private started = false;
  /** What the place asks for, and what the player skipped to (wins until they go back to Auto). */
  private auto: MusicStyleId = "lofi";
  private pick: MusicStyleId | null = (MUSIC_STYLE_IDS as string[]).includes(readLocal("cc_music_pick") ?? "") ? readLocal("cc_music_pick") as MusicStyleId : null;
  private style: MusicStyleId = this.pick ?? "lofi";
  private listeners = new Set<() => void>();

  get isMuted() { return this.muted; }

  /** Starts the loop (no-op if already playing). Must run inside a user gesture. */
  start() {
    // iPhone: play as media, so the ring/silent switch doesn't mute the game (Safari 17+).
    try {
      const session = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
      if (session && session.type !== "playback") session.type = "playback";
    } catch { /* older browsers: nothing to set */ }
    if (this.started) {
      if (this.ctx && this.ctx.state !== "running") void this.ctx.resume().then(() => this.emit());
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.started = true;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.level();
    this.master.connect(ctx.destination);
    this.bus(this.style).gain.gain.value = MUSIC_STYLES[this.style].level;
    this.nextTime = ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 100);
    document.addEventListener("visibilitychange", this.onVisibility);
    void ctx.resume().then(() => this.emit());
    this.emit();
  }

  /** True once the browser lets the loop play (after a tap). */
  get playing() { return this.ctx?.state === "running"; }

  /**
   * Starts the music on a tap and keeps trying on later taps until it plays, and again after the
   * phone suspends it (iOS "interrupted"). Phones only allow audio from a finished tap (pointerup,
   * touchend, click), never from pointerdown. Returns the cleanup.
   */
  unlockOnTap(): () => void {
    const events = ["pointerup", "touchend", "click", "keydown"] as const;
    const tap = () => { if (!this.playing) this.start(); };
    for (const e of events) window.addEventListener(e, tap, { passive: true });
    return () => { for (const e of events) window.removeEventListener(e, tap); };
  }

  /** Steps the music back for a celebration (lib/sfx.ts fanfare and anthem), then swells back. */
  duck(seconds: number) {
    if (!this.ctx || !this.master || this.muted || this.paused) return;
    const t = this.ctx.currentTime, g = this.master.gain, full = this.level();
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(full * 0.25, t + 0.08); g.setValueAtTime(full * 0.25, t + seconds); g.linearRampToValueAtTime(full, t + seconds + 0.6);
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    this.fadeMaster();
    this.emit();
  }

  // ---- The Music app (owner, Nov 19: "skip, pause, change volume") ----

  now(): MusicNow {
    return { style: this.style, name: MUSIC_STYLES[this.style].name, picked: !!this.pick, paused: this.paused, muted: this.muted, volume: this.volume, playing: this.playing };
  }
  subscribe(fn: () => void): () => void { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }

  setPaused(paused: boolean) {
    this.paused = paused;
    writeLocal("cc_music_paused", paused ? "1" : "0");
    if (!paused) this.start();
    this.fadeMaster();
    this.emit();
  }

  setVolume(v: number) {
    this.volume = clampVol(v);
    writeLocal("cc_music_volume", String(this.volume));
    this.fadeMaster(0.08);
    this.emit();
  }

  /** The next style in the list (it plays everywhere until Auto). */
  skip(dir: 1 | -1 = 1) {
    const i = MUSIC_STYLE_IDS.indexOf(this.style);
    this.choose(MUSIC_STYLE_IDS[(i + dir + MUSIC_STYLE_IDS.length) % MUSIC_STYLE_IDS.length]);
  }
  /** Plays one style everywhere, or null: back to the place's own music. */
  choose(id: MusicStyleId | null) {
    this.pick = id;
    writeLocal("cc_music_pick", id ?? "");
    if (this.paused && id) this.setPaused(false);
    this.switchTo(id ?? this.auto);
  }

  /** Where the player is now picks the style (lib/musicMap.ts), unless they skipped to one. */
  setScene(id: MusicStyleId) {
    this.auto = id;
    if (!this.pick) this.switchTo(id);
  }

  private switchTo(id: MusicStyleId) {
    if (id === this.style) { this.emit(); return; }
    const from = this.style;
    this.style = id;
    if (this.ctx) {
      const t = this.ctx.currentTime;
      const old = this.bus(from).gain.gain, next = this.bus(id).gain.gain;
      old.cancelScheduledValues(t); old.setValueAtTime(old.value, t); old.linearRampToValueAtTime(0, t + 1.2);
      next.cancelScheduledValues(t); next.setValueAtTime(0, t); next.linearRampToValueAtTime(MUSIC_STYLES[id].level, t + 1.6);
      this.step = 0; // a new song starts from its first bar
    }
    this.emit();
  }

  private level() { return this.muted || this.paused ? 0 : FULL * this.volume; }
  private fadeMaster(seconds = 0.4) {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime, g = this.master.gain;
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(this.level(), t + seconds);
  }
  private emit() { for (const fn of this.listeners) fn(); }

  private bus(id: MusicStyleId): Bus {
    let b = this.buses.get(id);
    if (!b && this.ctx && this.master) {
      const gain = this.ctx.createGain();
      gain.gain.value = 0;
      const filter = this.ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = MUSIC_STYLES[id].filter;
      filter.connect(gain).connect(this.master);
      b = { gain, filter };
      this.buses.set(id, b);
    }
    return b!;
  }

  private onVisibility = () => {
    if (!this.ctx) return;
    if (document.hidden) void this.ctx.suspend();
    else void this.ctx.resume();
  };

  // Sixteenth-note scheduler with a short lookahead; while paused it keeps time but plays nothing.
  private schedule() {
    const ctx = this.ctx;
    if (!ctx) return;
    while (this.nextTime < ctx.currentTime + 0.3) {
      const st = MUSIC_STYLES[this.style];
      const sixteenth = 60 / st.bpm / 4;
      if (!this.paused && !this.muted) this.play(st, this.nextTime, sixteenth);
      this.nextTime += sixteenth;
      this.step++;
    }
  }

  private play(st: MusicStyle, t0: number, sixteenth: number) {
    const s = this.step % 64; // 4 bars of 16 sixteenths
    const bar = Math.floor(s / 16), pos = s % 16;
    const t = t0 + (pos % 2 === 1 ? st.swing * sixteenth : 0);
    const bus = this.bus(st.id).filter;
    const beat = sixteenth * 4;
    const chord = st.chords[bar % st.chords.length];
    const root = st.roots[bar % st.roots.length];
    // Chords
    if (st.chordMode.kind === "pad" && pos === 0) for (const n of chord) this.voice(bus, hz(n), t, beat * 4, st.chordWave, st.chordGain);
    if (st.chordMode.kind === "stab" && on(st.chordMode.steps, pos)) for (const n of chord) this.voice(bus, hz(n), t, sixteenth * 1.6, st.chordWave, st.chordGain);
    if (st.chordMode.kind === "arp") { const n = chord[pos % chord.length] + (pos >= 8 ? 12 : 0); this.voice(bus, hz(n), t, sixteenth * 0.9, st.chordWave, st.chordGain); }
    // Bass
    const b = st.bass[pos];
    if (b && b !== ".") {
      const semis = b === "c" ? 12 : parseInt(b, 10);
      this.voice(bus, hz(root + semis), t, st.bassDrop ? beat * 0.9 : pos === 0 && st.bass.slice(1, 4) === "..." ? beat * 1.5 : sixteenth * 1.8, st.bassWave, st.bassWave === "sawtooth" ? 0.07 : 0.2, st.bassDrop);
    }
    // Drums
    if (on(st.kick, pos)) this.kick(t);
    if (on(st.snare, pos)) this.noise(t, 0.12, 0.12, 1800, "bandpass");
    if (on(st.hat, pos)) this.noise(t, 0.035, pos % 4 === 2 ? 0.045 : 0.022, 8000, "highpass");
    if (st.open && on(st.open, pos)) this.noise(t, 0.14, 0.035, 6500, "highpass");
    // Lead
    if (on(st.leadSteps, pos) && (st.leadEvery === 1 || (this.step >> 6) % 2 === 1)) {
      const n = st.lead[(this.step >> 2) % st.lead.length];
      this.voice(bus, hz(n), t, beat * 0.9, st.leadWave, st.leadGain);
    }
  }

  private voice(out: AudioNode, freq: number, t: number, dur: number, type: OscillatorType, peak: number, drop = false) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(drop ? freq * 1.5 : freq, t);
    if (drop) osc.frequency.exponentialRampToValueAtTime(freq, t + 0.08);
    osc.detune.value = (Math.random() - 0.5) * 8;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    osc.connect(g).connect(out);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  private kick(t: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.18);
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc.connect(g).connect(this.bus(this.style).gain);
    osc.start(t);
    osc.stop(t + 0.32);
  }

  private noise(t: number, dur: number, gain: number, freq: number, type: BiquadFilterType) {
    const ctx = this.ctx!;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(f).connect(g).connect(this.bus(this.style).gain);
    src.start(t);
  }
}

function clampVol(v: number) { return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.5; }
function readLocal(k: string): string | null { try { return localStorage.getItem(k); } catch { return null; } }
function writeLocal(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* private mode: fine */ } }

let instance: Music | null = null;
export function music(): Music {
  instance ??= new Music();
  return instance;
}

const KEY = "cc_music_muted";
export function readLocalMuted(): boolean {
  try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
}
export function writeLocalMuted(muted: boolean) {
  try { localStorage.setItem(KEY, muted ? "1" : "0"); } catch { /* private mode: fine */ }
}
