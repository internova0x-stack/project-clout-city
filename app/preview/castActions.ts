"use server";

// Development previews only: the Studio's Cast tab on in-memory lines (nothing is saved).
import type { Admin, CastLine } from "@/lib/studio";

let lines: CastLine[] = [
  { id: 2, npc: "sal", line: "I'm dating again. Don't tell Also Sal.", kind: "update", weekOf: null, status: "review", at: new Date().toISOString() },
  { id: 1, npc: "jojo", line: "Chase Clout got banned again. Third time this month. I'm selling a latte named after it.", kind: "line", weekOf: null, status: "approved", at: new Date().toISOString() },
];
let next = 3;
const off = process.env.NODE_ENV === "production";

export async function previewCastLines(): Promise<Admin<CastLine[]>> {
  if (off) return { ok: false, error: "Previews are off in production." };
  return { ok: true, data: [...lines] };
}
export async function previewCastAdd(npc: string, line: string, kind: "line" | "update", weekOf: string | null): Promise<Admin<null>> {
  if (off) return { ok: false, error: "Previews are off in production." };
  if (line.trim().length < 3) return { ok: false, error: "Write a little more." };
  lines = [{ id: next++, npc, line: line.trim(), kind, weekOf, status: "review", at: new Date().toISOString() }, ...lines];
  return { ok: true, data: null };
}
export async function previewCastStatus(id: number, status: CastLine["status"]): Promise<Admin<null>> {
  if (off) return { ok: false, error: "Previews are off in production." };
  lines = lines.map((l) => (l.id === id ? { ...l, status } : l));
  return { ok: true, data: null };
}
