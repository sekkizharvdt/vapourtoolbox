import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export',
  reactStrictMode: true,
  // Skip trailing slash to match Firebase cleanUrls
  skipTrailingSlashRedirect: true,
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
  // Disable image optimization for static export
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
