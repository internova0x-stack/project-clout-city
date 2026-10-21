import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // lib/freshBuild.ts: the build an open page runs, compared with /api/version after a deploy.
  env: { NEXT_PUBLIC_BUILD: process.env.VERCEL_DEPLOYMENT_ID ?? process.env.VERCEL_GIT_COMMIT_SHA ?? "dev" },
  // The Studio calendar reads week files from content/ at run time (lib/contentDrafts.ts), and the
  // game and the Studio store gossip weeks from content/gossip (lib/gossipImport.ts; story files for
  // its safety check). Server only: none of these reach a browser.
  outputFileTracingIncludes: {
    // The Shop Manager's import (lib/shopImport.ts): the catalog files and the invented-names list.
    "/studio": ["./content/hunts/*.json", "./content/news/*.json", "./content/gossip/*.json", "./content/stories/*.json", "./content/shop/*.json", "./content/culture/parody-names.json"],
    "/home": ["./content/gossip/*.json", "./content/stories/*.json", "./content/hunts/*.json", "./content/news/*.json", "./content/exams/*.json"],
  },
};

export default nextConfig;
