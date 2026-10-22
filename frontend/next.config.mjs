import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";

/** Keep dev chunks separate from production builds so HMR never serves a stale manifest. */
const nextConfig = (phase) => ({
  distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next",
  images: { unoptimized: true },
  async rewrites() {
    const backendPort = process.env.BACKEND_PORT || process.env.NEXT_PUBLIC_BACKEND_PORT || "13105";
    const backendUrl = process.env.BACKEND_REWRITE_URL || (process.env.NODE_ENV === 'production' ? `http://backend:${backendPort}` : `http://127.0.0.1:${backendPort}`);
    return [
      {
        source: "/api/v1/:path*",
        destination: `${backendUrl}/api/v1/:path*`,
      },
    ];
  },
});

export default nextConfig;
