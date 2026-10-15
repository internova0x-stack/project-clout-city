import { redirect } from "next/navigation";
import { GuestMap } from "@/components/GuestMap";
import { getSession } from "@/lib/player";

export const dynamic = "force-dynamic";

export default async function GuestPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  // Supabase falls back to the Site URL (here) when it doesn't recognize a sign-in's redirect:
  // finish signing in through the callback, which also knows a Studio sign-in (lib/authNext.ts).
  if (typeof params.code === "string") redirect(`/auth/callback?code=${encodeURIComponent(params.code)}`);
  const { user, player } = await getSession();
  if (user && player) redirect("/home");
  if (user) redirect("/create");

  return (
    <GuestMap invited={params.invited === "1" || typeof params.ref === "string"} authError={typeof params.auth_error === "string"}
      at={typeof params.at === "string" ? params.at : undefined} />
  );
}
