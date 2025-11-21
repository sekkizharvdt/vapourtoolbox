'use client';

import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout';

export default function ProposalsLayout({ children }: { children: React.ReactNode }) {
  return <AuthenticatedLayout>{children}</AuthenticatedLayout>;
}
