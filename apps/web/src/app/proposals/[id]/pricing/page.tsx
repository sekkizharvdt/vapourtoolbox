/**
 * Proposal Pricing Editor Page
 *
 * Server component that renders the client-side pricing editor.
 * Uses generateStaticParams for static export compatibility.
 */

import { use } from 'react';
import PricingEditorClient from './PricingEditorClient';

// For static export, we need to provide at least one path
// Client-side component will parse actual ID from URL
export function generateStaticParams() {
  return [{ id: 'placeholder' }];
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function PricingEditorPage({ params }: PageProps) {
  // In Next.js 15+, params is now async
  const { id } = use(params);

  // Use id as key to force component remount when navigating between proposals
  return <PricingEditorClient key={id} />;
}
