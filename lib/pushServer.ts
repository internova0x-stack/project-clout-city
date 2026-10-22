// The push sender (owner, Oct 18). Server only: reads the queue with the service role, applies lib/push.ts to each
// player's queued pushes and sends the chosen one to every device with web-push. Run by app/api/push/run (a cron) and
// nudged by the game itself (kickPush), at most once a minute per server. Needs NEXT_PUBLIC_VAPID_PUBLIC_KEY,
// VAPID_PRIVATE_KEY and VAPID_SUBJECT (docs/SETUP.md).
import webpush from "web-push";
import { PUSH_KINDS, PUSH_RULES, localDate, planPush, type QueuedPush } from "./push";
import { getAdminSupabase } from "./supabase/admin";

let configured: boolean | null = null;
function vapid(): boolean {
  if (configured !== null) return configured;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
  const priv = process.env.VAPID_PRIVATE_KEY ?? "";
  if (!pub || !priv) return (configured = false);
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:hello@cloutcity.app", pub, priv);
  return (configured = true);
}

type Row = QueuedPush & { player_id: string };

/** Sends what's due, one push per player at most. Returns counts for the cron's log. */
export async function runPush(opts: { player?: string } = {}): Promise<{ sent: number; dropped: number; skipped?: string }> {
  const admin = getAdminSupabase();
  if (!admin) return { sent: 0, dropped: 0, skipped: "no service role" };
  if (!vapid()) return { sent: 0, dropped: 0, skipped: "no VAPID keys" };
  // Step 2 (migration 0082): queue the time-based reminders (bills, gigs, tills, streaks, exams, tickets) first.
  // Each key is queued once, so running this every few minutes is cheap; before 0082 it's simply missing.
  if (!opts.player) await admin.rpc("push_scan").then(({ error }) => { if (error && !/schema cache|does not exist/i.test(error.message)) console.error("push_scan failed", error); });
  // Migration 0112: rent due within three days and not enough in the bank (owner, Oct 22).
  if (!opts.player) await admin.rpc("push_scan_rent_short").then(({ error }) => { if (error && !/schema cache|does not exist/i.test(error.message)) console.error("push_scan_rent_short failed", error); });
  let qq = admin.from("push_queue").select("id, player_id, kind, group_key, title, body, url, deadline_at, close, created_at").eq("status", "queued").limit(2000);
  if (opts.player) qq = qq.eq("player_id", opts.player);
  const { data: queued, error } = await qq;
  if (error || !queued?.length) return { sent: 0, dropped: 0, ...(error ? { skipped: error.message } : {}) };
  const players = [...new Set(queued.map((r) => r.player_id as string))];
  const now = new Date();
  const since = new Date(now.getTime() - 26 * 3600_000).toISOString();
  const activeSince = new Date(now.getTime() - PUSH_RULES.activeMin * 60_000).toISOString();
  const [subs, prefs, sent, sessions] = await Promise.all([
    admin.from("push_subscriptions").select("id, player_id, endpoint, p256dh, auth").in("player_id", players),
    admin.from("push_prefs").select("player_id, off, tz").in("player_id", players),
    admin.from("push_queue").select("player_id, kind, sent_at").eq("status", "sent").gte("sent_at", since).in("player_id", players),
    admin.from("player_sessions").select("player_id").gte("last_seen", activeSince).in("player_id", players),
  ]);
  const active = new Set((sessions.data ?? []).map((s) => s.player_id as string));
  let sentCount = 0;
  let dropCount = 0;
  for (const player of players) {
    const mine = (queued as Row[]).filter((r) => r.player_id === player);
    const pref = (prefs.data ?? []).find((p) => p.player_id === player);
    const tz = (pref?.tz as string) || "America/New_York";
    const today = localDate(now, tz);
    const history = (sent.data ?? []).filter((s) => s.player_id === player && s.sent_at);
    const chat = (k: string) => k !== "test" && PUSH_KINDS[k]?.category === "messages";
    const nonChat = history.filter((s) => s.kind !== "test" && !chat(s.kind as string));
    const latest = (rows: typeof history) => rows.reduce<Date | null>((m, s) => (!m || Date.parse(s.sent_at as string) > m.getTime() ? new Date(s.sent_at as string) : m), null);
    const plan = planPush(mine, {
      now, tz, off: (pref?.off as string[]) ?? [], active: active.has(player),
      sentToday: nonChat.filter((s) => localDate(new Date(s.sent_at as string), tz) === today).length,
      lastSentAt: latest(nonChat), lastChatAt: latest(history.filter((s) => chat(s.kind as string))),
    });
    for (const reason of new Set(plan.drop.map((d) => d.reason))) {
      await admin.from("push_queue").update({ status: "dropped", reason }).in("id", plan.drop.filter((d) => d.reason === reason).map((d) => d.id));
    }
    dropCount += plan.drop.length;
    if (!plan.send) continue;
    const devices = (subs.data ?? []).filter((s) => s.player_id === player);
    const payload = JSON.stringify({ title: plan.send.title, body: plan.send.body, url: plan.send.url, tag: plan.send.tag });
    let delivered = false;
    for (const d of devices) {
      try {
        await webpush.sendNotification({ endpoint: d.endpoint as string, keys: { p256dh: d.p256dh as string, auth: d.auth as string } }, payload, { TTL: 3600, urgency: "normal" });
        delivered = true;
        await admin.from("push_subscriptions").update({ last_ok_at: now.toISOString(), fails: 0 }).eq("id", d.id);
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        // Gone: the browser dropped this device. Anything else counts as a failure; five in a row and it's removed.
        if (code === 404 || code === 410) await admin.from("push_subscriptions").delete().eq("id", d.id);
        else await admin.rpc("push_device_failed", { p_id: d.id });
      }
    }
    const [first, ...rest] = plan.send.ids;
    await admin.from("push_queue").update({ status: delivered ? "sent" : "dropped", reason: delivered ? null : "undeliverable", sent_at: delivered ? now.toISOString() : null }).eq("id", first);
    if (rest.length) await admin.from("push_queue").update({ status: "merged", reason: `into ${first}` }).in("id", rest);
    if (delivered) sentCount += 1;
  }
  return { sent: sentCount, dropped: dropCount };
}

let lastKick = 0;
/** A nudge from game traffic: runs the sender at most once a minute per server (the cron covers quiet times). */
export function kickPush(player?: string): Promise<unknown> {
  const now = Date.now();
  if (!player && now - lastKick < 60_000) return Promise.resolve();
  if (!player) lastKick = now;
  return runPush(player ? { player } : {}).catch((e) => console.error("push run failed", e));
}
