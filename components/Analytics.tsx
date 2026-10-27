"use client";

import { useEffect } from "react";
import { firstTime, identify, resetAnalytics, track } from "@/lib/analytics";

// PostHog analytics (owner, Oct 27): who is playing (the Supabase user id, nothing else) and signing out.

/** Rendered on pages with a signed-in user. `newAccount`: the creator, before any player exists (signup completed). */
export function AnalyticsUser({ id, newAccount = false }: { id: string; newAccount?: boolean }) {
  useEffect(() => {
    identify(id);
    if (newAccount && firstTime(`cc-ph-signup:${id}`)) track("signup_completed", {});
  }, [id, newAccount]);
  return null;
}

/** The welcome page after /auth/signout (`?bye=1`): forget the player on this device, then tidy the address. */
export function AnalyticsSignedOut() {
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("bye")) return;
    resetAnalytics();
    url.searchParams.delete("bye");
    window.history.replaceState(null, "", url.toString());
  }, []);
  return null;
}
