import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The Studio calendar reads week files from content/ at run time (lib/contentDrafts.ts).
  outputFileTracingIncludes: {
    "/studio": ["./content/hunts/*.json", "./content/news/*.json"],
  },
};

export default nextConfig;
