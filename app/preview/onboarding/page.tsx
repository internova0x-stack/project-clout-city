import { notFound } from "next/navigation";
import { OnboardingMock } from "@/components/preview/OnboardingMock";

// "Players don't know what to do" (owner, Oct 26): mockups of suggestions 2 to 6 (development only): /preview/onboarding?s=1..6
export default async function OnboardingPreview({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const { s } = await searchParams;
  return <OnboardingMock screen={Number(s) || 1} />;
}
