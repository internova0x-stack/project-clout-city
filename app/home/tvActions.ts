"use server";

import { TV, tvError, type Station, type StationThread, type TvMine, type TvResult, type TvState } from "@/lib/cloutTv";
import { getServerSupabase } from "@/lib/supabase/server";

// v0.14 Clout TV (migration 0058). Photos sit in a private bucket; these hand out short-lived links to
// the ones this player may see (features, their own), signed with their own session, so storage's
// policies decide.

type Supabase = NonNullable<Awaited<ReturnType<typeof getServerSupabase>>>;

async function sign(supabase: Supabase, paths: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!paths.length) return out;
  const { data } = await supabase.storage.from(TV.bucket).createSignedUrls([...new Set(paths)], 60 * 60);
  for (const d of data ?? []) if (d.path && d.signedUrl) out.set(d.path, d.signedUrl);
  return out;
}

export async function tvState(): Promise<TvResult<TvState>> {
  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, error: "Accounts aren't switched on yet." };
  const { data, error } = await supabase.rpc("tv_state");
  if (error) return { ok: false, error: tvError(error.message) };
  const s = data as Omit<TvState, "featured" | "archive" | "mine"> & {
    featured: (Omit<TvState["archive"][number], "url">) | null; archive: Omit<TvState["archive"][number], "url">[]; mine: Omit<TvMine, "url">[];
  };
  const urls = await sign(supabase, [...(s.featured ? [s.featured.photo] : []), ...s.archive.map((a) => a.photo), ...s.mine.map((m) => m.photo)]);
  return {
    ok: true,
    data: {
      ...s,
      featured: s.featured ? { ...s.featured, url: urls.get(s.featured.photo) ?? null } : null,
      archive: s.archive.map((a) => ({ ...a, url: urls.get(a.photo) ?? null })),
      mine: s.mine.map((m) => ({ ...m, url: urls.get(m.photo) ?? null })),
    },
  };
}

export async function tvSubmit(path: string, handle: string, self: boolean, adult: boolean, publicOk: boolean): Promise<TvResult<{ id: number }>> {
  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, error: "Accounts aren't switched on yet." };
  const { data, error } = await supabase.rpc("tv_submit", { p_path: path, p_handle: handle, p_self: self, p_adult: adult, p_public: publicOk });
  if (error) return { ok: false, error: tvError(error.message) };
  return { ok: true, data: data as { id: number } };
}

/** Withdraws the player's own photo and deletes the file. */
export async function tvWithdraw(id: number): Promise<TvResult<null>> {
  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, error: "Accounts aren't switched on yet." };
  const { data, error } = await supabase.rpc("tv_withdraw", { p_id: id });
  if (error) return { ok: false, error: tvError(error.message) };
  await supabase.storage.from(TV.bucket).remove([data as string]);
  return { ok: true, data: null };
}

// ---- Texts from the stations (Real Clout FM and Clout TV), read-only threads in Messages ----
export async function stationInbox(): Promise<TvResult<StationThread[]>> {
  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, error: "Accounts aren't switched on yet." };
  const { data, error } = await supabase.rpc("station_inbox");
  if (error) return { ok: false, error: tvError(error.message) };
  return { ok: true, data: (data ?? []) as StationThread[] };
}
export async function stationRead(station: Station): Promise<TvResult<null>> {
  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, error: "Accounts aren't switched on yet." };
  const { error } = await supabase.rpc("station_read", { p_station: station });
  return error ? { ok: false, error: tvError(error.message) } : { ok: true, data: null };
}
