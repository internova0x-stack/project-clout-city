"use client";

import { useEffect, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";

/** Live count of signed-in players with the game open (Supabase Realtime presence). */
export function usePlayersOnline(playerId: string | null): number | null {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    const supabase = getBrowserSupabase();
    if (!supabase || !playerId) return;
    const channel = supabase.channel("city-online", { config: { presence: { key: playerId } } });
    channel
      .on("presence", { event: "sync" }, () => setCount(Object.keys(channel.presenceState()).length))
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void channel.track({ at: Date.now() });
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [playerId]);
  return count;
}
