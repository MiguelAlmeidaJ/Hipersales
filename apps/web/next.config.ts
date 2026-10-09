import type { NextConfig } from "next";

const apiOrigin = process.env.HIPERSALES_API_ORIGIN || "http://127.0.0.1:8000";
const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${apiOrigin}/api/:path*` },
      { source: "/assets/:path*", destination: `${apiOrigin}/assets/:path*` },
    ];
  },
};
export default nextConfig;
