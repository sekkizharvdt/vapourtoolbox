/**
 * Work Completion Certificate Detail Page (Server Component)
 *
 * Wrapper for the WCC detail client component
 */

import WCCDetailClient from './WCCDetailClient';

// Generate static params for static export
export function generateStaticParams() {
  // Return a placeholder for static export
  // Actual ID will be extracted from pathname on client side
  return [{ id: 'placeholder' }];
}

export default function WCCDetailPage() {
  return <WCCDetailClient />;
}
