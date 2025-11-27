/**
 * Three-Way Match Detail Page (Server Component)
 *
 * Wrapper for the three-way match detail client component
 */

import ThreeWayMatchDetailClient from './ThreeWayMatchDetailClient';

// Generate static params for static export
export function generateStaticParams() {
  // Return a placeholder for static export
  // Actual ID will be extracted from pathname on client side
  return [{ id: 'placeholder' }];
}

export default function ThreeWayMatchDetailPage() {
  return <ThreeWayMatchDetailClient />;
}
