// The game's music styles (owner, Nov 19: "one soundtrack… explore lo-fi hip-hop, electronic, pop, techno, afrobeats…
// melodious"). Every style is composed here as data and played live by lib/music.ts with the Web Audio API: no files,
// no licences, nothing to download. lib/musicMap.ts picks one for where the player is.
//
// Patterns are 16 steps a bar (sixteenth notes): "x" plays, "." rests; a bass pattern's digits are semitones above the
// bar's root ("0" the root, "7" the fifth, "c" an octave up).

export type MusicStyleId = "lofi" | "pop" | "techno" | "afrobeats" | "romance" | "synth";

export interface MusicStyle {
  id: MusicStyleId;
  /** What the player hears, for the Settings line ("Now playing"). */
  name: string;
  bpm: number;
  /** One chord a bar (MIDI notes), looped. */
  chords: number[][];
  /** The bass's root for each bar (MIDI). */
  roots: number[];
  bass: string;
  bassWave: OscillatorType;
  /** Log-drum style bass: each note drops in pitch (afrobeats). */
  bassDrop?: boolean;
  kick: string;
  snare: string;
  hat: string;
  /** An open hat or shaker on top (techno's offbeat, afrobeats' shaker). */
  open?: string;
  /** How the chords play: a long pad each bar, a short stab on the given steps, or a 16th-note arpeggio. */
  chordMode: { kind: "pad" } | { kind: "stab"; steps: string } | { kind: "arp" };
  chordWave: OscillatorType;
  chordGain: number;
  /** The lead line: notes in order, played on the steps marked in `leadSteps`, every other 4 bars when `leadEvery` is 2. */
  lead: number[];
  leadSteps: string;
  leadWave: OscillatorType;
  leadGain: number;
  leadEvery: 1 | 2;
  /** The low-pass filter over the style (lower is warmer). */
  filter: number;
  /** Late off-beat sixteenths for a lazy feel, 0 to 0.3 of a sixteenth. */
  swing: number;
  /** Overall loudness, so the styles sit level with each other. */
  level: number;
}

const rep = (s: string, n = 1) => s.repeat(n);

