'use client';

import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout';

export default function EstimationLayout({ children }: { children: React.ReactNode }) {
  return <AuthenticatedLayout>{children}</AuthenticatedLayout>;
}
