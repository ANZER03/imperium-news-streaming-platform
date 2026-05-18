import type {NextConfig} from 'next';

/**
 * Server-only env var that points at the backend service.
 * Defaults to the local Maven Spring Boot dev server on 8999.
 * In production, set BACKEND_URL on the deployment so rewrites proxy correctly.
 */
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8999';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  // Allow access to remote image placeholder.
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      },
    ],
  },
  output: 'standalone',
  transpilePackages: ['motion'],
  /**
   * Same-origin API proxy.
   *
   * The browser hits `/api/...` (same origin as the page), Next.js forwards it
   * to BACKEND_URL server-side. This keeps the browser unaware of the backend
   * host so the app works regardless of deployment topology (local dev, dev
   * containers with port forwarding, Cloud Run, etc.) and avoids CORS.
   *
   * Override at runtime by setting `NEXT_PUBLIC_API_URL` to a fully-qualified
   * URL — that disables the proxy and points the client directly at it.
   */
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${BACKEND_URL}/api/:path*`,
      },
    ];
  },
  webpack: (config, {dev}) => {
    // HMR is disabled in AI Studio via DISABLE_HMR env var.
    // Do not modify—file watching is disabled to prevent flickering during agent edits.
    if (dev && process.env.DISABLE_HMR === 'true') {
      config.watchOptions = {
        ignored: /.*/,
      };
    }
    return config;
  },
};

export default nextConfig;
