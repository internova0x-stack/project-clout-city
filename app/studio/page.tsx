import { Studio } from "@/components/studio/Studio";
import { StudioSignIn } from "@/components/studio/StudioSignIn";
import type { StudioArc } from "@/lib/studio";
import { getServerSupabase } from "@/lib/supabase/server";
import {
  studioBeatStatus, studioHuntList, studioHuntStatus, studioHuntUpload, studioNewsList, studioNewsReschedule, studioNewsStatus, studioNewsUpload, studioCastAdd, studioCastLines, studioCastStatus, studioContent, studioMetrics, studioReportAction, studioReports, studioReview, studioSchedule, studioStatus, studioUpload,
} from "./actions";

export const dynamic = "force-dynamic";

export const metadata = { title: "Story Studio · Clout City", robots: { index: false, follow: false } };

// The Story Studio: a separate admin page on the same site, outside the game.
// Only accounts listed in story_admins get in (docs/STORIES.md says how to add one).
export default async function StudioPage() {
  const supabase = await getServerSupabase();
  if (!supabase) return <Gate title="Accounts aren't switched on" text="The Studio needs Supabase. Follow docs/SETUP.md, then come back." />;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <StudioSignIn />;
  const { data: admin, error } = await supabase.rpc("is_story_admin");
  if (error) return <Gate title="The Studio isn't set up yet" text="Run supabase/migrations/0007_world_state.sql in the SQL editor first (docs/SETUP.md, step 9)." />;
  if (!admin) {
    return (
      <Gate title="Not on the list" text={`${user.email ?? "This account"} isn't a story admin. An owner can add it in the Supabase SQL editor:`}>
        <pre className="studio-code">{`insert into story_admins (user_id)\nselect id from auth.users where email = '${user.email ?? "you@example.com"}';`}</pre>
        <form action="/auth/signout" method="post"><button className="btn btn-secondary btn-sm" type="submit">Use another account</button></form>
      </Gate>
    );
  }
  const { data } = await supabase.rpc("admin_story_list");
  return (
    <Studio
      initial={(data ?? []) as StudioArc[]}
      who={user.email ?? "admin"}
      api={{
        upload: studioUpload, review: studioReview, schedule: studioSchedule, status: studioStatus, beatStatus: studioBeatStatus, content: studioContent,
        reports: studioReports, reportAction: studioReportAction, metrics: studioMetrics,
        castLines: studioCastLines, castAdd: studioCastAdd, castStatus: studioCastStatus,
        newsList: studioNewsList, newsUpload: studioNewsUpload, newsStatus: studioNewsStatus, newsReschedule: studioNewsReschedule,
        huntList: studioHuntList, huntUpload: studioHuntUpload, huntStatus: studioHuntStatus,
      }}
    />
  );
}

function Gate({ title, text, children }: { title: string; text: string; children?: React.ReactNode }) {
  return (
    <main className="studio studio-gate">
      <section className="studio-card stack-12">
        <span className="studio-mark">Clout City</span>
        <h1 className="display-lg" style={{ margin: 0 }}>Story Studio</h1>
        <p className="title" style={{ margin: 0 }}>{title}</p>
        <p className="subtext" style={{ margin: 0 }}>{text}</p>
        {children}
      </section>
    </main>
  );
}
