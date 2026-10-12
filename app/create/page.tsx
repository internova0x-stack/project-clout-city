import { redirect } from "next/navigation";
import { Creator } from "@/components/Creator";
import { getSession } from "@/lib/player";
import { createPlayer } from "./actions";

export const dynamic = "force-dynamic";

export const metadata = { title: "Create your character · Clout City" };

export default async function CreatePage() {
  const { user, player } = await getSession();
  if (!user) redirect("/");
  if (player) redirect("/home");
  return <Creator needsAgeConfirm={user.user_metadata?.age_confirmed !== true} onSubmit={createPlayer} />;
}
