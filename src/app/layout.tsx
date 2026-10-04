import type { Metadata } from "next";
import { Newsreader, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const serif = Newsreader({ variable: "--font-serif", subsets: ["latin"], style: ["normal", "italic"] });
const sans = IBM_Plex_Sans({ variable: "--font-sans", subsets: ["latin"], weight: ["400", "500"] });
const mono = IBM_Plex_Mono({ variable: "--font-mono", subsets: ["latin"], weight: ["400"] });

export const metadata: Metadata = {
  title: "Lone Tree — a field guide to big tech recruiting",
  description: "A field guide to big tech internship recruiting for Stanford GSB MBA1s.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
