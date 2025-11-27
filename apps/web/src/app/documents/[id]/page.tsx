import DocumentDetailClient from './DocumentDetailClient';
import { Suspense } from 'react';

// For static export, we need to provide at least one path
// Client-side component will parse actual ID from URL pathname
export function generateStaticParams() {
  return [{ id: 'placeholder' }];
}

export default function DocumentDetailPage() {
  // Wrap in Suspense because DocumentDetailClient uses useSearchParams()
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <DocumentDetailClient />
    </Suspense>
  );
}
