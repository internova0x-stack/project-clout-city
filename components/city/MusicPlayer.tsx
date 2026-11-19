"use client";
// The game's music player (owner, Nov 19: "skip, pause, change volume", in the Radio app): what's playing now, pause,
// skip to another style (it then plays everywhere until Auto) and the volume, kept on this device (lib/music.ts).
import { useSyncExternalStore } from "react";
import { music, type MusicNow } from "@/lib/music";

const EMOJI: Record<MusicNow["style"], string> = { lofi: "🌙", pop: "🏙️", techno: "🪩", afrobeats: "🥁", romance: "🌹", synth: "🎛️" };

let cache: MusicNow | null = null;
const snapshot = () => {
  const n = music().now();
  if (!cache || Object.keys(n).some((k) => n[k as keyof MusicNow] !== cache![k as keyof MusicNow])) cache = n;
  return cache;
};
const server = (): MusicNow => ({ style: "lofi", name: "Lo-fi night", picked: false, paused: false, muted: false, volume: 0.5, playing: false });

export function MusicPlayer() {
  const n = useSyncExternalStore((fn) => music().subscribe(fn), snapshot, server);
  const m = music();
  const off = n.paused || n.muted;
  return (
    <div className="music-player" data-off={off || undefined}>
      <div className="music-now">
        <span className="music-art" aria-hidden="true">{EMOJI[n.style]}{!off && <span className="music-eq"><i /><i /><i /></span>}</span>
        <span className="music-text">
          <span className="overline">{n.muted ? "Music is off in Settings" : n.paused ? "Paused" : "Now playing"}</span>
          <span className="title">{n.name}</span>
          <span className="meta">{n.picked ? "Your pick, playing everywhere" : "Picked by where you are"}</span>
        </span>
      </div>
      <div className="music-controls">
        <button className="music-btn" aria-label="Previous style" onClick={() => m.skip(-1)}>⏮</button>
        <button className="music-btn big" aria-label={n.paused ? "Play" : "Pause"} onClick={() => { if (n.muted) m.setMuted(false); m.setPaused(!n.paused); }}>{n.paused ? "▶" : "⏸"}</button>
        <button className="music-btn" aria-label="Skip to the next style" onClick={() => m.skip(1)}>⏭</button>
      </div>
      <label className="music-volume">
        <span aria-hidden="true">🔈</span>
        <input type="range" min={0} max={100} step={1} value={Math.round(n.volume * 100)} aria-label="Music volume"
          onChange={(e) => m.setVolume(Number(e.target.value) / 100)} />
        <span aria-hidden="true">🔊</span>
      </label>
      {n.picked && <button className="music-auto" onClick={() => m.choose(null)}>↺ Back to the music for where you are</button>}
    </div>
  );
}
