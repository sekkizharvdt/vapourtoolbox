import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export',
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
  images: {
    unoptimized: true, // Required for static export
  },
  // Configure trailing slash to match Firebase Hosting cleanUrls behavior
  trailingSlash: false,
};

export default nextConfig;
