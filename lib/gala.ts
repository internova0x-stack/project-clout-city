// The Charity Gala (the underworld, part 2; migration 0150; spec section 31): the Halo end's own night. At Ditmars Heights
// Rooftop, once a New York week, a player whose meter is revealed and at 70 or more gives C$100 to 1,000; a quarter of the
// gift comes back as clout (250 at most), +10 Mood, and the meter moves 2 toward Halo. game_settings 'gala' mirrors this
// (tests/gala.test.ts). Players call gala_state() and gala_donate(amount); the database decides.

export const GALA = {
  place: "ditmars-heights-rooftop",
  minMeter: 70,
  amounts: [100, 250, 500, 1000],
  cloutShare: 0.25,
  cloutMax: 250,
  mood: 10,
  integrity: 2,
} as const;

export const galaClout = (amount: number) => Math.min(GALA.cloutMax, Math.floor(amount * GALA.cloutShare));

export interface GalaState { invited: boolean; revealed: boolean; donated: number | null; week: string; amounts: number[] }
export type GalaResult<T> = { ok: true; data: T } | { ok: false; error: string };
export interface GalaApi {
  state(): Promise<GalaResult<GalaState>>;
  donate(amount: number): Promise<GalaResult<{ clout: number; mood: number }>>;
}

const ERRORS: Record<string, string> = {
  not_invited: "The gala's list is Halo only. Do some good around the city first.",
  not_here: "The gala is up on Ditmars Heights Rooftop.",
  cant_afford: "Not enough in the bank for that gift.",
  done_this_week: "You gave this week. The committee sends its warmest regards, in calligraphy.",
  bad_amount: "Pick one of the gift amounts.",
  rate_limited: "Slow down a little.",
};
export const galaError = (code: string) => ERRORS[code] ?? "The gala's guest list is acting up. Try again.";
