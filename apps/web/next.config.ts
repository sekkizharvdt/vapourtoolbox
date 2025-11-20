import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

const nextConfig: NextConfig = {
  // Static export for Firebase Hosting
  // Dynamic routes use server/client component pattern (see /estimation/[id])
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

// Sentry webpack plugin options
const sentryWebpackPluginOptions = {
  // Suppress console logs during build
  silent: true,

  // Organization and project configuration for Sentry
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Auth token for uploading source maps
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Only upload source maps in production builds
  disable: process.env.NODE_ENV !== 'production',

  // Automatically tree-shake Sentry logger statements to reduce bundle size
  disableLogger: true,

  // Hide source maps from generated client bundles
  hideSourceMaps: true,

  // Automatically annotate React components to show up in breadcrumbs
  reactComponentAnnotation: {
    enabled: true,
  },
};

// Export the config with Sentry integration
export default withSentryConfig(nextConfig, sentryWebpackPluginOptions);
