import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Bungee, Inter, Permanent_Marker } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { launchStartupImages } from "@/lib/launchImages";
import { ConsentBanner } from "@/components/ConsentBanner";

// The three typefaces from the Design System Guide (section 4), downloaded at
// build time and served with the app, so they never depend on Google at runtime.
const bungee = Bungee({ weight: "400", subsets: ["latin"], variable: "--ff-bungee", display: "swap" });
const barlow = Barlow_Condensed({ weight: ["600", "700"], subsets: ["latin"], variable: "--ff-barlow", display: "swap" });
const inter = Inter({ subsets: ["latin"], variable: "--ff-inter", display: "swap" });
// Only the Clout TV card's spray-painted "TV" (owner, Oct 16), so it isn't preloaded.
const marker = Permanent_Marker({ weight: "400", subsets: ["latin"], variable: "--ff-marker", display: "swap", preload: false });

// Low-end phones get solid glass fills instead of backdrop blur (no-blur fallback),
// and Android's install prompt is kept for the add-to-home-screen step.
const NO_BLUR_SCRIPT = `window.addEventListener("beforeinstallprompt",function(e){e.preventDefault();window.__ccInstall=e});try{var n=navigator,m=n.deviceMemory,c=n.hardwareConcurrency;if((m&&m<=2)||(c&&c<=4&&/Android/i.test(n.userAgent)))document.documentElement.classList.add("no-blur")}catch(e){}`;

export const metadata: Metadata = {
  title: "Clout City NYC",
  description: "Arrive in New York as a nobody. Pretend to be somebody.",
  applicationName: "Clout City",
  // iPhone launch images (owner, Oct 23): the loading screen instead of black while the page arrives.
  appleWebApp: { capable: true, title: "Clout City", statusBarStyle: "black-translucent", startupImage: launchStartupImages() },
  icons: { icon: "/icons/favicon-64.png", apple: "/icons/apple-touch-icon.png" },
  openGraph: {
    title: "Clout City NYC",
    description: "Arrive in New York as a nobody. Pretend to be somebody.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#14111A",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${bungee.variable} ${barlow.variable} ${inter.variable} ${marker.variable}`} suppressHydrationWarning>
      <body>
        <Script id="cc-boot" strategy="beforeInteractive">{NO_BLUR_SCRIPT}</Script>
        {/* On wide screens the game sits in a phone-sized frame (see .device in globals.css). */}
        <div className="device">{children}<ConsentBanner /></div>
      </body>
    </html>
  );
}
