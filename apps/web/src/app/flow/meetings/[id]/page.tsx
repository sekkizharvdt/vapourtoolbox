/**
 * Meeting Detail Page
 *
 * Server component that renders the client-side detail view.
 * Uses generateStaticParams for static export compatibility.
 */

import { use } from 'react';
import MeetingDetailClient from './MeetingDetailClient';

// For static export, we need to provide at least one path
// Client-side component will parse actual ID from URL
export function generateStaticParams() {
  return [{ id: 'placeholder' }];
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function MeetingDetailPage({ params }: PageProps) {
  const { id } = use(params);
  return <MeetingDetailClient key={id} />;
}
