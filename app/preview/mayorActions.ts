"use server";

import { previewOnly } from "./guard";
import { MAYOR, letterProblem, type LetterKind, type LetterStatus, type MailbagFilter, type MayorResult, type MayorState, type StudioLetter, type StudioMailbag } from "@/lib/mayor";

// Development previews only: the Mayor's office in memory, following the rules of migration 0105, shared by
// /preview/home (the Mayor app) and /preview/studio (Mayor's Inbox). ?mayor=new starts with no letters of your own;
// ?mayor=reply starts with an unseen reply from the office.

interface Row extends StudioLetter { seen: boolean; date: string }

const ME = { id: "preview", name: "You (preview)" };
const nyDay = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
const SAMPLES: [string, string, LetterKind, string, string | null, string | null, number][] = [
  ["p-nina", "nina.nyc", "bug", "The Bank app froze after I paid rent at 2am. Had to reload the whole game.", "flushing-meadows", "iPhone · Safari", 25],
  ["p-kai", "kai_beats", "idea", "Let us DJ at Velvet Static on Fridays. I'd bring the whole crew.", "velvet-static", "Android · Chrome", 80],
  ["p-tasha", "tasha.b", "praise", "Lola's column this week had me screaming. Give her a raise.", null, "iPhone · Safari", 190],
  ["p-dev", "dev.r", "complaint", "Rent in Astoria is higher than my clout. Who approved this?", "lucky-seven-deli", "Windows · Edge", 300],
];

let store: { rows: Row[]; next: number; preset: string } | null = null;

function seed(preset: string) {
  const rows: Row[] = SAMPLES.map(([id, name, kind, message, place, device, min], i) => ({
    id: i + 1, kind, message, at: ago(min), status: "new" as LetterStatus, reply: null, repliedAt: null,
    player: { id, name }, context: { place, device }, seen: true, date: nyDay(),
  }));
  if (preset !== "new") {
    rows.push({ id: rows.length + 1, kind: "bug", message: "My avatar's hoodie went see-through on the subway.", at: ago(60 * 26),
      status: preset === "reply" ? "done" : "read", reply: preset === "reply" ? "Thanks for the heads up! The tailors fixed it in today's update. — Mayor Mama-Mandee" : null,
      repliedAt: preset === "reply" ? ago(30) : null, player: ME, context: { place: "flushing-meadows", device: "iPhone · Safari" }, seen: preset !== "reply", date: "2000-01-01" });
  }
  store = { rows, next: rows.length + 1, preset };
}
const get = (preset?: string) => {
  if (!store || (preset !== undefined && preset !== store.preset)) seed(preset ?? "");
  return store!;
};

function mine(): MayorState {
  const s = get();
  const own = s.rows.filter((r) => r.player.id === ME.id).sort((a, b) => b.at.localeCompare(a.at));
  return {
    letters: own.map(({ id, kind, message, at, status, reply, repliedAt }) => ({ id, kind, message, at, status, reply, repliedAt })),
    left: Math.max(0, MAYOR.dailyMax - own.filter((r) => r.date === nyDay()).length),
    unseen: own.filter((r) => r.reply && !r.seen).length,
  };
}

export async function previewMayorState(preset: string): Promise<MayorResult<MayorState>> {
  previewOnly();
  get(preset);
  return { ok: true, data: mine() };
}
export async function previewMayorWrite(kind: LetterKind, message: string): Promise<MayorResult<MayorState>> {
  previewOnly();
  const s = get();
  const problem = letterProblem(message);
  if (problem) return { ok: false, error: problem };
  if (mine().left === 0) return { ok: false, error: `The Mayor reads ${MAYOR.dailyMax} letters a day from each resident. Write again tomorrow.` };
  s.rows.push({ id: s.next++, kind, message: message.trim(), at: new Date().toISOString(), status: "new", reply: null, repliedAt: null,
    player: ME, context: { place: null, device: "Preview" }, seen: true, date: nyDay() });
  return { ok: true, data: mine() };
}
export async function previewMayorSeen(): Promise<MayorResult<null>> {
  previewOnly();
  for (const r of get().rows) if (r.player.id === ME.id) r.seen = true;
  return { ok: true, data: null };
}

function mailbag(filter: MailbagFilter): StudioMailbag {
  const rows = get().rows;
  const counts = { new: 0, read: 0, done: 0 };
  for (const r of rows) counts[r.status]++;
  const letters = rows.filter((r) => filter === "all" || (filter === "new" ? r.status === "new" : r.status !== "done"))
    .sort((a, b) => b.at.localeCompare(a.at))
    .map(({ seen: _seen, date: _date, ...l }) => l);
  return { counts, letters };
}
export async function previewStudioMailbag(filter: MailbagFilter) {
  previewOnly();
  return { ok: true as const, data: mailbag(filter) };
}
export async function previewStudioLetter(id: number, status: LetterStatus, reply: string | null, filter: MailbagFilter) {
  previewOnly();
  const r = get().rows.find((x) => x.id === id);
  if (!r) return { ok: false as const, error: "That letter isn't in the inbox anymore." };
  const text = reply?.trim();
  if (text && text.length > MAYOR.replyMax) return { ok: false as const, error: `Replies are 1 to ${MAYOR.replyMax} characters.` };
  r.status = status;
  if (text) { r.reply = text; r.repliedAt = new Date().toISOString(); r.seen = false; }
  return { ok: true as const, data: mailbag(filter) };
}