export const MUSIC_STYLES: Record<MusicStyleId, MusicStyle> = {
  // The original night loop (Clarifications section 11): Am9, Dm9, Gsus/G, Cmaj9.
  lofi: {
    id: "lofi", name: "Lo-fi night", bpm: 84,
    chords: [[57, 60, 64, 67, 71], [50, 57, 60, 64, 65], [55, 60, 62, 65, 67], [48, 55, 59, 62, 64]],
    roots: [45, 38, 43, 36],
    bass: "0.........7.....", bassWave: "sine",
    kick: "x.........x.....", snare: "....x.......x...", hat: rep("x.", 8),
    chordMode: { kind: "pad" }, chordWave: "triangle", chordGain: 0.05,
    lead: [76, 74, 72, 71, 72, 69, 67, 69, 71, 72, 74, 76, 74, 72, 69, 67], leadSteps: "..x...x...x...x.", leadWave: "sine", leadGain: 0.06, leadEvery: 2,
    filter: 1800, swing: 0.18, level: 1,
  },
  // Bright city pop for walking the map: C, G, Am, F.
  pop: {
    id: "pop", name: "City pop", bpm: 112,
    chords: [[60, 64, 67, 72], [55, 59, 62, 67], [57, 60, 64, 69], [53, 57, 60, 65]],
    roots: [36, 43, 45, 41],
    bass: "0.0.c.0.0.0.c.7.", bassWave: "triangle",
    kick: "x...x...x...x...", snare: "....x.......x...", hat: "..x...x...x...x.",
    chordMode: { kind: "stab", steps: "x..x..x...x..x.." }, chordWave: "triangle", chordGain: 0.045,
    lead: [72, 74, 76, 79, 76, 74, 72, 67, 69, 72, 74, 72, 69, 67, 65, 67], leadSteps: "x.x...x.x.x...x.", leadWave: "square", leadGain: 0.022, leadEvery: 2,
    filter: 2600, swing: 0, level: 0.85,
  },
  // Four on the floor for the clubs: A minor stabs, a rolling bass, the offbeat open hat.
  techno: {
    id: "techno", name: "Club techno", bpm: 124,
    chords: [[57, 60, 64], [57, 60, 64], [55, 60, 62], [53, 57, 60]],
    roots: [33, 33, 31, 29],
    bass: "..0.0.0...0.0.c.", bassWave: "sawtooth",
    kick: "x...x...x...x...", snare: "....x.......x...", hat: rep("x", 16), open: "..x...x...x...x.",
    chordMode: { kind: "stab", steps: "......x.......x." }, chordWave: "sawtooth", chordGain: 0.03,
    lead: [69, 72, 76, 72, 69, 72, 76, 79, 81, 79, 76, 72, 69, 67, 69, 72], leadSteps: "x.x.x.x.x.x.x.x.", leadWave: "square", leadGain: 0.014, leadEvery: 2,
    filter: 1300, swing: 0, level: 0.8,
  },
  // Afrobeats for parties: Bbmaj7, Am7, Gm7, C; the 3-3-2 kick, a shaker and a dropping log-drum bass.
  afrobeats: {
    id: "afrobeats", name: "Afrobeats party", bpm: 104,
    chords: [[58, 62, 65, 69], [57, 60, 64, 67], [55, 58, 62, 65], [48, 55, 60, 64]],
    roots: [46, 45, 43, 48],
    bass: "0.....0...7.0...", bassWave: "sine", bassDrop: true,
    kick: "x..x..x...x..x..", snare: "....x..x....x...", hat: rep("x", 16), open: "..x...x...x...x.",
    chordMode: { kind: "stab", steps: "..x..x....x..x.." }, chordWave: "triangle", chordGain: 0.04,
    lead: [77, 74, 72, 74, 77, 79, 77, 74, 72, 69, 72, 74, 72, 69, 67, 69], leadSteps: "x..x..x.x..x..x.", leadWave: "sine", leadGain: 0.05, leadEvery: 1,
    filter: 2200, swing: 0.12, level: 0.9,
  },
  // Slow and melodic for dates, rooftops and the waterfront: Cmaj9, Am9, Fmaj9, G6, with a bell on top.
  romance: {
    id: "romance", name: "Rooftop slow jam", bpm: 70,
    chords: [[48, 55, 59, 62, 64], [45, 52, 55, 59, 60], [41, 48, 52, 55, 57], [43, 50, 55, 59, 64]],
    roots: [36, 33, 29, 31],
    bass: "0.......7.......", bassWave: "sine",
    kick: "x.......x.......", snare: "................", hat: "....x.......x...",
    chordMode: { kind: "pad" }, chordWave: "triangle", chordGain: 0.055,
    lead: [79, 76, 74, 72, 76, 74, 72, 69, 72, 74, 76, 79, 81, 79, 76, 74], leadSteps: "x...x...x...x...", leadWave: "sine", leadGain: 0.07, leadEvery: 1,
    filter: 1600, swing: 0.1, level: 1.05,
  },
  // Electronic for offices, studios and Campaign HQ: Em, C, G, D under a 16th-note arpeggio.
  synth: {
    id: "synth", name: "Office electronica", bpm: 100,
    chords: [[52, 55, 59, 64], [48, 52, 55, 60], [55, 59, 62, 67], [50, 54, 57, 62]],
    roots: [40, 36, 43, 38],
    bass: "0.0.0.0.0.0.0.7.", bassWave: "sawtooth",
    kick: "x...x...x...x...", snare: "....x.......x...", hat: "..x...x...x...x.",
    chordMode: { kind: "arp" }, chordWave: "sawtooth", chordGain: 0.022,
    lead: [76, 79, 83, 81, 79, 76, 74, 76, 79, 76, 74, 71, 72, 74, 76, 74], leadSteps: "x.......x.......", leadWave: "triangle", leadGain: 0.05, leadEvery: 2,
    filter: 1500, swing: 0, level: 0.85,
  },
};

export const MUSIC_STYLE_IDS = Object.keys(MUSIC_STYLES) as MusicStyleId[];
