import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Use Firebase Hosting with Next.js SSR integration
  // No output: 'export' - Firebase will handle build and deploy
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
};

export default nextConfig;
