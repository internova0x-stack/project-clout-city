"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// Steam sign-in on the start page (docs/STEAM.md). Only inside the Steam app (desktop/), whose preload puts
// `window.cloutSteam` on the page; in a browser this renders nothing. On `/` it asks the app for a Steam ticket and
// posts it to /api/steam/session: signed out, that signs the player in (then `/` shows the welcome screen or the
// creator); signed in with email, it links the Steam account. After Log out (`?bye=1`) it waits for a tap instead,
// so a player can sign in with email.

declare global {
  interface Window {
    cloutSteam?: {
      ticket(): Promise<string>;
      name(): Promise<string>;
      /** Waits for Steam's answer to a checkout order (the overlay's Authorize or Cancel); false after 15 minutes. */
      authorized?(orderId: string): Promise<boolean>;
    };
  }
}

export function SteamBridge() {
  const path = usePathname();
  const params = useSearchParams();
  const [state, setState] = useState<"idle" | "busy" | "wait" | "error">("idle");
  const [error, setError] = useState("");
  const tried = useRef(false);

  const go = async () => {
    const steam = window.cloutSteam;
    if (!steam) return;
    setState("busy");
    try {
      const ticket = await steam.ticket();
      const res = await fetch("/api/steam/session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ticket }) });
      const r = (await res.json()) as { ok: boolean; state?: string; error?: string };
      if (!r.ok) { setError(r.error ?? "Steam sign-in didn't work."); setState("error"); return; }
      if (r.state === "signed_in") { window.location.replace("/"); return; }
      setState("idle");
    } catch {
      setError("Steam sign-in didn't work. Restart the game and try again.");
      setState("error");
    }
  };

  useEffect(() => {
    if (path !== "/" || tried.current || !window.cloutSteam) return;
    tried.current = true;
    if (params.get("bye") === "1") { setState("wait"); return; }
    void go();
  }, [path, params]);

  if (path !== "/" || state === "idle") return null;
  return (
    <div className="steam-bridge" role="status" aria-live="polite">
      {state === "busy" && <span>Signing in with Steam…</span>}
      {state === "wait" && <button className="btn btn-taxi" onClick={() => void go()}>Continue with Steam</button>}
      {state === "error" && (
        <>
          <span>{error}</span>
          <button className="btn btn-ghost" onClick={() => void go()}>Try again</button>
        </>
      )}
    </div>
  );
}
