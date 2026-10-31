// The Content Engine, step 5: people who remember you (docs/CONTENT-ENGINE.md section 9). content/characters/remembers.json
// holds lines a character says only to players whose memory fits (migration 0138: facts and the snapshot), with names
// filled in from that memory, like storylets: the deli owner who heard you were banned from {place}, the bartender who
// knows you just went official, the desk sergeant with your punch card. Tapping a regular plays one of them every few taps.
//
// Pure: the server (app/home/characterActions.ts), the preview and the validator run it.

import { characterById } from "./characters.ts";
import { fillSlots, fillText, storyletProblems, systemsOf, whenOk, type SlotDef, type When } from "./storylets.ts";
import type { Memory } from "./memory.ts";

export interface RememberRule {
  id: string;
  /** A character id from lib/characters.ts. */
  who: string;
  when: When;
  slots?: Record<string, SlotDef>;
  /** One is picked; {slot} names are filled from memory. */
  lines: string[];
}

export const REMEMBER = {
  /** A line can be at most this long with the longest names filled in (a speech bubble). */
  maxLength: 130,
  /** Up to this many remembered lines per character at once (the most specific first). */
  perCharacter: 3,
  /** Every Nth tap on a regular plays a remembered line (when there is one). */
  everyTaps: 3,
} as const;

/** Every rule: a known character, a condition over memory that the storylet rules accept, lines that fit. */
export function validateRemembers(rules: readonly RememberRule[]): string[] {
  const out: string[] = [];
  const ids = new Set<string>();
  for (const r of rules) {
    const at = `remember ${r.id}`;
    if (!/^[a-z0-9-]+$/.test(r.id ?? "")) out.push(`${at}: id must be lowercase-with-dashes`);
    if (ids.has(r.id)) out.push(`${at}: repeated id`);
    ids.add(r.id);
    if (!characterById(r.who)) out.push(`${at}: unknown character "${r.who}" (lib/characters.ts)`);
    if (!r.when?.all?.length && !r.when?.any?.length) out.push(`${at}: needs "when" (what they remember)`);
    if (!Array.isArray(r.lines) || r.lines.length === 0 || r.lines.length > 4) { out.push(`${at}: 1 to 4 lines`); continue; }
    for (const line of r.lines) {
      // The storylet rules check facts, snapshot paths, slots and lengths with the longest names; a line is checked as a title.
      out.push(...storyletProblems(at, { title: line, when: r.when, slots: r.slots, options: [] }).map((p) => p.replace(/title/g, "line")));
      if (line.length > REMEMBER.maxLength) out.push(`${at}: a line is at most ${REMEMBER.maxLength} characters`);
      if (/integrity|\bhalo\b|\bhustler\b/i.test(line)) out.push(`${at}: never name the meter`);
    }
  }
  return out;
}

/** What each character remembers about this player now: filled lines by character id, the most specific rules first. */
export function remembered(rules: readonly RememberRule[], memory: Memory | null, today: string, seed = 0): Record<string, string[]> {
  if (!memory) return {};
  const hits = rules
    .filter((r) => whenOk(r.when, memory, today))
    .map((r) => ({ r, fill: r.slots ? fillSlots(r.slots, memory) : { text: {}, raw: {} } }))
    .filter((x) => x.fill)
    .sort((a, b) => systemsOf(b.r.when).size - systemsOf(a.r.when).size);
  const out: Record<string, string[]> = {};
  for (const { r, fill } of hits) {
    const list = (out[r.who] ??= []);
    if (list.length >= REMEMBER.perCharacter) continue;
    list.push(fillText(r.lines[Math.abs(seed + list.length) % r.lines.length], fill!.text));
  }
  return out;
}

/** The line a regular says on tap `n`: a remembered one every few taps, when there is one. */
export function rememberedTap(lines: readonly string[] | undefined, n: number): string | null {
  if (!lines?.length || n % REMEMBER.everyTaps !== 0) return null;
  return lines[Math.floor(n / REMEMBER.everyTaps) % lines.length];
}
