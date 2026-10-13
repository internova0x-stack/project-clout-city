"use client";

import { useEffect, useState } from "react";
import { GAME_CONFIG } from "@/lib/config";
import { cityMinutes, formatCityTime, isCityDaytime, msUntilNextCityMinute } from "@/lib/cityClock";

/** The HUD's city-clock time (plus the staging time-travel offset). Empty until mounted, so server and client markup match. */
export function useCityClock(offsetSeconds = 0) {
  const [state, setState] = useState<{ time: string; daytime: boolean }>({ time: "", daytime: false });
  useEffect(() => {
    const cfg = GAME_CONFIG.cityClock;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const now = Date.now() + offsetSeconds * 1000;
      const minutes = cityMinutes(now, cfg);
      setState({ time: formatCityTime(minutes), daytime: isCityDaytime(minutes, cfg) });
      timer = setTimeout(tick, msUntilNextCityMinute(now, cfg));
    };
    tick();
    return () => clearTimeout(timer);
  }, [offsetSeconds]);
  return state;
}
