import BoughtOutDetailClient from './BoughtOutDetailClient';
import { use } from 'react';

// For static export, provide placeholder path
// Client component will parse actual ID from URL
export function generateStaticParams() {
  return [{ id: 'placeholder' }];
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  // In Next.js 15+, params is async
  const { id } = use(params);

  // Use id as key to force component remount when navigating between items
  return <BoughtOutDetailClient key={id} />;
}
