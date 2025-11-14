'use client';

import { ModuleLayout } from '@/components/layouts/ModuleLayout';
import { canViewEstimation } from '@vapour/constants';

export default function MaterialsLayout({ children }: { children: React.ReactNode }) {
  return (
    <ModuleLayout permissionCheck={canViewEstimation} moduleName="Materials">
      {children}
    </ModuleLayout>
  );
}
