import type { Metadata, Viewport } from "next";
import { Newsreader, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const serif = Newsreader({ variable: "--font-serif", subsets: ["latin"], style: ["normal", "italic"] });
const sans = IBM_Plex_Sans({ variable: "--font-sans", subsets: ["latin"], weight: ["400", "500"] });
const mono = IBM_Plex_Mono({ variable: "--font-mono", subsets: ["latin"], weight: ["400"] });

const description = "What big tech MBA internship titles mean, how the companies differ, when applications open, and which prep is worth it. For Stanford GSB MBA1s.";

export const metadata: Metadata = {
  title: "Lone Tree: a field guide to big tech recruiting",
  description,
  authors: [{ name: "Nat Wong", url: "https://natwong.dev" }],
  creator: "Nat Wong",
  // here.now serves every page with `Referrer-Policy: no-referrer`; FormSubmit needs the site's origin to accept
  // the corrections form. This sends only the origin to other sites (never the page path), like browser defaults.
  referrer: "strict-origin-when-cross-origin",
  openGraph: { title: "Lone Tree: a field guide to big tech recruiting", description, type: "website" },
  twitter: { card: "summary", title: "Lone Tree: a field guide to big tech recruiting", description },
};

export const viewport: Viewport = { themeColor: "#f5f1e8", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
