import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Removed output: 'export' to support dynamic routes
  // Firebase Hosting supports Next.js dynamic routes via rewrites
  reactStrictMode: true,
  transpilePackages: [
    '@vapour/constants',
    '@vapour/firebase',
    '@vapour/types',
    '@vapour/ui',
    '@vapour/validation',
  ],
  eslint: {
    ignoreDuringBuilds: false,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  // Configure trailing slash to match Firebase Hosting cleanUrls behavior
  trailingSlash: false,
};

export default nextConfig;
