// Which build the server runs (lib/freshBuild.ts): an installed app left open across a deploy
// compares it with its own and reloads, instead of calling server actions that no longer exist.
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ build: process.env.NEXT_PUBLIC_BUILD ?? "dev" }, { headers: { "cache-control": "no-store" } });
}
