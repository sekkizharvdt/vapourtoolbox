/**
 * Vendor Offer Detail Page (Server Component)
 *
 * Wrapper for the client component with generateStaticParams
 * for Next.js static export compatibility.
 */

import VendorOfferDetailClient from './VendorOfferDetailClient';

export function generateStaticParams() {
  return [{ id: 'placeholder' }];
}

export default function VendorOfferDetailPage() {
  return <VendorOfferDetailClient />;
}
