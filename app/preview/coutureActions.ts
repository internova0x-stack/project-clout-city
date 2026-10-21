"use server";

import { previewOnly } from "./guard";
import type { CoutureMap, CoutureResult, PlazaWeeks } from "@/lib/coutureMap";

// Development previews only: Clout Couture on the map (migration 0104) with sample owners. Five yachts moored off
// Astoria, two jets in the air, nina.nyc's statue in front of the Unisphere this week, and a booking for the preview
// player once they own a statue (bought in the preview Shop). Three Waterfront Mansions stand on Billionaire's Row
// (migration 0105).

const monday = (offsetWeeks = 0) => {
  const d = new Date();
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + offsetWeeks * 7);
  return d.toISOString().slice(0, 10);
};
let booked: string | null = null;
const taken = () => new Set([monday(0), monday(3), ...(booked ? [booked] : [])]);

export async function previewCoutureMap(): Promise<CoutureResult<CoutureMap>> {
  previewOnly();
  return {
    ok: true,
    data: {
      yachts: [
        { player: "p-nina", name: "nina.nyc", edition: 1 }, { player: "p-dev", name: "dev.r", edition: 2 },
        { player: "p-tasha", name: "tasha.b", edition: 3 }, { player: "p-marco", name: "No. 0004", edition: 4 },
        { player: "p-kenji", name: "Kenji", edition: 5 },
      ],
      jets: [{ player: "p-nina", name: "nina.nyc", edition: 1 }, { player: "p-dev", name: "dev.r", edition: 2 }],
      statue: { player: "p-nina", name: "nina.nyc", week: monday(0), look: { style: "pilates_princess", skin: "#C68642", body: "curvy" }, style: "pilates_princess", outfit: ["clout-crown"] },
      myPlazaWeek: booked,
      mansions: [
        { player: "p-nina", name: "nina.nyc", plot: 1 }, { player: "p-dev", name: "dev.r", plot: 2 },
        { player: "p-kenji", name: "Kenji", plot: 6 },
      ],
      myPlot: null,
    },
  };
}

export async function previewPlazaWeeks(): Promise<CoutureResult<PlazaWeeks>> {
  previewOnly();
  const t = taken();
  return { ok: true, data: { canBook: !booked, mine: booked, weeks: Array.from({ length: 12 }, (_, i) => ({ week: monday(i), taken: t.has(monday(i)) })) } };
}

export async function previewPlazaBook(week: string): Promise<CoutureResult<PlazaWeeks>> {
  previewOnly();
  if (booked) return { ok: false, error: "Your statue already has its week." };
  if (taken().has(week)) return { ok: false, error: "Someone just took that week. Pick another." };
  booked = week;
  return previewPlazaWeeks();
}
