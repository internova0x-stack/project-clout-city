// The Studio's Setup check (owner, Oct 14): says in plain words which part of the live setup is
// missing when news, hunts or payments don't show up. Server only. It never returns a secret:
// keys are reported as present or missing (and Stripe's as test or live mode).
import { syncWeeklyContent } from "./contentImport";
import { syncGossipWeeks } from "./gossipImport";
import { getAdminSupabase } from "./supabase/admin";
import { SUPABASE_URL } from "./supabase/env";

import type { SetupCheckRow } from "./studio";

type CheckState = SetupCheckRow["state"];

const MISSING_FN = /does not exist|schema cache|could not find the function/i;

export async function runSetupCheck(siteOrigin: string): Promise<SetupCheckRow[]> {
  const rows: SetupCheckRow[] = [];
  const add = (group: string, label: string, state: CheckState, detail: string) => rows.push({ group, label, state, detail });

  // ---- Vercel environment variables (names only; values never leave the server) ----
  const env = (k: string) => (process.env[k] ?? "").trim();
  add("Vercel", "NEXT_PUBLIC_SUPABASE_URL", SUPABASE_URL ? "ok" : "fail", SUPABASE_URL ? "Set." : "Missing. Add it in Vercel, then redeploy.");
  add("Vercel", "NEXT_PUBLIC_SUPABASE_ANON_KEY", env("NEXT_PUBLIC_SUPABASE_ANON_KEY") ? "ok" : "fail", env("NEXT_PUBLIC_SUPABASE_ANON_KEY") ? "Set." : "Missing.");
  const service = env("SUPABASE_SERVICE_ROLE_KEY");
  add("Vercel", "SUPABASE_SERVICE_ROLE_KEY", service ? "ok" : "fail",
    service ? "Set." : "Missing in this deployment. Add it in Vercel (Production), then redeploy Production. News, hunts, gossip and payments all need it.");
  const sk = env("STRIPE_SECRET_KEY");
  add("Vercel", "STRIPE_SECRET_KEY", !sk ? "fail" : sk.startsWith("sk_test_") ? "ok" : sk.startsWith("sk_live_") ? "warn" : "fail",
    !sk ? "Missing. Copy the Secret key (sk_test_…) from Stripe → Developers → API keys."
      : sk.startsWith("sk_test_") ? "Set (test mode)."
      : sk.startsWith("sk_live_") ? "Set, but it's a LIVE key: real cards will be charged. Use the sk_test_ key until v1.0."
      : sk.startsWith("pk_") ? "That's the Publishable key (pk_…). Use the Secret key (sk_test_…)." : "Doesn't look like a Stripe secret key (should start with sk_test_).");
  const wh = env("STRIPE_WEBHOOK_SECRET");
  add("Vercel", "STRIPE_WEBHOOK_SECRET", !wh ? "fail" : wh.startsWith("whsec_") ? "ok" : "fail",
    !wh ? "Missing. Copy the Signing secret (whsec_…) from your Stripe webhook destination." : wh.startsWith("whsec_") ? "Set." : "Should start with whsec_ (the destination's Signing secret).");
  const site = env("NEXT_PUBLIC_SITE_URL");
  add("Vercel", "NEXT_PUBLIC_SITE_URL", site ? "ok" : "warn", site ? `Set to ${site}` : "Not set: invite links and payment returns use the address the page was opened on.");

  // ---- Supabase: the service key works, and the migrations are in ----
  const admin = getAdminSupabase();
  if (!admin) {
    add("Supabase", "Service key", "fail", "Can't check the database without SUPABASE_SERVICE_ROLE_KEY.");
    return rows;
  }
  const probe = await admin.from("stripe_events").select("id", { count: "exact", head: true });
  if (probe.error) {
    add("Supabase", "Service key", "fail", /jwt|invalid|api key|unauthor/i.test(probe.error.message)
      ? "Supabase rejected the key. Copy the service_role key again (Project Settings → API) into Vercel, then redeploy."
      : `Supabase said: ${probe.error.message}`);
    return rows;
  }
  add("Supabase", "Service key", "ok", "Works.");

  const migration = async (n: string, what: string, fn: string, args: Record<string, unknown>) => {
    const { error } = await admin.rpc(fn, args);
    const missing = !!error && MISSING_FN.test(error.message);
    add("Supabase", `Migration ${n}`, missing ? "fail" : "ok", missing ? `Not run. Run supabase/migrations/${n} in the SQL Editor (${what}).` : `Run (${what}).`);
    return !missing;
  };
  await migration("0036_gossip_trail.sql", "gossip daily tasks", "gossip_leads", { p_player: "00000000-0000-0000-0000-000000000000" });
  const has0037 = await migration("0037_content_autopublish.sql", "news and hunts publish themselves", "content_import_news", { p_items: [] });
  await migration("0038_party_rooms.sql", "party floor and chat", "party_room", { p_event: "setup-check", p_after: 0 });
  // Recent ones (owner, Oct 18: Go live now failed silently before 0080 was run). Read-only probes.
  await migration("0078_push.sql", "push notifications", "push_prefs_get", {});
  await migration("0079_membership.sql", "Membership & purchases", "membership_billing", { p_player: "00000000-0000-0000-0000-000000000000" });
  await migration("0080_story_go_live.sql", "Go live now in Stories", "admin_story_go_live", { p_arc: "setup-check" });
  await migration("0087_creators.sql", "Affiliates: creators and links", "creator_link", { p_slug: "setup-check", p_click: false });
  await migration("0088_creator_commissions.sql", "Affiliates: commissions", "creator_referred", { p_player: "00000000-0000-0000-0000-000000000000" });
  await migration("0089_creator_page.sql", "Creator page (/creator)", "creator_me", {});
  await migration("0090_creator_payouts.sql", "Affiliates: payouts", "admin_payouts", {});
  await migration("0091_creator_videos.sql", "Affiliates: videos", "admin_creator_videos", {});
  await migration("0092_skill_perks.sql", "skill perks: skill gigs, invites, Dance at the club", "skill_perks_state", {});

  // ---- News and hunts: import now and say what happened to each file ----
  if (has0037) {
    const results = await syncWeeklyContent({ force: true }).catch((e: unknown) => [{ file: "content", result: `error: ${e instanceof Error ? e.message : String(e)}` }]);
    if (!results.length) add("Content", "Week files", "fail", "No week files reached the server (content/news, content/hunts).");
    for (const r of results) add("Content", r.file, /^(error|skipped)/.test(r.result) ? "fail" : "ok", r.result);
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
    const live = await admin.from("news_items").select("id", { count: "exact", head: true }).eq("status", "approved").lte("publish_on", today);
    add("Content", "News items live today", (live.count ?? 0) > 0 ? "ok" : "warn",
      live.error ? live.error.message : `${live.count ?? 0} approved items dated today or earlier (New York). Players see them in the News app.`);
    const hunts = await admin.from("hunts").select("id, week, status").order("week", { ascending: false }).limit(3);
    add("Content", "Hunts stored", (hunts.data?.length ?? 0) > 0 ? "ok" : "warn",
      hunts.error ? hunts.error.message : (hunts.data ?? []).map((h) => `${h.id} (week of ${h.week}, ${h.status})`).join(" · ") || "None yet.");
  }

  // ---- Gossip (#6, Oct 14): the Tea app and the gossip daily tasks need this week's file ----
  const gossip = await syncGossipWeeks({ force: true }).catch((e: unknown) => [{ week: "gossip", result: `error: ${e instanceof Error ? e.message : String(e)}` }]);
  for (const g of gossip) add("Content", `Gossip week of ${g.week}`, /^error/.test(g.result) ? "fail" : "ok", g.result);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
  const monday = (() => { const d = new Date(`${today}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); })();
  const thisWeek = gossip.some((g) => g.week === monday && !/^error/.test(g.result));
  add("Content", "Gossip this week", thisWeek ? "ok" : "fail", thisWeek
    ? `The week of ${monday} is in: the Tea app and gossip daily tasks have stories.`
    : `No gossip file for the week of ${monday}. Add content/gossip/${monday}.json (docs/WEEKLY-CONTENT.md), or the Tea app stays empty and the gossip daily tasks don't appear.`);

  // ---- Stripe: the key works, and the webhook has been heard from ----
  if (sk) {
    try {
      const res = await fetch("https://api.stripe.com/v1/balance", { headers: { Authorization: `Bearer ${sk}` } });
      add("Stripe", "Secret key", res.ok ? "ok" : "fail", res.ok ? "Stripe accepted it." : `Stripe rejected it (${res.status}). Copy the Secret key again.`);
    } catch {
      add("Stripe", "Secret key", "warn", "Couldn't reach Stripe to check it.");
    }
  }
  add("Stripe", "Webhook URL", "ok", `Your webhook destination should send to ${siteOrigin}/api/stripe/webhook (Snapshot payload; checkout.session.completed, checkout.session.async_payment_succeeded, checkout.session.expired, charge.refunded).`);
  const events = await admin.from("stripe_events").select("type, result, received_at").order("received_at", { ascending: false }).limit(3);
  const purchases = await admin.from("purchases").select("status", { count: "exact" }).order("created_at", { ascending: false }).limit(20);
  const pending = (purchases.data ?? []).filter((p) => p.status === "pending").length;
  if ((events.data?.length ?? 0) > 0) {
    add("Stripe", "Webhook", "ok", `Last events: ${(events.data ?? []).map((e) => `${e.type} → ${e.result}`).join(" · ")}`);
  } else {
    add("Stripe", "Webhook", (purchases.count ?? 0) > 0 ? "fail" : "warn", (purchases.count ?? 0) > 0
      ? `${purchases.count} checkout(s) started but no webhook has arrived. Check the destination URL above and Stripe → Webhooks → Event deliveries (400 = wrong signing secret, 500 = service key).`
      : "No webhook received yet. Buy a party ticket with card 4242 4242 4242 4242 to test.");
  }
  if (pending > 0) add("Stripe", "Pending purchases", "warn", `${pending} recent purchase(s) still "unlocking": the webhook hasn't confirmed them.`);
  return rows;
}
