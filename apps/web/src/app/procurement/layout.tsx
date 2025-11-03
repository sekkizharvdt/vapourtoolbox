'use client';

import { ModuleLayout } from '@/components/layouts/ModuleLayout';
import { canViewProcurement } from '@vapour/constants';

export default function ProcurementLayout({ children }: { children: React.ReactNode }) {
  return (
    <ModuleLayout permissionCheck={canViewProcurement} moduleName="Procurement">
      {children}
    </ModuleLayout>
  );
}
