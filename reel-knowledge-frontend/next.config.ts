import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Type checking is handled separately; skip during build to avoid
  // WASM worker crash on this platform (Next.js 16 + win32 SWC issue)
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
