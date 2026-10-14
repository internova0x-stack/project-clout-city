import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The Studio calendar reads week files from content/ at run time (lib/contentDrafts.ts), and the
  // game and the Studio store gossip weeks from content/gossip (lib/gossipImport.ts; story files for
  // its safety check). Server only: none of these reach a browser.
  outputFileTracingIncludes: {
    "/studio": ["./content/hunts/*.json", "./content/news/*.json", "./content/gossip/*.json", "./content/stories/*.json"],
    "/home": ["./content/gossip/*.json", "./content/stories/*.json", "./content/hunts/*.json", "./content/news/*.json"],
  },
};

export default nextConfig;
