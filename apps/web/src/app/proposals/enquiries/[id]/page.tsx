import EnquiryDetailClient from './EnquiryDetailClient';
import { use } from 'react';

// For static export, we need to provide at least one path
// Client-side component will parse actual ID from URL
export function generateStaticParams() {
  return [{ id: 'placeholder' }];
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  // In Next.js 15+, params is now async
  const { id } = use(params);

  // Use id as key to force component remount when navigating between enquiries
  return <EnquiryDetailClient key={id} />;
}
