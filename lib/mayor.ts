// Contact the Mayor (migration 0105): the Phone's feedback app. Players write to the Mayor's office (a bug, an idea, a
// complaint, a love letter); the team reads every letter in Studio → Mayor's Inbox, marks it read or done, and can write
// back, which the player sees in the app. The rules live in SQL (mayor_write, mayor_letters); this file is the shapes,
// the copy and the form's checks.

import { MAYOR_PAPA_DANI } from "./cast.ts";

export const MAYOR = {
  /** The city's mayor (owner, Oct 22): enthusiastic, listens to his constituents and fixes the city's problems fast. */
  name: MAYOR_PAPA_DANI.name,
  office: `Office of ${MAYOR_PAPA_DANI.name}`,
  messageMin: 10,
  messageMax: 1000,
  replyMax: 1000,
  /** Letters a player can send a New York day. */
  dailyMax: 5,
} as const;

/** His welcome letter at the top of the app. Warm and quick, and it never promises more than a read and a reply. */
export const MAYOR_WELCOME = [
  "Welcome to City Hall, neighbor! I'm Mayor Papa-Dani, and my door is always open. Well, this app is. Same thing!",
  "Something broken? Got a big idea? Mad about the rent? Write me. My team and I read every single letter, and when something's busted in this city, we get on it fast.",
  "You talk, I listen. That's the deal. Now go make some clout!",
] as const;

export type LetterKind = "bug" | "idea" | "complaint" | "praise" | "other";
export const LETTER_KINDS: { id: LetterKind; label: string; emoji: string; placeholder: string }[] = [
  { id: "bug", label: "Something's broken", emoji: "🛠️", placeholder: "What happened, where were you, and what did you expect instead?" },
  { id: "idea", label: "I have an idea", emoji: "💡", placeholder: "What should Clout City have next?" },
  { id: "complaint", label: "A complaint", emoji: "📢", placeholder: "Tell the Mayor what's not working for you." },
  { id: "praise", label: "Love letter", emoji: "💌", placeholder: "What do you love about the city?" },
  { id: "other", label: "Something else", emoji: "✉️", placeholder: "Whatever's on your mind." },
];
export const kindOf = (id: string) => LETTER_KINDS.find((k) => k.id === id) ?? LETTER_KINDS[LETTER_KINDS.length - 1];

export type LetterStatus = "new" | "read" | "done";

/** A letter as its writer sees it. */
export interface Letter {
  id: number;
  kind: LetterKind;
  message: string;
  at: string;
  /** "read" once the office has opened it; "done" once it's dealt with. */
  status: LetterStatus;
  reply: string | null;
  repliedAt: string | null;
}
export interface MayorState {
  letters: Letter[];
  /** Letters left today (New York). */
  left: number;
  /** Replies the player hasn't opened the app to see. */
  unseen: number;
}

export type MayorResult<T> = { ok: true; data: T } | { ok: false; error: string };
export interface MayorApi {
  state(): Promise<MayorResult<MayorState>>;
  write(kind: LetterKind, message: string): Promise<MayorResult<MayorState>>;
  /** Marks the replies seen (opening the app). */
  seen(): Promise<MayorResult<null>>;
}

/** One letter in the Studio's inbox (admin_mayor_letters). */
export interface StudioLetter extends Letter {
  player: { id: string; name: string };
  /** Where they were and what they played on (from the server, not typed). */
  context: { place?: string | null; device?: string | null };
}
export interface StudioMailbag { counts: Record<LetterStatus, number>; letters: StudioLetter[] }
export type MailbagFilter = "new" | "open" | "all";

/** The form's check: null when it can be sent, or what's wrong. */
export function letterProblem(message: string): string | null {
  const n = message.trim().length;
  if (n < MAYOR.messageMin) return `A few more words, please (${MAYOR.messageMin} characters at least).`;
  if (n > MAYOR.messageMax) return `That's a lot for one letter. Keep it to ${MAYOR.messageMax} characters.`;
  return null;
}

/** "Mozilla/5.0 (iPhone; …) … Safari/…" → "iPhone · Safari": enough for the team to reproduce a bug. */
export function deviceLine(ua: string | null | undefined): string | null {
  if (!ua) return null;
  const os = /iPhone|iPad/.test(ua) ? (/iPad/.test(ua) ? "iPad" : "iPhone") : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "Other";
  const browser = /Edg\//.test(ua) ? "Edge" : /CriOS|Chrome\//.test(ua) ? "Chrome" : /FxiOS|Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  return `${os} · ${browser}`;
}

export function mayorError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("daily_max")) return `The Mayor reads ${MAYOR.dailyMax} letters a day from each resident. Write again tomorrow.`;
  if (m.includes("bad_message")) return `Letters are ${MAYOR.messageMin} to ${MAYOR.messageMax} characters.`;
  if (m.includes("bad_kind")) return "Pick what your letter is about.";
  if (m.includes("not_allowed")) return "Your account can't write to the Mayor right now.";
  if (m.includes("no_player")) return "Finish making your character first.";
  if (m.includes("unknown_letter")) return "That letter isn't in the inbox anymore.";
  if (m.includes("bad_reply")) return `Replies are 1 to ${MAYOR.replyMax} characters.`;
  if (m.includes("not_admin")) return "This account isn't a story admin.";
  if (m.includes("function") && m.includes("does not exist")) return "Run migration 0105 to open the Mayor's office.";
  return "The Mayor's office is on lunch. Try again in a second.";
}
