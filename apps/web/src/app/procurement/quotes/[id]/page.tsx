/**
 * Quote Detail Page (Server Component)
 *
 * Wrapper for the client component with generateStaticParams
 * for Next.js static-export compatibility.
 */

import QuoteDetailClient from './QuoteDetailClient';

export function generateStaticParams() {
  return [{ id: 'placeholder' }];
}

export default function QuoteDetailPage() {
  return <QuoteDetailClient />;
}
