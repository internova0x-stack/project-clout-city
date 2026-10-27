"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "./env";
import { SLOW_DOWN_EVENT, isRateLimited } from "../rateLimits";

let client: SupabaseClient | null = null;

/** Browser Supabase client, or null when Supabase isn't configured. */
export function getBrowserSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  client ??= createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { fetch: limitedFetch } });
  return client;
}

/** Rate limits (migration 0126): a 429 from the database tells the game to show its "slow down" note. */
async function limitedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, init);
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (isRateLimited(url, res.status)) window.dispatchEvent(new Event(SLOW_DOWN_EVENT));
  return res;
}
