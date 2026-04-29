import type { Metadata } from "next";
import { Inter, Fraunces } from "next/font/google";
import { DarkModeScript } from "@/components/shell/DarkModeScript";
import { ServiceWorkerCleanup } from "@/components/shell/ServiceWorkerCleanup";
import { getWeddingSettings, formatWeddingDateShort } from "@/lib/wedding-settings";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-ui",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

// v1.20.0: dynamic metadata pulled from WeddingSettings. The loader is
// React.cache()-wrapped so this won't add a round-trip when a page on
// the same render already called it. Nice-to-have only; the page
// content itself reads the same loader for consistency.
export async function generateMetadata(): Promise<Metadata> {
  try {
    const w = await getWeddingSettings();
    return {
      title: "Wedding Hub",
      description: `${w.brideFirst} & ${w.groomFirst} — ${formatWeddingDateShort(w)}`,
      robots: { index: false, follow: false },
    };
  } catch {
    return {
      title: "Wedding Hub",
      description: "Private wedding-planning app",
      robots: { index: false, follow: false },
    };
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable}`}>
      <head>
        <DarkModeScript />
      </head>
      <body className="bg-canvas text-ink-primary">
        {/* v1.25.2: clears any inherited service worker. We never
            registered one, but stale SWs from prior deployments at
            this domain were serving old MobileTabBar chunks. */}
        <ServiceWorkerCleanup />
        {children}
      </body>
    </html>
  );
}
