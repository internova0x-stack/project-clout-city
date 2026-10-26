import { notFound } from "next/navigation";
import { SubletsMock } from "@/components/preview/SubletsMock";

// Sublets phase 1 mockup screens (development only): /preview/sublets?s=1..7
export default async function SubletsPreview({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const { s } = await searchParams;
  return <SubletsMock screen={Number(s) || 1} />;
}
