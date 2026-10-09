import type { NextConfig } from "next";

const apiOrigin = process.env.HIPERSALES_API_ORIGIN || "http://127.0.0.1:8000";
const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${apiOrigin}/api/:path*` },
      { source: "/legacy", destination: `${apiOrigin}/` },
      { source: "/app.js", destination: `${apiOrigin}/app.js` },
      { source: "/styles.css", destination: `${apiOrigin}/styles.css` },
      { source: "/modules/:path*", destination: `${apiOrigin}/modules/:path*` },
      { source: "/styles/:path*", destination: `${apiOrigin}/styles/:path*` },
      { source: "/assets/:path*", destination: `${apiOrigin}/assets/:path*` },
      { source: "/sw.js", destination: `${apiOrigin}/sw.js` },
      { source: "/legacy/:path*", destination: `${apiOrigin}/:path*` },
    ];
  },
};
export default nextConfig;
