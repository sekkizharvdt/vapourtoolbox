/**
 * PO Amendment Detail Page (Server Component)
 *
 * Wrapper for the amendment detail client component
 */

import AmendmentDetailClient from './AmendmentDetailClient';

// Generate static params for static export
export function generateStaticParams() {
  // Return a placeholder for static export
  // Actual ID will be extracted from pathname on client side
  return [{ id: 'placeholder' }];
}

export default function AmendmentDetailPage() {
  return <AmendmentDetailClient />;
}
