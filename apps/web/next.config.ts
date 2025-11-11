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
};

export default nextConfig;
