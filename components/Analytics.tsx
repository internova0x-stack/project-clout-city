"use client";

import { useEffect, useState } from "react";
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

/**
 * The welcome page after /auth/signout (`?bye=1`): forget the player on this device, then tidy the address. After Delete
 * my account (`&deleted=1`) it also says so.
 */
export function AnalyticsSignedOut() {
  const [deleted, setDeleted] = useState(false);
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("bye")) return;
    resetAnalytics();
    if (url.searchParams.has("deleted")) setDeleted(true);
    url.searchParams.delete("bye");
    url.searchParams.delete("deleted");
    window.history.replaceState(null, "", url.toString());
  }, []);
  if (!deleted) return null;
  return (
    <div className="deleted-note" role="status">
      <span style={{ flex: 1 }}>Your account is deleted. Thanks for playing; Queens will miss you (a little).</span>
      <button className="link-btn" onClick={() => setDeleted(false)}>OK</button>
    </div>
  );
}
