// Server only: company health (migration 0161, lib/companies.ts), read and rolled over with the service role. A week
// rolls over the first time anyone looks after it ends; a level change posts Lola's Blotter (choice_headlines, kind
// 'city'). Before migration 0161 every function here returns nothing and careers work as before.
import type { SupabaseClient } from "@supabase/supabase-js";
import { COMPANIES, companyHeadline, companyOf, companyView, newCompany, rollCompany, weekOf, type CompanyState, type CompanyView } from "./companies";

type Row = { track: string; state: CompanyState; version: number };

/** Every company, brought up to this week (missing ones are created). Null before migration 0161. */
export async function syncCompanies(admin: SupabaseClient, now = Date.now()): Promise<Map<string, CompanyState> | null> {
  const { data, error } = await admin.from("companies").select("track, state, version");
  if (error) return null;
  const rows = new Map((data as Row[]).map((r) => [r.track, r]));
  const out = new Map<string, CompanyState>();
  const week = weekOf(now);
  for (const def of COMPANIES) {
    const row = rows.get(def.track);
    if (!row) {
      const state = newCompany(def, now);
      const ins = await admin.from("companies").insert({ track: def.track, state }).select("state").maybeSingle();
      out.set(def.track, (ins.data?.state as CompanyState | undefined) ?? state);
      continue;
    }
    if (row.state.week >= week) { out.set(def.track, row.state); continue; }
    const { state, changes } = rollCompany(def, row.state, now);
    // Only the writer whose version still matches rolls the week (and posts the news): no double headlines.
    const upd = await admin.from("companies").update({ state, version: row.version + 1, updated_at: new Date(now).toISOString() })
      .eq("track", def.track).eq("version", row.version).select("track");
    if (!upd.error && upd.data?.length) {
      for (const c of changes) {
        const text = companyHeadline(def, c);
        if (text) await admin.from("choice_headlines").insert({ player_id: null, text, kind: "city" });
      }
      out.set(def.track, state);
    } else {
      const again = await admin.from("companies").select("state").eq("track", def.track).maybeSingle();
      out.set(def.track, (again.data?.state as CompanyState | undefined) ?? state);
    }
  }
  return out;
}

/** One company's state this week (null before migration 0161 or for an unknown track). */
export async function companyNow(admin: SupabaseClient, track: string, now = Date.now()): Promise<CompanyState | null> {
  if (!companyOf(track)) return null;
  const all = await syncCompanies(admin, now);
  return all?.get(track) ?? null;
}

/** Adds a workday's part of the target (its share × the target) to this week. Never blocks the workday. */
export async function companyAdd(admin: SupabaseClient, s: CompanyState, share: number): Promise<void> {
  if (!(share > 0)) return;
  const { error } = await admin.rpc("company_add", { p_track: s.track, p_week: s.week, p_amount: share * s.target });
  if (error && !/company_add/.test(error.message)) console.error("company_add failed", error);
}

/** News → City's Business pages: every company now. Empty before migration 0161. */
export async function companiesNow(admin: SupabaseClient, now = Date.now()): Promise<CompanyView[]> {
  const all = await syncCompanies(admin, now);
  if (!all) return [];
  return COMPANIES.flatMap((def) => { const s = all.get(def.track); return s ? [companyView(def, s, now)] : []; });
}
