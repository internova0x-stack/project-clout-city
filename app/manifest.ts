import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Clout City NYC",
    short_name: "Clout City",
    description: "Arrive in New York as a nobody. Chase clout.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#14111A",
    theme_color: "#14111A",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
