import { DemoGame } from "@/components/demo/DemoGame";

export const metadata = { title: "Try Clout City · Demo" };

// Demo mode (owner, Oct 27): play the first session before signing up. Runs in the browser only (components/demo).
export default function DemoPage() {
  return <DemoGame />;
}
