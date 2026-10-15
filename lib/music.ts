// Background music (Clarifications section 11): an original lo-fi night loop,
// generated live with the Web Audio API, so there is no licensed track at all.
// Browsers block audio until a tap, so start() is called from the first tap.

const BPM = 84;
const BEAT = 60 / BPM;
// Am9, Dm9, Gsus/G, Cmaj9: one bar each.
const CHORDS: number[][] = [
  [57, 60, 64, 67, 71],
  [50, 57, 60, 64, 65],
  [55, 60, 62, 65, 67],
  [48, 55, 59, 62, 64],
];
const BASS = [45, 38, 43, 36];
const MELODY = [76, 74, 72, 71, 72, 69, 67, 69, 71, 72, 74, 76, 74, 72, 69, 67];

const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

class Music {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextTime = 0;
  private step = 0;
  private muted = false;
  private started = false;

  get isMuted() { return this.muted; }

  /** Starts the loop (no-op if already playing). Must run inside a user gesture. */
  start() {
    // iPhone: play as media, so the ring/silent switch doesn't mute the game (Safari 17+).
    try {
      const session = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
      if (session && session.type !== "playback") session.type = "playback";
    } catch { /* older browsers: nothing to set */ }
    if (this.started) {
      if (this.ctx && this.ctx.state !== "running") void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.started = true;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.16;
    this.filter = ctx.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.frequency.value = 1800;
    this.filter.connect(this.master).connect(ctx.destination);
    this.nextTime = ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 100);
    document.addEventListener("visibilitychange", this.onVisibility);
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

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.ctx && this.master) {
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.linearRampToValueAtTime(muted ? 0 : 0.16, this.ctx.currentTime + 0.4);
    }
  }

  private onVisibility = () => {
    if (!this.ctx) return;
    if (document.hidden) void this.ctx.suspend();
    else void this.ctx.resume();
  };

  // Sixteenth-note scheduler with a short lookahead.
  private schedule() {
    const ctx = this.ctx;
    if (!ctx || !this.filter) return;
    const sixteenth = BEAT / 4;
    while (this.nextTime < ctx.currentTime + 0.3) {
      const s = this.step % 64; // 4 bars of 16 sixteenths
      const bar = Math.floor(s / 16);
      const pos = s % 16;
      const t = this.nextTime;
      if (pos === 0) {
        for (const n of CHORDS[bar]) this.voice(hz(n), t, BEAT * 4, "triangle", 0.05);
        this.voice(hz(BASS[bar]), t, BEAT * 1.5, "sine", 0.22);
      }
      if (pos === 10) this.voice(hz(BASS[bar] + 7), t, BEAT, "sine", 0.14);
      if (pos === 0 || pos === 10) this.kick(t);
      if (pos === 4 || pos === 12) this.snap(t);
      if (pos % 2 === 0) this.hat(t, pos % 4 === 2 ? 0.05 : 0.025);
      if (pos % 4 === 2 && (this.step >> 4) % 2 === 1) {
        const note = MELODY[(this.step >> 2) % MELODY.length];
        this.voice(hz(note), t, BEAT * 0.9, "sine", 0.06);
      }
      this.nextTime += sixteenth;
      this.step++;
    }
  }

  private voice(freq: number, t: number, dur: number, type: OscillatorType, peak: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    osc.detune.value = (Math.random() - 0.5) * 8;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    osc.connect(g).connect(this.filter!);
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
    osc.connect(g).connect(this.master!);
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
    src.connect(f).connect(g).connect(this.master!);
    src.start(t);
  }

  private hat(t: number, gain: number) { this.noise(t, 0.04, gain, 8000, "highpass"); }
  private snap(t: number) { this.noise(t, 0.12, 0.12, 1800, "bandpass"); }
}

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
