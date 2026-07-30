import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Keep file tracing rooted at this app (avoids parent-directory lockfile confusion)
  outputFileTracingRoot: path.join(__dirname),
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
};

export default nextConfig;
