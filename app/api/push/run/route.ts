import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { runPush } from "@/lib/pushServer";

// The push sender's cron (owner, Oct 18): call every 5 minutes with "Authorization: Bearer <CRON_SECRET>" (Vercel Cron
// sends that header; Supabase Cron or any scheduler can too). Game traffic also nudges it (lib/pushServer.ts kickPush),
// so this only has to cover the quiet times: morning roundups, streak reminders, players who are away.

export const dynamic = "force-dynamic";

function allowed(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET ?? "";
  const given = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!secret || given.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(secret));
}

async function run(request: NextRequest) {
  if (!allowed(request)) return NextResponse.json({ error: "not allowed" }, { status: 401 });
  return NextResponse.json(await runPush());
}

export const GET = run;
export const POST = run;
