import type { NextConfig } from "next";

// Static export so the site can be served from here.now (static hosting only).
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
};

export default nextConfig;
