import { notFound } from "next/navigation";
import { VipMock } from "@/components/preview/VipMock";

// VIP mockup (development only): /preview/vip?s=1..4
export default async function VipPreview({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const { s } = await searchParams;
  return <VipMock screen={Number(s) || 1} />;
}
