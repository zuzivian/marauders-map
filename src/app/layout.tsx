import type { Metadata, Viewport } from "next";
import { Newsreader, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import { meta } from "@/data";
import { SITE } from "@/lib/share";
import { ogImage } from "@/lib/og";
import "./globals.css";

const serif = Newsreader({ variable: "--font-serif", subsets: ["latin"], style: ["normal", "italic"] });
const sans = IBM_Plex_Sans({ variable: "--font-sans", subsets: ["latin"], weight: ["400", "500"] });
const mono = IBM_Plex_Mono({ variable: "--font-mono", subsets: ["latin"], weight: ["400"] });

const TITLE = "The Marauder's Map of big tech recruiting";
const description = "Who's hiring MBA interns in big tech, for what, and when: every company's application window on one map, with sources. For Stanford GSB MBA1s.";
const images = ogImage("/", "The Marauder's Map of big tech recruiting: who's hiring MBA interns in big tech, for what, and when", meta.researched);

export const metadata: Metadata = {
  // Link previews (Slack, WhatsApp, iMessage) need absolute URLs; relative ones below resolve against this.
  metadataBase: new URL(SITE),
  alternates: { canonical: "/" },
  title: TITLE,
  description,
  authors: [{ name: "Nat Wong", url: "https://natwong.dev" }],
  creator: "Nat Wong",
  // here.now serves every page with `Referrer-Policy: no-referrer`; FormSubmit needs the site's origin to accept
  // the corrections form. This sends only the origin to other sites (never the page path), like browser defaults.
  referrer: "strict-origin-when-cross-origin",
  openGraph: { title: TITLE, description, type: "website", url: "/", images },
  twitter: { card: "summary_large_image", title: TITLE, description, images },
};

export const viewport: Viewport = { themeColor: "#f5f1e8", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
