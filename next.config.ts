import type { NextConfig } from "next";

// Static export so the site can be served from here.now (static hosting only).
// trailingSlash writes each page as a folder with an index.html (out/c/google/index.html), which static hosts serve
// at /c/google/ with no rewrite rules. The default (out/c/google.html) would only answer at /c/google.html.
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
