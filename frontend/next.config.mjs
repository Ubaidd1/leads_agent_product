/** @type {import('next').NextConfig} */
const backendUrl = (process.env.BACKEND_URL || "http://localhost:8000").replace(/\/$/, "");

const nextConfig = {
  reactStrictMode: true,
  // Same-origin proxy: the browser only talks to Next.js, so the HttpOnly session cookie is
  // first-party and no CORS is needed. FastAPI stays the single source of truth.
  async rewrites() {
    return [{ source: "/api/v1/:path*", destination: `${backendUrl}/api/v1/:path*` }];
  }
};

export default nextConfig;
