/** @type {import('next').NextConfig} */
const nextConfig = {
  images: { unoptimized: true },
  async rewrites() {
    const backendUrl = process.env.BACKEND_REWRITE_URL || (process.env.NODE_ENV === 'production' ? "http://backend:8000" : "http://127.0.0.1:8000");
    return [
      {
        source: "/api/v1/:path*",
        destination: `${backendUrl}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
