import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Resolve each page's metadata (its tab title) before showing the page,
  // instead of streaming it in afterwards: otherwise, switching paintings
  // briefly shows the default title in the tab. Our pages are prerendered and
  // cheap to title, so there's no speed to gain from streaming it.
  htmlLimitedBots: /.*/,
};

export default nextConfig;
