import type { Metadata, Viewport } from "next";
import { Newsreader, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const serif = Newsreader({ variable: "--font-serif", subsets: ["latin"], style: ["normal", "italic"] });
const sans = IBM_Plex_Sans({ variable: "--font-sans", subsets: ["latin"], weight: ["400", "500"] });
const mono = IBM_Plex_Mono({ variable: "--font-mono", subsets: ["latin"], weight: ["400"] });

const TITLE = "The Marauder's Map of big tech recruiting";
const description = "Who's hiring MBA interns in big tech, for what, and when: every company's application window on one map, with sources. For Stanford GSB MBA1s.";

export const metadata: Metadata = {
  title: TITLE,
  description,
  authors: [{ name: "Nat Wong", url: "https://natwong.dev" }],
  creator: "Nat Wong",
  // here.now serves every page with `Referrer-Policy: no-referrer`; FormSubmit needs the site's origin to accept
  // the corrections form. This sends only the origin to other sites (never the page path), like browser defaults.
  referrer: "strict-origin-when-cross-origin",
  openGraph: { title: TITLE, description, type: "website" },
  twitter: { card: "summary", title: TITLE, description },
};

export const viewport: Viewport = { themeColor: "#f5f1e8", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
