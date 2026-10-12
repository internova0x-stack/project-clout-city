import { redirect } from "next/navigation";
import { GuestMap } from "@/components/GuestMap";
import { getSession } from "@/lib/player";

export const dynamic = "force-dynamic";

export default async function GuestPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user, player } = await getSession();
  if (user && player) redirect("/home");
  if (user) redirect("/create");

  const params = await searchParams;
  return <GuestMap invited={params.invited === "1" || typeof params.ref === "string"} authError={typeof params.auth_error === "string"} />;
}
