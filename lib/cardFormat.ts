// The Content Engine, step 7: one card format (docs/CONTENT-ENGINE.md section 5; owner, Oct 31: "next"). The game has three
// kinds of situation card: Moral Choices cards (lib/choices.ts), campaign situations (lib/campaign.ts) and career tasks
// (lib/careers.ts). Each keeps its own engine and effects, but they now share one face and one way of reacting to memory:
//   * the face: an emoji, a one-line situation, 2 to 4 options with a label, You get and It costs (never a risk label,
//     never the meter's name), checked by `faceProblems` for all three;
//   * the storylet gate: `when` (conditions over the player's memory, migration 0138) and `slots` (names filled from it),
//     so a career task can know about your feud and a campaign can dig up your firing. The server works out which gated
//     cards a player has unlocked (`unlockedCards`) and hands the engines only the ids and the filled names.
//
// Pure: the validators, the servers and the tests run it.

import { fillSlots, storyletProblems, whenOk, type SlotDef, type When } from "./storylets.ts";
import type { Memory } from "./memory.ts";

/** What every situation card shows a player. */
export interface CardFace {
  emoji: string;
  title: string;
  options: { id: string; label: string; get: string; cost: string }[];
}

/** A storylet gate any card may carry. */
export interface CardGate { id: string; when?: When; slots?: Record<string, SlotDef> }

export const FACE = {
  title: 160,
  label: 40,
  getCost: 60,
  options: { min: 2, max: 4 },
  /** Owner, Oct 30-31: previews show You get and It costs only. */
  forbidden: ["risk", "riskWhy", "comesBack", "why", "later"],
} as const;

/** The shared face rules (each kind adds its own: Moral Choices titles stay at 110). */
export function faceProblems(at: string, face: CardFace & { options: Record<string, unknown>[] }, opts: { allowRiskFields?: boolean } = {}): string[] {
  const out: string[] = [];
  if (!face.emoji) out.push(`${at}: needs an emoji`);
  if (!face.title || face.title.length > FACE.title) out.push(`${at}: title must be 1 to ${FACE.title} characters`);
  if (!Array.isArray(face.options) || face.options.length < FACE.options.min || face.options.length > FACE.options.max) {
    out.push(`${at}: needs ${FACE.options.min} to ${FACE.options.max} options`);
    return out;
  }
  const ids = new Set<string>();
  for (const o of face.options as unknown as CardFace["options"]) {
    const ot = `${at} option ${o.id}`;
    if (!o.id || ids.has(o.id)) out.push(`${ot}: missing or repeated id`);
    ids.add(o.id);
    if (!o.label || o.label.length > FACE.label) out.push(`${ot}: label must be 1 to ${FACE.label} characters`);
    if (!o.get || o.get.length > FACE.getCost) out.push(`${ot}: "get" must be 1 to ${FACE.getCost} characters`);
    if (!o.cost || o.cost.length > FACE.getCost) out.push(`${ot}: "cost" must be 1 to ${FACE.getCost} characters`);
    if (!opts.allowRiskFields) for (const f of FACE.forbidden) if (f in (o as object)) out.push(`${ot}: no "${f}" (cards show You get and It costs only)`);
  }
  if (/integrity|\bhalo\b|\bhustler\b/i.test(JSON.stringify([face.title, (face.options as unknown as CardFace["options"]).map((o) => [o.label, o.get, o.cost])]))) {
    out.push(`${at}: name the real cost, never the meter`);
  }
  return out;
}

/** A gate's own rules: facts and snapshot paths exist, slots read what `when.all` requires, texts fit with the longest names. */
export function gateProblems(at: string, gate: CardGate, texts: { title: string; more?: string[] }): string[] {
  if (!gate.when && !gate.slots) return [];
  const out = storyletProblems(at, { title: texts.title, when: gate.when, slots: gate.slots, options: [] });
  for (const t of texts.more ?? []) {
    out.push(...storyletProblems(at, { title: t, when: gate.when, slots: gate.slots, options: [] })
      .filter((p) => !/title is over|title must/.test(p)).map((p) => p.replace(/title/g, "text")));
  }
  if (gate.slots && !gate.when?.all?.length) out.push(`${at}: slots need "when.all"`);
  return [...new Set(out)];
}

/** The gated cards this player has unlocked now, each with its filled names (an ungated card is never listed). */
export function unlockedCards(cards: readonly CardGate[], memory: Memory | null, today: string): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  if (!memory) return out;
  for (const c of cards) {
    if (!c.when && !c.slots) continue;
    if (!whenOk(c.when, memory, today)) continue;
    const fill = c.slots ? fillSlots(c.slots, memory) : { text: {}, raw: {} };
    if (fill) out[c.id] = fill.text;
  }
  return out;
}

/** Fills {slot} names (without importing the storylet engine, so lib/careers.ts and lib/campaign*.ts stay standalone). */
export const fillNames = (t: string, names: Record<string, string> | undefined) =>
  names ? t.replace(/\{([a-z_]+)\}/g, (all, k: string) => names[k] ?? all) : t;
