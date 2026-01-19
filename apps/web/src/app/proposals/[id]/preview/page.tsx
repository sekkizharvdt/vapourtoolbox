/**
 * Proposal Preview & Generation Page
 *
 * Server component that renders the client-side preview.
 * Uses generateStaticParams for static export compatibility.
 */

import { use } from 'react';
import PreviewClient from './PreviewClient';

// For static export, we need to provide at least one path
// Client-side component will parse actual ID from URL
export function generateStaticParams() {
  return [{ id: 'placeholder' }];
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ProposalPreviewPage({ params }: PageProps) {
  // In Next.js 15+, params is now async
  const { id } = use(params);

  // Use id as key to force component remount when navigating between proposals
  return <PreviewClient key={id} />;
}
