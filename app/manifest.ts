import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Clout City NYC",
    short_name: "Clout City",
    description: "Rent's too high. Dates are worse. Everyone thinks they're famous.",
    // Every page on the site is the app, so iOS keeps it full screen (owner, Oct 17: the PWA showed Safari's bars).
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    // Owner, Oct 23: the launch splash matches the loading screen's black (app/loading.tsx).
    background_color: "#14111A",
    theme_color: "#14111A",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
