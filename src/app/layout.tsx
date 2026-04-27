import type { Metadata } from "next";
import { Inter, Fraunces } from "next/font/google";
import { DarkModeScript } from "@/components/shell/DarkModeScript";
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

export const metadata: Metadata = {
  title: "Wedding Hub",
  description: "Jamie & Bryony — 26 Sep 2026",
  robots: { index: false, follow: false },
};

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
      <body className="bg-canvas text-ink-primary">{children}</body>
    </html>
  );
}
