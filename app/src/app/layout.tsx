import type { Metadata, Viewport } from "next";
import { Hind, Plus_Jakarta_Sans } from "next/font/google";
import { BRAND } from "@/lib/brand";
import "./globals.css";

// Plus Jakarta Sans for Latin text (a confident, rounded geometric face used by many consumer apps); Hind supplies Devanagari so Hindi product names sit naturally next to English.
const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"], display: "swap" });
const hind = Hind({ variable: "--font-hind", subsets: ["latin", "devanagari"], weight: ["400", "500", "600", "700"], display: "swap" });

export const metadata: Metadata = {
  title: { default: `${BRAND.name}: fresh vegetables and fruit delivered in ${BRAND.city}`, template: `%s | ${BRAND.name}` },
  description: "Fresh fruits and vegetables delivered in Udaipur: Instant, within 1 hour, or within 3 hours.",
  robots: { index: false, follow: false }, // pre-launch: keep out of search engines
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#064e32",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${jakarta.variable} ${hind.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
