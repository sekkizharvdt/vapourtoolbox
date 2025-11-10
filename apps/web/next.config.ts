import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Note: Removed 'output: export' to support dynamic routes with Firebase data
  // Firebase Hosting can serve Next.js apps without requiring static export
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
  // Keep images unoptimized for Firebase Hosting compatibility
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
