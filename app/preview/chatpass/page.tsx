import { notFound } from "next/navigation";
import { ChatPassMock } from "@/components/preview/ChatPassMock";

// Unlimited chat pricing mockup (development only): /preview/chatpass?s=1|2
export default async function ChatPassPreview({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const { s } = await searchParams;
  return <ChatPassMock screen={Number(s) || 1} />;
}
