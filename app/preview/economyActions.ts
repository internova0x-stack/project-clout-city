"use server";

import { previewOnly } from "./guard";
import { PLAYER_ECONOMY, type EconomyAdmin, type EconomyPhase, type FlagOutcome } from "@/lib/playerEconomy";

// The Player Economy in /preview/studio → Economy (migration 0151): sample flags and a frozen account, in memory on the dev
// server (the same shapes admin_economy returns). Nothing is saved.

const iso = (hoursAgo: number) => new Date(Date.now() - hoursAgo * 3_600_000).toISOString();
const days = (n: number) => iso(n * 24);
let store: EconomyAdmin | null = null;

function data(): EconomyAdmin {
  store ??= {
    settings: JSON.parse(JSON.stringify(PLAYER_ECONOMY)),
    week: { start: new Date(Date.now() - ((new Date().getDay() + 6) % 7) * 86_400_000).toISOString().slice(0, 10), transfers: 41, value: 38_450, fees: 912, gifts: 27, jobs: 14 },
    flags: [
      { id: 3, rule: "repeat_pair", ref: "pair:a:b", detail: { transfers: 4 }, status: "open", outcome: null, note: null, createdAt: iso(2), reviewedAt: null,
        players: [{ id: "p-moneybags", name: "moneybags.alt", joined: days(9), frozen: false }, { id: "p-mainchar", name: "main.character", joined: days(40), frozen: false }] },
      { id: 2, rule: "trivial_jobs", ref: "trivial:c:d", detail: { jobs: 2 }, status: "open", outcome: null, note: null, createdAt: iso(7), reviewedAt: null,
        players: [{ id: "p-lex", name: "lex.luxe", joined: days(21), frozen: false }, { id: "p-errand", name: "errand.boy", joined: days(11), frozen: false }] },
      { id: 1, rule: "new_heavy", ref: "new:e", detail: { value: 4_900 }, status: "open", outcome: null, note: null, createdAt: iso(20), reviewedAt: null,
        players: [{ id: "p-fresh", name: "fresh.off.the.L", joined: days(8), frozen: false }] },
      { id: 0, rule: "repeat_pair", ref: "pair:f:g", detail: { transfers: 3 }, status: "reviewed", outcome: "cleared", note: "Roommates. They do this.", createdAt: days(3), reviewedAt: days(2),
        players: [{ id: "p-tasha", name: "tasha.b", joined: days(30), frozen: false }, { id: "p-nina", name: "nina.nyc", joined: days(28), frozen: false }] },
    ],
    frozen: [{ id: "p-sketchy", name: "definitely.not.selling.cs", at: days(1), reason: "Offered C$ for real money in a chat report" }],
  };
  return store;
}
const out = () => ({ ok: true as const, data: structuredClone(data()) });

export async function previewEconomy() {
  previewOnly();
  return out();
}

export async function previewEconomySet(phase: EconomyPhase, on: boolean) {
  previewOnly();
  data().settings.phases[phase] = on;
  return out();
}

export async function previewEconomyFreeze(player: string, frozen: boolean, reason: string) {
  previewOnly();
  const d = data();
  const name = d.flags.flatMap((f) => f.players).find((p) => p.id === player)?.name ?? d.frozen.find((p) => p.id === player)?.name ?? player;
  d.frozen = d.frozen.filter((p) => p.id !== player);
  if (frozen) d.frozen.unshift({ id: player, name, at: new Date().toISOString(), reason: reason || null });
  for (const f of d.flags) for (const p of f.players) if (p.id === player) p.frozen = frozen;
  return out();
}

export async function previewEconomyFlag(id: number, outcome: FlagOutcome, note: string) {
  previewOnly();
  const f = data().flags.find((x) => x.id === id);
  if (!f) return { ok: false as const, error: "That flag isn't here any more." };
  Object.assign(f, { status: "reviewed", outcome, note: note.trim() || null, reviewedAt: new Date().toISOString() });
  if (outcome === "frozen") for (const p of f.players) await previewEconomyFreeze(p.id, true, note.trim() || `Flag: ${f.rule}`);
  return out();
}
