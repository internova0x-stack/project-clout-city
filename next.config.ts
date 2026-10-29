import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // lib/freshBuild.ts: the build an open page runs, compared with /api/version after a deploy.
  env: { NEXT_PUBLIC_BUILD: process.env.VERCEL_DEPLOYMENT_ID ?? process.env.VERCEL_GIT_COMMIT_SHA ?? "dev" },
  // The Studio calendar reads week files from content/ at run time (lib/contentDrafts.ts), and the
  // game and the Studio store gossip weeks from content/gossip (lib/gossipImport.ts; story files for
  // its safety check). Server only: none of these reach a browser.
  // Security review (Oct 29): no other site may frame the game (clickjacking), and browsers don't guess file types.
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
      ],
    }];
  },
  outputFileTracingIncludes: {
    // The Shop Manager's import (lib/shopImport.ts): the catalog files and the invented-names list.
    "/studio": ["./content/hunts/*.json", "./content/news/*.json", "./content/gossip/*.json", "./content/stories/*.json", "./content/shop/*.json", "./content/culture/parody-names.json"],
    "/home": ["./content/gossip/*.json", "./content/stories/*.json", "./content/hunts/*.json", "./content/news/*.json", "./content/exams/*.json"],
  },
};

export default nextConfig;
