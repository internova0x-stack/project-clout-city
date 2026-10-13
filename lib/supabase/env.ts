// Supabase settings come from the environment. Without them the guest map still
// works and sign-up explains that accounts aren't switched on yet.

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
// Supabase's newer dashboards and its Vercel integration call the same public key the
// "publishable" key, so either name works. (Each is written out in full so Next.js can
// build it into the browser bundle.)
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";

export function isSupabaseConfigured(): boolean {
  return SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;
}
