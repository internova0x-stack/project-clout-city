"use server";

import type { NewsItem } from "@/lib/news";
import { getServerSupabase } from "@/lib/supabase/server";

// City News for players: published, approved items from news_feed() (migration 0017).
// Before the migration runs this is an empty list, which hides the feed, ticker and card.
export async function loadNews(): Promise<NewsItem[]> {
  const supabase = await getServerSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("news_feed");
  if (error || !Array.isArray(data)) return [];
  return data as NewsItem[];
}
