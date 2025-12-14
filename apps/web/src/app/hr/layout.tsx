'use client';

import { ModuleLayout } from '@/components/layouts/ModuleLayout';
import { canViewHR } from '@vapour/constants';

export default function HRLayout({ children }: { children: React.ReactNode }) {
  return (
    <ModuleLayout permissionCheck2={canViewHR} moduleName="HR">
      {children}
    </ModuleLayout>
  );
}
