/**
 * Payment Batch Detail Page
 *
 * Server component that renders the client-side detail view.
 * Uses generateStaticParams for static export compatibility.
 */

import { use } from 'react';
import PaymentBatchDetailClient from './PaymentBatchDetailClient';

// For static export, we need to provide at least one path
// Client-side component will parse actual ID from URL
export function generateStaticParams() {
  return [{ id: 'placeholder' }];
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function PaymentBatchDetailPage({ params }: PageProps) {
  // In Next.js 15+, params is now async
  const { id } = use(params);

  // Use id as key to force component remount when navigating between batches
  return <PaymentBatchDetailClient key={id} />;
}
