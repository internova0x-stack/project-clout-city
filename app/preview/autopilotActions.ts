"use server";

import { previewOnly } from "./guard";
import { AUTOPILOT_DEFAULT, type Autopilot, type AutopilotKind } from "@/lib/autopilot";

// Development previews only: the Studio's autopilot switches in memory (migration 0107).

let state: Autopilot = { ...AUTOPILOT_DEFAULT };

export async function previewAutopilot() {
  previewOnly();
  return { ok: true as const, data: { ...state } };
}
export async function previewAutopilotSet(kind: AutopilotKind, on: boolean) {
  previewOnly();
  state = { ...state, [kind]: on };
  return { ok: true as const, data: { ...state } };
}
