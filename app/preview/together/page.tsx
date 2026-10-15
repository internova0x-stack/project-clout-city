import { notFound } from "next/navigation";
import { TogetherMock } from "@/components/preview/TogetherMock";

// v0.13 "Better Together" mockup screens (development only): /preview/together?s=1..7
export default async function TogetherPreview({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const { s } = await searchParams;
  return <TogetherMock screen={Number(s) || 1} />;
}
