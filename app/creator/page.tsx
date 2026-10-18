import { CreatorDashboard } from "@/components/creator/CreatorDashboard";
import { StudioSignIn } from "@/components/studio/StudioSignIn";
import type { CreatorMe } from "@/lib/creators";
import { getServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = { title: "Creator page · Clout City", robots: { index: false, follow: false } };

// The creator page (spec section 21 step 3, migration 0089): a creator signs in with the email the Studio has for
// them and sees their own links and numbers. Counts only, never who their players are.
export default async function CreatorPage() {
  const supabase = await getServerSupabase();
  if (!supabase) return <main className="studio studio-gate"><section className="studio-card stack-12"><span className="studio-mark">Clout City</span><p className="title" style={{ margin: 0 }}>Accounts aren&apos;t switched on yet.</p></section></main>;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return <StudioSignIn dest="/creator" title="Creator page" allowNew
      blurb="For creators we work with. Sign in with the email you gave us to see your links, sign-ups and earnings." />;
  }
  const { data, error } = await supabase.rpc("creator_me");
  if (error) console.error("creator_me failed", error);
  return <CreatorDashboard me={(error ? null : data) as CreatorMe | null} who={user.email ?? "you"} />;
}
